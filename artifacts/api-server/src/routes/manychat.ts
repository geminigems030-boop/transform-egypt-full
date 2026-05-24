import { Router, type IRouter, type Request, type Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { processManychatInboundDm } from "./webhooks";
import { detectLanguage, type ImageData } from "../lib/ai-reply";
import { findRelevantPost } from "../lib/media-matcher";
import { logger } from "../lib/logger";

// ── HTTP header mojibake fix ──────────────────────────────────────────────────
// HTTP/1.1 specifies that header values are ISO-8859-1 (Latin-1). Node.js
// parses each raw byte as a Latin-1 character (U+00xx). ManyChat sends Arabic
// text in headers (x-last-input, x-name) as raw UTF-8 bytes without percent-
// encoding, so every multi-byte Arabic code-point arrives as 2–3 separate
// Latin-1 characters (e.g. "م" U+0645 → UTF-8 bytes D9 85 → "Ù…").
//
// Fix: treat the char-codes as raw bytes and re-decode as UTF-8. If the result
// is not valid UTF-8 (already-correct English/ASCII passes through unchanged
// since ASCII bytes are identical in both encodings) the original string is
// returned as-is.
function fixHeaderMojibake(s: string): string {
  // Fast-path: ASCII-only strings are the same in both Latin-1 and UTF-8.
  if (/^[\x00-\x7F]*$/.test(s)) return s;
  try {
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i) & 0xff;
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return s; // Not mojibaked — return original.
  }
}

// ── Image / media URL detection ───────────────────────────────────────────────
// ManyChat passes CDN URLs as plain text when a customer sends an image,
// voice note, or shares a post. We detect those URLs, fetch the content,
// and hand it to the AI — images via Claude Vision, audio via Gemini transcription.

const IMAGE_URL_PATTERNS = [
  // Facebook / Instagram CDN image URLs (sent when customer DMs a photo)
  /https:\/\/lookaside\.fbsbx\.com\/ig_messaging_cdn\//i,
  /https:\/\/lookaside\.instagram\.com\//i,
  /https:\/\/scontent[^.]*\.fbcdn\.net\//i,
  /https:\/\/cdninstagram\.com\//i,
  // Generic image extensions at any CDN
  /https?:\/\/\S+\.(jpg|jpeg|png|gif|webp)(\?[^\s]*)?$/i,
];

// Audio URL patterns — Instagram voice notes come from the same CDN as images
// but with audio MIME types (ogg, mp4, m4a, mpeg, aac).
const AUDIO_URL_PATTERNS = [
  // Facebook/Instagram CDN — same base domain, audio content-type distinguishes them
  /https:\/\/lookaside\.fbsbx\.com\/ig_messaging_cdn\//i,
  /https:\/\/lookaside\.instagram\.com\//i,
  // Generic audio file extensions
  /https?:\/\/\S+\.(ogg|m4a|mp3|aac|wav|opus|mp4)(\?[^\s]*)?$/i,
];

// Gemini-supported audio MIME types for inline_data
const AUDIO_MIME_TYPES_GEMINI = new Set([
  "audio/ogg", "audio/mp4", "audio/mpeg", "audio/aac",
  "audio/wav", "audio/webm", "audio/opus", "audio/flac",
]);

/**
 * If `url` is an Instagram/Facebook voice note URL, fetch the audio, send it
 * to Gemini for transcription, and return the spoken text.
 * Returns null if not audio or on any failure (graceful degradation).
 */
async function tryTranscribeAudioFromUrl(url: string): Promise<string | null> {
  const trimmed = url.trim();

  // Quick pre-check: must match an audio pattern OR come from the CDN
  // (CDN URLs need content-type to confirm audio — we check after fetch)
  const mightBeAudio = AUDIO_URL_PATTERNS.some((p) => p.test(trimmed));
  if (!mightBeAudio) return null;

  const GEMINI_KEY = process.env["GEMINI_API_KEY"];
  if (!GEMINI_KEY) {
    logger.warn("manychat: GEMINI_API_KEY not set — skipping voice transcription");
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(trimmed, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TransforMBot/1.0)",
        "Accept": "audio/*,*/*;q=0.8",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      logger.warn({ status: res.status }, "manychat: audio fetch non-2xx");
      return null;
    }

    const rawContentType = (res.headers.get("content-type") || "").split(";")[0]?.trim() || "";

    // If the server returns an image type (this URL is actually an image, not audio),
    // bail out — tryFetchImageFromUrl will handle it.
    if (rawContentType.startsWith("image/")) return null;

    // Normalise to a Gemini-supported MIME type
    let mimeType = rawContentType;
    if (!AUDIO_MIME_TYPES_GEMINI.has(mimeType)) {
      // CDN often returns application/octet-stream — default to audio/ogg
      // which is Instagram's native voice note format
      mimeType = "audio/ogg";
    }

    const arrayBuffer = await res.arrayBuffer();
    // Cap at 10 MB — Gemini inline_data limit is ~20 MB base64
    if (arrayBuffer.byteLength > 10 * 1024 * 1024) {
      logger.warn({ bytes: arrayBuffer.byteLength }, "manychat: audio too large, skipping transcription");
      return null;
    }

    const base64Audio = Buffer.from(arrayBuffer).toString("base64");

    logger.info(
      { bytes: arrayBuffer.byteLength, mimeType, url: trimmed.slice(0, 60) + "…" },
      "manychat: transcribing voice note via Gemini",
    );

    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent([
      "This is a voice message sent by a customer to a beauty salon's Instagram DM. " +
      "Transcribe exactly what is said. Return ONLY the spoken words — no labels, " +
      "no explanations, no language tags. If Arabic, write it in Arabic script. " +
      "If the audio is silent or unintelligible, return the single word: [silent]",
      { inlineData: { data: base64Audio, mimeType } },
    ]);

    const transcript = result.response.text().trim();
    if (!transcript || transcript === "[silent]") return null;

    logger.info(
      { chars: transcript.length, preview: transcript.slice(0, 80) },
      "manychat: voice note transcribed",
    );
    return transcript;
  } catch (err) {
    logger.warn(
      { err: (err as Error).message, url: trimmed.slice(0, 80) },
      "manychat: voice transcription failed, continuing without transcript",
    );
    return null;
  }
}

const SUPPORTED_MIME_TYPES = new Set<ImageData["mimeType"]>([
  "image/jpeg", "image/png", "image/gif", "image/webp",
]);

/**
 * If `text` looks like a Facebook/Instagram image CDN URL, fetch it and return
 * the base64-encoded bytes + MIME type. Returns null if not an image URL or
 * if fetching fails (we degrade gracefully — Yara still replies without vision).
 */
async function tryFetchImageFromUrl(url: string): Promise<ImageData | null> {
  const trimmed = url.trim();
  const isImageUrl = IMAGE_URL_PATTERNS.some((p) => p.test(trimmed));
  if (!isImageUrl) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch(trimmed, {
      signal: controller.signal,
      headers: {
        // Mimic a browser to avoid CDN 403s
        "User-Agent": "Mozilla/5.0 (compatible; TransforMBot/1.0)",
        "Accept": "image/*,*/*;q=0.8",
      },
    });
    clearTimeout(timeout);

    const rawContentType = (res.headers.get("content-type") || "").split(";")[0]?.trim() || "";
    // Normalize "image/jpg" → "image/jpeg" (not in Anthropic's allowed set)
    const normalizedType = rawContentType === "image/jpg" ? "image/jpeg" : rawContentType;
    const mimeType: ImageData["mimeType"] = SUPPORTED_MIME_TYPES.has(normalizedType as ImageData["mimeType"])
      ? (normalizedType as ImageData["mimeType"])
      : "image/jpeg"; // assume JPEG if CDN returns generic content-type

    if (!res.ok) {
      logger.warn({ status: res.status, url: trimmed.slice(0, 80) }, "manychat: image fetch non-2xx");
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    // Cap at 4 MB to avoid oversized base64 payloads to Claude
    if (arrayBuffer.byteLength > 4 * 1024 * 1024) {
      logger.warn({ bytes: arrayBuffer.byteLength }, "manychat: image too large, skipping vision");
      return null;
    }

    const base64 = Buffer.from(arrayBuffer).toString("base64");
    logger.info(
      { bytes: arrayBuffer.byteLength, mimeType, url: trimmed.slice(0, 60) + "…" },
      "manychat: fetched customer image for vision",
    );
    return { base64, mimeType };
  } catch (err) {
    logger.warn({ err: (err as Error).message, url: trimmed.slice(0, 80) }, "manychat: image fetch failed, continuing without vision");
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ManyChat → TransforM Egypt bridge.
//
// ManyChat (Pro plan) holds Meta-approved Advanced Access for IG/FB messaging
// — capabilities our own app is gated out of (`ig_multi_app: false`). Path 2
// of the Path 1/2/3 decision: ManyChat receives every IG/FB DM, then fires an
// "External Request" action to this endpoint with the customer's text. We:
//
//   1. Validate the shared-secret header (MANYCHAT_WEBHOOK_SECRET).
//   2. Persist the inbound message into instagram_messages so it shows up in
//      the admin inbox alongside webhook-sourced rows.
//   3. Auto-capture leads (phone-in-text + escalation rules), open Submission.
//   4. Run Gemini reply generation (mode-controlled per channel).
//   5. Send the reply directly via ManyChat's sendContent API (bypasses the
//      Dynamic Response toggle — no UI config needed). Falls back to returning
//      the v2 JSON in case sendContent fails (covers edge-cases).
//
// ManyChat External Request body (configured in the ManyChat flow editor):
//
//   {
//     "subscriber_id": "{{subscriber_id}}",
//     "text":          "{{last_input_text}}",
//     "name":          "{{first_name}} {{last_name}}",
//     "channel":       "instagram"   // or "facebook"
//   }
//
// If we have nothing to send (mode=off, escalation, or duplicate delivery),
// we return an empty `messages` array — ManyChat treats this as a no-op.
// ─────────────────────────────────────────────────────────────────────────────

const router: IRouter = Router();

const SECRET = process.env["MANYCHAT_WEBHOOK_SECRET"] || "";
const MC_TOKEN = process.env["MANYCHAT_API_TOKEN"] || "";
const MC_API = "https://api.manychat.com";

interface ManychatBody {
  // Our custom token fields
  subscriber_id?: string | number;
  text?: string;
  name?: string;
  channel?: string;
  // ManyChat standard Dynamic Content fields
  id?: string | number;
  last_input_text?: string;
  first_name?: string;
  last_name?: string;
  // Ad context — name/title of the ad or post the customer replied to.
  // Pass {{last_ad_name}} or {{ad_name}} from ManyChat flow variables.
  ad_name?: string;
  ad_id?: string;
}

// ManyChat Dynamic Block v2 actions — applied to the subscriber by ManyChat
// after it processes our response. Tags + custom fields must already exist on
// the page (created via the ManyChat API in scripts/manychat-setup.mjs).
type ManychatAction =
  | { action: "add_tag"; tag_name: string }
  | { action: "remove_tag"; tag_name: string }
  | { action: "set_field_value"; field_name: string; value: string };

interface ManychatResponse {
  version: "v2";
  content: {
    messages: Array<{ type: "text"; text: string }>;
    actions?: ManychatAction[];
  };
}

const EMPTY_RESPONSE: ManychatResponse = {
  version: "v2",
  content: { messages: [] },
};

// ── ManyChat sendContent API ─────────────────────────────────────────────────
// Sends a message directly to a subscriber using ManyChat's API.
// Returns true on success, false on any error (we log but don't throw).
export async function sendViaManychat(
  subscriberId: string,
  text: string,
  platform: "instagram" | "facebook" | "tiktok" = "instagram",
): Promise<boolean> {
  if (!MC_TOKEN) {
    logger.warn("manychat: MANYCHAT_API_TOKEN not set; cannot sendContent");
    return false;
  }
  try {
    const body: Record<string, unknown> = {
      subscriber_id: Number(subscriberId),
      // HUMAN_AGENT tag allows delivery outside Meta's 24-hour window.
      // Must be sent within 7 days of the user's last message.
      message_tag: "HUMAN_AGENT",
      data: {
        version: "v2",
        content: {
          messages: [{ type: "text", text }],
        },
      },
    };
    // TikTok uses a different ManyChat API namespace.
    const namespace = platform === "tiktok" ? "tiktok" : "fb";
    const res = await fetch(`${MC_API}/${namespace}/sending/sendContent`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MC_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { status?: string; message?: string; code?: number };
    if (json.status === "success") {
      logger.info(
        { subscriber: subscriberId.slice(0, 6) + "***" },
        "manychat: sendContent OK (HUMAN_AGENT tag)",
      );
      return true;
    }
    // Fallback: retry without tag if HUMAN_AGENT is rejected for any known reason.
    const errMsg = (json.message ?? "").toLowerCase();
    if (errMsg.includes("24 hour") || errMsg.includes("outside") || errMsg.includes("unsupported") || errMsg.includes("tag")) {
      logger.info(
        { subscriber: subscriberId.slice(0, 6) + "***" },
        "manychat: HUMAN_AGENT rejected, retrying without tag",
      );
      delete body.message_tag;
      const res2 = await fetch(`${MC_API}/${namespace}/sending/sendContent`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${MC_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const json2 = (await res2.json()) as { status?: string; message?: string; code?: number };
      if (json2.status === "success") {
        logger.info(
          { subscriber: subscriberId.slice(0, 6) + "***" },
          "manychat: sendContent OK (no tag)",
        );
        return true;
      }
      logger.warn(
        { subscriber: subscriberId.slice(0, 6) + "***", resp: json2 },
        "manychat: sendContent non-success (retry)",
      );
      return false;
    }
    logger.warn(
      { subscriber: subscriberId.slice(0, 6) + "***", resp: json },
      "manychat: sendContent non-success",
    );
    return false;
  } catch (err) {
    logger.warn(
      { err: (err as Error).message },
      "manychat: sendContent fetch failed",
    );
    return false;
  }
}

// ── Set yara_reply custom field directly via ManyChat API ────────────────────
// Bypasses response-mapping entirely — sets the field on the subscriber record
// so the Condition block in the flow can reliably read it.
// Field id 14569333 = yara_reply (created in ManyChat custom fields).
const YARA_REPLY_FIELD_ID = 14569333;

async function setYaraReplyField(
  subscriberId: string,
  text: string,
): Promise<void> {
  if (!MC_TOKEN) return;
  try {
    const body = {
      subscriber_id: Number(subscriberId),
      field_id: YARA_REPLY_FIELD_ID,
      field_value: text,
    };
    const res = await fetch(`${MC_API}/fb/subscriber/setCustomField`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MC_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { status?: string; message?: string };
    logger.info(
      { subscriber: subscriberId.slice(0, 6) + "***", status: json.status },
      "manychat: setCustomField yara_reply",
    );
  } catch (err) {
    logger.warn(
      { err: (err as Error).message },
      "manychat: setCustomField failed (non-fatal)",
    );
  }
}

async function manychatHandler(req: Request, res: Response) {
  // Auth: shared secret in header. Refuse if not configured (avoids accepting
  // an unauthenticated webhook by mistake).
  if (!SECRET) {
    logger.warn("manychat: MANYCHAT_WEBHOOK_SECRET not set; refusing");
    res.status(503).json(EMPTY_RESPONSE);
    return;
  }
  const provided = req.header("x-manychat-secret") || "";
  if (provided !== SECRET) {
    logger.warn("manychat: invalid or missing x-manychat-secret header");
    res.status(403).json(EMPTY_RESPONSE);
    return;
  }

  const body = (req.body || {}) as ManychatBody;
  const q = req.query as Record<string, string>;

  // Log ALL request info so we can see exactly what ManyChat sends
  const allHeaders: Record<string, string | string[] | undefined> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (k.toLowerCase() !== "x-manychat-secret") allHeaders[k] = v;
  }
  // Log key fields explicitly so they're never truncated, then full headers for diagnosis.
  logger.info(
    {
      keys: Object.keys(body),
      raw: JSON.stringify(body).slice(0, 400),
      query: JSON.stringify(q).slice(0, 300),
      headers: JSON.stringify(allHeaders).slice(0, 2000),
      contentType: req.headers["content-type"],
      // Critical fields logged explicitly so they survive truncation
      xChannel: req.headers["x-channel"] ?? "(none)",
      xSubscriberId: req.headers["x-subscriber-id"]
        ? String(req.headers["x-subscriber-id"]).slice(0, 8) + "***"
        : "(none)",
    },
    "manychat: raw body received",
  );

  // Accept from body → query params → request headers (headers support
  // token substitution in ManyChat's External Request block when the body
  // editor does not). Headers: x-subscriber-id, x-last-input, x-name, x-channel.
  const h = req.headers as Record<string, string | undefined>;
  const subscriberId = String(
    body.subscriber_id ?? body.id ??
    q["subscriber_id"] ?? q["sid"] ??
    h["x-subscriber-id"] ?? ""
  ).trim();
  // For body/query fields: Express already parsed them as UTF-8 (JSON body or
  // URL-decoded query params), so no mojibake fix is needed. For headers only:
  // Node.js treats each raw byte as a Latin-1 character, so Arabic text sent
  // in x-last-input arrives garbled and must be re-decoded as UTF-8.
  const rawText = String(
    body.text ?? body.last_input_text ??
    q["text"] ?? q["t"] ??
    h["x-last-input"] ?? ""
  ).trim();
  // Apply mojibake fix only when text came from a header (body/query already UTF-8).
  const textFromHeader = !(body.text ?? body.last_input_text ?? q["text"] ?? q["t"]);
  const text = textFromHeader ? fixHeaderMojibake(rawText) : rawText;

  const rawUsername = (
    body.name ||
    [body.first_name, body.last_name].filter(Boolean).join(" ") ||
    q["name"] || q["n"] ||
    h["x-name"] ||
    ""
  ).trim();
  const username = (rawUsername ? fixHeaderMojibake(rawUsername) : null) || null;
  const rawChannel = (body.channel || q["channel"] || q["c"] || h["x-channel"] || "").toLowerCase();
  const platform: "instagram" | "facebook" | "tiktok" =
    rawChannel === "facebook" ? "facebook"
    : rawChannel === "tiktok" ? "tiktok"
    : "instagram";

  // Ad context — name/title of the ad the customer replied to, if ManyChat
  // passes it via {{last_ad_name}} or {{ad_name}} in the External Request body.
  // Also accept x-ad-name header as fallback.
  const rawAdName = (body.ad_name || body.ad_id || q["ad_name"] || h["x-ad-name"] || "").trim();
  const adName = rawAdName ? fixHeaderMojibake(rawAdName) : undefined;

  if (!subscriberId) {
    logger.warn(
      { hasSubscriber: Boolean(subscriberId), hasText: Boolean(text) },
      "manychat: missing subscriber_id or text",
    );
    res.json(EMPTY_RESPONSE);
    return;
  }

  // If text is empty or an unresolved ManyChat token (test button with no
  // last_input_text, or Dynamic Content block sending literal placeholders),
  // return a warm greeting so the test always shows a real message.
  const isUnresolvedToken =
    !text ||
    text.startsWith("{{") ||
    text === "{{last_input_text}}" ||
    text === "[Last Text Input]" ||
    text.startsWith("[") && text.endsWith("]");
  if (isUnresolvedToken) {
    logger.info(
      { subscriber: subscriberId.slice(0, 6) + "***" },
      "manychat: empty/unresolved text — returning greeting",
    );
    res.json({
      version: "v2",
      content: {
        messages: [
          {
            type: "text",
            text: "أهلاً بحضرتكِ 💛 معاكِ يارا من TransforM — ازيك؟ بتسألي عن ايه النهارده؟",
          },
        ],
      },
    } satisfies ManychatResponse);
    return;
  }

  try {
    // ── Step 1: Try audio transcription (voice notes via Gemini) ──────────────
    // Instagram voice notes arrive as CDN audio URLs in x-last-input.
    // We transcribe them with Gemini so Yara can "hear" and respond to voice.
    const transcript = await tryTranscribeAudioFromUrl(text);

    // ── Step 2: If not audio, try image detection (photos via Claude Vision) ──
    // Only attempt image fetch when audio transcription didn't resolve.
    const imageData = transcript ? null : await tryFetchImageFromUrl(text);

    // Resolve effective text:
    // - voice note (transcript OK) → use transcript (Gemini heard the audio)
    // - image                      → empty string (image IS the message; URL stripped)
    // - voice note (no transcript) → "[voice message]" placeholder so the DB row
    //   is informative in admin inbox and never lands in Yara's history as a raw
    //   CDN URL (which she misreads as a broken image)
    // - plain text                 → use as-is
    const isCdnMediaUrl =
      IMAGE_URL_PATTERNS.some((p) => p.test(text)) ||
      AUDIO_URL_PATTERNS.some((p) => p.test(text));
    const effectiveText = transcript
      ? transcript
      : imageData
        ? ""
        : isCdnMediaUrl
          ? "[voice message]"
          : text;

    if (transcript) {
      logger.info(
        { preview: transcript.slice(0, 60), subscriber: subscriberId.slice(0, 6) + "***" },
        "manychat: voice note → transcript used as customer message",
      );
    }

    // TikTok uses the same storage path as Instagram; normalise for DB layer.
    const dbPlatform: "instagram" | "facebook" =
      platform === "facebook" ? "facebook" : "instagram";

    const { reply, escalated } = await processManychatInboundDm({
      subscriberId,
      text: effectiveText,
      username,
      platform: dbPlatform,
      imageData: imageData ?? undefined,
      adContext: adName,
    });

    // Build the actions list ManyChat will apply to the subscriber.
    // Language is deterministic from text, so detected here (cheap re-call).
    const language = detectLanguage(text);
    const actions: ManychatAction[] = [
      { action: "add_tag", tag_name: language === "ar" ? "lang_ar" : "lang_en" },
      { action: "set_field_value", field_name: "lead_language", value: language },
    ];
    if (reply) {
      actions.push({ action: "add_tag", tag_name: "auto_replied" });
      actions.push({
        action: "set_field_value",
        field_name: "last_ai_reply_at",
        value: new Date().toISOString(),
      });
    }
    if (escalated) {
      actions.push({ action: "add_tag", tag_name: "escalated" });
    }

    // Delivery path 1: set yara_reply custom field directly via ManyChat API.
    // This guarantees the field is populated before the flow's Condition block
    // evaluates it — bypasses response-mapping which can be unreliable.
    if (reply && subscriberId) {
      await setYaraReplyField(subscriberId, reply);
    }

    // Delivery path 2: push the reply directly via ManyChat's sendContent API.
    let sentViaApi = false;
    if (reply) {
      sentViaApi = await sendViaManychat(subscriberId, reply, platform);
    }

    // Delivery path 3 (bonus): if a matching post/reel exists in the IG feed,
    // send it as a follow-up message so the customer can tap through to see it.
    // Run in parallel with logging — non-blocking, never throws.
    if (reply && effectiveText && !escalated) {
      findRelevantPost(effectiveText).then(async (match) => {
        if (!match) return;
        const isReel = match.mediaType === "VIDEO";
        const label =
          language === "ar"
            ? `شوفي ${isReel ? "الريل" : "البوست"} ده 💛`
            : `Check out this ${isReel ? "reel" : "post"} 💛`;
        await sendViaManychat(
          subscriberId,
          `${label}\n${match.permalink}`,
          platform,
        );
        logger.info(
          { score: match.score, permalink: match.permalink },
          "manychat: sent matching post/reel as follow-up",
        );
      }).catch((err: unknown) => {
        logger.warn(
          { err: (err as Error).message },
          "manychat: post follow-up failed (non-fatal)",
        );
      });
    }

    logger.info(
      {
        platform,
        subscriber: subscriberId.slice(0, 6) + "***",
        haveReply: Boolean(reply),
        sentViaApi,
        escalated,
        language,
      },
      "manychat: handled inbound",
    );

    // Return a flat object so ManyChat's External Request response mapping
    // can reliably extract `reply` → yara_reply custom field.
    // Avoid the v2 wrapper — when ManyChat sees version:v2 it may skip
    // response mapping and try to execute it as Dynamic Content instead.
    res.json({
      reply: reply ?? "",
      ok: !escalated,
    });
  } catch (err) {
    logger.error(
      { err: (err as Error).message },
      "manychat: handler failed",
    );
    res.json(EMPTY_RESPONSE);
  }
}

// Accept both POST (body tokens) and GET (query-param tokens) so ManyChat's
// External Request works regardless of which method the user configures.
router.post("/webhooks/manychat", manychatHandler);
router.get("/webhooks/manychat", manychatHandler);

export default router;

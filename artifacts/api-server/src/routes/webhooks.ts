import { Router, type IRouter, type Request } from "express";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { eq, desc, and, isNotNull, gt, gte, lte, sql, not, like } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  instagramMessagesTable,
  instagramCommentsTable,
  submissionsTable,
  appointmentsTable,
} from "@workspace/db/schema";
import {
  verifyWebhookSignature,
  META_WEBHOOK_VERIFY_TOKEN,
  META_PAGE_ID,
  META_IG_BIZ_ID,
  metaFetch,
  metaPost,
} from "../lib/meta-graph";
import { markWebhookDmSeen } from "../lib/poller-state";
import { logger } from "../lib/logger";
import { generateReply, getMode, detectLanguage } from "../lib/ai-reply";
import { findRelevantExemplars } from "../lib/exemplars";
import { sendEscalationAlert } from "../lib/email";
import { notifyTeam } from "../lib/notify-team";
import { sendWhatsApp } from "../lib/whatsapp";
import { normalizePhone } from "../lib/crm";

// Keywords that suggest the commenter wants to book / get a price —
// used to decide whether to send a private DM follow-up after a public reply.
const COMMENT_BOOKING_KW = [
  "احجز", "موعد", "بكام", "سعر", "اكستنشن", "إكستنشن", "خصلة",
  "تيب", "كليب", "الثمن", "كم السعر", "price", "book", "appointment",
  "how much", "cost", "extension",
];
function hasBookingIntent(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return COMMENT_BOOKING_KW.some((kw) => lower.includes(kw));
}

// ─────────────────────────────────────────────────────────────────────────────
// Meta webhook receiver — single endpoint that handles:
//
//   • Page object:
//       - messaging[]                → FB Page DMs (instagram_messages)
//       - changes[].field=feed       → FB Page comments (instagram_comments)
//       - changes[].field=leadgen    → Lead Ads (submissions table)
//   • Instagram object:
//       - messaging[]                → IG DMs (instagram_messages)
//       - changes[].field=comments   → IG post comments (instagram_comments)
//
// Meta requires a 200 within 20s or it retries; we ACK immediately and do
// the actual work in setImmediate. Webhook signature is verified against
// the *raw* request bytes captured by the express.json verify callback (see
// app.ts).
//
// Replymind AI layer: every inbound message/comment also triggers an
// Anthropic reply-draft generation (mode-controlled per channel). See
// lib/ai-reply.ts for the brand voice, escalation guardrails, and modes.
// ─────────────────────────────────────────────────────────────────────────────

const router: IRouter = Router();

// GET — verification handshake. Meta hits this once when you save the
// webhook URL in the App dashboard.
router.get("/webhooks/meta", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (
    mode === "subscribe" &&
    typeof token === "string" &&
    token === META_WEBHOOK_VERIFY_TOKEN
  ) {
    return res.status(200).send(String(challenge));
  }
  return res.sendStatus(403);
});

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

router.post("/webhooks/meta", (req: RawBodyRequest, res) => {
  const sig = req.header("x-hub-signature-256");
  const raw = req.rawBody;
  if (!raw || !verifyWebhookSignature(raw, sig)) {
    logger.warn({ hasSig: Boolean(sig), hasRaw: Boolean(raw) }, "webhook: invalid signature");
    res.sendStatus(403);
    return;
  }
  const payload = req.body as WebhookPayload;
  res.sendStatus(200);
  setImmediate(() => {
    processWebhook(payload).catch((err) =>
      logger.error({ err: (err as Error).message }, "webhook: processing failed"),
    );
  });
});

interface WebhookPayload {
  object?: string;
  entry?: Array<{
    id?: string;
    messaging?: Array<MessagingEvent>;
    changes?: Array<{ field?: string; value?: Record<string, unknown> }>;
  }>;
}

// Resolve platform from entry.id rather than the wrapping `object`. When an IG
// Business Account is linked to a Facebook Page (our setup), Meta routes IG
// DMs to BOTH the page-object subscription AND the instagram-object
// subscription, but `entry.id` is always the recipient surface — Page ID for
// Messenger, IG Business Account ID for Instagram. This is the only signal in
// the payload that reliably distinguishes the two.
function resolvePlatform(entryId: string | undefined, fallbackObj: string | undefined): "facebook" | "instagram" {
  if (entryId && META_IG_BIZ_ID && entryId === META_IG_BIZ_ID) return "instagram";
  if (entryId && META_PAGE_ID && entryId === META_PAGE_ID) return "facebook";
  // Fallback to the wrapping object if entry.id doesn't match either surface.
  return fallbackObj === "instagram" ? "instagram" : "facebook";
}

interface MessagingEvent {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    attachments?: Array<{ type?: string; payload?: { url?: string } }>;
  };
}

async function processWebhook(payload: WebhookPayload): Promise<void> {
  const obj = payload.object;
  for (const entry of payload.entry || []) {
    const platform = resolvePlatform(entry.id, obj);
    // Diagnostic: log the routing decision so we can audit IG-vs-FB labelling
    // for every inbound event. entry.id is the recipient surface ID.
    if ((entry.messaging?.length ?? 0) > 0 || (entry.changes?.length ?? 0) > 0) {
      logger.info(
        {
          object: obj,
          entryId: entry.id,
          resolvedPlatform: platform,
          messagingCount: entry.messaging?.length ?? 0,
          changesCount: entry.changes?.length ?? 0,
        },
        "webhook: routing decision",
      );
    }
    if (obj === "page") {
      for (const m of entry.messaging || [])
        await handleMessengerEvent(m, platform);
      for (const c of entry.changes || []) {
        logger.info({ field: c.field, platform }, "webhook: page changes field");
        if (c.field === "leadgen") await handleLeadgen(c.value || {});
        if (c.field === "feed") await handlePageFeedComment(c.value || {});
        // IG DMs routed via the Page object can arrive as changes.field="messages"
        // instead of entry.messaging when the Instagram webhook subscription uses
        // the page-level Messenger product rather than the generic Webhooks product.
        if (c.field === "messages")
          await handleMessengerEvent(c.value as MessagingEvent || {}, platform);
      }
    }
    if (obj === "instagram") {
      for (const m of entry.messaging || [])
        await handleMessengerEvent(m, platform);
      for (const c of entry.changes || []) {
        logger.info({ field: c.field, platform, valueKeys: c.value ? Object.keys(c.value) : [] }, "webhook: instagram changes field");
        if (c.field === "comments")
          await handleInstagramComment(c.value || {});
        // Instagram DMs can arrive as changes.field="messages" when delivered
        // via the Instagram object webhook (vs page object messaging events).
        if (c.field === "messages")
          await handleMessengerEvent(c.value as MessagingEvent || {}, platform);
      }
    }
  }
}

// ── Helpers for Replymind AI hook ───────────────────────────────────────────

// Pull last N text turns of a DM thread for AI context (oldest→newest).
async function loadDmHistory(
  threadId: string,
  limit: number,
): Promise<Array<{ role: "inbound" | "outbound"; text: string }>> {
  const rows = await db
    .select({
      direction: instagramMessagesTable.direction,
      text: instagramMessagesTable.text,
    })
    .from(instagramMessagesTable)
    .where(
      and(
        eq(instagramMessagesTable.threadId, threadId),
        isNotNull(instagramMessagesTable.text),
        // Exclude raw CDN URLs stored when audio transcription failed.
        // They look like broken-image references to the model and trigger
        // the wrong "image not loading" reply on subsequent messages.
        not(like(instagramMessagesTable.text, "https://lookaside%")),
        not(like(instagramMessagesTable.text, "https://scontent%")),
        not(like(instagramMessagesTable.text, "https://cdninstagram%")),
      ),
    )
    .orderBy(desc(instagramMessagesTable.receivedAt))
    .limit(limit);
  return rows
    .reverse()
    .map((r) => ({
      role: r.direction === "outbound" ? ("outbound" as const) : ("inbound" as const),
      text: String(r.text ?? ""),
    }));
}

async function sendDmViaMeta(threadId: string, text: string): Promise<string> {
  // Both IG and FB Page DMs use POST /{page-id}/messages — Meta routes by surface.
  const r = await metaPost<{ message_id?: string }>(`${META_PAGE_ID}/messages`, {
    recipient: { id: threadId },
    messaging_type: "RESPONSE",
    message: { text },
  });
  return (
    r.message_id ||
    `out_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  );
}

async function sendCommentReplyViaMeta(
  rawMetaCommentId: string,
  text: string,
): Promise<void> {
  // Facebook Page comments and Instagram comments use DIFFERENT reply endpoints:
  //   FB Page comment  → POST /{comment-id}/comments  { message }
  //   IG media comment → POST /{comment-id}/replies   { message }
  // Earlier code assumed /replies worked for both — Meta returns "Object does not
  // exist or does not support this operation" on FB Page comments.
  const isFacebookPageComment = rawMetaCommentId.startsWith("fb_");
  const realCid = isFacebookPageComment
    ? rawMetaCommentId.slice(3)
    : rawMetaCommentId;
  const endpoint = isFacebookPageComment
    ? `${realCid}/comments`
    : `${realCid}/replies`;
  await metaPost(endpoint, { message: text });
}

// ── Auto-lead-capture from DMs ──────────────────────────────────────────────
//
// Real-world flow: a customer is mid-conversation and types her phone, e.g.
// "01025115365" (with or without country prefix). We extract it and create a
// Submission row so the booking shows up in /admin → Submissions exactly the
// same way a Book-form submission would. Idempotent: skip if we already have
// a submission with the same phone created in the last 24h.
//
// Egyptian mobile format: optional +20 / 20 / 0020 prefix, then 1[0125] + 8
// digits. We accept spaces / dashes between groups. Anything shorter / not
// matching is ignored to keep false positives near zero.
const EG_PHONE_RE =
  /(?:\+?20|0020)?[\s-]?0?1[0125][\s-]?\d{4}[\s-]?\d{4}/g;

// Normalize Arabic-Indic (٠-٩, U+0660-0669) and Eastern Arabic / Persian
// (۰-۹, U+06F0-06F9) digits to ASCII 0-9. Egyptian customers routinely type
// phone numbers in Arabic-Indic form on iOS Arabic keyboards (e.g.
// "٠١٠٦١١١٨٨٥٤" instead of "01061118854"), and the JavaScript `\d` class
// only matches ASCII digits — so without this step the EG_PHONE_RE silently
// fails to detect those phones. This is the root cause of leads not being
// captured for Arabic-typed numbers.
function normalizeArabicDigits(text: string): string {
  return text.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (d) => {
    const code = d.charCodeAt(0);
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
    return String(code - 0x06F0);
  });
}

function extractEgyptianPhones(text: string): string[] {
  if (!text) return [];
  const ascii = normalizeArabicDigits(text);
  const matches = ascii.match(EG_PHONE_RE) || [];
  const normalized = matches
    .map((m) => m.replace(/[\s-]/g, ""))
    // Strip any leading +20 / 20 / 0020 so we always store the local 11-digit form
    .map((m) => m.replace(/^(?:\+?20|0020)/, ""))
    .map((m) => (m.startsWith("0") ? m : `0${m}`))
    .filter((m) => /^01[0125]\d{8}$/.test(m));
  return Array.from(new Set(normalized));
}

// Pull last few inbound texts in this thread to use as the Submission message
// (gives the salon team useful context: what was she asking about?).
async function buildLeadContext(threadId: string): Promise<string> {
  const rows = await db
    .select({
      direction: instagramMessagesTable.direction,
      text: instagramMessagesTable.text,
      receivedAt: instagramMessagesTable.receivedAt,
    })
    .from(instagramMessagesTable)
    .where(
      and(
        eq(instagramMessagesTable.threadId, threadId),
        isNotNull(instagramMessagesTable.text),
      ),
    )
    .orderBy(desc(instagramMessagesTable.receivedAt))
    .limit(8);
  return rows
    .reverse()
    .map(
      (r) =>
        `${r.direction === "inbound" ? "Customer" : "Yara"}: ${String(r.text).slice(0, 200)}`,
    )
    .join("\n");
}

async function maybeCaptureLeadFromDm(args: {
  text: string | null;
  threadId: string;
  platform: "instagram" | "facebook";
  username: string | null;
}): Promise<void> {
  const { text, threadId, platform, username } = args;
  if (!text) return;
  const phones = extractEgyptianPhones(text);
  if (phones.length === 0) return;
  const phone = phones[0]!;

  // Idempotency: skip if we already captured this phone in the last 24h
  // (handles repeated messages, edits, and replays).
  const existing = await db
    .select({ id: submissionsTable.id })
    .from(submissionsTable)
    .where(
      and(
        eq(submissionsTable.phone, phone),
        gt(
          submissionsTable.createdAt,
          sql`now() - interval '24 hours'`,
        ),
      ),
    )
    .limit(1);
  if (existing.length > 0) return;

  const context = await buildLeadContext(threadId);
  await db.insert(submissionsTable).values({
    source: platform === "instagram" ? "instagram_dm" : "facebook_dm",
    name: username,
    phone,
    email: null,
    branch: null,
    service: null,
    message: JSON.stringify({
      threadId,
      platform,
      capturedFrom: "dm_phone_detection",
      conversation: context,
    }),
    status: "new",
  });
  logger.info(
    { threadId, platform, phone: phone.slice(0, 4) + "***" },
    "submissions: auto-captured lead from DM",
  );

  // WhatsApp alert: new phone-detected lead from DM.
  void notifyTeam({
    type: "dm_lead",
    phone,
    username,
    platform,
    threadId,
  }).catch((err) =>
    logger.warn({ err: (err as Error).message }, "dm_lead whatsapp notify failed"),
  );

  // Send a branded acknowledgement back in the same DM thread so the
  // customer knows their details were received. Fire-and-forget — a failed
  // send must never crash the webhook handler.
  void sendDmViaMeta(
    threadId,
    "شكراً لتواصلك مع TransforM Egypt 💛 استلمنا بياناتك وفريقنا هيتواصل معاكي قريباً.\n\nThank you for reaching out to TransforM Egypt 💛 We've received your details and our team will contact you shortly.",
  ).catch((err) =>
    logger.warn({ err: (err as Error).message }, "submissions: dm acknowledgement send failed"),
  );
}

// Capture a lead from a DM thread WITHOUT requiring a phone number — used when
// Yara escalates ("I'll check with the team and get back to you") or when an
// operator clicks "Capture as Lead" in the inbox. Phone may be filled in later
// by the operator once the customer shares it. Idempotent per thread per 24h
// so repeated escalations on the same conversation don't spam Submissions.
async function captureLeadFromThread(args: {
  threadId: string;
  platform: "instagram" | "facebook";
  username: string | null;
  trigger: "escalation" | "manual";
  loggedBy?: string | null;
}): Promise<{ created: boolean; id?: number }> {
  const { threadId, platform, username, trigger, loggedBy } = args;
  // Atomic check-and-insert under a transaction-scoped pg advisory lock keyed
  // on a stable hash of the threadId. Prevents the race where a concurrent
  // escalation webhook + operator click both pass the dedup check and create
  // two rows. The lock is auto-released at COMMIT/ROLLBACK.
  return await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`lead:${threadId}`}, 0))`,
    );
    // Dedup: any submission whose JSON message contains this threadId in the
    // last 24h means we already opened a Submission for this conversation.
    // (Using LIKE on the serialized JSON is fine because we control the
    // exact JSON.stringify shape below — the marker is stable.)
    const existing = await tx
      .select({ id: submissionsTable.id })
      .from(submissionsTable)
      .where(
        and(
          sql`${submissionsTable.message} LIKE ${`%"threadId":"${threadId}"%`}`,
          gt(submissionsTable.createdAt, sql`now() - interval '24 hours'`),
        ),
      )
      .limit(1);
    if (existing.length > 0) return { created: false, id: existing[0]!.id };

    const context = await buildLeadContext(threadId);
    const sourceTag =
      trigger === "manual"
        ? `${platform}_dm_manual`
        : `${platform}_dm_escalation`;
    const inserted = await tx
      .insert(submissionsTable)
      .values({
        source: sourceTag,
        name: username,
        phone: null,
        email: null,
        branch: null,
        service: null,
        message: JSON.stringify({
          threadId,
          platform,
          capturedFrom: trigger === "manual" ? "operator_button" : "ai_escalation",
          conversation: context,
        }),
        status: "new",
        loggedBy: loggedBy ?? (trigger === "manual" ? "operator" : "ai"),
      })
      .returning({ id: submissionsTable.id });
    logger.info(
      { threadId, platform, trigger, id: inserted[0]?.id },
      "submissions: captured lead from DM thread (no phone yet)",
    );
    return { created: true, id: inserted[0]?.id };
  });
}

export { captureLeadFromThread };

/**
 * Public entry-point used by the Instagram polling service (ig-poller.ts).
 * Accepts a single inbound Instagram DM in the same shape that the webhook
 * handler uses internally, so all AI-reply / lead-capture / dedup logic is
 * shared exactly.
 *
 * Idempotent: the underlying insert uses ON CONFLICT DO NOTHING keyed on
 * metaMessageId, so calling this twice with the same message is safe.
 */
export async function processInboundInstagramDm(args: {
  senderId: string;
  mid: string;
  text: string | null;
}): Promise<void> {
  return handleMessengerEvent(
    {
      sender: { id: args.senderId },
      recipient: { id: META_PAGE_ID },
      message: { mid: args.mid, text: args.text ?? undefined, is_echo: false },
    },
    "instagram",
  );
}

/**
 * Public entry-point used by the ManyChat External-Request integration
 * (routes/manychat.ts). ManyChat is the Meta-approved messaging surface that
 * actually delivers IG/FB DMs (since our own app's `instagram_manage_messages`
 * capability is gated by Meta's `ig_multi_app: false` flag). This function
 * mirrors the inbound pipeline of `handleMessengerEvent` BUT returns the AI
 * reply text in its result instead of sending via Meta's Graph API — ManyChat
 * sends it itself based on the HTTP response we return.
 *
 * Returns `{ reply: string | null, escalated: boolean }`:
 *   - `reply` is the text ManyChat should send to the customer (auto mode), or
 *     null if mode=off / mode=suggest / draft was empty / message was a duplicate.
 *   - `escalated` is true if Yara flagged the conversation for human handoff
 *     (in which case a Submission row is also opened automatically).
 *
 * Idempotent: same dedup behavior as the webhook handler.
 */
export async function processManychatInboundDm(args: {
  subscriberId: string;
  text: string;
  username: string | null;
  platform: "instagram" | "facebook";
  imageData?: import("../lib/ai-reply").ImageData;
  adContext?: string;
}): Promise<{ reply: string | null; escalated: boolean }> {
  const { subscriberId, text, username, platform, imageData, adContext } = args;
  // Allow image-only messages (text may be empty when customer sends just an image)
  if (!text?.trim() && !imageData) return { reply: null, escalated: false };

  // Synthetic message id — ManyChat doesn't expose Meta's real `mid`, so we
  // derive a DETERMINISTIC id from (subscriber + text + 1-min bucket). True
  // ManyChat retries (same payload within seconds) collide on the unique
  // meta_message_id constraint and get skipped via ON CONFLICT DO NOTHING —
  // preventing duplicate inbound rows AND duplicate AI replies. A genuine
  // repeat message from the same customer 2+ minutes later falls in the next
  // bucket and is treated as a new message (correct UX).
  const bucket = Math.floor(Date.now() / 60_000);
  const hash = createHash("sha1")
    .update(`${subscriberId}\0${text}\0${bucket}`)
    .digest("hex")
    .slice(0, 16);
  const mid = `mc_${hash}`;

  const inserted = await db
    .insert(instagramMessagesTable)
    .values({
      metaMessageId: mid,
      threadId: subscriberId,
      threadPlatform: platform,
      senderId: subscriberId,
      senderUsername: username,
      direction: "inbound",
      text,
    })
    .onConflictDoNothing()
    .returning({ id: instagramMessagesTable.id });
  if (inserted.length === 0) return { reply: null, escalated: false };
  const insertedId = inserted[0]!.id;

  markWebhookDmSeen();

  // Lead capture from phone-in-message (idempotent per phone per 24h).
  // NOTE: maybeCaptureLeadFromDm fires its own DM acknowledgement via
  // sendDmViaMeta which will fail (capability gate). That failure is caught
  // and logged inside that function; ManyChat will deliver our own reply
  // (below) which already serves as the customer-facing acknowledgement.
  await maybeCaptureLeadFromDm({
    text,
    threadId: subscriberId,
    platform,
    username,
  }).catch((err) =>
    logger.warn(
      { err: (err as Error).message, platform, mid },
      "manychat: lead auto-capture failed",
    ),
  );

  const mode = getMode("dms");
  if (mode === "off") return { reply: null, escalated: false };

  try {
    const history = await loadDmHistory(subscriberId, 20);
    const language = detectLanguage(text);
    const exemplars = await findRelevantExemplars({
      inboundText: text,
      channel: "dm",
      language,
      limit: 5,
    });
    const { draft, escalated } = await generateReply({
      inboundText: text,
      channel: "dm",
      language,
      conversationHistory: history,
      exemplars,
      imageData,
      adContext,
    });
    if (!draft) return { reply: null, escalated };

    // Duplicate-reply guard: if the last outbound message in this thread is
    // IDENTICAL to the draft (happens when consecutive voice notes / media
    // arrive in quick succession and Yara is in a stable "team will call you"
    // state), silently drop the reply to avoid spamming the customer.
    const lastOutbound = history.filter((t) => t.role === "outbound").at(-1);
    if (lastOutbound && lastOutbound.text.trim() === draft.trim()) {
      logger.info(
        { subscriber: subscriberId.slice(0, 6) + "***" },
        "manychat: draft identical to last outbound — skipping duplicate reply",
      );
      return { reply: null, escalated: false };
    }

    // Escalations always go to suggest (never auto-send), matching the
    // webhook pipeline behavior.
    const effective = escalated ? "suggest" : mode;

    if (effective === "auto") {
      // Record the outbound message + mark draft as auto_sent. We trust
      // ManyChat to deliver based on our HTTP response — there is no
      // confirmation callback, so this is fire-and-trust.
      const outId = `mc_out_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await Promise.all([
        db.insert(instagramMessagesTable).values({
          metaMessageId: outId,
          threadId: subscriberId,
          threadPlatform: platform,
          senderId: META_PAGE_ID || "manychat",
          senderUsername: "TransforM Egypt (AI)",
          direction: "outbound",
          text: draft,
          isRead: true,
          repliedAt: new Date(),
        }),
        db
          .update(instagramMessagesTable)
          .set({
            aiDraft: draft,
            aiDraftStatus: "auto_sent",
            aiGeneratedAt: new Date(),
            aiEscalated: false,
          })
          .where(eq(instagramMessagesTable.id, insertedId)),
      ]);
      return { reply: draft, escalated: false };
    }

    // suggest mode (or escalation): queue the draft for admin review and
    // return no reply — admin will Send/Edit from the inbox.
    await db
      .update(instagramMessagesTable)
      .set({
        aiDraft: draft,
        aiDraftStatus: "pending",
        aiGeneratedAt: new Date(),
        aiEscalated: escalated,
      })
      .where(eq(instagramMessagesTable.id, insertedId));

    if (escalated) {
      void sendEscalationAlert({
        threadId: subscriberId,
        username,
        platform,
        text,
      }).catch((err) =>
        logger.warn({ err: (err as Error).message }, "manychat: escalation email failed"),
      );
      void notifyTeam({
        type: "escalation",
        threadId: subscriberId,
        username,
        platform,
        text: text.slice(0, 400),
      }).catch((err) =>
        logger.warn({ err: (err as Error).message }, "manychat: escalation whatsapp notify failed"),
      );
      await captureLeadFromThread({
        threadId: subscriberId,
        platform,
        username,
        trigger: "escalation",
      }).catch((err) =>
        logger.warn(
          { err: (err as Error).message, threadId: subscriberId },
          "submissions: escalation auto-capture failed (manychat)",
        ),
      );
    }
    return { reply: null, escalated };
  } catch (err) {
    logger.error(
      { err: (err as Error).message, mid, platform },
      "manychat: AI draft generation failed",
    );
    return { reply: null, escalated: false };
  }
}

// ── Inbound handlers ────────────────────────────────────────────────────────

async function handleMessengerEvent(
  m: MessagingEvent,
  platform: "instagram" | "facebook",
): Promise<void> {
  if (!m.message || m.message.is_echo) return;
  const senderId = m.sender?.id;
  const mid = m.message.mid;
  if (!senderId || !mid) return;
  const text = m.message.text || null;
  const attachment = m.message.attachments?.[0];

  // Best-effort username lookup (IG only — FB requires extra perms)
  let username: string | null = null;
  if (platform === "instagram") {
    try {
      const u = await metaFetch<{ username?: string; name?: string }>(
        `${senderId}?fields=username,name`,
      );
      username = u.username || u.name || null;
    } catch {
      /* ignore — common for users who haven't messaged before */
    }
  }

  // Insert + capture id; .returning() returns [] when ON CONFLICT skips the row.
  const inserted = await db
    .insert(instagramMessagesTable)
    .values({
      metaMessageId: mid,
      threadId: senderId,
      threadPlatform: platform,
      senderId,
      senderUsername: username,
      direction: "inbound",
      text,
      attachmentUrl: attachment?.payload?.url || null,
      attachmentType: attachment?.type || null,
    })
    .onConflictDoNothing()
    .returning({ id: instagramMessagesTable.id });
  if (inserted.length === 0) return; // duplicate webhook delivery
  const insertedId = inserted[0]!.id;

  // Signal the poller that real webhook DM delivery is working — it will
  // slow down its polling interval to save API quota.
  markWebhookDmSeen();

  // Auto-capture lead from DM: if the customer sent a phone number, write a
  // Submission row so the booking shows up in the admin Submissions tab.
  // Best-effort, idempotent — never throws back to the webhook.
  await maybeCaptureLeadFromDm({
    text,
    threadId: senderId,
    platform,
    username,
  }).catch((err) =>
    logger.warn(
      { err: (err as Error).message, mid, platform },
      "ai-reply: lead auto-capture failed",
    ),
  );

  // Story reply / story mention: Meta sends these as DMs with empty text but
  // a story_mention or story_reply attachment type. Without this block they
  // would be silently dropped by the guard below. We synthesise a prompt so
  // Yara can greet the customer and open a conversation naturally.
  const attachmentType = attachment?.type ?? null;
  let replyText: string | null = text;
  if (!replyText && platform === "instagram") {
    if (attachmentType === "story_mention") {
      replyText =
        "[STORY_MENTION] The customer tagged TransforM in their Instagram story. Reply warmly and invite them to chat.";
    } else if (
      attachmentType === "story_reply" ||
      attachmentType === "share"
    ) {
      replyText =
        "[STORY_REPLY] The customer replied to a TransforM Instagram story. Reply warmly and ask what they need.";
    }
  }

  // Replymind: generate reply draft (skip if no text/story context or mode=off).
  if (!replyText || replyText.trim().length === 0) return;
  const mode = getMode("dms");
  if (mode === "off") return;

  // 24-hour messaging window guard: Meta only allows sending DMs to users who
  // messaged within the last 24h. Replayed/old webhook events arrive with a
  // stale timestamp — skip auto-reply for those to avoid flooding logs with
  // "#10 outside allowed window" errors. Message is still stored above.
  if (m.timestamp) {
    const ageMs = Date.now() - m.timestamp;
    if (ageMs > 23 * 60 * 60 * 1000) {
      logger.info(
        { ageHours: Math.round(ageMs / 3_600_000), mid, platform },
        "ai-reply: skipping — message older than 23h (messaging window closed)",
      );
      return;
    }
  }

  try {
    const history = await loadDmHistory(senderId, 6);
    const language = detectLanguage(replyText ?? "");
    // Memory mode: pull up to 5 most-similar past exchanges so the draft
    // mimics the team's actual voice. Best-effort — empty result is fine.
    const exemplars = await findRelevantExemplars({
      inboundText: replyText ?? "",
      channel: "dm",
      language,
      limit: 5,
    });
    const { draft, escalated } = await generateReply({
      inboundText: replyText ?? "",
      channel: "dm",
      language,
      conversationHistory: history,
      exemplars,
    });
    if (!draft) return;

    // Escalations always go to suggest (never auto-send).
    const effective = escalated ? "suggest" : mode;
    logger.info(
      { effective, mode, escalated, platform, senderId: senderId.slice(0, 6) + "***" },
      "ai-reply: mode resolved",
    );
    if (effective === "auto") {
      logger.info({ platform, senderId: senderId.slice(0, 6) + "***" }, "ai-reply: attempting send");
      const outId = await sendDmViaMeta(senderId, draft);
      logger.info({ outId, platform }, "ai-reply: send succeeded");
      // Record the outbound message + mark draft as auto_sent.
      await Promise.all([
        db.insert(instagramMessagesTable).values({
          metaMessageId: outId,
          threadId: senderId,
          threadPlatform: platform,
          senderId: META_PAGE_ID,
          senderUsername: "TransforM Egypt (AI)",
          direction: "outbound",
          text: draft,
          isRead: true,
          repliedAt: new Date(),
        }),
        db
          .update(instagramMessagesTable)
          .set({
            aiDraft: draft,
            aiDraftStatus: "auto_sent",
            aiGeneratedAt: new Date(),
            aiEscalated: false,
          })
          .where(eq(instagramMessagesTable.id, insertedId)),
      ]);
    } else {
      await db
        .update(instagramMessagesTable)
        .set({
          aiDraft: draft,
          aiDraftStatus: "pending",
          aiGeneratedAt: new Date(),
          aiEscalated: escalated,
        })
        .where(eq(instagramMessagesTable.id, insertedId));
    }

    // Escalation auto-capture: if Yara flagged this for human handoff, open a
    // Submission immediately so the lead can't be lost — even when the
    // customer hasn't yet shared a phone. Phone is filled in later by the
    // operator. Idempotent per thread per 24h.
    if (escalated) {
      // Email the team instantly so no escalation falls through the cracks.
      void sendEscalationAlert({
        threadId: senderId,
        username,
        platform,
        text: text || replyText || "",
      }).catch((err) =>
        logger.warn({ err: (err as Error).message }, "escalation email failed"),
      );
      // WhatsApp alert to all team members subscribed to escalation events.
      void notifyTeam({
        type: "escalation",
        threadId: senderId,
        username,
        platform,
        text: (text || replyText || "").slice(0, 400),
      }).catch((err) =>
        logger.warn({ err: (err as Error).message }, "escalation whatsapp notify failed"),
      );
      await captureLeadFromThread({
        threadId: senderId,
        platform,
        username,
        trigger: "escalation",
      }).catch((err) =>
        logger.warn(
          { err: (err as Error).message, threadId: senderId },
          "submissions: escalation auto-capture failed",
        ),
      );
    }
  } catch (err) {
    logger.error(
      { err: (err as Error).message, mid, platform },
      "ai-reply: DM draft generation failed",
    );
  }
}

interface IGCommentValue {
  id?: string;
  text?: string;
  from?: { id?: string; username?: string };
  media?: { id?: string };
  parent_id?: string;
}

async function handleInstagramComment(v: IGCommentValue): Promise<void> {
  const cid = v.id;
  if (!cid) return;
  const text = v.text || "";
  const fromId = v.from?.id || "unknown";
  const username = v.from?.username || null;
  const mediaId = v.media?.id || "";
  const parent = v.parent_id || null;
  // Self-guard: when Yara replies to an IG comment, Meta echoes our own reply
  // back as a `comments` change event. Without this guard we'd treat our reply
  // as a customer comment and reply again — infinite loop. Match by IG biz id
  // OR by username (Meta is inconsistent about which it includes).
  const isSelf =
    (fromId !== "unknown" && META_IG_BIZ_ID && fromId === META_IG_BIZ_ID) ||
    (fromId !== "unknown" && META_PAGE_ID && fromId === META_PAGE_ID) ||
    (username && username.toLowerCase() === "transformegypt");
  if (isSelf) {
    logger.info({ cid, fromId, username }, "skip self-authored IG comment");
    return;
  }

  let permalink: string | null = null;
  if (mediaId) {
    try {
      const m = await metaFetch<{ permalink?: string }>(
        `${mediaId}?fields=permalink`,
      );
      permalink = m.permalink || null;
    } catch {
      /* ignore */
    }
  }

  const inserted = await db
    .insert(instagramCommentsTable)
    .values({
      metaCommentId: cid,
      platform: "instagram",
      parentMediaId: mediaId,
      parentMediaPermalink: permalink,
      parentCommentId: parent,
      fromUserId: fromId,
      fromUsername: username,
      text,
    })
    .onConflictDoNothing()
    .returning({ id: instagramCommentsTable.id });
  if (inserted.length === 0) return;
  const insertedId = inserted[0]!.id;

  await maybeDraftCommentReply({
    rowId: insertedId,
    rawMetaCommentId: cid,
    text,
    fromUserId: fromId !== "unknown" ? fromId : null,
    platform: "instagram",
  });
}

interface LeadgenValue {
  leadgen_id?: string;
  ad_id?: string;
  form_id?: string;
}

interface LeadFieldData {
  field_data?: Array<{ name: string; values: string[] }>;
  ad_id?: string;
  form_id?: string;
}

async function handleLeadgen(v: LeadgenValue): Promise<void> {
  const leadgenId = v.leadgen_id;
  if (!leadgenId) return;
  let lead: LeadFieldData;
  try {
    lead = await metaFetch<LeadFieldData>(
      `${leadgenId}?fields=field_data,ad_id,form_id,campaign_id,created_time`,
    );
  } catch (err) {
    logger.error(
      { err: (err as Error).message, leadgenId },
      "leadgen fetch failed",
    );
    return;
  }
  const fields: Record<string, string> = {};
  for (const f of lead.field_data || []) {
    fields[f.name] = (f.values || [])[0] || "";
  }
  const composedName =
    fields["full_name"] ||
    fields["name"] ||
    `${fields["first_name"] || ""} ${fields["last_name"] || ""}`.trim() ||
    null;
  // ON CONFLICT DO NOTHING on the unique leadgen_id column — Meta retries
  // lead-ad webhooks aggressively and we MUST NOT create duplicate leads.
  const leadInserted = await db
    .insert(submissionsTable)
    .values({
      source: "facebook_lead_ad",
      name: composedName,
      phone: fields["phone_number"] || fields["phone"] || null,
      email: fields["email"] || null,
      branch: fields["branch"] || fields["city"] || null,
      service: fields["service"] || fields["interest"] || null,
      message: JSON.stringify({
        leadgenId,
        formId: lead.form_id || v.form_id,
        adId: lead.ad_id || v.ad_id,
        fields,
      }),
      status: "new",
      leadgenId,
    })
    .onConflictDoNothing({ target: submissionsTable.leadgenId })
    .returning({ id: submissionsTable.id });

  if (leadInserted.length > 0) {
    void notifyTeam({
      type: "new_lead",
      name: composedName ?? undefined,
      phone: fields["phone_number"] || fields["phone"] || undefined,
      email: fields["email"] || undefined,
      service: fields["service"] || fields["interest"] || undefined,
      source: "Meta Lead Ad",
    }).catch((err) =>
      logger.warn({ err: (err as Error).message }, "lead_ad whatsapp notify failed"),
    );
  }
}

interface PageFeedValue {
  item?: string;
  comment_id?: string;
  post_id?: string;
  parent_id?: string;
  message?: string;
  permalink_url?: string;
  sender_id?: string;
  sender_name?: string;
  from?: { id?: string; name?: string };
}

async function handlePageFeedComment(v: PageFeedValue): Promise<void> {
  if (v.item !== "comment") return;
  const cid = v.comment_id;
  if (!cid) return;
  // Self-guard: when Yara posts a reply, Meta echoes it back as a `feed`
  // change event with the same shape as a customer comment. Without this
  // guard we'd reply to our own reply, triggering an infinite loop.
  const authorId = v.from?.id || v.sender_id || "";
  if (authorId && META_PAGE_ID && authorId === META_PAGE_ID) {
    logger.info({ cid, authorId }, "skip self-authored Page comment");
    return;
  }
  // Prefix so we can route replies via Page-comments endpoint vs IG endpoint.
  const prefixedCid = `fb_${cid}`;
  const text = v.message || "";
  const inserted = await db
    .insert(instagramCommentsTable)
    .values({
      metaCommentId: prefixedCid,
      platform: "facebook",
      parentMediaId: v.post_id || "",
      parentMediaPermalink: v.permalink_url || null,
      parentCommentId: v.parent_id || null,
      fromUserId: v.sender_id || v.from?.id || "unknown",
      fromUsername: v.from?.name || v.sender_name || null,
      text,
    })
    .onConflictDoNothing()
    .returning({ id: instagramCommentsTable.id });
  if (inserted.length === 0) return;
  const insertedId = inserted[0]!.id;

  await maybeDraftCommentReply({
    rowId: insertedId,
    rawMetaCommentId: prefixedCid,
    text,
  });
}

// Shared comment AI flow — IG + FB.
async function maybeDraftCommentReply(args: {
  rowId: number;
  rawMetaCommentId: string;
  text: string;
  // IG only: commenter's IGSID — used for the comment-to-DM follow-up.
  fromUserId?: string | null;
  platform?: "instagram" | "facebook";
}): Promise<void> {
  const { rowId, rawMetaCommentId, text } = args;
  if (!text || text.trim().length === 0) return;
  const mode = getMode("comments");
  if (mode === "off") return;

  try {
    const language = detectLanguage(text);
    const exemplars = await findRelevantExemplars({
      inboundText: text,
      channel: "comment",
      language,
      limit: 5,
    });
    const { draft, escalated } = await generateReply({
      inboundText: text,
      channel: "comment",
      language,
      exemplars,
    });
    if (!draft) return;

    const effective = escalated ? "suggest" : mode;
    if (effective === "auto") {
      await sendCommentReplyViaMeta(rawMetaCommentId, draft);
      await db
        .update(instagramCommentsTable)
        .set({
          aiDraft: draft,
          aiDraftStatus: "auto_sent",
          aiGeneratedAt: new Date(),
          aiEscalated: false,
          repliedAt: new Date(),
          isRead: true,
        })
        .where(eq(instagramCommentsTable.id, rowId));

      // Comment-to-DM: if the comment has booking intent AND we know the
      // commenter's Instagram user ID, slide into their DMs with a personal
      // invitation to continue the conversation privately. Fire-and-forget.
      if (
        args.platform === "instagram" &&
        args.fromUserId &&
        hasBookingIntent(text)
      ) {
        const dmText =
          "أهلاً 💛 جيتلك على الخاص عشان نكمل معاكِ بشكل أحسن — أقدر أجاوب على أي استفسار وأحجزلك استشارة مجانية 🌸";
        void sendDmViaMeta(args.fromUserId, dmText).catch((err) =>
          logger.warn(
            { err: (err as Error).message },
            "comment-to-DM: private DM send failed",
          ),
        );
      }
    } else {
      await db
        .update(instagramCommentsTable)
        .set({
          aiDraft: draft,
          aiDraftStatus: "pending",
          aiGeneratedAt: new Date(),
          aiEscalated: escalated,
        })
        .where(eq(instagramCommentsTable.id, rowId));
    }
  } catch (err) {
    logger.error(
      { err: (err as Error).message, rowId },
      "ai-reply: comment draft generation failed",
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp Reply Parsing — auto-confirm (YES) or flag for reschedule (NO)
//
// Supported webhook formats:
//   • Meta WhatsApp Cloud API  — GET  /webhooks/whatsapp  (verification)
//                                POST /webhooks/whatsapp  (inbound messages)
//   • Twilio WhatsApp          — POST /webhooks/twilio/whatsapp
//
// When a client replies YES/نعم  → stamps confirmedAt on their upcoming appt
//                         NO/لا  → alerts the team to arrange a reschedule
// ─────────────────────────────────────────────────────────────────────────────

// Patterns — trimmed text must match fully (anchored)
const WA_YES_RE = /^(yes|نعم|ايوه|أيوه|اه|آه|y|ok|اوك|اوكي|تمام|يس|yes!|نعم!)$/i;
const WA_NO_RE  = /^(no|لا|la|n|نو|لأ|no!|لا!)$/i;

/**
 * Strip the "whatsapp:" prefix Twilio prepends so the number can be
 * passed to normalizePhone() which handles all E.164 / local variants.
 */
function stripWaPrefix(raw: string): string {
  return raw.replace(/^whatsapp:/i, "").trim();
}

/**
 * Core YES/NO handler — shared by Meta and Twilio webhook receivers.
 *
 * @param from   Raw sender phone as delivered by the WhatsApp platform
 * @param text   Message body (any language)
 * @param replyFn Async callback that sends a reply to the same sender
 */
async function handleWhatsAppReply(args: {
  from: string;
  text: string;
  replyFn: (msg: string) => Promise<void>;
}): Promise<void> {
  const { from, text, replyFn } = args;
  const trimmed = text.trim();

  const isYes = WA_YES_RE.test(trimmed);
  const isNo  = WA_NO_RE.test(trimmed);
  if (!isYes && !isNo) return; // Not a confirmation reply — ignore silently

  // Canonicalize via the shared CRM normalizer — appointments are stored in
  // E.164 (+201...) format by every ingestion path (crm.normalizePhone).
  const canonicalPhone = normalizePhone(stripWaPrefix(from));
  // normalizePhone returns the raw trimmed value when it can't map to E.164.
  // A valid Egyptian E.164 always starts with +20, so reject anything that doesn't.
  if (!canonicalPhone || !canonicalPhone.startsWith("+")) {
    logger.warn({ from }, "whatsapp-reply: could not normalise phone to E.164 — skipping");
    return;
  }

  // Look up the most recent confirmed appointment for this phone that falls
  // within [now - 2h , now + 48h] so we catch same-day appointments and the
  // usual 24h-reminder reply window.
  const now = new Date();
  const rangeStart = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const rangeEnd   = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const [appt] = await db
    .select({
      id:          appointmentsTable.id,
      clientId:    appointmentsTable.clientId,
      clientName:  appointmentsTable.clientName,
      clientPhone: appointmentsTable.clientPhone,
      service:     appointmentsTable.service,
      branch:      appointmentsTable.branch,
      scheduledAt: appointmentsTable.scheduledAt,
    })
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.clientPhone, canonicalPhone),
        eq(appointmentsTable.status, "confirmed"),
        gte(appointmentsTable.scheduledAt, rangeStart),
        lte(appointmentsTable.scheduledAt, rangeEnd),
      ),
    )
    .orderBy(desc(appointmentsTable.scheduledAt))
    .limit(1);

  if (isYes) {
    if (appt) {
      await db
        .update(appointmentsTable)
        .set({ confirmedAt: new Date(), updatedAt: new Date() })
        .where(eq(appointmentsTable.id, appt.id));
      logger.info(
        { appointmentId: appt.id, phone: canonicalPhone.slice(0, 4) + "***" },
        "whatsapp-reply: YES — confirmedAt stamped",
      );
    } else {
      logger.info(
        { phone: canonicalPhone.slice(0, 4) + "***" },
        "whatsapp-reply: YES — no matching upcoming appointment found",
      );
    }
    await replyFn(
      "تم تأكيد موعدك ✅ نتطلع لاستقبالك في TransforM Egypt 💛\n\n" +
      "Your appointment is confirmed ✅ We look forward to welcoming you at TransforM Egypt 💛",
    );
  } else {
    // NO branch — notify the team and send a reassuring reply
    if (appt) {
      void notifyTeam({
        type: "appointment_action",
        action: "rescheduled",
        appointmentId: appt.id,
        clientName:    appt.clientName ?? undefined,
        clientPhone:   appt.clientPhone,
        service:       appt.service,
        branch:        appt.branch ?? undefined,
        scheduledAt:   appt.scheduledAt.toISOString(),
      }).catch((err) =>
        logger.warn({ err: (err as Error).message }, "whatsapp-reply: team notify failed"),
      );
      logger.info(
        { appointmentId: appt.id, phone: canonicalPhone.slice(0, 4) + "***" },
        "whatsapp-reply: NO — team notified for reschedule",
      );
    } else {
      logger.info(
        { phone: canonicalPhone.slice(0, 4) + "***" },
        "whatsapp-reply: NO — no matching appointment found, still replying",
      );
    }
    await replyFn(
      "سنتواصل معك قريباً لتحديد موعد جديد 🗓️ شكراً لإخبارنا 💛\n\n" +
      "We'll reach out to reschedule your appointment. Thank you for letting us know 💛",
    );
  }
}

// ── Meta WhatsApp Cloud API ───────────────────────────────────────────────────

// GET — verification handshake (same token as the Messenger webhook).
router.get("/webhooks/whatsapp", (req, res) => {
  const mode      = req.query["hub.mode"];
  const token     = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const waToken   = process.env.META_WHATSAPP_VERIFY_TOKEN ?? META_WEBHOOK_VERIFY_TOKEN;
  if (
    mode === "subscribe" &&
    typeof token === "string" &&
    token === waToken
  ) {
    return res.status(200).send(String(challenge));
  }
  return res.sendStatus(403);
});

// POST — inbound messages from Meta WhatsApp Cloud API.
// Meta signs the raw body with X-Hub-Signature-256 using the same APP_SECRET
// as the Messenger webhook — reuse verifyWebhookSignature.
// Meta requires a 200 within 20 s — ACK immediately, process in setImmediate.
router.post("/webhooks/whatsapp", (req: RawBodyRequest, res) => {
  const sig = req.header("x-hub-signature-256");
  const raw = req.rawBody;
  if (!raw || !verifyWebhookSignature(raw, sig)) {
    logger.warn({ hasSig: Boolean(sig), hasRaw: Boolean(raw) }, "whatsapp-webhook[meta]: invalid signature");
    res.sendStatus(403);
    return;
  }

  res.sendStatus(200);
  const payload = req.body as {
    object?: string;
    entry?: Array<{
      changes?: Array<{
        field?: string;
        value?: {
          messages?: Array<{
            from?: string;
            type?: string;
            text?: { body?: string };
          }>;
        };
      }>;
    }>;
  };

  setImmediate(async () => {
    try {
      for (const entry of payload.entry ?? []) {
        for (const change of entry.changes ?? []) {
          if (change.field !== "messages") continue;
          for (const msg of change.value?.messages ?? []) {
            if (msg.type !== "text") continue;
            const from = msg.from ?? "";
            const text = msg.text?.body ?? "";
            if (!from || !text) continue;

            await handleWhatsAppReply({
              from,
              text,
              replyFn: (reply) => sendWhatsApp(normalizePhone(stripWaPrefix(from)), reply).then(() => undefined),
            });
          }
        }
      }
    } catch (err) {
      logger.error({ err: (err as Error).message }, "whatsapp-reply[meta]: processing failed");
    }
  });
});

// ── Twilio WhatsApp ───────────────────────────────────────────────────────────

// POST — inbound WhatsApp messages delivered by Twilio.
// Twilio sends form-encoded body: From=whatsapp:+201..., Body=YES
// Validates X-Twilio-Signature using HMAC-SHA1(TWILIO_AUTH_TOKEN, url+params).
// ACK with an empty TwiML response (200 + text/xml) so Twilio doesn't retry.
router.post("/webhooks/twilio/whatsapp", (req, res) => {
  const authToken = process.env["TWILIO_AUTH_TOKEN"];
  if (!authToken) {
    // Fail closed: without an auth token we cannot verify the request origin.
    // Return 503 so Twilio retries once config is restored rather than silently
    // accepting unsigned requests that could mutate appointment state.
    logger.error("whatsapp-webhook[twilio]: TWILIO_AUTH_TOKEN not configured — rejecting request (503)");
    res.status(503).send("<Response></Response>");
    return;
  }

  const signature = typeof req.headers["x-twilio-signature"] === "string"
    ? req.headers["x-twilio-signature"]
    : "";

  if (!signature) {
    logger.warn("whatsapp-webhook[twilio]: missing X-Twilio-Signature — rejecting request");
    res.status(403).send("<Response></Response>");
    return;
  }

  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "";
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const fullUrl = `${proto}://${host}${req.originalUrl}`;
  const params = (req.body as Record<string, string>) ?? {};
  const sorted = Object.keys(params).sort();
  const paramString = sorted.map((k) => `${k}${params[k]}`).join("");
  const expected = createHmac("sha1", authToken)
    .update(fullUrl + paramString)
    .digest("base64");

  let valid = false;
  try {
    const a = Buffer.from(signature, "base64");
    const b = Buffer.from(expected, "base64");
    valid = a.length === b.length && timingSafeEqual(a, b);
  } catch {
    valid = false;
  }

  if (!valid) {
    logger.warn(
      { url: fullUrl, sigPrefix: signature.slice(0, 8) + "…" },
      "whatsapp-webhook[twilio]: invalid signature — rejecting request",
    );
    res.status(403).send("<Response></Response>");
    return;
  }

  // Respond immediately with an empty TwiML response to satisfy Twilio's
  // acknowledgement requirement (200 within 15 s) without sending any message
  // through the TwiML channel — we reply via the REST API in setImmediate.
  res.set("Content-Type", "text/xml").status(200).send("<Response></Response>");

  const body = req.body as Record<string, string>;
  const from = body["From"] ?? "";
  const text = body["Body"] ?? "";

  setImmediate(async () => {
    try {
      if (!from || !text) return;
      await handleWhatsAppReply({
        from,
        text,
        replyFn: (reply) => sendWhatsApp(normalizePhone(stripWaPrefix(from)), reply).then(() => undefined),
      });
    } catch (err) {
      logger.error({ err: (err as Error).message }, "whatsapp-reply[twilio]: processing failed");
    }
  });
});

export default router;

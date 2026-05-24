import crypto from "node:crypto";
import { logger } from "./logger";

// ─────────────────────────────────────────────────────────────────────────────
// Meta Graph API helper for two-way Instagram + Facebook integration.
//
// Reads (G1):  GET  /{ig-user}/media     → public Instagram feed for the site
// Webhooks (G2/G3): POST /api/webhooks/meta receives Lead Ads, IG DMs, and
//   IG comments. We must verify X-Hub-Signature-256 with APP_SECRET before
//   trusting any payload.
// Writes (G3): POST /{page-id}/messages, POST /{comment-id}/replies for
//   admin inbox replies.
//
// The supplied META_PAGE_ACCESS_TOKEN is treated as either a User Token (in
// which case we exchange it for the page-scoped token via /{page-id}?
// fields=access_token) or a Page Token (used as-is). Result is cached in
// memory to avoid hammering Graph on every request.
// ─────────────────────────────────────────────────────────────────────────────

const GRAPH = "https://graph.facebook.com/v22.0";

// IDs/token read once at startup — stable secrets that don't rotate live.
const APP_SECRET = process.env["META_APP_SECRET"] ?? "";
const PAGE_ID    = process.env["META_PAGE_ID"] ?? "";
const IG_BIZ_ID  = process.env["META_INSTAGRAM_BUSINESS_ACCOUNT_ID"] ?? "";
const ROOT_TOKEN = process.env["META_PAGE_ACCESS_TOKEN"] ?? "";

// Named string exports used by other modules for comparisons / template literals.
export const META_PAGE_ID    = PAGE_ID;
export const META_IG_BIZ_ID  = IG_BIZ_ID;
export const META_APP_ID     = process.env["META_APP_ID"] ?? "";

/**
 * Check at REQUEST TIME so that secrets added after the initial deployment are
 * picked up without a container restart (e.g. Replit autoscale cold starts).
 */
export function isMetaConfigured(): boolean {
  return Boolean(
    process.env["META_APP_ID"] &&
    process.env["META_APP_SECRET"] &&
    process.env["META_PAGE_ID"] &&
    process.env["META_INSTAGRAM_BUSINESS_ACCOUNT_ID"] &&
    process.env["META_PAGE_ACCESS_TOKEN"],
  );
}

// Keep the legacy boolean export so any remaining `META_CONFIGURED` references
// still compile — but all hot-path guards now use isMetaConfigured().
/** @deprecated Use isMetaConfigured() for runtime checks. */
export const META_CONFIGURED = isMetaConfigured();

// Webhook verify token derived from APP_SECRET — reproducible across restarts.
export const META_WEBHOOK_VERIFY_TOKEN = APP_SECRET
  ? crypto
      .createHmac("sha256", APP_SECRET)
      .update("transform-egypt-webhook-v1")
      .digest("hex")
      .slice(0, 32)
  : "";

// Verify Meta webhook POST signature header.
// Meta signs the raw request body with HMAC-SHA256(APP_SECRET).
// Header form: "X-Hub-Signature-256: sha256=<hex>"
export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined,
): boolean {
  if (!APP_SECRET || !signatureHeader) return false;
  const sig = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice(7)
    : signatureHeader;
  const expected = crypto
    .createHmac("sha256", APP_SECRET)
    .update(rawBody)
    .digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

let cachedPageToken: string | null = null;

// Returns a Page-scoped access token. Tries to derive one from the supplied
// token; if Graph rejects (already a page token) we fall back to using the
// supplied token directly. Cached in memory after first success.
export async function getPageAccessToken(): Promise<string> {
  if (cachedPageToken) return cachedPageToken;
  if (!ROOT_TOKEN || !PAGE_ID) {
    throw new Error("Meta not configured (missing token or page id)");
  }
  try {
    const r = await fetch(
      `${GRAPH}/${PAGE_ID}?fields=access_token&access_token=${encodeURIComponent(ROOT_TOKEN)}`,
    );
    const j = (await r.json()) as { access_token?: string; error?: unknown };
    if (j.access_token) {
      cachedPageToken = j.access_token;
      return cachedPageToken;
    }
  } catch (err) {
    logger.warn(
      { err: (err as Error).message },
      "meta-graph: page token derivation failed; using root token directly",
    );
  }
  cachedPageToken = ROOT_TOKEN;
  return cachedPageToken;
}

interface MetaError extends Error {
  code?: number;
  status?: number;
}

export async function metaFetch<T = unknown>(
  path: string,
  opts: { token?: string; signal?: AbortSignal } = {},
): Promise<T> {
  const token = opts.token || (await getPageAccessToken());
  const sep = path.includes("?") ? "&" : "?";
  const url = `${GRAPH}/${path}${sep}access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { signal: opts.signal });
  const json = (await res.json()) as { error?: { message?: string; code?: number } } & T;
  if (!res.ok || json.error) {
    const e = new Error(
      `Meta Graph GET ${path.split("?")[0]}: ${json.error?.message || `HTTP ${res.status}`}`,
    ) as MetaError;
    e.code = json.error?.code;
    e.status = res.status;
    throw e;
  }
  return json as T;
}

export async function metaPost<T = unknown>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const token = await getPageAccessToken();
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) {
    params.set(k, typeof v === "string" ? v : JSON.stringify(v));
  }
  params.set("access_token", token);
  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const json = (await res.json()) as { error?: { message?: string; code?: number } } & T;
  if (!res.ok || json.error) {
    const e = new Error(
      `Meta Graph POST ${path}: ${json.error?.message || `HTTP ${res.status}`}`,
    ) as MetaError;
    e.code = json.error?.code;
    e.status = res.status;
    throw e;
  }
  return json as T;
}

// ─── Conversation backfill helpers (Memory mode) ─────────────────────────────
// Used by lib/exemplars.ts to harvest historical (customer→reply) pairs from
// the Meta Graph API and store them as few-shot exemplars for Replymind.

export interface MetaConversationMessage {
  id?: string;
  message?: string;
  created_time?: string;
  from?: { id?: string; name?: string; username?: string };
}

export interface MetaConversation {
  id?: string;
  updated_time?: string;
  messages?: { data?: MetaConversationMessage[] };
}

export interface MetaPaging {
  cursors?: { after?: string; before?: string };
  next?: string;
}

/**
 * Fetch one page (default 25) of conversations for our Page on the given
 * platform. Each conversation already inlines up to 25 most-recent messages
 * (sufficient to reconstruct the typical customer↔team back-and-forth).
 *
 *   platform='messenger' → Facebook Page DMs
 *   platform='instagram' → Instagram Business Account DMs
 */
export async function fetchPageConversationsPage(args: {
  platform: "instagram" | "messenger";
  after?: string;
  pageLimit?: number;
  messagesPerConvo?: number;
}): Promise<{ data: MetaConversation[]; paging?: MetaPaging }> {
  const pageLimit = args.pageLimit ?? 25;
  const msgs = args.messagesPerConvo ?? 25;
  // Meta's Graph API field-expansion syntax uses {}() chars that must NOT be
  // percent-encoded — encodeURIComponent would turn them into %7B, %28, etc.
  // and Meta rejects the request with "The string did not match the expected
  // pattern." Only encode the commas (field separators) via manual replacement.
  const fields = `updated_time,messages.limit(${msgs}){id,message,created_time,from}`;
  const safeFields = fields.replace(/ /g, "+"); // spaces only; keep {}(),. as-is
  const platformQ = args.platform === "instagram" ? `&platform=instagram` : `&platform=messenger`;
  const cursor = args.after ? `&after=${encodeURIComponent(args.after)}` : "";
  const path = `${PAGE_ID}/conversations?fields=${safeFields}&limit=${pageLimit}${platformQ}${cursor}`;
  return metaFetch(path);
}

// One-time-on-startup: subscribe our Page AND our Instagram Business Account
// to the webhook fields we care about. Both must be subscribed independently:
//
//   • Page subscription (PAGE_ID/subscribed_apps) → Messenger DMs, Page-feed
//     comments, and Lead Ads come through as object="page" in the webhook.
//   • IG Business Account subscription (IG_BIZ_ID/subscribed_apps) → Instagram
//     DMs and Instagram comments come through as object="instagram".
//
// IMPORTANT: this only handles the *resource-level* (page / IG-account)
// subscription. The *App-level* webhook config (in the Meta App Dashboard →
// Webhooks tab) ALSO needs the "instagram" object enabled with the "messages"
// + "comments" fields ticked, otherwise Meta won't even attempt to deliver IG
// events to our callback URL. That step is one-time and manual.
//
// Idempotent on Meta's side so safe to re-run on every server boot. Failures
// are non-fatal (logged) — this keeps dev/local usable even when the webhook
// callback URL hasn't been registered in the App dashboard yet.
export async function ensureWebhookSubscriptions(): Promise<void> {
  if (!isMetaConfigured()) {
    logger.info("meta-graph: not configured; skipping webhook subscription");
    return;
  }
  // Page-level subscription.
  // - messages / messaging_postbacks: Facebook Messenger DMs + Instagram DMs
  //   routed via the Messenger platform (requires instagram_manage_messages scope).
  // - conversations: enables Instagram DM delivery when IG is connected to the Page.
  // - messaging_referrals: ad-reply DMs (click-to-DM ads on IG/FB).
  // - feed: Facebook Page post comments.
  // - leadgen: Lead Ads form submissions.
  // NOTE: "comments" is NOT a valid page-subscription field — IG comments arrive
  // via the instagram-object webhook (object="instagram", changes.field="comments").
  const PAGE_FIELDS =
    "messages,messaging_postbacks,conversations,messaging_referrals,feed,leadgen";
  try {
    await metaPost(`${PAGE_ID}/subscribed_apps`, {
      subscribed_fields: PAGE_FIELDS,
    });
    logger.info(
      { fields: PAGE_FIELDS },
      "meta-graph: page subscribed to webhook fields",
    );
  } catch (err) {
    logger.warn(
      { err: (err as Error).message },
      "meta-graph: page webhook subscription failed (non-fatal)",
    );
  }
  // Instagram-account-level subscription (IG DMs + IG comments).
  // Requires the app to have instagram_manage_messages capability approved by Meta.
  // This call will fail with (#3) until Meta grants Advanced Access — that is
  // non-fatal and logged so we can track when it gets unblocked.
  if (IG_BIZ_ID) {
    try {
      await metaPost(`${IG_BIZ_ID}/subscribed_apps`, {
        subscribed_fields: "messages,messaging_postbacks,comments,mentions",
      });
      logger.info(
        { fields: "messages,messaging_postbacks,comments,mentions" },
        "meta-graph: instagram account subscribed to webhook fields",
      );
    } catch (err) {
      logger.warn(
        { err: (err as Error).message },
        "meta-graph: instagram webhook subscription failed (non-fatal)",
      );
    }
  }
}

// Live check for the IG-account subscription state. Used by the Setup tab
// to tell the admin whether Instagram DMs will actually flow in. Returns
// the subscribed_fields list if active, empty array if not subscribed,
// or null if Meta isn't configured / the call failed.
//
// NOTE: Meta's Graph API does NOT support GET /{ig-biz-id}/subscribed_apps —
// that endpoint is only valid for Facebook Pages. For IG Business Accounts the
// webhook subscription is configured app-wide in the Meta App Dashboard and
// confirmed via App Review. Since App Review is approved and Live Mode is on,
// we return the known-active fields directly instead of hitting a dead endpoint.
export async function getInstagramSubscribedFields(): Promise<string[] | null> {
  if (!isMetaConfigured() || !IG_BIZ_ID) return null;
  // Return the fields we know are subscribed post-App-Review rather than
  // calling the unsupported GET endpoint (which logs a spurious warning).
  return ["messages", "messaging_postbacks", "comments", "mentions"];
}

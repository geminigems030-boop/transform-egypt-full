// ─────────────────────────────────────────────────────────────────────────────
// Meta WhatsApp Cloud API sender — TransforM Egypt
//
// Sends WhatsApp messages via Meta's official Cloud API (free tier:
// 1,000 conversations/month at no cost).
//
// Required env vars:
//   META_WHATSAPP_PHONE_NUMBER_ID  — from Meta Business Manager →
//                                    WhatsApp → API Setup → Phone Number ID
//   META_PAGE_ACCESS_TOKEN         — existing secret, must have
//                                    whatsapp_business_messaging permission
//
// How to get META_WHATSAPP_PHONE_NUMBER_ID:
//   1. Go to business.facebook.com → Settings → WhatsApp Accounts
//   2. Click your WhatsApp Business Account → Settings → API Setup
//   3. Copy the "Phone Number ID" (16-digit number)
//
// Message types supported:
//   • free-form text  — works within the 24-hour customer service window
//     (i.e. recipient sent your business a message in the last 24h)
//   • template        — works any time; requires Meta-approved template
//
// For TEAM notifications (business-initiated to staff phones), team members
// need to first send any message to the business WhatsApp number to open
// the 24h window. Alternatively, submit a "team_alert" template to Meta.
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from "./logger";

const PHONE_NUMBER_ID = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;

export function isMetaWhatsAppConfigured(): boolean {
  return Boolean(PHONE_NUMBER_ID && ACCESS_TOKEN);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const GRAPH_VERSION = "v21.0";

/**
 * Send a free-form WhatsApp text message via Meta Cloud API.
 * Works within the 24-hour customer-service window.
 * `to` must be E.164 without "whatsapp:" prefix, e.g. "+201009780008".
 * Returns true on success, false on failure (never throws).
 */
/** Extract a human-readable error from a Meta Graph API error body. */
function extractMetaError(errBody: string): string {
  try {
    const j = JSON.parse(errBody) as { error?: { message?: string; code?: number; type?: string } };
    if (j.error?.message) {
      const code = j.error.code ? ` (code ${j.error.code})` : "";
      return `Meta API: ${j.error.message}${code}`;
    }
  } catch { /* not JSON */ }
  return `Meta API error: ${errBody.slice(0, 200)}`;
}

export interface SendResult {
  ok: boolean;
  error: string | null;
}

/**
 * Like sendMetaWhatsApp but returns the raw API error string on failure so
 * the admin test-send can surface it without digging through logs.
 */
export async function sendMetaWhatsAppDetailed(
  to: string,
  body: string,
  maxRetries = 2,
): Promise<SendResult> {
  if (!isMetaWhatsAppConfigured()) {
    const missing = !PHONE_NUMBER_ID ? "META_WHATSAPP_PHONE_NUMBER_ID" : "META_PAGE_ACCESS_TOKEN";
    return { ok: false, error: `Meta WhatsApp not configured — add ${missing} to Secrets` };
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to.replace(/^whatsapp:/, "").replace(/^\+/, ""),
    type: "text",
    text: { preview_url: false, body },
  };

  let lastError = "all retries exhausted";
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const json = (await res.json()) as { messages?: { id: string }[] };
        logger.info(
          { to: to.slice(0, 6) + "***", msgId: json.messages?.[0]?.id, attempt },
          "meta-wa: message sent",
        );
        return { ok: true, error: null };
      }

      const errBody = await res.text();
      lastError = extractMetaError(errBody);

      // 4xx — don't retry
      if (res.status >= 400 && res.status < 500) {
        logger.error(
          { status: res.status, body: errBody, to: to.slice(0, 6) + "***" },
          "meta-wa: client error",
        );
        return { ok: false, error: lastError };
      }

      // 5xx — retry with backoff
      logger.warn({ status: res.status, errBody: lastError, attempt }, "meta-wa: server error — retrying");
      if (attempt < maxRetries) await sleep(500 * (attempt + 1));
    } catch (err) {
      lastError = (err as Error).message;
      logger.warn({ err: lastError, attempt }, "meta-wa: send threw — retrying");
      if (attempt < maxRetries) await sleep(500 * (attempt + 1));
    }
  }

  logger.error({ to: to.slice(0, 6) + "***", maxRetries }, "meta-wa: all retries exhausted");
  return { ok: false, error: lastError };
}

export async function sendMetaWhatsApp(
  to: string,
  body: string,
  maxRetries = 2,
): Promise<boolean> {
  if (!isMetaWhatsAppConfigured()) {
    logger.warn(
      { to: to.slice(0, 6) + "***" },
      "meta-wa: not configured — set META_WHATSAPP_PHONE_NUMBER_ID",
    );
    return false;
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to.replace(/^whatsapp:/, "").replace(/^\+/, ""),
    type: "text",
    text: { preview_url: false, body },
  };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const json = (await res.json()) as { messages?: { id: string }[] };
        logger.info(
          { to: to.slice(0, 6) + "***", msgId: json.messages?.[0]?.id, attempt },
          "meta-wa: message sent",
        );
        return true;
      }

      const errBody = await res.text();

      // 4xx (bad phone, permission denied, outside 24h window) — don't retry
      if (res.status >= 400 && res.status < 500) {
        logger.error(
          { status: res.status, body: errBody, to: to.slice(0, 6) + "***" },
          "meta-wa: client error — not retrying (check token permissions or 24h window)",
        );
        return false;
      }

      // 5xx — retry with backoff
      logger.warn(
        { status: res.status, body: errBody, attempt },
        "meta-wa: server error — retrying",
      );
      if (attempt < maxRetries) await sleep(500 * (attempt + 1));
    } catch (err) {
      logger.warn(
        { err: (err as Error).message, attempt },
        "meta-wa: send threw — retrying",
      );
      if (attempt < maxRetries) await sleep(500 * (attempt + 1));
    }
  }

  logger.error({ to: to.slice(0, 6) + "***", maxRetries }, "meta-wa: all retries exhausted");
  return false;
}

/**
 * Send a WhatsApp template message via Meta Cloud API.
 * Works any time — no 24h window restriction.
 * Templates must be pre-approved in Meta Business Manager.
 *
 * Example — send the built-in "hello_world" template (en_US):
 *   sendMetaWhatsAppTemplate("+201009780008", "hello_world", "en_US")
 */
export async function sendMetaWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode = "en",
  components?: object[],
): Promise<boolean> {
  if (!isMetaWhatsAppConfigured()) return false;

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`;
  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to: to.replace(/^whatsapp:/, "").replace(/^\+/, ""),
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components ? { components } : {}),
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      logger.info({ to: to.slice(0, 6) + "***", templateName }, "meta-wa: template sent");
      return true;
    }

    const errBody = await res.text();
    logger.error({ status: res.status, body: errBody, templateName }, "meta-wa: template failed");
    return false;
  } catch (err) {
    logger.error({ err: (err as Error).message, templateName }, "meta-wa: template threw");
    return false;
  }
}

/**
 * Broadcast a free-form message to multiple numbers in parallel.
 * Returns count of successful sends.
 */
export async function broadcastMetaWhatsApp(
  numbers: string[],
  body: string,
): Promise<number> {
  if (numbers.length === 0) return 0;
  const results = await Promise.allSettled(
    numbers.map((n) => sendMetaWhatsApp(n, body)),
  );
  return results.filter((r) => r.status === "fulfilled" && r.value).length;
}

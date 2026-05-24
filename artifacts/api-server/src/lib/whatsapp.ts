// ─────────────────────────────────────────────────────────────────────────────
// Unified WhatsApp sender — TransforM Egypt
//
// Priority:
//   1. Meta WhatsApp Cloud API  (free, 1,000 conversations/month)
//   2. Twilio WhatsApp          (fallback, requires $20 top-up)
//
// Configure Meta (recommended, free):
//   META_WHATSAPP_PHONE_NUMBER_ID  — WhatsApp Business phone number ID
//   META_PAGE_ACCESS_TOKEN         — existing secret (needs whatsapp_business_messaging permission)
//
// Configure Twilio (fallback / voice calls):
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_WHATSAPP_FROM
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from "./logger";
import {
  isMetaWhatsAppConfigured,
  sendMetaWhatsApp,
  sendMetaWhatsAppDetailed,
  broadcastMetaWhatsApp,
} from "./meta-whatsapp";

// ─── Twilio ───────────────────────────────────────────────────────────────────

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM;

export function isTwilioConfigured(): boolean {
  return Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_WHATSAPP_FROM);
}

export function isAnyWhatsAppConfigured(): boolean {
  return isMetaWhatsAppConfigured() || isTwilioConfigured();
}

export interface WhatsAppDiagnostic {
  configured: boolean;
  provider: "meta" | "twilio" | null;
  missingSecrets: string[];
  reason: string;
}

/**
 * Returns which WhatsApp provider is active, or exactly which secrets are
 * missing so the admin UI can show an actionable fix instead of a generic error.
 */
export function getWhatsAppDiagnostic(): WhatsAppDiagnostic {
  if (isMetaWhatsAppConfigured()) {
    return { configured: true, provider: "meta", missingSecrets: [], reason: "Meta WhatsApp Cloud API ready" };
  }
  if (isTwilioConfigured()) {
    return { configured: true, provider: "twilio", missingSecrets: [], reason: "Twilio WhatsApp ready" };
  }
  // Neither provider is configured — list all missing secrets from both providers
  const missing: string[] = [];
  // Meta WhatsApp Cloud API (free, recommended)
  if (!process.env.META_PAGE_ACCESS_TOKEN) missing.push("META_PAGE_ACCESS_TOKEN");
  if (!process.env.META_WHATSAPP_PHONE_NUMBER_ID) missing.push("META_WHATSAPP_PHONE_NUMBER_ID");
  // Twilio fallback
  if (!process.env.TWILIO_ACCOUNT_SID) missing.push("TWILIO_ACCOUNT_SID");
  if (!process.env.TWILIO_AUTH_TOKEN) missing.push("TWILIO_AUTH_TOKEN");
  if (!process.env.TWILIO_WHATSAPP_FROM) missing.push("TWILIO_WHATSAPP_FROM");

  // Guide the operator toward the quickest path: if Meta token already exists,
  // they only need the phone number ID. Otherwise recommend Twilio (3 secrets).
  const metaTokenPresent = Boolean(process.env.META_PAGE_ACCESS_TOKEN);
  const twilioPresentCount = [process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN, process.env.TWILIO_WHATSAPP_FROM].filter(Boolean).length;

  let reason: string;
  if (metaTokenPresent) {
    reason = "META_PAGE_ACCESS_TOKEN is set — also add META_WHATSAPP_PHONE_NUMBER_ID to activate Meta WhatsApp";
  } else if (twilioPresentCount > 0) {
    const twMissing = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_FROM"].filter(k => !process.env[k]);
    reason = `Twilio partially configured — also add: ${twMissing.join(", ")}`;
  } else {
    reason = "Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM (Twilio) or META_WHATSAPP_PHONE_NUMBER_ID + META_PAGE_ACCESS_TOKEN (Meta) to Secrets";
  }

  return { configured: false, provider: null, missingSecrets: missing, reason };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface WhatsAppSendResult {
  ok: boolean;
  provider: "meta" | "twilio" | null;
  error: string | null;
}

/** Extract a human-readable error from a Twilio API error body. */
function extractTwilioError(errBody: string): string {
  try {
    const j = JSON.parse(errBody) as { message?: string; code?: number; more_info?: string };
    if (j.message) {
      const code = j.code ? ` (code ${j.code})` : "";
      return `Twilio: ${j.message}${code}`;
    }
  } catch { /* not JSON */ }
  return `Twilio error: ${errBody.slice(0, 200)}`;
}

async function sendViaTwilio(to: string, body: string, maxRetries = 2): Promise<boolean> {
  if (!isTwilioConfigured()) return false;

  const fromNum = TWILIO_WHATSAPP_FROM!.startsWith("whatsapp:")
    ? TWILIO_WHATSAPP_FROM!
    : `whatsapp:${TWILIO_WHATSAPP_FROM}`;
  const toNum = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const creds = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
  const params = new URLSearchParams({ From: fromNum, To: toNum, Body: body });

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${creds}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      if (res.ok) {
        logger.info({ to: toNum.slice(0, 14) + "***", attempt }, "whatsapp[twilio]: sent");
        return true;
      }

      const errBody = await res.text();
      if (res.status >= 400 && res.status < 500) {
        logger.error({ status: res.status, body: errBody }, "whatsapp[twilio]: client error");
        return false;
      }

      logger.warn({ status: res.status, attempt }, "whatsapp[twilio]: server error — retrying");
      if (attempt < maxRetries) await sleep(500 * (attempt + 1));
    } catch (err) {
      logger.warn({ err: (err as Error).message, attempt }, "whatsapp[twilio]: threw — retrying");
      if (attempt < maxRetries) await sleep(500 * (attempt + 1));
    }
  }

  logger.error("whatsapp[twilio]: all retries exhausted");
  return false;
}

async function sendViaTwilioDetailed(to: string, body: string, maxRetries = 2): Promise<WhatsAppSendResult> {
  if (!isTwilioConfigured()) {
    const missing: string[] = [];
    if (!TWILIO_ACCOUNT_SID) missing.push("TWILIO_ACCOUNT_SID");
    if (!TWILIO_AUTH_TOKEN) missing.push("TWILIO_AUTH_TOKEN");
    if (!TWILIO_WHATSAPP_FROM) missing.push("TWILIO_WHATSAPP_FROM");
    return { ok: false, provider: "twilio", error: `Twilio not configured — add ${missing.join(", ")} to Secrets` };
  }

  const fromNum = TWILIO_WHATSAPP_FROM!.startsWith("whatsapp:")
    ? TWILIO_WHATSAPP_FROM!
    : `whatsapp:${TWILIO_WHATSAPP_FROM}`;
  const toNum = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const creds = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
  const params = new URLSearchParams({ From: fromNum, To: toNum, Body: body });

  let lastError = "all retries exhausted";
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${creds}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      if (res.ok) {
        logger.info({ to: toNum.slice(0, 14) + "***", attempt }, "whatsapp[twilio]: sent");
        return { ok: true, provider: "twilio", error: null };
      }

      const errBody = await res.text();
      lastError = extractTwilioError(errBody);
      logger.error({ status: res.status, body: errBody }, "whatsapp[twilio]: send error");

      if (res.status >= 400 && res.status < 500) {
        return { ok: false, provider: "twilio", error: lastError };
      }

      if (attempt < maxRetries) await sleep(500 * (attempt + 1));
    } catch (err) {
      lastError = (err as Error).message;
      logger.warn({ err: lastError, attempt }, "whatsapp[twilio]: threw — retrying");
      if (attempt < maxRetries) await sleep(500 * (attempt + 1));
    }
  }

  logger.error("whatsapp[twilio]: all retries exhausted");
  return { ok: false, provider: "twilio", error: lastError };
}

// ─── Unified API (used by all callers) ───────────────────────────────────────

/**
 * Like sendWhatsApp but returns the provider used and the raw API error on
 * failure, so the admin test-send endpoint can show an actionable message.
 * `to` should be E.164, e.g. "+201009780008". Never throws.
 */
export async function sendWhatsAppDetailed(to: string, body: string): Promise<WhatsAppSendResult> {
  // 1. Meta WhatsApp Cloud API (free, recommended)
  if (isMetaWhatsAppConfigured()) {
    const res = await sendMetaWhatsAppDetailed(to, body);
    if (res.ok) return { ok: true, provider: "meta", error: null };
    // If Meta fails, try Twilio fallback before returning the Meta error
    logger.warn({ error: res.error }, "whatsapp: Meta send failed — trying Twilio fallback");
    if (isTwilioConfigured()) {
      const twRes = await sendViaTwilioDetailed(to, body);
      if (twRes.ok) return { ok: true, provider: "twilio", error: null };
      return { ok: false, provider: "twilio", error: twRes.error ?? res.error };
    }
    return { ok: false, provider: "meta", error: res.error };
  }

  // 2. Twilio
  if (isTwilioConfigured()) {
    return sendViaTwilioDetailed(to, body);
  }

  // 3. Nothing configured — return diagnostic
  const diag = getWhatsAppDiagnostic();
  return { ok: false, provider: null, error: diag.reason };
}

/**
 * Send a WhatsApp message — tries Meta Cloud API first, falls back to Twilio.
 * `to` should be E.164, e.g. "+201009780008". Never throws.
 */
export async function sendWhatsApp(to: string, body: string): Promise<boolean> {
  // 1. Meta WhatsApp Cloud API (free)
  if (isMetaWhatsAppConfigured()) {
    const ok = await sendMetaWhatsApp(to, body);
    if (ok) return true;
    logger.warn("whatsapp: Meta send failed — trying Twilio fallback");
  }

  // 2. Twilio fallback
  if (isTwilioConfigured()) {
    return sendViaTwilio(to, body);
  }

  logger.warn(
    { to: to.slice(0, 6) + "***" },
    "whatsapp: no provider configured — set META_WHATSAPP_PHONE_NUMBER_ID or TWILIO_* secrets",
  );
  return false;
}

/**
 * Broadcast to multiple numbers in parallel.
 * Returns count of successful sends.
 */
export async function broadcastWhatsApp(numbers: string[], body: string): Promise<number> {
  if (numbers.length === 0) return 0;

  // If Meta is configured, use its batch broadcast directly (more efficient)
  if (isMetaWhatsAppConfigured()) {
    const metaSent = await broadcastMetaWhatsApp(numbers, body);
    if (metaSent > 0 || !isTwilioConfigured()) return metaSent;
    // All Meta sends failed and Twilio is available — fall through
    logger.warn("whatsapp: Meta broadcast failed for all numbers — falling back to Twilio");
  }

  // Twilio broadcast
  if (isTwilioConfigured()) {
    const results = await Promise.allSettled(
      numbers.map((n) => sendViaTwilio(n, body)),
    );
    return results.filter((r) => r.status === "fulfilled" && r.value).length;
  }

  return 0;
}

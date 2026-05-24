import crypto from "node:crypto";
import { logger } from "./logger";

// ─────────────────────────────────────────────────────────────────────────────
// Meta Conversions API (CAPI) — server-side companion to the browser Pixel.
//
// Meta deduplicates conversions sent via BOTH channels using
// (event_name, event_id) within a 24-hour window. The frontend generates an
// `eventID` (see analytics.ts → newEventId), passes it to fbq via
// { eventID }, and then sends the SAME id to the server which forwards it
// here as `eventId`. Critical: do not generate a new id server-side or
// dedup will silently fail.
//
// Configuration: only `META_CAPI_ACCESS_TOKEN` is required. Without it,
// every helper here is a silent no-op so dev and prod-without-token both
// keep working. Pixel id is hard-coded to match index.html (1621776232209731).
//
// PII (email, phone, name) MUST be SHA-256 hashed lowercase/normalized
// per Meta's spec. Raw values must never leave the server.
// ─────────────────────────────────────────────────────────────────────────────

const PIXEL_ID = "1621776232209731";
const API_VERSION = "v22.0";
const ENDPOINT = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`;

type CapiUserData = {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  fbc?: string | null;
  fbp?: string | null;
  externalId?: string | null;
};

type CapiCustomData = {
  currency?: string;
  value?: number;
  contentName?: string;
  contentCategory?: string;
  contentIds?: (string | number)[];
};

export type CapiEvent = {
  eventName: string;
  eventId: string;
  eventTime?: number; // unix seconds
  eventSourceUrl?: string;
  actionSource?: "website" | "system_generated" | "chat" | "email";
  user: CapiUserData;
  custom?: CapiCustomData;
};

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase();
}

function normalizePhone(v: string): string {
  // Meta wants digits only, with country code, no leading + or spaces.
  const digits = v.replace(/\D/g, "");
  // Egyptian local-format fallback: turn 01… into 201… so CAPI matches
  // the WhatsApp-style identifiers stored elsewhere.
  if (digits.length === 11 && digits.startsWith("0")) return `2${digits}`;
  return digits;
}

function normalizeName(v: string): string {
  return v.trim().toLowerCase();
}

function hashUserData(u: CapiUserData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  if (u.email) out.em = sha256(normalizeEmail(u.email));
  if (u.phone) {
    const ph = normalizePhone(u.phone);
    if (ph) out.ph = sha256(ph);
  }
  if (u.firstName) out.fn = sha256(normalizeName(u.firstName));
  if (u.lastName) out.ln = sha256(normalizeName(u.lastName));
  if (u.externalId) out.external_id = sha256(String(u.externalId).trim().toLowerCase());
  // These are passed in plaintext per Meta spec.
  if (u.ip) out.client_ip_address = u.ip;
  if (u.userAgent) out.client_user_agent = u.userAgent;
  if (u.fbc) out.fbc = u.fbc;
  if (u.fbp) out.fbp = u.fbp;
  return out;
}

function buildCustomData(c?: CapiCustomData): Record<string, unknown> | undefined {
  if (!c) return undefined;
  const out: Record<string, unknown> = {};
  if (c.currency) out.currency = c.currency;
  if (typeof c.value === "number") out.value = c.value;
  if (c.contentName) out.content_name = c.contentName;
  if (c.contentCategory) out.content_category = c.contentCategory;
  if (c.contentIds && c.contentIds.length > 0) {
    out.content_ids = c.contentIds.map(String);
    out.content_type = "product";
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function isCapiEnabled(): boolean {
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  return typeof token === "string" && token.length > 20;
}

// Fire-and-forget. Never throws — CAPI failures must not break business
// flows like booking submission.
export async function sendCapiEvent(ev: CapiEvent): Promise<void> {
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!token || token.length < 20) return; // silent no-op when unconfigured

  const payload = {
    data: [
      {
        event_name: ev.eventName,
        event_time: ev.eventTime ?? Math.floor(Date.now() / 1000),
        event_id: ev.eventId,
        action_source: ev.actionSource ?? "website",
        ...(ev.eventSourceUrl ? { event_source_url: ev.eventSourceUrl } : {}),
        user_data: hashUserData(ev.user),
        ...(buildCustomData(ev.custom) ? { custom_data: buildCustomData(ev.custom) } : {}),
      },
    ],
  };

  try {
    const url = `${ENDPOINT}?access_token=${encodeURIComponent(token)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      const text = await res.text().catch(() => "<no body>");
      logger.warn({ status: res.status, body: text.slice(0, 500), event: ev.eventName }, "meta-capi: non-2xx response");
    }
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err), event: ev.eventName }, "meta-capi: send failed");
  }
}

// Express helper: extract IP / UA / Meta cookies from a request to populate
// CAPI user_data.
export function userDataFromRequest(req: {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
  cookies?: Record<string, string>;
}): Pick<CapiUserData, "ip" | "userAgent" | "fbc" | "fbp"> {
  const xff = req.headers["x-forwarded-for"];
  const ipFromHeader = Array.isArray(xff) ? xff[0] : typeof xff === "string" ? xff.split(",")[0]?.trim() : undefined;
  const ip = ipFromHeader || req.ip || req.socket?.remoteAddress || undefined;
  const uaRaw = req.headers["user-agent"];
  const userAgent = Array.isArray(uaRaw) ? uaRaw[0] : uaRaw;
  // _fbc / _fbp may also arrive in body when cookies are blocked — callers
  // can override these.
  const fbc = req.cookies?._fbc;
  const fbp = req.cookies?._fbp;
  return { ip, userAgent, fbc, fbp };
}

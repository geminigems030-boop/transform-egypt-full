// ─────────────────────────────────────────────────────────────────────────────
// Google Calendar sync — creates a calendar event for each new booking so the
// whole team sees bookings in one shared calendar (no manual copy-paste).
//
// Self-contained: authenticates with a Google service account via a signed JWT
// (no extra npm dependency — uses Node's built-in crypto). Completely optional —
// if the env vars below are not set, every call is a silent no-op so bookings
// never fail because of a calendar issue.
//
// Required env (all three) to enable:
//   GOOGLE_SERVICE_ACCOUNT_EMAIL        — e.g. yara-bot@project.iam.gserviceaccount.com
//   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY  — the PEM private key ("-----BEGIN PRIVATE KEY-----…")
//   GOOGLE_CALENDAR_ID                  — the calendar to write to (e.g. team@group.calendar.google.com)
//
// The service account must be granted "Make changes to events" on that calendar.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from "node:crypto";
import { logger } from "./logger";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/calendar";

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function isCalendarConfigured(): boolean {
  return Boolean(
    process.env["GOOGLE_SERVICE_ACCOUNT_EMAIL"] &&
      process.env["GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"] &&
      process.env["GOOGLE_CALENDAR_ID"],
  );
}

// Cache the access token until ~1 min before expiry to avoid re-signing per call.
let _token: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  if (_token && Date.now() < _token.expiresAt) return _token.value;

  const email = process.env["GOOGLE_SERVICE_ACCOUNT_EMAIL"];
  // Allow the PEM to be stored with literal "\n" (common in env-var UIs).
  const key = (process.env["GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"] || "").replace(/\\n/g, "\n");
  if (!email || !key) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({ iss: email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }),
  );
  const signingInput = `${header}.${claim}`;

  let signature: string;
  try {
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(signingInput);
    signer.end();
    signature = base64url(signer.sign(key));
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "gcal: JWT signing failed (check private key format)");
    return null;
  }

  const assertion = `${signingInput}.${signature}`;

  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    if (!res.ok) {
      logger.warn({ status: res.status, body: (await res.text()).slice(0, 200) }, "gcal: token exchange failed");
      return null;
    }
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) return null;
    _token = {
      value: json.access_token,
      expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 - 60_000,
    };
    return _token.value;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "gcal: token request threw");
    return null;
  }
}

export interface CalendarBooking {
  clientName: string;
  clientPhone: string;
  service: string;
  branch?: string | null;
  /** Start time. If unknown/TBD, pass null — we create an all-day event today. */
  scheduledAt?: Date | null;
  notes?: string | null;
  /** When true the time is a real confirmed slot; otherwise treat as tentative. */
  hasSpecificTime?: boolean;
}

/**
 * Create a Google Calendar event for a booking. Returns the event id, or null
 * if calendar sync is disabled or the call failed (never throws — fire-and-forget).
 */
export async function createBookingEvent(b: CalendarBooking): Promise<string | null> {
  if (!isCalendarConfigured()) return null;

  const token = await getAccessToken();
  if (!token) return null;

  const calendarId = encodeURIComponent(process.env["GOOGLE_CALENDAR_ID"] || "primary");

  const summary = `${b.service} — ${b.clientName}${b.branch ? ` @ ${b.branch}` : ""}`;
  const descriptionLines = [
    `Client: ${b.clientName}`,
    `Phone: ${b.clientPhone}`,
    `Service: ${b.service}`,
    b.branch ? `Branch: ${b.branch}` : "",
    b.hasSpecificTime ? "" : "⚠ Time tentative — team to confirm.",
    b.notes ? `Notes: ${b.notes}` : "",
    "",
    "Created automatically by Yara / TransforM Egypt booking system.",
  ].filter(Boolean);

  // Build start/end. With a specific time → 90-min slot. Otherwise an all-day
  // event on the Cairo date so it still shows up for the team to schedule.
  let eventTime: Record<string, unknown>;
  if (b.scheduledAt && b.hasSpecificTime && !isNaN(b.scheduledAt.getTime())) {
    const start = b.scheduledAt;
    const end = new Date(start.getTime() + 90 * 60 * 1000);
    eventTime = {
      start: { dateTime: start.toISOString(), timeZone: "Africa/Cairo" },
      end: { dateTime: end.toISOString(), timeZone: "Africa/Cairo" },
    };
  } else {
    const day = (b.scheduledAt && !isNaN(b.scheduledAt.getTime()) ? b.scheduledAt : new Date())
      .toLocaleDateString("sv", { timeZone: "Africa/Cairo" }); // YYYY-MM-DD
    eventTime = { start: { date: day }, end: { date: day } };
  }

  const eventBody = {
    summary,
    description: descriptionLines.join("\n"),
    ...eventTime,
  };

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(eventBody),
      },
    );
    if (!res.ok) {
      logger.warn({ status: res.status, body: (await res.text()).slice(0, 200) }, "gcal: event insert failed");
      return null;
    }
    const json = (await res.json()) as { id?: string };
    logger.info({ eventId: json.id, service: b.service }, "gcal: booking event created");
    return json.id ?? null;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "gcal: event insert threw");
    return null;
  }
}

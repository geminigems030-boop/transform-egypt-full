// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp Appointment Automation Scheduler — TransforM Egypt
//
// Jobs:
//   every 5 min  — 24h reminder, 2h reminder
//   daily 9am Cairo — post-visit follow-up, re-engagement batch
// ─────────────────────────────────────────────────────────────────────────────

import cron from "node-cron";
import { and, eq, isNull, lt, lte, gte, or, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  appointmentsTable,
  clientsTable,
  automationLogTable,
  automationSettingsTable,
  submissionsTable,
} from "@workspace/db/schema";
import { sendWhatsApp, isAnyWhatsAppConfigured } from "./whatsapp";
import { notifyTeam } from "./notify-team";
import { logger } from "./logger";

// Branches currently accepting bookings — surfaced in the daily briefing.
const OPEN_BRANCHES = ["City Stars Mall", "Cairo Festival City Mall", "Sofitel Downtown"];
import {
  reminder24hMessage,
  reminder2hMessage,
  followupMessage,
  reengagementMessage,
  formatAppointmentTime,
  type Lang,
} from "./automation-templates";

// ── Settings ──────────────────────────────────────────────────────────────────

async function getSettings() {
  const [row] = await db.select().from(automationSettingsTable).limit(1);
  if (row) return row;
  const [created] = await db.insert(automationSettingsTable).values({}).returning();
  return created;
}

// ── Log helper ────────────────────────────────────────────────────────────────

async function logSend(params: {
  clientId?: number | null;
  appointmentId?: number | null;
  eventType: string;
  phone: string;
  message: string;
  success: boolean;
  twilioSid?: string;
}): Promise<void> {
  try {
    await db.insert(automationLogTable).values({
      clientId: params.clientId ?? null,
      appointmentId: params.appointmentId ?? null,
      eventType: params.eventType,
      phone: params.phone,
      messagePreview: params.message.slice(0, 100),
      success: params.success,
      twilioSid: params.twilioSid ?? null,
    });
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "automation: failed to write log");
  }
}

// ── Branch review link helper ─────────────────────────────────────────────────

function getReviewLink(settings: Awaited<ReturnType<typeof getSettings>>, branch?: string | null): string {
  const links = (settings.branchReviewLinks ?? {}) as Record<string, string>;
  if (branch && links[branch]) return links[branch];
  const fallback = Object.values(links)[0];
  if (fallback) return fallback;
  return "https://g.page/r/TransforMEgypt/review";
}

// ── 24h Reminder ─────────────────────────────────────────────────────────────

export async function run24hReminders(): Promise<number> {
  if (!isAnyWhatsAppConfigured()) return 0;
  const settings = await getSettings();
  if (!settings.enabled24h) return 0;

  const now = new Date();
  const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  const appts = await db
    .select({
      id: appointmentsTable.id,
      clientId: appointmentsTable.clientId,
      clientName: appointmentsTable.clientName,
      clientPhone: appointmentsTable.clientPhone,
      service: appointmentsTable.service,
      branch: appointmentsTable.branch,
      scheduledAt: appointmentsTable.scheduledAt,
    })
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.status, "confirmed"),
        gte(appointmentsTable.scheduledAt, windowStart),
        lte(appointmentsTable.scheduledAt, windowEnd),
        isNull(appointmentsTable.reminder24hSentAt),
      ),
    );

  let sent = 0;
  for (const appt of appts) {
    const lang: Lang = "ar";
    const msg = reminder24hMessage(
      {
        name: appt.clientName ?? "",
        service: appt.service,
        branch: appt.branch ?? "ترانسفورم",
        time: formatAppointmentTime(appt.scheduledAt),
      },
      lang,
    );

    const ok = await sendWhatsApp(appt.clientPhone, msg);
    await logSend({
      clientId: appt.clientId,
      appointmentId: appt.id,
      eventType: "reminder_24h",
      phone: appt.clientPhone,
      message: msg,
      success: ok,
    });

    if (ok) {
      await db
        .update(appointmentsTable)
        .set({ reminder24hSentAt: new Date(), updatedAt: new Date() })
        .where(eq(appointmentsTable.id, appt.id));
      sent++;
    }

    logger.info({ appointmentId: appt.id, ok }, "automation: 24h reminder");
  }

  return sent;
}

// ── 2h Reminder ───────────────────────────────────────────────────────────────

export async function run2hReminders(): Promise<number> {
  if (!isAnyWhatsAppConfigured()) return 0;
  const settings = await getSettings();
  if (!settings.enabled2h) return 0;

  const now = new Date();
  const windowStart = new Date(now.getTime() + 1.75 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 2.25 * 60 * 60 * 1000);

  const appts = await db
    .select({
      id: appointmentsTable.id,
      clientId: appointmentsTable.clientId,
      clientName: appointmentsTable.clientName,
      clientPhone: appointmentsTable.clientPhone,
      service: appointmentsTable.service,
      branch: appointmentsTable.branch,
      scheduledAt: appointmentsTable.scheduledAt,
    })
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.status, "confirmed"),
        gte(appointmentsTable.scheduledAt, windowStart),
        lte(appointmentsTable.scheduledAt, windowEnd),
        isNull(appointmentsTable.reminder2hSentAt),
      ),
    );

  let sent = 0;
  for (const appt of appts) {
    const lang: Lang = "ar";
    const msg = reminder2hMessage(
      {
        name: appt.clientName ?? "",
        service: appt.service,
        branch: appt.branch ?? "ترانسفورم",
        time: formatAppointmentTime(appt.scheduledAt),
      },
      lang,
    );

    const ok = await sendWhatsApp(appt.clientPhone, msg);
    await logSend({
      clientId: appt.clientId,
      appointmentId: appt.id,
      eventType: "reminder_2h",
      phone: appt.clientPhone,
      message: msg,
      success: ok,
    });

    if (ok) {
      await db
        .update(appointmentsTable)
        .set({ reminder2hSentAt: new Date(), updatedAt: new Date() })
        .where(eq(appointmentsTable.id, appt.id));
      sent++;
    }

    logger.info({ appointmentId: appt.id, ok }, "automation: 2h reminder");
  }

  return sent;
}

// ── Post-visit Follow-up ──────────────────────────────────────────────────────

export async function runFollowups(): Promise<number> {
  if (!isAnyWhatsAppConfigured()) return 0;
  const settings = await getSettings();
  if (!settings.enabledFollowup) return 0;

  const now = new Date();
  const windowStart = new Date(now.getTime() - 25 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() - 23 * 60 * 60 * 1000);

  const appts = await db
    .select({
      id: appointmentsTable.id,
      clientId: appointmentsTable.clientId,
      clientName: appointmentsTable.clientName,
      clientPhone: appointmentsTable.clientPhone,
      service: appointmentsTable.service,
      branch: appointmentsTable.branch,
      completedAt: appointmentsTable.completedAt,
    })
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.status, "completed"),
        gte(appointmentsTable.completedAt, windowStart),
        lte(appointmentsTable.completedAt, windowEnd),
        isNull(appointmentsTable.followupSentAt),
      ),
    );

  let sent = 0;
  for (const appt of appts) {
    const lang: Lang = "ar";
    const reviewLink = getReviewLink(settings, appt.branch);
    const msg = followupMessage({ name: appt.clientName ?? "", reviewLink }, lang);

    const ok = await sendWhatsApp(appt.clientPhone, msg);
    await logSend({
      clientId: appt.clientId,
      appointmentId: appt.id,
      eventType: "followup",
      phone: appt.clientPhone,
      message: msg,
      success: ok,
    });

    if (ok) {
      await db
        .update(appointmentsTable)
        .set({ followupSentAt: new Date(), updatedAt: new Date() })
        .where(eq(appointmentsTable.id, appt.id));
      sent++;
    }

    logger.info({ appointmentId: appt.id, ok }, "automation: post-visit follow-up");
  }

  return sent;
}

// ── Re-engagement Batch ───────────────────────────────────────────────────────

export async function runReengagement(): Promise<number> {
  if (!isAnyWhatsAppConfigured()) return 0;
  const settings = await getSettings();
  if (!settings.enabledReengagement) return 0;

  const windowDays = settings.reengagementWindowDays ?? 60;
  const cooldownDays = settings.reengagementCooldownDays ?? 30;

  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const cooloffCutoff = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000);

  const clients = await db
    .select({
      id: clientsTable.id,
      name: clientsTable.name,
      phone: clientsTable.phone,
      lastVisit: clientsTable.lastVisit,
      reengagementSentAt: clientsTable.reengagementSentAt,
    })
    .from(clientsTable)
    .where(
      and(
        lt(clientsTable.lastVisit, cutoff),
        or(
          isNull(clientsTable.reengagementSentAt),
          lt(clientsTable.reengagementSentAt, cooloffCutoff),
        ),
        sql`${clientsTable.visitCount} > 0`,
      ),
    );

  const BOOKING_LINK = "https://transform-egypt.com/book";
  let sent = 0;

  for (const client of clients) {
    const lang: Lang = "ar";

    const [lastAppt] = await db
      .select({ service: appointmentsTable.service })
      .from(appointmentsTable)
      .where(
        and(
          eq(appointmentsTable.clientId, client.id),
          eq(appointmentsTable.status, "completed"),
        ),
      )
      .orderBy(sql`scheduled_at DESC`)
      .limit(1);

    const lastService = lastAppt?.service ?? "الخدمة";
    const msg = reengagementMessage(
      { name: client.name ?? "", lastService, bookingLink: BOOKING_LINK },
      lang,
    );

    const ok = await sendWhatsApp(client.phone, msg);
    await logSend({
      clientId: client.id,
      appointmentId: null,
      eventType: "reengagement",
      phone: client.phone,
      message: msg,
      success: ok,
    });

    if (ok) {
      await db
        .update(clientsTable)
        .set({ reengagementSentAt: new Date(), updatedAt: new Date() })
        .where(eq(clientsTable.id, client.id));
      sent++;
    }

    logger.info({ clientId: client.id, ok }, "automation: re-engagement");
  }

  return sent;
}

// ── Automation Preview — "Today's Pipeline" counts ───────────────────────────

export interface AutomationPreview {
  reminders24h: number;
  reminders2h: number;
  followupsPending: number;
  reengagementEligible: number;
  generatedAt: string;
}

export async function getAutomationPreview(): Promise<AutomationPreview> {
  const settings = await getSettings();
  const now = new Date();

  // ── Cairo day boundaries ───────────────────────────────────────────────────
  // Uses Intl to correctly handle Africa/Cairo timezone including any DST
  // transitions, rather than assuming a fixed UTC+2 offset.
  function cairoDay(offsetDays: number): { start: Date; end: Date } {
    const target = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000);

    // Get the Cairo calendar date for `target` in ISO format (YYYY-MM-DD)
    const cairoDateStr = target.toLocaleDateString("sv", { timeZone: "Africa/Cairo" });

    // Find the UTC instant that corresponds to Cairo 00:00:00 on that date:
    // 1. Take UTC midnight for the same YYYY-MM-DD
    const utcMidnight = new Date(`${cairoDateStr}T00:00:00.000Z`);
    // 2. Ask: what is the Cairo clock showing at UTC midnight?
    //    e.g. "02:00:00" for UTC+2 or "03:00:00" for UTC+3 (DST)
    const cairoTimeStr = utcMidnight.toLocaleTimeString("en-GB", {
      timeZone: "Africa/Cairo",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const [h, m, s] = cairoTimeStr.split(":").map(Number);
    const cairoOffsetMs = ((h ?? 0) * 3600 + (m ?? 0) * 60 + (s ?? 0)) * 1000;

    // Cairo midnight in UTC = UTC midnight − Cairo offset
    const start = new Date(utcMidnight.getTime() - cairoOffsetMs);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
    return { start, end };
  }

  const today = cairoDay(0);
  const tomorrow = cairoDay(1);
  const yesterday = cairoDay(-1);

  // 24h reminders scheduled to fire today:
  //   The 24h reminder fires when scheduledAt is ~24h away, so sends today
  //   correspond to appointments scheduled for tomorrow (Cairo date).
  const [{ count: reminders24h }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.status, "confirmed"),
        gte(appointmentsTable.scheduledAt, tomorrow.start),
        lte(appointmentsTable.scheduledAt, tomorrow.end),
        isNull(appointmentsTable.reminder24hSentAt),
      ),
    );

  // 2h reminders scheduled to fire today:
  //   The 2h reminder fires when scheduledAt is ~2h away, so sends today
  //   correspond to confirmed appointments scheduled for today (Cairo date)
  //   that have not yet received the 2h nudge.
  const [{ count: reminders2h }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.status, "confirmed"),
        gte(appointmentsTable.scheduledAt, today.start),
        lte(appointmentsTable.scheduledAt, today.end),
        isNull(appointmentsTable.reminder2hSentAt),
      ),
    );

  // Post-visit follow-ups scheduled to fire today:
  //   The follow-up fires ~24h after completion, so today's sends come from
  //   appointments completed yesterday (Cairo date) not yet followed up.
  const [{ count: followupsPending }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.status, "completed"),
        gte(appointmentsTable.completedAt, yesterday.start),
        lte(appointmentsTable.completedAt, yesterday.end),
        isNull(appointmentsTable.followupSentAt),
      ),
    );

  // Re-engagement eligible for next batch:
  //   Count of clients who have been inactive beyond the configured window
  //   and are outside the cooldown period — i.e. ready for the next daily run.
  const windowDays = settings.reengagementWindowDays ?? 60;
  const cooldownDays = settings.reengagementCooldownDays ?? 30;
  const inactiveCutoff = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const cooldownCutoff = new Date(now.getTime() - cooldownDays * 24 * 60 * 60 * 1000);
  const [{ count: reengagementEligible }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(clientsTable)
    .where(
      and(
        lt(clientsTable.lastVisit, inactiveCutoff),
        or(
          isNull(clientsTable.reengagementSentAt),
          lt(clientsTable.reengagementSentAt, cooldownCutoff),
        ),
        sql`${clientsTable.visitCount} > 0`,
      ),
    );

  return {
    reminders24h: reminders24h ?? 0,
    reminders2h: reminders2h ?? 0,
    followupsPending: followupsPending ?? 0,
    reengagementEligible: reengagementEligible ?? 0,
    generatedAt: now.toISOString(),
  };
}

// ── Daily Morning Briefing ──────────────────────────────────────────────────
// A 9 AM Cairo WhatsApp to the owner/team: today's bookings (grouped by branch),
// new leads captured yesterday→today, and which branches are open. Reuses the
// team-notification plumbing (notifyOnBooking recipients).

/** Returns the UTC [start,end] instants that bound the given Cairo calendar day. */
function cairoDayBounds(offsetDays: number): { start: Date; end: Date } {
  const now = new Date();
  const target = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  const cairoDateStr = target.toLocaleDateString("sv", { timeZone: "Africa/Cairo" });
  const utcMidnight = new Date(`${cairoDateStr}T00:00:00.000Z`);
  const cairoTimeStr = utcMidnight.toLocaleTimeString("en-GB", {
    timeZone: "Africa/Cairo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const [h, m, s] = cairoTimeStr.split(":").map(Number);
  const cairoOffsetMs = ((h ?? 0) * 3600 + (m ?? 0) * 60 + (s ?? 0)) * 1000;
  const start = new Date(utcMidnight.getTime() - cairoOffsetMs);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end };
}

export async function runDailyBriefing(): Promise<boolean> {
  if (!isAnyWhatsAppConfigured()) return false;

  const today = cairoDayBounds(0);
  const yesterday = cairoDayBounds(-1);

  // Today's appointments (anything not cancelled), with branch for grouping.
  const todaysAppts = await db
    .select({ branch: appointmentsTable.branch, status: appointmentsTable.status })
    .from(appointmentsTable)
    .where(
      and(
        gte(appointmentsTable.scheduledAt, today.start),
        lte(appointmentsTable.scheduledAt, today.end),
        sql`${appointmentsTable.status} <> 'cancelled'`,
      ),
    );

  // New leads captured since the start of yesterday (covers overnight DMs).
  const [{ count: newLeads }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(submissionsTable)
    .where(gte(submissionsTable.createdAt, yesterday.start));

  // Group today's bookings by branch.
  const byBranch = new Map<string, number>();
  for (const a of todaysAppts) {
    const key = a.branch?.trim() || "Unassigned";
    byBranch.set(key, (byBranch.get(key) ?? 0) + 1);
  }

  const bookingLines =
    todaysAppts.length === 0
      ? ["• No bookings scheduled yet today."]
      : [...byBranch.entries()].map(([branch, n]) => `• ${n} booking${n === 1 ? "" : "s"} at ${branch}`);

  const text = [
    `Today: ${todaysAppts.length} booking${todaysAppts.length === 1 ? "" : "s"}, ${newLeads ?? 0} new lead${(newLeads ?? 0) === 1 ? "" : "s"}.`,
    ``,
    `Bookings by branch:`,
    ...bookingLines,
    ``,
    `Open branches today: ${OPEN_BRANCHES.join(" ✅, ")} ✅`,
  ].join("\n");

  await notifyTeam({ type: "daily_briefing", text });
  logger.info({ bookings: todaysAppts.length, newLeads }, "automation: daily briefing sent");
  return true;
}

// ── Manual test send ──────────────────────────────────────────────────────────

export async function sendTestMessage(phone: string, eventType: string): Promise<boolean> {
  const msg = `[TransforM Egypt Test] This is a test message for automation type: ${eventType}. Sent at ${new Date().toISOString()}.`;
  const ok = await sendWhatsApp(phone, msg);
  await logSend({ phone, eventType: "test", message: msg, success: ok });
  return ok;
}

// ── Scheduler startup ─────────────────────────────────────────────────────────

export function startAutomationScheduler(): void {
  logger.info("automation: scheduler starting");

  // Every 5 minutes — check for upcoming appointment reminders
  cron.schedule("*/5 * * * *", async () => {
    try {
      const [s24, s2h] = await Promise.all([run24hReminders(), run2hReminders()]);
      if (s24 > 0 || s2h > 0) {
        logger.info({ s24, s2h }, "automation: reminders sent");
      }
    } catch (err) {
      logger.error({ err: (err as Error).message }, "automation: reminder job failed");
    }
  });

  // Daily at 9:00am Cairo time
  cron.schedule(
    "0 9 * * *",
    async () => {
      try {
        const [followups, reengaged] = await Promise.all([runFollowups(), runReengagement()]);
        logger.info({ followups, reengaged }, "automation: daily batch complete");
      } catch (err) {
        logger.error({ err: (err as Error).message }, "automation: daily batch failed");
      }
      // Morning briefing to the owner/team — separate try so a failure here
      // never blocks the follow-up/re-engagement batch above.
      try {
        await runDailyBriefing();
      } catch (err) {
        logger.error({ err: (err as Error).message }, "automation: daily briefing failed");
      }
    },
    { timezone: "Africa/Cairo" },
  );

  logger.info("automation: scheduler started (reminders every 5m, daily batch + briefing at 09:00 Cairo)");
}

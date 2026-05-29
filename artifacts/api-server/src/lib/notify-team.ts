// ─────────────────────────────────────────────────────────────────────────────
// Yara Team WhatsApp Notifications — TransforM Egypt
//
// Dispatches WhatsApp alerts to active team members when:
//   • escalation  — Yara flags a complaint / refund / sensitive message
//   • dm_lead     — Yara detects a phone number in a DM (new lead captured)
//   • new_booking — A customer submits a booking form on the website
//   • new_lead    — A Meta Lead Ad form is submitted
//   • call_summary — An inbound or outbound call ends (post-call summary)
// ─────────────────────────────────────────────────────────────────────────────

import { db } from "@workspace/db";
import { teamMembersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { broadcastWhatsApp, isAnyWhatsAppConfigured } from "./whatsapp";
import { logger } from "./logger";

export type NotifyEvent =
  | { type: "escalation"; threadId: string; username: string | null; platform: string; text: string }
  | { type: "dm_lead"; phone: string; username: string | null; platform: string; threadId: string }
  | { type: "new_booking"; name?: string; phone?: string; email?: string; service?: string; branch?: string }
  | { type: "new_lead"; name?: string; phone?: string; email?: string; service?: string; source: string }
  | { type: "call_summary"; callSid: string; direction: "inbound" | "outbound"; callerNumber: string; outcome: string; durationSeconds?: number; summary?: string }
  | { type: "appointment_action"; action: "confirmed" | "completed" | "cancelled" | "rescheduled"; appointmentId: number; clientName?: string; clientPhone: string; service: string; branch?: string; scheduledAt: string }
  | { type: "daily_briefing"; text: string };

type EventType = NotifyEvent["type"];

const SIGNATURE = "— Yara, TransforM Egypt AI";

async function getActiveMembersForEvent(eventType: EventType): Promise<string[]> {
  const rows = await db
    .select({
      phone: teamMembersTable.phone,
      whatsappPhone: teamMembersTable.whatsappPhone,
      notifyOnEscalation: teamMembersTable.notifyOnEscalation,
      notifyOnDmLead: teamMembersTable.notifyOnDmLead,
      notifyOnBooking: teamMembersTable.notifyOnBooking,
      notifyOnLead: teamMembersTable.notifyOnLead,
      notifyOnCall: teamMembersTable.notifyOnCall,
    })
    .from(teamMembersTable)
    .where(eq(teamMembersTable.active, true));

  return rows
    .filter((r) => {
      if (eventType === "escalation") return r.notifyOnEscalation;
      if (eventType === "dm_lead") return r.notifyOnDmLead;
      if (eventType === "new_booking") return r.notifyOnBooking;
      if (eventType === "new_lead") return r.notifyOnLead;
      if (eventType === "call_summary") return r.notifyOnCall;
      if (eventType === "appointment_action") return r.notifyOnBooking;
      if (eventType === "daily_briefing") return r.notifyOnBooking;
      return false;
    })
    .map((r) => r.whatsappPhone || r.phone)
    .filter((n): n is string => Boolean(n));
}

function buildMessage(event: NotifyEvent): string {
  switch (event.type) {
    case "escalation":
      return [
        `*TransforM Egypt — Escalation Alert* ⚠️`,
        ``,
        `Customer: ${event.username ?? "Unknown"}`,
        `Platform: ${event.platform}`,
        `Message: "${event.text.slice(0, 300)}${event.text.length > 300 ? "…" : ""}"`,
        ``,
        `Please respond immediately.`,
        `https://transform-egypt.com/admin`,
        ``,
        SIGNATURE,
      ].join("\n");

    case "dm_lead":
      return [
        `*TransforM Egypt — New Lead from DM* 📞`,
        ``,
        `Username: ${event.username ?? "Unknown"}`,
        `Platform: ${event.platform}`,
        `Phone: ${event.phone}`,
        ``,
        `Lead has been saved to Submissions.`,
        `https://transform-egypt.com/admin`,
        ``,
        SIGNATURE,
      ].join("\n");

    case "new_booking":
      return [
        `*TransforM Egypt — New Booking Request* 📅`,
        ``,
        `Name: ${event.name ?? "—"}`,
        `Phone: ${event.phone ?? "—"}`,
        `Email: ${event.email ?? "—"}`,
        `Service: ${event.service ?? "—"}`,
        `Branch: ${event.branch ?? "—"}`,
        ``,
        `https://transform-egypt.com/admin`,
        ``,
        SIGNATURE,
      ].join("\n");

    case "new_lead":
      return [
        `*TransforM Egypt — New Lead (${event.source})* 🎯`,
        ``,
        `Name: ${event.name ?? "—"}`,
        `Phone: ${event.phone ?? "—"}`,
        `Email: ${event.email ?? "—"}`,
        `Service: ${event.service ?? "—"}`,
        ``,
        `https://transform-egypt.com/admin`,
        ``,
        SIGNATURE,
      ].join("\n");

    case "appointment_action": {
      const ACTION_LABELS: Record<string, string> = {
        confirmed: "Confirmed ✅",
        completed: "Completed 🌟",
        cancelled: "Cancelled ❌",
        rescheduled: "Rescheduled 📅",
      };
      return [
        `*TransforM Egypt — Appointment ${ACTION_LABELS[event.action] ?? event.action}*`,
        ``,
        `Client: ${event.clientName ?? "Unknown"}`,
        `Phone: ${event.clientPhone}`,
        `Service: ${event.service}`,
        event.branch ? `Branch: ${event.branch}` : "",
        `Date: ${new Date(event.scheduledAt).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`,
        ``,
        `https://transform-egypt.com/admin`,
        ``,
        SIGNATURE,
      ].filter(Boolean).join("\n");
    }

    case "call_summary": {
      const dir = event.direction === "inbound" ? "Inbound" : "Outbound";
      const dur = event.durationSeconds != null
        ? `${Math.floor(event.durationSeconds / 60)}m ${event.durationSeconds % 60}s`
        : "—";
      return [
        `*TransforM Egypt — Call Summary* 📞`,
        ``,
        `Direction: ${dir}`,
        `Caller: ${event.callerNumber}`,
        `Duration: ${dur}`,
        `Outcome: ${event.outcome}`,
        event.summary ? `Summary: ${event.summary.slice(0, 300)}` : "",
        ``,
        `Call ID: ${event.callSid}`,
        `https://transform-egypt.com/admin`,
        ``,
        SIGNATURE,
      ].filter((line) => line !== "").join("\n");
    }

    case "daily_briefing":
      // The full briefing body is composed by the scheduler (it has the DB
      // queries); we just wrap it with the brand header + footer here.
      return [
        `*TransforM Egypt — Good morning ☀️*`,
        ``,
        event.text,
        ``,
        `https://transform-egypt.com/admin`,
        ``,
        SIGNATURE,
      ].join("\n");
  }
}

/**
 * Notify all eligible active team members via WhatsApp.
 * Fire-and-forget safe — never throws.
 */
export async function notifyTeam(event: NotifyEvent): Promise<void> {
  if (!isAnyWhatsAppConfigured()) {
    logger.debug({ eventType: event.type }, "notify-team: no WhatsApp provider configured, skipping");
    return;
  }

  try {
    const numbers = await getActiveMembersForEvent(event.type);
    if (numbers.length === 0) {
      logger.debug({ eventType: event.type }, "notify-team: no active members subscribed to this event");
      return;
    }

    const message = buildMessage(event);
    const sent = await broadcastWhatsApp(numbers, message);
    logger.info(
      { eventType: event.type, total: numbers.length, sent },
      "notify-team: WhatsApp broadcast complete",
    );
  } catch (err) {
    logger.error(
      { err: (err as Error).message, eventType: event.type },
      "notify-team: dispatch failed",
    );
  }
}

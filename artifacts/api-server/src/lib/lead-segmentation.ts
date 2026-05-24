// ─────────────────────────────────────────────────────────────────────────────
// Lead Segmentation Engine — queries the database and scores leads for
// re-engagement campaigns based on recency, intent signals, and data quality.
// ─────────────────────────────────────────────────────────────────────────────

import { eq, and, or, gt, lt, isNull, desc, sql, inArray, not, like } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  submissionsTable,
  luckySpinsTable,
  bookingsTable,
  ordersTable,
  instagramMessagesTable,
} from "@workspace/db/schema";

export type LeadSegment =
  | "no_booking"
  | "lucky_spin"
  | "post_booking"
  | "newsletter"
  | "warm_dm"
  | "abandoned_cart";

export interface SegmentedLead {
  sourceTable: string;
  sourceId: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  threadId: string | null;
  language: string | null;
  segment: LeadSegment;
  score: number; // 0–100
  reason: string;
  lastContactDate: Date | null;
  service?: string | null;
  quizGoal?: string | null;
  quizHair?: string | null;
  message?: string | null;
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. NO-BOOKING form leads — people who filled a form but never booked
// ─────────────────────────────────────────────────────────────────────────────

export async function getNoBookingLeads(opts?: {
  daysSince?: number;
  maxDays?: number;
  sources?: string[];
  limit?: number;
}): Promise<SegmentedLead[]> {
  const daysSince = opts?.daysSince ?? 1;
  const maxDays = opts?.maxDays ?? 30;
  const sources = opts?.sources ?? ["book", "consultation", "contact", "boutique"];

  const since = new Date(Date.now() - maxDays * 86_400_000);
  const until = new Date(Date.now() - daysSince * 86_400_000);

  // Find submissions that have NEVER converted to a booking
  const rows = await db
    .select()
    .from(submissionsTable)
    .where(
      and(
        inArray(submissionsTable.source, sources),
        isNull(submissionsTable.followupSentAt),
        gt(submissionsTable.createdAt, since),
        lt(submissionsTable.createdAt, until),
        or(
          eq(submissionsTable.status, "new"),
          eq(submissionsTable.status, "contacted"),
        ),
      ),
    )
    .limit(opts?.limit ?? 1000)
    .orderBy(desc(submissionsTable.createdAt));

  return rows.map((r) => {
    let score = 40;
    if (r.phone) score += 20;
    if (r.email) score += 15;
    if (r.service) score += 15;
    if (r.message && r.message.length > 20) score += 10;
    return {
      sourceTable: "submissions",
      sourceId: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      threadId: null,
      language: r.language,
      segment: "no_booking",
      score: Math.min(100, score),
      reason: `Submitted a ${r.source} form on ${r.createdAt.toDateString()} but never booked. Interested in ${r.service ?? "unspecified service"}.`,
      lastContactDate: r.createdAt,
      service: r.service,
      message: r.message,
      createdAt: r.createdAt,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. LUCKY SPIN leads — people who played but never redeemed
// ─────────────────────────────────────────────────────────────────────────────

export async function getLuckySpinLeads(opts?: {
  daysSince?: number;
  limit?: number;
}): Promise<SegmentedLead[]> {
  const daysSince = opts?.daysSince ?? 1;
  const since = new Date(Date.now() - daysSince * 86_400_000);

  const rows = await db
    .select()
    .from(luckySpinsTable)
    .where(
      and(
        gt(luckySpinsTable.createdAt, since),
        like(luckySpinsTable.prizeCode, "%"), // all spins
      ),
    )
    .limit(opts?.limit ?? 500)
    .orderBy(desc(luckySpinsTable.createdAt));

  // Deduplicate by phone
  const seen = new Set<string>();
  const leads: SegmentedLead[] = [];

  for (const r of rows) {
    if (!r.phone || seen.has(r.phone)) continue;
    seen.add(r.phone);

    let score = 50;
    if (r.email) score += 15;
    if (r.quizGoal) score += 15;
    if (r.quizHair) score += 10;
    if (r.isGrand) score += 10;

    leads.push({
      sourceTable: "lucky_spins",
      sourceId: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      threadId: null,
      language: null,
      segment: "lucky_spin",
      score: Math.min(100, score),
      reason: `Played Lucky Spin on ${r.createdAt.toDateString()} and won ${r.prizeLabel}. Never redeemed prize.`,
      lastContactDate: r.createdAt,
      quizGoal: r.quizGoal,
      quizHair: r.quizHair,
      createdAt: r.createdAt,
    });
  }

  return leads;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. WARM DM leads — IG/FB DMs that haven't booked yet, within 7-day window
// ─────────────────────────────────────────────────────────────────────────────

export async function getWarmDmLeads(opts?: {
  daysSince?: number;
  maxDays?: number;
  limit?: number;
}): Promise<SegmentedLead[]> {
  const daysSince = opts?.daysSince ?? 1;
  const maxDays = opts?.maxDays ?? 7; // Meta 7-day HUMAN_AGENT window
  const since = new Date(Date.now() - maxDays * 86_400_000);
  const until = new Date(Date.now() - daysSince * 86_400_000);

  // Find threads with inbound messages in the window but no "booked" status
  const rows = await db
    .select()
    .from(instagramMessagesTable)
    .where(
      and(
        eq(instagramMessagesTable.direction, "inbound"),
        gt(instagramMessagesTable.receivedAt, since),
        lt(instagramMessagesTable.receivedAt, until),
      ),
    )
    .orderBy(desc(instagramMessagesTable.receivedAt))
    .limit(opts?.limit ?? 1000);

  // Group by threadId, keep the most recent message per thread
  const byThread = new Map<string, typeof rows[0]>();
  for (const r of rows) {
    if (!byThread.has(r.threadId)) {
      byThread.set(r.threadId, r);
    }
  }

  const leads: SegmentedLead[] = [];
  for (const r of byThread.values()) {
    // Check if this thread has any "booked" or "appointment" signals
    const hasBookingSignal = r.text &&
      /book|booking|appointment|confirmed|m3ad|moaed|hagz|7agz/i.test(r.text);

    // Skip if it looks like they already booked
    if (hasBookingSignal) continue;

    let score = 35;
    if (r.text && r.text.length > 30) score += 20;
    if (r.senderUsername) score += 15;
    // Higher score if they showed price/booking intent
    if (r.text && /price|cost|how much|bkaam|bkam|se3r/i.test(r.text)) score += 15;
    // Higher if they asked about specific services
    if (r.text && /extension|lash|micro|treatment|lash|eyebrow|hair/i.test(r.text)) score += 15;

    leads.push({
      sourceTable: "instagram_messages",
      sourceId: r.id,
      name: r.senderUsername,
      email: null,
      phone: null,
      threadId: r.threadId,
      language: null, // detected at send time
      segment: "warm_dm",
      score: Math.min(100, score),
      reason: `DMed on ${r.receivedAt.toDateString()} about "${r.text?.slice(0, 50) ?? "photo"}". No booking confirmed yet. Within 7-day follow-up window.`,
      lastContactDate: r.receivedAt,
      message: r.text,
      createdAt: r.receivedAt,
    });
  }

  return leads;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. POST-BOOKING — completed services, ask for review or rebook
// ─────────────────────────────────────────────────────────────────────────────

export async function getPostBookingLeads(opts?: {
  daysSince?: number;
  maxDays?: number;
  limit?: number;
}): Promise<SegmentedLead[]> {
  const daysSince = opts?.daysSince ?? 14;
  const maxDays = opts?.maxDays ?? 60;
  const since = new Date(Date.now() - maxDays * 86_400_000);
  const until = new Date(Date.now() - daysSince * 86_400_000);

  const rows = await db
    .select()
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.status, "confirmed"),
        gt(bookingsTable.createdAt, since),
        lt(bookingsTable.createdAt, until),
        not(like(bookingsTable.status, "cancelled")),
      ),
    )
    .orderBy(desc(bookingsTable.createdAt))
    .limit(opts?.limit ?? 500);

  return rows.map((r) => {
    let score = 55;
    if (r.email) score += 20;
    if (r.phone) score += 15;
    if (r.service) score += 10;
    return {
      sourceTable: "bookings",
      sourceId: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      threadId: null,
      language: null,
      segment: "post_booking",
      score: Math.min(100, score),
      reason: `Had a ${r.service} appointment on ${r.date}. Time to rebook or leave a review!`,
      lastContactDate: r.createdAt,
      service: r.service,
      createdAt: r.createdAt,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. NEWSLETTER subscribers — never bought or booked
// ─────────────────────────────────────────────────────────────────────────────

export async function getNewsletterLeads(opts?: {
  daysSince?: number;
  limit?: number;
}): Promise<SegmentedLead[]> {
  const daysSince = opts?.daysSince ?? 1;
  const since = new Date(Date.now() - daysSince * 86_400_000);

  const rows = await db
    .select()
    .from(submissionsTable)
    .where(
      and(
        eq(submissionsTable.source, "newsletter"),
        isNull(submissionsTable.followupSentAt),
        gt(submissionsTable.createdAt, since),
      ),
    )
    .orderBy(desc(submissionsTable.createdAt))
    .limit(opts?.limit ?? 500);

  return rows.map((r) => ({
    sourceTable: "submissions",
    sourceId: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    threadId: null,
    language: r.language,
    segment: "newsletter",
    score: r.email ? 40 : 10,
    reason: `Subscribed to newsletter on ${r.createdAt.toDateString()} but never booked or purchased.`,
    lastContactDate: r.createdAt,
    createdAt: r.createdAt,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. ABANDONED CART — orders never completed
// ─────────────────────────────────────────────────────────────────────────────

export async function getAbandonedCartLeads(opts?: {
  daysSince?: number;
  maxDays?: number;
  limit?: number;
}): Promise<SegmentedLead[]> {
  const daysSince = opts?.daysSince ?? 1;
  const maxDays = opts?.maxDays ?? 14;
  const since = new Date(Date.now() - maxDays * 86_400_000);
  const until = new Date(Date.now() - daysSince * 86_400_000);

  const rows = await db
    .select()
    .from(ordersTable)
    .where(
      and(
        or(eq(ordersTable.status, "pending"), eq(ordersTable.status, "new")),
        gt(ordersTable.createdAt, since),
        lt(ordersTable.createdAt, until),
      ),
    )
    .orderBy(desc(ordersTable.createdAt))
    .limit(opts?.limit ?? 500);

  return rows.map((r) => {
    let score = 60;
    if (r.total > 3000) score += 15;
    if (r.email) score += 15;
    if (r.phone) score += 10;
    return {
      sourceTable: "orders",
      sourceId: r.id,
      name: r.customerName,
      email: r.email,
      phone: r.phone,
      threadId: null,
      language: r.language,
      segment: "abandoned_cart",
      score: Math.min(100, score),
      reason: `Started an order worth EGP ${r.total} on ${r.createdAt.toDateString()} but never completed checkout.`,
      lastContactDate: r.createdAt,
      createdAt: r.createdAt,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Deduplicate across segments: if a lead appears in multiple tables,
// keep only the highest-scored instance.
// ─────────────────────────────────────────────────────────────────────────────

export function deduplicateLeads(leads: SegmentedLead[]): SegmentedLead[] {
  const byPhone = new Map<string, SegmentedLead>();
  const byEmail = new Map<string, SegmentedLead>();

  for (const lead of leads) {
    const key = lead.phone || lead.email;
    if (!key) {
      // Can't dedup — keep it
      continue;
    }
    const map = lead.phone ? byPhone : byEmail;
    const existing = map.get(key);
    if (!existing || lead.score > existing.score) {
      map.set(key, lead);
    }
  }

  return Array.from(new Set([...byPhone.values(), ...byEmail.values()]));
}

// ─────────────────────────────────────────────────────────────────────────────
// Master segment builder — runs all segments and returns a merged list.
// ─────────────────────────────────────────────────────────────────────────────

export async function buildLeadPool(
  segments: LeadSegment[],
  opts?: { limitPerSegment?: number; daysSince?: number },
): Promise<SegmentedLead[]> {
  const all: SegmentedLead[] = [];
  const limit = opts?.limitPerSegment ?? 500;
  const days = opts?.daysSince;

  for (const seg of segments) {
    try {
      switch (seg) {
        case "no_booking":
          all.push(...await getNoBookingLeads({ limit, daysSince: days }));
          break;
        case "lucky_spin":
          all.push(...await getLuckySpinLeads({ limit, daysSince: days }));
          break;
        case "warm_dm":
          all.push(...await getWarmDmLeads({ limit, daysSince: days }));
          break;
        case "post_booking":
          all.push(...await getPostBookingLeads({ limit, daysSince: days }));
          break;
        case "newsletter":
          all.push(...await getNewsletterLeads({ limit, daysSince: days }));
          break;
        case "abandoned_cart":
          all.push(...await getAbandonedCartLeads({ limit, daysSince: days }));
          break;
      }
    } catch (err) {
      console.error(`[lead-segmentation] segment ${seg} failed:`, err);
    }
  }

  return deduplicateLeads(all).sort((a, b) => b.score - a.score);
}

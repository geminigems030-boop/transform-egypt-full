// ─────────────────────────────────────────────────────────────────────────────
// Branches — DB-backed salon locations.
//
//   ensureBranchesTable()        — idempotent CREATE TABLE IF NOT EXISTS
//   seedBranchesIfEmpty()        — seed the canonical 6 branches once
//   getBranches() / getOpenBranches() — cached reads (60s)
//   buildBranchesPromptSection() — open/closed enumeration for Yara's prompts
//
// Because branches live in the DB, the website + Yara read live status, and the
// Google Sheet → /api/webhooks/content-update flow can flip a branch open/closed
// (e.g. reopen CFCM) without a redeploy.
// ─────────────────────────────────────────────────────────────────────────────

import { db } from "@workspace/db";
import { branchesTable } from "@workspace/db/schema";
import { asc, sql } from "drizzle-orm";
import { logger } from "./logger";

let tableReady = false;

export async function ensureBranchesTable(): Promise<void> {
  if (tableReady) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS branches (
      id serial PRIMARY KEY,
      name text NOT NULL,
      name_ar text,
      city text,
      city_ar text,
      address text,
      address_ar text,
      detail text,
      detail_ar text,
      phone text,
      map_url text,
      status text NOT NULL DEFAULT 'open',
      closure_reason text,
      closure_reason_ar text,
      hours text,
      is_premium boolean NOT NULL DEFAULT false,
      lat numeric(9,6),
      lng numeric(9,6),
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);
  tableReady = true;
}

type SeedBranch = typeof branchesTable.$inferInsert;

const SEED: SeedBranch[] = [
  {
    name: "City Stars Mall", nameAr: "سيتي ستارز مول",
    city: "Nasr City", cityAr: "مدينة نصر",
    address: "City Stars Mall, Ground Floor — Gate 7", addressAr: "سيتي ستارز مول، الدور الأرضي — بوابة ٧",
    detail: "Next to Cafe Supreme. Ample mall parking.", detailAr: "بجانب كافيه سوبريم. مواقف متوفرة.",
    phone: "01009780008", mapUrl: "https://www.google.com/maps/search/Transform+Egypt+City+Stars+Mall+Cairo",
    status: "open", hours: "Daily from 12:00 noon", isPremium: false,
    lat: "30.072800", lng: "31.346300", sortOrder: 1,
  },
  {
    name: "Cairo Festival City Mall", nameAr: "كايرو فيستيفال سيتي مول",
    city: "New Cairo", cityAr: "القاهرة الجديدة",
    address: "Cairo Festival City Mall, 3rd Floor", addressAr: "كايرو فيستيفال سيتي مول، الدور الثالث",
    detail: "Next to Casper. Valet parking available.", detailAr: "بجانب كاسبر. خدمة فاليه متوفرة.",
    phone: "01009780008", mapUrl: "https://www.google.com/maps/search/Transform+Egypt+Cairo+Festival+City+Mall",
    status: "open", hours: "Daily during mall hours", isPremium: true,
    lat: "30.028700", lng: "31.407600", sortOrder: 2,
  },
  {
    name: "Sofitel Downtown Cairo", nameAr: "سوفيتيل داون تاون القاهرة",
    city: "Downtown", cityAr: "وسط البلد",
    address: "Sofitel Downtown Cairo, Lower Level", addressAr: "سوفيتيل داون تاون القاهرة، الدور السفلي",
    detail: "Next to Banque Misr. Hotel valet on arrival.", detailAr: "بجانب بنك مصر. فاليه الفندق عند الوصول.",
    phone: "01004545700", mapUrl: "https://www.google.com/maps/search/Transform+Egypt+Sofitel+Downtown+Cairo",
    status: "open", hours: "Daily from 12:00 noon", isPremium: false,
    lat: "30.044400", lng: "31.235700", sortOrder: 3,
  },
  {
    name: "The Nile Ritz-Carlton", nameAr: "ذا نايل ريتز كارلتون",
    city: "Garden City", cityAr: "جاردن سيتي",
    address: "The Nile Ritz-Carlton, 1st Floor above lobby", addressAr: "ذا نايل ريتز كارلتون، الدور الأول فوق اللوبي",
    phone: "01004545700", mapUrl: "https://www.google.com/maps/search/Transform+Egypt+Nile+Ritz+Carlton+Cairo",
    status: "closed",
    closureReason: "Temporarily closed for renovation. Reopening soon — please book a nearby branch.",
    closureReasonAr: "مغلق مؤقتاً للتجديد. سيُعاد الافتتاح قريباً — يرجى الحجز في فرع قريب.",
    sortOrder: 4,
  },
  {
    name: "Walk of Cairo", nameAr: "ووك أوف كايرو",
    city: "Sheikh Zayed", cityAr: "الشيخ زايد",
    address: "Walk of Cairo, Open-Air Promenade — Ground floor", addressAr: "ووك أوف كايرو، البروميناد المفتوح — الدور الأرضي",
    phone: "01009780008", mapUrl: "https://www.google.com/maps/search/Transform+Egypt+Walk+of+Cairo",
    status: "closed",
    closureReason: "Temporarily closed for construction. Reopening soon — please book a nearby branch.",
    closureReasonAr: "مغلق مؤقتاً بسبب أعمال الإنشاءات. سيُعاد الافتتاح قريباً — يرجى الحجز في فرع قريب.",
    sortOrder: 5,
  },
  {
    name: "O Mall — New Alamein", nameAr: "أوه مول — العلمين الجديدة",
    city: "North Coast", cityAr: "الساحل الشمالي",
    address: "O Mall, New Alamein — Mediterranean coast", addressAr: "أوه مول، العلمين الجديدة — الساحل المتوسطي",
    phone: "01009780008", mapUrl: "https://www.google.com/maps/search/Transform+Egypt+O+Mall+New+Alamein",
    status: "closed",
    closureReason: "Seasonal branch — currently closed. We're in Cairo only right now.",
    closureReasonAr: "فرع موسمي — مقفول حالياً. إحنا في القاهرة بس دلوقتي.",
    sortOrder: 6,
  },
];

export async function seedBranchesIfEmpty(): Promise<void> {
  try {
    await ensureBranchesTable();
    await db.transaction(async (tx) => {
      // Serialize concurrent boots so we don't double-seed.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(81234570)`);
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(branchesTable);
      if (count > 0) return;
      await tx.insert(branchesTable).values(SEED);
      logger.info({ inserted: SEED.length }, "branches: seeded canonical branches");
    });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "branches: seed failed (non-fatal)");
  }
}

export type BranchRow = typeof branchesTable.$inferSelect;

interface Cache { rows: BranchRow[]; expiresAt: number }
let _cache: Cache | null = null;

export async function getBranches(force = false): Promise<BranchRow[]> {
  if (!force && _cache && Date.now() < _cache.expiresAt) return _cache.rows;
  await ensureBranchesTable();
  const rows = await db.select().from(branchesTable).orderBy(asc(branchesTable.sortOrder), asc(branchesTable.id));
  _cache = { rows, expiresAt: Date.now() + 60_000 };
  return rows;
}

export function invalidateBranchesCache(): void {
  _cache = null;
}

export async function getOpenBranches(): Promise<BranchRow[]> {
  return (await getBranches()).filter((b) => b.status === "open");
}

/**
 * Open/closed enumeration for Yara's system prompts. Rules/prose stay in the
 * prompt; this provides only the live factual list so reopening CFCM (etc.) in
 * the DB instantly changes what Yara offers. Falls back to "" on error so the
 * surrounding prompt's static guidance still applies.
 */
export async function buildBranchesPromptSection(): Promise<string> {
  let rows: BranchRow[] = [];
  try {
    rows = await getBranches();
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "branches: prompt fetch failed");
    return "";
  }
  if (rows.length === 0) return "";

  const open = rows.filter((b) => b.status === "open");
  const closed = rows.filter((b) => b.status !== "open");

  const lines: string[] = ["BRANCHES — CURRENTLY OPEN (only offer these for bookings):"];
  for (const b of open) {
    const premium = b.isPremium ? " PREMIUM branch." : "";
    const hours = b.hours ? ` ${b.hours}.` : "";
    const addr = b.address ? ` — ${b.address}` : "";
    lines.push(`- ${b.name}${b.city ? `, ${b.city}` : ""}${addr}.${premium}${hours}`);
    if (b.mapUrl) lines.push(`  Google Maps: ${b.mapUrl}`);
  }
  if (closed.length > 0) {
    lines.push("");
    lines.push("TEMPORARILY CLOSED — do NOT offer these for bookings:");
    for (const b of closed) lines.push(`- ${b.name}${b.city ? `, ${b.city}` : ""}`);
  }
  return lines.join("\n");
}

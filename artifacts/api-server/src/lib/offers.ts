// ─────────────────────────────────────────────────────────────────────────────
// Dynamic Offers — shared helpers for the promotions engine.
//
//   ensureOffersTable()        — idempotent CREATE TABLE IF NOT EXISTS at boot
//   getActiveOffers()          — active offers, sorted (cached 60s)
//   buildOffersPromptSection() — formats active offers for Yara's system prompt
// ─────────────────────────────────────────────────────────────────────────────

import { db } from "@workspace/db";
import { offersTable } from "@workspace/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import { logger } from "./logger";

let tableReady = false;

export async function ensureOffersTable(): Promise<void> {
  if (tableReady) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS offers (
      id serial PRIMARY KEY,
      title text NOT NULL,
      title_ar text,
      description text,
      description_ar text,
      active boolean NOT NULL DEFAULT true,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);
  tableReady = true;
}

export type OfferRow = typeof offersTable.$inferSelect;

interface OffersCache {
  rows: OfferRow[];
  expiresAt: number;
}
let _cache: OffersCache | null = null;

/** Active offers, newest sort_order first. Cached for 60s. */
export async function getActiveOffers(force = false): Promise<OfferRow[]> {
  if (!force && _cache && Date.now() < _cache.expiresAt) return _cache.rows;
  await ensureOffersTable();
  const rows = await db
    .select()
    .from(offersTable)
    .where(eq(offersTable.active, true))
    .orderBy(asc(offersTable.sortOrder), asc(offersTable.id));
  _cache = { rows, expiresAt: Date.now() + 60_000 };
  return rows;
}

/** Invalidate the cache after an admin write so changes show up immediately. */
export function invalidateOffersCache(): void {
  _cache = null;
}

/**
 * Builds the OFFERS section for Yara's system prompt. When offers exist, Yara is
 * allowed (and encouraged) to mention exactly these; when none exist she falls
 * back to the strict "no invented offers" rule.
 */
export async function buildOffersPromptSection(): Promise<string> {
  let rows: OfferRow[] = [];
  try {
    rows = await getActiveOffers();
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "offers: prompt fetch failed; using no-offers rule");
  }

  if (rows.length === 0) {
    return [
      "OFFERS / PROMOTIONS — STRICT RULE:",
      "There are NO active offers right now. NEVER invent, imply, or hint at any offer, discount, deal, or special price.",
      "If asked 'فيه عروض؟' / 'any offers?': reply honestly — اسعارنا ثابتة يا فندم، مفيش عروض حالياً، بس ممكن أساعدك تختاري الأنسب ليكِ 💛",
    ].join("\n");
  }

  const lines = rows.map((o) => {
    const ar = o.titleAr ? ` (${o.titleAr})` : "";
    const desc = o.description ? ` — ${o.description}` : "";
    return `- ${o.title}${ar}${desc}`;
  });

  return [
    "ACTIVE OFFERS / PROMOTIONS — you MAY mention these (and ONLY these):",
    "Quote ONLY the offers listed below exactly as written. Do NOT invent any other discount or deal.",
    ...lines,
    "When a customer asks about offers, share the most relevant one warmly. Never promise an offer that isn't in this list.",
  ].join("\n");
}

// Used by extractActiveOffersForChat (website widget) — a compact bilingual blob.
export function formatOffersForChat(rows: OfferRow[]): string {
  if (rows.length === 0) return "";
  const lines = rows.map((o) => {
    const ar = o.titleAr ? ` / ${o.titleAr}` : "";
    const desc = o.description ? ` — ${o.description}` : "";
    return `- ${o.title}${ar}${desc}`;
  });
  return ["CURRENT ACTIVE OFFERS (mention only these, never invent):", ...lines].join("\n");
}

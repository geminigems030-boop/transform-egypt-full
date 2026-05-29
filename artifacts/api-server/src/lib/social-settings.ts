// ─────────────────────────────────────────────────────────────────────────────
// Social AI settings — DB-backed persistence for the per-channel auto-reply
// modes (Instagram / Facebook / TikTok DMs + post comments).
//
// The modes are mirrored into the in-memory cache in lib/ai-reply.ts so the
// inbound webhook hot path can read them synchronously via getMode(). This
// module owns:
//   - ensureSocialSettingsTable() — idempotent CREATE TABLE IF NOT EXISTS so the
//     table is present in production even if the schema migration flow only
//     migrates pre-existing tables (mirrors the seed-products boot pattern).
//   - refreshModesFromDb()        — load persisted modes into the cache at boot.
//   - setMode()                   — persist a mode change + update the cache.
// ─────────────────────────────────────────────────────────────────────────────

import { db } from "@workspace/db";
import { socialSettingsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";
import { type AIMode, getMode, parseMode, setModeCache } from "./ai-reply";

let tableReady = false;

/** Create the social_settings table if it doesn't exist yet. Idempotent. */
export async function ensureSocialSettingsTable(): Promise<void> {
  if (tableReady) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS social_settings (
      id serial PRIMARY KEY,
      ai_reply_mode_dms text NOT NULL DEFAULT 'suggest',
      ai_reply_mode_comments text NOT NULL DEFAULT 'suggest',
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);
  tableReady = true;
}

/**
 * Return the single settings row, creating it on first call. The first row is
 * seeded from the current effective (env-derived) modes so the admin panel
 * reflects whatever was already live before this table existed.
 */
export async function getOrCreateSocialSettings() {
  await ensureSocialSettingsTable();
  const [row] = await db.select().from(socialSettingsTable).limit(1);
  if (row) return row;
  const [created] = await db
    .insert(socialSettingsTable)
    .values({
      aiReplyModeDms: getMode("dms"),
      aiReplyModeComments: getMode("comments"),
    })
    .returning();
  return created!;
}

/** Load persisted modes into the in-memory cache. Non-fatal — keeps env defaults on error. */
export async function refreshModesFromDb(): Promise<void> {
  try {
    const row = await getOrCreateSocialSettings();
    setModeCache("dms", parseMode(row.aiReplyModeDms));
    setModeCache("comments", parseMode(row.aiReplyModeComments));
    logger.info(
      { dms: getMode("dms"), comments: getMode("comments") },
      "social-settings: AI reply modes loaded from DB",
    );
  } catch (err) {
    logger.warn(
      { err: (err as Error).message },
      "social-settings: could not load modes from DB; using env defaults",
    );
  }
}

/** Persist a mode change for one channel and update the in-memory cache. */
export async function setMode(
  channel: "dms" | "comments",
  mode: AIMode,
): Promise<void> {
  const settings = await getOrCreateSocialSettings();
  const updates =
    channel === "dms"
      ? { aiReplyModeDms: mode, updatedAt: new Date() }
      : { aiReplyModeComments: mode, updatedAt: new Date() };
  await db
    .update(socialSettingsTable)
    .set(updates)
    .where(eq(socialSettingsTable.id, settings.id));
  setModeCache(channel, mode);
}

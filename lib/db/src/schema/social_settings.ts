import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// Single-row table holding the runtime-mutable AI auto-reply modes for the
// social channels (Instagram / Facebook / TikTok DMs + post comments).
// Lets the admin Social AI panel flip modes without a redeploy. Seeded from the
// AI_REPLY_MODE_DMS / AI_REPLY_MODE_COMMENTS env vars on first run so existing
// behaviour is preserved. Values: "off" | "suggest" | "auto".
export const socialSettingsTable = pgTable("social_settings", {
  id: serial("id").primaryKey(),
  aiReplyModeDms: text("ai_reply_mode_dms").notNull().default("suggest"),
  aiReplyModeComments: text("ai_reply_mode_comments").notNull().default("suggest"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type SocialSettings = typeof socialSettingsTable.$inferSelect;

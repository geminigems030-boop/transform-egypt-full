import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

export const automationSettingsTable = pgTable("automation_settings", {
  id: serial("id").primaryKey(),
  enabled24h: boolean("enabled_24h").notNull().default(true),
  enabled2h: boolean("enabled_2h").notNull().default(true),
  enabledFollowup: boolean("enabled_followup").notNull().default(true),
  enabledReengagement: boolean("enabled_reengagement").notNull().default(true),
  reengagementWindowDays: integer("reengagement_window_days").notNull().default(60),
  reengagementCooldownDays: integer("reengagement_cooldown_days").notNull().default(30),
  branchReviewLinks: jsonb("branch_review_links").default("{}"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AutomationSettings = typeof automationSettingsTable.$inferSelect;

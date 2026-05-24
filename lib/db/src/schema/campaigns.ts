import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean,
  index,
} from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────────────────────────────────────
// Cold/Warm Lead Re-engagement Campaigns
//
// Tracks automated outreach campaigns run by Yara AI against historical
// leads who never converted. Supports email (via Resend) and DM (via ManyChat).
// ─────────────────────────────────────────────────────────────────────────────

export const campaignsTable = pgTable(
  "campaigns",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    // channel: 'email' | 'dm' | 'both'
    channel: text("channel").notNull().default("email"),
    // segment: 'no_booking' | 'lucky_spin' | 'abandoned_cart' | 'warm_dm' | 'post_booking' | 'newsletter'
    segment: text("segment").notNull(),
    status: text("status").notNull().default("draft"), // draft | scheduled | running | completed | paused | cancelled
    // AI prompt template used to generate personalized copy
    aiPromptTemplate: text("ai_prompt_template"),
    // Scheduling
    scheduledAt: timestamp("scheduled_at"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    // Targeting filter (JSON string)
    filterJson: text("filter_json"),
    // Stats
    totalLeads: integer("total_leads").notNull().default(0),
    sentCount: integer("sent_count").notNull().default(0),
    openedCount: integer("opened_count").notNull().default(0),
    clickedCount: integer("clicked_count").notNull().default(0),
    convertedCount: integer("converted_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    createdBy: text("created_by"),
  },
  (t) => ({
    statusIdx: index("campaigns_status_idx").on(t.status),
    segmentIdx: index("campaigns_segment_idx").on(t.segment),
    scheduledIdx: index("campaigns_scheduled_idx").on(t.scheduledAt),
  }),
);

// Per-lead campaign delivery tracking
export const campaignLeadsTable = pgTable(
  "campaign_leads",
  {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id").notNull(),
    // Source table + record id
    sourceTable: text("source_table").notNull(), // 'submissions' | 'lucky_spins' | 'bookings' | 'orders' | 'instagram_messages'
    sourceId: integer("source_id").notNull(),
    // Contact info at time of send
    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    threadId: text("thread_id"), // for DM sends
    // AI-generated personalized copy
    personalizedSubject: text("personalized_subject"),
    personalizedBody: text("personalized_body"),
    personalizedDm: text("personalized_dm"),
    // Delivery status
    status: text("status").notNull().default("pending"), // pending | sent | opened | clicked | converted | bounced | failed | skipped
    channel: text("channel").notNull().default("email"), // email | dm
    // Timestamps
    sentAt: timestamp("sent_at"),
    openedAt: timestamp("opened_at"),
    clickedAt: timestamp("clicked_at"),
    convertedAt: timestamp("converted_at"),
    // Error tracking
    errorMessage: text("error_message"),
    // Lead score (0-100) at time of selection
    leadScore: integer("lead_score").notNull().default(0),
    // Whether this was opted-out / unsubscribed
    unsubscribed: boolean("unsubscribed").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    campaignIdx: index("campaign_leads_campaign_idx").on(t.campaignId),
    statusIdx: index("campaign_leads_status_idx").on(t.status),
    sourceIdx: index("campaign_leads_source_idx").on(t.sourceTable, t.sourceId),
  }),
);

export type Campaign = typeof campaignsTable.$inferSelect;
export type InsertCampaign = typeof campaignsTable.$inferInsert;
export type CampaignLead = typeof campaignLeadsTable.$inferSelect;
export type InsertCampaignLead = typeof campaignLeadsTable.$inferInsert;

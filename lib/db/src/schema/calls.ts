import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────────────────────────────────────
// Yara Voice — ElevenLabs + Twilio phone system
//
// yara_calls      — every inbound/outbound/campaign call Yara handles
// call_campaigns  — cold-calling campaign definitions
// campaign_contacts — per-contact state within a cold-calling campaign
// ─────────────────────────────────────────────────────────────────────────────

export const yaraCallsTable = pgTable(
  "yara_calls",
  {
    id: serial("id").primaryKey(),
    // E.164 caller/callee number
    phone: text("phone").notNull(),
    // direction: 'inbound' | 'outbound' | 'campaign'
    direction: text("direction").notNull(),
    // Campaign reference (null for ad-hoc calls)
    campaignId: integer("campaign_id"),
    // Twilio call SID (set when available)
    twilioCallSid: text("twilio_call_sid").unique(),
    // ElevenLabs conversation ID
    elevenLabsConvId: text("elevenlabs_conv_id"),
    // Status: ringing | in-progress | completed | no-answer | busy | failed | voicemail
    status: text("status").notNull().default("ringing"),
    // Duration in seconds
    duration: integer("duration"),
    // Detected language: 'ar' | 'en'
    language: text("language"),
    // Full JSON transcript from ElevenLabs post-call webhook
    transcript: text("transcript"),
    // AI-generated summary of the call
    summary: text("summary"),
    // Booking intent detected: null | 'captured' | 'none'
    bookingIntent: text("booking_intent"),
    // Submission ID if Yara created a booking from this call
    submissionId: integer("submission_id"),
    // Lead context injected into Yara's opening (for outbound follow-ups)
    leadContext: text("lead_context"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    phoneIdx: index("yara_calls_phone_idx").on(t.phone),
    directionIdx: index("yara_calls_direction_idx").on(t.direction),
    statusIdx: index("yara_calls_status_idx").on(t.status),
    campaignIdx: index("yara_calls_campaign_idx").on(t.campaignId),
    createdIdx: index("yara_calls_created_idx").on(t.createdAt),
  }),
);

export const callCampaignsTable = pgTable(
  "call_campaigns",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    // Admin-written pitch goal, passed to Yara as context
    pitchGoal: text("pitch_goal").notNull(),
    // status: draft | active | paused | completed | cancelled
    status: text("status").notNull().default("draft"),
    // Max calls Yara makes per day across all contacts in this campaign
    callLimitPerDay: integer("call_limit_per_day").notNull().default(20),
    // Stats
    totalContacts: integer("total_contacts").notNull().default(0),
    calledCount: integer("called_count").notNull().default(0),
    answeredCount: integer("answered_count").notNull().default(0),
    interestedCount: integer("interested_count").notNull().default(0),
    bookedCount: integer("booked_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index("call_campaigns_status_idx").on(t.status),
  }),
);

export const campaignContactsTable = pgTable(
  "campaign_contacts",
  {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id").notNull(),
    phone: text("phone").notNull(),
    name: text("name"),
    // outcome: pending | calling | answered | no-answer | voicemail | interested | booked | not-interested | callback-requested | failed
    status: text("status").notNull().default("pending"),
    // Reference to the actual call record
    callId: integer("call_id"),
    // Attempt count
    attempts: integer("attempts").notNull().default(0),
    // Scheduled callback time if customer requested it
    callbackAt: timestamp("callback_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    campaignIdx: index("campaign_contacts_campaign_idx").on(t.campaignId),
    statusIdx: index("campaign_contacts_status_idx").on(t.status),
    phoneIdx: index("campaign_contacts_phone_idx").on(t.phone),
  }),
);

export type YaraCall = typeof yaraCallsTable.$inferSelect;
export type InsertYaraCall = typeof yaraCallsTable.$inferInsert;
export type CallCampaign = typeof callCampaignsTable.$inferSelect;
export type InsertCallCampaign = typeof callCampaignsTable.$inferInsert;
export type CampaignContact = typeof campaignContactsTable.$inferSelect;
export type InsertCampaignContact = typeof campaignContactsTable.$inferInsert;

import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────────────────────────────────────
// Instagram + Facebook inbox storage.
//
// Populated by Meta webhook POSTs to /api/webhooks/meta:
//   - object=instagram, entry[].messaging[]  → instagram_messages (DMs)
//   - object=instagram, entry[].changes[].field=comments → instagram_comments
//   - object=page,      entry[].messaging[]  → instagram_messages (FB DMs)
//   - object=page,      entry[].changes[].field=feed → instagram_comments
//   - object=page,      entry[].changes[].field=leadgen → submissions table
//
// Outbound replies sent from /admin Inbox are also stored here with
// direction='outbound' (messages) or repliedAt set (comments) so the inbox
// shows full conversation history.
// ─────────────────────────────────────────────────────────────────────────────

export const instagramMessagesTable = pgTable(
  "instagram_messages",
  {
    id: serial("id").primaryKey(),
    // Meta-side message id (mid) — stable for inbound; for outbound we use the
    // returned message_id or an `out_<ts>` synthetic id. Unique constraint
    // lets us dedup webhook retries via ON CONFLICT DO NOTHING.
    metaMessageId: text("meta_message_id").notNull().unique(),
    // Conversation key. For IG/FB DMs this is the other party's PSID/IGSID.
    threadId: text("thread_id").notNull(),
    threadPlatform: text("thread_platform").notNull().default("instagram"), // 'instagram' | 'facebook'
    senderId: text("sender_id").notNull(),
    senderUsername: text("sender_username"),
    direction: text("direction").notNull(), // 'inbound' | 'outbound'
    text: text("text"),
    attachmentUrl: text("attachment_url"),
    attachmentType: text("attachment_type"), // image|video|audio|file|share|story_mention
    isRead: boolean("is_read").notNull().default(false),
    repliedAt: timestamp("replied_at"),
    receivedAt: timestamp("received_at").notNull().defaultNow(),
    // AI auto-reply layer (Replymind brain).
    // aiDraftStatus: 'pending' (awaiting admin) | 'sent' (admin approved & sent)
    //              | 'dismissed' (admin rejected) | 'auto_sent' (sent without review)
    //              | null (no draft generated yet)
    aiDraft: text("ai_draft"),
    aiDraftStatus: text("ai_draft_status"),
    aiGeneratedAt: timestamp("ai_generated_at"),
    aiEscalated: boolean("ai_escalated").notNull().default(false),
  },
  (t) => ({
    threadIdx: index("ig_msgs_thread_idx").on(t.threadId),
    receivedIdx: index("ig_msgs_received_idx").on(t.receivedAt),
  }),
);

export const instagramCommentsTable = pgTable(
  "instagram_comments",
  {
    id: serial("id").primaryKey(),
    // For IG comments this is the raw Meta comment id. For FB Page comments
    // we prefix with "fb_" so the same row supports replies on both surfaces.
    metaCommentId: text("meta_comment_id").notNull().unique(),
    platform: text("platform").notNull().default("instagram"), // 'instagram' | 'facebook'
    parentMediaId: text("parent_media_id").notNull(),
    parentMediaPermalink: text("parent_media_permalink"),
    parentCommentId: text("parent_comment_id"), // null = top-level comment
    fromUserId: text("from_user_id").notNull(),
    fromUsername: text("from_username"),
    text: text("text").notNull(),
    isRead: boolean("is_read").notNull().default(false),
    repliedAt: timestamp("replied_at"),
    receivedAt: timestamp("received_at").notNull().defaultNow(),
    // AI auto-reply layer — see instagram_messages.ai* for status meanings.
    aiDraft: text("ai_draft"),
    aiDraftStatus: text("ai_draft_status"),
    aiGeneratedAt: timestamp("ai_generated_at"),
    aiEscalated: boolean("ai_escalated").notNull().default(false),
  },
  (t) => ({
    mediaIdx: index("ig_cmts_media_idx").on(t.parentMediaId),
    receivedIdx: index("ig_cmts_received_idx").on(t.receivedAt),
  }),
);

export type InstagramMessage = typeof instagramMessagesTable.$inferSelect;
export type InsertInstagramMessage = typeof instagramMessagesTable.$inferInsert;
export type InstagramComment = typeof instagramCommentsTable.$inferSelect;
export type InsertInstagramComment = typeof instagramCommentsTable.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// Replymind "Memory mode" — exemplar pairs of (customer message, our reply)
// harvested from historical IG/FB conversations via the Meta Graph API. At
// generation time we retrieve the top-K exemplars by keyword overlap with the
// new inbound message and inject them into the system prompt as few-shot
// examples so the model mimics the team's actual tone, length, and style.
//
// Populated by:
//   - POST /api/admin/inbox/backfill-exemplars (manual backfill, pulls last
//     N days from /PAGE_ID/conversations on both `instagram` and `messenger`
//     platforms; templated outbound replies appearing 3+ times are skipped).
//   - (future) outbound rows we send ourselves can be auto-promoted here.
// ─────────────────────────────────────────────────────────────────────────────
export const inboxExemplarsTable = pgTable(
  "inbox_exemplars",
  {
    id: serial("id").primaryKey(),
    channel: text("channel").notNull(), // 'dm' | 'comment'
    language: text("language").notNull(), // 'ar' | 'en'
    inboundText: text("inbound_text").notNull(),
    outboundText: text("outbound_text").notNull(),
    // Outbound message id from Meta (or synthetic key for non-Meta sources).
    // Unique → backfill is idempotent (re-runs ON CONFLICT DO NOTHING).
    sourceMetaId: text("source_meta_id").notNull().unique(),
    sourcePlatform: text("source_platform").notNull().default("instagram"), // 'instagram' | 'facebook'
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    channelLangIdx: index("exemplars_channel_lang_idx").on(
      t.channel,
      t.language,
    ),
  }),
);

export type InboxExemplar = typeof inboxExemplarsTable.$inferSelect;
export type InsertInboxExemplar = typeof inboxExemplarsTable.$inferInsert;

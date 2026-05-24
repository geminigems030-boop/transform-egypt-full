import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";

// Unified capture for ALL contact / lead forms across the site.
// Sources: book, consultation, giftcard, contact, boutique, newsletter, manual.
// Lucky-funnel spins live in their own table (lucky_spins) and are NOT
// duplicated here.
export const submissionsTable = pgTable(
  "submissions",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull(),
    name: text("name"),
    phone: text("phone"),
    email: text("email"),
    branch: text("branch"),
    service: text("service"),
    message: text("message"),
    language: text("language"),
    status: text("status").notNull().default("new"),
    loggedBy: text("logged_by"),
    // Meta Lead Ads leadgen id — UNIQUE so webhook retries dedup via
    // ON CONFLICT DO NOTHING. Null for non-Meta sources (book/contact/etc).
    leadgenId: text("leadgen_id").unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    followupSentAt: timestamp("followup_sent_at"),
  },
  (t) => ({
    // Used for default ORDER BY createdAt DESC and date-range filtering.
    createdIdx: index("submissions_created_idx").on(t.createdAt),
    // Used by source filter + grouped source counts on the admin dashboard.
    sourceIdx: index("submissions_source_idx").on(t.source),
    // Used by status filter on the admin dashboard.
    statusIdx: index("submissions_status_idx").on(t.status),
    // NOTE: no per-column index on phone/email/name — admin search uses
    // case-insensitive %substring% ILIKE which won't use a btree anyway. If
    // future search volume grows, add a pg_trgm GIN index instead.
  }),
);

export type Submission = typeof submissionsTable.$inferSelect;
export type InsertSubmission = typeof submissionsTable.$inferInsert;

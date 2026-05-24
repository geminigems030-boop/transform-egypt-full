import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  numeric,
  index,
  unique,
} from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────────────────────────────────────
// Client CRM — every client who has ever booked or been imported.
// Phone is the canonical identifier; matched in E.164 format when possible.
// ─────────────────────────────────────────────────────────────────────────────

export const clientsTable = pgTable(
  "clients",
  {
    id: serial("id").primaryKey(),
    name: text("name"),
    phone: text("phone").notNull(),
    email: text("email"),
    preferredBranch: text("preferred_branch"),
    notes: text("notes"),
    firstVisit: timestamp("first_visit"),
    lastVisit: timestamp("last_visit"),
    // Aggregated from appointments table (updated on each completed appointment)
    totalSpend: numeric("total_spend", { precision: 10, scale: 2 }).notNull().default("0"),
    visitCount: integer("visit_count").notNull().default(0),
    reengagementSentAt: timestamp("reengagement_sent_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    phoneIdx: index("clients_phone_idx").on(t.phone),
    phoneUnique: unique("clients_phone_unique").on(t.phone),
    nameIdx: index("clients_name_idx").on(t.name),
    lastVisitIdx: index("clients_last_visit_idx").on(t.lastVisit),
  }),
);

export type Client = typeof clientsTable.$inferSelect;
export type InsertClient = typeof clientsTable.$inferInsert;

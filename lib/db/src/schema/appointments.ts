import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

// ─────────────────────────────────────────────────────────────────────────────
// Appointments — structured appointment system with Yara action support.
//
// Status flow: scheduled → confirmed → completed
//                       ↘ rescheduled (creates new appointment or updates time)
//                       ↘ cancelled
// ─────────────────────────────────────────────────────────────────────────────

export const appointmentsTable = pgTable(
  "appointments",
  {
    id: serial("id").primaryKey(),
    // FK to clients.id — enforced at DB level; new clients are created on import
    clientId: integer("client_id")
      .notNull()
      .references(() => clientsTable.id, { onDelete: "cascade" }),
    // Denormalised client fields for quick display without join
    clientName: text("client_name"),
    clientPhone: text("client_phone").notNull(),
    // Service / booking details
    service: text("service").notNull(),
    branch: text("branch"),
    stylist: text("stylist"),
    scheduledAt: timestamp("scheduled_at").notNull(),
    durationMinutes: integer("duration_minutes"),
    price: numeric("price", { precision: 10, scale: 2 }),
    // Status: scheduled | confirmed | completed | cancelled | rescheduled
    status: text("status").notNull().default("scheduled"),
    // Timestamps for each status change
    confirmedAt: timestamp("confirmed_at"),
    completedAt: timestamp("completed_at"),
    cancelledAt: timestamp("cancelled_at"),
    // WhatsApp reminder timestamps
    reminder24hSentAt: timestamp("reminder_24h_sent_at"),
    reminder2hSentAt: timestamp("reminder_2h_sent_at"),
    // Post-visit follow-up
    followupSentAt: timestamp("followup_sent_at"),
    notes: text("notes"),
    // Tracks who created the record: 'upload' | 'admin' | 'yara' | 'webhook'
    source: text("source").notNull().default("admin"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    clientIdIdx: index("appointments_client_id_idx").on(t.clientId),
    scheduledAtIdx: index("appointments_scheduled_at_idx").on(t.scheduledAt),
    statusIdx: index("appointments_status_idx").on(t.status),
    branchIdx: index("appointments_branch_idx").on(t.branch),
    clientPhoneIdx: index("appointments_client_phone_idx").on(t.clientPhone),
  }),
);

export type Appointment = typeof appointmentsTable.$inferSelect;
export type InsertAppointment = typeof appointmentsTable.$inferInsert;

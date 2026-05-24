import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";
import { appointmentsTable } from "./appointments";

export const automationLogTable = pgTable(
  "automation_log",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id").references(() => clientsTable.id, { onDelete: "set null" }),
    appointmentId: integer("appointment_id").references(() => appointmentsTable.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(),
    phone: text("phone").notNull(),
    messagePreview: text("message_preview"),
    sentAt: timestamp("sent_at").notNull().defaultNow(),
    twilioSid: text("twilio_sid"),
    success: boolean("success").notNull().default(false),
  },
  (t) => ({
    eventTypeIdx: index("automation_log_event_type_idx").on(t.eventType),
    sentAtIdx: index("automation_log_sent_at_idx").on(t.sentAt),
    clientIdIdx: index("automation_log_client_id_idx").on(t.clientId),
  }),
);

export type AutomationLog = typeof automationLogTable.$inferSelect;
export type InsertAutomationLog = typeof automationLogTable.$inferInsert;

import { pgTable, serial, text, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const teamMembersTable = pgTable(
  "team_members",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    role: text("role").notNull().default("staff"),
    phone: text("phone").notNull(),
    whatsappPhone: text("whatsapp_phone"),
    active: boolean("active").notNull().default(true),
    notifyOnEscalation: boolean("notify_on_escalation").notNull().default(true),
    notifyOnLead: boolean("notify_on_lead").notNull().default(true),
    notifyOnBooking: boolean("notify_on_booking").notNull().default(true),
    notifyOnDmLead: boolean("notify_on_dm_lead").notNull().default(true),
    notifyOnCall: boolean("notify_on_call").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    activeIdx: index("team_members_active_idx").on(t.active),
  }),
);

export type TeamMember = typeof teamMembersTable.$inferSelect;
export type InsertTeamMember = typeof teamMembersTable.$inferInsert;

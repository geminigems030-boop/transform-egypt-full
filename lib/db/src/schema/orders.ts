import { pgTable, serial, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export type OrderItem = {
  productId: number;
  name: string;
  nameAr?: string;
  price: number;
  quantity: number;
  image?: string;
};

export const ordersTable = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    customerName: text("customer_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    address: text("address").notNull(),
    city: text("city").notNull(),
    notes: text("notes"),
    items: jsonb("items").notNull().$type<OrderItem[]>(),
    subtotal: integer("subtotal").notNull(),
    shipping: integer("shipping").notNull().default(0),
    total: integer("total").notNull(),
    status: text("status").notNull().default("new"),
    language: text("language"),
    customerEmailSentAt: timestamp("customer_email_sent_at"),
    adminEmailSentAt: timestamp("admin_email_sent_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    createdIdx: index("orders_created_idx").on(t.createdAt),
    statusIdx: index("orders_status_idx").on(t.status),
    emailIdx: index("orders_email_idx").on(t.email),
  }),
);

export type Order = typeof ordersTable.$inferSelect;
export type InsertOrder = typeof ordersTable.$inferInsert;

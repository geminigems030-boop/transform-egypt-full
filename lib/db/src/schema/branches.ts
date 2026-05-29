import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";

// Salon branches. DB-backed so the website + Yara read live status/hours and the
// Google Sheet → content-update webhook can flip a branch open/closed without a
// redeploy. status: "open" | "closed".
export const branchesTable = pgTable("branches", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  city: text("city"),
  cityAr: text("city_ar"),
  address: text("address"),
  addressAr: text("address_ar"),
  detail: text("detail"),
  detailAr: text("detail_ar"),
  phone: text("phone"),
  mapUrl: text("map_url"),
  status: text("status").notNull().default("open"),
  closureReason: text("closure_reason"),
  closureReasonAr: text("closure_reason_ar"),
  hours: text("hours"),
  isPremium: boolean("is_premium").notNull().default(false),
  lat: numeric("lat", { precision: 9, scale: 6 }),
  lng: numeric("lng", { precision: 9, scale: 6 }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Branch = typeof branchesTable.$inferSelect;
export type InsertBranch = typeof branchesTable.$inferInsert;

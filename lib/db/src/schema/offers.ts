import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

// Dynamic promotions. Anything the team adds here (active=true) instantly shows
// on the website (GET /api/offers) and is injected into Yara's knowledge so she
// can recommend it — replacing the hard "no offers" rule when offers exist.
export const offersTable = pgTable("offers", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  description: text("description"),
  descriptionAr: text("description_ar"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Offer = typeof offersTable.$inferSelect;
export type InsertOffer = typeof offersTable.$inferInsert;

import { pgTable, serial, text, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4"; // drizzle-zod 0.8 emits zod v4 schemas; match its subpath so z.infer aligns

export const servicesTable = pgTable("services", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  description: text("description").notNull(),
  descriptionAr: text("description_ar").notNull(),
  startingPrice: numeric("starting_price", { precision: 10, scale: 2 }).notNull(),
  image: text("image").notNull(),
  isFeatured: boolean("is_featured").notNull().default(false),
  badge: text("badge"),
});

export const insertServiceSchema = createInsertSchema(servicesTable).omit({ id: true });
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof servicesTable.$inferSelect;

import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────────────────────────────────────
// Internal Promotions — discounts, offers, and packages managed by the team.
// Used as the source of truth when running ad campaigns or generating ad copy.
// ─────────────────────────────────────────────────────────────────────────────

export const promotionsTable = pgTable(
  "promotions",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    titleAr: text("title_ar"),
    description: text("description"),
    descriptionAr: text("description_ar"),
    service: text("service"), // e.g. "hair_extensions" | "microblading" | "lashes" | "bridal"
    discountType: text("discount_type").notNull().default("percent"), // "percent" | "amount" | "package"
    discountValue: integer("discount_value"), // percent off or EGP off
    packagePrice: integer("package_price"), // total package price in EGP
    originalPrice: integer("original_price"), // original price in EGP
    validFrom: timestamp("valid_from"),
    validUntil: timestamp("valid_until"),
    targetAudience: text("target_audience"), // e.g. "new clients" | "returning clients" | "brides"
    status: text("status").notNull().default("active"), // active | paused | expired | draft
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index("promotions_status_idx").on(t.status),
    serviceIdx: index("promotions_service_idx").on(t.service),
  }),
);

export type Promotion = typeof promotionsTable.$inferSelect;
export type InsertPromotion = typeof promotionsTable.$inferInsert;

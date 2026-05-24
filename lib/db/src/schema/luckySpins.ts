import { pgTable, serial, text, timestamp, boolean, date, uniqueIndex } from "drizzle-orm/pg-core";

export const luckySpinsTable = pgTable(
  "lucky_spins",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    branch: text("branch"),
    quizGoal: text("quiz_goal"),
    quizHair: text("quiz_hair"),
    quizTimeline: text("quiz_timeline"),
    quizVibe: text("quiz_vibe"),
    recommendation: text("recommendation"),
    recommendationAr: text("recommendation_ar"),
    prizeLabel: text("prize_label").notNull(),
    prizeLabelAr: text("prize_label_ar").notNull(),
    prizeCode: text("prize_code").notNull(),
    isGrand: boolean("is_grand").notNull().default(false),
    segmentIndex: text("segment_index").notNull(),
    spinDate: date("spin_date").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    phonePerDay: uniqueIndex("lucky_spins_phone_day_uq").on(t.phone, t.spinDate),
  }),
);

export type LuckySpin = typeof luckySpinsTable.$inferSelect;

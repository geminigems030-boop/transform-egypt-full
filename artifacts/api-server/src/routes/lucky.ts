import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { and, eq, gte, lte, like, desc, sql } from "drizzle-orm";
import crypto from "node:crypto";
import { db } from "@workspace/db";
import { luckySpinsTable } from "@workspace/db/schema";
import { sendCapiEvent, userDataFromRequest } from "../lib/meta-capi";

type SpinInput = {
  name: string;
  phone: string;
  email?: string;
  branch?: string;
  goal?: string;
  hair?: string;
  timeline?: string;
  vibe?: string;
  leadEventId?: string;
  quizEventId?: string;
};

function parseSpinBody(raw: unknown): { ok: true; value: SpinInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Body must be a JSON object" };
  const r = raw as Record<string, unknown>;
  const str = (v: unknown, max = 120) =>
    typeof v === "string" && v.trim().length > 0 && v.length <= max ? v.trim() : undefined;
  const name = str(r.name, 120);
  if (!name || name.length < 2) return { ok: false, error: "name is required (min 2 chars)" };
  const rawPhone = typeof r.phone === "string" ? r.phone.replace(/\s+/g, "") : "";
  if (!/^01[0125]\d{8}$/.test(rawPhone))
    return { ok: false, error: "Egyptian mobile required: 11 digits starting with 010, 011, 012 or 015" };
  let email: string | undefined;
  if (typeof r.email === "string" && r.email.trim().length > 0) {
    const e = r.email.trim();
    if (e.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
      return { ok: false, error: "Invalid email format" };
    email = e;
  }
  return {
    ok: true,
    value: {
      name,
      phone: rawPhone,
      email,
      branch: str(r.branch, 120),
      goal: str(r.goal, 40),
      hair: str(r.hair, 40),
      timeline: str(r.timeline, 40),
      vibe: str(r.vibe, 40),
      // Meta CAPI dedup ids — frontend generates one per spin and one per
      // quiz completion and sends both up so the server can mirror the
      // pixel events with matching event_ids.
      leadEventId: str(r.leadEventId, 80),
      quizEventId: str(r.quizEventId, 80),
    },
  };
}

const router: IRouter = Router();

const MAX_GRAND_WINNERS_PER_DAY = 5;

type Prize = {
  segmentIndex: number;
  label: string;
  labelAr: string;
  isGrand: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// PRIZE WHEEL (item C1 + C2 — server-authoritative)
//
// The wheel UI on the client renders 8 segments, but the actual outcome is
// ALWAYS picked by this server in `router.post('/lucky/spin')` below — the
// client wheel only animates to whichever segmentIndex the server returned.
// Client-side wheel physics CANNOT influence the prize.
//
// Segments 0 and 3 are BOTH grand prizes — this is intentional (item C2):
// it places the grand-prize segments at the 12-o'clock and 6-o'clock visual
// positions for symmetry, which makes the wheel look balanced. The server
// picks 50/50 between the two when awarding a grand prize, so the visual
// duplication does not change the awarded probability.
// ─────────────────────────────────────────────────────────────────────────────
const PRIZES: Prize[] = [
  { segmentIndex: 0, label: "GRAND PRIZE — EGP 1,500 off any service above EGP 10,000", labelAr: "الجايزة الكبرى — خصم 1,500 جنيه على خدمات فوق 10,000 جنيه", isGrand: true },
  { segmentIndex: 1, label: "30% OFF Any Package", labelAr: "خصم 30% على أي باكدج", isGrand: false },
  { segmentIndex: 2, label: "FREE Deep Conditioning with any booking", labelAr: "ديب كونديشنينج مجاني مع أي حجز", isGrand: false },
  { segmentIndex: 3, label: "GRAND PRIZE — EGP 1,500 off any service above EGP 10,000", labelAr: "الجايزة الكبرى — خصم 1,500 جنيه على خدمات فوق 10,000 جنيه", isGrand: true },
  { segmentIndex: 4, label: "FREE Brow Shaping with any booking", labelAr: "تشكيل حواجب مجاني مع أي حجز", isGrand: false },
  { segmentIndex: 5, label: "15% OFF Any Service", labelAr: "خصم 15% على أي سيرفس", isGrand: false },
  { segmentIndex: 6, label: "FREE Lash Mapping & Expert Q&A Session", labelAr: "ماببينج لاش مجاني + جلسة استشارة مع الخبيرة", isGrand: false },
  { segmentIndex: 7, label: "10% OFF Any Service", labelAr: "خصم 10% على أي سيرفس", isGrand: false },
];

const CONSOLATION_INDICES = [1, 2, 4, 5, 6, 7];

function pickConsolation(): Prize {
  const idx = CONSOLATION_INDICES[Math.floor(Math.random() * CONSOLATION_INDICES.length)];
  return PRIZES[idx];
}

// 50/50 split between the two visual grand-prize segments (item C2).
// Both are functionally identical; the duplication is purely for wheel symmetry.
function pickGrand(): Prize {
  return Math.random() < 0.5 ? PRIZES[0] : PRIZES[3];
}

function generatePrizeCode(): string {
  const stamp = Date.now().toString(36).toUpperCase().slice(-5);
  const rand = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `TM-${stamp}-${rand}`;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

type Recommendation = { en: string; ar: string };

function buildRecommendation(input: {
  goal?: string;
  hair?: string;
  timeline?: string;
  vibe?: string;
  branch?: string;
}): Recommendation {
  const { goal, hair, timeline, vibe } = input;

  if (goal === "bridal") {
    return {
      en: "Full Bridal Package: trial run + signature hair + lash set + brow design + skincare prep + nail set. Book a dedicated bridal consultation 6–8 weeks ahead.",
      ar: "باكدج العروسة الكامل: ترايل + شعر سيجنتشر + لاش سيت + تصميم حواجب + تجهيز سكين كير + نيلز. احجزي كونسلتيشن العروسة قبل الفرح بـ 6 لـ 8 أسابيع.",
    };
  }
  if (goal === "hair") {
    if (hair === "fine" || hair === "damaged") {
      return {
        en: "Tape-In or Hand-Tied Extensions (gentle on fine/damaged hair) + Olaplex deep treatment + Signature Blowdry. Free fitting consultation included.",
        ar: "اكستنشن تيب إن أو هاند تايد (مناسب للشعر الناعم أو التالف) + ديب تريتمنت أولابلكس + بلودراي سيجنتشر. كونسلتيشن المقاس مجاني.",
      };
    }
    if (hair === "curly") {
      return {
        en: "Curly-matched Russian Extensions + Curl Treatment + Custom Cut. We hand-pick the texture to match your natural curl pattern.",
        ar: "اكستنشن روسي مطابق للكيرلي + تريتمنت الكيرلي + قصة مخصوصة. بنختار التكستشر اليدوي اللي يطابق كيرلك الطبيعي.",
      };
    }
    return {
      en: "Mega Volume Russian Extensions + Color Match + Signature Blowdry — celebrity-level density and length.",
      ar: "اكستنشن روسي ميجا فوليوم + كولور ماتش + بلودراي سيجنتشر — كثافة وطول بمستوى النجمات.",
    };
  }
  if (goal === "lash") {
    return {
      en: "Hybrid or Mega Volume Lash Set + Lash Lift consultation. We custom-map every set to your eye shape.",
      ar: "لاش هايبرد أو ميجا فوليوم + كونسلتيشن لاش ليفت. بنرسم كل سيت بشكل مخصوص حسب شكل عينيكي.",
    };
  }
  if (goal === "skin") {
    return {
      en: "Signature Hydra-Glow Facial + Skincare Routine consultation + Take-home regimen tailored to your skin type.",
      ar: "فيشيال هيدرا جلو سيجنتشر + كونسلتيشن روتين سكين كير + روتين بيتي تاخديه معاكي مخصوص لنوع بشرتك.",
    };
  }
  if (goal === "brows") {
    return {
      en: "Microblading or Brow Lamination + Custom Brow Mapping. Free pre-treatment consultation included.",
      ar: "مايكروبليدنج أو براو لامينيشن + رسم حواجب مخصوص. كونسلتيشن قبل الجلسة مجاني.",
    };
  }
  if (timeline === "thisweek") {
    return {
      en: "Express Glam Package: hair styling + brow shaping + lash trial. Same-week appointment guaranteed.",
      ar: "باكدج جلام إكسبريس: تصفيف شعر + تشكيل حواجب + تجربة لاش. ميعاد نفس الأسبوع مضمون.",
    };
  }
  void vibe;
  return {
    en: "Full Beauty Audit with our Beauty Expert + custom multi-service plan + free first consultation.",
    ar: "أوديت بيوتي كامل مع خبيرة الجمال بتاعتنا + خطة سيرفسات مخصوصة + كونسلتيشن أولى مجانية.",
  };
}

router.get("/lucky/today-stats", async (req, res) => {
  try {
    const today = todayDate();
    const grandRow = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(luckySpinsTable)
      .where(and(eq(luckySpinsTable.spinDate, today), eq(luckySpinsTable.isGrand, true)));
    const totalRow = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(luckySpinsTable)
      .where(eq(luckySpinsTable.spinDate, today));

    const grandAwarded = grandRow[0]?.count ?? 0;
    const total = totalRow[0]?.count ?? 0;

    res.json({
      grandWinnersAwarded: grandAwarded,
      grandWinnersRemaining: Math.max(0, MAX_GRAND_WINNERS_PER_DAY - grandAwarded),
      grandWinnersDailyCap: MAX_GRAND_WINNERS_PER_DAY,
      totalSpinsToday: total,
    });
  } catch (err) {
    req.log.error({ err }, "lucky/today-stats failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

const LUCKY_ADVISORY_LOCK_ID = 81234567;

router.post("/lucky/spin", async (req, res) => {
  try {
    const parsed = parseSpinBody(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }
    const body = parsed.value;
    const today = todayDate();
    const recommendation = buildRecommendation(body);

    // ─── Item C1: server-side daily grand-prize cap ─────────────────────────
    // The 5/day grand-prize cap is enforced INSIDE a Postgres advisory-locked
    // transaction. Because we hold pg_advisory_xact_lock for the duration of
    // the spin, two concurrent grand-prize attempts cannot both pass the
    // remaining-slots check. Once `grandAwarded >= MAX_GRAND_WINNERS_PER_DAY`,
    // every subsequent spin for the rest of the day MUST land on a
    // consolation prize (CONSOLATION_INDICES) — never a grand segment —
    // regardless of what the client-side wheel UI shows or where it spins.
    // ────────────────────────────────────────────────────────────────────────
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${LUCKY_ADVISORY_LOCK_ID})`);

      const existing = await tx
        .select()
        .from(luckySpinsTable)
        .where(and(eq(luckySpinsTable.phone, body.phone), eq(luckySpinsTable.spinDate, today)))
        .limit(1);

      if (existing.length > 0) {
        return { alreadyPlayed: true as const, row: existing[0] };
      }

      const grandRow = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(luckySpinsTable)
        .where(and(eq(luckySpinsTable.spinDate, today), eq(luckySpinsTable.isGrand, true)));
      const grandAwarded = grandRow[0]?.count ?? 0;
      const grandSlotsLeft = MAX_GRAND_WINNERS_PER_DAY - grandAwarded;

      // Server-authoritative outcome: only attempt a grand prize when slots
      // remain, and only ~25% of those attempts land on a grand. Once the
      // cap is hit, this branch is unreachable for the rest of the day.
      let prize: Prize;
      if (grandSlotsLeft > 0 && Math.random() < 0.25) {
        prize = pickGrand();
      } else {
        prize = pickConsolation();
      }

      const [row] = await tx
        .insert(luckySpinsTable)
        .values({
          name: body.name,
          phone: body.phone,
          email: body.email,
          branch: body.branch,
          quizGoal: body.goal,
          quizHair: body.hair,
          quizTimeline: body.timeline,
          quizVibe: body.vibe,
          recommendation: recommendation.en,
          recommendationAr: recommendation.ar,
          prizeLabel: prize.label,
          prizeLabelAr: prize.labelAr,
          prizeCode: generatePrizeCode(),
          isGrand: prize.isGrand,
          segmentIndex: String(prize.segmentIndex),
          spinDate: today,
        })
        .returning();

      return { alreadyPlayed: false as const, row };
    });

    // ─── Meta Conversions API mirror (only on FIRST spin of the day) ─────
    // Sends a Lead event (form submission) plus CompleteRegistration (quiz
    // finished). Same event_ids the browser used so Meta dedups correctly.
    // alreadyPlayed === true means we returned the existing row from a
    // duplicate submission — we must NOT fire CAPI again in that case.
    if (!result.alreadyPlayed) {
      const parts = body.name.trim().split(/\s+/);
      const firstName = parts[0];
      const lastName = parts.length > 1 ? parts.slice(1).join(" ") : undefined;
      const userBase = {
        ...userDataFromRequest(req as never),
        email: body.email ?? null,
        phone: body.phone ?? null,
        firstName: firstName ?? null,
        lastName: lastName ?? null,
      };
      const referer = typeof req.headers.referer === "string" ? req.headers.referer : undefined;

      void sendCapiEvent({
        eventName: "Lead",
        eventId: body.leadEventId ?? crypto.randomUUID(),
        eventSourceUrl: referer,
        user: userBase,
        custom: {
          contentName: "lucky_lead_form",
          contentCategory: body.branch ?? "lucky",
          currency: "EGP",
        },
      });
      if (body.quizEventId) {
        void sendCapiEvent({
          eventName: "CompleteRegistration",
          eventId: body.quizEventId,
          eventSourceUrl: referer,
          user: userBase,
          custom: { contentName: "lucky_quiz", contentCategory: "quiz" },
        });
      }
    }

    const status = result.alreadyPlayed ? 200 : 201;
    return res.status(status).json({
      alreadyPlayed: result.alreadyPlayed,
      prize: {
        label: result.row.prizeLabel,
        labelAr: result.row.prizeLabelAr,
        isGrand: result.row.isGrand,
        code: result.row.prizeCode,
        segmentIndex: Number(result.row.segmentIndex),
      },
      recommendation: {
        en: result.row.recommendation ?? "",
        ar: result.row.recommendationAr ?? "",
      },
    });
  } catch (err) {
    req.log.error({ err }, "lucky/spin failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin endpoints — protected by X-Admin-Token header matching ADMIN_TOKEN env.
// If ADMIN_TOKEN is not set, admin endpoints are disabled (503).
// ─────────────────────────────────────────────────────────────────────────────

function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || expected.length < 8) {
    res.status(503).json({
      error: "Admin disabled. Set the ADMIN_TOKEN secret (min 8 chars) in Replit Secrets to enable.",
    });
    return;
  }
  const provided =
    (typeof req.headers["x-admin-token"] === "string" ? req.headers["x-admin-token"] : "") ||
    (typeof req.headers.authorization === "string" ? req.headers.authorization.replace(/^Bearer\s+/i, "") : "");
  if (provided !== expected) {
    res.status(401).json({ error: "Invalid admin token" });
    return;
  }
  next();
}

function isValidIsoDate(s: string | undefined): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

router.get("/lucky/admin/stats", adminAuth, async (req, res) => {
  try {
    const today = todayDate();
    const total = await db.select({ count: sql<number>`count(*)::int` }).from(luckySpinsTable);
    const grandAll = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(luckySpinsTable)
      .where(eq(luckySpinsTable.isGrand, true));
    const todayTotal = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(luckySpinsTable)
      .where(eq(luckySpinsTable.spinDate, today));
    const todayGrand = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(luckySpinsTable)
      .where(and(eq(luckySpinsTable.spinDate, today), eq(luckySpinsTable.isGrand, true)));

    res.json({
      totalLeads: total[0]?.count ?? 0,
      totalGrandAwarded: grandAll[0]?.count ?? 0,
      todaySpins: todayTotal[0]?.count ?? 0,
      todayGrandAwarded: todayGrand[0]?.count ?? 0,
      grandCap: MAX_GRAND_WINNERS_PER_DAY,
    });
  } catch (err) {
    req.log.error({ err }, "lucky/admin/stats failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/lucky/admin/leads", adminAuth, async (req, res) => {
  try {
    const phone = typeof req.query.phone === "string" ? req.query.phone.trim() : "";
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    const format = typeof req.query.format === "string" ? req.query.format.toLowerCase() : "json";
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 5000 ? Math.floor(limitRaw) : 1000;

    const conditions = [];
    if (phone) conditions.push(like(luckySpinsTable.phone, `%${phone}%`));
    if (isValidIsoDate(from)) conditions.push(gte(luckySpinsTable.spinDate, from));
    if (isValidIsoDate(to)) conditions.push(lte(luckySpinsTable.spinDate, to));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select()
      .from(luckySpinsTable)
      .where(whereClause)
      .orderBy(desc(luckySpinsTable.createdAt))
      .limit(limit);

    if (format === "csv") {
      const escape = (v: unknown) => {
        if (v === null || v === undefined) return "";
        const s = String(v);
        if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
      };
      const headers = [
        "id", "spin_date", "created_at", "name", "phone", "email", "branch",
        "quiz_goal", "quiz_hair", "quiz_timeline", "quiz_vibe",
        "prize_label", "prize_code", "is_grand",
      ];
      const lines = [headers.join(",")];
      for (const r of rows) {
        lines.push([
          r.id,
          r.spinDate,
          r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
          r.name,
          r.phone,
          r.email ?? "",
          r.branch ?? "",
          r.quizGoal ?? "",
          r.quizHair ?? "",
          r.quizTimeline ?? "",
          r.quizVibe ?? "",
          r.prizeLabel,
          r.prizeCode,
          r.isGrand ? "yes" : "no",
        ].map(escape).join(","));
      }
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="lucky-leads-${todayDate()}.csv"`);
      res.send(lines.join("\n"));
      return;
    }

    res.json({
      count: rows.length,
      leads: rows.map((r) => ({
        id: r.id,
        spinDate: r.spinDate,
        createdAt: r.createdAt,
        name: r.name,
        phone: r.phone,
        email: r.email,
        branch: r.branch,
        quizGoal: r.quizGoal,
        quizHair: r.quizHair,
        quizTimeline: r.quizTimeline,
        quizVibe: r.quizVibe,
        prizeLabel: r.prizeLabel,
        prizeCode: r.prizeCode,
        isGrand: r.isGrand,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "lucky/admin/leads failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

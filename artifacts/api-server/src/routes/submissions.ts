import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { and, desc, eq, gte, lte, or, ilike, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { submissionsTable } from "@workspace/db/schema";
import { sendCapiEvent, userDataFromRequest } from "../lib/meta-capi";
import { sendBookingConfirmation, sendNewsletterWelcome } from "../lib/email";
import { notifyTeam } from "../lib/notify-team";
import crypto from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Unified Submissions API (Phase D — D1, D2, D6 slice)
//
// Public:
//   POST /api/submissions       — capture any site form (book/consultation/
//                                 giftcard/contact/boutique/newsletter)
//   POST /api/submissions/manual — admin-only manual lead entry (uses adminAuth)
//
// Admin (X-Admin-Token):
//   GET  /api/admin/submissions  — list, filter, optional CSV export
//   PATCH /api/admin/submissions/:id/status — update status
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_SOURCES = new Set([
  "book",
  "consultation",
  "giftcard",
  "contact",
  "boutique",
  "newsletter",
  "manual",
  // Webhook-originated lead sources (written directly by webhooks.ts /
  // admin-inbox.ts — not via this route's POST). Listed here so the admin
  // GET /api/admin/submissions?source=… filter accepts them.
  "instagram_dm",
  "facebook_dm",
  "instagram_dm_manual",
  "facebook_dm_manual",
  "instagram_dm_escalation",
  "facebook_dm_escalation",
  "lead_ads",
]);

const ALLOWED_STATUSES = new Set(["new", "contacted", "booked", "closed", "junk"]);

type SubmissionInput = {
  source: string;
  name?: string;
  phone?: string;
  email?: string;
  branch?: string;
  service?: string;
  message?: string;
  language?: string;
  loggedBy?: string;
  status?: string;
  // Meta event_id used to dedup the server-side CAPI event with the
  // browser Pixel event the client already fired. Optional — when missing
  // we generate one server-side (which means no dedup will occur, but the
  // event is still captured).
  eventId?: string;
};

function str(v: unknown, max = 500): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t) return undefined;
  return t.length > max ? t.slice(0, max) : t;
}

function parseSubmissionBody(raw: unknown): { ok: true; value: SubmissionInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Body must be a JSON object" };
  const r = raw as Record<string, unknown>;

  const source = str(r.source, 30);
  if (!source || !ALLOWED_SOURCES.has(source)) {
    return { ok: false, error: `source is required and must be one of: ${Array.from(ALLOWED_SOURCES).join(", ")}` };
  }

  const email = str(r.email, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Invalid email format" };
  }

  const phoneRaw = typeof r.phone === "string" ? r.phone.replace(/\s+/g, "") : "";
  const phone = phoneRaw.length > 0 ? phoneRaw : undefined;
  if (phone && phone.length > 30) return { ok: false, error: "phone too long" };

  // Newsletter only requires email; everything else needs at least one of
  // (name, phone, email) to be useful.
  if (source !== "newsletter") {
    if (!email && !phone && !str(r.name)) {
      return { ok: false, error: "At least one of name, phone, or email is required" };
    }
  } else {
    if (!email) return { ok: false, error: "email is required for newsletter signup" };
  }

  const language = str(r.language, 5);
  if (language && language !== "en" && language !== "ar") {
    return { ok: false, error: "language must be 'en' or 'ar'" };
  }

  const status = str(r.status, 20);
  if (status && !ALLOWED_STATUSES.has(status)) {
    return { ok: false, error: `status must be one of: ${Array.from(ALLOWED_STATUSES).join(", ")}` };
  }

  return {
    ok: true,
    value: {
      source,
      name: str(r.name, 120),
      phone,
      email,
      branch: str(r.branch, 200),
      service: str(r.service, 200),
      message: str(r.message, 2000),
      language,
      loggedBy: str(r.loggedBy, 80),
      status,
      eventId: str(r.eventId, 80),
    },
  };
}

function splitName(full?: string): { first?: string; last?: string } {
  if (!full) return {};
  const parts = full.trim().split(/\s+/);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { first: parts[0] };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function adminAuth(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || expected.length < 8) {
    return res.status(503).json({
      error: "Admin disabled. Set the ADMIN_TOKEN secret (min 8 chars) in Replit Secrets to enable.",
    });
  }
  const provided = typeof req.headers["x-admin-token"] === "string" ? req.headers["x-admin-token"] : "";
  if (!provided || provided !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
}

// Escape a value for CSV. In addition to RFC-4180 quoting we defuse
// "CSV formula injection": if the cell starts with =, +, -, @, tab, or CR
// some spreadsheet apps will execute it as a formula. Prefix a single quote
// to neutralize.
function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (s.length > 0 && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// Validate a YYYY-MM-DD (or full ISO) date string. Returns a Date or null.
function parseDateParam(v: string | undefined, endOfDay = false): Date | null | undefined {
  if (v === undefined || v === "") return undefined;
  const trimmed = v.trim();
  if (!trimmed) return undefined;
  // Accept either YYYY-MM-DD or full ISO. Build a concrete instant.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  const candidate = dateOnly
    ? new Date(`${trimmed}T${endOfDay ? "23:59:59" : "00:00:00"}`)
    : new Date(trimmed);
  if (Number.isNaN(candidate.getTime())) return null;
  return candidate;
}

const router: IRouter = Router();

// Public capture endpoint.
router.post("/submissions", async (req, res) => {
  const parsed = parseSubmissionBody(req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  if (parsed.value.loggedBy) {
    return res.status(400).json({ error: "loggedBy is reserved for admin manual entry" });
  }
  if (parsed.value.source === "manual") {
    return res.status(400).json({ error: "Use /submissions/manual for manual entry" });
  }
  try {
    const [row] = await db
      .insert(submissionsTable)
      .values({
        source: parsed.value.source,
        name: parsed.value.name,
        phone: parsed.value.phone,
        email: parsed.value.email,
        branch: parsed.value.branch,
        service: parsed.value.service,
        message: parsed.value.message,
        language: parsed.value.language,
        status: "new",
      })
      .returning({ id: submissionsTable.id });

    // Server-side Conversions API mirror. Same event_id as the browser
    // Pixel for dedup. Newsletter is a low-intent Lead; everything else
    // (book/consultation/giftcard/contact/boutique) is a high-intent Lead.
    const { first, last } = splitName(parsed.value.name);
    const eventId = parsed.value.eventId ?? crypto.randomUUID();
    void sendCapiEvent({
      eventName: "Lead",
      eventId,
      eventSourceUrl: typeof req.headers.referer === "string" ? req.headers.referer : undefined,
      user: {
        ...userDataFromRequest(req as never),
        email: parsed.value.email ?? null,
        phone: parsed.value.phone ?? null,
        firstName: first ?? null,
        lastName: last ?? null,
      },
      custom: {
        contentName: parsed.value.source === "newsletter" ? "newsletter_signup" : parsed.value.service ?? parsed.value.source,
        contentCategory: parsed.value.source,
        currency: "EGP",
      },
    });

    // Fire confirmation email based on source — non-blocking, never fails the response.
    const email = parsed.value.email;
    if (email) {
      if (parsed.value.source === "book") {
        void sendBookingConfirmation({
          name: parsed.value.name ?? "there",
          email,
          service: parsed.value.service,
          branch: parsed.value.branch,
          language: parsed.value.language,
        });
      } else if (parsed.value.source === "newsletter") {
        void sendNewsletterWelcome({ email, language: parsed.value.language });
      }
    }

    // WhatsApp team notification for new bookings and high-intent leads.
    if (parsed.value.source === "book") {
      void notifyTeam({
        type: "new_booking",
        name: parsed.value.name,
        phone: parsed.value.phone,
        email: parsed.value.email,
        service: parsed.value.service,
        branch: parsed.value.branch,
      }).catch(() => { /* fire-and-forget */ });
    } else if (["consultation", "giftcard", "contact"].includes(parsed.value.source)) {
      void notifyTeam({
        type: "new_lead",
        name: parsed.value.name,
        phone: parsed.value.phone,
        email: parsed.value.email,
        service: parsed.value.service,
        source: parsed.value.source,
      }).catch(() => { /* fire-and-forget */ });
    }

    return res.status(201).json({ ok: true, id: row?.id });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Insert failed" });
  }
});

// Admin manual entry.
router.post("/submissions/manual", adminAuth, async (req, res) => {
  const parsed = parseSubmissionBody(req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  try {
    const [row] = await db
      .insert(submissionsTable)
      .values({
        source: "manual",
        name: parsed.value.name,
        phone: parsed.value.phone,
        email: parsed.value.email,
        branch: parsed.value.branch,
        service: parsed.value.service,
        message: parsed.value.message,
        language: parsed.value.language ?? "en",
        loggedBy: parsed.value.loggedBy ?? "admin",
        status: parsed.value.status ?? "new",
      })
      .returning({ id: submissionsTable.id });
    return res.status(201).json({ ok: true, id: row?.id });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Insert failed" });
  }
});

// Admin list (with filters + optional CSV).
router.get("/admin/submissions", adminAuth, async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const search = q.search?.trim();
  const source = q.source?.trim();
  const status = q.status?.trim();
  const from = q.from?.trim();
  const to = q.to?.trim();
  const format = q.format?.trim();

  const conds = [] as ReturnType<typeof eq>[];
  if (source && ALLOWED_SOURCES.has(source)) conds.push(eq(submissionsTable.source, source));
  if (status && ALLOWED_STATUSES.has(status)) conds.push(eq(submissionsTable.status, status));
  const fromDate = parseDateParam(from, false);
  if (fromDate === null) return res.status(400).json({ error: "Invalid 'from' date — use YYYY-MM-DD or ISO" });
  if (fromDate) conds.push(gte(submissionsTable.createdAt, fromDate));
  const toDate = parseDateParam(to, true);
  if (toDate === null) return res.status(400).json({ error: "Invalid 'to' date — use YYYY-MM-DD or ISO" });
  if (toDate) conds.push(lte(submissionsTable.createdAt, toDate));
  if (search) {
    const pattern = `%${search}%`;
    const orExpr = or(
      ilike(submissionsTable.name, pattern),
      ilike(submissionsTable.phone, pattern),
      ilike(submissionsTable.email, pattern),
    );
    if (orExpr) conds.push(orExpr as never);
  }

  try {
    const where = conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds);
    const rows = await db
      .select()
      .from(submissionsTable)
      .where(where as never)
      .orderBy(desc(submissionsTable.createdAt))
      .limit(format === "csv" ? 5000 : 500);

    if (format === "csv") {
      const header = [
        "id",
        "createdAt",
        "source",
        "status",
        "name",
        "phone",
        "email",
        "branch",
        "service",
        "language",
        "loggedBy",
        "message",
      ];
      const lines = [header.join(",")];
      for (const r of rows) {
        lines.push(
          [
            r.id,
            r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
            r.source,
            r.status,
            r.name,
            r.phone,
            r.email,
            r.branch,
            r.service,
            r.language,
            r.loggedBy,
            r.message,
          ]
            .map(csvEscape)
            .join(","),
        );
      }
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename=submissions-${new Date().toISOString().slice(0, 10)}.csv`);
      return res.send(lines.join("\n"));
    }

    // Counts grouped by source — useful for the admin dashboard.
    const grouped = await db
      .select({ source: submissionsTable.source, count: sql<number>`count(*)::int` })
      .from(submissionsTable)
      .groupBy(submissionsTable.source);

    return res.json({ submissions: rows, counts: grouped });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Query failed" });
  }
});

router.patch("/admin/submissions/:id/status", adminAuth, async (req, res) => {
  const id = Number.parseInt(String(req.params.id ?? ""), 10);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const status = typeof req.body?.status === "string" ? req.body.status.trim() : "";
  if (!ALLOWED_STATUSES.has(status)) {
    return res.status(400).json({ error: `status must be one of: ${Array.from(ALLOWED_STATUSES).join(", ")}` });
  }
  try {
    const [row] = await db
      .update(submissionsTable)
      .set({ status })
      .where(eq(submissionsTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json({ ok: true, submission: row });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Update failed" });
  }
});

export default router;

// ─────────────────────────────────────────────────────────────────────────────
// Appointments & Client CRM API
//
// Admin-authenticated endpoints (X-Admin-Token):
//   GET    /api/admin/appointments          — paginated, filterable list
//   POST   /api/admin/appointments          — create single appointment
//   PATCH  /api/admin/appointments/:id/status — update status
//   POST   /api/admin/appointments/:id/confirm
//   POST   /api/admin/appointments/:id/complete
//   POST   /api/admin/appointments/:id/cancel
//   POST   /api/admin/appointments/:id/reschedule
//   POST   /api/admin/appointments/upload   — CSV/Excel bulk import
//
//   GET    /api/admin/clients               — paginated, searchable list
//   GET    /api/admin/clients/:id           — full profile + visit history
// ─────────────────────────────────────────────────────────────────────────────

import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { type SQL, and, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { appointmentsTable, clientsTable, bookingsTable } from "@workspace/db/schema";
import { logger } from "../lib/logger";
import { notifyTeam } from "../lib/notify-team";
import { normalizePhone, findOrCreateClient, refreshClientStats } from "../lib/crm";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── Auth middleware ────────────────────────────────────────────────────────────

function adminAuth(req: Request, res: Response, next: NextFunction) {
  const expected = process.env["ADMIN_TOKEN"];
  if (!expected || expected.length < 8) {
    return res.status(503).json({ error: "Admin disabled. Set ADMIN_TOKEN secret (min 8 chars)." });
  }
  const provided =
    (typeof req.headers["x-admin-token"] === "string" ? req.headers["x-admin-token"] : "") ||
    (typeof req.headers.authorization === "string"
      ? req.headers.authorization.replace(/^Bearer\s+/i, "")
      : "");
  if (provided !== expected) return res.status(401).json({ error: "Unauthorized" });
  return next();
}

// ── Utility ────────────────────────────────────────────────────────────────────

function str(v: unknown, max = 500): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t.length > max ? t.slice(0, max) : t;
}

function parseDateParam(v: string | undefined, endOfDay = false): Date | null | undefined {
  if (!v) return undefined;
  const trimmed = v.trim();
  if (!trimmed) return undefined;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  const candidate = dateOnly
    ? new Date(`${trimmed}T${endOfDay ? "23:59:59" : "00:00:00"}`)
    : new Date(trimmed);
  if (Number.isNaN(candidate.getTime())) return null;
  return candidate;
}

// normalizePhone, findOrCreateClient, refreshClientStats are imported from ../lib/crm
// — that shared module is the single source of truth used by all ingestion paths.

const ALLOWED_STATUSES = new Set(["pending", "scheduled", "confirmed", "completed", "cancelled", "rescheduled"]);

// ── GET /api/admin/appointments ────────────────────────────────────────────────

router.get("/admin/appointments", adminAuth, async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const page = Math.max(1, parseInt(q.page ?? "1", 10));
  const limit = Math.min(200, Math.max(1, parseInt(q.limit ?? "50", 10)));
  const offset = (page - 1) * limit;

  // Use SQL[] so both eq/gte/lte results and or() results are type-compatible
  const conds: SQL[] = [];

  if (q.status && ALLOWED_STATUSES.has(q.status)) conds.push(eq(appointmentsTable.status, q.status));
  if (q.branch) conds.push(eq(appointmentsTable.branch, q.branch));

  // Source filter: "legacy" matches both legacy-sync and legacy_booking tags
  const ALLOWED_SOURCES = new Set(["booking_form", "admin", "upload", "legacy-sync", "legacy_booking", "yara", "yara-call", "legacy"]);
  if (q.source && ALLOWED_SOURCES.has(q.source)) {
    if (q.source === "legacy") {
      conds.push(inArray(appointmentsTable.source, ["legacy-sync", "legacy_booking"]));
    } else {
      conds.push(eq(appointmentsTable.source, q.source));
    }
  }
  if (q.search) {
    const p = `%${q.search.trim()}%`;
    const orExpr = or(
      ilike(appointmentsTable.clientName, p),
      ilike(appointmentsTable.clientPhone, p),
      ilike(appointmentsTable.service, p),
      ilike(appointmentsTable.stylist, p),
    );
    if (orExpr) conds.push(orExpr);
  }

  const from = parseDateParam(q.from);
  if (from === null) return res.status(400).json({ error: "Invalid 'from' date" });
  if (from) conds.push(gte(appointmentsTable.scheduledAt, from));

  const to = parseDateParam(q.to, true);
  if (to === null) return res.status(400).json({ error: "Invalid 'to' date" });
  if (to) conds.push(lte(appointmentsTable.scheduledAt, to));

  try {
    const where = conds.length === 0 ? undefined : and(...conds);

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(appointmentsTable)
        .where(where)
        .orderBy(desc(appointmentsTable.scheduledAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(appointmentsTable)
        .where(where),
    ]);

    const total = countResult[0]?.count ?? 0;
    return res.json({ appointments: rows, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    logger.error({ err }, "appointments GET error");
    return res.status(500).json({ error: "Query failed" });
  }
});

// ── POST /api/admin/appointments ───────────────────────────────────────────────

router.post("/admin/appointments", adminAuth, async (req, res) => {
  const b = req.body as Record<string, unknown>;

  const phone = str(b.clientPhone ?? b.phone);
  if (!phone) return res.status(400).json({ error: "clientPhone is required" });
  const service = str(b.service);
  if (!service) return res.status(400).json({ error: "service is required" });
  const scheduledAtRaw = str(b.scheduledAt);
  if (!scheduledAtRaw) return res.status(400).json({ error: "scheduledAt is required" });
  const scheduledAt = new Date(scheduledAtRaw);
  if (isNaN(scheduledAt.getTime())) return res.status(400).json({ error: "Invalid scheduledAt" });

  try {
    const clientId = await findOrCreateClient(phone, str(b.clientName ?? b.name), undefined, str(b.branch));
    const [appt] = await db
      .insert(appointmentsTable)
      .values({
        clientId,
        clientName: str(b.clientName ?? b.name),
        clientPhone: normalizePhone(phone),
        service,
        branch: str(b.branch),
        stylist: str(b.stylist),
        scheduledAt,
        durationMinutes: typeof b.durationMinutes === "number" ? b.durationMinutes : undefined,
        price: str(b.price),
        notes: str(b.notes),
        source: "admin",
      })
      .returning();
    return res.status(201).json({ ok: true, appointment: appt });
  } catch (err) {
    logger.error({ err }, "appointments POST error");
    return res.status(500).json({ error: "Insert failed" });
  }
});

// ── Status action endpoints (for Yara / webhooks) ─────────────────────────────

async function updateStatus(
  res: Response,
  id: number,
  status: string,
  extras: Partial<typeof appointmentsTable.$inferInsert> = {},
) {
  const [row] = await db
    .update(appointmentsTable)
    .set({ status, ...extras, updatedAt: new Date() })
    .where(eq(appointmentsTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "Appointment not found" });

  // Log every status change
  logger.info(
    { appointmentId: row.id, clientPhone: row.clientPhone, service: row.service, status, source: row.source },
    `appointment: status → ${status}`,
  );

  // Always refresh client stats so transitions away from 'completed' also correct totals
  await refreshClientStats(row.clientId).catch((err) => {
    logger.warn({ err: (err as Error).message, clientId: row.clientId }, "refreshClientStats failed");
  });

  // Notify team via WhatsApp for meaningful status changes
  if (["confirmed", "completed", "cancelled", "rescheduled"].includes(status)) {
    void notifyTeam({
      type: "appointment_action",
      action: status as "confirmed" | "completed" | "cancelled" | "rescheduled",
      appointmentId: row.id,
      clientName: row.clientName ?? undefined,
      clientPhone: row.clientPhone,
      service: row.service,
      branch: row.branch ?? undefined,
      scheduledAt: row.scheduledAt instanceof Date ? row.scheduledAt.toISOString() : String(row.scheduledAt),
    }).catch(() => {});
  }

  return res.json({ ok: true, appointment: row });
}

router.post("/admin/appointments/:id/confirm", adminAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  return updateStatus(res, id, "confirmed", { confirmedAt: new Date() });
});

router.post("/admin/appointments/:id/complete", adminAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  return updateStatus(res, id, "completed", { completedAt: new Date() });
});

router.post("/admin/appointments/:id/cancel", adminAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  return updateStatus(res, id, "cancelled", { cancelledAt: new Date() });
});

router.post("/admin/appointments/:id/reschedule", adminAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!isFinite(id)) return res.status(400).json({ error: "Invalid id" });

  const b = req.body as Record<string, unknown>;
  const scheduledAtRaw = str(b.scheduledAt);
  if (!scheduledAtRaw) return res.status(400).json({ error: "scheduledAt is required for reschedule" });
  const scheduledAt = new Date(scheduledAtRaw);
  if (isNaN(scheduledAt.getTime())) return res.status(400).json({ error: "Invalid scheduledAt" });

  try {
    return updateStatus(res, id, "rescheduled", { scheduledAt });
  } catch (err) {
    logger.error({ err }, "reschedule error");
    return res.status(500).json({ error: "Reschedule failed" });
  }
});

router.patch("/admin/appointments/:id/status", adminAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const status = str((req.body as Record<string, unknown>).status);
  if (!status || !ALLOWED_STATUSES.has(status)) {
    return res.status(400).json({ error: `status must be one of: ${[...ALLOWED_STATUSES].join(", ")}` });
  }
  return updateStatus(res, id, status);
});

// ── POST /api/admin/appointments/upload ───────────────────────────────────────

router.post("/admin/appointments/upload", adminAuth, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  let rows: Record<string, unknown>[] = [];
  try {
    const wb = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, unknown>[];
  } catch {
    return res.status(400).json({ error: "Could not parse file. Upload a valid CSV or Excel file." });
  }

  if (rows.length === 0) return res.status(400).json({ error: "File is empty" });

  const results = { created: 0, updated: 0, errors: [] as { row: number; message: string }[] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-indexed + header

    // Accept common column name variants (case-insensitive lookup)
    const get = (...keys: string[]): string => {
      for (const k of keys) {
        const match = Object.keys(row).find((rk) => rk.toLowerCase().replace(/[\s_]/g, "") === k.toLowerCase().replace(/[\s_]/g, ""));
        if (match && row[match] !== undefined && row[match] !== "") return String(row[match]).trim();
      }
      return "";
    };

    const phone = get("phone", "mobile", "tel", "phonenumber");
    if (!phone) { results.errors.push({ row: rowNum, message: "Missing phone" }); continue; }

    const service = get("service", "treatment", "servicename");
    if (!service) { results.errors.push({ row: rowNum, message: "Missing service" }); continue; }

    // Parse date + time into a timestamp.
    //
    // With cellDates:true, xlsx pre-converts Excel date serials to JS Date objects
    // for cells it recognises as dates. However cells formatted as plain numbers or
    // text are left as-is, so we handle all three representations explicitly:
    //   • JS Date  — from xlsx pre-conversion or Date objects already in memory
    //   • number   — raw Excel date serial (days since 1900-01-01); convert via
    //                XLSX.SSF.parse_date_code which is the authoritative converter
    //   • string   — ISO, locale, or "YYYY-MM-DD HH:mm" formats
    const dateCell = (() => {
      for (const k of ["date", "appointmentdate", "scheduleddate"]) {
        const match = Object.keys(row).find((rk) => rk.toLowerCase().replace(/[\s_]/g, "") === k);
        if (match && row[match] !== undefined && row[match] !== "") return row[match];
      }
      return "";
    })();
    const timeRaw = get("time", "appointmenttime", "scheduledtime");
    let scheduledAt: Date;

    if (!dateCell && dateCell !== 0) { results.errors.push({ row: rowNum, message: "Missing date" }); continue; }

    if (dateCell instanceof Date) {
      scheduledAt = new Date(dateCell);
      if (timeRaw) {
        const [h = 0, m = 0] = timeRaw.split(":").map(Number);
        scheduledAt.setHours(h, m, 0, 0);
      }
    } else if (typeof dateCell === "number") {
      // Excel serial date: use XLSX's parser which correctly handles the
      // 1900 leap-year bug and returns { y, m, d, H, M, S } parts.
      // Guard: parse_date_code can return null/undefined for out-of-range values.
      type DateParts = { y: number; m: number; d: number; H: number; M: number; S: number };
      let parts: DateParts | null = null;
      try { parts = (XLSX.SSF.parse_date_code as (n: number) => DateParts | null)(dateCell); } catch { /* fall through */ }
      if (!parts || parts.y == null) {
        results.errors.push({ row: rowNum, message: `Invalid Excel serial date: ${dateCell}` });
        continue;
      }
      scheduledAt = new Date(parts.y, parts.m - 1, parts.d, parts.H, parts.M, parts.S);
      if (timeRaw) {
        const [h = 0, m = 0] = timeRaw.split(":").map(Number);
        scheduledAt.setHours(h, m, 0, 0);
      }
      if (isNaN(scheduledAt.getTime())) {
        results.errors.push({ row: rowNum, message: `Invalid Excel serial date: ${dateCell}` });
        continue;
      }
    } else {
      const dateStr = String(dateCell).trim();
      const combined = timeRaw ? `${dateStr} ${timeRaw}` : dateStr;
      scheduledAt = new Date(combined);
      if (isNaN(scheduledAt.getTime())) {
        // Try ISO date-only + explicit time
        const isoCandidate = new Date(`${dateStr}T${timeRaw ? timeRaw + ":00" : "09:00:00"}`);
        if (!isNaN(isoCandidate.getTime())) {
          scheduledAt = isoCandidate;
        } else {
          results.errors.push({ row: rowNum, message: `Invalid date: ${combined}` });
          continue;
        }
      }
    }

    const name = get("name", "clientname", "customername", "fullname");
    const branch = get("branch", "salon", "location");
    const stylist = get("stylist", "staff", "technician", "artist");
    const priceRaw = get("price", "amount", "cost");
    const price = priceRaw && !isNaN(parseFloat(priceRaw)) ? priceRaw : undefined;
    const notes = get("notes", "note", "comments");

    try {
      const normPhone = normalizePhone(phone);
      const clientId = await findOrCreateClient(normPhone, name || undefined, undefined, branch || undefined);

      // Upsert: match on normalised phone + scheduledAt (within 60 s) + source=upload
      // This makes bulk re-uploads idempotent and increments `updated` accurately.
      const [existing] = await db
        .select({ id: appointmentsTable.id })
        .from(appointmentsTable)
        .where(
          and(
            eq(appointmentsTable.clientPhone, normPhone),
            eq(appointmentsTable.source, "upload"),
            sql`ABS(EXTRACT(EPOCH FROM (scheduled_at - ${scheduledAt.toISOString()}::timestamptz))) < 60`,
          ),
        )
        .limit(1);

      if (existing) {
        await db
          .update(appointmentsTable)
          .set({
            clientName: name || undefined,
            service,
            branch: branch || undefined,
            stylist: stylist || undefined,
            price,
            notes: notes || undefined,
            updatedAt: new Date(),
          })
          .where(eq(appointmentsTable.id, existing.id));
        results.updated++;
      } else {
        await db.insert(appointmentsTable).values({
          clientId,
          clientName: name || undefined,
          clientPhone: normPhone,
          service,
          branch: branch || undefined,
          stylist: stylist || undefined,
          scheduledAt,
          price,
          notes: notes || undefined,
          source: "upload",
        });
        results.created++;
      }
    } catch (err) {
      results.errors.push({ row: rowNum, message: err instanceof Error ? err.message : "Insert failed" });
    }
  }

  return res.json({ ok: true, ...results, total: rows.length });
});

// ── POST /api/admin/appointments/sync-bookings ─────────────────────────────────
//
// One-time (but safely re-runnable) migration that reads every row from the
// legacy `bookings` table and creates matching client + appointment records.
//
// Idempotent: uses source='legacy-sync' + phone + scheduledAt (±60 s) to
// detect already-imported rows so re-running never duplicates data.
//
// Status mapping:
//   bookings.status IN ('confirmed', 'done', 'completed') → appointments.status = 'completed'
//   otherwise                                             → appointments.status = 'scheduled'

router.post("/admin/appointments/sync-bookings", adminAuth, async (req, res) => {
  const summary = { clientsCreated: 0, clientsMatched: 0, appointmentsImported: 0, skipped: 0, duplicatesSkipped: 0 };

  let bookings: (typeof bookingsTable.$inferSelect)[];
  try {
    bookings = await db.select().from(bookingsTable).orderBy(bookingsTable.id);
  } catch (err) {
    logger.error({ err }, "sync-bookings: failed to read bookings table");
    return res.status(500).json({ error: "Failed to read legacy bookings" });
  }

  for (const booking of bookings) {
    // Defensive skip: rows with no usable phone cannot be linked to a client
    if (!booking.phone?.trim()) {
      logger.warn({ bookingId: booking.id }, "sync-bookings: skipping row with blank phone");
      summary.skipped++;
      continue;
    }

    // Parse the text date field; fall back to createdAt if unparseable
    let scheduledAt: Date;
    const parsed = new Date(booking.date);
    scheduledAt = isNaN(parsed.getTime()) ? new Date(booking.createdAt) : parsed;

    const normPhone = normalizePhone(booking.phone);

    // Idempotency check: skip if an appointment already imported from the legacy
    // bookings table exists for this phone + scheduledAt (within 60 seconds).
    // We match both source tags ('legacy-sync' and the older 'legacy_booking')
    // so environments that ran the previous sync implementation are not duplicated.
    try {
      const [existing] = await db
        .select({ id: appointmentsTable.id })
        .from(appointmentsTable)
        .where(
          and(
            eq(appointmentsTable.clientPhone, normPhone),
            or(
              eq(appointmentsTable.source, "legacy-sync"),
              eq(appointmentsTable.source, "legacy_booking"),
            ),
            sql`ABS(EXTRACT(EPOCH FROM (scheduled_at - ${scheduledAt.toISOString()}::timestamptz))) < 60`,
          ),
        )
        .limit(1);

      if (existing) {
        summary.skipped++;
        continue;
      }
    } catch (err) {
      logger.error({ err, bookingId: booking.id }, "sync-bookings: idempotency check failed");
      summary.skipped++;
      continue;
    }

    // Cross-source duplicate check: look for any existing appointment (regardless
    // of source, e.g. 'admin') with the same phone + service + scheduledAt (±60 min).
    // If found, append the legacy booking note to that record instead of inserting a
    // new row — preventing double-counting in visit_count / total_spend.
    try {
      const legacyNote = booking.message
        ? `${booking.message}\n[Legacy booking #${booking.id}]`
        : `[Legacy booking #${booking.id}]`;

      const [crossMatch] = await db
        .select({ id: appointmentsTable.id, notes: appointmentsTable.notes })
        .from(appointmentsTable)
        .where(
          and(
            eq(appointmentsTable.clientPhone, normPhone),
            eq(appointmentsTable.service, booking.service),
            sql`ABS(EXTRACT(EPOCH FROM (scheduled_at - ${scheduledAt.toISOString()}::timestamptz))) < 3600`,
          ),
        )
        .limit(1);

      if (crossMatch) {
        const marker = `[Legacy booking #${booking.id}]`;
        const alreadyMerged = crossMatch.notes?.includes(marker) ?? false;
        if (!alreadyMerged) {
          const mergedNotes = crossMatch.notes
            ? `${crossMatch.notes}\n${legacyNote}`
            : legacyNote;
          await db
            .update(appointmentsTable)
            .set({ notes: mergedNotes, updatedAt: new Date() })
            .where(eq(appointmentsTable.id, crossMatch.id));
          logger.info(
            { bookingId: booking.id, appointmentId: crossMatch.id },
            "sync-bookings: cross-source duplicate merged into existing appointment",
          );
        } else {
          logger.info(
            { bookingId: booking.id, appointmentId: crossMatch.id },
            "sync-bookings: cross-source duplicate already merged, skipping note append",
          );
        }
        summary.duplicatesSkipped++;
        continue;
      }
    } catch (err) {
      logger.error({ err, bookingId: booking.id }, "sync-bookings: cross-source duplicate check failed");
      summary.skipped++;
      continue;
    }

    // Determine new appointment status from legacy status
    const legacyDone = ["confirmed", "done", "completed"].includes((booking.status ?? "").toLowerCase());
    const appointmentStatus = legacyDone ? "completed" : "scheduled";

    try {
      // Before findOrCreateClient was called, track whether client existed
      const [preExisting] = await db
        .select({ id: clientsTable.id })
        .from(clientsTable)
        .where(eq(clientsTable.phone, normalizePhone(normPhone)))
        .limit(1);

      const clientId = await findOrCreateClient(
        normPhone,
        booking.name || undefined,
        booking.email || undefined,
      );

      if (preExisting) {
        summary.clientsMatched++;
      } else {
        summary.clientsCreated++;
      }

      await db.insert(appointmentsTable).values({
        clientId,
        clientName: booking.name || undefined,
        clientPhone: normPhone,
        service: booking.service,
        scheduledAt,
        status: appointmentStatus,
        completedAt: legacyDone ? scheduledAt : undefined,
        notes: booking.message
          ? `${booking.message}\n[Migrated from booking #${booking.id}]`
          : `[Migrated from booking #${booking.id}]`,
        source: "legacy-sync",
        createdAt: new Date(booking.createdAt),
      });

      // Refresh aggregated client stats so visit_count / total_spend are accurate
      await refreshClientStats(clientId);

      summary.appointmentsImported++;
    } catch (err) {
      logger.error({ err, bookingId: booking.id }, "sync-bookings: failed to import booking");
      summary.skipped++;
    }
  }

  logger.info(summary, "sync-bookings: complete");
  return res.json({ ok: true, ...summary, total: bookings.length });
});

// ── GET /api/admin/clients ─────────────────────────────────────────────────────

router.get("/admin/clients", adminAuth, async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const page = Math.max(1, parseInt(q.page ?? "1", 10));
  const limit = Math.min(200, Math.max(1, parseInt(q.limit ?? "50", 10)));
  const offset = (page - 1) * limit;

  const conds: SQL[] = [];
  if (q.search) {
    const p = `%${q.search.trim()}%`;
    const orExpr = or(
      ilike(clientsTable.name, p),
      ilike(clientsTable.phone, p),
      ilike(clientsTable.email, p),
    );
    if (orExpr) conds.push(orExpr);
  }
  if (q.branch) conds.push(eq(clientsTable.preferredBranch, q.branch));

  try {
    const where = conds.length === 0 ? undefined : and(...conds);

    // Select live-computed aggregates alongside stored client fields so the
    // response always reflects the current appointments table — even if a
    // side-effect refresh was missed.
    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: clientsTable.id,
          name: clientsTable.name,
          phone: clientsTable.phone,
          email: clientsTable.email,
          preferredBranch: clientsTable.preferredBranch,
          notes: clientsTable.notes,
          createdAt: clientsTable.createdAt,
          updatedAt: clientsTable.updatedAt,
          visitCount: sql<number>`
            (SELECT COUNT(*)::int FROM appointments
              WHERE client_id = clients.id AND status = 'completed')`.as("visit_count"),
          totalSpend: sql<string>`
            COALESCE((SELECT SUM(price::numeric) FROM appointments
              WHERE client_id = clients.id AND status = 'completed' AND price IS NOT NULL), 0)::text`.as("total_spend"),
          firstVisit: sql<string | null>`
            (SELECT MIN(scheduled_at) FROM appointments
              WHERE client_id = clients.id AND status = 'completed')`.as("first_visit"),
          lastVisit: sql<string | null>`
            (SELECT MAX(scheduled_at) FROM appointments
              WHERE client_id = clients.id AND status = 'completed')`.as("last_visit"),
        })
        .from(clientsTable)
        .where(where)
        .orderBy(sql`(SELECT MAX(scheduled_at) FROM appointments WHERE client_id = clients.id AND status = 'completed') DESC NULLS LAST`)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(clientsTable)
        .where(where),
    ]);

    const total = countResult[0]?.count ?? 0;
    return res.json({ clients: rows, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    logger.error({ err }, "clients GET error");
    return res.status(500).json({ error: "Query failed" });
  }
});

// ── GET /api/admin/clients/:id ─────────────────────────────────────────────────

router.get("/admin/clients/:id", adminAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!isFinite(id)) return res.status(400).json({ error: "Invalid id" });

  try {
    // Compute aggregates live from the appointments table so the profile is
    // always accurate regardless of whether refreshClientStats was called.
    const [clientRow] = await db
      .select({
        id: clientsTable.id,
        name: clientsTable.name,
        phone: clientsTable.phone,
        email: clientsTable.email,
        preferredBranch: clientsTable.preferredBranch,
        notes: clientsTable.notes,
        createdAt: clientsTable.createdAt,
        updatedAt: clientsTable.updatedAt,
        visitCount: sql<number>`
          (SELECT COUNT(*)::int FROM appointments
            WHERE client_id = clients.id AND status = 'completed')`.as("visit_count"),
        totalSpend: sql<string>`
          COALESCE((SELECT SUM(price::numeric) FROM appointments
            WHERE client_id = clients.id AND status = 'completed' AND price IS NOT NULL), 0)::text`.as("total_spend"),
        firstVisit: sql<string | null>`
          (SELECT MIN(scheduled_at) FROM appointments
            WHERE client_id = clients.id AND status = 'completed')`.as("first_visit"),
        lastVisit: sql<string | null>`
          (SELECT MAX(scheduled_at) FROM appointments
            WHERE client_id = clients.id AND status = 'completed')`.as("last_visit"),
      })
      .from(clientsTable)
      .where(eq(clientsTable.id, id));

    if (!clientRow) return res.status(404).json({ error: "Client not found" });

    // Full visit history — no hard cap, most-recent first
    const visits = await db
      .select()
      .from(appointmentsTable)
      .where(eq(appointmentsTable.clientId, id))
      .orderBy(desc(appointmentsTable.scheduledAt));

    return res.json({ client: clientRow, visits });
  } catch (err) {
    logger.error({ err }, "client profile GET error");
    return res.status(500).json({ error: "Query failed" });
  }
});

export default router;

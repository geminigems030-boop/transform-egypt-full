// ─────────────────────────────────────────────────────────────────────────────
// Automation API — WhatsApp appointment automation controls
//
//   GET    /api/admin/automation/settings     — get current settings
//   PUT    /api/admin/automation/settings     — update settings
//   GET    /api/admin/automation/log          — last 50 messages sent
//   POST   /api/admin/automation/trigger      — manually run a job
//   POST   /api/admin/automation/test-send    — test message to a phone number
// ─────────────────────────────────────────────────────────────────────────────

import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { automationSettingsTable, automationLogTable } from "@workspace/db/schema";
import { logger } from "../lib/logger";
import {
  run24hReminders,
  run2hReminders,
  runFollowups,
  runReengagement,
  getAutomationPreview,
} from "../lib/automation-scheduler";
import { sendWhatsAppDetailed, getWhatsAppDiagnostic } from "../lib/whatsapp";
import { normalizePhone } from "../lib/crm";

const router: IRouter = Router();

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

async function getOrCreateSettings() {
  const [row] = await db.select().from(automationSettingsTable).limit(1);
  if (row) return row;
  const [created] = await db.insert(automationSettingsTable).values({}).returning();
  return created;
}

// ── GET /api/admin/automation/settings ────────────────────────────────────────

router.get("/admin/automation/settings", adminAuth, async (_req, res) => {
  try {
    const settings = await getOrCreateSettings();
    return res.json({ settings });
  } catch (err) {
    logger.error({ err }, "automation settings GET error");
    return res.status(500).json({ error: "Failed to load settings" });
  }
});

// ── PUT /api/admin/automation/settings ────────────────────────────────────────

router.put("/admin/automation/settings", adminAuth, async (req, res) => {
  try {
    const b = req.body as Record<string, unknown>;
    const settings = await getOrCreateSettings();

    const updates: Partial<typeof automationSettingsTable.$inferInsert> = {};
    if (typeof b.enabled24h === "boolean") updates.enabled24h = b.enabled24h;
    if (typeof b.enabled2h === "boolean") updates.enabled2h = b.enabled2h;
    if (typeof b.enabledFollowup === "boolean") updates.enabledFollowup = b.enabledFollowup;
    if (typeof b.enabledReengagement === "boolean") updates.enabledReengagement = b.enabledReengagement;
    if (typeof b.reengagementWindowDays === "number" && b.reengagementWindowDays > 0) {
      updates.reengagementWindowDays = b.reengagementWindowDays;
    }
    if (typeof b.reengagementCooldownDays === "number" && b.reengagementCooldownDays > 0) {
      updates.reengagementCooldownDays = b.reengagementCooldownDays;
    }
    if (b.branchReviewLinks !== undefined && typeof b.branchReviewLinks === "object") {
      updates.branchReviewLinks = b.branchReviewLinks as Record<string, string>;
    }
    updates.updatedAt = new Date();

    const [updated] = await db
      .update(automationSettingsTable)
      .set(updates)
      .where(eq(automationSettingsTable.id, settings.id))
      .returning();

    return res.json({ ok: true, settings: updated });
  } catch (err) {
    logger.error({ err }, "automation settings PUT error");
    return res.status(500).json({ error: "Failed to update settings" });
  }
});

// ── GET /api/admin/automation/preview ─────────────────────────────────────────

router.get("/admin/automation/preview", adminAuth, async (_req, res) => {
  try {
    const preview = await getAutomationPreview();
    return res.json({ preview });
  } catch (err) {
    logger.error({ err }, "automation preview GET error");
    return res.status(500).json({ error: "Failed to load preview" });
  }
});

// ── GET /api/admin/automation/log ─────────────────────────────────────────────

router.get("/admin/automation/log", adminAuth, async (_req, res) => {
  try {
    const logs = await db
      .select()
      .from(automationLogTable)
      .orderBy(desc(automationLogTable.sentAt))
      .limit(50);
    return res.json({ logs });
  } catch (err) {
    logger.error({ err }, "automation log GET error");
    return res.status(500).json({ error: "Failed to load log" });
  }
});

// ── POST /api/admin/automation/trigger ────────────────────────────────────────

router.post("/admin/automation/trigger", adminAuth, async (req, res) => {
  const b = req.body as Record<string, unknown>;
  const job = typeof b.job === "string" ? b.job : "";

  const validJobs = ["reminder_24h", "reminder_2h", "followup", "reengagement"];
  if (!validJobs.includes(job)) {
    return res.status(400).json({ error: `job must be one of: ${validJobs.join(", ")}` });
  }

  try {
    let sent = 0;
    if (job === "reminder_24h") sent = await run24hReminders();
    else if (job === "reminder_2h") sent = await run2hReminders();
    else if (job === "followup") sent = await runFollowups();
    else if (job === "reengagement") sent = await runReengagement();

    logger.info({ job, sent }, "automation: manual trigger");
    return res.json({ ok: true, job, sent });
  } catch (err) {
    logger.error({ err, job }, "automation trigger error");
    return res.status(500).json({ error: "Job failed" });
  }
});

// ── POST /api/admin/automation/test-send ──────────────────────────────────────

router.post("/admin/automation/test-send", adminAuth, async (req, res) => {
  const b = req.body as Record<string, unknown>;
  const rawPhone = typeof b.phone === "string" ? b.phone.trim() : "";
  const eventType = typeof b.eventType === "string" && b.eventType.trim() ? b.eventType.trim() : "test";

  if (!rawPhone) return res.status(400).json({ error: "phone is required" });

  // Normalize to E.164 — handles Egyptian local format (01xxxxxxxxx → +20xxxxxxxxxx)
  const phone = normalizePhone(rawPhone);

  // Fast-path: if nothing is configured return the diagnostic immediately
  const diag = getWhatsAppDiagnostic();
  if (!diag.configured) {
    return res.json({
      ok: false,
      provider: null,
      reason: diag.reason,
      missingSecrets: diag.missingSecrets,
    });
  }

  const msg = `✅ TransforM Egypt — Test message (${eventType}). If you received this, notifications are working correctly.`;

  try {
    const result = await sendWhatsAppDetailed(phone, msg);

    // Persist to log so "Recent Messages" panel stays in sync
    await db.insert(automationLogTable).values({
      eventType,
      phone,
      messagePreview: msg.slice(0, 100),
      success: result.ok,
    }).catch((e: unknown) => logger.warn({ err: (e as Error).message }, "test-send: log insert failed"));

    return res.json({
      ok: result.ok,
      provider: result.provider,
      reason: result.ok
        ? `Message sent successfully via ${result.provider}`
        : result.error ?? "Send failed — check server logs",
    });
  } catch (err) {
    logger.error({ err }, "automation test-send error");
    return res.status(500).json({ ok: false, provider: null, reason: "Unexpected server error" });
  }
});

export default router;

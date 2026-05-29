// ─────────────────────────────────────────────────────────────────────────────
// Admin: Team Members CRUD
//
// GET    /api/admin/team          — list all team members
// POST   /api/admin/team          — create a team member
// PATCH  /api/admin/team/:id      — update a team member
// DELETE /api/admin/team/:id      — delete a team member
// POST   /api/admin/team/test-wa  — send a test WhatsApp to a number
// ─────────────────────────────────────────────────────────────────────────────

import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { teamMembersTable } from "@workspace/db/schema";
import { sendWhatsApp, isTwilioConfigured, isAnyWhatsAppConfigured } from "../lib/whatsapp";
import { isMetaWhatsAppConfigured } from "../lib/meta-whatsapp";

const router: IRouter = Router();

function adminAuth(req: Request, res: Response, next: NextFunction) {
  const expected = process.env["ADMIN_TOKEN"];
  if (!expected || expected.length < 8) return res.status(503).json({ error: "Admin disabled" });
  const provided =
    (typeof req.headers["x-admin-token"] === "string" ? req.headers["x-admin-token"] : "") ||
    (typeof req.headers.authorization === "string"
      ? req.headers.authorization.replace(/^Bearer\s+/i, "")
      : "");
  if (provided !== expected) return res.status(401).json({ error: "Unauthorized" });
  return next();
}

function str(v: unknown, max = 200): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t.length > max ? t.slice(0, max) : t;
}

function bool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  return fallback;
}

router.get("/admin/team", adminAuth, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(teamMembersTable)
      .orderBy(teamMembersTable.createdAt);
    return res.json({
      members: rows,
      twilioConfigured: isTwilioConfigured(),
      metaWhatsAppConfigured: isMetaWhatsAppConfigured(),
      whatsAppConfigured: isAnyWhatsAppConfigured(),
    });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Query failed" });
  }
});

router.post("/admin/team", adminAuth, async (req, res) => {
  const b = req.body as Record<string, unknown>;
  const name = str(b.name, 100);
  const phone = str(b.phone, 30);
  const role = str(b.role, 50) ?? "staff";
  const whatsappPhone = str(b.whatsappPhone, 30);

  if (!name) return res.status(400).json({ error: "name is required" });
  if (!phone) return res.status(400).json({ error: "phone is required" });

  try {
    const [row] = await db
      .insert(teamMembersTable)
      .values({
        name,
        phone,
        role,
        whatsappPhone: whatsappPhone ?? null,
        active: bool(b.active, true),
        notifyOnEscalation: bool(b.notifyOnEscalation, true),
        notifyOnLead: bool(b.notifyOnLead, true),
        notifyOnBooking: bool(b.notifyOnBooking, true),
        notifyOnDmLead: bool(b.notifyOnDmLead, true),
        notifyOnCall: bool(b.notifyOnCall, true),
      })
      .returning();
    return res.status(201).json({ ok: true, member: row });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Insert failed" });
  }
});

router.patch("/admin/team/:id", adminAuth, async (req, res) => {
  const id = Number.parseInt(String(req.params.id ?? ""), 10);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const b = req.body as Record<string, unknown>;

  const updates: Partial<typeof teamMembersTable.$inferInsert> & { updatedAt?: Date } = {
    updatedAt: new Date(),
  };
  if (typeof b.name === "string") updates.name = b.name.trim();
  if (typeof b.phone === "string") updates.phone = b.phone.trim();
  if (typeof b.role === "string") updates.role = b.role.trim();
  if (typeof b.whatsappPhone === "string") updates.whatsappPhone = b.whatsappPhone.trim() || null;
  if (typeof b.active === "boolean") updates.active = b.active;
  if (typeof b.notifyOnEscalation === "boolean") updates.notifyOnEscalation = b.notifyOnEscalation;
  if (typeof b.notifyOnLead === "boolean") updates.notifyOnLead = b.notifyOnLead;
  if (typeof b.notifyOnBooking === "boolean") updates.notifyOnBooking = b.notifyOnBooking;
  if (typeof b.notifyOnDmLead === "boolean") updates.notifyOnDmLead = b.notifyOnDmLead;
  if (typeof b.notifyOnCall === "boolean") updates.notifyOnCall = b.notifyOnCall;

  try {
    const [row] = await db
      .update(teamMembersTable)
      .set(updates)
      .where(eq(teamMembersTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json({ ok: true, member: row });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Update failed" });
  }
});

router.delete("/admin/team/:id", adminAuth, async (req, res) => {
  const id = Number.parseInt(String(req.params.id ?? ""), 10);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  try {
    const [row] = await db
      .delete(teamMembersTable)
      .where(eq(teamMembersTable.id, id))
      .returning({ id: teamMembersTable.id });
    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Delete failed" });
  }
});

router.post("/admin/team/test-wa", adminAuth, async (req, res) => {
    const b = req.body as Record<string, unknown>;
    const phone = typeof b.phone === "string" ? b.phone.trim() : "";
    if (!phone) return res.status(400).json({ error: "phone is required" });

    const { sendWhatsAppDetailed, isAnyWhatsAppConfigured } = await import("../lib/whatsapp");
    if (!isAnyWhatsAppConfigured()) {
      return res.status(503).json({ error: "No WhatsApp provider configured. Add Twilio or Meta WhatsApp credentials to environment secrets." });
    }

    const result = await sendWhatsAppDetailed(
      phone,
      `🌸 *TransforM Egypt* — Test notification from Yara AI.\n\nYour WhatsApp alerts are working correctly! ✅`,
    );
    return res.json({ ok: result.ok, phone, provider: result.provider, error: result.error ?? null });
  });

export default router;

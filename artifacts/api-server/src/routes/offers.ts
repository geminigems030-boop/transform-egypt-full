// ─────────────────────────────────────────────────────────────────────────────
// Offers API — dynamic promotions engine.
//
//   GET    /api/offers                 — PUBLIC: active offers (for the website)
//   GET    /api/admin/offers           — admin: all offers
//   POST   /api/admin/offers           — admin: create an offer
//   PATCH  /api/admin/offers/:id       — admin: update (incl. toggle active)
//   DELETE /api/admin/offers/:id       — admin: delete
// ─────────────────────────────────────────────────────────────────────────────

import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { offersTable } from "@workspace/db/schema";
import { logger } from "../lib/logger";
import { ensureOffersTable, getActiveOffers, invalidateOffersCache } from "../lib/offers";

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

function str(v: unknown, max = 600): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 ? null : t.slice(0, max);
}

// ── PUBLIC: active offers for the website ───────────────────────────────────────
router.get("/offers", async (_req, res) => {
  try {
    const rows = await getActiveOffers();
    return res.json({
      offers: rows.map((o) => ({
        id: o.id,
        title: o.title,
        titleAr: o.titleAr,
        description: o.description,
        descriptionAr: o.descriptionAr,
      })),
    });
  } catch (err) {
    logger.error({ err }, "offers public GET error");
    // Degrade gracefully — an offers outage should never break the homepage.
    return res.json({ offers: [] });
  }
});

// ── ADMIN: list all ─────────────────────────────────────────────────────────────
router.get("/admin/offers", adminAuth, async (_req, res) => {
  try {
    await ensureOffersTable();
    const rows = await db
      .select()
      .from(offersTable)
      .orderBy(asc(offersTable.sortOrder), desc(offersTable.id));
    return res.json({ offers: rows });
  } catch (err) {
    logger.error({ err }, "offers admin GET error");
    return res.status(500).json({ error: "Failed to load offers" });
  }
});

// ── ADMIN: create ───────────────────────────────────────────────────────────────
router.post("/admin/offers", adminAuth, async (req, res) => {
  const b = req.body as Record<string, unknown>;
  const title = str(b.title, 200);
  if (!title) return res.status(400).json({ error: "title is required" });
  try {
    await ensureOffersTable();
    const [created] = await db
      .insert(offersTable)
      .values({
        title,
        titleAr: str(b.titleAr, 200),
        description: str(b.description),
        descriptionAr: str(b.descriptionAr),
        active: typeof b.active === "boolean" ? b.active : true,
        sortOrder: typeof b.sortOrder === "number" ? b.sortOrder : 0,
      })
      .returning();
    invalidateOffersCache();
    return res.status(201).json({ offer: created });
  } catch (err) {
    logger.error({ err }, "offers POST error");
    return res.status(500).json({ error: "Failed to create offer" });
  }
});

// ── ADMIN: update / toggle ──────────────────────────────────────────────────────
router.patch("/admin/offers/:id", adminAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid id" });
  const b = req.body as Record<string, unknown>;
  const updates: Partial<typeof offersTable.$inferInsert> = { updatedAt: new Date() };
  if (typeof b.title === "string") updates.title = b.title.trim().slice(0, 200);
  if (b.titleAr !== undefined) updates.titleAr = str(b.titleAr, 200);
  if (b.description !== undefined) updates.description = str(b.description);
  if (b.descriptionAr !== undefined) updates.descriptionAr = str(b.descriptionAr);
  if (typeof b.active === "boolean") updates.active = b.active;
  if (typeof b.sortOrder === "number") updates.sortOrder = b.sortOrder;
  try {
    const [updated] = await db
      .update(offersTable)
      .set(updates)
      .where(eq(offersTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "not found" });
    invalidateOffersCache();
    return res.json({ offer: updated });
  } catch (err) {
    logger.error({ err }, "offers PATCH error");
    return res.status(500).json({ error: "Failed to update offer" });
  }
});

// ── ADMIN: delete ───────────────────────────────────────────────────────────────
router.delete("/admin/offers/:id", adminAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid id" });
  try {
    await db.delete(offersTable).where(eq(offersTable.id, id));
    invalidateOffersCache();
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "offers DELETE error");
    return res.status(500).json({ error: "Failed to delete offer" });
  }
});

export default router;

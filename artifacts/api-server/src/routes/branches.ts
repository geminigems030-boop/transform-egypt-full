// ─────────────────────────────────────────────────────────────────────────────
// Branches API
//
//   GET    /api/branches            — PUBLIC: all branches (for the website)
//   GET    /api/admin/branches      — admin: all branches
//   POST   /api/admin/branches      — admin: create
//   PATCH  /api/admin/branches/:id  — admin: update (incl. open/close)
//   DELETE /api/admin/branches/:id  — admin: delete
// ─────────────────────────────────────────────────────────────────────────────

import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { asc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { branchesTable } from "@workspace/db/schema";
import { logger } from "../lib/logger";
import { ensureBranchesTable, getBranches, invalidateBranchesCache } from "../lib/branches";

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

function s(v: unknown, max = 400): string | null {
  if (typeof v === "string") { const t = v.trim(); return t ? t.slice(0, max) : null; }
  if (typeof v === "number") return String(v);
  return null;
}

const WRITABLE = [
  "name", "nameAr", "city", "cityAr", "address", "addressAr", "detail", "detailAr",
  "phone", "mapUrl", "status", "closureReason", "closureReasonAr", "hours", "lat", "lng",
] as const;

function pickUpdates(b: Record<string, unknown>): Partial<typeof branchesTable.$inferInsert> {
  const u: Record<string, unknown> = {};
  for (const k of WRITABLE) if (b[k] !== undefined) u[k] = s(b[k]);
  if (typeof b.isPremium === "boolean") u.isPremium = b.isPremium;
  if (typeof b.sortOrder === "number") u.sortOrder = b.sortOrder;
  // Normalise status to open|closed.
  if (typeof u.status === "string") u.status = u.status === "open" ? "open" : "closed";
  return u as Partial<typeof branchesTable.$inferInsert>;
}

// ── PUBLIC ───────────────────────────────────────────────────────────────────
router.get("/branches", async (_req, res) => {
  try {
    const rows = await getBranches();
    return res.json({ branches: rows });
  } catch (err) {
    logger.error({ err }, "branches public GET error");
    return res.json({ branches: [] });
  }
});

// ── ADMIN list ────────────────────────────────────────────────────────────────
router.get("/admin/branches", adminAuth, async (_req, res) => {
  try {
    await ensureBranchesTable();
    const rows = await db.select().from(branchesTable).orderBy(asc(branchesTable.sortOrder), asc(branchesTable.id));
    return res.json({ branches: rows });
  } catch (err) {
    logger.error({ err }, "branches admin GET error");
    return res.status(500).json({ error: "Failed to load branches" });
  }
});

// ── ADMIN create ────────────────────────────────────────────────────────────────
router.post("/admin/branches", adminAuth, async (req, res) => {
  const b = req.body as Record<string, unknown>;
  const name = s(b.name, 200);
  if (!name) return res.status(400).json({ error: "name is required" });
  try {
    await ensureBranchesTable();
    const [created] = await db
      .insert(branchesTable)
      .values({ ...pickUpdates(b), name } as typeof branchesTable.$inferInsert)
      .returning();
    invalidateBranchesCache();
    return res.status(201).json({ branch: created });
  } catch (err) {
    logger.error({ err }, "branches POST error");
    return res.status(500).json({ error: "Failed to create branch" });
  }
});

// ── ADMIN update / toggle open-closed ─────────────────────────────────────────
router.patch("/admin/branches/:id", adminAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid id" });
  try {
    const updates = pickUpdates(req.body as Record<string, unknown>);
    updates.updatedAt = new Date();
    const [updated] = await db.update(branchesTable).set(updates).where(eq(branchesTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "not found" });
    invalidateBranchesCache();
    return res.json({ branch: updated });
  } catch (err) {
    logger.error({ err }, "branches PATCH error");
    return res.status(500).json({ error: "Failed to update branch" });
  }
});

// ── ADMIN delete ────────────────────────────────────────────────────────────────
router.delete("/admin/branches/:id", adminAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid id" });
  try {
    await db.delete(branchesTable).where(eq(branchesTable.id, id));
    invalidateBranchesCache();
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "branches DELETE error");
    return res.status(500).json({ error: "Failed to delete branch" });
  }
});

export default router;

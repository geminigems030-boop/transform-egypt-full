// ─────────────────────────────────────────────────────────────────────────────
// Live Content webhook — "Google Sheet → Supabase" bridge.
//
//   POST /api/webhooks/content-update
//
// A Google Apps Script onEdit trigger on the "Live Content Dashboard" sheet
// posts the changed row here. We update the matching DB record so the website
// and Yara read fresh data within seconds — no redeploy, no manual DB edit.
//
// Auth: shared secret in the `x-content-secret` header (env CONTENT_WEBHOOK_SECRET).
//
// Body — a single change or a batch:
//   { "type": "offer"|"product"|"branch"|"service", "action": ..., "data": {...} }
//   { "rows": [ { type, action, data }, ... ] }
//
// offer.data:   { id?, title, titleAr?, description?, descriptionAr?, active? }
// product.data: { name (or id), price?, originalPrice?, inStock?, badge? }
// branch.data:  { name (or id), status:"open"|"closed", hours?, address?, phone?, closureReason?, isPremium? }
//   - reopening/closing a branch here (e.g. CFCM) instantly updates the website + Yara.
// service.data: { name (or id), startingPrice (or price)?, badge? }
//
// All matches are by id or exact name (case-insensitive). Caches are invalidated
// on write so the site + Yara reflect changes within seconds.
// ─────────────────────────────────────────────────────────────────────────────

import { Router, type IRouter, type Request, type Response } from "express";
import { eq, ilike } from "drizzle-orm";
import { db } from "@workspace/db";
import { offersTable, productsTable, branchesTable, servicesTable } from "@workspace/db/schema";
import { logger } from "../lib/logger";
import { ensureOffersTable, invalidateOffersCache } from "../lib/offers";
import { ensureBranchesTable, invalidateBranchesCache } from "../lib/branches";
import { invalidateCatalogCache } from "../lib/ai-reply";

const router: IRouter = Router();

interface ChangeRow {
  type?: string;
  action?: string;
  data?: Record<string, unknown>;
}

function s(v: unknown, max = 600): string | null {
  if (typeof v === "string") {
    const t = v.trim();
    return t ? t.slice(0, max) : null;
  }
  if (typeof v === "number") return String(v);
  return null;
}

function bool(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    if (["true", "open", "active", "yes", "1", "live", "on"].includes(t)) return true;
    if (["false", "closed", "inactive", "no", "0", "off"].includes(t)) return false;
  }
  return undefined;
}

async function applyOffer(action: string, data: Record<string, unknown>): Promise<string> {
  await ensureOffersTable();
  const id = typeof data.id === "number" ? data.id : Number(data.id) || null;
  const title = s(data.title, 200);

  if (action === "delete") {
    if (id) await db.delete(offersTable).where(eq(offersTable.id, id));
    else if (title) await db.delete(offersTable).where(ilike(offersTable.title, title));
    invalidateOffersCache();
    return "offer deleted";
  }

  // upsert
  const values = {
    title: title ?? "Untitled offer",
    titleAr: s(data.titleAr, 200),
    description: s(data.description),
    descriptionAr: s(data.descriptionAr),
    active: bool(data.active) ?? true,
    sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : 0,
    updatedAt: new Date(),
  };

  // Find existing by id or title.
  let existingId = id;
  if (!existingId && title) {
    const [row] = await db
      .select({ id: offersTable.id })
      .from(offersTable)
      .where(ilike(offersTable.title, title))
      .limit(1);
    existingId = row?.id ?? null;
  }

  if (existingId) {
    await db.update(offersTable).set(values).where(eq(offersTable.id, existingId));
    invalidateOffersCache();
    return "offer updated";
  }
  await db.insert(offersTable).values(values);
  invalidateOffersCache();
  return "offer created";
}

async function applyProduct(data: Record<string, unknown>): Promise<string> {
  const id = typeof data.id === "number" ? data.id : Number(data.id) || null;
  const name = s(data.name, 200);

  const updates: Partial<typeof productsTable.$inferInsert> = {};
  if (data.price !== undefined && s(data.price) !== null) updates.price = s(data.price)!;
  if (data.originalPrice !== undefined) updates.originalPrice = s(data.originalPrice);
  if (data.inStock !== undefined && bool(data.inStock) !== undefined) updates.inStock = bool(data.inStock);
  if (data.badge !== undefined) updates.badge = s(data.badge, 60);

  if (Object.keys(updates).length === 0) return "product: nothing to update";

  let res;
  if (id) {
    res = await db.update(productsTable).set(updates).where(eq(productsTable.id, id)).returning({ id: productsTable.id });
  } else if (name) {
    res = await db.update(productsTable).set(updates).where(ilike(productsTable.name, name)).returning({ id: productsTable.id });
  } else {
    return "product: no id or name provided";
  }
  invalidateCatalogCache();
  return res.length > 0 ? `product updated (${res.length})` : "product: no match found";
}

async function applyBranch(action: string, data: Record<string, unknown>): Promise<string> {
  await ensureBranchesTable();
  const id = typeof data.id === "number" ? data.id : Number(data.id) || null;
  const name = s(data.name, 200);

  if (action === "delete") {
    if (id) await db.delete(branchesTable).where(eq(branchesTable.id, id));
    else if (name) await db.delete(branchesTable).where(ilike(branchesTable.name, name));
    invalidateBranchesCache();
    return "branch deleted";
  }

  // Map sheet fields → columns. `status` accepts open/closed/true/false.
  const updates: Record<string, unknown> = {};
  const statusBool = bool(data.status ?? data.open ?? data.active);
  if (statusBool !== undefined) updates.status = statusBool ? "open" : "closed";
  if (data.hours !== undefined) updates.hours = s(data.hours);
  if (data.address !== undefined) updates.address = s(data.address);
  if (data.addressAr !== undefined) updates.addressAr = s(data.addressAr);
  if (data.phone !== undefined) updates.phone = s(data.phone);
  if (data.closureReason !== undefined) updates.closureReason = s(data.closureReason);
  if (data.isPremium !== undefined && bool(data.isPremium) !== undefined) updates.isPremium = bool(data.isPremium);
  if (Object.keys(updates).length === 0 && action !== "upsert") return "branch: nothing to update";
  updates.updatedAt = new Date();

  // Find existing by id or name.
  let existingId = id;
  if (!existingId && name) {
    const [row] = await db.select({ id: branchesTable.id }).from(branchesTable).where(ilike(branchesTable.name, name)).limit(1);
    existingId = row?.id ?? null;
  }
  if (existingId) {
    await db.update(branchesTable).set(updates).where(eq(branchesTable.id, existingId));
    invalidateBranchesCache();
    return "branch updated";
  }
  if (name) {
    await db.insert(branchesTable).values({ name, status: statusBool === false ? "closed" : "open", ...updates } as typeof branchesTable.$inferInsert);
    invalidateBranchesCache();
    return "branch created";
  }
  return "branch: no id or name provided";
}

async function applyService(data: Record<string, unknown>): Promise<string> {
  const id = typeof data.id === "number" ? data.id : Number(data.id) || null;
  const name = s(data.name, 200);
  const updates: Record<string, unknown> = {};
  if (data.startingPrice !== undefined || data.price !== undefined) {
    const p = s(data.startingPrice ?? data.price);
    if (p !== null) updates.startingPrice = p;
  }
  if (data.badge !== undefined) updates.badge = s(data.badge, 60);
  if (Object.keys(updates).length === 0) return "service: nothing to update";

  let res;
  if (id) res = await db.update(servicesTable).set(updates).where(eq(servicesTable.id, id)).returning({ id: servicesTable.id });
  else if (name) res = await db.update(servicesTable).set(updates).where(ilike(servicesTable.name, name)).returning({ id: servicesTable.id });
  else return "service: no id or name provided";
  return res.length > 0 ? `service updated (${res.length})` : "service: no match found";
}

async function applyChange(row: ChangeRow): Promise<string> {
  const type = (row.type ?? "").toLowerCase();
  const action = (row.action ?? "upsert").toLowerCase();
  const data = (row.data ?? {}) as Record<string, unknown>;

  switch (type) {
    case "offer":
    case "promo":
    case "promotion":
      return applyOffer(action, data);
    case "product":
    case "service_price":
    case "price":
      return applyProduct(data);
    case "branch":
    case "location":
      return applyBranch(action, data);
    case "service":
      return applyService(data);
    default:
      return `unknown type "${type}" — ignored`;
  }
}

router.post("/webhooks/content-update", async (req: Request, res: Response) => {
  const secret = process.env["CONTENT_WEBHOOK_SECRET"];
  if (!secret) {
    logger.warn("content-update: CONTENT_WEBHOOK_SECRET not set; refusing");
    return res.status(503).json({ ok: false, error: "Content webhook not configured" });
  }
  const provided = req.header("x-content-secret") || "";
  if (provided !== secret) {
    logger.warn("content-update: invalid x-content-secret");
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }

  const body = (req.body ?? {}) as ChangeRow & { rows?: ChangeRow[] };
  const rows: ChangeRow[] = Array.isArray(body.rows) ? body.rows : [body];

  const results: string[] = [];
  for (const row of rows) {
    try {
      results.push(await applyChange(row));
    } catch (err) {
      logger.error({ err: (err as Error).message, row }, "content-update: row failed");
      results.push(`error: ${(err as Error).message}`);
    }
  }

  logger.info({ count: rows.length, results }, "content-update: applied sheet changes");
  return res.json({ ok: true, applied: results });
});

export default router;

import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { productsTable } from "@workspace/db/schema";

// ─────────────────────────────────────────────────────────────────────────────
// Meta Commerce / Instagram Shopping product catalog feed.
// Spec: https://www.facebook.com/business/help/120325381656392
//
// GET /api/catalog/products.csv  — Meta Catalog Manager polls this on a
// schedule. Required columns: id, title, description, availability,
// condition, price, link, image_link, brand. Optional we include:
// product_type, sale_price.
//
// Notes:
//  • `price` column is `numeric(10,2)` stored in EGP (major units).
//  • There is no `active` / `salePrice` column; we use `inStock` for
//    availability and `originalPrice` (when greater than `price`) to
//    derive a sale price.
// ─────────────────────────────────────────────────────────────────────────────

const SITE = "https://transform-egypt.com";
const HEADERS = [
  "id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "link",
  "image_link",
  "brand",
  "product_type",
  "sale_price",
] as const;

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (s.length > 0 && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function absoluteImage(img: string | null | undefined): string {
  if (!img) return `${SITE}/og-default.jpg`;
  if (/^https?:\/\//i.test(img)) return img;
  return `${SITE}${img.startsWith("/") ? img : `/${img}`}`;
}

function fmtMoney(n: string | number | null | undefined): string {
  const v = typeof n === "number" ? n : Number(n ?? 0);
  if (!Number.isFinite(v) || v <= 0) return "";
  return `${v.toFixed(2)} EGP`;
}

const router: IRouter = Router();

router.get("/catalog/products.csv", async (_req, res) => {
  try {
    const rows = await db.select().from(productsTable);

    const lines: string[] = [HEADERS.join(",")];
    for (const p of rows) {
      const list = Number(p.price ?? 0);
      const original = p.originalPrice != null ? Number(p.originalPrice) : null;
      // If `originalPrice > price`, treat current `price` as the sale price.
      const isOnSale = original != null && original > list;
      const priceCol = isOnSale ? fmtMoney(original) : fmtMoney(list);
      const saleCol = isOnSale ? fmtMoney(list) : "";

      const firstImg = Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null;

      lines.push(
        [
          p.id,
          p.name ?? "",
          p.description ?? p.name ?? "",
          p.inStock ? "in stock" : "out of stock",
          "new",
          priceCol,
          `${SITE}/boutique/${p.id}`,
          absoluteImage(firstImg),
          "TransforM Egypt",
          p.category ?? "Beauty",
          saleCol,
        ]
          .map(csvEscape)
          .join(","),
      );
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=900"); // 15 min
    res.setHeader("Content-Disposition", "inline; filename=transform-egypt-products.csv");
    return res.send(lines.join("\n"));
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Catalog feed failed" });
  }
});

export default router;

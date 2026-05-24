import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { productsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { ListProductsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/products", async (req, res) => {
  try {
    const query = ListProductsQueryParams.parse(req.query);
    
    let products;
    if (query.category) {
      products = await db.select().from(productsTable).where(eq(productsTable.category, query.category));
    } else {
      products = await db.select().from(productsTable);
    }

    const mapped = products.map(p => ({
      id: p.id,
      name: p.name,
      nameAr: p.nameAr,
      description: p.description,
      descriptionAr: p.descriptionAr,
      price: Number(p.price),
      originalPrice: p.originalPrice ? Number(p.originalPrice) : undefined,
      category: p.category,
      images: p.images as string[],
      badge: p.badge ?? undefined,
      inStock: p.inStock,
      rating: Number(p.rating),
      reviewCount: p.reviewCount,
      features: p.features as string[],
    }));

    res.json({ products: mapped, total: mapped.length });
  } catch (err) {
    req.log.error({ err }, "Error listing products");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/products/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
    
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    res.json({
      id: product.id,
      name: product.name,
      nameAr: product.nameAr,
      description: product.description,
      descriptionAr: product.descriptionAr,
      price: Number(product.price),
      originalPrice: product.originalPrice ? Number(product.originalPrice) : undefined,
      category: product.category,
      images: product.images as string[],
      badge: product.badge ?? undefined,
      inStock: product.inStock,
      rating: Number(product.rating),
      reviewCount: product.reviewCount,
      features: product.features as string[],
    });
  } catch (err) {
    req.log.error({ err }, "Error getting product");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin: delete a product by id
router.delete("/admin/products/:id", async (req, res) => {
  const token = req.headers["x-admin-token"];
  if (token !== process.env.ADMIN_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const id = parseInt(req.params.id);
    await db.delete(productsTable).where(eq(productsTable.id, id));
    res.json({ ok: true, deleted: id });
  } catch (err) {
    req.log.error({ err }, "Error deleting product");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin: patch a product (e.g. toggle inStock)
router.patch("/admin/products/:id", async (req, res) => {
  const token = req.headers["x-admin-token"];
  if (token !== process.env.ADMIN_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const id = parseInt(req.params.id);
    const { inStock, images } = req.body as { inStock?: boolean; images?: string[] };
    const update: Partial<typeof productsTable.$inferInsert> = {};
    if (typeof inStock === "boolean") update.inStock = inStock;
    if (Array.isArray(images)) update.images = images;
    const [updated] = await db.update(productsTable).set(update).where(eq(productsTable.id, id)).returning();
    res.json({ ok: true, product: updated });
  } catch (err) {
    req.log.error({ err }, "Error updating product");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

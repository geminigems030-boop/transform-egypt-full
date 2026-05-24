import { Router, type IRouter } from "express";
import { AddToCartBody } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { productsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// Simple in-memory cart for session (in production, use sessions/DB)
type CartItem = { productId: number; name: string; price: number; quantity: number; image: string; };
const cartStore = new Map<string, CartItem[]>();

function getCartKey(req: any): string {
  return req.ip ?? "default";
}

router.get("/cart", (req, res) => {
  const items = cartStore.get(getCartKey(req)) ?? [];
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  res.json({ items, total, itemCount });
});

router.post("/cart", async (req, res) => {
  try {
    const body = AddToCartBody.parse(req.body);
    const key = getCartKey(req);
    
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, body.productId));
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    const items = cartStore.get(key) ?? [];
    const existing = items.find(i => i.productId === body.productId);
    
    if (existing) {
      existing.quantity += body.quantity;
    } else {
      items.push({
        productId: body.productId,
        name: product.name,
        price: Number(product.price),
        quantity: body.quantity,
        image: (product.images as string[])[0] ?? "",
      });
    }
    
    cartStore.set(key, items);
    
    const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
    res.json({ items, total, itemCount });
  } catch (err) {
    req.log.error({ err }, "Error adding to cart");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/cart/:productId", (req, res) => {
  const productId = parseInt(req.params.productId);
  const key = getCartKey(req);
  const items = (cartStore.get(key) ?? []).filter(i => i.productId !== productId);
  cartStore.set(key, items);
  
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  res.json({ items, total, itemCount });
});

export default router;

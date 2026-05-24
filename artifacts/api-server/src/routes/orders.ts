import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { and, desc, eq, gte, lte, or, ilike, sql, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { ordersTable, productsTable, submissionsTable, type OrderItem } from "@workspace/db/schema";
import { sendOrderEmails } from "../lib/email";

// ─────────────────────────────────────────────────────────────────────────────
// Boutique Orders API
//
// Public:
//   POST /api/orders             — place order, persist + send email
//
// Admin (X-Admin-Token):
//   GET   /api/admin/orders               — list, filter, optional CSV
//   PATCH /api/admin/orders/:id/status    — update status
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_STATUSES = new Set([
  "new",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
]);

function str(v: unknown, max = 500): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t) return undefined;
  return t.length > max ? t.slice(0, max) : t;
}

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

type OrderInput = {
  customerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  notes?: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
  language?: string;
};

function parseOrderBody(raw: unknown): { ok: true; value: OrderInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Body must be a JSON object" };
  const r = raw as Record<string, unknown>;

  const customerName = str(r.customerName, 120);
  if (!customerName) return { ok: false, error: "customerName is required" };

  const email = str(r.email, 200);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "valid email is required" };
  }

  const phoneRaw = typeof r.phone === "string" ? r.phone.replace(/\s+/g, "") : "";
  if (!phoneRaw || phoneRaw.length < 6 || phoneRaw.length > 30) {
    return { ok: false, error: "valid phone is required" };
  }

  const address = str(r.address, 500);
  if (!address) return { ok: false, error: "address is required" };

  const city = str(r.city, 120);
  if (!city) return { ok: false, error: "city is required" };

  const itemsRaw = r.items;
  if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
    return { ok: false, error: "items must be a non-empty array" };
  }
  if (itemsRaw.length > 50) return { ok: false, error: "too many items (max 50)" };

  const items: OrderItem[] = [];
  for (const raw of itemsRaw) {
    if (!raw || typeof raw !== "object") return { ok: false, error: "each item must be an object" };
    const i = raw as Record<string, unknown>;
    const productId = num(i.productId);
    const name = str(i.name, 200);
    const price = num(i.price);
    const quantity = num(i.quantity);
    if (productId == null || !name || price == null || quantity == null) {
      return { ok: false, error: "each item needs productId, name, price, quantity" };
    }
    if (quantity < 1 || quantity > 100) return { ok: false, error: "item quantity out of range" };
    if (price < 0) return { ok: false, error: "item price must be non-negative" };
    items.push({
      productId: Math.floor(productId),
      name,
      nameAr: str(i.nameAr, 200),
      price: Math.round(price),
      quantity: Math.floor(quantity),
      image: str(i.image, 500),
    });
  }

  const subtotal = items.reduce((s, it) => s + it.price * it.quantity, 0);
  const shippingInput = num(r.shipping);
  const shipping = shippingInput != null && shippingInput >= 0 ? Math.round(shippingInput) : 0;
  const total = subtotal + shipping;

  const language = str(r.language, 5);
  if (language && language !== "en" && language !== "ar") {
    return { ok: false, error: "language must be 'en' or 'ar'" };
  }

  return {
    ok: true,
    value: {
      customerName,
      email,
      phone: phoneRaw,
      address,
      city,
      notes: str(r.notes, 1000),
      items,
      subtotal,
      shipping,
      total,
      language,
    },
  };
}

// ─── Admin auth (matches submissions.ts pattern) ─────────────────────────────

function adminAuth(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    res.status(500).json({ error: "ADMIN_TOKEN not configured" });
    return;
  }
  const provided = req.header("x-admin-token") || req.query.token;
  if (provided !== expected) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}

const router: IRouter = Router();

// ─── POST /api/orders ────────────────────────────────────────────────────────

router.post("/orders", async (req: Request, res: Response) => {
  const parsed = parseOrderBody(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const input = parsed.value;

  // ─── Server-side price verification ─────────────────────────────────────────
  // Never trust client-supplied prices. Look up the canonical price for every
  // productId from the products table and overwrite. If a productId doesn't
  // exist (or is unpublished), reject the order.
  try {
    const productIds = Array.from(new Set(input.items.map((it) => it.productId)));
    const rows = await db
      .select({ id: productsTable.id, name: productsTable.name, nameAr: productsTable.nameAr, price: productsTable.price })
      .from(productsTable)
      .where(inArray(productsTable.id, productIds));
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const it of input.items) {
      const canonical = byId.get(it.productId);
      if (!canonical) {
        res.status(400).json({ error: `Unknown product id: ${it.productId}` });
        return;
      }
      const canonicalPrice = Math.round(Number(canonical.price));
      if (!Number.isFinite(canonicalPrice) || canonicalPrice < 0) {
        res.status(500).json({ error: `Bad catalog price for product ${it.productId}` });
        return;
      }
      it.price = canonicalPrice;
      // Snap display name/nameAr to catalog truth too (cheap defense against
      // spoofed line items in the email confirmation).
      it.name = canonical.name;
      if (canonical.nameAr) it.nameAr = canonical.nameAr;
    }
    input.subtotal = input.items.reduce((s, it) => s + it.price * it.quantity, 0);
    input.total = input.subtotal + input.shipping;
  } catch (err) {
    console.error("[orders] price verification failed:", err);
    res.status(500).json({ error: "Failed to verify product prices" });
    return;
  }

  try {
    const [inserted] = await db
      .insert(ordersTable)
      .values({
        customerName: input.customerName,
        email: input.email,
        phone: input.phone,
        address: input.address,
        city: input.city,
        notes: input.notes,
        items: input.items,
        subtotal: input.subtotal,
        shipping: input.shipping,
        total: input.total,
        language: input.language,
      })
      .returning();

    // Mirror to submissions table so the order appears in /admin Submissions
    // tab alongside other leads (without needing a brand-new admin tab).
    try {
      const summary = input.items
        .map((it) => `${it.name} × ${it.quantity}`)
        .join(", ");
      await db.insert(submissionsTable).values({
        source: "boutique",
        name: input.customerName,
        phone: input.phone,
        email: input.email,
        message: `Order #${inserted.id} (EGP ${input.total.toLocaleString("en-EG")}): ${summary}\n${input.address}, ${input.city}${input.notes ? `\nNotes: ${input.notes}` : ""}`,
        language: input.language,
      });
    } catch (err) {
      // Don't fail the order if the mirror insert fails.
      console.error("[orders] submissions mirror failed:", err);
    }

    // Fire emails async — don't block the customer's checkout response on
    // SMTP latency. Update sent_at columns on success.
    void (async () => {
      try {
        const result = await sendOrderEmails(inserted);
        const updates: Partial<typeof ordersTable.$inferInsert> = {};
        if (result.customer) updates.customerEmailSentAt = new Date();
        if (result.admin) updates.adminEmailSentAt = new Date();
        if (Object.keys(updates).length > 0) {
          await db.update(ordersTable).set(updates).where(eq(ordersTable.id, inserted.id));
        }
      } catch (err) {
        console.error(`[orders] email send for #${inserted.id} failed:`, err);
      }
    })();

    res.status(201).json({
      id: inserted.id,
      status: inserted.status,
      total: inserted.total,
      createdAt: inserted.createdAt,
    });
  } catch (err) {
    console.error("[orders] insert failed:", err);
    res.status(500).json({ error: "Failed to place order" });
  }
});

// ─── GET /api/admin/orders ───────────────────────────────────────────────────

router.get("/admin/orders", adminAuth, async (req: Request, res: Response) => {
  try {
    const status = str(req.query.status, 30);
    const q = str(req.query.q, 200);
    const from = str(req.query.from, 30);
    const to = str(req.query.to, 30);
    const limit = Math.min(500, Math.max(1, num(req.query.limit) ?? 100));
    const offset = Math.max(0, num(req.query.offset) ?? 0);
    const csv = req.query.format === "csv";

    const filters = [];
    if (status && ALLOWED_STATUSES.has(status)) {
      filters.push(eq(ordersTable.status, status));
    }
    if (q) {
      const like = `%${q}%`;
      filters.push(
        or(
          ilike(ordersTable.customerName, like),
          ilike(ordersTable.email, like),
          ilike(ordersTable.phone, like),
        )!,
      );
    }
    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) filters.push(gte(ordersTable.createdAt, d));
    }
    if (to) {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) filters.push(lte(ordersTable.createdAt, d));
    }
    const where = filters.length > 0 ? and(...filters) : undefined;

    const rows = await db
      .select()
      .from(ordersTable)
      .where(where)
      .orderBy(desc(ordersTable.createdAt))
      .limit(csv ? 5000 : limit)
      .offset(csv ? 0 : offset);

    if (csv) {
      const header = [
        "id",
        "createdAt",
        "status",
        "customerName",
        "email",
        "phone",
        "city",
        "address",
        "subtotal",
        "shipping",
        "total",
        "items",
        "notes",
      ];
      const escape = (v: unknown) => {
        const s = v == null ? "" : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines = [header.join(",")];
      for (const r of rows) {
        const items = (r.items as OrderItem[])
          .map((it) => `${it.name} x${it.quantity}`)
          .join(" | ");
        lines.push(
          [
            r.id,
            r.createdAt.toISOString(),
            r.status,
            r.customerName,
            r.email,
            r.phone,
            r.city,
            r.address,
            r.subtotal,
            r.shipping,
            r.total,
            items,
            r.notes ?? "",
          ]
            .map(escape)
            .join(","),
        );
      }
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="orders-${Date.now()}.csv"`);
      res.send(lines.join("\n"));
      return;
    }

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(ordersTable)
      .where(where);

    res.json({ orders: rows, total: count, limit, offset });
  } catch (err) {
    console.error("[orders] admin list failed:", err);
    res.status(500).json({ error: "Failed to list orders" });
  }
});

// ─── PATCH /api/admin/orders/:id/status ──────────────────────────────────────

router.patch("/admin/orders/:id/status", adminAuth, async (req: Request, res: Response) => {
  const id = num(req.params.id);
  if (id == null) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  const status = str((req.body as Record<string, unknown>)?.status, 30);
  if (!status || !ALLOWED_STATUSES.has(status)) {
    res.status(400).json({ error: `status must be one of: ${Array.from(ALLOWED_STATUSES).join(", ")}` });
    return;
  }
  try {
    const [updated] = await db
      .update(ordersTable)
      .set({ status })
      .where(eq(ordersTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "order not found" });
      return;
    }
    res.json({ id: updated.id, status: updated.status });
  } catch (err) {
    console.error("[orders] status update failed:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

export default router;

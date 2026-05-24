import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// localStorage-backed shopping cart.
//
// Replaces the previous server-side in-memory cart that was keyed by
// req.ip — that broke immediately behind the production proxy because IPs
// were unstable across requests (Add and Get would land on different keys),
// and any server restart wiped the cart entirely.
//
// A boutique with no user accounts is best served by client-side cart state.
// We persist to localStorage so the cart survives refreshes, route changes,
// and browser-tab navigation through the checkout flow.
// ─────────────────────────────────────────────────────────────────────────────

export type CartItem = {
  productId: number;
  name: string;
  nameAr?: string;
  price: number;
  quantity: number;
  image?: string;
};

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  removeItem: (productId: number) => void;
  setQuantity: (productId: number, quantity: number) => void;
  clear: () => void;
};

const STORAGE_KEY = "transform_cart_v1";

const CartContext = createContext<CartContextValue | null>(null);

function readStorage(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (it): it is CartItem =>
          it &&
          typeof it === "object" &&
          typeof it.productId === "number" &&
          typeof it.name === "string" &&
          typeof it.price === "number" &&
          typeof it.quantity === "number" &&
          it.quantity > 0,
      )
      .slice(0, 50);
  } catch {
    return [];
  }
}

function writeStorage(items: CartItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // quota / private mode — silently ignore
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => readStorage());

  // Persist on every change.
  useEffect(() => {
    writeStorage(items);
  }, [items]);

  // Sync across browser tabs.
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setItems(readStorage());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const addItem = useCallback<CartContextValue["addItem"]>((item) => {
    const qty = Math.max(1, Math.floor(item.quantity ?? 1));
    setItems((prev) => {
      const existing = prev.find((p) => p.productId === item.productId);
      if (existing) {
        return prev.map((p) =>
          p.productId === item.productId
            ? { ...p, quantity: Math.min(99, p.quantity + qty) }
            : p,
        );
      }
      return [
        ...prev,
        {
          productId: item.productId,
          name: item.name,
          nameAr: item.nameAr,
          price: item.price,
          quantity: qty,
          image: item.image,
        },
      ];
    });
  }, []);

  const removeItem = useCallback<CartContextValue["removeItem"]>((productId) => {
    setItems((prev) => prev.filter((p) => p.productId !== productId));
  }, []);

  const setQuantity = useCallback<CartContextValue["setQuantity"]>((productId, quantity) => {
    const q = Math.floor(quantity);
    if (q <= 0) {
      setItems((prev) => prev.filter((p) => p.productId !== productId));
      return;
    }
    setItems((prev) =>
      prev.map((p) => (p.productId === productId ? { ...p, quantity: Math.min(99, q) } : p)),
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const itemCount = items.reduce((s, it) => s + it.quantity, 0);
    const subtotal = items.reduce((s, it) => s + it.price * it.quantity, 0);
    return { items, itemCount, subtotal, addItem, removeItem, setQuantity, clear };
  }, [items, addItem, removeItem, setQuantity, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within <CartProvider>");
  return ctx;
}

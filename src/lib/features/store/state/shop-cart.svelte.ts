/**
 * Shop cart — a localStorage-backed line list scoped to /shop. No Firestore
 * writes until checkout: the draft order is created server-side by
 * createCartCheckout (spec 2026-07-13-shop-cart-order-doc-design). SKU lines
 * dedupe by productId; configured decks are unique (configKey) and qty-locked
 * to 1, since each deck is generated fresh at fulfillment.
 */
import type { LoopConfig } from "../domain/loop-config";

const STORAGE_KEY = "tka:shop:cart";

interface BaseLine {
  productId: string;
  name: string;
  unitPrice: number; // cents, last-known; server re-resolves at checkout
  stripePriceId: string;
  qty: number;
}
export interface SkuLine extends BaseLine {
  kind: "sku";
}
export interface LoopDeckLine extends BaseLine {
  kind: "loopDeck";
  qty: 1;
  propType?: string;
  loopConfig: LoopConfig;
  /** Distinguishes two decks with the same productId but different configs. */
  configKey: string;
}
export type CartLine = SkuLine | LoopDeckLine;

/** A stored line plus a stable UI key. */
type StoredLine = CartLine & { key: string };

export interface CheckoutItem {
  productId: string;
  quantity: number;
  propType?: string;
  loopConfig?: LoopConfig;
}

function lineIdentity(line: CartLine): string {
  return line.kind === "loopDeck"
    ? `deck:${line.productId}:${line.configKey}`
    : `sku:${line.productId}`;
}

function load(): StoredLine[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredLine[]) : [];
  } catch {
    return [];
  }
}

export function createShopCart() {
  let lines = $state<StoredLine[]>(load());

  function persist() {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }

  function add(line: CartLine) {
    const key = lineIdentity(line);
    if (line.kind === "sku") {
      const existing = lines.find((l) => l.key === key);
      if (existing) {
        existing.qty += line.qty;
        persist();
        return;
      }
    }
    lines.push({ ...line, key });
    persist();
  }

  function setQty(key: string, qty: number) {
    const line = lines.find((l) => l.key === key);
    if (!line) return;
    if (line.kind === "loopDeck") {
      line.qty = 1; // configured decks are always singular
      persist();
      return;
    }
    if (qty < 1) {
      remove(key);
      return;
    }
    line.qty = qty;
    persist();
  }

  function remove(key: string) {
    lines = lines.filter((l) => l.key !== key);
    persist();
  }

  function clear() {
    lines = [];
    persist();
  }

  function toCheckoutItems(): CheckoutItem[] {
    return lines.map((l) =>
      l.kind === "loopDeck"
        ? {
            productId: l.productId,
            quantity: 1,
            ...(l.propType && { propType: l.propType }),
            loopConfig: l.loopConfig,
          }
        : { productId: l.productId, quantity: l.qty }
    );
  }

  return {
    get lines() { return lines; },
    get count() { return lines.reduce((n, l) => n + l.qty, 0); },
    get subtotal() { return lines.reduce((n, l) => n + l.unitPrice * l.qty, 0); },
    add,
    setQty,
    remove,
    clear,
    toCheckoutItems,
  };
}

export type ShopCart = ReturnType<typeof createShopCart>;

// One cart per browser tab, shared across /shop routes. Created lazily so SSR
// (no localStorage) doesn't touch storage at import time.
let sharedCart: ShopCart | null = null;
export function getShopCart(): ShopCart {
  if (!sharedCart) sharedCart = createShopCart();
  return sharedCart;
}

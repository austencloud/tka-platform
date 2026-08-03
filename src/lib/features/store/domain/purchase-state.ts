import type { Product } from "./models/product";

/**
 * What the buy area on a product page is allowed to offer right now.
 *
 * The shop can be browsable long before it can take money. Stripe payouts and
 * tax registration are still outstanding, so a "Buy Now" button anywhere on the
 * site would take a click and then fail — the exact dishonest state this
 * resolver exists to prevent. Every purchase surface asks this one function
 * what to render instead of each page deciding for itself.
 *
 *  - `buy`      — charge now, straight into checkout or the cart.
 *  - `preorder` — same money path, different promise: it ships later.
 *  - `notify`   — no money path at all; capture an email instead.
 */
export type PurchaseState = "buy" | "preorder" | "notify";

/**
 * The master switch for real charging, shop-wide.
 *
 * `false` until Austen finishes the two Stripe items (payout requirement and
 * tax registration). While it is false EVERY product resolves to `notify`, no
 * matter how well-configured its Stripe price is — a preorder is still a
 * charge, so it is blocked by the same gate. Flipping this to `true` is the
 * whole "go live" change; nothing else has to move.
 */
export const SALES_LIVE = false;

/**
 * The one place that decides Buy vs Pre-order vs Notify me.
 *
 * `salesLive` is passed in rather than read from the constant so tests (and a
 * future admin preview of the live shop) can resolve either world without
 * touching the module.
 */
export function resolvePurchaseState(product: Product, salesLive: boolean): PurchaseState {
  // Nothing sells while the shop can't charge.
  if (!salesLive) return "notify";
  // Drafts and sold-out SKUs never offer a purchase, even when priced.
  if (product.status !== "active") return "notify";
  // No Stripe price means checkout would 400 on arrival.
  if (!product.stripePriceId) return "notify";
  return product.preorder ? "preorder" : "buy";
}

/** CTA wording for a purchasable state. Pre-orders say so on the button, so a
 *  buyer never learns "ships in September" only after paying. */
export function purchaseCtaLabel(state: PurchaseState, mode: "buy" | "add" = "buy"): string {
  if (state === "preorder") return mode === "add" ? "Add pre-order to cart" : "Pre-order now";
  return mode === "add" ? "Add to cart" : "Buy now";
}

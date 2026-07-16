import type { Product } from "./models/product";

/**
 * Client mirror of the server-side price gate
 * (`firebase-functions/src/merch/resolveActivePrice.ts`).
 *
 * DISPLAY ONLY. The Firebase checkout function re-resolves the charged price
 * authoritatively with the server clock, and Stripe Checkout shows the real
 * price before payment — so a wrong client clock at most mislabels the storefront,
 * it never mischarges. Kept in sync by hand, the same convention the store already
 * uses for its function/client whitelist mirrors.
 *
 * `now` is read once at component init on the consuming surfaces (no ticking
 * timer): a page held open across the exact midnight boundary is negligible and
 * checkout re-resolves regardless.
 */

/** True while the preorder price is still the active one AND a higher regular
 *  price exists to jump to — i.e. the "goes up soon" note is meaningful. */
export function preorderWindowOpen(product: Product, nowMs: number): boolean {
  if (!product.preorderPriceCutoff || product.regularPrice == null) return false;
  const cutoff = Date.parse(product.preorderPriceCutoff);
  return !Number.isNaN(cutoff) && nowMs < cutoff;
}

/** The price charged right now, in cents. Preorder before the cutoff, regular
 *  at/after it. Falls back to preorder whenever a swap can't apply. */
export function activePriceCents(product: Product, nowMs: number): number {
  if (!product.preorderPriceCutoff || product.regularPrice == null) return product.price;
  const cutoff = Date.parse(product.preorderPriceCutoff);
  if (!Number.isNaN(cutoff) && nowMs >= cutoff) return product.regularPrice;
  return product.price;
}

/** `$35` when the price is a whole dollar amount, `$32.50` when it carries
 *  cents — the one price formatter every store surface renders through. */
export function formatUsd(cents: number): string {
  const dollars = cents / 100;
  return cents % 100 === 0 ? `$${dollars.toFixed(0)}` : `$${dollars.toFixed(2)}`;
}

/** "September 30" in the shop's timezone (Chicago), from the cutoff ISO instant.
 *  Empty string on an unparseable cutoff. */
export function cutoffLabel(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "America/Chicago",
  });
}

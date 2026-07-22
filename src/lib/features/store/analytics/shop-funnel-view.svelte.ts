/**
 * Step 1 of the shop funnel, as a rune-owning helper.
 *
 * All five entry pages need the same three-part rule — wait for the product
 * load to settle, fire once, never re-fire — and four of them had it hand-copied
 * verbatim (`let viewTracked = false` + a gated `$effect`). Owning the latch and
 * the effect in one place means a change to the rule (say, also skipping the
 * fire when the load actually errored, so a failed load stops emitting
 * `shop_product_viewed` with all-null SKU fields) is one edit instead of four,
 * three of which a future editor has no signal exist.
 *
 * Separate from `shop-funnel.ts` purely because `$effect` requires a `.svelte.ts`
 * module. Everything else in the funnel is plain TypeScript and stays there.
 *
 * Spec: docs/architecture/landing-analytics-taxonomy.md §3
 */
import { trackProductViewed, type ShopListing } from "./shop-funnel";
import type { Product } from "../domain/models/product";

/**
 * Call from a component's setup — NOT from inside an effect; it creates its own.
 * Both arguments are getters so the caller's reactive reads stay live.
 *
 *   trackViewOnceLoaded("loop-deck", () => store.isLoading, () => customSku);
 */
export function trackViewOnceLoaded(
  listing: ShopListing,
  isLoading: () => boolean,
  product: () => Product | null
): void {
  let tracked = false;
  $effect(() => {
    if (tracked || isLoading()) return;
    tracked = true;
    trackProductViewed(listing, product());
  });
}

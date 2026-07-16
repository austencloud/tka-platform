/**
 * Preorder → regular price gate.
 *
 * A deck sells at its preorder price (stripePriceId) until preorderPriceCutoff,
 * then at its regular price (regularStripePriceId). The gate is evaluated
 * server-side at checkout so a client can never force the cheaper price by
 * lying about the clock.
 *
 * Fail-safe by construction: anything unexpected (no cutoff, unparseable
 * cutoff, past cutoff but no regular price authored) resolves to the preorder
 * price. A mis-authored product charges the lower price rather than blocking
 * the sale — a lost margin is recoverable, a refused checkout is not.
 */
export interface PriceGateProduct {
  readonly stripePriceId: string;
  readonly regularStripePriceId?: string;
  /** ISO instant (e.g. "2026-09-30T23:59:59-05:00"). Absent ⇒ evergreen. */
  readonly preorderPriceCutoff?: string;
}

export function resolveActivePriceId(product: PriceGateProduct, nowMs: number): string {
  const { stripePriceId, regularStripePriceId, preorderPriceCutoff } = product;
  if (!preorderPriceCutoff) return stripePriceId; // evergreen — no swap window
  const cutoffMs = Date.parse(preorderPriceCutoff);
  if (Number.isNaN(cutoffMs)) return stripePriceId; // bad date → fail safe to preorder
  if (nowMs >= cutoffMs && regularStripePriceId) return regularStripePriceId;
  return stripePriceId;
}

/** True only when the product IS past its cutoff yet has no regular price to
 *  charge — the one state worth logging (a Stripe authoring mistake). */
export function isMisauthoredPastCutoff(product: PriceGateProduct, nowMs: number): boolean {
  const { regularStripePriceId, preorderPriceCutoff } = product;
  if (!preorderPriceCutoff || regularStripePriceId) return false;
  const cutoffMs = Date.parse(preorderPriceCutoff);
  return !Number.isNaN(cutoffMs) && nowMs >= cutoffMs;
}

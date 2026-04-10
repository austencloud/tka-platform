import type { StanceVariant } from "../../domain/types";

/**
 * Supplies the set of stance variants the reviewer can cycle through
 * for any pose. Phase 1 returns four upper-body orientation variants;
 * later phases may add foot-placement variants when proper leg IK is
 * available.
 */
export interface IStanceVariantProvider {
  /** Returns all available variants, ordered by index (0..N-1). */
  getAll(): StanceVariant[];

  /**
   * Returns the variant at the given index, clamping to a valid range.
   * Never throws.
   */
  getVariant(index: number): StanceVariant;

  /** Number of variants available. */
  count(): number;
}

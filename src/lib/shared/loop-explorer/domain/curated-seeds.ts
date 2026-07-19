/**
 * Loop Explorer — Curated Seed Pool (fallback)
 *
 * Pre-verified sequences per (LOOPType, slice), used when
 * `explorer-generator.generateVerifiedExample` exhausts its retries without
 * the detector confirming an exact component-set match. Per spec ("Two-pane
 * linked explanation" / "Self-verifying generation"), this is the LAST
 * resort — the generator always tries live generation first.
 *
 * STUB (Task A2, 2026-07-19): starts empty. Task A3's offline verification
 * harness (`scripts/verify-loop-explorer.mjs`) enumerates every implemented
 * combo × legal slice, mass-generates, cross-checks app + engine detectors,
 * and emits `curated-seeds.json` with real verified sequences — that output
 * replaces/populates this module. Until then, combos that fail live
 * generation return `null` from `generateVerifiedExample` (the showcase
 * shows a retry state, never a wrong example) rather than silently forcing
 * one that hasn't been checked.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { LOOPType } from "$lib/shared/foundation/domain/models/generation/circular-models";
import type { LoopSlice } from "./legality";

export interface CuratedSeed {
  readonly loopType: LOOPType;
  readonly slice: LoopSlice;
  readonly sequence: SequenceData;
}

/**
 * Empty until A3 lands. Kept as a real array (not undefined) so
 * `findCuratedSeed` never needs a null-pool branch.
 */
export const CURATED_SEEDS: readonly CuratedSeed[] = [];

export function findCuratedSeed(loopType: LOOPType, slice: LoopSlice): SequenceData | null {
  const match = CURATED_SEEDS.find((s) => s.loopType === loopType && s.slice === slice);
  return match?.sequence ?? null;
}

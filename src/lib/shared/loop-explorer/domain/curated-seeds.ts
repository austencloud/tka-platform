/**
 * Loop Explorer — Curated Seed Pool (fallback)
 *
 * Pre-verified sequences per (LOOPType, slice), used when
 * `explorer-generator.generateVerifiedExample` exhausts its retries without
 * the detector confirming an exact component-set match. Per spec ("Two-pane
 * linked explanation" / "Self-verifying generation"), this is the LAST
 * resort — the generator always tries live generation first.
 *
 * Populated from `curated-seeds.json`, Task A3's offline verification
 * harness output (`scripts/verify-loop-explorer.mjs`): every implemented
 * combo x legal slice, mass-generated, cross-checked against the app and
 * engine detectors. Shape: `{ [loopType]: { [slice]: SequenceData[] } }` —
 * multiple verified sequences per combo so refresh can vary even on the
 * fallback path. `mirrored_rotated_swapped@halved` has zero verified seeds
 * (see the harness report's Findings section — the combo's own generator
 * path crashes on end-position selection); `findCuratedSeed` returns null
 * for that pair and the showcase shows its "couldn't verify" state, which is
 * honest given no seed has actually been verified.
 */

import curatedSeedsJson from "./curated-seeds.json";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { LOOPType } from "$lib/shared/foundation/domain/models/generation/circular-models";
import type { LoopSlice } from "./legality";

export interface CuratedSeed {
  readonly loopType: LOOPType;
  readonly slice: LoopSlice;
  readonly sequence: SequenceData;
}

type CuratedSeedsJson = Record<string, Partial<Record<LoopSlice, SequenceData[]>>>;

const RAW = curatedSeedsJson as unknown as CuratedSeedsJson;

/** Flattened for inspection/tests; `findCuratedSeed` reads `RAW` directly. */
export const CURATED_SEEDS: readonly CuratedSeed[] = Object.entries(RAW).flatMap(
  ([loopType, bySlice]) =>
    Object.entries(bySlice ?? {}).flatMap(([slice, sequences]) =>
      (sequences ?? []).map((sequence) => ({
        loopType: loopType as LOOPType,
        slice: slice as LoopSlice,
        sequence,
      }))
    )
);

/**
 * Picks a random verified seed for the (loopType, slice) pair so a refresh
 * that falls all the way through to the curated pool still shows variety
 * instead of the same fixed example every time. Returns null when the
 * harness verified zero seeds for this pair (see module doc).
 */
export function findCuratedSeed(loopType: LOOPType, slice: LoopSlice): SequenceData | null {
  const pool = RAW[loopType]?.[slice];
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

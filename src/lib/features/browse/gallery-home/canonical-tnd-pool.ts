/**
 * Canonical T&D pool — the defined Timing & Direction alphabet as FIRST-CLASS
 * gallery citizens. Every base seed (word "AAAA" etc.) and every one of its
 * 7x7 blue|red turn combinations becomes a normal SequenceData in the browse
 * pool: searchable, filterable, sortable, and word-collapsed by the grid into
 * one card whose variation picker holds the 49 turn combos — exactly like any
 * community word with saved variations. No special container, no special modal.
 *
 * Born 2022-03-27 (when the system came to Austen); 0|0 = level 1 (no turns),
 * every turned combo = level 2 (turns, radial-only resolution).
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { updateSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { TND_ELEMENTS } from "$lib/features/choreo-card/domain/tnd-element";
import { resolveTnDFamilyCards } from "$lib/features/lab/vtg-lab/services/resolve-tnd-family-cards";

/** The day the Timing & Direction system was conceived. */
const TND_BIRTHDAY = new Date("2022-03-27T00:00:00Z");

/** Filename-safe turn token ("1.5|0" → "1p5-0"). Lexicographic order of these
 * tokens matches ascending turn order ("0" < "0p5" < "1" < "1p5" < ... < "3"),
 * so the variation picker's id-tiebreak sort walks the grid low-to-high with
 * 0|0 (the representative card) first. */
function safeTurn(pattern: string): string {
  return pattern.replace(/\|/g, "-").replace(/\./g, "p");
}

let poolPromise: Promise<readonly SequenceData[]> | null = null;

/**
 * Resolve the full canonical pool (all six families × all 49 turn patterns).
 * Cached for the session — the defined alphabet is immutable. Rejection clears
 * the cache so a transient failure (offline catalog fetch) retries next load.
 */
export function loadCanonicalTnDSequences(): Promise<readonly SequenceData[]> {
  if (!poolPromise) {
    poolPromise = resolvePool().catch((err) => {
      poolPromise = null;
      throw err;
    });
  }
  return poolPromise;
}

async function resolvePool(): Promise<readonly SequenceData[]> {
  const out: SequenceData[] = [];
  // Sequential per family: each call shares the same cached base catalog, and
  // the resolution work is CPU-bound — parallelism buys nothing but jank.
  for (const element of TND_ELEMENTS) {
    const matrices = await resolveTnDFamilyCards(element.familyId);
    for (const matrix of matrices) {
      for (const [pattern, seq] of matrix.byTurn) {
        out.push(
          updateSequenceData(seq, {
            // byTurn variants share the seed's id — tag per combo so engine
            // dedupe and the (word, id)-keyed thumbnail cache see 49 sequences.
            id: `${matrix.seedId}__t_${safeTurn(pattern)}`,
            dateAdded: TND_BIRTHDAY,
            birthday: TND_BIRTHDAY,
            level: pattern === "0|0" ? 1 : 2,
          }),
        );
      }
    }
  }
  return out;
}

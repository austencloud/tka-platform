/**
 * Canonical T&D pool — the defined Timing & Direction alphabet as FIRST-CLASS
 * gallery citizens. Every base seed (word "AAAA" etc.) and every one of its
 * 7x7 blue|red turn combinations becomes a normal SequenceData in the browse
 * pool: searchable, filterable, sortable, and word-collapsed by the grid into
 * one card whose variation picker holds the 49 turn combos — exactly like any
 * community word with saved variations. No special container, no special modal.
 *
 * Born 2022-03-27 (when the system came to Austen). Level comes from the
 * canonical difficulty calculator reading each combo's real steps — NOT a
 * blanket rule. A hardcoded "turned = level 2" shipped level-3 combos (half
 * turns end non-radial) wearing stored level 2, so the drill's Level 2 fan
 * card was fronted by a sequence whose printed badge said 3.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { updateSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { TND_ELEMENTS } from "$lib/features/choreo-card/domain/tnd-element";
import { resolveTnDFamilyCards } from "$lib/features/lab/vtg-lab/services/resolve-tnd-family-cards";
import { calculateDifficultyLevel } from "$lib/shared/browse/services/sequence-difficulty-calculator";
import { processReversals } from "$lib/shared/create/services/reversal-detector";

/** Reserved author for the defined T&D alphabet, so it is filterable and
 *  isolatable from user-submitted community sequences. */
export const CANONICAL_TND_AUTHOR = "T&D Alphabet";

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
        const tagged = updateSequenceData(seq, {
          // byTurn variants share the seed's id — tag per combo so engine
          // dedupe and the (word, id)-keyed thumbnail cache see 49 sequences.
          id: `${matrix.seedId}__t_${safeTurn(pattern)}`,
          author: CANONICAL_TND_AUTHOR,
          dateAdded: TND_BIRTHDAY,
          birthday: TND_BIRTHDAY,
          // Same calculator that prints the card's difficulty badge — stored
          // level and printed badge can never disagree. Whole turns resolve
          // radial (level 2); half turns end non-radial (level 3).
          level: calculateDifficultyLevel([...(seq.steps ?? [])]),
        });
        // Re-derive reversal dots from the turn-applied motions. The canonical
        // display policy re-derives reversal flags on every hydrate, but these
        // pool sequences bypass the hydrate pipeline and the viewer trusts baked
        // flags (getStepData returns steps verbatim). Without this a continuous
        // card (all pro cw, zero reversals) renders spurious dots from stale
        // seed flags.
        out.push(processReversals(tagged));
      }
    }
  }
  return out;
}

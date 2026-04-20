/**
 * LOOP End Orientation Selector
 *
 * Determines the required end orientation for a LOOP-generator partial sequence
 * so that the full extended sequence closes in BOTH position and orientation.
 *
 * Mirrors LOOPEndPositionSelector but operates on the orientation wheel
 * {in, clock, out, counter} (L1–L6) / 8-point wheel (L7+).
 *
 * ## Orientation arithmetic primer
 *
 * Orientations form a cyclic group at each level:
 *   L1–L6: 4-cycle {in=0, clock=1, out=2, counter=3}
 *   L7+:   8-cycle (reserved; not yet in the typed Orientation enum)
 *
 * A sequence's "per-pass orientation delta" is the change in (blue, red)
 * orientation from the sequence's start to its end, measured in quarter turns
 * mod 4. For a LOOP to close after N passes, every per-pass delta (dᵢ) must
 * satisfy `N · dᵢ ≡ 0 (mod 4)`.
 *
 * ## Per-LOOP-type behavior
 *
 * Different LOOP types impose different requirements:
 *
 * | LOOP type | Location domain | Orientation requirement |
 * |---|---|---|
 * | ROTATED (period 2) | end = 180°-rotated start | end orientation = start |
 * | ROTATED (period 4) | end = 90°-rotated start | end orientation = start |
 * | ROTATED (orientation domain, period 4) | end = start | end orientation = start + 1q |
 * | MIRRORED | end = vertical-mirror of start | end orientation = start (both hands) |
 * | FLIPPED | end = horizontal-mirror of start | end orientation = start |
 * | SWAPPED | end = swapped blue/red of start | end orientation = swapped of start |
 * | INVERTED | end = start | end orientation = start (inverted motions preserve orientation parity) |
 * | REWOUND | no positional constraint | end orientation = start (reversed play preserves) |
 *
 * "1q" = one quarter turn = +1 on the 4-cycle.
 *
 * ## Why these values
 *
 * For every non-ROTATED LOOP type with period 2, the transformation applied
 * by the second pass reverses any orientation drift in the first pass, so the
 * per-pass delta must be self-cancelling (i.e., zero) to close. That means
 * `endOri(pass1) = startOri(pass1)` — the end orientation equals the start.
 *
 * For ROTATED at period 4 operating in the orientation domain only (positions
 * stay pinned), each pass advances orientations by a quarter turn so after
 * 4 passes you complete the full cycle. `endOri(pass1) = startOri + 1q`.
 *
 * SWAPPED at period 2 is special: since blue and red swap roles each pass,
 * the "end orientation for blue" after pass 1 is what "red's start orientation"
 * will be at the top of pass 2. For closure, pass 1's end blue = pass 1's
 * start red, and pass 1's end red = pass 1's start blue. This handles cases
 * where blue and red start in different orientations.
 */

import { LOOPType } from "../loop-types.js";
import type { Orientation } from "../../core/types/sequence-engine-types.js";

/**
 * Domain on which a LOOP transformation operates.
 *
 * - `location`: grid positions transform between passes (canonical LOOP)
 * - `orientation`: orientations transform between passes (positions pinned)
 * - `both`: both spaces transform
 *
 * Passed to the end-orientation selector to pick the right closure rule.
 */
export type LOOPDomain = "location" | "orientation" | "both";

/**
 * 4-cycle orientation index. Maps the canonical Orientation strings onto
 * quarter-turn counts for arithmetic. L7+ 8-cycle support uses a separate
 * extended index type not modeled here yet.
 */
const ORIENTATION_TO_INDEX: Record<string, number> = {
  in: 0,
  clock: 1,
  out: 2,
  counter: 3,
};

const INDEX_TO_ORIENTATION: readonly string[] = ["in", "clock", "out", "counter"];

/**
 * Advance an orientation by N quarter turns on the 4-cycle.
 * Negative N rewinds.
 */
export function advanceOrientation(
  ori: Orientation,
  quarterTurns: number
): Orientation {
  const current = ORIENTATION_TO_INDEX[ori];
  if (current === undefined) return ori;
  const next = (((current + quarterTurns) % 4) + 4) % 4;
  return INDEX_TO_ORIENTATION[next] as Orientation;
}

export interface EndOrientationRequirement {
  /** Required end orientation for the blue hand at the last beat. */
  blueEndOrientation: Orientation;
  /** Required end orientation for the red hand at the last beat. */
  redEndOrientation: Orientation;
}

export interface EndOrientationArgs {
  loopType: LOOPType;
  period: number;
  domain: LOOPDomain;
  blueStartOrientation: Orientation;
  redStartOrientation: Orientation;
}

/**
 * Determine the required (blueEndOri, redEndOri) so that the partial sequence,
 * when LOOP-extended, closes in orientation after `period` passes.
 */
export class LOOPEndOrientationSelector {
  determineEndOrientations(args: EndOrientationArgs): EndOrientationRequirement {
    const { loopType, period, domain } = args;

    // ROTATED in orientation domain at period 4: per-pass advance by 1 quarter
    // turn so 4 passes complete the full cycle. Positions stay pinned.
    if (loopType === LOOPType.ROTATED && domain === "orientation" && period === 4) {
      return {
        blueEndOrientation: advanceOrientation(args.blueStartOrientation, 1),
        redEndOrientation: advanceOrientation(args.redStartOrientation, 1),
      };
    }

    // SWAPPED at period 2: end orientation must equal start orientation of
    // the OTHER hand so pass 2 (with swapped roles) picks up cleanly.
    if (loopType === LOOPType.SWAPPED && period === 2) {
      return {
        blueEndOrientation: args.redStartOrientation,
        redEndOrientation: args.blueStartOrientation,
      };
    }

    // Default: end orientation equals start orientation for both hands.
    // Covers ROTATED location-domain, MIRRORED, FLIPPED, INVERTED, REWOUND,
    // and period-4-via-orientation-extension of any non-ROTATED type.
    return {
      blueEndOrientation: args.blueStartOrientation,
      redEndOrientation: args.redStartOrientation,
    };
  }
}

export const loopEndOrientationSelector = new LOOPEndOrientationSelector();

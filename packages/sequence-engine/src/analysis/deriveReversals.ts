/**
 * deriveReversals — pure function that computes per-hand reversal flags for
 * a sequence of Step values.
 *
 * A "reversal" occurs when a hand's rotation direction flips between two
 * consecutive non-blank steps. Rules:
 *   - Step 0 (start position) is never a reversal.
 *   - A step whose current rotation direction is `noRotation` is never a reversal.
 *   - A reversal against the prior active direction requires that the prior
 *     hand's rotation direction was active (not `noRotation`). If the prior
 *     was `noRotation`, the chain has no anchor to reverse against.
 *   - Blank steps (isBlank === true) break the rotation chain. The next real
 *     step after a blank has no prior direction, so it reports no reversal.
 *
 * The returned array is index-aligned with the input. Output order and length
 * are identical to the input; callers can zip the results back onto steps for
 * display.
 */

import type { Step } from "@tka/tka-types";

export interface StepReversals {
  readonly blue: boolean;
  readonly red: boolean;
}

/**
 * Compute reversal flags for each step. Pure function: no side effects.
 *
 * Implementation lands in the green pass.
 */
export function deriveReversals(
  _steps: readonly Step[]
): ReadonlyArray<StepReversals> {
  throw new Error("NotImplemented: deriveReversals — green pass pending");
}

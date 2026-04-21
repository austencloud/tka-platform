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

import type { Step, RotationDirection } from "@tka/tka-types";

export interface StepReversals {
  readonly blue: boolean;
  readonly red: boolean;
}

const NO_REVERSAL: StepReversals = Object.freeze({ blue: false, red: false });

/**
 * Compute reversal flags for each step. Pure function: no side effects.
 */
export function deriveReversals(
  steps: readonly Step[]
): ReadonlyArray<StepReversals> {
  const out: StepReversals[] = [];
  let priorBlueDir: RotationDirection | null = null;
  let priorRedDir: RotationDirection | null = null;

  for (const step of steps) {
    // Start-position step (stepNumber 0) is never a reversal and leaves no
    // anchor behind: its motions are static with noRotation.
    if (step.stepNumber === 0) {
      out.push(NO_REVERSAL);
      priorBlueDir = null;
      priorRedDir = null;
      continue;
    }

    // Blank steps are never a reversal themselves AND break the chain so the
    // next real step has no prior direction to reverse against.
    if (step.isBlank) {
      out.push(NO_REVERSAL);
      priorBlueDir = null;
      priorRedDir = null;
      continue;
    }

    const blueDir = step.motions.blue.rotationDirection;
    const redDir = step.motions.red.rotationDirection;

    const blueRev = isReversal(priorBlueDir, blueDir);
    const redRev = isReversal(priorRedDir, redDir);

    out.push(Object.freeze({ blue: blueRev, red: redRev }));

    // Only active directions anchor a future reversal. A noRotation current
    // step does not replace an earlier active anchor — the chain continues
    // from whatever the last active direction was.
    if (blueDir !== "noRotation") priorBlueDir = blueDir;
    if (redDir !== "noRotation") priorRedDir = redDir;
  }

  return out;
}

function isReversal(
  prior: RotationDirection | null,
  current: RotationDirection
): boolean {
  if (prior === null) return false;
  if (prior === "noRotation") return false;
  if (current === "noRotation") return false;
  return prior !== current;
}

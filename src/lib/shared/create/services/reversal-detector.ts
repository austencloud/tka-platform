/**
 * reversal-detector.ts
 *
 * App adapter over THE canonical reversal detector, `deriveReversals` in
 * `@tka/sequence-engine`. This module keeps the app-facing API (SequenceData
 * in, StepData out, option-preview helpers) and delegates detection
 * semantics — loop wrap, transparent blank/noRotation chains — to the engine.
 *
 * DISPLAY POLICY (Austen, 2026-07-05): the pictograph reversal DOTS are for
 * prop-direction reversals ONLY. This adapter therefore consumes the engine's
 * `propReversal` channel exclusively — a dot appears iff the prop's rotation
 * direction flips (which covers prop reversals AND full reversals; both flip
 * prop direction). Byte-identical to the legacy rotation-only detector over
 * the published corpus (proven in tests/unit/hand-arc-reversal-impact.test.ts).
 *
 * The engine's `handReversal` channel (hand retraces its arc, prop continues
 * — MCP hand-reversal type) is deliberately NOT read here. It is a separate,
 * non-display signal retained for future consumers (e.g. the practice
 * judgment loop).
 */

import { deriveReversals } from "@tka/sequence-engine";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import { createStepData } from "$lib/shared/foundation/domain/factories/create-step-data";

/**
 * Reversal Detection Service Contract
 */
export interface ReversalInfo {
  blueReversal: boolean;
  redReversal: boolean;
}

export interface PictographWithReversals extends PictographData {
  blueReversal: boolean;
  redReversal: boolean;
}

/**
 * Process reversals for an entire sequence.
 *
 * For loop sequences (rotated, mirrored, etc.) the last steps wrap into the
 * first steps, so step 1's "previous" context includes the tail of the
 * sequence — the engine detector handles the wrap when `loop` is set.
 *
 * Dots = engine `propReversal` channel only (display policy above).
 */
export function processReversals(sequence: SequenceData): SequenceData {
  const flags = deriveReversals(sequence.steps, {
    loop: !!sequence.loopType,
  });

  const processedSteps = sequence.steps.map((step, i) =>
    applyReversalSymbols(step, {
      blueReversal: flags[i]?.blue.propReversal ?? false,
      redReversal: flags[i]?.red.propReversal ?? false,
    })
  );

  return {
    ...sequence,
    steps: processedSteps,
  };
}

/**
 * Detect reversal (dot channel: prop-direction flip) for a single step based
 * on previous steps (non-loop context: no wrap).
 */
export function detectReversal(
  previousSteps: StepData[],
  currentStep: StepData
): ReversalInfo {
  const flags = deriveReversals([...previousSteps, currentStep]);
  const last = flags[flags.length - 1];
  return {
    blueReversal: last?.blue.propReversal ?? false,
    redReversal: last?.red.propReversal ?? false,
  };
}

/**
 * Apply reversal symbols to a step
 */
export function applyReversalSymbols(
  stepData: StepData,
  reversalInfo: ReversalInfo
): StepData {
  return createStepData({
    ...stepData,
    blueReversal: reversalInfo.blueReversal,
    redReversal: reversalInfo.redReversal,
  });
}

/**
 * Detect reversal for an option preview based on current sequence.
 * Used to show reversal indicators on options before they're selected.
 * Dot channel only: prop rotation-direction flip.
 */
export function detectReversalForOption(
  currentSequence: StepData[],
  optionPictographData: PictographData
): ReversalInfo {
  const reversalInfo: ReversalInfo = {
    blueReversal: false,
    redReversal: false,
  };

  if (!optionPictographData.motions) {
    return reversalInfo;
  }

  // If sequence is empty, no reversals possible
  if (currentSequence.length === 0) {
    return reversalInfo;
  }

  reversalInfo.blueReversal = propFlips(
    lastActivePropDir(currentSequence, "blue"),
    optionPictographData.motions.blue
  );
  reversalInfo.redReversal = propFlips(
    lastActivePropDir(currentSequence, "red"),
    optionPictographData.motions.red
  );

  return reversalInfo;
}

/**
 * Detect reversals for multiple option pictographs at once.
 * Optimized for option picker display where we need to show reversals for all options.
 */
export function detectReversalsForOptions(
  currentSequence: PictographData[],
  options: PictographData[]
): PictographWithReversals[] {
  // If sequence is empty, no reversals possible
  if (currentSequence.length === 0) {
    return options.map((option) => ({
      ...option,
      blueReversal: false,
      redReversal: false,
    }));
  }

  // Anchor once for the whole option set.
  const blueAnchor = lastActivePropDir(currentSequence, "blue");
  const redAnchor = lastActivePropDir(currentSequence, "red");

  return options.map((option) => {
    if (!option.motions) {
      return { ...option, blueReversal: false, redReversal: false };
    }
    return {
      ...option,
      blueReversal: propFlips(blueAnchor, option.motions.blue),
      redReversal: propFlips(redAnchor, option.motions.red),
    };
  });
}

// ============================================================================
// MODULE-PRIVATE HELPERS (option-preview dot channel — prop rotation only)
// ============================================================================

interface MotionLike {
  readonly rotationDirection?: string;
  readonly motionType?: string;
}

interface SignalCarrier {
  readonly isBlank?: boolean;
  readonly motions?: {
    readonly blue?: MotionLike | null;
    readonly red?: MotionLike | null;
  } | null;
}

/**
 * Prop rotation of a motion with the production fallbacks: explicit value
 * wins; static/dash without one legitimately have no rotation; pro/anti/float
 * without one is bad data → warn and default cw.
 */
function propDirOf(motion: MotionLike | null | undefined): string | null {
  if (!motion) return null;
  if (motion.rotationDirection) return motion.rotationDirection;
  if (motion.motionType === "static" || motion.motionType === "dash") {
    return "noRotation";
  }
  console.warn(
    `Missing rotationDirection for motion type "${motion.motionType}". Defaulting to 'cw'.`
  );
  return "cw";
}

/**
 * Last active prop rotation direction for one hand, walking backwards through
 * the sequence and looking past blanks / noRotation (production semantics).
 */
function lastActivePropDir(
  items: readonly SignalCarrier[],
  color: "blue" | "red"
): string | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (!item || item.isBlank) continue;
    const motion = item.motions?.[color];
    if (!motion) continue;
    const dir = propDirOf(motion);
    if (dir && dir !== "noRotation") return dir;
  }
  return null;
}

/**
 * Dot rule for an option's motion against the sequence anchor: the prop's
 * rotation direction flips. The option side reads the raw rotationDirection
 * (no bad-data defaulting), preserving the legacy option-preview behavior.
 */
function propFlips(
  anchor: string | null,
  motion: MotionLike | null | undefined
): boolean {
  if (!anchor || !motion) return false;
  const cur = motion.rotationDirection || null;
  return cur !== null && cur !== "noRotation" && cur !== anchor;
}

// ============================================================================
// SINGLETON EXPORT (backward-compatible object form for class consumers)
// ============================================================================
export const reversalDetector = {
  processReversals,
  detectReversal,
  applyReversalSymbols,
  detectReversalForOption,
  detectReversalsForOptions,
};

/** Structural type matching the reversal-detector module's public API. */
export type ReversalDetector = typeof reversalDetector;

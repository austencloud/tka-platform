/**
 * reversal-detector.ts
 *
 * App adapter over THE canonical reversal detector,
 * `deriveReversals` in `@tka/sequence-engine` (hand-arc aware since
 * 2026-07-05). This module keeps the app-facing API (SequenceData in,
 * StepData out, option-preview helpers) and delegates all detection
 * semantics — loop wrap, transparent blank/noRotation chains, and the
 * two-signal (prop rotation + hand arc) reversal rule — to the engine.
 *
 * Why two signals: pro/anti is the relation between prop rotation and the
 * hand's arc (MCP ground truth). Comparing `rotationDirection` alone missed
 * hand reversals (hand retraces, prop spin unchanged). See
 * packages/sequence-engine/src/analysis/deriveReversals.ts for the canon.
 */

import {
  deriveReversals,
  handArcDirection,
  propRotationDirection,
  type MotionSignalSource,
} from "@tka/sequence-engine";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import { createStepData } from "$lib/shared/create/factories/create-step-data";

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
 */
export function processReversals(sequence: SequenceData): SequenceData {
  const flags = deriveReversals(sequence.steps, {
    loop: !!sequence.loopType,
  });

  const processedSteps = sequence.steps.map((step, i) =>
    applyReversalSymbols(step, {
      blueReversal: flags[i]?.blue ?? false,
      redReversal: flags[i]?.red ?? false,
    })
  );

  return {
    ...sequence,
    steps: processedSteps,
  };
}

/**
 * Detect reversal for a single step based on previous steps (non-loop
 * context: no wrap).
 */
export function detectReversal(
  previousSteps: StepData[],
  currentStep: StepData
): ReversalInfo {
  const flags = deriveReversals([...previousSteps, currentStep]);
  const last = flags[flags.length - 1];
  return {
    blueReversal: last?.blue ?? false,
    redReversal: last?.red ?? false,
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

  reversalInfo.blueReversal = optionFlips(
    currentSequence,
    optionPictographData,
    "blue"
  );
  reversalInfo.redReversal = optionFlips(
    currentSequence,
    optionPictographData,
    "red"
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
  const blueAnchor = lastActiveSignals(currentSequence, "blue");
  const redAnchor = lastActiveSignals(currentSequence, "red");

  return options.map((option) => {
    if (!option.motions) {
      return { ...option, blueReversal: false, redReversal: false };
    }
    return {
      ...option,
      blueReversal: flipsAgainst(blueAnchor, option.motions.blue),
      redReversal: flipsAgainst(redAnchor, option.motions.red),
    };
  });
}

// ============================================================================
// MODULE-PRIVATE HELPERS
// ============================================================================

interface SignalAnchors {
  prop: "cw" | "ccw" | null;
  arc: "cw" | "ccw" | null;
}

interface SignalCarrier {
  readonly isBlank?: boolean;
  readonly motions?: {
    readonly blue?: MotionSignalSource | null;
    readonly red?: MotionSignalSource | null;
  } | null;
}

/**
 * Last active prop-rotation and hand-arc values for one hand, walking
 * backwards through the sequence. Each signal anchors independently and looks
 * past blanks / inactive values (production chain semantics).
 */
function lastActiveSignals(
  items: readonly SignalCarrier[],
  color: "blue" | "red"
): SignalAnchors {
  let prop: "cw" | "ccw" | null = null;
  let arc: "cw" | "ccw" | null = null;

  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (!item || item.isBlank) continue;
    const motion = item.motions?.[color];
    if (!motion) continue;

    if (prop === null) {
      const p = propRotationDirection(motion);
      if (p === "cw" || p === "ccw") prop = p;
    }
    if (arc === null) {
      arc = handArcDirection(motion);
    }
    if (prop !== null && arc !== null) break;
  }

  return { prop, arc };
}

/**
 * Reversal rule for an option's motion against the sequence anchors: either
 * the prop rotation or the hand arc flips. The option's prop side reads the
 * raw rotationDirection (no bad-data defaulting), preserving the pre-existing
 * option-preview behavior; the arc side is the new hand-reversal signal.
 */
function flipsAgainst(
  anchors: SignalAnchors,
  motion: MotionSignalSource | null | undefined
): boolean {
  if (!motion) return false;

  const curProp = motion.rotationDirection || null;
  const propFlip =
    anchors.prop !== null &&
    curProp !== null &&
    curProp !== "noRotation" &&
    curProp !== anchors.prop;

  const curArc = handArcDirection(motion);
  const arcFlip =
    anchors.arc !== null && curArc !== null && curArc !== anchors.arc;

  return propFlip || arcFlip;
}

function optionFlips(
  currentSequence: readonly SignalCarrier[],
  option: PictographData,
  color: "blue" | "red"
): boolean {
  const anchors = lastActiveSignals(currentSequence, color);
  return flipsAgainst(anchors, option.motions?.[color]);
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

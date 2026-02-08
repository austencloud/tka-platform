/**
 * Spell Stats Calculator
 *
 * Calculates statistics from a generated sequence for display in the UI.
 * Analyzes prop reversals, dash count, and hand path changes.
 *
 * Hand path is DERIVED from startLocation → endLocation, not read from a field.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { SequenceStats } from "../../domain/models/spell-models";
import { MotionType, HandPath } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

// Clockwise movement pairs: start_end
const CLOCKWISE_PAIRS = new Set([
  "s_w", "w_n", "n_e", "e_s",           // Cardinal
  "ne_se", "se_sw", "sw_nw", "nw_ne",   // Intercardinal
  // Cross pairs (cardinal to intercardinal, clockwise)
  "n_ne", "ne_e", "e_se", "se_s",
  "s_sw", "sw_w", "w_nw", "nw_n",
]);

// Counter-clockwise movement pairs: start_end
const CCW_PAIRS = new Set([
  "w_s", "n_w", "e_n", "s_e",           // Cardinal
  "ne_nw", "nw_sw", "sw_se", "se_ne",   // Intercardinal
  // Cross pairs (cardinal to intercardinal, counter-clockwise)
  "n_nw", "nw_w", "w_sw", "sw_s",
  "s_se", "se_e", "e_ne", "ne_n",
]);

// Dash pairs (opposite locations)
const DASH_PAIRS = new Set([
  "s_n", "n_s", "w_e", "e_w",           // Cardinal opposites
  "ne_sw", "sw_ne", "se_nw", "nw_se",   // Intercardinal opposites
]);

// Center → perimeter (hash-out)
const HASH_OUT_PAIRS = new Set([
  "c_n", "c_e", "c_s", "c_w",
  "c_ne", "c_se", "c_sw", "c_nw",
]);

// Perimeter → center (hash-in)
const HASH_IN_PAIRS = new Set([
  "n_c", "e_c", "s_c", "w_c",
  "ne_c", "se_c", "sw_c", "nw_c",
]);

/**
 * Derive hand path direction from start and end locations
 */
function deriveHandPath(startLocation: string, endLocation: string): HandPath {
  // Static: same location
  if (startLocation === endLocation) {
    return HandPath.STATIC;
  }

  const key = `${startLocation}_${endLocation}`;

  if (CLOCKWISE_PAIRS.has(key)) {
    return HandPath.CLOCKWISE;
  }

  if (CCW_PAIRS.has(key)) {
    return HandPath.COUNTER_CLOCKWISE;
  }

  if (DASH_PAIRS.has(key)) {
    return HandPath.DASH;
  }

  if (HASH_OUT_PAIRS.has(key)) {
    return HandPath.HASH_OUT;
  }

  if (HASH_IN_PAIRS.has(key)) {
    return HandPath.HASH_IN;
  }

  // Fallback for unknown pairs - treat as static
  return HandPath.STATIC;
}

export interface ISpellStatsCalculator {
  calculateStats(sequence: SequenceData): SequenceStats;
}

export class SpellStatsCalculator implements ISpellStatsCalculator {
  calculateStats(sequence: SequenceData): SequenceStats {
    const steps = sequence.steps || [];
    const totalSteps = steps.length;

    if (totalSteps === 0) {
      return {
        totalSteps: 0,
        propReversals: 0,
        dashCount: 0,
        handPathChanges: 0,
        propContinuityPercent: 100,
        handPathContinuityPercent: 100,
      };
    }

    // Count prop reversals (using the reversal flags already set on steps)
    let propReversals = 0;
    for (const step of steps) {
      if (step.blueReversal) propReversals++;
      if (step.redReversal) propReversals++;
    }

    // Count dash motions
    let dashCount = 0;
    for (const step of steps) {
      const blueMotion = step.motions?.blue;
      const redMotion = step.motions?.red;
      if (blueMotion?.motionType === MotionType.DASH) dashCount++;
      if (redMotion?.motionType === MotionType.DASH) dashCount++;
    }

    // Count hand path changes (comparing consecutive steps)
    let handPathChanges = 0;
    for (let i = 1; i < steps.length; i++) {
      const prevStep = steps[i - 1];
      const currStep = steps[i];

      if (prevStep && currStep) {
        // Check blue hand path change
        // Only cw↔ccw counts as a reversal; dash and static are neutral
        const prevBlueHandPath = this.getHandPath(prevStep, "blue");
        const currBlueHandPath = this.getHandPath(currStep, "blue");
        if (this.isHandPathReversal(prevBlueHandPath, currBlueHandPath)) {
          handPathChanges++;
        }

        // Check red hand path change
        const prevRedHandPath = this.getHandPath(prevStep, "red");
        const currRedHandPath = this.getHandPath(currStep, "red");
        if (this.isHandPathReversal(prevRedHandPath, currRedHandPath)) {
          handPathChanges++;
        }
      }
    }

    // Calculate continuity percentages
    // For prop: steps without any reversal / total steps
    const stepsWithoutPropReversal = steps.filter(
      (s: StepData) => !s.blueReversal && !s.redReversal
    ).length;
    const propContinuityPercent =
      totalSteps > 0
        ? Math.round((stepsWithoutPropReversal / totalSteps) * 100)
        : 100;

    // For hand path: transitions without change / total transitions
    const totalHandPathTransitions = Math.max(0, (totalSteps - 1) * 2);
    const handPathContinuityPercent =
      totalHandPathTransitions > 0
        ? Math.round(
            ((totalHandPathTransitions - handPathChanges) /
              totalHandPathTransitions) *
              100
          )
        : 100;

    return {
      totalSteps,
      propReversals,
      dashCount,
      handPathChanges,
      propContinuityPercent,
      handPathContinuityPercent,
    };
  }

  private getHandPath(
    step: StepData,
    color: "blue" | "red"
  ): HandPath | null {
    const motion = step.motions?.[color];
    if (!motion) return null;

    // Derive hand path from start/end locations
    const startLoc = motion.startLocation;
    const endLoc = motion.endLocation;
    if (!startLoc || !endLoc) return null;

    return deriveHandPath(startLoc, endLoc);
  }

  /**
   * Check if a hand path reversal occurred.
   * Only cw↔ccw transitions count as reversals.
   * Dash and static are directionally neutral.
   */
  private isHandPathReversal(
    prevPath: HandPath | null,
    currPath: HandPath | null
  ): boolean {
    // Need both to compare
    if (!prevPath || !currPath) return false;

    // Dash, static, and hash are directionally neutral - no reversal
    if (this.isNeutralHandPath(prevPath) || this.isNeutralHandPath(currPath)) {
      return false;
    }

    // Only cw↔ccw is a reversal
    return prevPath !== currPath;
  }

  private isNeutralHandPath(path: HandPath): boolean {
    return (
      path === HandPath.DASH ||
      path === HandPath.STATIC ||
      path === HandPath.HASH_IN ||
      path === HandPath.HASH_OUT
    );
  }
}

// Singleton export
export const spellStatsCalculator = new SpellStatsCalculator();

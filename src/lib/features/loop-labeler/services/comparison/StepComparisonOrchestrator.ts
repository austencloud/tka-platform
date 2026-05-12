import type {
  ExtractedStep,
  InternalStepPair,
} from "../../domain/models/internal-step-models";
import type { SequenceEntry } from "$lib/shared/loop-labeler/domain/sequence-models";
import {
  ROTATE_90_CCW,
  ROTATE_90_CW,
} from "../../domain/constants/transformation-maps";
import { checkRotations } from "./rotation-comparer";
import { checkReflections } from "./reflection-comparer";
import {
  checkRepeated,
  checkSwapInvert,
} from "./swap-invert-comparer";
import { formatBeatPairTransformations } from "../candidate-formatter";

/**
 * Orchestrator that combines comparison services and manages beat pair generation.
 */
export class StepComparisonOrchestrator {
  constructor() {}


  extractBeats(sequence: SequenceEntry): ExtractedStep[] {
    const raw = sequence.fullMetadata?.sequence;
    if (!raw) return [];

    return raw
      .filter(
        (b): b is typeof b & { beat: number } =>
          typeof b.beat === "number" && b.beat >= 1
      )
      .map((b) => ({
        stepNumber: b.beat,
        letter: b.letter || "",
        startPos: b.startPos || "",
        endPos: b.endPos || "",
        blue: {
          startLoc: b.blueAttributes?.startLoc?.toLowerCase() || "",
          endLoc: b.blueAttributes?.endLoc?.toLowerCase() || "",
          motionType: b.blueAttributes?.motionType?.toLowerCase() || "",
          propRotDir: b.blueAttributes?.propRotDir?.toLowerCase() || "",
        },
        red: {
          startLoc: b.redAttributes?.startLoc?.toLowerCase() || "",
          endLoc: b.redAttributes?.endLoc?.toLowerCase() || "",
          motionType: b.redAttributes?.motionType?.toLowerCase() || "",
          propRotDir: b.redAttributes?.propRotDir?.toLowerCase() || "",
        },
      }));
  }

  compareStepPair(step1: ExtractedStep, step2: ExtractedStep): string[] {
    const b1Blue = step1.blue;
    const b1Red = step1.red;
    const b2Blue = step2.blue;
    const b2Red = step2.red;

    if (
      !b1Blue?.startLoc ||
      !b2Blue?.startLoc ||
      !b1Red?.startLoc ||
      !b2Red?.startLoc
    ) {
      return [];
    }

    const allTransformations: string[] = [];

    // Check for repeated (identity)
    const repeated = checkRepeated(b1Blue, b1Red, b2Blue, b2Red);
    allTransformations.push(...repeated.transformations);

    // Check rotations
    const rotations = checkRotations(b1Blue, b1Red, b2Blue, b2Red);
    allTransformations.push(...rotations.transformations);

    // Check reflections
    const reflections = checkReflections(b1Blue, b1Red, b2Blue, b2Red);
    allTransformations.push(...reflections.transformations);

    // Check swap/invert
    const swapInvert = checkSwapInvert(b1Blue, b1Red, b2Blue, b2Red);
    allTransformations.push(...swapInvert.transformations);

    return allTransformations;
  }

  generateHalvedBeatPairs(steps: ExtractedStep[]): InternalStepPair[] {
    if (steps.length < 2 || steps.length % 2 !== 0) return [];

    const halfLength = steps.length / 2;
    const stepPairs: InternalStepPair[] = [];

    for (let i = 0; i < halfLength; i++) {
      const step1 = steps[i]!;
      const step2 = steps[halfLength + i]!;
      const rawTransformations = this.compareStepPair(step1, step2);
      const { primary, all } =
        formatBeatPairTransformations(
          rawTransformations
        );

      stepPairs.push({
        keyStep: step1.stepNumber,
        correspondingStep: step2.stepNumber,
        rawTransformations,
        detectedTransformations: primary.length > 0 ? primary : ["UNKNOWN"],
        allValidTransformations: all.length > 0 ? all : ["UNKNOWN"],
      });
    }

    return stepPairs;
  }

  generateQuarteredBeatPairs(steps: ExtractedStep[]): InternalStepPair[] {
    if (steps.length < 4 || steps.length % 4 !== 0) return [];

    const quarterLength = steps.length / 4;
    const stepPairs: InternalStepPair[] = [];

    // Loop through ALL steps to include wrap-around
    for (let i = 0; i < steps.length; i++) {
      const step1 = steps[i]!;
      const step2 = steps[(i + quarterLength) % steps.length]!;
      const rawTransformations = this.compareStepPair(step1, step2);
      const { primary, all } =
        formatBeatPairTransformations(
          rawTransformations
        );

      stepPairs.push({
        keyStep: step1.stepNumber,
        correspondingStep: step2.stepNumber,
        rawTransformations,
        detectedTransformations: primary.length > 0 ? primary : ["UNKNOWN"],
        allValidTransformations: all.length > 0 ? all : ["UNKNOWN"],
      });
    }

    return stepPairs;
  }

  detectRotationDirection(steps: ExtractedStep[]): "cw" | "ccw" | null {
    if (steps.length < 4 || steps.length % 4 !== 0) return null;

    const quarterLength = steps.length / 4;
    const b0 = steps[0];
    const b1 = steps[quarterLength];
    const b2 = steps[quarterLength * 2];
    const b3 = steps[quarterLength * 3];

    if (!b0 || !b1 || !b2 || !b3) return null;

    const quarterBeats = [b0, b1, b2, b3];
    const blueStartLocs = quarterBeats.map((b) => b.blue?.startLoc);

    let ccwMatches = 0;
    let cwMatches = 0;

    for (let i = 0; i < 4; i++) {
      const current = blueStartLocs[i];
      const next = blueStartLocs[(i + 1) % 4];
      if (!current || !next) continue;

      if (ROTATE_90_CCW[current] === next) ccwMatches++;
      if (ROTATE_90_CW[current] === next) cwMatches++;
    }

    if (ccwMatches > cwMatches && ccwMatches >= 2) return "ccw";
    if (cwMatches > ccwMatches && cwMatches >= 2) return "cw";

    return null;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================

export const stepComparisonOrchestrator = new StepComparisonOrchestrator();

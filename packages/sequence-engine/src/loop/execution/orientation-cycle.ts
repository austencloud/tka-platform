import { calculateEndOrientation } from "../../core/orientation/OrientationCalculator.js";
import type {
  Orientation,
  SequenceStep,
} from "../../core/types/sequence-engine-types.js";
import { updateStepOrientations } from "./orientation-helpers.js";

export const MAX_ORIENTATION_CYCLE_REPETITIONS = 8;

export type OrientationCycleCount = 1 | 2 | 4 | 8;

export interface OrientationCycleAnalysis {
  cycleCount: OrientationCycleCount;
  blueOrientations: Orientation[];
  redOrientations: Orientation[];
}

export interface OrientationCycleClosure {
  steps: SequenceStep[];
  /**
   * Minimum number of completed position-pattern repetitions required solely
   * for orientation closure.
   */
  orientationCycleCount: OrientationCycleCount;
  /** Number of completed position-pattern repetitions emitted. */
  patternRepetitions: number;
  /** Final output step count divided by the original seed step count. */
  expansionMultiplier: number;
}

export interface OrientationCycleOptions {
  /**
   * Original seed size. Defaults to the number of non-start-position steps,
   * which is appropriate when analyzing an unexpanded sequence.
   */
  seedStepCount?: number;
  /**
   * Preserve at least this output-to-seed multiplier. Exact-length generation
   * uses this after an earlier candidate proves that more repetitions are
   * required.
   */
  minimumExpansionMultiplier?: number;
  /**
   * Explicit start orientations for callers whose start position is stored
   * separately from the sequence steps.
   */
  startOrientations?: {
    blue: Orientation;
    red: Orientation;
  };
}

/**
 * Find the smallest number of complete position-pattern repetitions that
 * returns both props to their starting orientations.
 *
 * The orientation wheel has eight states, so a deterministic pattern must
 * return after 1, 2, 4, or 8 repetitions. Failing to return within eight is an
 * engine error, not an invitation to label an open sequence as closed.
 */
export function analyzeOrientationCycle(
  sequence: readonly SequenceStep[],
  options: Pick<OrientationCycleOptions, "startOrientations"> = {}
): OrientationCycleAnalysis {
  const pattern = getPatternSteps(sequence);
  const startOrientations =
    options.startOrientations ?? getStartingOrientations(sequence, pattern[0]);

  if (pattern.length === 0) {
    return {
      cycleCount: 1,
      blueOrientations: [startOrientations.blue],
      redOrientations: [startOrientations.red],
    };
  }

  const blueOrientations: Orientation[] = [startOrientations.blue];
  const redOrientations: Orientation[] = [startOrientations.red];
  let blue = startOrientations.blue;
  let red = startOrientations.red;

  for (
    let repetition = 1;
    repetition <= MAX_ORIENTATION_CYCLE_REPETITIONS;
    repetition++
  ) {
    for (const step of pattern) {
      blue = calculateMotionEndOrientation(step, "blue", blue);
      red = calculateMotionEndOrientation(step, "red", red);
    }

    blueOrientations.push(blue);
    redOrientations.push(red);

    if (blue === startOrientations.blue && red === startOrientations.red) {
      if (!isOrientationCycleCount(repetition)) {
        throw new Error(
          `Orientation returned after unsupported repetition count ${repetition}`
        );
      }
      return {
        cycleCount: repetition,
        blueOrientations,
        redOrientations,
      };
    }
  }

  throw new Error(
    `Orientation did not close after ${MAX_ORIENTATION_CYCLE_REPETITIONS} ` +
      `position-pattern repetitions (blue ${startOrientations.blue} -> ${blue}, ` +
      `red ${startOrientations.red} -> ${red})`
  );
}

/**
 * Repeat a completed position pattern until both prop orientations close.
 *
 * LOOP classification ignores orientation, but performance does not. A
 * position pattern may return home while one or both props still point
 * elsewhere. Repeating the complete pattern preserves its positional LOOP
 * identity while advancing the propagated orientation state.
 */
export function closeOrientationCycle(
  sequence: readonly SequenceStep[],
  options: OrientationCycleOptions = {}
): OrientationCycleClosure {
  const pattern = getPatternSteps(sequence);
  const seedStepCount = options.seedStepCount ?? pattern.length;
  const minimumExpansionMultiplier =
    options.minimumExpansionMultiplier ?? 1;

  if (pattern.length === 0) {
    return {
      steps: [...sequence],
      orientationCycleCount: 1,
      patternRepetitions: 1,
      expansionMultiplier: 1,
    };
  }
  if (seedStepCount < 1) {
    throw new Error("Seed step count must be at least 1");
  }
  if (pattern.length % seedStepCount !== 0) {
    throw new Error(
      `LOOP output length ${pattern.length} is not a multiple of its ` +
        `${seedStepCount}-step seed`
    );
  }

  const first = pattern[0]!;
  const last = pattern[pattern.length - 1]!;
  if (last.endPosition !== first.startPosition) {
    throw new Error(
      `Cannot close orientation on an open position pattern ` +
        `(${first.startPosition} -> ${last.endPosition})`
    );
  }

  const analysis = analyzeOrientationCycle(
    sequence,
    options.startOrientations
      ? { startOrientations: options.startOrientations }
      : {}
  );
  const structuralMultiplier = pattern.length / seedStepCount;
  const minimumPatternRepetitions = Math.max(
    1,
    Math.ceil(minimumExpansionMultiplier / structuralMultiplier)
  );
  const patternRepetitions =
    Math.ceil(minimumPatternRepetitions / analysis.cycleCount) *
    analysis.cycleCount;

  if (patternRepetitions > MAX_ORIENTATION_CYCLE_REPETITIONS) {
    throw new Error(
      `Orientation closure requires ${patternRepetitions} position-pattern ` +
        `repetitions, above the supported maximum of ` +
        `${MAX_ORIENTATION_CYCLE_REPETITIONS}`
    );
  }

  const output = sequence.map(cloneStep);
  let nextStepNumber =
    pattern.reduce(
      (largest, step) => Math.max(largest, step.stepNumber),
      0
    ) + 1;
  for (let repetition = 1; repetition < patternRepetitions; repetition++) {
    for (const sourceStep of pattern) {
      const previousStep = output[output.length - 1]!;
      const copiedStep: SequenceStep = {
        ...sourceStep,
        id: `step-${nextStepNumber}`,
        stepNumber: nextStepNumber,
        startPosition:
          previousStep.endPosition as SequenceStep["startPosition"],
        motions: {
          blue: { ...sourceStep.motions.blue },
          red: { ...sourceStep.motions.red },
        },
      };
      output.push(updateStepOrientations(copiedStep, previousStep));
      nextStepNumber++;
    }
  }

  assertOrientationsClose(output, options.startOrientations);

  return {
    steps: output,
    orientationCycleCount: analysis.cycleCount,
    patternRepetitions,
    expansionMultiplier: structuralMultiplier * patternRepetitions,
  };
}

function assertOrientationsClose(
  sequence: readonly SequenceStep[],
  explicitStart?: OrientationCycleOptions["startOrientations"]
): void {
  const pattern = getPatternSteps(sequence);
  const start =
    explicitStart ?? getStartingOrientations(sequence, pattern[0]);
  const end = sequence[sequence.length - 1];
  if (!end) return;

  if (
    start.blue !== end.motions.blue.endOrientation ||
    start.red !== end.motions.red.endOrientation
  ) {
    throw new Error(
      `Orientation closure emitted an open sequence ` +
        `(blue ${start.blue} -> ${end.motions.blue.endOrientation}, ` +
        `red ${start.red} -> ${end.motions.red.endOrientation})`
    );
  }
}

function getPatternSteps(
  sequence: readonly SequenceStep[]
): readonly SequenceStep[] {
  return sequence.filter((step) => step.stepNumber > 0);
}

function getStartingOrientations(
  sequence: readonly SequenceStep[],
  firstStep: SequenceStep | undefined
): { blue: Orientation; red: Orientation } {
  const startStep = sequence.find((step) => step.stepNumber === 0);
  const source = startStep ?? firstStep;
  return {
    blue: (source?.motions.blue.startOrientation ?? "in") as Orientation,
    red: (source?.motions.red.startOrientation ?? "in") as Orientation,
  };
}

function calculateMotionEndOrientation(
  step: SequenceStep,
  side: "blue" | "red",
  startOrientation: Orientation
): Orientation {
  const motion = step.motions[side];
  return calculateEndOrientation({
    motionType: motion.motionType,
    turns: motion.turns,
    rotationDirection: motion.rotationDirection,
    startLocation: motion.startLocation,
    endLocation: motion.endLocation,
    startOrientation,
  });
}

function isOrientationCycleCount(value: number): value is OrientationCycleCount {
  return value === 1 || value === 2 || value === 4 || value === 8;
}

function cloneStep(step: SequenceStep): SequenceStep {
  return {
    ...step,
    motions: {
      blue: { ...step.motions.blue },
      red: { ...step.motions.red },
    },
  };
}

import { calculateMotionEndpoints } from "$lib/shared/animation-engine/services/endpoint-calculator";
import type { TargetHand } from "$lib/shared/create/domain/panel-types";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import {
  isVisibleMotion,
  type MotionData,
} from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { MAX_DURATION, MIN_DURATION } from "./step-operations/duration-handler";

type PropColor = Exclude<TargetHand, "both">;

export type ConstantPropSpeedFailureReason =
  | "empty-sequence"
  | "missing-motion"
  | "zero-spin"
  | "direction-change"
  | "incompatible-hands"
  | "duration-limit";

export interface ConstantPropSpeedStep {
  readonly stepNumber: number;
  readonly blueDegrees: number | null;
  readonly redDegrees: number | null;
  readonly duration: number | null;
  readonly blueDegreesPerBeat: number | null;
  readonly redDegreesPerBeat: number | null;
}

interface ConstantPropSpeedBaseResult {
  readonly target: TargetHand;
  readonly steps: readonly ConstantPropSpeedStep[];
}

export interface ConstantPropSpeedSuccess extends ConstantPropSpeedBaseResult {
  readonly success: true;
  readonly durations: readonly number[];
  readonly blueDegreesPerBeat: number | null;
  readonly redDegreesPerBeat: number | null;
}

export interface ConstantPropSpeedFailure extends ConstantPropSpeedBaseResult {
  readonly success: false;
  readonly reason: ConstantPropSpeedFailureReason;
  readonly affectedSteps: readonly number[];
  readonly requiredMaxDuration?: number;
}

export type ConstantPropSpeedResult =
  | ConstantPropSpeedSuccess
  | ConstantPropSpeedFailure;

interface RotationRow {
  readonly stepNumber: number;
  readonly blue: number | null;
  readonly red: number | null;
}

const ZERO_EPSILON_DEGREES = 1e-7;
const RATIO_EPSILON = 1e-7;
const STORED_DURATION_DECIMALS = 12;

function toDegrees(motion: MotionData | null | undefined): number | null {
  if (!isVisibleMotion(motion)) return null;

  const radians = calculateMotionEndpoints(motion).staffRotationDelta;
  const degrees = radians * (180 / Math.PI);
  return Math.abs(degrees) <= ZERO_EPSILON_DEGREES ? 0 : degrees;
}

function readTarget(row: RotationRow, color: PropColor): number | null {
  return row[color];
}

function selectedColors(target: TargetHand): readonly PropColor[] {
  return target === "both" ? ["blue", "red"] : [target];
}

function affectedSteps(
  rows: readonly RotationRow[],
  predicate: (degrees: number | null, row: RotationRow) => boolean,
  colors: readonly PropColor[]
): number[] {
  return rows
    .filter((row) =>
      colors.some((color) => predicate(readTarget(row, color), row))
    )
    .map((row) => row.stepNumber);
}

function hasDirectionChange(
  rows: readonly RotationRow[],
  color: PropColor
): number[] {
  const first = readTarget(rows[0]!, color)!;
  const firstSign = Math.sign(first);

  return rows
    .filter((row) => Math.sign(readTarget(row, color)!) !== firstSign)
    .map((row) => row.stepNumber);
}

function nearlyEqual(a: number, b: number): boolean {
  return (
    Math.abs(a - b) <= RATIO_EPSILON * Math.max(1, Math.abs(a), Math.abs(b))
  );
}

function storeDuration(duration: number): number {
  return Number(duration.toFixed(STORED_DURATION_DECIMALS));
}

function emptySteps(rows: readonly RotationRow[]): ConstantPropSpeedStep[] {
  return rows.map((row) => ({
    stepNumber: row.stepNumber,
    blueDegrees: row.blue,
    redDegrees: row.red,
    duration: null,
    blueDegreesPerBeat: null,
    redDegreesPerBeat: null,
  }));
}

function fail(
  target: TargetHand,
  rows: readonly RotationRow[],
  reason: ConstantPropSpeedFailureReason,
  steps: readonly number[],
  requiredMaxDuration?: number
): ConstantPropSpeedFailure {
  return {
    success: false,
    target,
    reason,
    affectedSteps: steps,
    ...(requiredMaxDuration !== undefined && { requiredMaxDuration }),
    steps: emptySteps(rows),
  };
}

/**
 * Finds one shared duration per pictograph that keeps the selected prop's
 * signed staff rotation constant from beat to beat. The shortest selected
 * rotation is assigned one beat; every other duration is its exact ratio.
 */
export function analyzeConstantPropSpeed(
  sequence: SequenceData,
  target: TargetHand
): ConstantPropSpeedResult {
  const rows: RotationRow[] = sequence.steps.map((step) => ({
    stepNumber: step.stepNumber,
    blue: toDegrees(step.motions?.blue),
    red: toDegrees(step.motions?.red),
  }));

  if (rows.length === 0) {
    return fail(target, rows, "empty-sequence", []);
  }

  const colors = selectedColors(target);
  const missingSteps = affectedSteps(
    rows,
    (degrees) => degrees === null,
    colors
  );
  if (missingSteps.length > 0) {
    return fail(target, rows, "missing-motion", missingSteps);
  }

  const zeroSpinSteps = affectedSteps(
    rows,
    (degrees) => Math.abs(degrees!) <= ZERO_EPSILON_DEGREES,
    colors
  );
  if (zeroSpinSteps.length > 0) {
    return fail(target, rows, "zero-spin", zeroSpinSteps);
  }

  const directionChangeSteps = Array.from(
    new Set(colors.flatMap((color) => hasDirectionChange(rows, color)))
  ).sort((a, b) => a - b);
  if (directionChangeSteps.length > 0) {
    return fail(target, rows, "direction-change", directionChangeSteps);
  }

  if (target === "both") {
    const expectedRatio = rows[0]!.blue! / rows[0]!.red!;
    const incompatibleSteps = rows
      .filter((row) => !nearlyEqual(row.blue! / row.red!, expectedRatio))
      .map((row) => row.stepNumber);

    if (incompatibleSteps.length > 0) {
      return fail(target, rows, "incompatible-hands", incompatibleSteps);
    }
  }

  const referenceColor: PropColor = target === "red" ? "red" : "blue";
  const magnitudes = rows.map((row) =>
    Math.abs(readTarget(row, referenceColor)!)
  );
  const baseDegreesPerBeat = Math.min(...magnitudes);
  const durations = magnitudes.map((degrees) =>
    storeDuration(degrees / baseDegreesPerBeat)
  );
  const requiredMaxDuration = Math.max(...durations);

  if (requiredMaxDuration > MAX_DURATION + RATIO_EPSILON) {
    return fail(
      target,
      rows,
      "duration-limit",
      rows
        .filter((_, index) => durations[index]! > MAX_DURATION + RATIO_EPSILON)
        .map((row) => row.stepNumber),
      requiredMaxDuration
    );
  }

  const normalizedDurations = durations.map((duration) =>
    Math.max(MIN_DURATION, duration)
  );
  const steps = rows.map((row, index) => {
    const duration = normalizedDurations[index]!;
    return {
      stepNumber: row.stepNumber,
      blueDegrees: row.blue,
      redDegrees: row.red,
      duration,
      blueDegreesPerBeat: row.blue === null ? null : row.blue / duration,
      redDegreesPerBeat: row.red === null ? null : row.red / duration,
    };
  });

  return {
    success: true,
    target,
    durations: normalizedDurations,
    steps,
    blueDegreesPerBeat: target === "red" ? null : steps[0]!.blueDegreesPerBeat,
    redDegreesPerBeat: target === "blue" ? null : steps[0]!.redDegreesPerBeat,
  };
}

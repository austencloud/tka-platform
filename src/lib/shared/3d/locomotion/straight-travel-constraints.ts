export const MIN_EXACT_STEPS = 3;
export const MAX_EXACT_STEPS = 16;
export const MIN_EXACT_STEP_LENGTH_METERS = 0.55;
export const MAX_EXACT_STEP_LENGTH_METERS = 0.85;
export const MIN_EXACT_CADENCE = 90 / 60;
export const MAX_EXACT_CADENCE = 150 / 60;
export const DEFAULT_EXACT_CADENCE = 110 / 60;

export interface ExactStepRange {
  min: number;
  max: number;
}

/** Counts that keep both stride length and cadence inside the proven lab seam. */
export function exactStepRange(
  distanceMeters: number,
  durationSeconds?: number
): ExactStepRange | null {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return null;

  let minimum = Math.max(
    MIN_EXACT_STEPS,
    Math.ceil(distanceMeters / MAX_EXACT_STEP_LENGTH_METERS)
  );
  let maximum = Math.min(
    MAX_EXACT_STEPS,
    Math.floor(distanceMeters / MIN_EXACT_STEP_LENGTH_METERS)
  );

  if (durationSeconds !== undefined) {
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
    minimum = Math.max(
      minimum,
      Math.ceil(durationSeconds * MIN_EXACT_CADENCE - 1e-9)
    );
    maximum = Math.min(
      maximum,
      Math.floor(durationSeconds * MAX_EXACT_CADENCE + 1e-9)
    );
  }

  return minimum <= maximum ? { min: minimum, max: maximum } : null;
}

export function chooseAutomaticExactSteps(
  distanceMeters: number,
  durationSeconds: number
): number | null {
  const range = exactStepRange(distanceMeters, durationSeconds);
  if (!range) return null;
  return Math.min(
    range.max,
    Math.max(range.min, Math.round(durationSeconds * DEFAULT_EXACT_CADENCE))
  );
}

export function isExactStepCountSupported(
  distanceMeters: number,
  durationSeconds: number,
  steps: number
): boolean {
  const range = exactStepRange(distanceMeters, durationSeconds);
  return (
    range !== null &&
    Number.isInteger(steps) &&
    steps >= range.min &&
    steps <= range.max
  );
}

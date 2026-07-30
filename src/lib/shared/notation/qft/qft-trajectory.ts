import {
  norm,
  pointAt,
  PROP_LENGTH,
  type DirectionValue,
  type PositionValue,
  type QftIncrement,
} from "./qft-model";

export const QFT_TRAJECTORY_STEPS = 8;

export type QftPropRateProfile = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

/**
 * One QFT hand whose prop speed can change inside the eight-step cycle.
 *
 * The rate profile is relative to the hand. A counterclockwise hand therefore
 * mirrors the same named pattern without rewriting all eight rates.
 */
export interface QftTrajectory {
  radius: number;
  handDirection: 1 | -1;
  propRate: QftPropRateProfile;
  propPhase: number;
}

export interface QftTrajectoryReversal {
  /** The step whose departure begins the new rate, 1 through 8. */
  step: PositionValue;
  handPosition: PositionValue;
  propPosition: PositionValue;
  fromRate: number;
  toRate: number;
}

const STATIONARY_RADIUS = 0.01;
const RATE_TOLERANCE = 1e-9;

function wrappedStep(step: number): number {
  return (
    ((step % QFT_TRAJECTORY_STEPS) + QFT_TRAJECTORY_STEPS) %
    QFT_TRAJECTORY_STEPS
  );
}

function rateSign(rate: number): -1 | 0 | 1 {
  if (Math.abs(rate) < RATE_TOLERANCE) return 0;
  return rate > 0 ? 1 : -1;
}

/** The signed rate in the drawing's frame at a continuous cursor position. */
export function trajectoryPropRateAt(
  trajectory: QftTrajectory,
  cursor: number
): number {
  const step = wrappedStep(Math.floor(cursor));
  return trajectory.handDirection * (trajectory.propRate[step] ?? 0);
}

export function trajectoryHandIndexAt(
  trajectory: QftTrajectory,
  cursor: number
): number {
  return trajectory.handDirection * cursor;
}

/**
 * Continuous prop index from the rate profile.
 *
 * Whole steps use a prefix sum. The fractional part advances through the
 * current rate, so the head does not jump at a step or reversal boundary.
 */
export function trajectoryPropIndexAt(
  trajectory: QftTrajectory,
  cursor: number
): number {
  const whole = Math.floor(cursor);
  const fraction = cursor - whole;
  const cycle = Math.floor(whole / QFT_TRAJECTORY_STEPS);
  const step = wrappedStep(whole);
  const cycleRate = trajectory.propRate.reduce((sum, rate) => sum + rate, 0);
  let prefix = cycle * cycleRate;

  for (let index = 0; index < step; index += 1) {
    prefix += trajectory.propRate[index] ?? 0;
  }
  prefix += (trajectory.propRate[step] ?? 0) * fraction;

  return trajectory.propPhase + trajectory.handDirection * prefix;
}

function handPositionAt(
  trajectory: QftTrajectory,
  cursor: number
): PositionValue {
  return trajectory.radius < STATIONARY_RADIUS
    ? 8
    : norm(trajectoryHandIndexAt(trajectory, cursor));
}

function directionAt(propIndex: number, rate: number): DirectionValue {
  const sign = rateSign(rate);
  return sign === 0 ? "n" : norm(propIndex + sign * 2);
}

export function trajectoryPosesAt(trajectory: QftTrajectory, cursor: number) {
  const hand = pointAt(
    trajectoryHandIndexAt(trajectory, cursor),
    trajectory.radius
  );
  const offset = pointAt(
    trajectoryPropIndexAt(trajectory, cursor),
    PROP_LENGTH
  );
  return {
    hand,
    head: {
      x: hand.x + offset.x,
      y: hand.y + offset.y,
    },
  };
}

export function traceTrajectory(
  trajectory: QftTrajectory,
  samples = 240
): Array<{ x: number; y: number }> {
  return Array.from(
    { length: samples + 1 },
    (_, index) =>
      trajectoryPosesAt(
        trajectory,
        (index / Math.max(1, samples)) * QFT_TRAJECTORY_STEPS
      ).head
  );
}

/**
 * Rate changes belong to the departure of the new step. Step 1 compares the
 * end of the prior cycle with the first rate, so a loop-seam reversal remains
 * visible and selectable.
 */
export function trajectoryReversals(
  trajectory: QftTrajectory
): QftTrajectoryReversal[] {
  const reversals: QftTrajectoryReversal[] = [];

  for (let stepIndex = 0; stepIndex < QFT_TRAJECTORY_STEPS; stepIndex += 1) {
    const previousIndex = wrappedStep(stepIndex - 1);
    const fromRate =
      trajectory.handDirection * (trajectory.propRate[previousIndex] ?? 0);
    const toRate =
      trajectory.handDirection * (trajectory.propRate[stepIndex] ?? 0);
    const fromSign = rateSign(fromRate);
    const toSign = rateSign(toRate);
    if (fromSign === 0 || toSign === 0 || fromSign === toSign) continue;

    reversals.push({
      step: (stepIndex + 1) as PositionValue,
      handPosition: handPositionAt(trajectory, stepIndex),
      propPosition: norm(trajectoryPropIndexAt(trajectory, stepIndex)),
      fromRate,
      toRate,
    });
  }

  return reversals;
}

export function buildTrajectoryIncrements(
  trajectory: QftTrajectory
): QftIncrement[] {
  return Array.from({ length: QFT_TRAJECTORY_STEPS }, (_, stepIndex) => {
    const departIndex = trajectoryPropIndexAt(trajectory, stepIndex);
    const arriveIndex = trajectoryPropIndexAt(trajectory, stepIndex + 1);
    const rate = trajectoryPropRateAt(trajectory, stepIndex);

    return {
      propDepart: norm(departIndex),
      propDirDepart: directionAt(departIndex, rate),
      handDepart: handPositionAt(trajectory, stepIndex),
      radius: trajectory.radius,
      handArrive: handPositionAt(trajectory, stepIndex + 1),
      propDirArrive: directionAt(arriveIndex, rate),
      propArrive: norm(arriveIndex),
    };
  });
}

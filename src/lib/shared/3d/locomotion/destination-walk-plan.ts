import type { TerminalStepPlan } from "@austencloud/scene-3d";

export interface GroundPoint {
  x: number;
  z: number;
}

export interface DestinationWalkRequest {
  from: GroundPoint;
  to: GroundPoint;
  /** The exact number of authored left/right steps in the move. */
  steps: number;
  /** Comfortable authored steps per second. Defaults to 110 steps/minute. */
  cadence?: number;
}

export interface DestinationWalkPlan {
  from: GroundPoint;
  to: GroundPoint;
  steps: number;
  cadence: number;
  distance: number;
  stepLength: number;
  /** Per-footfall travel; the last two deliberately shorten for braking. */
  stepDistances: readonly number[];
  /** Cumulative metres at every authored footfall, including 0 and `distance`. */
  stepBoundaries: readonly number[];
  terminalStartStep: number;
  terminalDistance: number;
  duration: number;
  direction: GroundPoint;
}

export interface DestinationWalkSample {
  position: GroundPoint;
  /** Completed and fractional authored steps since departure. */
  step: number;
  progress: number;
  remainingSteps: number;
  speed: number;
  moving: boolean;
  arrived: boolean;
}

const DEFAULT_CADENCE = 110 / 60;
const MIN_DISTANCE = 1e-4;
// The authored stop covers roughly 63% of its braking distance before the
// terminal placement and 37% during the final step. Matching that measured
// profile keeps the animation warp even across both braking placements.
const PENULTIMATE_STEP_RATIO = 0.95;
const TERMINAL_STEP_RATIO = 0.55;

function createStepDistances(distance: number, steps: number): number[] {
  const mean = distance / steps;
  if (steps < 3) return Array.from({ length: steps }, () => mean);

  const penultimate = mean * PENULTIMATE_STEP_RATIO;
  const terminal = mean * TERMINAL_STEP_RATIO;
  const steady = (distance - penultimate - terminal) / (steps - 2);
  const result = [
    ...Array.from({ length: steps - 2 }, () => steady),
    penultimate,
    terminal,
  ];

  // Keep the endpoint bit-stable even when the decimal ratios accumulate a
  // final floating-point ulp.
  const prefix = result.slice(0, -1).reduce((sum, value) => sum + value, 0);
  result[result.length - 1] = distance - prefix;
  return result;
}

/**
 * Resolve mark-to-mark intent before the animation starts.
 *
 * The plan deliberately contains no frame clock. Its progress comes from the
 * locomotion animator's gait clock, so dropping a render frame cannot change
 * either the requested step count or the endpoint.
 */
export function createDestinationWalkPlan(
  request: DestinationWalkRequest
): DestinationWalkPlan {
  assertPoint(request.from, "from");
  assertPoint(request.to, "to");

  if (!Number.isInteger(request.steps) || request.steps <= 0) {
    throw new RangeError("steps must be a positive integer");
  }

  const cadence = request.cadence ?? DEFAULT_CADENCE;
  if (!Number.isFinite(cadence) || cadence <= 0) {
    throw new RangeError("cadence must be a positive finite number");
  }

  const dx = request.to.x - request.from.x;
  const dz = request.to.z - request.from.z;
  const distance = Math.hypot(dx, dz);
  if (distance < MIN_DISTANCE) {
    throw new RangeError("destination must differ from the start position");
  }

  const stepDistances = createStepDistances(distance, request.steps);
  const stepBoundaries = [0];
  for (const stepDistance of stepDistances) {
    stepBoundaries.push(stepBoundaries.at(-1)! + stepDistance);
  }
  stepBoundaries[stepBoundaries.length - 1] = distance;
  const terminalStartStep = Math.max(0, request.steps - 2);
  const terminalDistance =
    stepBoundaries[request.steps]! - stepBoundaries[terminalStartStep]!;

  return {
    from: { ...request.from },
    to: { ...request.to },
    steps: request.steps,
    cadence,
    distance,
    stepLength: distance / request.steps,
    stepDistances,
    stepBoundaries,
    terminalStartStep,
    terminalDistance,
    duration: request.steps / cadence,
    direction: { x: dx / distance, z: dz / distance },
  };
}

/**
 * Sample the straight path by authored gait progress.
 *
 * `step` is relative to the gait coordinate captured at departure. Clamping
 * here is intentional: a delayed host frame can observe the clock just past
 * the final strike, but the performer still lands on the mark rather than
 * overshooting and correcting backwards.
 */
export function sampleDestinationWalkPlan(
  plan: DestinationWalkPlan,
  step: number,
  distanceStep: number = step
): DestinationWalkSample {
  if (!Number.isFinite(step)) {
    throw new RangeError("step must be finite");
  }
  if (!Number.isFinite(distanceStep)) {
    throw new RangeError("distanceStep must be finite");
  }

  const clampedStep = Math.min(plan.steps, Math.max(0, step));
  const arrived = clampedStep >= plan.steps;
  const clampedDistanceStep = Math.min(
    plan.steps,
    Math.max(0, distanceStep)
  );
  const completed = Math.min(
    plan.steps - 1,
    Math.floor(clampedDistanceStep)
  );
  const fraction = arrived ? 1 : clampedDistanceStep - completed;
  const distanceAtStep = arrived
    ? plan.distance
    : plan.stepBoundaries[completed]! +
      plan.stepDistances[completed]! * fraction;
  const progress = distanceAtStep / plan.distance;

  return {
    position: arrived
      ? { ...plan.to }
      : {
          x: plan.from.x + (plan.to.x - plan.from.x) * progress,
          z: plan.from.z + (plan.to.z - plan.from.z) * progress,
        },
    step: clampedStep,
    progress,
    remainingSteps: plan.steps - clampedStep,
    speed: arrived ? 0 : plan.stepDistances[completed]! * plan.cadence,
    moving: !arrived,
    arrived,
  };
}

/**
 * Enrich a destination plan with the animator's absolute gait coordinate.
 *
 * The stop owns the final two authored placements. Even requested counts land
 * on the left foot when the gait begins on its canonical left support; odd
 * counts land on the right.
 */
export function createTerminalStepPlan(
  plan: DestinationWalkPlan,
  departureGaitStep: number,
  id: string,
  targetFacing: number
): TerminalStepPlan {
  if (!Number.isFinite(departureGaitStep)) {
    throw new RangeError("departure gait step must be finite");
  }
  if (!id) throw new RangeError("terminal plan id is required");
  if (!Number.isFinite(targetFacing)) {
    throw new RangeError("target facing must be finite");
  }

  const startAtGaitStep = departureGaitStep + plan.terminalStartStep;
  const landAtGaitStep = departureGaitStep + plan.steps;
  const terminalFoot =
    Math.round(landAtGaitStep) % 2 === 0 ? "left" : "right";
  const stepDistances = plan.stepDistances.slice(-2) as [number, number];

  return {
    id,
    startAtGaitStep,
    landAtGaitStep,
    terminalFoot,
    stepDistances,
    remainingDistance: plan.terminalDistance,
    cadence: plan.cadence,
    targetFacing,
  };
}

function assertPoint(point: GroundPoint, label: string): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.z)) {
    throw new RangeError(`${label} must contain finite x/z coordinates`);
  }
}

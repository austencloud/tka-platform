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

  return {
    from: { ...request.from },
    to: { ...request.to },
    steps: request.steps,
    cadence,
    distance,
    stepLength: distance / request.steps,
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
  step: number
): DestinationWalkSample {
  if (!Number.isFinite(step)) {
    throw new RangeError("step must be finite");
  }

  const clampedStep = Math.min(plan.steps, Math.max(0, step));
  const progress = clampedStep / plan.steps;
  const arrived = clampedStep >= plan.steps;

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
    speed: arrived ? 0 : plan.stepLength * plan.cadence,
    moving: !arrived,
    arrived,
  };
}

function assertPoint(point: GroundPoint, label: string): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.z)) {
    throw new RangeError(`${label} must contain finite x/z coordinates`);
  }
}

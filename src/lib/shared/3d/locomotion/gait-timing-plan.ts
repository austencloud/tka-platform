export interface GaitTimingEvent {
  /** One-based authored footfall number. */
  step: number;
  plantBeat: number;
  plantTimeSeconds: number;
}

export interface GaitTimingPlan {
  id: string;
  departureBeat: number;
  departureTimeSeconds: number;
  footfalls: readonly GaitTimingEvent[];
  settledBeat: number;
  settledTimeSeconds: number;
}

export interface GaitTimingSample {
  /** Fractional authored footfalls since departure. */
  step: number;
  /** Local authored footfalls per second. */
  cadence: number;
  nextFootfall: GaitTimingEvent | null;
  arrived: boolean;
  settled: boolean;
  settleProgress: number;
}

export type CountedGaitSchedule = "even" | "hold-middle";

interface CountedGaitTimingRequest {
  id: string;
  steps: number;
  tempoBpm: number;
  departureBeat: number;
  schedule: CountedGaitSchedule;
}

export function createGaitTimingPlan(plan: GaitTimingPlan): GaitTimingPlan {
  if (!plan.id) throw new RangeError("timing plan id is required");
  assertFinite(plan.departureBeat, "departure beat");
  assertFinite(plan.departureTimeSeconds, "departure time");
  assertFinite(plan.settledBeat, "settled beat");
  assertFinite(plan.settledTimeSeconds, "settled time");
  if (plan.footfalls.length === 0) {
    throw new RangeError("timing plan requires at least one footfall");
  }

  let previousBeat = plan.departureBeat;
  let previousTime = plan.departureTimeSeconds;
  const footfalls = plan.footfalls.map((footfall, index) => {
    if (footfall.step !== index + 1) {
      throw new RangeError("footfall steps must be consecutive and one-based");
    }
    assertFinite(footfall.plantBeat, "plant beat");
    assertFinite(footfall.plantTimeSeconds, "plant time");
    if (
      footfall.plantBeat <= previousBeat ||
      footfall.plantTimeSeconds <= previousTime
    ) {
      throw new RangeError("footfall beats and times must increase strictly");
    }
    previousBeat = footfall.plantBeat;
    previousTime = footfall.plantTimeSeconds;
    return { ...footfall };
  });

  if (
    plan.settledBeat < previousBeat ||
    plan.settledTimeSeconds < previousTime
  ) {
    throw new RangeError("settlement cannot precede the final footfall");
  }

  return {
    ...plan,
    footfalls,
  };
}

/** Build the first lab schedules without hiding their footfall declarations. */
export function createCountedGaitTimingPlan(
  request: CountedGaitTimingRequest
): GaitTimingPlan {
  if (!Number.isInteger(request.steps) || request.steps <= 0) {
    throw new RangeError("steps must be a positive integer");
  }
  if (!Number.isFinite(request.tempoBpm) || request.tempoBpm <= 0) {
    throw new RangeError("tempo must be a positive finite number");
  }
  assertFinite(request.departureBeat, "departure beat");
  if (request.schedule !== "even" && request.schedule !== "hold-middle") {
    throw new RangeError("unknown gait timing schedule");
  }

  const secondsPerBeat = 60 / request.tempoBpm;
  const holdAfterStep = Math.floor(request.steps / 2);
  const footfalls = Array.from({ length: request.steps }, (_, index) => {
    const step = index + 1;
    const heldBeat =
      request.schedule === "hold-middle" && step > holdAfterStep ? 1 : 0;
    const plantBeat = request.departureBeat + step + heldBeat;
    return {
      step,
      plantBeat,
      plantTimeSeconds: plantBeat * secondsPerBeat,
    };
  });
  const departureTimeSeconds = request.departureBeat * secondsPerBeat;
  const settledBeat = footfalls.at(-1)!.plantBeat + 0.5;

  return createGaitTimingPlan({
    id: request.id,
    departureBeat: request.departureBeat,
    departureTimeSeconds,
    footfalls,
    settledBeat,
    settledTimeSeconds: settledBeat * secondsPerBeat,
  });
}

/** Resolve musical score time into the animator's monotonic gait coordinate. */
export function sampleGaitTimingPlan(
  plan: GaitTimingPlan,
  scoreTimeSeconds: number
): GaitTimingSample {
  assertFinite(scoreTimeSeconds, "score time");

  const finalFootfall = plan.footfalls.at(-1)!;
  if (scoreTimeSeconds >= finalFootfall.plantTimeSeconds) {
    const settleDuration =
      plan.settledTimeSeconds - finalFootfall.plantTimeSeconds;
    const settleProgress =
      settleDuration <= 1e-9
        ? 1
        : Math.min(
            1,
            Math.max(
              0,
              (scoreTimeSeconds - finalFootfall.plantTimeSeconds) /
                settleDuration
            )
          );
    return {
      step: finalFootfall.step,
      cadence: 0,
      nextFootfall: null,
      arrived: true,
      settled: settleProgress >= 1,
      settleProgress,
    };
  }

  let previousStep = 0;
  let previousTime = plan.departureTimeSeconds;
  const nextFootfall = plan.footfalls.find(
    (footfall) => footfall.plantTimeSeconds > scoreTimeSeconds
  )!;
  for (const footfall of plan.footfalls) {
    if (footfall.plantTimeSeconds > scoreTimeSeconds) break;
    previousStep = footfall.step;
    previousTime = footfall.plantTimeSeconds;
  }

  const interval = nextFootfall.plantTimeSeconds - previousTime;
  const progress = Math.min(
    1,
    Math.max(0, (scoreTimeSeconds - previousTime) / interval)
  );
  return {
    step: previousStep + progress,
    cadence: 1 / interval,
    nextFootfall,
    arrived: false,
    settled: false,
    settleProgress: 0,
  };
}

export function assertGaitTimingPlanMatchesSteps(
  plan: GaitTimingPlan,
  steps: number
): void {
  if (plan.footfalls.length !== steps) {
    throw new RangeError(
      `timing plan declares ${plan.footfalls.length} footfalls for ${steps} steps`
    );
  }
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
}

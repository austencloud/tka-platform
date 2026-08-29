import type { TerminalStepPlan } from "@austencloud/scene-3d";

export interface PatternTerminalIntent {
  id: string;
  remainingDistance: number;
  targetFacing: number;
}

export interface PatternTerminalStepInput {
  intent: PatternTerminalIntent;
  gaitStep: number;
  cadence: number;
  speed: number;
}

const TERMINAL_STEPS = 2;
const PENULTIMATE_RATIO = 0.95;
const TERMINAL_RATIO = 0.55;
const MAX_TERMINAL_STEP_LENGTH = 0.8;
const MIN_BOUNDARY_CADENCE = 1.2;
const MIN_WALK_CADENCE = 100 / 60;
const MAX_WALK_CADENCE = 120 / 60;

/**
 * Arm the existing two-step stop on a real gait boundary.
 *
 * A time-scripted path knows how much stage remains, while the animator knows
 * which foot is next. Combining those facts here lets the captured braking
 * motion own the arrival without teaching the path script how to animate.
 */
export function createPatternTerminalStepPlan(
  input: PatternTerminalStepInput
): TerminalStepPlan | null {
  const { intent, gaitStep, cadence, speed } = input;
  if (!intent.id) throw new RangeError("terminal intent id is required");
  if (
    !Number.isFinite(intent.remainingDistance) ||
    intent.remainingDistance < 0
  ) {
    throw new RangeError(
      "remaining distance must be a non-negative finite number"
    );
  }
  if (!Number.isFinite(intent.targetFacing)) {
    throw new RangeError("target facing must be finite");
  }
  if (!Number.isFinite(gaitStep))
    throw new RangeError("gait step must be finite");
  if (!Number.isFinite(cadence) || cadence <= 0) return null;
  if (!Number.isFinite(speed) || speed <= 0) return null;

  // The locomotion blend starts with a near-zero measured cadence. Treating
  // that transient as a real walking rate would make a two-step stop span most
  // of the runway and arm as soon as the character departs.
  const plannedCadence = Math.min(
    MAX_WALK_CADENCE,
    Math.max(MIN_WALK_CADENCE, cadence)
  );
  const startAtGaitStep = Math.ceil(gaitStep - 1e-6);
  const waitSteps = Math.max(0, startAtGaitStep - gaitStep);
  const waitCadence = Math.max(MIN_BOUNDARY_CADENCE, cadence);
  const waitDistance = (speed * waitSteps) / waitCadence;
  const armDistance = waitDistance + MAX_TERMINAL_STEP_LENGTH * TERMINAL_STEPS;
  if (intent.remainingDistance > armDistance) return null;

  const remainingDistance = Math.max(
    1e-4,
    intent.remainingDistance - waitDistance
  );
  const ratioTotal = PENULTIMATE_RATIO + TERMINAL_RATIO;
  const penultimate = remainingDistance * (PENULTIMATE_RATIO / ratioTotal);
  const terminal = remainingDistance - penultimate;
  const landAtGaitStep = startAtGaitStep + TERMINAL_STEPS;

  return {
    id: intent.id,
    startAtGaitStep,
    landAtGaitStep,
    terminalFoot: Math.round(landAtGaitStep) % 2 === 0 ? "left" : "right",
    stepDistances: [penultimate, terminal],
    remainingDistance,
    cadence: plannedCadence,
    targetFacing: intent.targetFacing,
  };
}

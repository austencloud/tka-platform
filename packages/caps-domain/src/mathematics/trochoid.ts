/**
 * Zaltymbunk's elementary CAP model.
 *
 * O is the fixed shoulder, M is the hand, and E is the prop extremity. The
 * shoulder-to-hand vector turns theta1 times. The hand-to-extremity vector
 * turns theta2 times relative to the first vector, so its ground-frame
 * frequency is theta1 + theta2.
 */

const TAU = 2 * Math.PI;
const CLASSIFICATION_EPSILON = 1e-9;

export interface TrochoidParameters {
  theta1: number;
  theta2: number;
  rho1: number;
  rho2: number;
  /** Fraction of the full cycle used. */
  d: number;
}

export interface TrochoidPoint {
  x: number;
  y: number;
}

export interface TrochoidFrame {
  t: number;
  shoulder: TrochoidPoint;
  hand: TrochoidPoint;
  tip: TrochoidPoint;
  armAngle: number;
  propAngle: number;
}

export type TrochoidClassification = "rosette" | "cycloid" | "trochoid";

function assertFiniteParameter(
  name: keyof TrochoidParameters,
  value: number
): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite`);
  }
}

export function validateTrochoidParameters(
  parameters: TrochoidParameters
): void {
  for (const [name, value] of Object.entries(parameters) as [
    keyof TrochoidParameters,
    number,
  ][]) {
    assertFiniteParameter(name, value);
  }

  if (parameters.rho1 <= 0 || parameters.rho2 <= 0) {
    throw new RangeError("rho1 and rho2 must be greater than zero");
  }
  if (parameters.d <= 0 || parameters.d > 1) {
    throw new RangeError("d must be greater than zero and no greater than one");
  }
}

/**
 * Evaluate O, M, and E at time t.
 *
 * E(t) = rho1(cos(2π theta1 t), sin(2π theta1 t))
 *      + rho2(cos(2π(theta1 + theta2)t), sin(2π(theta1 + theta2)t))
 */
export function evaluateTrochoid(
  parameters: TrochoidParameters,
  t: number
): TrochoidFrame {
  validateTrochoidParameters(parameters);
  if (!Number.isFinite(t)) throw new RangeError("t must be finite");
  return evaluateValidatedTrochoid(parameters, t);
}

function evaluateValidatedTrochoid(
  parameters: TrochoidParameters,
  t: number
): TrochoidFrame {
  const armAngle = TAU * parameters.theta1 * t;
  const propAngle = TAU * (parameters.theta1 + parameters.theta2) * t;
  const hand = {
    x: parameters.rho1 * Math.cos(armAngle),
    y: parameters.rho1 * Math.sin(armAngle),
  };
  const tip = {
    x: hand.x + parameters.rho2 * Math.cos(propAngle),
    y: hand.y + parameters.rho2 * Math.sin(propAngle),
  };

  return {
    t,
    shoulder: { x: 0, y: 0 },
    hand,
    tip,
    armAngle,
    propAngle,
  };
}

export function recommendedTrochoidSampleCount(
  parameters: TrochoidParameters
): number {
  validateTrochoidParameters(parameters);
  const highestFrequency = Math.max(
    Math.abs(parameters.theta1),
    Math.abs(parameters.theta1 + parameters.theta2),
    1
  );
  return Math.max(480, Math.ceil(highestFrequency * parameters.d * 180));
}

/** Sample the prop-tip trace over t in [0, d], including both endpoints. */
export function sampleTrochoid(
  parameters: TrochoidParameters,
  sampleCount = recommendedTrochoidSampleCount(parameters)
): TrochoidPoint[] {
  validateTrochoidParameters(parameters);
  if (!Number.isInteger(sampleCount) || sampleCount < 1) {
    throw new RangeError("sampleCount must be a positive integer");
  }

  return Array.from({ length: sampleCount + 1 }, (_, index) => {
    const t = (index / sampleCount) * parameters.d;
    return evaluateValidatedTrochoid(parameters, t).tip;
  });
}

export function isCycloidTrochoid(
  parameters: TrochoidParameters,
  epsilon = CLASSIFICATION_EPSILON
): boolean {
  validateTrochoidParameters(parameters);
  const groundFrequency = parameters.theta1 + parameters.theta2;
  if (Math.abs(groundFrequency) <= epsilon) return false;

  const actualRatio = parameters.rho2 / parameters.rho1;
  const cycloidRatio = Math.abs(parameters.theta1 / groundFrequency);
  return Math.abs(actualRatio - cycloidRatio) <= epsilon;
}

export function classifyTrochoid(
  parameters: TrochoidParameters,
  epsilon = CLASSIFICATION_EPSILON
): TrochoidClassification {
  if (isCycloidTrochoid(parameters, epsilon)) return "cycloid";
  if (Math.abs(parameters.rho1 - parameters.rho2) <= epsilon) return "rosette";
  return "trochoid";
}

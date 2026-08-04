import type { CAPSegment } from "../data/mathematics.js";
import {
  recommendedTrochoidSampleCount,
  validateTrochoidParameters,
  type TrochoidFrame,
  type TrochoidPoint,
} from "./trochoid.js";

const TAU = 2 * Math.PI;
export const CAP_JOIN_TOLERANCE = 1e-9;

export type CAPJoinErrorKind =
  | "infeasible-target"
  | "hand-discontinuity"
  | "tip-gap";

export class CAPJoinError extends Error {
  readonly kind: CAPJoinErrorKind;
  readonly segmentIndex: number;

  constructor(kind: CAPJoinErrorKind, segmentIndex: number, message: string) {
    super(message);
    this.name = "CAPJoinError";
    this.kind = kind;
    this.segmentIndex = segmentIndex;
  }
}

export interface ResolvedCAPSegment extends CAPSegment {
  phi1: number;
  phi2: number;
}

export interface CAPJunctionContinuity {
  segmentIndex: number;
  handGap: number;
  tipGap: number;
  tipRadius: number;
}

export interface CAPCycleContinuity {
  handGap: number;
  tipGap: number;
}

export interface ResolvedCAPAssembly {
  segments: ResolvedCAPSegment[];
  totalDuration: number;
  junctions: CAPJunctionContinuity[];
  closure: CAPCycleContinuity;
}

export interface EvaluatedCAPAssemblyFrame extends TrochoidFrame {
  segmentIndex: number;
  localTime: number;
}

export interface SampledCAPAssembly {
  points: TrochoidPoint[];
  segmentPoints: TrochoidPoint[][];
}

export interface CAPJoinSolution {
  phi1: number;
  phi2: number;
  handGap: number;
  tipGap: number;
}

function distance(a: TrochoidPoint, b: TrochoidPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function sameNumber(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance;
}

function assertResolvedSegment(segment: ResolvedCAPSegment): void {
  validateTrochoidParameters(segment);
  if (!Number.isFinite(segment.phi1) || !Number.isFinite(segment.phi2)) {
    throw new RangeError("CAP segment phases must be finite");
  }
}

export function evaluateResolvedCAPSegment(
  segment: ResolvedCAPSegment,
  t: number
): TrochoidFrame {
  assertResolvedSegment(segment);
  if (!Number.isFinite(t)) throw new RangeError("t must be finite");

  const armAngle = TAU * segment.theta1 * t + segment.phi1;
  const propAngle = TAU * (segment.theta1 + segment.theta2) * t + segment.phi2;
  const hand = {
    x: segment.rho1 * Math.cos(armAngle),
    y: segment.rho1 * Math.sin(armAngle),
  };
  const tip = {
    x: hand.x + segment.rho2 * Math.cos(propAngle),
    y: hand.y + segment.rho2 * Math.sin(propAngle),
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

/**
 * Solve the two fixed-length vectors ending at targetTip and select the branch
 * whose hand point matches expectedHand. The helper is exported so the
 * off-extension branch choice can be tested independently of phase continuation.
 */
export function solveCAPJoinPhases(
  rho1: number,
  rho2: number,
  targetTip: TrochoidPoint,
  expectedHand: TrochoidPoint,
  segmentIndex = 1,
  tolerance = CAP_JOIN_TOLERANCE
): CAPJoinSolution {
  if (rho1 <= 0 || rho2 <= 0) {
    throw new RangeError("rho1 and rho2 must be greater than zero");
  }

  const targetRadius = Math.hypot(targetTip.x, targetTip.y);
  const minimumRadius = Math.abs(rho1 - rho2);
  const maximumRadius = rho1 + rho2;
  if (
    targetRadius < minimumRadius - tolerance ||
    targetRadius > maximumRadius + tolerance
  ) {
    throw new CAPJoinError(
      "infeasible-target",
      segmentIndex,
      `Segment ${segmentIndex} target radius ${targetRadius} is outside [${minimumRadius}, ${maximumRadius}]`
    );
  }

  let handCandidates: TrochoidPoint[];
  if (targetRadius <= tolerance) {
    const expectedRadius = Math.hypot(expectedHand.x, expectedHand.y);
    if (
      !sameNumber(rho1, rho2, tolerance) ||
      !sameNumber(expectedRadius, rho1, tolerance)
    ) {
      throw new CAPJoinError(
        "hand-discontinuity",
        segmentIndex,
        `Segment ${segmentIndex} has no hand-continuous branch at the origin`
      );
    }
    handCandidates = [{ ...expectedHand }];
  } else {
    const along =
      (rho1 * rho1 - rho2 * rho2 + targetRadius * targetRadius) /
      (2 * targetRadius);
    const heightSquared = Math.max(0, rho1 * rho1 - along * along);
    const height = Math.sqrt(heightSquared);
    const ux = targetTip.x / targetRadius;
    const uy = targetTip.y / targetRadius;
    const base = { x: along * ux, y: along * uy };
    const perpendicular = { x: -uy * height, y: ux * height };
    handCandidates = [
      {
        x: base.x + perpendicular.x,
        y: base.y + perpendicular.y,
      },
      {
        x: base.x - perpendicular.x,
        y: base.y - perpendicular.y,
      },
    ];
  }

  const hand = handCandidates.reduce((best, candidate) =>
    distance(candidate, expectedHand) < distance(best, expectedHand)
      ? candidate
      : best
  );
  const handGap = distance(hand, expectedHand);
  if (handGap > tolerance) {
    throw new CAPJoinError(
      "hand-discontinuity",
      segmentIndex,
      `Segment ${segmentIndex} hand gap ${handGap} exceeds ${tolerance}`
    );
  }

  const propVector = {
    x: targetTip.x - hand.x,
    y: targetTip.y - hand.y,
  };
  const phi1 = Math.atan2(hand.y, hand.x);
  const phi2 = Math.atan2(propVector.y, propVector.x);
  const solvedTip = {
    x: rho1 * Math.cos(phi1) + rho2 * Math.cos(phi2),
    y: rho1 * Math.sin(phi1) + rho2 * Math.sin(phi2),
  };
  const tipGap = distance(solvedTip, targetTip);
  if (tipGap > tolerance) {
    throw new CAPJoinError(
      "tip-gap",
      segmentIndex,
      `Segment ${segmentIndex} tip gap ${tipGap} exceeds ${tolerance}`
    );
  }

  return { phi1, phi2, handGap, tipGap };
}

function phaseContinuation(
  previous: ResolvedCAPSegment
): Pick<ResolvedCAPSegment, "phi1" | "phi2"> {
  return {
    phi1: previous.phi1 + TAU * previous.theta1 * previous.d,
    phi2:
      previous.phi2 + TAU * (previous.theta1 + previous.theta2) * previous.d,
  };
}

export function resolveCAPAssembly(
  segments: readonly CAPSegment[],
  tolerance = CAP_JOIN_TOLERANCE
): ResolvedCAPAssembly {
  if (segments.length < 2) {
    throw new RangeError("A CAP assembly requires at least two segments");
  }

  const resolved: ResolvedCAPSegment[] = [];
  const junctions: CAPJunctionContinuity[] = [];

  segments.forEach((segment, segmentIndex) => {
    validateTrochoidParameters(segment);
    let phases = { phi1: 0, phi2: 0 };

    if (segmentIndex > 0) {
      const previous = resolved[segmentIndex - 1]!;
      const previousEnd = evaluateResolvedCAPSegment(previous, previous.d);
      if (
        sameNumber(previous.rho1, segment.rho1, tolerance) &&
        sameNumber(previous.rho2, segment.rho2, tolerance)
      ) {
        phases = phaseContinuation(previous);
      } else {
        const solution = solveCAPJoinPhases(
          segment.rho1,
          segment.rho2,
          previousEnd.tip,
          previousEnd.hand,
          segmentIndex,
          tolerance
        );
        phases = { phi1: solution.phi1, phi2: solution.phi2 };
      }
    }

    const current: ResolvedCAPSegment = { ...segment, ...phases };
    assertResolvedSegment(current);

    if (segmentIndex > 0) {
      const previous = resolved[segmentIndex - 1]!;
      const previousEnd = evaluateResolvedCAPSegment(previous, previous.d);
      const currentStart = evaluateResolvedCAPSegment(current, 0);
      const handGap = distance(previousEnd.hand, currentStart.hand);
      const tipGap = distance(previousEnd.tip, currentStart.tip);
      if (handGap > tolerance) {
        throw new CAPJoinError(
          "hand-discontinuity",
          segmentIndex,
          `Segment ${segmentIndex} hand gap ${handGap} exceeds ${tolerance}`
        );
      }
      if (tipGap > tolerance) {
        throw new CAPJoinError(
          "tip-gap",
          segmentIndex,
          `Segment ${segmentIndex} tip gap ${tipGap} exceeds ${tolerance}`
        );
      }
      junctions.push({
        segmentIndex,
        handGap,
        tipGap,
        tipRadius: Math.hypot(previousEnd.tip.x, previousEnd.tip.y),
      });
    }

    resolved.push(current);
  });

  const first = evaluateResolvedCAPSegment(resolved[0]!, 0);
  const lastSegment = resolved.at(-1)!;
  const last = evaluateResolvedCAPSegment(lastSegment, lastSegment.d);

  return {
    segments: resolved,
    totalDuration: resolved.reduce((sum, segment) => sum + segment.d, 0),
    junctions,
    closure: {
      handGap: distance(first.hand, last.hand),
      tipGap: distance(first.tip, last.tip),
    },
  };
}

export function sampleResolvedCAPSegment(
  segment: ResolvedCAPSegment,
  sampleCount = recommendedTrochoidSampleCount(segment)
): TrochoidPoint[] {
  assertResolvedSegment(segment);
  if (!Number.isInteger(sampleCount) || sampleCount < 1) {
    throw new RangeError("sampleCount must be a positive integer");
  }

  return Array.from(
    { length: sampleCount + 1 },
    (_, index) =>
      evaluateResolvedCAPSegment(segment, (index / sampleCount) * segment.d).tip
  );
}

export function sampleResolvedCAPAssembly(
  assembly: ResolvedCAPAssembly,
  sampleCounts?: readonly number[]
): SampledCAPAssembly {
  const segmentPoints = assembly.segments.map((segment, index) =>
    sampleResolvedCAPSegment(segment, sampleCounts?.[index])
  );
  const points = segmentPoints.flatMap((segment, index) =>
    index === 0 ? segment : segment.slice(1)
  );
  return { points, segmentPoints };
}

export function evaluateCAPAssembly(
  assembly: ResolvedCAPAssembly,
  progress: number
): EvaluatedCAPAssemblyFrame {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1) {
    throw new RangeError("progress must be between zero and one");
  }

  const elapsed = progress * assembly.totalDuration;
  let cursor = 0;
  for (let index = 0; index < assembly.segments.length; index += 1) {
    const segment = assembly.segments[index]!;
    const isLast = index === assembly.segments.length - 1;
    if (elapsed <= cursor + segment.d || isLast) {
      const localTime = Math.min(segment.d, Math.max(0, elapsed - cursor));
      return {
        ...evaluateResolvedCAPSegment(segment, localTime),
        segmentIndex: index,
        localTime,
      };
    }
    cursor += segment.d;
  }

  throw new RangeError("CAP assembly has no evaluable segment");
}

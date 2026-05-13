import type { Point2D } from "./body-rotation-solver";
import { computeReachPercentage } from "./reach-calculator";
import { getShoulderPosition } from "./reach-calculator";
import { computeTargetRotation } from "./body-rotation-solver";

export type UnreachableReason =
  | "over-extension"
  | "cross-body"
  | "behind-body"
  | "body-turn-resolves";

export interface ReachabilityDiagnosis {
  side: "left" | "right";
  reachable: boolean;
  reasons: UnreachableReason[];
  suggestion: string;
}

export function diagnoseReachability(
  side: "left" | "right",
  propPos: Point2D,
  shoulder: Point2D,
  otherShoulder: Point2D,
  otherPropPos: Point2D,
  bodyCenter: Point2D,
  maxReach: number,
  shoulderDist: number,
  behindThreshold: number,
): ReachabilityDiagnosis {
  const reachPct = computeReachPercentage(shoulder, propPos, maxReach);
  const reachable = reachPct <= 100;

  if (reachable) {
    return { side, reachable: true, reasons: [], suggestion: "" };
  }

  const reasons: UnreachableReason[] = [];

  if (reachPct > 100) {
    reasons.push("over-extension");
  }

  const crossingMidline =
    (side === "left" && propPos.x > bodyCenter.x + 10) ||
    (side === "right" && propPos.x < bodyCenter.x - 10);
  if (crossingMidline) {
    reasons.push("cross-body");
  }

  const behind = propPos.y > bodyCenter.y + behindThreshold;
  if (behind) {
    reasons.push("behind-body");
  }

  const wouldResolve = checkBodyTurnResolves(
    side,
    propPos,
    otherPropPos,
    bodyCenter,
    shoulderDist,
    maxReach,
    behindThreshold,
  );
  if (wouldResolve) {
    reasons.push("body-turn-resolves");
  }

  return {
    side,
    reachable: false,
    reasons,
    suggestion: buildSuggestion(reasons),
  };
}

function checkBodyTurnResolves(
  side: "left" | "right",
  propPos: Point2D,
  otherPropPos: Point2D,
  bodyCenter: Point2D,
  shoulderDist: number,
  maxReach: number,
  behindThreshold: number,
): boolean {
  const targetRot = computeTargetRotation(
    side === "left" ? propPos : otherPropPos,
    side === "left" ? otherPropPos : propPos,
    bodyCenter,
    behindThreshold,
  );
  if (targetRot === null) return false;

  const newShoulder = getShoulderPosition(side, targetRot, bodyCenter, shoulderDist);
  const newReach = computeReachPercentage(newShoulder, propPos, maxReach);
  return newReach <= 100;
}

function buildSuggestion(reasons: UnreachableReason[]): string {
  if (reasons.includes("body-turn-resolves")) {
    return "Body turn would make this reachable";
  }
  if (reasons.includes("behind-body") && reasons.includes("over-extension")) {
    return "Prop too far behind — consider plane split";
  }
  if (reasons.includes("cross-body")) {
    return "Cross-body reach — swap hands or turn body";
  }
  if (reasons.includes("over-extension")) {
    return "Beyond arm reach — move prop closer";
  }
  return "Position unreachable";
}

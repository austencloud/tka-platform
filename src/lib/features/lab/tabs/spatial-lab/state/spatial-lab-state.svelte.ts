import {
  computeTargetRotation,
  stepRotation,
  type Point2D,
} from "../services/body-rotation-solver";
import { getShoulderPosition, computeReachPercentage } from "../services/reach-calculator";
import { detectCrossing } from "../services/crossing-detector";
import { detectPlaneSplit } from "../services/plane-split-detector";
import {
  BODY_CENTER,
  SHOULDER_DIST,
  MAX_REACH,
  BEHIND_THRESHOLD,
  MAX_ROTATION_SPEED,
  GRID_POINTS_P1,
  GRID_POINTS_P2,
  type Preset,
} from "./spatial-lab-constants";

export class SpatialLabState {
  leftProp = $state<Point2D>({ x: 450, y: 180 });
  rightProp = $state<Point2D>({ x: 460, y: 180 });
  bodyRotation = $state(0);
  bodyLocked = $state(false);
  showReachEnvelopes = $state(true);
  showArmLines = $state(true);
  showCrossingAlert = $state(true);

  private _targetRotation = 0;

  readonly bodyCenter = BODY_CENTER;
  readonly shoulderDist = SHOULDER_DIST;
  readonly maxReach = MAX_REACH;

  leftShoulder = $derived(
    getShoulderPosition("left", this.bodyRotation, BODY_CENTER, SHOULDER_DIST),
  );

  rightShoulder = $derived(
    getShoulderPosition("right", this.bodyRotation, BODY_CENTER, SHOULDER_DIST),
  );

  planeSplitActive = $derived(
    detectPlaneSplit(this.leftProp.y, this.rightProp.y, BODY_CENTER.y, BEHIND_THRESHOLD),
  );

  crossing = $derived(
    detectCrossing(this.leftShoulder, this.leftProp, this.rightShoulder, this.rightProp),
  );

  leftReachPct = $derived(
    computeReachPercentage(this.leftShoulder, this.leftProp, MAX_REACH),
  );

  rightReachPct = $derived(
    computeReachPercentage(this.rightShoulder, this.rightProp, MAX_REACH),
  );

  leftReachable = $derived(this.leftReachPct <= 100);
  rightReachable = $derived(this.rightReachPct <= 100);

  snapPoints = $derived(
    this.planeSplitActive
      ? [...GRID_POINTS_P1, ...GRID_POINTS_P2]
      : [...GRID_POINTS_P1],
  );

  toggleBodyLock(): void {
    this.bodyLocked = !this.bodyLocked;
  }

  applyPreset(preset: Preset): void {
    this.bodyLocked = false;
    this.leftProp = { ...preset.left };
    this.rightProp = { ...preset.right };
    this._targetRotation =
      computeTargetRotation(this.leftProp, this.rightProp, BODY_CENTER, BEHIND_THRESHOLD) ??
      this.bodyRotation;
    this.bodyRotation = this._targetRotation;
  }

  snapProp(side: "left" | "right"): void {
    const pos = side === "left" ? this.leftProp : this.rightProp;
    let best: Point2D | null = null;
    let bestDist = 45;
    for (const pt of this.snapPoints) {
      const d = Math.hypot(pos.x - pt.x, pos.y - pt.y);
      if (d < bestDist) {
        bestDist = d;
        best = { x: pt.x, y: pt.y };
      }
    }
    if (best) {
      if (side === "left") this.leftProp = best;
      else this.rightProp = best;
    }
  }

  tick(): void {
    if (this.bodyLocked) return;

    const target = computeTargetRotation(
      this.leftProp,
      this.rightProp,
      BODY_CENTER,
      BEHIND_THRESHOLD,
    );

    if (target !== null) {
      this._targetRotation = target;
    }

    this.bodyRotation = stepRotation(
      this.bodyRotation,
      this._targetRotation,
      MAX_ROTATION_SPEED,
    );
  }
}

export function createSpatialLabState(): SpatialLabState {
  return new SpatialLabState();
}

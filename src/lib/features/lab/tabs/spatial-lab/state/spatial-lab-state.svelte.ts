import {
  computeTargetRotation,
  stepRotation,
  type Point2D,
} from "../services/body-rotation-solver";
import { getShoulderPosition, computeReachPercentage } from "../services/reach-calculator";
import { detectCrossing } from "../services/crossing-detector";
import { detectPlaneSplit } from "../services/plane-split-detector";
import {
  project3Dto2D,
  unproject2Dto3D,
  getProjectedGridPoints,
  getViewConfig,
  getBodyEllipseParams,
  type Point3D,
  type ViewProjection,
  type ProjectedGridPoint,
} from "../services/projection";
import {
  BODY_CENTER,
  SHOULDER_DIST,
  MAX_REACH,
  BEHIND_THRESHOLD,
  MAX_ROTATION_SPEED,
  type Preset,
} from "./spatial-lab-constants";
import { DEMO_SEQUENCES, type DemoSequence, type SequenceBeat } from "../services/demo-sequences";
import { diagnoseReachability, type ReachabilityDiagnosis } from "../services/reachability-taxonomy";

export type LabMode = "sandbox" | "sequence";

export class SpatialLabState {
  leftProp3D = $state<Point3D>({ x: 0.95, y: 0, z: 0 });
  rightProp3D = $state<Point3D>({ x: 1, y: 0, z: 0 });
  bodyRotation = $state(0);
  bodyLocked = $state(false);
  showReachEnvelopes = $state(true);
  showArmLines = $state(true);
  showCrossingAlert = $state(true);
  viewProjection = $state<ViewProjection>("floor");

  // Sequence mode
  mode = $state<LabMode>("sandbox");
  activeSequence = $state<DemoSequence | null>(null);
  beatIndex = $state(0);
  playing = $state(false);
  playbackBpm = $state(60);
  private _playElapsed = 0;

  private _targetRotation = 0;

  readonly bodyCenter = BODY_CENTER;
  readonly shoulderDist = SHOULDER_DIST;
  readonly maxReach = MAX_REACH;

  // Projected 2D positions for display
  leftProp = $derived(project3Dto2D(this.leftProp3D, this.viewProjection));
  rightProp = $derived(project3Dto2D(this.rightProp3D, this.viewProjection));

  // Floor-projected positions for body rotation (always bird's eye logic)
  private leftPropFloor = $derived(project3Dto2D(this.leftProp3D, "floor"));
  private rightPropFloor = $derived(project3Dto2D(this.rightProp3D, "floor"));

  leftShoulder = $derived(
    getShoulderPosition("left", this.bodyRotation, BODY_CENTER, SHOULDER_DIST),
  );

  rightShoulder = $derived(
    getShoulderPosition("right", this.bodyRotation, BODY_CENTER, SHOULDER_DIST),
  );

  planeSplitActive = $derived(
    detectPlaneSplit(this.leftPropFloor.y, this.rightPropFloor.y, BODY_CENTER.y, BEHIND_THRESHOLD),
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

  leftDiagnosis: ReachabilityDiagnosis = $derived(
    diagnoseReachability(
      "left", this.leftProp, this.leftShoulder, this.rightShoulder,
      this.rightProp, BODY_CENTER, MAX_REACH, SHOULDER_DIST, BEHIND_THRESHOLD,
    ),
  );

  rightDiagnosis: ReachabilityDiagnosis = $derived(
    diagnoseReachability(
      "right", this.rightProp, this.rightShoulder, this.leftShoulder,
      this.leftProp, BODY_CENTER, MAX_REACH, SHOULDER_DIST, BEHIND_THRESHOLD,
    ),
  );

  gridPoints = $derived(
    getProjectedGridPoints(this.viewProjection, this.planeSplitActive),
  );

  viewConfig = $derived(getViewConfig(this.viewProjection));
  bodyEllipse = $derived(getBodyEllipseParams(this.viewProjection));

  toggleBodyLock(): void {
    this.bodyLocked = !this.bodyLocked;
  }

  setView(view: ViewProjection): void {
    this.viewProjection = view;
  }

  applyPreset(preset: Preset): void {
    this.bodyLocked = false;
    this.leftProp3D = { ...preset.left };
    this.rightProp3D = { ...preset.right };
    const floorL = project3Dto2D(this.leftProp3D, "floor");
    const floorR = project3Dto2D(this.rightProp3D, "floor");
    this._targetRotation =
      computeTargetRotation(floorL, floorR, BODY_CENTER, BEHIND_THRESHOLD) ??
      this.bodyRotation;
    this.bodyRotation = this._targetRotation;
  }

  setPropPosition(side: "left" | "right", svgPos: Point2D): void {
    const freeAxis = side === "left" ? this.leftProp3D : this.rightProp3D;
    let freeAxisValue: number;
    switch (this.viewProjection) {
      case "floor": freeAxisValue = freeAxis.y; break;
      case "wall": freeAxisValue = freeAxis.z; break;
      case "wheel": freeAxisValue = freeAxis.x; break;
    }
    const pt3D = unproject2Dto3D(svgPos, this.viewProjection, freeAxisValue);
    if (side === "left") this.leftProp3D = pt3D;
    else this.rightProp3D = pt3D;
  }

  readonly demoSequences = DEMO_SEQUENCES;

  currentBeat = $derived<SequenceBeat | null>(
    this.activeSequence ? this.activeSequence.beats[this.beatIndex] ?? null : null,
  );

  totalBeats = $derived(this.activeSequence?.beats.length ?? 0);

  loadSequence(seq: DemoSequence): void {
    this.mode = "sequence";
    this.activeSequence = seq;
    this.beatIndex = 0;
    this.playing = false;
    this._playElapsed = 0;
    this.bodyLocked = false;
    const first = seq.beats[0];
    if (first) this._applyBeat(first);
  }

  exitSequenceMode(): void {
    this.mode = "sandbox";
    this.activeSequence = null;
    this.playing = false;
    this.beatIndex = 0;
    this._playElapsed = 0;
  }

  setBeat(index: number): void {
    if (!this.activeSequence) return;
    const clamped = Math.max(0, Math.min(index, this.activeSequence.beats.length - 1));
    this.beatIndex = clamped;
    this._playElapsed = 0;
    const beat = this.activeSequence.beats[clamped];
    if (beat) this._applyBeat(beat);
  }

  togglePlayback(): void {
    this.playing = !this.playing;
    this._playElapsed = 0;
  }

  private _applyBeat(beat: SequenceBeat): void {
    this.leftProp3D = { ...beat.left };
    this.rightProp3D = { ...beat.right };
    const floorL = project3Dto2D(this.leftProp3D, "floor");
    const floorR = project3Dto2D(this.rightProp3D, "floor");
    this._targetRotation =
      computeTargetRotation(floorL, floorR, BODY_CENTER, BEHIND_THRESHOLD) ??
      this.bodyRotation;
    this.bodyRotation = this._targetRotation;
  }

  snapProp(side: "left" | "right"): void {
    const pos = side === "left" ? this.leftProp : this.rightProp;
    let best: ProjectedGridPoint | null = null;
    let bestDist = 45;
    for (const pt of this.gridPoints) {
      const d = Math.hypot(pos.x - pt.x, pos.y - pt.y);
      if (d < bestDist) {
        bestDist = d;
        best = pt;
      }
    }
    if (best) {
      this.setPropPosition(side, { x: best.x, y: best.y });
    }
  }

  tick(): void {
    if (this.playing && this.activeSequence) {
      this._playElapsed++;
      const framesPerBeat = Math.round(60 / (this.playbackBpm / 60));
      if (this._playElapsed >= framesPerBeat) {
        this._playElapsed = 0;
        const next = (this.beatIndex + 1) % this.activeSequence.beats.length;
        this.beatIndex = next;
        const nextBeat = this.activeSequence.beats[next];
        if (nextBeat) this._applyBeat(nextBeat);
      }
    }

    if (this.bodyLocked) return;

    const target = computeTargetRotation(
      this.leftPropFloor,
      this.rightPropFloor,
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

/**
 * Mounted-pose composition layer for the Flow Fest electric unicycle.
 *
 * FFS-FID-001 replaces a single avatar root Y/Z offset with an explicit
 * contact pose: two pedal anchors that pitch and roll with the wheel, a
 * procedural stance blended from the vehicle's own dynamics, and a final
 * two-bone IK pass that puts each sole on its own pedal.
 *
 * This module owns only the arithmetic. It never touches a bone, a scene
 * graph, or the renderer, so every acceptance number in the backlog item can
 * be asserted without a browser. The Three.js half lives in
 * `services/flow-fest-euc-mounted-pose-rig.ts`.
 */

import { FLOW_FEST_EUC_CONFIG } from "./flow-fest-electric-unicycle";

/**
 * The pedal plates authored in `FlowFestElectricUnicycle.svelte`: boxes of
 * 0.27 x 0.035 x 0.25 centred at (+/-0.23, 0.25, 0.015) inside the rider-lean
 * group, with 0.01-thick grip strips centred at y = 0.272 on top of them.
 *
 * Stance width is therefore a property of the vehicle, not a number the pose
 * invented. If the plates move, the stance follows them.
 */
export const FLOW_FEST_EUC_PEDAL_GEOMETRY = Object.freeze({
  lateralOffsetMeters: 0.23,
  longitudinalOffsetMeters: 0.015,
  plateCenterHeightMeters: 0.25,
  plateThicknessMeters: 0.035,
  plateWidthMeters: 0.27,
  plateDepthMeters: 0.25,
  gripStripCenterHeightMeters: 0.272,
  gripStripThicknessMeters: 0.01,
});

/** Top face of the grip strips: the surface a sole actually rests on. */
export const FLOW_FEST_EUC_PEDAL_SURFACE_HEIGHT_METERS =
  FLOW_FEST_EUC_PEDAL_GEOMETRY.gripStripCenterHeightMeters +
  FLOW_FEST_EUC_PEDAL_GEOMETRY.gripStripThicknessMeters / 2;

/** Centre-to-centre distance between the two pedal plates. */
export const FLOW_FEST_EUC_PEDAL_SEPARATION_METERS =
  FLOW_FEST_EUC_PEDAL_GEOMETRY.lateralOffsetMeters * 2;

export type FlowFestEucPedalSide = "left" | "right";

export interface FlowFestEucVector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * The pedal anchor in the rider-lean group's local frame.
 *
 * `left` is the RIDER's left, and that is +X here. The vehicle's forward is
 * +Z (headlight at z = +0.182, tail light at z = -0.17) and up is +Y, so a
 * body facing +Z in a right-handed Y-up frame has its left at +X. The `ch01`
 * rig agrees: its `LeftUpLeg` sits at x = +0.098 and its toes at +Z.
 *
 * Getting this backwards puts each shoe on the opposite pedal, which reads as
 * a rider standing pigeon-toed with the soles rolled outward.
 */
export function flowFestEucPedalAnchorLocal(
  side: FlowFestEucPedalSide
): FlowFestEucVector3 {
  return {
    x:
      (side === "left" ? 1 : -1) *
      FLOW_FEST_EUC_PEDAL_GEOMETRY.lateralOffsetMeters,
    y: FLOW_FEST_EUC_PEDAL_SURFACE_HEIGHT_METERS,
    z: FLOW_FEST_EUC_PEDAL_GEOMETRY.longitudinalOffsetMeters,
  };
}

/**
 * The suspension travel the visual hierarchy applies at a given roughness and
 * wheel phase. Duplicated from the component so a test can drive the anchor
 * math without mounting Threlte; the component imports it rather than keeping
 * its own copy, so the two cannot drift.
 */
export function flowFestEucSuspensionOffsetMeters(
  roughnessMeters: number,
  wheelRotationRadians: number
): number {
  return (
    -roughnessMeters * 0.48 +
    Math.sin(wheelRotationRadians * 0.43) * roughnessMeters * 0.32
  );
}

// ── Stance blend ────────────────────────────────────────────────────────────

export type FlowFestEucStancePose =
  | "neutral"
  | "accelerate"
  | "brake"
  | "carveLeft"
  | "carveRight";

export type FlowFestEucStanceBlend = Record<FlowFestEucStancePose, number>;

/**
 * One authored stance, expressed in the pedal frame.
 *
 * `pelvisForward`/`pelvisLateral` move the hips over the support line;
 * `kneeFlexRadians` sets how much bend the leg holds, which in turn decides
 * how tall the rider stands. `torsoPitch`/`torsoRoll` are the counter-rotation
 * the upper body carries relative to the pelvis.
 */
export interface FlowFestEucStanceOffsets {
  pelvisForwardMeters: number;
  pelvisLateralMeters: number;
  kneeFlexRadians: number;
  pelvisPitchRadians: number;
  pelvisRollRadians: number;
  torsoPitchRadians: number;
  torsoRollRadians: number;
}

const degrees = (value: number): number => (value * Math.PI) / 180;

/**
 * The five authored stances. A rider stands with the knees soft and the hips
 * centred, pushes the hips forward and drops lower to accelerate, sits back
 * and deeper to brake, and leans into a carve while the torso stays nearer
 * vertical than the pelvis.
 */
export const FLOW_FEST_EUC_STANCE_POSES: Readonly<
  Record<FlowFestEucStancePose, FlowFestEucStanceOffsets>
> = Object.freeze({
  neutral: Object.freeze({
    pelvisForwardMeters: 0,
    pelvisLateralMeters: 0,
    kneeFlexRadians: degrees(14),
    pelvisPitchRadians: degrees(6),
    pelvisRollRadians: 0,
    torsoPitchRadians: degrees(4),
    torsoRollRadians: 0,
  }),
  accelerate: Object.freeze({
    pelvisForwardMeters: 0.055,
    pelvisLateralMeters: 0,
    kneeFlexRadians: degrees(20),
    pelvisPitchRadians: degrees(13),
    pelvisRollRadians: 0,
    torsoPitchRadians: degrees(9),
    torsoRollRadians: 0,
  }),
  brake: Object.freeze({
    pelvisForwardMeters: -0.06,
    pelvisLateralMeters: 0,
    kneeFlexRadians: degrees(26),
    pelvisPitchRadians: degrees(-4),
    pelvisRollRadians: 0,
    torsoPitchRadians: degrees(-7),
    torsoRollRadians: 0,
  }),
  carveLeft: Object.freeze({
    pelvisForwardMeters: 0,
    pelvisLateralMeters: -0.038,
    kneeFlexRadians: degrees(18),
    pelvisPitchRadians: degrees(6),
    pelvisRollRadians: degrees(-5),
    torsoPitchRadians: degrees(4),
    torsoRollRadians: degrees(7),
  }),
  carveRight: Object.freeze({
    pelvisForwardMeters: 0,
    pelvisLateralMeters: 0.038,
    kneeFlexRadians: degrees(18),
    pelvisPitchRadians: degrees(6),
    pelvisRollRadians: degrees(5),
    torsoPitchRadians: degrees(4),
    torsoRollRadians: degrees(-7),
  }),
});

/** How fast the blend follows its drive signals, in e-folds per second. */
export const FLOW_FEST_EUC_STANCE_RESPONSE_PER_SECOND = 6.5;

export interface FlowFestEucStanceDrive {
  longitudinalAccelerationMetersPerSecondSquared: number;
  leanRadians: number;
}

export interface FlowFestEucStanceSignals {
  accelerate: number;
  brake: number;
  carveLeft: number;
  carveRight: number;
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * Normalize the vehicle's own outputs into 0-1 stance drives.
 *
 * Acceleration is referenced to the performance-mode figure and braking to the
 * regenerative figure, so full-throttle and full-brake both reach 1 without
 * either clipping in normal riding. Lean is already a damped visual signal in
 * the dynamics, so its own maximum is the reference.
 */
export function flowFestEucStanceSignals(
  drive: FlowFestEucStanceDrive
): FlowFestEucStanceSignals {
  const acceleration = drive.longitudinalAccelerationMetersPerSecondSquared;
  const lean = drive.leanRadians;
  return {
    accelerate: clamp01(
      acceleration /
        FLOW_FEST_EUC_CONFIG.performanceAccelerationMetersPerSecondSquared
    ),
    brake: clamp01(
      -acceleration /
        FLOW_FEST_EUC_CONFIG.regenerativeBrakingMetersPerSecondSquared
    ),
    // Positive steer turns the rider toward their left and the dynamics negate
    // it into lean, so a negative lean is a left carve.
    carveLeft: clamp01(-lean / FLOW_FEST_EUC_CONFIG.maximumVisualLeanRadians),
    carveRight: clamp01(lean / FLOW_FEST_EUC_CONFIG.maximumVisualLeanRadians),
  };
}

/**
 * Turn the drives into normalized blend weights.
 *
 * Accelerate/brake and carveLeft/carveRight are each mutually exclusive, so
 * the four never sum past two. Whatever they leave unclaimed is neutral, and
 * the whole set is renormalized so a pose is always a convex combination.
 */
export function flowFestEucStanceBlend(
  signals: FlowFestEucStanceSignals
): FlowFestEucStanceBlend {
  const claimed =
    signals.accelerate + signals.brake + signals.carveLeft + signals.carveRight;
  const neutral = Math.max(0, 1 - claimed);
  const total = claimed + neutral;
  if (total <= 1e-9) {
    return {
      neutral: 1,
      accelerate: 0,
      brake: 0,
      carveLeft: 0,
      carveRight: 0,
    };
  }
  return {
    neutral: neutral / total,
    accelerate: signals.accelerate / total,
    brake: signals.brake / total,
    carveLeft: signals.carveLeft / total,
    carveRight: signals.carveRight / total,
  };
}

/** Weighted sum of the authored stances. */
export function flowFestEucStanceOffsets(
  blend: FlowFestEucStanceBlend
): FlowFestEucStanceOffsets {
  const out: FlowFestEucStanceOffsets = {
    pelvisForwardMeters: 0,
    pelvisLateralMeters: 0,
    kneeFlexRadians: 0,
    pelvisPitchRadians: 0,
    pelvisRollRadians: 0,
    torsoPitchRadians: 0,
    torsoRollRadians: 0,
  };
  for (const pose of Object.keys(
    FLOW_FEST_EUC_STANCE_POSES
  ) as FlowFestEucStancePose[]) {
    const weight = blend[pose];
    if (weight === 0) continue;
    const offsets = FLOW_FEST_EUC_STANCE_POSES[pose];
    out.pelvisForwardMeters += offsets.pelvisForwardMeters * weight;
    out.pelvisLateralMeters += offsets.pelvisLateralMeters * weight;
    out.kneeFlexRadians += offsets.kneeFlexRadians * weight;
    out.pelvisPitchRadians += offsets.pelvisPitchRadians * weight;
    out.pelvisRollRadians += offsets.pelvisRollRadians * weight;
    out.torsoPitchRadians += offsets.torsoPitchRadians * weight;
    out.torsoRollRadians += offsets.torsoRollRadians * weight;
  }
  return out;
}

/**
 * Frame-rate independent follower for the four stance drives.
 *
 * The exponential form is the same one the vehicle dynamics use: stepping it
 * twice at 1/60 s lands within floating-point noise of one step at 1/30 s, so
 * a simulation that changes frame rate does not change the pose it converges
 * to. The 30-vs-60 FPS acceptance criterion is a property of this function.
 */
export function advanceFlowFestEucStanceSignals(
  current: FlowFestEucStanceSignals,
  target: FlowFestEucStanceSignals,
  deltaSeconds: number,
  responsePerSecond = FLOW_FEST_EUC_STANCE_RESPONSE_PER_SECOND
): FlowFestEucStanceSignals {
  if (!(deltaSeconds > 0)) return { ...current };
  const blend = 1 - Math.exp(-responsePerSecond * deltaSeconds);
  return {
    accelerate:
      current.accelerate + (target.accelerate - current.accelerate) * blend,
    brake: current.brake + (target.brake - current.brake) * blend,
    carveLeft:
      current.carveLeft + (target.carveLeft - current.carveLeft) * blend,
    carveRight:
      current.carveRight + (target.carveRight - current.carveRight) * blend,
  };
}

// ── Stand height ────────────────────────────────────────────────────────────

/**
 * Hip-to-ankle distance for a two-bone leg holding `kneeFlexRadians` of bend.
 *
 * Zero flex is a straight leg at `upper + lower`. The solver clamps its own
 * reach just under that, so asking for even a few degrees of bend keeps the
 * knee off its own limit and out of the hyperextension/pole-flip regime.
 */
export function flowFestEucLegReachMeters(
  upperLengthMeters: number,
  lowerLengthMeters: number,
  kneeFlexRadians: number
): number {
  const interior = Math.PI - Math.abs(kneeFlexRadians);
  return Math.sqrt(
    Math.max(
      0,
      upperLengthMeters * upperLengthMeters +
        lowerLengthMeters * lowerLengthMeters -
        2 * upperLengthMeters * lowerLengthMeters * Math.cos(interior)
    )
  );
}

/** Inverse of {@link flowFestEucLegReachMeters}: the bend a reach implies. */
export function flowFestEucKneeFlexRadians(
  upperLengthMeters: number,
  lowerLengthMeters: number,
  reachMeters: number
): number {
  const denominator = 2 * upperLengthMeters * lowerLengthMeters;
  if (denominator <= 1e-9) return 0;
  const cosInterior =
    (upperLengthMeters * upperLengthMeters +
      lowerLengthMeters * lowerLengthMeters -
      reachMeters * reachMeters) /
    denominator;
  const interior = Math.acos(Math.min(1, Math.max(-1, cosInterior)));
  return Math.PI - interior;
}

/**
 * Hard bound on how far the pelvis may travel laterally from the wheel centre
 * plane, whatever a stance asks for.
 *
 * The support line is the segment between the two pedal centres, so half the
 * pedal separation is where the pelvis leaves it entirely. A rider shifts a
 * fraction of that; this bound exists so a future stance edit cannot push the
 * hips off the support line without failing here first.
 */
export const FLOW_FEST_EUC_MAXIMUM_PELVIS_LATERAL_METERS = 0.09;

/**
 * How far above the support plane the pelvis has to sit for one leg to hold
 * exactly `reachMeters` between its hip joint and its ankle target.
 *
 * `perpendicularMeters` is the part of the hip-to-ankle offset that the height
 * cannot change - stance width, fore/aft weight shift, the hip joint's own
 * lateral offset from the pelvis. `alongUpMeters` is the part that already
 * lies along the support normal before the height is added.
 *
 * Returns null when the leg cannot span the perpendicular part at any height.
 * That is a stance the rig physically cannot take, and inventing a number for
 * it would hide the fact.
 */
export function flowFestEucStandHeightMeters(
  reachMeters: number,
  perpendicularMeters: number,
  alongUpMeters: number
): number | null {
  const remaining =
    reachMeters * reachMeters - perpendicularMeters * perpendicularMeters;
  if (remaining < 0) return null;
  return alongUpMeters + Math.sqrt(remaining);
}

// ── Contact diagnostics ─────────────────────────────────────────────────────

/**
 * The acceptance thresholds from
 * `docs/superpowers/specs/flow-fest-sim/flow-fest-fidelity-backlog.md`
 * FFS-FID-001. They live here so the runtime diagnostic and the unit suite
 * grade against one set of numbers.
 */
export const FLOW_FEST_EUC_CONTACT_THRESHOLDS = Object.freeze({
  maximumSoleErrorMeters: 0.02,
  maximumPenetrationMeters: 0.01,
  maximumFootForwardDegrees: 8,
  maximumPelvisLateralOffsetMeters: 0.04,
  maximumIdleDeviationMeters: 0.01,
  idleWindowSeconds: 10,
  /** Below this the knee is effectively straight and the pole test unreadable. */
  minimumKneeFlexDegrees: 4,
  /** Bend past this reads as a squat rather than a riding stance. */
  maximumKneeFlexDegrees: 65,
});

export interface FlowFestEucSoleContact {
  /** Distance from the sole centre to the pedal centre, in metres. */
  errorMeters: number;
  /** Depth of the sole below the pedal surface. Negative means clear of it. */
  penetrationMeters: number;
  /** Angle between the sole's forward axis and the pedal's forward basis. */
  forwardErrorDegrees: number;
  /** Signed lateral, forward, and normal components of the same error. */
  lateralErrorMeters: number;
  forwardErrorMeters: number;
  kneeFlexDegrees: number;
  /**
   * True when the knee sits on the forward side of the hip-to-ankle line.
   *
   * This is the pole-flip test, graded separately from the angle: a knee that
   * reaches the same ankle target by folding backwards passes every distance
   * check while reading as a broken leg.
   */
  kneeForward: boolean;
}

export interface FlowFestEucContactVerdict {
  soleWithinTolerance: boolean;
  penetrationWithinTolerance: boolean;
  footForwardWithinTolerance: boolean;
  kneeWithinRange: boolean;
  kneeForward: boolean;
  pass: boolean;
}

export function gradeFlowFestEucSoleContact(
  contact: FlowFestEucSoleContact,
  thresholds = FLOW_FEST_EUC_CONTACT_THRESHOLDS
): FlowFestEucContactVerdict {
  const soleWithinTolerance =
    contact.errorMeters <= thresholds.maximumSoleErrorMeters;
  const penetrationWithinTolerance =
    contact.penetrationMeters <= thresholds.maximumPenetrationMeters;
  const footForwardWithinTolerance =
    contact.forwardErrorDegrees <= thresholds.maximumFootForwardDegrees;
  const kneeWithinRange =
    contact.kneeFlexDegrees >= thresholds.minimumKneeFlexDegrees &&
    contact.kneeFlexDegrees <= thresholds.maximumKneeFlexDegrees;
  return {
    soleWithinTolerance,
    penetrationWithinTolerance,
    footForwardWithinTolerance,
    kneeWithinRange,
    kneeForward: contact.kneeForward,
    pass:
      soleWithinTolerance &&
      penetrationWithinTolerance &&
      footForwardWithinTolerance &&
      kneeWithinRange &&
      contact.kneeForward,
  };
}

export interface FlowFestEucIdleStabilitySample {
  timeSeconds: number;
  leftErrorMeters: number;
  rightErrorMeters: number;
}

export interface FlowFestEucIdleStabilityReport {
  windowSeconds: number;
  sampleCount: number;
  leftSpreadMeters: number;
  rightSpreadMeters: number;
  /** True once a full window of idle samples has stayed inside tolerance. */
  pass: boolean;
}

/**
 * Rolling idle-contact stability.
 *
 * The criterion is spread, not absolute error: a contact that sits 4 mm off
 * and never moves is stable, and one that oscillates between 0 and 9 mm is
 * not, even though both stay under the 2 cm placement tolerance.
 */
export class FlowFestEucIdleStabilityTracker {
  private readonly samples: FlowFestEucIdleStabilitySample[] = [];

  constructor(
    private readonly windowSeconds = FLOW_FEST_EUC_CONTACT_THRESHOLDS
      .idleWindowSeconds,
    private readonly toleranceMeters = FLOW_FEST_EUC_CONTACT_THRESHOLDS
      .maximumIdleDeviationMeters
  ) {}

  reset(): void {
    this.samples.length = 0;
  }

  record(sample: FlowFestEucIdleStabilitySample): void {
    this.samples.push(sample);
    const cutoff = sample.timeSeconds - this.windowSeconds;
    let firstInside = 0;
    while (
      firstInside < this.samples.length &&
      this.samples[firstInside]!.timeSeconds < cutoff
    ) {
      firstInside += 1;
    }
    // Keep the last sample that falls outside the window, so the retained span
    // brackets the full window rather than stopping one frame short of it.
    // Dropping it makes `windowSeconds >= this.windowSeconds` unreachable and
    // the report can never pass, however steady the contact actually is.
    const firstKept = Math.max(0, firstInside - 1);
    if (firstKept > 0) this.samples.splice(0, firstKept);
  }

  report(): FlowFestEucIdleStabilityReport {
    if (this.samples.length === 0) {
      return {
        windowSeconds: 0,
        sampleCount: 0,
        leftSpreadMeters: 0,
        rightSpreadMeters: 0,
        pass: false,
      };
    }
    let leftMin = Infinity;
    let leftMax = -Infinity;
    let rightMin = Infinity;
    let rightMax = -Infinity;
    for (const sample of this.samples) {
      if (sample.leftErrorMeters < leftMin) leftMin = sample.leftErrorMeters;
      if (sample.leftErrorMeters > leftMax) leftMax = sample.leftErrorMeters;
      if (sample.rightErrorMeters < rightMin) rightMin = sample.rightErrorMeters;
      if (sample.rightErrorMeters > rightMax) rightMax = sample.rightErrorMeters;
    }
    const first = this.samples[0]!;
    const last = this.samples[this.samples.length - 1]!;
    const windowSeconds = last.timeSeconds - first.timeSeconds;
    const leftSpreadMeters = leftMax - leftMin;
    const rightSpreadMeters = rightMax - rightMin;
    return {
      windowSeconds,
      sampleCount: this.samples.length,
      leftSpreadMeters,
      rightSpreadMeters,
      pass:
        windowSeconds >= this.windowSeconds &&
        leftSpreadMeters <= this.toleranceMeters &&
        rightSpreadMeters <= this.toleranceMeters,
    };
  }
}

export type FlowFestEucMountedPoseStatus =
  | "detached"
  | "waiting-for-rig"
  | "unsupported-rig"
  | "ready";

export interface FlowFestEucPoint {
  x: number;
  y: number;
  z: number;
}

/**
 * World-space endpoints of the measured error, per side.
 *
 * The scalar error says how far apart they are; these say where they are, so a
 * screenshot can show the two coinciding rather than only asserting it.
 */
export interface FlowFestEucContactPoints {
  soleWorld: FlowFestEucPoint;
  anchorWorld: FlowFestEucPoint;
}

export function emptyFlowFestEucContactPoints(): FlowFestEucContactPoints {
  return {
    soleWorld: { x: 0, y: 0, z: 0 },
    anchorWorld: { x: 0, y: 0, z: 0 },
  };
}

export interface FlowFestEucMountedPoseDiagnostic {
  status: FlowFestEucMountedPoseStatus;
  /** Non-null when the rig was rejected, naming the missing capability. */
  unsupportedReason: string | null;
  left: FlowFestEucSoleContact;
  right: FlowFestEucSoleContact;
  leftPoints: FlowFestEucContactPoints;
  rightPoints: FlowFestEucContactPoints;
  leftVerdict: FlowFestEucContactVerdict;
  rightVerdict: FlowFestEucContactVerdict;
  /** Signed hip offset from the wheel centre plane, in the wheel's frame. */
  pelvisLateralOffsetMeters: number;
  pelvisForwardOffsetMeters: number;
  pelvisWithinTolerance: boolean;
  blend: FlowFestEucStanceBlend;
  stanceWidthMeters: number;
  idleStability: FlowFestEucIdleStabilityReport;
  /** True while ordinary locomotion and foot planting are suspended. */
  locomotionSuspended: boolean;
  frameRateHz: number;
  pass: boolean;
}

export function emptyFlowFestEucSoleContact(): FlowFestEucSoleContact {
  return {
    errorMeters: Number.NaN,
    penetrationMeters: Number.NaN,
    forwardErrorDegrees: Number.NaN,
    lateralErrorMeters: Number.NaN,
    forwardErrorMeters: Number.NaN,
    kneeFlexDegrees: Number.NaN,
    kneeForward: false,
  };
}

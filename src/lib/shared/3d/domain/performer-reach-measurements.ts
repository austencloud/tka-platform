/**
 * Body-derived reach measurements and the prop sizes a given body can hold.
 *
 * Every number here originates in the loaded rig's own skinned skeleton — the
 * arm chains the skeleton builder maps out of the GLB and the live shoulder
 * span the animator already reports each frame. Nothing is keyed off a
 * character id, so a newly authored rig is measured rather than tabulated.
 *
 * The consumers are the same-side stance planner (how far the two hands may
 * converge in a hug) and the prop-length seam (`staffLengthCm`, rendered
 * through `PerformerRig`'s `propLength`). Both read this one owner so a body
 * and the prop it holds can never disagree.
 */

/** One rig's measured upper-body geometry, in world meters. */
export interface PerformerReachMeasurements {
  /** Shoulder joint to elbow. */
  upperArmM: number;
  /** Elbow to the hand bone that carries the grip. */
  forearmM: number;
  /** Live distance between the two shoulder joints. */
  shoulderWidthM: number;
  /** Shoulder to grip at full extension. */
  reachM: number;
}

/** Raw per-side lengths as the skeleton reports them. */
export interface PerformerReachSample {
  leftUpperArmM: number;
  leftForearmM: number;
  rightUpperArmM: number;
  rightForearmM: number;
  shoulderWidthM: number;
}

/**
 * The converged same-side hold: both arms out in front of the turned chest
 * with the hands drawn in toward the chest-forward midline.
 */
export interface HugReachGeometry {
  /** Distance between the two grips across the chest-forward midline. */
  separationM: number;
  /** Each grip's own offset from that midline. Half the separation. */
  laneM: number;
  /** How far in front of the chest the grips sit at full extension. */
  forwardM: number;
  /** Half the shoulder span: the outer bound the grips stay inside. */
  shoulderHalfSpanM: number;
}

export type StaffFitResult =
  | {
      fits: true;
      /** Longest staff that still clears the torso inside the hug. */
      maxStaffLengthCm: number;
      /** What to actually render: the max, capped to the supported band. */
      recommendedStaffLengthCm: number;
      geometry: HugReachGeometry;
    }
  | {
      fits: false;
      reason: "reach-too-short";
      /** Longest staff the body could hold; below the supported minimum. */
      maxStaffLengthCm: number;
      geometry: HugReachGeometry;
    };

export interface HugFitOptions {
  /**
   * How much of the shoulder span each grip keeps from the chest-forward
   * midline. This is the elbow-retention budget: with the hand at full
   * extension the elbow follows roughly half of whatever the hand gives up,
   * so a 4 cm inboard move per hand costs about 2 cm of elbow travel. 0.265
   * is the tightest hug that holds elbow drift inside 2 cm on the verified
   * rigs. Lower it for a closer hug and the elbows start to collapse inward.
   */
  hugLaneRatio?: number;
  /** Floor on that lane so the two grips never occupy the same point. */
  minHugLaneM?: number;
  /**
   * Torso front-to-back depth as a fraction of shoulder width. The skeleton
   * exposes no rib-cage girth, so this is the one anthropometric ratio in the
   * fit; at a side-on hold it is the torso's extent along the audience axis,
   * which is what a converged staff has to clear.
   */
  torsoDepthToShoulderRatio?: number;
  /** Gap kept between the staff end and the torso surface. */
  clearanceM?: number;
  /** Shortest staff the product supports (24 in). */
  minStaffLengthCm?: number;
  /** Longest staff the product supports (60 in). */
  maxSupportedStaffLengthCm?: number;
}

const DEFAULTS: Required<HugFitOptions> = {
  hugLaneRatio: 0.265,
  minHugLaneM: 0.05,
  torsoDepthToShoulderRatio: 0.55,
  clearanceM: 0.06,
  minStaffLengthCm: 60.96,
  maxSupportedStaffLengthCm: 152.4,
};

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/**
 * Average the two arms into one symmetric measurement set. Returns null when
 * the rig has not finished loading, or reports a degenerate chain, so callers
 * fall back to the un-measured stance rather than posing against garbage.
 */
export function measurePerformerReach(
  sample: PerformerReachSample
): PerformerReachMeasurements | null {
  const lengths = [
    sample.leftUpperArmM,
    sample.leftForearmM,
    sample.rightUpperArmM,
    sample.rightForearmM,
    sample.shoulderWidthM,
  ];
  if (!lengths.every(isFinitePositive)) return null;

  const upperArmM = (sample.leftUpperArmM + sample.rightUpperArmM) / 2;
  const forearmM = (sample.leftForearmM + sample.rightForearmM) / 2;
  return {
    upperArmM,
    forearmM,
    shoulderWidthM: sample.shoulderWidthM,
    reachM: upperArmM + forearmM,
  };
}

/** Where the two grips sit once the hands converge into the hug. */
export function planHugReachGeometry(
  measurements: PerformerReachMeasurements,
  options: HugFitOptions = {}
): HugReachGeometry {
  const { hugLaneRatio, minHugLaneM } = { ...DEFAULTS, ...options };
  const shoulderHalfSpanM = measurements.shoulderWidthM / 2;
  const laneM = Math.max(
    minHugLaneM,
    Math.min(shoulderHalfSpanM, hugLaneRatio * measurements.shoulderWidthM)
  );
  // Shoulder and grip both sit on the chest-lateral axis; the arm spans the
  // hypotenuse. Drawing the hand inboard buys forward extension, which is why
  // the elbow barely moves when the hands converge.
  const inboardM = shoulderHalfSpanM - laneM;
  const forwardM = Math.sqrt(
    Math.max(0, measurements.reachM * measurements.reachM - inboardM * inboardM)
  );
  return {
    separationM: laneM * 2,
    laneM,
    forwardM,
    shoulderHalfSpanM,
  };
}

/**
 * The longest staff this body can hold inside its own hug.
 *
 * At a side-on hold the shaft sweeps the wall plane at the grip's own depth
 * lane. Converging the hands walks that lane into the torso's depth band, so
 * the shaft no longer passes beside the chest — it has to stay short of it.
 * The bound is therefore how far the grip is in front of the torso surface.
 */
export function fitStaffLengthForHug(
  measurements: PerformerReachMeasurements,
  options: HugFitOptions = {}
): StaffFitResult {
  const opts = { ...DEFAULTS, ...options };
  const geometry = planHugReachGeometry(measurements, options);
  const torsoHalfDepthM =
    (opts.torsoDepthToShoulderRatio * measurements.shoulderWidthM) / 2;
  const maxHalfLengthM = geometry.forwardM - torsoHalfDepthM - opts.clearanceM;
  const maxStaffLengthCm = Math.max(0, maxHalfLengthM * 200);

  if (maxStaffLengthCm < opts.minStaffLengthCm) {
    return {
      fits: false,
      reason: "reach-too-short",
      maxStaffLengthCm,
      geometry,
    };
  }
  return {
    fits: true,
    maxStaffLengthCm,
    recommendedStaffLengthCm: Math.min(
      maxStaffLengthCm,
      opts.maxSupportedStaffLengthCm
    ),
    geometry,
  };
}

/**
 * Knee anatomy
 *
 * The rest of the gait report grades the *pattern* a character walks in:
 * cadence, step length, duty factor, slip. All of it can read perfectly while
 * the knees fold sideways, because none of it looks inside a leg.
 *
 * This does. It answers one question per frame: is this knee bending like a
 * knee? A knee is a hinge. It flexes about the body's mediolateral axis and
 * moves 8-12 degrees in the frontal plane across a whole healthy gait cycle;
 * sustained deviation past that is what clinical gait analysis calls dynamic
 * valgus, and it is the thing an eye reads instantly as wrong without being
 * able to name a number.
 *
 * It exists because a real defect got all the way to a screenshot. A rig whose
 * IK hinge axis was calibrated 84 degrees off sagittal bent its knee almost
 * purely sideways, and every existing row in the report stayed green through
 * it. The pattern was fine. The leg was not.
 *
 * ## Conditioning is the whole difficulty
 *
 * The obvious metric is the clinical one, frontal plane projection angle:
 * project hip, knee and ankle onto the frontal plane and read the angle. It is
 * measured on a frontal-facing task for a reason. Project a deeply flexed leg
 * during a sagittal-dominant run and thigh and shank land nearly collinear, so
 * a millimetre of mediolateral noise swings the angle across tens of degrees.
 * An early version of this measurement reported a 179 degree knee on a healthy
 * rig, which was a projection artifact rather than a defect.
 *
 * Both angular measurements here are therefore gated on the knee being bent
 * enough for its bend to have a direction at all, and the report says what
 * share of the data survived that gate, so a reader can tell a clean leg from
 * one nobody measured.
 */

import type { FootFrame, GaitFrame, Vec3 } from "./gait-frame";

/** Below this much flexion a leg has no measurable bend direction. */
const FLEXION_GATE_DEG = 20;

export interface KneeAnatomySide {
  /**
   * Angle between the plane this knee bends in and the plane a hinge should
   * bend in, degrees, folded to 0..90. Zero is a pure sagittal bend.
   *
   * This is the direct measurement of the defect above: it does not care how
   * far the knee travelled, only whether the direction it travelled in was a
   * knee's direction.
   */
  meanPlaneTilt: number;
  p95PlaneTilt: number;
  maxPlaneTilt: number;
  /**
   * How far the knee sits off the hip-to-ankle line toward the midline, as a
   * fraction of leg length. Positive is knock-kneed, negative is bow-legged.
   * The conditioning-safe stand-in for the clinical projection angle.
   */
  meanMedialOffset: number;
  peakMedialOffset: number;
  /** Deepest flexion reached, degrees, where 0 is a straight leg. */
  peakFlexion: number;
  /**
   * Share of conditioned frames where the knee was bending the wrong way,
   * 0..1, the shank swinging in front of the thigh instead of behind it.
   *
   * The interior angle cannot express this: it is an `acos`, so it is bounded
   * to 180 and a knee driven through its own joint reads exactly like the same
   * bend the correct way round. The direction lives in the sign of the same
   * cross product `meanPlaneTilt` folds away, so it costs nothing to keep.
   */
  reversedFraction: number;
  /** Deepest backward bend, degrees, or 0 when the knee never reversed. */
  peakReversedFlexion: number;
  /**
   * Femur and tibia length spread as a fraction of their mean.
   *
   * A tripwire rather than a score. Bones are rigid and the IK solver only
   * rotates them, so this reads zero on a healthy pipeline by construction --
   * which is the point. It fires when something translates a joint, stretches
   * a chain toward a target it cannot reach, or hands the sampler the wrong
   * bones, and those are silent failures with no other signature here.
   */
  femurDrift: number;
  tibiaDrift: number;
  /** Share of frames where the knee was bent past the gate, 0..1. */
  conditionedFraction: number;
}

export interface KneeAnatomy {
  left: KneeAnatomySide;
  right: KneeAnatomySide;
  /** The worse side, which is what a verdict grades. */
  worstMeanPlaneTilt: number;
  worstP95PlaneTilt: number;
  worstPeakMedialOffset: number;
  worstReversedFraction: number;
  worstSegmentDrift: number;
  /** Lowest conditioned share of the two legs. */
  minConditionedFraction: number;
}

const sub = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a: Vec3) => Math.sqrt(dot(a, a));
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const scale = (a: Vec3, k: number): Vec3 => ({
  x: a.x * k,
  y: a.y * k,
  z: a.z * k,
});

function normalize(a: Vec3): Vec3 | null {
  const l = len(a);
  return l < 1e-9 ? null : scale(a, 1 / l);
}

/**
 * The character's own right, recovered from the same hip line the sampler took
 * facing from. Recovering it keeps one definition of which way the body points
 * rather than storing a second copy: the sampler writes `atan2(rz, -rx)`, so
 * inverting that gives back `(-cos, 0, sin)`.
 */
function rightAxis(facing: number): Vec3 {
  return { x: -Math.cos(facing), y: 0, z: Math.sin(facing) };
}

/** Where the character is pointed, which is `up` crossed with {@link rightAxis}. */
function forwardAxis(facing: number): Vec3 {
  return { x: Math.sin(facing), y: 0, z: Math.cos(facing) };
}

function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)));
  return sorted[i]!;
}

const mean = (xs: number[]) =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

/** Spread as a fraction of the mean; 0 for an empty or zero-length series. */
function drift(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  if (m < 1e-9) return 0;
  return (Math.max(...xs) - Math.min(...xs)) / m;
}

function analyzeSide(
  frames: readonly GaitFrame[],
  pick: (f: GaitFrame) => FootFrame,
  side: "left" | "right"
): KneeAnatomySide {
  const tilts: number[] = [];
  const offsets: number[] = [];
  const femurs: number[] = [];
  const tibias: number[] = [];
  let peakFlexion = 0;
  let peakReversed = 0;
  let reversed = 0;

  for (const frame of frames) {
    const leg = pick(frame);
    const femur = sub(leg.knee, leg.hip);
    const tibia = sub(leg.ankle, leg.knee);
    const femurLen = len(femur);
    const tibiaLen = len(tibia);
    if (femurLen < 1e-6 || tibiaLen < 1e-6) continue;
    femurs.push(femurLen);
    tibias.push(tibiaLen);

    const flexion = 180 - leg.kneeAngle;
    if (flexion > peakFlexion) peakFlexion = flexion;
    if (flexion < FLEXION_GATE_DEG) continue;

    const right = rightAxis(frame.facing);
    // Medial points at the midline, which is the opposite way for each leg.
    const medial = side === "left" ? right : scale(right, -1);

    const bendNormal = normalize(cross(femur, tibia));
    if (bendNormal) {
      // Folded to 0..90: a hinge bending the correct way but whose normal
      // points the other way along the same axis is still a correct hinge.
      const alignment = Math.min(1, Math.abs(dot(bendNormal, right)));
      tilts.push((Math.acos(alignment) * 180) / Math.PI);

      // Which way it bends is a separate question from which plane it bends
      // in, and folding the plane away discards it. Ask the ankle directly:
      // against where a straight leg would have put it, a flexing knee sends
      // the ankle backwards. Forwards is the knee going through itself.
      //
      // Deliberately not the sign of the cross product above. That sign
      // depends on the handedness of the rig's authored axes, so it would be a
      // silent assumption; this is the anatomy itself.
      const femurDir = scale(femur, 1 / femurLen);
      const straightAnkle = {
        x: leg.knee.x + femurDir.x * tibiaLen,
        y: leg.knee.y + femurDir.y * tibiaLen,
        z: leg.knee.z + femurDir.z * tibiaLen,
      };
      if (dot(sub(leg.ankle, straightAnkle), forwardAxis(frame.facing)) > 0) {
        reversed += 1;
        if (flexion > peakReversed) peakReversed = flexion;
      }
    }

    // Knee displacement from the hip-to-ankle line, projected onto medial.
    const spanDir = normalize(sub(leg.ankle, leg.hip));
    if (spanDir) {
      const toKnee = sub(leg.knee, leg.hip);
      const perp = sub(toKnee, scale(spanDir, dot(toKnee, spanDir)));
      offsets.push(dot(perp, medial) / (femurLen + tibiaLen));
    }
  }

  const sortedTilts = [...tilts].sort((a, b) => a - b);
  return {
    meanPlaneTilt: mean(tilts),
    p95PlaneTilt: percentile(sortedTilts, 0.95),
    maxPlaneTilt: sortedTilts.length ? sortedTilts[sortedTilts.length - 1]! : 0,
    meanMedialOffset: mean(offsets),
    peakMedialOffset: offsets.length ? Math.max(...offsets) : 0,
    peakFlexion,
    reversedFraction: tilts.length === 0 ? 0 : reversed / tilts.length,
    peakReversedFlexion: peakReversed,
    femurDrift: drift(femurs),
    tibiaDrift: drift(tibias),
    conditionedFraction:
      frames.length === 0 ? 0 : tilts.length / frames.length,
  };
}

const EMPTY_SIDE: KneeAnatomySide = {
  meanPlaneTilt: 0,
  p95PlaneTilt: 0,
  maxPlaneTilt: 0,
  meanMedialOffset: 0,
  peakMedialOffset: 0,
  peakFlexion: 0,
  reversedFraction: 0,
  peakReversedFlexion: 0,
  femurDrift: 0,
  tibiaDrift: 0,
  conditionedFraction: 0,
};

export const EMPTY_KNEE_ANATOMY: KneeAnatomy = {
  left: EMPTY_SIDE,
  right: EMPTY_SIDE,
  worstMeanPlaneTilt: 0,
  worstP95PlaneTilt: 0,
  worstPeakMedialOffset: 0,
  worstReversedFraction: 0,
  worstSegmentDrift: 0,
  minConditionedFraction: 0,
};

export function analyzeKneeAnatomy(frames: readonly GaitFrame[]): KneeAnatomy {
  if (frames.length === 0) return EMPTY_KNEE_ANATOMY;
  const left = analyzeSide(frames, (f) => f.left, "left");
  const right = analyzeSide(frames, (f) => f.right, "right");
  return {
    left,
    right,
    worstMeanPlaneTilt: Math.max(left.meanPlaneTilt, right.meanPlaneTilt),
    worstP95PlaneTilt: Math.max(left.p95PlaneTilt, right.p95PlaneTilt),
    worstPeakMedialOffset: Math.max(
      Math.abs(left.peakMedialOffset),
      Math.abs(right.peakMedialOffset)
    ),
    worstReversedFraction: Math.max(
      left.reversedFraction,
      right.reversedFraction
    ),
    worstSegmentDrift: Math.max(
      left.femurDrift,
      left.tibiaDrift,
      right.femurDrift,
      right.tibiaDrift
    ),
    minConditionedFraction: Math.min(
      left.conditionedFraction,
      right.conditionedFraction
    ),
  };
}

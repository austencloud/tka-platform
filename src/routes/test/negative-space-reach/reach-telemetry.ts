/**
 * What one rendered frame of the right arm measures.
 *
 * `docs/reference/negative-space-and-wall-plane-reach.md` describes a reach in
 * body language — palm facing, thumb end upstage or downstage of the forearm,
 * the pocket above the shoulder, the inner elbow toward the sky, full
 * extension. This module turns each of those phrases into a number the rig can
 * be held to, from the diagnostics the production performer already publishes.
 *
 * **Telemetry only.** Nothing here writes pose, grip, or the solve. Every
 * value is read off a frame that has already happened.
 *
 * Two things are worth knowing before trusting a readout:
 *
 * 1. **The frame of reference is derived from the animator's own shoulder
 *    yaw**, using the convention `staff-grip/lab-metrics.ts` already runs on:
 *    at yaw 0 the performer's anatomical right is world −X, so the performer
 *    faces +Z, which is downstage. (`plane-transforms.ts` has a header comment
 *    calling +X the performer's right; that comment describes the grid as the
 *    AUDIENCE reads it, and the two are consistent once you notice the
 *    performer is facing you.) Only the depth axis matters for the document's
 *    central predicate, and both sources agree that +Z is toward the audience.
 *
 * 2. **The thumb end is identified from the rig, not from the notation.**
 *    `rightGripAxis` is the achieved index-to-pinky knuckle axis, so the staff
 *    end sitting on its negative side is the one leaving the hand past the
 *    thumb. That makes `thumbEndIsRadiallyIn` an independent check on whether
 *    the rig's grip roll actually agrees with a notated `in`.
 */

import type {
  AvatarGripDiagnostics,
  AvatarPoseDiagnostics,
} from "@austencloud/scene-3d";

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Which way a direction mostly points, in the performer's own frame. */
export type FacingAxis =
  | "sky"
  | "floor"
  | "downstage"
  | "upstage"
  | "performer-right"
  | "performer-left";

export const FACING_LABEL: Readonly<Record<FacingAxis, string>> = {
  sky: "Up, toward the sky",
  floor: "Down, toward the floor",
  downstage: "Downstage, toward the audience",
  upstage: "Upstage, away from the audience",
  "performer-right": "Out, to the performer's right",
  "performer-left": "Across, to the performer's left",
};

/** The compact form, for a chip or a secondary line. */
export const FACING_SHORT: Readonly<Record<FacingAxis, string>> = {
  sky: "Up",
  floor: "Down",
  downstage: "Downstage",
  upstage: "Upstage",
  "performer-right": "Right",
  "performer-left": "Left",
};

export interface Facing {
  /** The dominant axis. */
  readonly axis: FacingAxis;
  /** How strongly it commits, 0 to 1. Below ~0.7 the tilt is worth naming. */
  readonly strength: number;
  /** The next strongest axis, when the direction is meaningfully tilted. */
  readonly tilt: FacingAxis | null;
  readonly tiltStrength: number;
}

/** Where a value came from, so a readout can say when it is an approximation. */
export type ShoulderSource = "bone" | "derived";

export interface ReachFrame {
  /** True once a frame with usable right-arm diagnostics has arrived. */
  readonly hasData: boolean;

  /** THE headline. Which way the right palm faces, right now. */
  readonly palmFacing: Facing | null;

  /**
   * The document's central binary: is the thumb end upstage or downstage of
   * the forearm? Signed millimetres of the thumb end's perpendicular offset
   * from the forearm axis, read along stage depth. Negative is upstage —
   * "behind my forearm", the negative-space side.
   */
  readonly thumbEndVsForearmMm: number | null;

  /**
   * The same perpendicular offset, read along world up instead of along stage
   * depth: is the thumb end above the forearm line or below it, as an audience
   * sees it in the wall plane? The document does not ask this, but on a
   * plane-locked prop it is the component that carries the difference between
   * the two notations, so leaving it out would hide the real signal.
   */
  readonly thumbEndAboveForearmMm: number | null;

  /**
   * How far the upper body twisted away from square, in degrees. §1 is about
   * what a shoulder will and will not give, so how hard the rig is twisting to
   * make a reach is evidence, not trivia. Positive turns the chest toward the
   * performer's left.
   */
  readonly shoulderTwistDeg: number | null;

  /** Whether the thumb end is above the shoulder, and by how much. */
  readonly thumbEndAboveShoulderMm: number | null;

  /**
   * Both pocket conditions at once: above the shoulder AND upstage of the
   * forearm. §4 defines the pocket by the two together.
   */
  readonly inPocket: boolean;

  /**
   * Depth of the thumb end past the shoulder's own frontal plane. §4's rule is
   * that the thumb end "can't pass on the downstage side of the body";
   * positive here is downstage of the shoulder.
   */
  readonly thumbEndPastShoulderMm: number | null;

  /**
   * §4's endpoint check: the staff's "pinky end is in front of the elbow".
   * Positive is downstage of the elbow.
   */
  readonly pinkyEndPastElbowMm: number | null;

  /**
   * Palm roll about the forearm axis. 0° is palm toward the sky, ±180° is palm
   * toward the floor, and the sign says which way the wrist rolled: positive
   * carries the palm normal downstage.
   */
  readonly palmRollDeg: number | null;

  /** Which way the inner elbow — the crook — faces. Null when the arm is straight. */
  readonly innerElbowFacing: Facing | null;

  /** How far the elbow stands off the shoulder-to-wrist chord, in millimetres. */
  readonly elbowOffsetMm: number | null;

  /** Wrist distance from the shoulder as a fraction of the arm's full length. */
  readonly armExtension: number | null;

  /**
   * Whether the rig's grip roll actually puts the thumb end nearer the grid
   * centre than the pinky end — the geometric reading of a notated `in`.
   */
  readonly thumbEndIsRadiallyIn: boolean | null;

  /** Where the shoulder point came from. */
  readonly shoulderSource: ShoulderSource;

  /** Raw world points, for the overlay and for a report. */
  readonly shoulder: Vec3 | null;
  readonly elbow: Vec3 | null;
  readonly wrist: Vec3 | null;
  readonly palm: Vec3 | null;
  readonly thumbEnd: Vec3 | null;
  readonly pinkyEnd: Vec3 | null;
}

export const EMPTY_REACH_FRAME: ReachFrame = {
  hasData: false,
  palmFacing: null,
  thumbEndVsForearmMm: null,
  thumbEndAboveForearmMm: null,
  shoulderTwistDeg: null,
  thumbEndAboveShoulderMm: null,
  inPocket: false,
  thumbEndPastShoulderMm: null,
  pinkyEndPastElbowMm: null,
  palmRollDeg: null,
  innerElbowFacing: null,
  elbowOffsetMm: null,
  armExtension: null,
  thumbEndIsRadiallyIn: null,
  shoulderSource: "derived",
  shoulder: null,
  elbow: null,
  wrist: null,
  palm: null,
  thumbEnd: null,
  pinkyEnd: null,
};

// ---------------------------------------------------------------------------
// Vector helpers. Plain objects; nothing here retains a scratch value the
// animator owns.
// ---------------------------------------------------------------------------

const EPSILON = 1e-6;

function v(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

function copy(point: Vec3 | null | undefined): Vec3 | null {
  return point ? v(point.x, point.y, point.z) : null;
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return v(a.x - b.x, a.y - b.y, a.z - b.z);
}

function add(a: Vec3, b: Vec3): Vec3 {
  return v(a.x + b.x, a.y + b.y, a.z + b.z);
}

function scale(a: Vec3, k: number): Vec3 {
  return v(a.x * k, a.y * k, a.z * k);
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return v(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x
  );
}

function length(a: Vec3): number {
  return Math.hypot(a.x, a.y, a.z);
}

function normalize(a: Vec3): Vec3 | null {
  const l = length(a);
  return l < EPSILON ? null : scale(a, 1 / l);
}

/** The component of `a` perpendicular to unit vector `axis`. */
function reject(a: Vec3, axis: Vec3): Vec3 {
  return sub(a, scale(axis, dot(a, axis)));
}

// ---------------------------------------------------------------------------
// Frame of reference
// ---------------------------------------------------------------------------

export interface PerformerBasis {
  /** Downstage: the direction the performer faces, toward the audience. */
  readonly forward: Vec3;
  /** The performer's own right. */
  readonly right: Vec3;
  /** World up. */
  readonly up: Vec3;
}

/**
 * The stage frame: downstage toward the audience, up toward the sky.
 *
 * Yaw rotates about +Y, so it carries the resting forward (0, 0, 1) and the
 * resting right (−1, 0, 0) with it. The resting values are the animator's own
 * convention, restated from `staff-grip/lab-metrics.ts` rather than re-derived.
 *
 * This takes the yaw the performer is STANDING at, not the shoulder yaw the
 * animator achieved. The distinction matters and was got wrong once here: the
 * upper body twists to reach across the plane — about 46 degrees at the middle
 * of this reach — and feeding that twist in rotates the words "upstage" and
 * "downstage" along with the chest. The source document uses them as stage
 * directions ("more upstage than my forearm", "fingers point toward the
 * audience"), which do not move when a performer turns their shoulders. The
 * twist is reported separately, as its own measurement.
 */
export function performerBasis(standingYawRad: number): PerformerBasis {
  const sin = Math.sin(standingYawRad);
  const cos = Math.cos(standingYawRad);
  return {
    forward: v(sin, 0, cos),
    right: v(-cos, 0, sin),
    up: v(0, 1, 0),
  };
}

/** Name a unit direction by the axis it mostly points along. */
export function describeFacing(
  direction: Vec3,
  basis: PerformerBasis
): Facing | null {
  const unit = normalize(direction);
  if (!unit) return null;

  const candidates: ReadonlyArray<readonly [FacingAxis, number]> = [
    ["sky", dot(unit, basis.up)],
    ["floor", -dot(unit, basis.up)],
    ["downstage", dot(unit, basis.forward)],
    ["upstage", -dot(unit, basis.forward)],
    ["performer-right", dot(unit, basis.right)],
    ["performer-left", -dot(unit, basis.right)],
  ];

  const ranked = [...candidates].sort((a, b) => b[1] - a[1]);
  const [axis, strength] = ranked[0]!;
  const [tiltAxis, tiltStrength] = ranked[1]!;

  return {
    axis,
    strength,
    // A second axis worth naming only when it actually carries the direction
    // somewhere. Below this the readout would be reporting rounding.
    tilt: tiltStrength > 0.25 ? tiltAxis : null,
    tiltStrength,
  };
}

/** One sentence for a facing, tilt included when it is real. */
export function facingSentence(facing: Facing | null): string {
  if (!facing) return "—";
  const primary = FACING_LABEL[facing.axis];
  if (!facing.tilt) return primary;
  return `${primary}, tilted ${FACING_SHORT[facing.tilt].toLowerCase()}`;
}

// ---------------------------------------------------------------------------
// The measurement
// ---------------------------------------------------------------------------

export interface ReachSample {
  readonly diagnostics: AvatarPoseDiagnostics;
  readonly gripDiagnostics: AvatarGripDiagnostics;
  /**
   * The right shoulder joint in world space, when a scene probe found the
   * bone. Without it the shoulder is derived from the reported shoulder width
   * and the package's own shoulder height, which is close laterally and
   * vertically but assumes zero chest-forward offset.
   */
  readonly shoulderWorld: Vec3 | null;
  /** The package's shoulder-height plane, in world units. */
  readonly shoulderHeight: number;
  /** Centre of the wall grid, for the radial reading of a notated `in`. */
  readonly gridCenter: Vec3;
}

export function measureReachFrame(sample: ReachSample): ReachFrame {
  const { diagnostics, gripDiagnostics, shoulderWorld } = sample;

  // The performer stands square to the audience on this page (facingAngle 0)
  // and never turns — body turns are §3, which this lab does not model — so
  // the stage frame is the resting one.
  const basis = performerBasis(0);
  const shoulderTwistDeg =
    (diagnostics.achievedShoulderYawRad * 180) / Math.PI;

  const elbow = copy(diagnostics.rightElbowWorld);
  const wrist = copy(gripDiagnostics.rightWrist);
  const palm = copy(gripDiagnostics.rightPalm);
  const gripAxis = normalize(copy(gripDiagnostics.rightGripAxis) ?? v(0, 0, 0));
  const segment = gripDiagnostics.redStaffSegment;

  const shoulderSource: ShoulderSource = shoulderWorld ? "bone" : "derived";
  const shoulder =
    shoulderWorld ??
    add(
      scale(basis.right, diagnostics.shoulderWidth / 2),
      v(0, sample.shoulderHeight, 0)
    );

  if (!elbow || !wrist || !palm) {
    return { ...EMPTY_REACH_FRAME, shoulderSource, shoulder };
  }

  // --- which staff end leaves the hand past the thumb ---------------------
  let thumbEnd: Vec3 | null = null;
  let pinkyEnd: Vec3 | null = null;
  if (segment && gripAxis) {
    const a = v(segment.a.x, segment.a.y, segment.a.z);
    const b = v(segment.b.x, segment.b.y, segment.b.z);
    // `rightGripAxis` runs index-knuckle to pinky-knuckle, so the end on its
    // negative side is the one on the thumb side of the hand. Reading it this
    // way makes no assumption about which of a/b the segment builder put
    // first.
    const aAlong = dot(sub(a, palm), gripAxis);
    const bAlong = dot(sub(b, palm), gripAxis);
    thumbEnd = aAlong < bAlong ? a : b;
    pinkyEnd = aAlong < bAlong ? b : a;
  }

  // --- palm facing --------------------------------------------------------
  const handAxis = normalize(sub(palm, wrist));
  const palmNormal =
    handAxis && gripAxis ? normalize(cross(handAxis, gripAxis)) : null;
  const palmFacing = palmNormal ? describeFacing(palmNormal, basis) : null;

  // --- the negative-space predicate --------------------------------------
  //
  // §4 asks one question: does the thumb end pass upstage of the forearm, or
  // downstage of it? That is a question about stage DEPTH, so it is answered
  // on the depth axis and nothing else.
  //
  // The same perpendicular also has a component inside the wall plane, and on
  // this rig that is the component that actually moves. Both are reported.
  // Collapsing them into one signed number is what made an earlier version of
  // this page answer a question the document never asked.
  const forearm = normalize(sub(wrist, elbow));
  let thumbEndVsForearmMm: number | null = null;
  let thumbEndAboveForearmMm: number | null = null;
  if (forearm && thumbEnd) {
    const perpendicular = reject(sub(thumbEnd, elbow), forearm);
    thumbEndVsForearmMm = dot(perpendicular, basis.forward) * 1000;
    thumbEndAboveForearmMm = dot(perpendicular, basis.up) * 1000;
  }

  const thumbEndAboveShoulderMm = thumbEnd
    ? (thumbEnd.y - shoulder.y) * 1000
    : null;

  const thumbEndPastShoulderMm = thumbEnd
    ? dot(sub(thumbEnd, shoulder), basis.forward) * 1000
    : null;

  const pinkyEndPastElbowMm = pinkyEnd
    ? dot(sub(pinkyEnd, elbow), basis.forward) * 1000
    : null;

  // --- wrist roll ---------------------------------------------------------
  let palmRollDeg: number | null = null;
  if (forearm && palmNormal) {
    // Measure the palm normal's angle around the forearm, from world up. A
    // forearm pointing straight up has no usable "up" reference, so the
    // downstage direction stands in — it is never parallel to a vertical
    // forearm.
    const reference =
      normalize(reject(basis.up, forearm)) ??
      normalize(reject(basis.forward, forearm));
    const projected = normalize(reject(palmNormal, forearm));
    if (reference && projected) {
      palmRollDeg =
        (Math.atan2(
          dot(cross(reference, projected), forearm),
          dot(reference, projected)
        ) *
          180) /
        Math.PI;
    }
  }

  // --- elbow --------------------------------------------------------------
  let innerElbowFacing: Facing | null = null;
  let elbowOffsetMm: number | null = null;
  const chord = sub(wrist, shoulder);
  const chordUnit = normalize(chord);
  if (chordUnit) {
    const offset = reject(sub(elbow, shoulder), chordUnit);
    elbowOffsetMm = length(offset) * 1000;
    // Under about a centimetre the arm is straight and the crook faces
    // nowhere in particular; naming a direction there would be reporting
    // numerical noise as anatomy.
    if (elbowOffsetMm > 10) {
      innerElbowFacing = describeFacing(scale(offset, -1), basis);
    }
  }

  const maxReach =
    diagnostics.rightUpperArmLength + diagnostics.rightForearmLength;
  const armExtension = maxReach > EPSILON ? length(chord) / maxReach : null;

  // --- does the grip agree with a notated `in`? ---------------------------
  let thumbEndIsRadiallyIn: boolean | null = null;
  if (thumbEnd && pinkyEnd) {
    thumbEndIsRadiallyIn =
      length(sub(thumbEnd, sample.gridCenter)) <
      length(sub(pinkyEnd, sample.gridCenter));
  }

  return {
    hasData: true,
    palmFacing,
    thumbEndVsForearmMm,
    thumbEndAboveForearmMm,
    shoulderTwistDeg,
    thumbEndAboveShoulderMm,
    inPocket:
      thumbEndAboveShoulderMm !== null &&
      thumbEndAboveShoulderMm > POCKET_CLEARANCE_MM &&
      thumbEndVsForearmMm !== null &&
      thumbEndVsForearmMm < -ROUTE_DEADBAND_MM,
    thumbEndPastShoulderMm,
    pinkyEndPastElbowMm,
    palmRollDeg,
    innerElbowFacing,
    elbowOffsetMm,
    armExtension,
    thumbEndIsRadiallyIn,
    shoulderSource,
    shoulder,
    elbow,
    wrist,
    palm,
    thumbEnd,
    pinkyEnd,
  };
}

/**
 * Which of the document's two routes this frame looks like, from the one
 * measurement that separates them.
 *
 * Deliberately narrow. §4 forbids the thumb end from passing downstage; §5 is
 * defined by it doing exactly that. Everything else in either section —
 * the pocket, the relaxed pinch, the full extension — describes a route rather
 * than identifying one, so it stays out of this verdict and is reported on its
 * own.
 */
export type RouteVerdict = "negative-space" | "downstage" | "in-plane" | "unknown";

export const ROUTE_VERDICT_LABEL: Readonly<Record<RouteVerdict, string>> = {
  "negative-space": "Upstage of the forearm",
  downstage: "Downstage of the forearm",
  "in-plane": "In the forearm's own plane",
  unknown: "No reading",
};

/**
 * How far off the forearm axis, in stage depth, the thumb end has to be before
 * the reading means anything. A staff is about this thick, and the forearm
 * itself spans roughly 170 mm of depth in this reach, so anything smaller is
 * the thumb end sitting level with the forearm rather than passing either side
 * of it.
 */
export const ROUTE_DEADBAND_MM = 25;

/**
 * How far above the shoulder the thumb end has to climb before the pocket is
 * genuinely being used. Roughly a hand's breadth.
 *
 * A looser test — any rise at all, any depth at all — reported "in the pocket"
 * at the end of the reach, where the thumb end clears the shoulder by 34 mm and
 * sits 2 mm behind the forearm. That is the end grazing the shoulder on its way
 * past, which is the opposite of the thing §4 describes, and a predicate that
 * cannot tell the two apart is not worth reading.
 */
export const POCKET_CLEARANCE_MM = 100;


export function routeVerdict(frame: ReachFrame): RouteVerdict {
  const offset = frame.thumbEndVsForearmMm;
  if (offset === null) return "unknown";
  if (Math.abs(offset) <= ROUTE_DEADBAND_MM) return "in-plane";
  return offset < 0 ? "negative-space" : "downstage";
}

/** Round-trip a number for a `data-` attribute, or an em dash for a readout. */
export function formatReach(
  value: number | null | undefined,
  digits = 1
): string {
  return value == null || !Number.isFinite(value) ? "—" : value.toFixed(digits);
}

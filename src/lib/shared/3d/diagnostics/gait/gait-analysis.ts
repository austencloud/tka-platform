/**
 * Gait analysis
 *
 * Turns a buffer of GaitFrames into the numbers that decide whether a
 * character is walking or gliding. Pure functions over plain numbers: no
 * three, no scene graph, no renderer. Everything here can be checked in a
 * unit test against a hand-built frame buffer.
 *
 * Contact is derived geometrically rather than read from the animator. The
 * animator's contact curves are one of the things being measured, so trusting
 * them would make the instrument agree with whatever the code believes and
 * report a clean gait over a broken one.
 */

import type { GaitFrame, Stance, Support, Vec3 } from "./gait-frame";

export interface GaitThresholds {
  /**
   * How far above the lowest point of the session an ankle may sit and still
   * count as bearing weight, in metres. Roughly the ankle travel across a
   * flat-footed stance on a human-scaled rig.
   */
  contactBand: number;
  /** Root speed below which the character counts as stopped, m/s. */
  stoppedSpeed: number;
  /** Ankle speed above which a foot counts as swinging, m/s. */
  movingFootSpeed: number;
  /** A stance run shorter than this is sampling noise, seconds. */
  minStanceDuration: number;
  /** Knee jerk above this is a visible pop, degrees/second squared. */
  twitchJerk: number;
  /**
   * Body-local acceleration above which a joint counts as having jumped
   * rather than moved, metres/second squared.
   *
   * Calibrated in the walk lab rather than guessed. With the planter off,
   * and with it on at the clip's authored speed, the worst honest frame
   * across every pattern measured 180 - a toe whipping through mid-swing at
   * 1.8 m/s. The faulted cases start at 608 and reach 6655. At sixty frames
   * a second this threshold is a joint appearing eight centimetres away in
   * one of them, and it sits in the gap between those two populations.
   */
  joltAccel: number;
  /** Lateral pelvis offset that counts as "over the foot", metres. */
  overFootLateral: number;
}

export const DEFAULT_THRESHOLDS: GaitThresholds = {
  contactBand: 0.045,
  stoppedSpeed: 0.05,
  movingFootSpeed: 0.25,
  minStanceDuration: 0.08,
  twitchJerk: 4000,
  joltAccel: 300,
  overFootLateral: 0.06,
};

/** A knee doing something the eye reads as a twitch. */
export interface Twitch {
  t: number;
  foot: "left" | "right";
  /** Change in knee angular velocity over one frame, degrees/second squared. */
  jerk: number;
  kneeAngle: number;
}

/** Which joint a jolt happened to. */
export type JoltJoint =
  | "pelvis"
  | "left knee"
  | "left ankle"
  | "left toe"
  | "right knee"
  | "right ankle"
  | "right toe";

/**
 * A joint arriving somewhere instead of travelling there.
 *
 * Measured in the character's own frame, so a body moving fast is not a body
 * jumping: the pelvis is taken against the position the movement system asked
 * for, and every leg joint against the pelvis. What is left is the pose
 * changing, which is the only thing a clip, a blend, or an IK solver can do
 * abruptly.
 */
export interface Jolt {
  t: number;
  joint: JoltJoint;
  /** Body-local acceleration, metres/second squared. */
  accel: number;
  /** How far it moved in that one frame, body-local, metres. */
  step: number;
}

export interface GaitReport {
  frameCount: number;
  duration: number;
  /** Ground plane the analysis settled on, world Y. */
  groundY: number;

  stances: Stance[];
  /** Steps per minute, counting each foot's touchdown. */
  cadence: number;
  /** Distance between consecutive touchdowns of alternating feet, metres. */
  stepLengths: number[];
  meanStepLength: number;
  /**
   * Spread of step length. A planner with intent produces variety on purpose;
   * a single clip played faster produces one length forever.
   */
  stepLengthSpread: number;
  /**
   * Stance time over stride time. Human walking sits near 0.6; below 0.5 there
   * is a flight phase and the character is running, whatever clip is playing.
   */
  dutyFactor: number;
  /**
   * Fraction of time both feet bear weight. Human walking is near 0.2; zero
   * means the weight never transfers through two feet.
   */
  doubleSupportFraction: number;

  /** Ground a planted foot covered while planted, metres, worst step. */
  peakSlip: number;
  meanSlip: number;
  /** Slip as a share of the step it belongs to. Over ~0.15 reads as skating. */
  slipRatio: number;

  /** Worst heel rise above foot-flat during a stance, metres. */
  peakHeelLift: number;
  /**
   * Along-travel offset of that ankle behind the pelvis, metres. Large and
   * positive is the heel kicking up behind the character.
   */
  heelLiftBehindHips: number;
  /** A rig without a ToeBase cannot answer the heel question at all. */
  hasToes: boolean;

  twitches: Twitch[];
  twitchesPerSecond: number;
  /** RMS knee jerk, degrees/second squared, both legs. */
  kneeJerkRms: number;

  jolts: Jolt[];
  joltsPerSecond: number;
  /** Worst body-local joint acceleration in the buffer, m/s squared. */
  peakJolt: number;
  /** Which joint that was, or null when nothing was measured. */
  peakJoltJoint: JoltJoint | null;
  /** How far the worst one moved in a single frame, metres. */
  peakJoltStep: number;

  /** Seconds the feet kept cycling while the root was not going anywhere. */
  inPlaceCyclingSeconds: number;
  inPlaceCyclingFraction: number;

  /**
   * Peak-to-peak lateral sway of the pelvis off its own travel line, metres.
   * Real walking runs 0.06-0.10; near zero is a body that never commits its
   * weight to either leg.
   */
  weightShiftAmplitude: number;
  /** Share of single-support frames with the pelvis actually over the foot. */
  overSupportFraction: number;
  /**
   * Whether the pelvis moves toward whichever foot is carrying it, as weight
   * transfer must, rather than leaning one fixed way or riding the centreline.
   */
  weightShiftAlternates: boolean;
}

const EPS = 1e-6;

export interface TravelSpan {
  from: number;
  to: number;
  peak: number;
}

function dist2(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/**
 * Contiguous parts of a recording where the character actually travelled.
 *
 * A diagnostic buffer often starts while a rig loads and ends in an idle
 * pose. Keeping that standing time in cadence and support timing turns a good
 * walk into a two-steps-per-minute shuffle if the lab is left open. Segmenting
 * by the root's measured speed keeps the instrument scoped to the maneuver it
 * claims to describe.
 */
export function travelSpans(
  frames: readonly GaitFrame[],
  minSpeed = 0.15,
  minDuration = 0.5
): TravelSpan[] {
  const spans: TravelSpan[] = [];
  let open: TravelSpan | null = null;

  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1]!;
    const b = frames[i]!;
    const speed = dist2(b.root, a.root) / Math.max(b.dt, EPS);
    if (speed >= minSpeed) {
      if (open) {
        open.to = b.t;
        open.peak = Math.max(open.peak, speed);
      } else {
        open = { from: b.t, to: b.t, peak: speed };
      }
    } else if (open) {
      spans.push(open);
      open = null;
    }
  }
  if (open) spans.push(open);

  return spans.filter((span) => span.to - span.from > minDuration);
}

/** Frames from the latest completed or in-progress travel segment. */
export function latestTravelFrames(
  frames: readonly GaitFrame[],
  trimStartSeconds = 0.2,
  trimEndSeconds = 0.1
): readonly GaitFrame[] {
  const span = travelSpans(frames).at(-1);
  if (!span) return [];
  const from = span.from + trimStartSeconds;
  const to = span.to - trimEndSeconds;
  return frames.filter((frame) => frame.t >= from && frame.t <= to);
}

/**
 * The stop handoff around the end of the latest travel segment.
 *
 * This deliberately overlaps the last tenth of a second of travel: a joint
 * discontinuity lives on the boundary, and slicing at the first zero-speed
 * frame would remove one side of the second difference that detects it.
 */
export function latestArrivalFrames(
  frames: readonly GaitFrame[],
  beforeSeconds = 0.1,
  afterSeconds = 0.75
): readonly GaitFrame[] {
  const span = travelSpans(frames).at(-1);
  if (!span) return [];
  return frames.filter(
    (frame) =>
      frame.t >= span.to - beforeSeconds && frame.t <= span.to + afterSeconds
  );
}

function kneeAngleOf(frame: GaitFrame, foot: "left" | "right"): number {
  return frame[foot].kneeAngle;
}

function mean(xs: readonly number[]): number {
  return xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/**
 * The floor, taken as the lowest an ankle ever got.
 *
 * Reading it from the data rather than being told keeps the probe honest on a
 * stage that sits at a nonzero Y, and on a rig whose sole offset is not the
 * one the config claims it is.
 */
export function resolveGroundY(frames: readonly GaitFrame[]): number {
  let lowest = Infinity;
  for (const frame of frames) {
    lowest = Math.min(lowest, frame.left.ankle.y, frame.right.ankle.y);
  }
  return Number.isFinite(lowest) ? lowest : 0;
}

/**
 * The floor under the character, estimated per frame from a local window.
 *
 * A single session-wide floor does not survive contact with a real rig: the
 * stage avatars' standing pose parks both ankles about 11cm higher than their
 * walking pose does, so measuring against the lowest ankle of the whole
 * session throws every standing frame into flight and the walk reports two
 * footfalls in thirty seconds. Taking the lowest ankle within about a stride
 * either side adapts to that, and to sloped or stepped floors, without
 * anyone having to tell the instrument where the ground is.
 */
export function localGroundSeries(
  frames: readonly GaitFrame[],
  windowSeconds = 0.75
): number[] {
  const ground = new Array<number>(frames.length);
  if (frames.length === 0) return ground;

  let lo = 0;
  let hi = 0;
  for (let i = 0; i < frames.length; i++) {
    const t = frames[i]!.t;
    while (lo < frames.length && frames[lo]!.t < t - windowSeconds) lo += 1;
    while (hi < frames.length && frames[hi]!.t <= t + windowSeconds) hi += 1;
    let lowest = Infinity;
    for (let j = lo; j < hi; j++) {
      const f = frames[j]!;
      lowest = Math.min(lowest, f.left.ankle.y, f.right.ankle.y);
    }
    ground[i] = Number.isFinite(lowest)
      ? lowest
      : Math.min(frames[i]!.left.ankle.y, frames[i]!.right.ankle.y);
  }
  return ground;
}

/** Which feet are carrying the body this frame, by geometry alone. */
export function supportOf(
  frame: GaitFrame,
  groundY: number,
  band: number
): Support {
  const left = frame.left.ankle.y - groundY <= band;
  const right = frame.right.ankle.y - groundY <= band;
  if (left && right) return "both";
  if (left) return "left";
  if (right) return "right";
  return "flight";
}

function rootSpeedAt(frames: readonly GaitFrame[], i: number): number {
  if (i === 0) return 0;
  const prev = frames[i - 1]!;
  const cur = frames[i]!;
  return dist2(cur.root, prev.root) / Math.max(cur.dt, EPS);
}

function ankleSpeedAt(
  frames: readonly GaitFrame[],
  i: number,
  foot: "left" | "right"
): number {
  if (i === 0) return 0;
  const prev = frames[i - 1]!;
  const cur = frames[i]!;
  return dist2(cur[foot].ankle, prev[foot].ankle) / Math.max(cur.dt, EPS);
}

/**
 * Break the buffer into stance runs per foot.
 *
 * Slip is measured across the run trimmed by one frame at each end. The
 * touchdown and lift-off frames carry real, correct foot motion — the foot is
 * still arriving, or already leaving — and counting them would charge a sound
 * gait for movement it is supposed to have.
 */
export function extractStances(
  frames: readonly GaitFrame[],
  groundY: number | readonly number[],
  thresholds: GaitThresholds
): Stance[] {
  const stances: Stance[] = [];
  const groundAt = (i: number) =>
    typeof groundY === "number" ? groundY : (groundY[i] ?? 0);

  for (const foot of ["left", "right"] as const) {
    let runStart: number | null = null;

    const close = (endExclusive: number) => {
      if (runStart === null) return;
      const start = runStart;
      runStart = null;
      const last = endExclusive - 1;
      const startT = frames[start]!.t;
      const endT = frames[last]!.t;
      if (endT - startT < thresholds.minStanceDuration) return;

      const inner0 = Math.min(start + 1, last);
      const inner1 = Math.max(last - 1, start);
      let slip = 0;
      for (let i = inner0 + 1; i <= inner1; i++) {
        slip += dist2(frames[i]![foot].ankle, frames[i - 1]![foot].ankle);
      }

      // Foot-flat is the closest the ankle and the ball of the foot ever get
      // in height across this run; everything above it is the heel coming up.
      let flat = Infinity;
      for (let i = start; i <= last; i++) {
        const f = frames[i]![foot];
        if (f.toe) flat = Math.min(flat, f.ankle.y - f.toe.y);
      }

      let peakLift = 0;
      let behind = 0;
      if (Number.isFinite(flat)) {
        for (let i = start; i <= last; i++) {
          const frame = frames[i]!;
          const f = frame[foot];
          if (!f.toe) continue;
          const lift = f.ankle.y - f.toe.y - flat;
          if (lift <= peakLift) continue;
          peakLift = lift;
          // Behind means behind the way the body is facing, so a heel that
          // pops up under the pelvis and one that kicks out backwards are
          // told apart rather than averaged together.
          const ux = Math.sin(frame.facing);
          const uz = Math.cos(frame.facing);
          behind = -(
            (f.ankle.x - frame.hips.x) * ux +
            (f.ankle.z - frame.hips.z) * uz
          );
        }
      }

      let rootSpeedSum = 0;
      for (let i = start; i <= last; i++)
        rootSpeedSum += rootSpeedAt(frames, i);

      stances.push({
        foot,
        startT,
        endT,
        strike: { ...frames[start]![foot].ankle },
        release: { ...frames[last]![foot].ankle },
        slip,
        peakHeelLift: peakLift,
        heelLiftBehindHips: behind,
        rootSpeed: rootSpeedSum / Math.max(1, last - start + 1),
      });
    };

    for (let i = 0; i < frames.length; i++) {
      const down =
        frames[i]![foot].ankle.y - groundAt(i) <= thresholds.contactBand;
      if (down && runStart === null) runStart = i;
      else if (!down && runStart !== null) close(i);
    }
    close(frames.length);
  }

  stances.sort((a, b) => a.startT - b.startT);
  return stances;
}

/**
 * Knee jerk, one frame at a time.
 *
 * A twitch is not a fast knee — a fast knee is a step. It is the knee changing
 * how fast it is bending, faster than any muscle would. The second difference
 * of the angle finds exactly that and ignores the smooth flexion of a stride.
 */
export function findTwitches(
  frames: readonly GaitFrame[],
  thresholds: GaitThresholds
): { twitches: Twitch[]; jerkRms: number } {
  const twitches: Twitch[] = [];
  let sumSq = 0;
  let n = 0;

  for (const foot of ["left", "right"] as const) {
    for (let i = 2; i < frames.length; i++) {
      const dt1 = Math.max(frames[i - 1]!.dt, EPS);
      const dt2 = Math.max(frames[i]!.dt, EPS);
      const w1 =
        (kneeAngleOf(frames[i - 1]!, foot) -
          kneeAngleOf(frames[i - 2]!, foot)) /
        dt1;
      const w2 =
        (kneeAngleOf(frames[i]!, foot) - kneeAngleOf(frames[i - 1]!, foot)) /
        dt2;
      const jerk = (w2 - w1) / dt2;
      sumSq += jerk * jerk;
      n += 1;
      if (Math.abs(jerk) >= thresholds.twitchJerk) {
        twitches.push({
          t: frames[i]!.t,
          foot,
          jerk,
          kneeAngle: kneeAngleOf(frames[i]!, foot),
        });
      }
    }
  }

  twitches.sort((a, b) => a.t - b.t);
  return { twitches, jerkRms: n > 0 ? Math.sqrt(sumSq / n) : 0 };
}

/** Every joint the jolt pass watches, with what it is measured against. */
const JOINT_TRACKS: readonly {
  joint: JoltJoint;
  of: (frame: GaitFrame) => Vec3 | null;
  from: (frame: GaitFrame) => Vec3;
}[] = [
  { joint: "pelvis", of: (f) => f.hips, from: (f) => f.root },
  { joint: "left knee", of: (f) => f.left.knee, from: (f) => f.hips },
  { joint: "left ankle", of: (f) => f.left.ankle, from: (f) => f.hips },
  { joint: "left toe", of: (f) => f.left.toe, from: (f) => f.hips },
  { joint: "right knee", of: (f) => f.right.knee, from: (f) => f.hips },
  { joint: "right ankle", of: (f) => f.right.ankle, from: (f) => f.hips },
  { joint: "right toe", of: (f) => f.right.toe, from: (f) => f.hips },
];

/**
 * A joint's offset from its reference, turned into the character's own frame.
 *
 * Without the rotation a character walking a circle reads as though its legs
 * are being flung sideways, because the whole body is swinging around the
 * world axes. In its own frame a leg is doing the same thing on every heading.
 */
function localOffset(
  frame: GaitFrame,
  point: Vec3,
  reference: Vec3
): [number, number, number] {
  const dx = point.x - reference.x;
  const dz = point.z - reference.z;
  const [rx, rz] = rightOf(frame.facing);
  const fx = Math.sin(frame.facing);
  const fz = Math.cos(frame.facing);
  return [dx * rx + dz * rz, point.y - reference.y, dx * fx + dz * fz];
}

/**
 * Joints that arrive instead of travelling.
 *
 * The complaint this answers is a foot that teleports, and no aggregate over a
 * whole buffer can answer it: a single bad frame in six hundred moves a mean
 * by nothing at all. So this looks at frames, one at a time, and reports the
 * time each one happened at.
 *
 * The measure is the second difference of position, the same shape as the
 * knee-twitch pass one dimension up. Velocity alone cannot separate a fast
 * swing from a jump - a foot honestly reaches four metres a second at
 * mid-swing. Acceleration can: reaching that speed takes a fifth of a second
 * of leg, and arriving at it takes one frame.
 */
export function findJolts(
  frames: readonly GaitFrame[],
  thresholds: GaitThresholds
): {
  jolts: Jolt[];
  peak: number;
  peakJoint: JoltJoint | null;
  peakStep: number;
} {
  const jolts: Jolt[] = [];
  let peak = 0;
  let peakJoint: JoltJoint | null = null;
  let peakStep = 0;

  for (const track of JOINT_TRACKS) {
    for (let i = 2; i < frames.length; i++) {
      const a = track.of(frames[i - 2]!);
      const b = track.of(frames[i - 1]!);
      const c = track.of(frames[i]!);
      // A rig without a ToeBase has no toe track to measure.
      if (!a || !b || !c) break;

      const pa = localOffset(frames[i - 2]!, a, track.from(frames[i - 2]!));
      const pb = localOffset(frames[i - 1]!, b, track.from(frames[i - 1]!));
      const pc = localOffset(frames[i]!, c, track.from(frames[i]!));

      const dt = Math.max(frames[i]!.dt, EPS);
      let sq = 0;
      let stepSq = 0;
      for (let axis = 0; axis < 3; axis++) {
        const second = pc[axis]! - 2 * pb[axis]! + pa[axis]!;
        sq += second * second;
        const delta = pc[axis]! - pb[axis]!;
        stepSq += delta * delta;
      }
      const accel = Math.sqrt(sq) / (dt * dt);
      const step = Math.sqrt(stepSq);

      if (accel > peak) {
        peak = accel;
        peakJoint = track.joint;
        peakStep = step;
      }
      if (accel >= thresholds.joltAccel) {
        jolts.push({ t: frames[i]!.t, joint: track.joint, accel, step });
      }
    }
  }

  jolts.sort((a, b) => a.t - b.t);
  return { jolts, peak, peakJoint, peakStep };
}

/**
 * The character's own right, on the ground plane, as [x, z].
 *
 * `facing` is the atan2 of the forward vector, so forward is
 * (sin f, 0, cos f) and right is forward x up = (-cos f, 0, sin f). Getting
 * this backwards silently reports every correctly-weighted walk as leaning the
 * wrong way, so it lives in one function rather than at each call site.
 */
function rightOf(facing: number): [number, number] {
  return [-Math.cos(facing), Math.sin(facing)];
}

/**
 * Signed lateral offset of the pelvis from the foot carrying it.
 *
 * Positive is the character's right. Walking transfers the body over each foot
 * in turn, so this must swing, and it must change sign with the support foot.
 * A pelvis that tracks the centreline is a character being slid along a rail
 * with its legs cycling underneath.
 */
export function lateralOffsetOverSupport(
  frame: GaitFrame,
  support: Support
): number | null {
  if (support !== "left" && support !== "right") return null;
  const ankle = frame[support].ankle;
  const [rx, rz] = rightOf(frame.facing);
  return (frame.hips.x - ankle.x) * rx + (frame.hips.z - ankle.z) * rz;
}

/**
 * Signed lateral departure of the pelvis from the body's own travel line.
 *
 * Positive is the character's right. This is the pelvis moving, not the pelvis
 * measured against a foot that moved: stance width alone makes `hips - foot`
 * flip sign every step, so that quantity reports weight transfer on a
 * character whose hips never leave the centreline. This one cannot.
 */
export function pelvisSway(frame: GaitFrame): number {
  const [rx, rz] = rightOf(frame.facing);
  return (
    (frame.hips.x - frame.root.x) * rx + (frame.hips.z - frame.root.z) * rz
  );
}

function emptyReport(frameCount: number): GaitReport {
  return {
    frameCount,
    duration: 0,
    groundY: 0,
    stances: [],
    cadence: 0,
    stepLengths: [],
    meanStepLength: 0,
    stepLengthSpread: 0,
    dutyFactor: 0,
    doubleSupportFraction: 0,
    peakSlip: 0,
    meanSlip: 0,
    slipRatio: 0,
    peakHeelLift: 0,
    heelLiftBehindHips: 0,
    hasToes: false,
    twitches: [],
    twitchesPerSecond: 0,
    kneeJerkRms: 0,
    jolts: [],
    joltsPerSecond: 0,
    peakJolt: 0,
    peakJoltJoint: null,
    peakJoltStep: 0,
    inPlaceCyclingSeconds: 0,
    inPlaceCyclingFraction: 0,
    weightShiftAmplitude: 0,
    overSupportFraction: 0,
    weightShiftAlternates: false,
  };
}

export function analyzeGait(
  frames: readonly GaitFrame[],
  thresholds: GaitThresholds = DEFAULT_THRESHOLDS
): GaitReport {
  if (frames.length < 3) return emptyReport(frames.length);

  const groundY = resolveGroundY(frames);
  // Reported as the session floor; support is judged against the local one.
  const ground = localGroundSeries(frames);
  const duration = frames[frames.length - 1]!.t - frames[0]!.t;
  const stances = extractStances(frames, ground, thresholds);
  const hasToes = frames[0]!.left.toe !== null;

  const stepLengths: number[] = [];
  for (let i = 1; i < stances.length; i++) {
    if (stances[i]!.foot === stances[i - 1]!.foot) continue;
    stepLengths.push(dist2(stances[i]!.strike, stances[i - 1]!.strike));
  }
  const meanStepLength = mean(stepLengths);
  const stepLengthSpread =
    stepLengths.length > 1
      ? Math.sqrt(mean(stepLengths.map((l) => (l - meanStepLength) ** 2)))
      : 0;

  // -- Support timing, weight transfer, and cycling on the spot --
  let bothTime = 0;
  let stanceTime = 0;
  let inPlace = 0;
  let overSupport = 0;
  let singleSupportFrames = 0;
  const leftSway: number[] = [];
  const rightSway: number[] = [];
  const sway: number[] = [];

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]!;
    const dt = Math.max(frame.dt, 0);
    const support = supportOf(
      frame,
      ground[i] ?? groundY,
      thresholds.contactBand
    );

    if (support === "both") {
      bothTime += dt;
      stanceTime += 2 * dt;
    } else if (support === "left" || support === "right") {
      stanceTime += dt;
      singleSupportFrames += 1;
      const swayNow = pelvisSway(frame);
      sway.push(swayNow);
      (support === "left" ? leftSway : rightSway).push(swayNow);

      const off = lateralOffsetOverSupport(frame, support);
      if (off !== null && Math.abs(off) <= thresholds.overFootLateral) {
        overSupport += 1;
      }
    }

    const footSpeed = Math.max(
      ankleSpeedAt(frames, i, "left"),
      ankleSpeedAt(frames, i, "right")
    );
    if (
      rootSpeedAt(frames, i) < thresholds.stoppedSpeed &&
      footSpeed > thresholds.movingFootSpeed
    ) {
      inPlace += dt;
    }
  }

  const slips = stances.map((s) => s.slip);
  const peakSlip = slips.length > 0 ? Math.max(...slips) : 0;
  const meanSlip = mean(slips);

  let peakHeelLift = 0;
  let heelLiftBehindHips = 0;
  for (const stance of stances) {
    if (stance.peakHeelLift <= peakHeelLift) continue;
    peakHeelLift = stance.peakHeelLift;
    heelLiftBehindHips = stance.heelLiftBehindHips;
  }

  const { twitches, jerkRms } = findTwitches(frames, thresholds);
  const jolt = findJolts(frames, thresholds);

  // Balancing on a leg means bringing the body over it, so the pelvis must sit
  // LEFT of the travel line while the left foot carries it and right of the
  // line while the right foot does. A pelvis that leans one way regardless of
  // which leg is under it is not transferring weight, and one that never
  // leaves the line is being slid along a rail with its legs cycling beneath.
  const weightShiftAmplitude =
    sway.length > 0 ? Math.max(...sway) - Math.min(...sway) : 0;
  const weightShiftAlternates =
    leftSway.length > 0 &&
    rightSway.length > 0 &&
    mean(leftSway) < 0 &&
    mean(rightSway) > 0 &&
    weightShiftAmplitude > 0.02;

  return {
    frameCount: frames.length,
    duration,
    groundY,
    stances,
    cadence: duration > 0 ? (stances.length / duration) * 60 : 0,
    stepLengths,
    meanStepLength,
    stepLengthSpread,
    // Two legs share the elapsed time, so the denominator carries the factor.
    dutyFactor: duration > 0 ? stanceTime / (duration * 2) : 0,
    doubleSupportFraction: duration > 0 ? bothTime / duration : 0,
    peakSlip,
    meanSlip,
    slipRatio: meanStepLength > EPS ? meanSlip / meanStepLength : 0,
    peakHeelLift,
    heelLiftBehindHips,
    hasToes,
    twitches,
    twitchesPerSecond: duration > 0 ? twitches.length / duration : 0,
    kneeJerkRms: jerkRms,
    jolts: jolt.jolts,
    joltsPerSecond: duration > 0 ? jolt.jolts.length / duration : 0,
    peakJolt: jolt.peak,
    peakJoltJoint: jolt.peakJoint,
    peakJoltStep: jolt.peakStep,
    inPlaceCyclingSeconds: inPlace,
    inPlaceCyclingFraction: duration > 0 ? inPlace / duration : 0,
    weightShiftAmplitude,
    overSupportFraction:
      singleSupportFrames > 0 ? overSupport / singleSupportFrames : 0,
    weightShiftAlternates,
  };
}

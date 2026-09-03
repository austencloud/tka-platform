/**
 * What one rendered frame measures.
 *
 * This is the arithmetic the lab already did inline, lifted out unchanged so
 * the page can be a shell. It reads one frame of rig diagnostics and returns
 * plain numbers; it holds no state, touches no DOM, and imports nothing from
 * the lab's own components, so a sweep can call it per configuration exactly
 * the way the live page calls it per frame.
 */
import type {
  AvatarGripDiagnostics,
  AvatarPoseDiagnostics,
  CollisionEvent,
} from "@austencloud/scene-3d";

export interface GripMetric {
  axisErrorDeg: number | null;
  contactOffsetMm: number | null;
}

export interface PoseMetric {
  requestedYawDeg: number | null;
  achievedYawDeg: number | null;
  headDodgeDeg: number | null;
  torsoPitchDeg: number | null;
  collisionCount: number;
  collisionZones: string;
  deepestCollisionMm: number;
  collisionDescriptions: string;
  audienceGripSeparationMm: number | null;
  depthGripSeparationMm: number | null;
  /** Each grip's offset along the chest-lateral (audience depth) axis. */
  blueGripDepthMm: number | null;
  redGripDepthMm: number | null;
  /** Half the shoulder span: the elbow line the grips must stay inside. */
  shoulderHalfSpanMm: number | null;
  /** Straight-line distance between the two palms: the hug measurement. */
  palmSeparationMm: number | null;
  /** Palm separation along the audience-depth axis alone. */
  palmDepthSeparationMm: number | null;
  /**
   * Distance between the two rendered grips. Unlike the palms this exists on
   * every rig, so it is the portable hand-convergence measurement.
   */
  gripSeparationMm: number | null;
  /** Elbow world positions, for proving the hug kept them put. */
  leftElbow: string;
  rightElbow: string;
  /**
   * How far each hand swings toward the chest-forward midline BEYOND its own
   * forearm direction. This is the wrist's own contribution to the hug: 0 is
   * a hand that continues straight out of the forearm, positive is a wrist
   * rotated inward toward the centerline.
   */
  leftWristInwardDeg: number | null;
  rightWristInwardDeg: number | null;
  /** Total wrist bend between forearm and hand, whatever its direction. */
  leftWristBendDeg: number | null;
  rightWristBendDeg: number | null;
  /** Distance from each palm to the grip point the grid authored for it. */
  leftPalmToAuthoredMm: number | null;
  rightPalmToAuthoredMm: number | null;
  /** Measured arm segments and the staff length they permit. */
  upperArmMm: number | null;
  forearmMm: number | null;
  reachMm: number | null;
  /**
   * The staff the COLLISION model is using, measured off
   * `gripDiagnostics.blueStaffSegment`. Not the mesh: the segment is built in
   * the scene package from the global `userProportionsState.staffLength`,
   * while the drawn prop takes the `propLength` this lab sets per performer.
   * The two are independent, which is the whole reason the lab shows both.
   */
  collisionStaffLengthMm: number | null;
  renderedStepNumber: number;
  renderedBeatProgress: number;
}

export interface FrameMetrics {
  left: GripMetric;
  right: GripMetric;
  pose: PoseMetric;
}

export const EMPTY_GRIP_METRIC: GripMetric = {
  axisErrorDeg: null,
  contactOffsetMm: null,
};

export const EMPTY_POSE_METRIC: PoseMetric = {
  requestedYawDeg: null,
  achievedYawDeg: null,
  headDodgeDeg: null,
  torsoPitchDeg: null,
  collisionCount: 0,
  collisionZones: "",
  deepestCollisionMm: 0,
  collisionDescriptions: "",
  audienceGripSeparationMm: null,
  depthGripSeparationMm: null,
  blueGripDepthMm: null,
  redGripDepthMm: null,
  shoulderHalfSpanMm: null,
  palmSeparationMm: null,
  palmDepthSeparationMm: null,
  gripSeparationMm: null,
  leftElbow: "",
  rightElbow: "",
  leftWristInwardDeg: null,
  rightWristInwardDeg: null,
  leftWristBendDeg: null,
  rightWristBendDeg: null,
  leftPalmToAuthoredMm: null,
  rightPalmToAuthoredMm: null,
  upperArmMm: null,
  forearmMm: null,
  reachMm: null,
  collisionStaffLengthMm: null,
  renderedStepNumber: 0,
  renderedBeatProgress: 0,
};

type Point = Readonly<{ x: number; y: number; z: number }>;

interface WristGeometry {
  inwardDeg: number | null;
  bendDeg: number | null;
}

const NO_WRIST_GEOMETRY: WristGeometry = { inwardDeg: null, bendDeg: null };

export function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

export function formatMetric(
  value: number | null | undefined,
  digits = 1
): string {
  return value == null || !Number.isFinite(value) ? "—" : value.toFixed(digits);
}

export function formatPoint(point: Point | null | undefined): string {
  if (!point) return "";
  return `${(point.x * 1000).toFixed(1)},${(point.y * 1000).toFixed(1)},${(
    point.z * 1000
  ).toFixed(1)}`;
}

function axisErrorDegrees(
  axis: Point | null,
  segment: AvatarGripDiagnostics["blueStaffSegment"]
): number | null {
  if (!axis || !segment) return null;
  const sx = segment.b.x - segment.a.x;
  const sy = segment.b.y - segment.a.y;
  const sz = segment.b.z - segment.a.z;
  const shaftLength = Math.hypot(sx, sy, sz);
  const axisLength = Math.hypot(axis.x, axis.y, axis.z);
  if (shaftLength < 1e-6 || axisLength < 1e-6) return null;
  const dot = Math.abs(
    (sx * axis.x + sy * axis.y + sz * axis.z) / (shaftLength * axisLength)
  );
  return (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
}

function contactOffsetMillimeters(
  palm: Point | null,
  grip: Point | null
): number | null {
  if (!palm || !grip) return null;
  return Math.hypot(palm.x - grip.x, palm.y - grip.y, palm.z - grip.z) * 1000;
}

function unit(from: Point, to: Point): [number, number, number] | null {
  const x = to.x - from.x;
  const y = to.y - from.y;
  const z = to.z - from.z;
  const length = Math.hypot(x, y, z);
  if (length < 1e-6) return null;
  return [x / length, y / length, z / length];
}

function arcsinDegrees(value: number): number {
  return (Math.asin(Math.max(-1, Math.min(1, value))) * 180) / Math.PI;
}

/**
 * Split the hand's direction into the part the forearm already carries and
 * the part the wrist adds. The chest-lateral axis is rebuilt from the
 * achieved shoulder yaw: at yaw 0 the performer's anatomical right is world
 * -X, and the shoulder frame turns it about Y. Medial (toward the
 * chest-forward midline) is +lateral for the left hand and -lateral for the
 * right, matching the animator's own palm-socket convention.
 */
function wristGeometry(
  side: "left" | "right",
  elbow: Point | null | undefined,
  wrist: Point | null | undefined,
  palm: Point | null | undefined,
  achievedYawRad: number
): WristGeometry {
  if (!elbow || !wrist || !palm) return NO_WRIST_GEOMETRY;
  const forearm = unit(elbow, wrist);
  const hand = unit(wrist, palm);
  if (!forearm || !hand) return NO_WRIST_GEOMETRY;
  const medialSign = side === "left" ? 1 : -1;
  const lateralX = -Math.cos(achievedYawRad) * medialSign;
  const lateralZ = Math.sin(achievedYawRad) * medialSign;
  const handMedial = arcsinDegrees(hand[0] * lateralX + hand[2] * lateralZ);
  const forearmMedial = arcsinDegrees(
    forearm[0] * lateralX + forearm[2] * lateralZ
  );
  const dot =
    forearm[0] * hand[0] + forearm[1] * hand[1] + forearm[2] * hand[2];
  return {
    inwardDeg: handMedial - forearmMedial,
    bendDeg: (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI,
  };
}

function separationMillimeters(
  a: Point | null | undefined,
  b: Point | null | undefined
): number | null {
  if (!a || !b) return null;
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) * 1000;
}

/** Every number one rendered frame can report, from that frame's diagnostics. */
export function collectFrameMetrics(
  events: CollisionEvent[],
  diagnostics: AvatarPoseDiagnostics,
  gripDiagnostics: AvatarGripDiagnostics
): FrameMetrics {
  const left: GripMetric = {
    axisErrorDeg: axisErrorDegrees(
      gripDiagnostics.leftGripAxis,
      gripDiagnostics.blueStaffSegment
    ),
    contactOffsetMm: contactOffsetMillimeters(
      gripDiagnostics.leftPalm,
      gripDiagnostics.renderedBlueGrip
    ),
  };
  const right: GripMetric = {
    axisErrorDeg: axisErrorDegrees(
      gripDiagnostics.rightGripAxis,
      gripDiagnostics.redStaffSegment
    ),
    contactOffsetMm: contactOffsetMillimeters(
      gripDiagnostics.rightPalm,
      gripDiagnostics.renderedRedGrip
    ),
  };

  const leftWrist = wristGeometry(
    "left",
    diagnostics.leftElbowWorld,
    gripDiagnostics.leftWrist,
    gripDiagnostics.leftPalm,
    diagnostics.achievedShoulderYawRad
  );
  const rightWrist = wristGeometry(
    "right",
    diagnostics.rightElbowWorld,
    gripDiagnostics.rightWrist,
    gripDiagnostics.rightPalm,
    diagnostics.achievedShoulderYawRad
  );

  const pose: PoseMetric = {
    requestedYawDeg: radiansToDegrees(diagnostics.requestedStanceYawRad),
    achievedYawDeg: radiansToDegrees(diagnostics.achievedShoulderYawRad),
    headDodgeDeg: radiansToDegrees(diagnostics.appliedHeadDodgeRad),
    torsoPitchDeg: radiansToDegrees(diagnostics.achievedTorsoPitchRad),
    collisionCount: events.length,
    collisionZones: events
      .map(({ zone, severity }) => `${zone}:${severity}`)
      .sort()
      .join(","),
    deepestCollisionMm:
      Math.max(0, ...events.map(({ penetrationDepth }) => penetrationDepth)) *
      1000,
    collisionDescriptions: events
      .map(({ description }) => description)
      .join(" | "),
    audienceGripSeparationMm:
      gripDiagnostics.authoredBlueGrip && gripDiagnostics.authoredRedGrip
        ? Math.hypot(
            gripDiagnostics.authoredBlueGrip.x -
              gripDiagnostics.authoredRedGrip.x,
            gripDiagnostics.authoredBlueGrip.y -
              gripDiagnostics.authoredRedGrip.y
          ) * 1000
        : null,
    depthGripSeparationMm:
      gripDiagnostics.authoredBlueGrip && gripDiagnostics.authoredRedGrip
        ? Math.abs(
            gripDiagnostics.authoredBlueGrip.z -
              gripDiagnostics.authoredRedGrip.z
          ) * 1000
        : null,
    blueGripDepthMm: gripDiagnostics.authoredBlueGrip
      ? gripDiagnostics.authoredBlueGrip.z * 1000
      : null,
    redGripDepthMm: gripDiagnostics.authoredRedGrip
      ? gripDiagnostics.authoredRedGrip.z * 1000
      : null,
    shoulderHalfSpanMm: (diagnostics.shoulderWidth / 2) * 1000,
    palmSeparationMm: separationMillimeters(
      gripDiagnostics.leftPalm,
      gripDiagnostics.rightPalm
    ),
    palmDepthSeparationMm:
      gripDiagnostics.leftPalm && gripDiagnostics.rightPalm
        ? Math.abs(gripDiagnostics.leftPalm.z - gripDiagnostics.rightPalm.z) *
          1000
        : null,
    gripSeparationMm: separationMillimeters(
      gripDiagnostics.renderedBlueGrip,
      gripDiagnostics.renderedRedGrip
    ),
    leftElbow: formatPoint(diagnostics.leftElbowWorld),
    rightElbow: formatPoint(diagnostics.rightElbowWorld),
    leftWristInwardDeg: leftWrist.inwardDeg,
    rightWristInwardDeg: rightWrist.inwardDeg,
    leftWristBendDeg: leftWrist.bendDeg,
    rightWristBendDeg: rightWrist.bendDeg,
    leftPalmToAuthoredMm: separationMillimeters(
      gripDiagnostics.leftPalm,
      gripDiagnostics.authoredBlueGrip
    ),
    rightPalmToAuthoredMm: separationMillimeters(
      gripDiagnostics.rightPalm,
      gripDiagnostics.authoredRedGrip
    ),
    upperArmMm:
      ((diagnostics.leftUpperArmLength + diagnostics.rightUpperArmLength) / 2) *
      1000,
    forearmMm:
      ((diagnostics.leftForearmLength + diagnostics.rightForearmLength) / 2) *
      1000,
    reachMm:
      ((diagnostics.leftUpperArmLength +
        diagnostics.leftForearmLength +
        diagnostics.rightUpperArmLength +
        diagnostics.rightForearmLength) /
        2) *
      1000,
    collisionStaffLengthMm: gripDiagnostics.blueStaffSegment
      ? Math.hypot(
          gripDiagnostics.blueStaffSegment.b.x -
            gripDiagnostics.blueStaffSegment.a.x,
          gripDiagnostics.blueStaffSegment.b.y -
            gripDiagnostics.blueStaffSegment.a.y,
          gripDiagnostics.blueStaffSegment.b.z -
            gripDiagnostics.blueStaffSegment.a.z
        ) * 1000
      : null,
    renderedStepNumber: gripDiagnostics.stepNumber,
    renderedBeatProgress: gripDiagnostics.beatProgress,
  };

  return { left, right, pose };
}

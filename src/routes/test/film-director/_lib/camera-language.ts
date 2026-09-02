import { userProportionsState } from "@austencloud/scene-3d";

import { computeFramingShot } from "$lib/shared/3d/camera/compute-framing-shot";

import { applyDirectorEasing } from "./director-easing";
import { allocateMoveWindows } from "./director-move-windows";
import type {
  DirectorCameraTargetInput,
  ResolvedDirectorCameraKeyframe,
  ResolvedDirectorPerformer,
} from "./film-director-schema";

export type DirectorShotSize = "close-up" | "medium" | "wide" | "extreme-wide";
export type DirectorCameraAngle = "low" | "eye" | "high" | "top";
export type DirectorCameraVantage =
  | "front"
  | "left"
  | "right"
  | "behind"
  | { degrees: number };

export interface DirectorFramingInput {
  subject?: DirectorCameraTargetInput;
  shotSize?: DirectorShotSize;
  angle?: DirectorCameraAngle;
  position?: DirectorCameraVantage;
}

export interface CameraLanguageContext {
  durationSeconds: number;
  aspectRatio: number;
  groundOffset: number;
  performers: readonly ResolvedDirectorPerformer[];
}

export interface CameraFraming {
  position: [number, number, number];
  target: [number, number, number];
  fovDeg: number;
}

const SHOT_SIZE_MULTIPLIER: Record<DirectorShotSize, number> = {
  "close-up": 0.4,
  medium: 0.75,
  wide: 1.3,
  "extreme-wide": 1.9,
};

const ANGLE_ELEVATION_DEG: Record<DirectorCameraAngle, number> = {
  low: -12,
  eye: 4,
  high: 28,
  top: 65,
};

const VANTAGE_AZIMUTH_DEG: Record<Exclude<DirectorCameraVantage, { degrees: number }>, number> = {
  front: 0,
  right: -90,
  left: 90,
  behind: 180,
};

const MIN_DISTANCE_METERS = 1.2;
const CLOSE_UP_TARGET_HEIGHT = 1.45;
/** Gap 21. Head height above the floor for a shot of an empty stage. */
const EMPTY_STAGE_TARGET_HEIGHT = 1.4;

/**
 * Gap 12. Where a hand and the end of its prop sit above the floor. A hand in
 * a spinning grip rides roughly chest high; a staff tip reaches about a head
 * higher at the top of its arc. Both are compile-time aims at the performer's
 * mark, so they say nothing about where the hand is on any particular count.
 */
export const HAND_TARGET_HEIGHT = 1.1;
export const PROP_TIP_TARGET_HEIGHT = 1.4;

/**
 * Gap 12. The height a subject of this kind aims at, or null when the subject
 * aims at whatever the group framing already chose.
 */
export function subjectAnchorHeight(kind: string): number | null {
  if (kind === "hand") return HAND_TARGET_HEIGHT;
  if (kind === "prop-tip") return PROP_TIP_TARGET_HEIGHT;
  return null;
}

/**
 * World Y of the floor performers stand on. `groundOffset` is the rig ORIGIN
 * (shoulder height, per computeFramingShot); the feet sit
 * `userProportionsState.groundY` (negative) below it. Directive heights are
 * spoken relative to this floor — "frame her at 1.35 meters" means 1.35m
 * above her feet, never 1.35m of absolute world Y.
 */
export function directorFloorY(groundOffset: number): number {
  return groundOffset + userProportionsState.groundY;
}

export function computeCameraFraming(
  input: DirectorFramingInput,
  context: CameraLanguageContext
): CameraFraming {
  const base = computeFramingShot({
    performers: context.performers.map((performer) => performer.position),
    plane: "wall",
    groundOffset: context.groundOffset,
    fovDeg: 50,
    aspectRatio: context.aspectRatio,
    paddingMult: 1.18,
    elevationDeg: 12,
  });
  const baseEye: [number, number, number] = [base.eye.x, base.eye.y, base.eye.z];
  const groupTarget: [number, number, number] = [
    base.target.x,
    base.target.y,
    base.target.z,
  ];
  // Gap 21. With nobody on stage there is no group to average, so the shot
  // frames the spot where the cast would stand: the stage origin, at the
  // height a head would be. Everything downstream (distance, vantage,
  // elevation) then works off that point exactly as it does for a cast.
  if (context.performers.length === 0) {
    groupTarget[0] = 0;
    groupTarget[1] = directorFloorY(context.groundOffset) + EMPTY_STAGE_TARGET_HEIGHT;
    groupTarget[2] = 0;
  }

  const target = resolveSubject(input.subject, context, groupTarget);
  // A hand or a prop tip (gap 12) already names the height it means, so a
  // close-up of one must not be dragged up to face height.
  if (input.shotSize === "close-up" && input.subject?.kind === "performer") {
    target[1] = directorFloorY(context.groundOffset) + CLOSE_UP_TARGET_HEIGHT;
  }

  const baseDistance = Math.hypot(
    baseEye[0] - groupTarget[0],
    baseEye[1] - groupTarget[1],
    baseEye[2] - groupTarget[2]
  );
  const distance = Math.max(
    MIN_DISTANCE_METERS,
    baseDistance * SHOT_SIZE_MULTIPLIER[input.shotSize ?? "medium"]
  );

  // Azimuth 0 = the base framing's eye direction ("front of the group").
  const baseAzimuth = Math.atan2(
    baseEye[0] - groupTarget[0],
    baseEye[2] - groupTarget[2]
  );
  const vantage = input.position ?? "front";
  const vantageDeg =
    typeof vantage === "object" ? vantage.degrees : VANTAGE_AZIMUTH_DEG[vantage];
  const azimuth = baseAzimuth + (vantageDeg * Math.PI) / 180;
  const elevation =
    (ANGLE_ELEVATION_DEG[input.angle ?? "eye"] * Math.PI) / 180;

  const horizontal = distance * Math.cos(elevation);
  return {
    position: [
      target[0] + Math.sin(azimuth) * horizontal,
      target[1] + distance * Math.sin(elevation),
      target[2] + Math.cos(azimuth) * horizontal,
    ],
    target,
    fovDeg: 50,
  };
}

function resolveSubject(
  subject: DirectorCameraTargetInput | undefined,
  context: CameraLanguageContext,
  groupTarget: [number, number, number]
): [number, number, number] {
  if (!subject || subject.kind === "group") return [...groupTarget];
  if (subject.kind === "point") return [...subject.position];
  const performer = context.performers.find(
    (candidate) => candidate.id === subject.performerId
  );
  if (!performer) {
    throw new Error(
      `Camera subject references missing performer "${subject.performerId}".`
    );
  }
  const anchorHeight = subjectAnchorHeight(subject.kind);
  const height =
    anchorHeight !== null
      ? anchorHeight
      : subject.kind === "performer"
        ? subject.height
        : undefined;
  return [
    performer.position.x,
    height !== undefined
      ? directorFloorY(context.groundOffset) + height
      : groupTarget[1],
    performer.position.z,
  ];
}

export type DirectorPanDestination =
  | { kind: "performer"; performerId: string }
  | { kind: "point"; position: [number, number, number] };

export interface DirectorCameraMove {
  move:
    | "hold"
    | "push-in"
    | "pull-back"
    | "orbit"
    | "crane"
    | "pan"
    | "truck"
    | "zoom"
    | "roll";
  direction?: "cw" | "ccw" | "up" | "down" | "left" | "right" | "in" | "out";
  amount?: { degrees: number } | { meters: number } | { match: "subject-size" };
  /** A pan spoken as a destination instead of an angle. */
  to?: DirectorPanDestination;
  /** Moves that run at the same time as this one, in the same window. */
  with?: DirectorCameraMove[];
  durationSeconds?: number;
  easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
}

/**
 * What each move measures, and which directions it accepts.
 *
 * Exported because it is the only authority on a legal move: any surface that
 * offers moves to a director has to read this rather than restate it, or it
 * will offer one that fails validation the moment it is written into a film.
 */
export const CAMERA_MOVE_RULES: Record<
  DirectorCameraMove["move"],
  { unit: "degrees" | "meters" | null; directions: readonly string[] | null }
> = {
  hold: { unit: null, directions: null },
  "push-in": { unit: "meters", directions: null },
  "pull-back": { unit: "meters", directions: null },
  orbit: { unit: "degrees", directions: ["cw", "ccw"] },
  crane: { unit: "meters", directions: ["up", "down"] },
  pan: { unit: "degrees", directions: ["left", "right"] },
  truck: { unit: "meters", directions: ["left", "right"] },
  zoom: { unit: "degrees", directions: ["in", "out"] },
  roll: { unit: "degrees", directions: ["cw", "ccw"] },
};

const MOVE_RULES = CAMERA_MOVE_RULES;

const ORBIT_SEGMENT_DEG = 30;

const MIN_FOV_DEG = 20;
const MAX_FOV_DEG = 100;

/** Two-decimal display for zoom's rejection message — same rounding
 * convention as director-move-windows.ts's `fmt`. */
const fmt = (n: number): string => String(Number(n.toFixed(2)));

type Vec3 = [number, number, number];

/** The camera's whole state at one instant of a move group. */
interface MoveGroupState {
  position: Vec3;
  target: Vec3;
  fovDeg: number;
  rollDeg: number;
}

const ZERO_DELTA = (): MoveGroupState => ({
  position: [0, 0, 0],
  target: [0, 0, 0],
  fovDeg: 0,
  rollDeg: 0,
});

function degreesAmount(move: DirectorCameraMove, fallback: number): number {
  return move.amount && "degrees" in move.amount ? move.amount.degrees : fallback;
}

function metersAmount(move: DirectorCameraMove, fallback: number): number {
  return move.amount && "meters" in move.amount ? move.amount.meters : fallback;
}

function isMatchZoom(move: DirectorCameraMove): boolean {
  return Boolean(move.amount && "match" in move.amount);
}

function resolvePanDestination(
  destination: DirectorPanDestination,
  context: CameraLanguageContext
): Vec3 {
  if (destination.kind === "point") return [...destination.position];
  const performer = context.performers.find(
    (candidate) => candidate.id === destination.performerId
  );
  if (!performer) {
    throw new Error(
      `Camera pan references missing performer "${destination.performerId}".`
    );
  }
  return [performer.position.x, 0, performer.position.z];
}

/**
 * Gap 28. How far this pan turns, in the same signed degrees the rotation
 * below consumes. A pan spoken as `to` reads the shortest way round from
 * where the camera currently aims to that subject's opening mark; a pan
 * spoken as direction + amount keeps its original meaning.
 */
function panDegrees(
  move: DirectorCameraMove,
  position: Vec3,
  target: Vec3,
  context: CameraLanguageContext
): number {
  if (!move.to) {
    return degreesAmount(move, 30) * (move.direction === "right" ? -1 : 1);
  }
  const destination = resolvePanDestination(move.to, context);
  const current = Math.atan2(target[0] - position[0], target[2] - position[2]);
  const desired = Math.atan2(
    destination[0] - position[0],
    destination[2] - position[2]
  );
  let degrees = ((desired - current) * 180) / Math.PI;
  while (degrees > 180) degrees -= 360;
  while (degrees <= -180) degrees += 360;
  return degrees;
}

/** The aim point after turning `degrees`, keeping the current aim distance. */
function panTarget(position: Vec3, target: Vec3, degrees: number): Vec3 {
  const dx = target[0] - position[0];
  const dz = target[2] - position[2];
  const angle = (degrees * Math.PI) / 180;
  return [
    position[0] + dx * Math.cos(angle) + dz * Math.sin(angle),
    target[1],
    position[2] - dx * Math.sin(angle) + dz * Math.cos(angle),
  ];
}

/**
 * One member's contribution to a move group at `progress`, measured from the
 * group's start state. Deltas add, so several members can shape one frame.
 * `running` is the state the earlier members in the list have already
 * produced. Only a subject-size zoom reads it, because the fov it solves for
 * depends on where the travelling members have put the camera.
 */
function moveGroupDelta(
  move: DirectorCameraMove,
  origin: MoveGroupState,
  running: MoveGroupState,
  progress: number,
  context: CameraLanguageContext
): MoveGroupState {
  const delta = ZERO_DELTA();
  const startDistance = Math.hypot(
    origin.position[0] - origin.target[0],
    origin.position[1] - origin.target[1],
    origin.position[2] - origin.target[2]
  );

  if (move.move === "push-in" || move.move === "pull-back") {
    const meters = metersAmount(move, startDistance * 0.3);
    const sign = move.move === "push-in" ? -1 : 1;
    const endDistance = Math.max(0.8, startDistance + sign * meters);
    const distance = startDistance + (endDistance - startDistance) * progress;
    const scale = distance / startDistance;
    delta.position = [0, 1, 2].map(
      (axis) =>
        origin.target[axis]! +
        (origin.position[axis]! - origin.target[axis]!) * scale -
        origin.position[axis]!
    ) as Vec3;
    return delta;
  }

  if (move.move === "orbit") {
    const degrees =
      degreesAmount(move, 90) * (move.direction === "cw" ? -1 : 1) * progress;
    const radius = Math.hypot(
      origin.position[0] - origin.target[0],
      origin.position[2] - origin.target[2]
    );
    const startAngle = Math.atan2(
      origin.position[0] - origin.target[0],
      origin.position[2] - origin.target[2]
    );
    const angle = startAngle + (degrees * Math.PI) / 180;
    delta.position = [
      origin.target[0] + Math.sin(angle) * radius - origin.position[0],
      0,
      origin.target[2] + Math.cos(angle) * radius - origin.position[2],
    ];
    return delta;
  }

  if (move.move === "crane") {
    const meters = metersAmount(move, 2) * (move.direction === "down" ? -1 : 1);
    delta.position = [0, meters * progress, 0];
    return delta;
  }

  if (move.move === "truck") {
    const meters = metersAmount(move, 2) * (move.direction === "right" ? 1 : -1);
    const right = groundRight(origin.position, origin.target);
    const slide: Vec3 = [
      right[0] * meters * progress,
      0,
      right[1] * meters * progress,
    ];
    delta.position = [...slide];
    delta.target = [...slide];
    return delta;
  }

  if (move.move === "zoom") {
    if (isMatchZoom(move)) {
      // Keep tan(fov/2) * distance constant: the subject subtends the same
      // angle of the frame however far the rig has travelled.
      const distance = Math.hypot(
        running.position[0] - running.target[0],
        running.position[1] - running.target[1],
        running.position[2] - running.target[2]
      );
      const constant =
        Math.tan((origin.fovDeg * Math.PI) / 360) * startDistance;
      const solved =
        (Math.atan(constant / Math.max(1e-6, distance)) * 360) / Math.PI;
      delta.fovDeg = solved - origin.fovDeg;
      return delta;
    }
    delta.fovDeg =
      degreesAmount(move, 10) * (move.direction === "out" ? 1 : -1) * progress;
    return delta;
  }

  if (move.move === "roll") {
    delta.rollDeg =
      degreesAmount(move, 15) * (move.direction === "ccw" ? -1 : 1) * progress;
    return delta;
  }

  // pan
  const degrees =
    panDegrees(move, origin.position, origin.target, context) * progress;
  const aimed = panTarget(origin.position, origin.target, degrees);
  delta.target = [
    aimed[0] - origin.target[0],
    0,
    aimed[2] - origin.target[2],
  ];
  return delta;
}

/** The camera-right ground axis, or a rejection when the view has no sideways. */
function groundRight(position: Vec3, target: Vec3): [number, number] {
  const fx = target[0] - position[0];
  const fz = target[2] - position[2];
  const groundLength = Math.hypot(fx, fz);
  if (groundLength < 1e-6) {
    throw new Error(
      'A "truck" slides the camera sideways to its view, but this framing looks straight up or down, so it has no sideways. Give the camera an angle before trucking.'
    );
  }
  return [-fz / groundLength, fx / groundLength];
}

function moveGroupSegments(members: readonly DirectorCameraMove[]): number {
  let segments = 2;
  for (const member of members) {
    if (member.move === "orbit") {
      segments = Math.max(
        segments,
        Math.ceil(Math.abs(degreesAmount(member, 90)) / ORBIT_SEGMENT_DEG)
      );
    }
  }
  return segments;
}

export function compileCameraMoves(
  moves: readonly DirectorCameraMove[],
  framing: CameraFraming,
  context: CameraLanguageContext
): ResolvedDirectorCameraKeyframe[] {
  if (moves.length === 0) {
    // No moves to chain: an honest two-frame hold spanning the whole scene,
    // rather than crashing on frames[0] below.
    return [
      {
        atSeconds: 0,
        position: [...framing.position],
        target: [...framing.target],
        fovDeg: framing.fovDeg,
        interpolation: "step",
        easing: "linear",
      },
      {
        atSeconds: context.durationSeconds,
        position: [...framing.position],
        target: [...framing.target],
        fovDeg: framing.fovDeg,
        interpolation: "step",
        easing: "linear",
      },
    ];
  }

  const windows = allocateMoveWindows(
    moves,
    context.durationSeconds,
    "Camera moves"
  );
  const frames: ResolvedDirectorCameraKeyframe[] = [];
  let position: [number, number, number] = [...framing.position];
  let target: [number, number, number] = [...framing.target];
  let fovDeg = framing.fovDeg;
  let rollDeg: number | undefined;

  moves.forEach((move, index) => {
    validateMove(move);
    const { start, end } = windows[index]!;
    const easing = move.easing ?? "ease-in-out";
    const push = (
      atSeconds: number,
      pos: [number, number, number],
      tgt: [number, number, number],
      interpolation: ResolvedDirectorCameraKeyframe["interpolation"] = "smooth"
    ) => {
      const last = frames.at(-1);
      if (last && Math.abs(last.atSeconds - atSeconds) < 1e-6) frames.pop();
      frames.push({
        atSeconds,
        position: pos,
        target: tgt,
        fovDeg,
        interpolation,
        easing,
        ...(rollDeg !== undefined ? { rollDeg } : {}),
      });
    };

    if (move.with?.length) {
      // Gap 10. One window, several gestures. Every member's delta is measured
      // from the state the group opened in and added in the order the director
      // listed them, so a push that also cranes and widens is one blended
      // gesture rather than three consecutive ones.
      const members: DirectorCameraMove[] = [
        { ...move, with: undefined },
        ...move.with,
      ];
      members.forEach(validateMove);
      const origin: MoveGroupState = {
        position: [...position],
        target: [...target],
        fovDeg,
        rollDeg: rollDeg ?? 0,
      };
      const composeAt = (progress: number): MoveGroupState => {
        const running: MoveGroupState = {
          position: [...origin.position],
          target: [...origin.target],
          fovDeg: origin.fovDeg,
          rollDeg: origin.rollDeg,
        };
        members.forEach((member) => {
          // A member with no easing of its own rides the group's, which the
          // keyframes themselves carry. A member that states a different one
          // has its curve baked into its own progress instead, because one
          // keyframe stream cannot hold two easing curves at once.
          const memberProgress =
            member.easing && member.easing !== easing
              ? applyDirectorEasing(progress, member.easing)
              : progress;
          const delta = moveGroupDelta(
            member,
            origin,
            running,
            memberProgress,
            context
          );
          running.position = [0, 1, 2].map(
            (axis) => running.position[axis]! + delta.position[axis]!
          ) as Vec3;
          running.target = [0, 1, 2].map(
            (axis) => running.target[axis]! + delta.target[axis]!
          ) as Vec3;
          running.fovDeg += delta.fovDeg;
          running.rollDeg += delta.rollDeg;
        });
        return running;
      };

      const endState = composeAt(1);
      if (endState.fovDeg < MIN_FOV_DEG || endState.fovDeg > MAX_FOV_DEG) {
        throw new Error(
          `These moves would take the lens to ${fmt(endState.fovDeg)} degrees, outside the ${MIN_FOV_DEG}-${MAX_FOV_DEG} degree range (it is at ${fmt(origin.fovDeg)}).`
        );
      }

      let segments = moveGroupSegments(members);
      // A baked easing curve and a solved fov both need enough samples to read
      // as curves rather than as straight lines between two frames.
      if (members.some((member) => member.easing && member.easing !== easing)) {
        segments = Math.max(segments, 8);
      }
      if (members.some(isMatchZoom)) segments = Math.max(segments, 12);

      const rolls = members.some((member) => member.move === "roll");
      if (rolls) rollDeg ??= 0;
      for (let segment = 0; segment <= segments; segment += 1) {
        const progress = segment / segments;
        const state = composeAt(progress);
        fovDeg = state.fovDeg;
        if (rolls) rollDeg = state.rollDeg;
        push(
          start + (end - start) * progress,
          [...state.position],
          [...state.target]
        );
      }
      position = [...endState.position];
      target = [...endState.target];
      fovDeg = endState.fovDeg;
      if (rolls) rollDeg = endState.rollDeg;
      return;
    }

    if (move.move === "hold") {
      push(start, [...position], [...target], "step");
      push(end, [...position], [...target], "step");
      return;
    }

    if (move.move === "push-in" || move.move === "pull-back") {
      const currentDistance = Math.hypot(
        position[0] - target[0], position[1] - target[1], position[2] - target[2]
      );
      const meters =
        move.amount && "meters" in move.amount
          ? move.amount.meters
          : currentDistance * 0.3;
      const sign = move.move === "push-in" ? -1 : 1;
      const nextDistance = Math.max(0.8, currentDistance + sign * meters);
      const next: [number, number, number] = [
        target[0] + ((position[0] - target[0]) / currentDistance) * nextDistance,
        target[1] + ((position[1] - target[1]) / currentDistance) * nextDistance,
        target[2] + ((position[2] - target[2]) / currentDistance) * nextDistance,
      ];
      push(start, [...position], [...target]);
      push(end, next, [...target]);
      position = next;
      return;
    }

    if (move.move === "orbit") {
      // Azimuth here follows computeCameraFraming's vantage math: increasing
      // azimuth rotates +z toward +x. Austen watched the two signs side by
      // side (Proving Grounds scenes 9 and 10, 2026-09-02) and called the
      // DECREASING direction clockwise: from the front, a "cw" orbit ends on
      // the performers' screen-left end of the line. So cw decreases the
      // angle and ccw increases it. This is the felt convention, not the
      // math-from-above one.
      const degrees =
        (move.amount && "degrees" in move.amount ? move.amount.degrees : 90) *
        (move.direction === "cw" ? -1 : 1);
      const radius = Math.hypot(position[0] - target[0], position[2] - target[2]);
      const height = position[1];
      const startAngle = Math.atan2(position[0] - target[0], position[2] - target[2]);
      const segments = Math.max(2, Math.ceil(Math.abs(degrees) / ORBIT_SEGMENT_DEG));
      for (let seg = 0; seg <= segments; seg += 1) {
        const progress = seg / segments;
        const angle = startAngle + (degrees * Math.PI * progress) / 180;
        const pos: [number, number, number] = [
          target[0] + Math.sin(angle) * radius,
          height,
          target[2] + Math.cos(angle) * radius,
        ];
        push(start + (end - start) * progress, pos, [...target], "smooth");
        if (seg === segments) position = pos;
      }
      return;
    }

    if (move.move === "crane") {
      const meters =
        (move.amount && "meters" in move.amount ? move.amount.meters : 2) *
        (move.direction === "down" ? -1 : 1);
      const next: [number, number, number] = [position[0], position[1] + meters, position[2]];
      push(start, [...position], [...target]);
      push(end, next, [...target]);
      position = next;
      return;
    }

    if (move.move === "truck") {
      const meters =
        (move.amount && "meters" in move.amount ? move.amount.meters : 2) *
        (move.direction === "right" ? 1 : -1);
      const right = groundRight(position, target);
      const nextPosition: [number, number, number] = [
        position[0] + right[0] * meters,
        position[1],
        position[2] + right[1] * meters,
      ];
      const nextTarget: [number, number, number] = [
        target[0] + right[0] * meters,
        target[1],
        target[2] + right[1] * meters,
      ];
      push(start, [...position], [...target]);
      push(end, nextPosition, nextTarget);
      position = nextPosition;
      target = nextTarget;
      return;
    }

    if (move.move === "zoom") {
      const degrees =
        (move.amount && "degrees" in move.amount ? move.amount.degrees : 10) *
        (move.direction === "out" ? 1 : -1);
      const next = fovDeg + degrees;
      if (next < MIN_FOV_DEG || next > MAX_FOV_DEG) {
        throw new Error(
          `A zoom of ${fmt(Math.abs(degrees))} degrees would take the lens to ${fmt(next)} degrees, outside the ${MIN_FOV_DEG}-${MAX_FOV_DEG} degree range (it is at ${fmt(fovDeg)}).`
        );
      }
      push(start, [...position], [...target]);
      fovDeg = next;
      push(end, [...position], [...target]);
      return;
    }

    if (move.move === "roll") {
      const degrees =
        (move.amount && "degrees" in move.amount ? move.amount.degrees : 15) *
        (move.direction === "ccw" ? -1 : 1);
      rollDeg ??= 0;
      push(start, [...position], [...target]);
      rollDeg += degrees;
      push(end, [...position], [...target]);
      return;
    }

    // pan: rotate the aim point around the camera. This branch is last and
    // explicit (rather than a bare trailing fallthrough) so a future move
    // inserted above can never silently fall into it.
    if (move.move === "pan") {
      const degrees = panDegrees(move, position, target, context);
      const next = panTarget(position, target, degrees);
      push(start, [...position], [...target]);
      push(end, [...position], next);
      target = next;
    }
  });

  if (frames[0]!.atSeconds !== 0) {
    frames.unshift({ ...frames[0]!, atSeconds: 0 });
  }
  return frames;
}

export interface DirectorCameraShot extends DirectorFramingInput {
  moves?: DirectorCameraMove[];
  durationSeconds?: number;
}

/**
 * Gap 4. Several framings inside one scene, joined by hard cuts. Each shot is
 * framed and its moves compiled exactly as a single-framing camera would be,
 * inside its own time window, then shifted to where that window sits in the
 * scene. The last keyframe of every shot but the final one is a step so the
 * sampler holds it until the next shot's first keyframe, which starts at the
 * same instant: the cut.
 */
export function compileCameraShots(
  shots: readonly DirectorCameraShot[],
  context: CameraLanguageContext
): ResolvedDirectorCameraKeyframe[] {
  const windows = allocateMoveWindows(
    shots,
    context.durationSeconds,
    "Camera shots"
  );
  const frames: ResolvedDirectorCameraKeyframe[] = [];
  shots.forEach((shot, index) => {
    const { start, end } = windows[index]!;
    const length = end - start;
    if (length <= 1e-6) {
      throw new Error(
        `Camera shot ${index + 1} has no time. Every shot needs a duration, stated or left over.`
      );
    }
    const shotContext = { ...context, durationSeconds: length };
    const framing = computeCameraFraming(
      {
        subject: shot.subject,
        shotSize: shot.shotSize,
        angle: shot.angle,
        position: shot.position,
      },
      shotContext
    );
    const compiled = compileCameraMoves(
      shot.moves ?? [{ move: "hold" }],
      framing,
      shotContext
    );
    const isLast = index === shots.length - 1;
    compiled.forEach((frame, frameIndex) => {
      const shifted: ResolvedDirectorCameraKeyframe = {
        ...frame,
        atSeconds: frame.atSeconds + start,
      };
      if (!isLast && frameIndex === compiled.length - 1) {
        shifted.interpolation = "step";
      }
      frames.push(shifted);
    });
  });
  return frames;
}

function validateMove(move: DirectorCameraMove): void {
  const rules = MOVE_RULES[move.move];
  // A subject-size zoom states no unit at all. The schema already proved it
  // sits inside a push-in or pull-back, and the compiler solves its degrees.
  if (move.amount && !isMatchZoom(move)) {
    const unit = "degrees" in move.amount ? "degrees" : "meters";
    if (rules.unit === null) {
      throw new Error(`"${move.move}" does not take an amount.`);
    }
    if (unit !== rules.unit) {
      throw new Error(`"${move.move}" takes ${rules.unit}, not ${unit}.`);
    }
  }
  if (move.direction) {
    if (!rules.directions) {
      throw new Error(`"${move.move}" does not take a direction.`);
    }
    if (!rules.directions.includes(move.direction)) {
      throw new Error(
        `"${move.move}" direction must be one of ${rules.directions.join("/")}, got "${move.direction}".`
      );
    }
  }
}

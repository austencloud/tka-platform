import { userProportionsState } from "@austencloud/scene-3d";

import { computeFramingShot } from "$lib/shared/3d/camera/compute-framing-shot";

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

  const target = resolveSubject(input.subject, context, groupTarget);
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
  return [
    performer.position.x,
    subject.height !== undefined
      ? directorFloorY(context.groundOffset) + subject.height
      : groupTarget[1],
    performer.position.z,
  ];
}

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
  amount?: { degrees: number } | { meters: number };
  durationSeconds?: number;
  easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
}

const MOVE_RULES: Record<
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

const ORBIT_SEGMENT_DEG = 30;

const MIN_FOV_DEG = 20;
const MAX_FOV_DEG = 100;

/** Two-decimal display for zoom's rejection message — same rounding
 * convention as director-move-windows.ts's `fmt`. */
const fmt = (n: number): string => String(Number(n.toFixed(2)));

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
      // Azimuth here follows the same convention as computeCameraFraming's
      // vantage math above: increasing azimuth rotates +z toward +x, which
      // is clockwise viewed from above. So cw increases the angle, ccw
      // decreases it.
      const degrees =
        (move.amount && "degrees" in move.amount ? move.amount.degrees : 90) *
        (move.direction === "cw" ? 1 : -1);
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
      const fx = target[0] - position[0];
      const fz = target[2] - position[2];
      const groundLength = Math.hypot(fx, fz);
      if (groundLength < 1e-6) {
        throw new Error(
          'A "truck" slides the camera sideways to its view, but this framing looks straight up or down, so it has no sideways. Give the camera an angle before trucking.'
        );
      }
      const right: [number, number] = [-fz / groundLength, fx / groundLength];
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
      const degrees =
        (move.amount && "degrees" in move.amount ? move.amount.degrees : 30) *
        (move.direction === "right" ? -1 : 1);
      const dx = target[0] - position[0];
      const dz = target[2] - position[2];
      const angle = (degrees * Math.PI) / 180;
      const next: [number, number, number] = [
        position[0] + dx * Math.cos(angle) + dz * Math.sin(angle),
        target[1],
        position[2] - dx * Math.sin(angle) + dz * Math.cos(angle),
      ];
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
  if (move.amount) {
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

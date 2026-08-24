import { computeFramingShot } from "$lib/shared/3d/camera/compute-framing-shot";

import type {
  DirectorCameraTargetInput,
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
    target[1] = context.groundOffset + CLOSE_UP_TARGET_HEIGHT;
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
    subject.height ?? groupTarget[1],
    performer.position.z,
  ];
}

import { CAMERA_DEFAULTS } from "@austencloud/camera-3d";

export type ReviewVector = readonly [number, number, number];

export interface EnvironmentReviewCameraPreset {
  position: ReviewVector;
  target: ReviewVector;
  fov: number;
}

export interface EnvironmentReviewBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface EnvironmentReviewWalkPose {
  playerPosition: { x: number; y: number; z: number };
  yaw: number;
  pitch: number;
}

export const DEFAULT_ENVIRONMENT_REVIEW_BOUNDS: EnvironmentReviewBounds = {
  minX: -14,
  maxX: 14,
  minZ: -14,
  maxZ: 14,
};

export function resolveEnvironmentReviewWalkPose(
  preset: EnvironmentReviewCameraPreset
): EnvironmentReviewWalkPose {
  const [cameraX, cameraY, cameraZ] = preset.position;
  const [targetX, targetY, targetZ] = preset.target;
  const directionX = targetX - cameraX;
  const directionY = targetY - cameraY;
  const directionZ = targetZ - cameraZ;
  const distance = Math.hypot(directionX, directionY, directionZ);

  return {
    playerPosition: {
      x: cameraX,
      y: cameraY - CAMERA_DEFAULTS.FIRST_PERSON_CAMERA_OFFSET,
      z: cameraZ,
    },
    yaw: Math.atan2(directionX, directionZ),
    pitch:
      distance === 0
        ? 0
        : Math.asin(Math.max(-1, Math.min(1, -directionY / distance))),
  };
}

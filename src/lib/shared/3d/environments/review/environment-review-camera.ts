import { CAMERA_DEFAULTS } from "@austencloud/camera-3d";
import type CameraControls from "camera-controls";
import { Mesh, Raycaster, Vector3, type Object3D } from "three";

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

export interface EnvironmentReviewOrbitPoint {
  x: number;
  y: number;
  z: number;
}

export interface EnvironmentReviewOrbitLift {
  amount: number;
  cameraSurfaceY: number | null;
  targetSurfaceY: number | null;
}

const CAMERA_COLLISION_GROUND_TREATMENTS = new Set([
  "baked-living-floor",
  "baked-living-floor-transition",
  "fog-dissolved-rolling-horizon",
]);
const CAMERA_SURFACE_RAY_ORIGIN_Y = 2_048;
const CAMERA_SURFACE_RAY_LENGTH = 4_096;
const cameraSurfaceRaycaster = new Raycaster();
const cameraSurfaceRayOrigin = new Vector3();
const cameraSurfaceRayDirection = new Vector3(0, -1, 0);
const orbitCameraPosition = new Vector3();
const orbitCameraTarget = new Vector3();

/**
 * Collect only authored ground surfaces. Passing the complete environment to
 * camera-controls would cast four near-plane rays through every leaf, wisp and
 * prop whenever the camera moves.
 */
export function collectEnvironmentCameraCollisionMeshes(
  root: Object3D
): Object3D[] {
  const collisionMeshes: Object3D[] = [];
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    const treatment = mesh.userData.tka_ground_treatment;
    if (
      mesh.userData.tka_camera_collision === true ||
      (typeof treatment === "string" &&
        CAMERA_COLLISION_GROUND_TREATMENTS.has(treatment))
    ) {
      collisionMeshes.push(mesh);
    }
  });
  return collisionMeshes;
}

/** Returns the highest authored ground surface beneath one world-space point. */
export function sampleEnvironmentCameraSurfaceY(
  collisionMeshes: Object3D[],
  x: number,
  z: number
): number | null {
  if (collisionMeshes.length === 0) return null;
  cameraSurfaceRayOrigin.set(x, CAMERA_SURFACE_RAY_ORIGIN_Y, z);
  cameraSurfaceRaycaster.set(cameraSurfaceRayOrigin, cameraSurfaceRayDirection);
  cameraSurfaceRaycaster.near = 0;
  cameraSurfaceRaycaster.far = CAMERA_SURFACE_RAY_LENGTH;
  const hit = cameraSurfaceRaycaster.intersectObjects(
    collisionMeshes,
    false
  )[0];
  return hit?.point.y ?? null;
}

/**
 * Translate the eye and target together. Keeping their relative direction
 * avoids the violent pitch change that happened when a restored URL pose was
 * repaired by moving only the camera.
 */
export function resolveEnvironmentReviewOrbitLift(
  cameraPosition: EnvironmentReviewOrbitPoint,
  cameraTarget: EnvironmentReviewOrbitPoint,
  cameraSurfaceY: number | null,
  targetSurfaceY: number | null,
  cameraClearance = 0.35,
  targetClearance = 0.02
): EnvironmentReviewOrbitLift {
  const cameraLift =
    cameraSurfaceY === null
      ? 0
      : cameraSurfaceY + cameraClearance - cameraPosition.y;
  const targetLift =
    targetSurfaceY === null
      ? 0
      : targetSurfaceY + targetClearance - cameraTarget.y;
  return {
    amount: Math.max(0, cameraLift, targetLift),
    cameraSurfaceY,
    targetSurfaceY,
  };
}

/**
 * Recover a camera restored below rolling terrain and keep panning from moving
 * its orbit target underground. Native collider meshes then stop later orbit
 * and dolly movement from crossing the surface between target and camera.
 */
export function keepEnvironmentReviewOrbitAboveSurface(
  controls: CameraControls,
  collisionMeshes: Object3D[],
  cameraClearance = 0.35
): boolean {
  controls.getPosition(orbitCameraPosition);
  controls.getTarget(orbitCameraTarget);
  const lift = resolveEnvironmentReviewOrbitLift(
    orbitCameraPosition,
    orbitCameraTarget,
    sampleEnvironmentCameraSurfaceY(
      collisionMeshes,
      orbitCameraPosition.x,
      orbitCameraPosition.z
    ),
    sampleEnvironmentCameraSurfaceY(
      collisionMeshes,
      orbitCameraTarget.x,
      orbitCameraTarget.z
    ),
    cameraClearance
  );
  if (lift.amount <= 0.0001) return false;

  controls.setLookAt(
    orbitCameraPosition.x,
    orbitCameraPosition.y + lift.amount,
    orbitCameraPosition.z,
    orbitCameraTarget.x,
    orbitCameraTarget.y + lift.amount,
    orbitCameraTarget.z,
    false
  );
  return true;
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

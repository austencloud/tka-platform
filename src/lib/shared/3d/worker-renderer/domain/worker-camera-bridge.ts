import type { CameraStateSnapshot } from "@austencloud/scene-3d";
import { Euler, Quaternion } from "three";

import type {
  WorkerCameraSnapshot,
  WorkerQuaternion,
} from "./worker-renderer-protocol";

/** Translate the existing viewer camera state without changing its authority. */
export function toWorkerCameraSnapshot(
  snapshot: CameraStateSnapshot | null,
  fallback: WorkerCameraSnapshot
): WorkerCameraSnapshot {
  if (!snapshot) return fallback;
  const quaternion = new Quaternion().setFromEuler(
    new Euler(snapshot.rotation.x, snapshot.rotation.y, snapshot.rotation.z)
  );
  return {
    position: [snapshot.position.x, snapshot.position.y, snapshot.position.z],
    target: [snapshot.target.x, snapshot.target.y, snapshot.target.z],
    fov: snapshot.fov,
    quaternion: quaternion.toArray() as WorkerQuaternion,
    up: [0, 1, 0],
  };
}

/** Return an application-owned snapshot suitable for the existing persistence owner. */
export function toViewerCameraSnapshot(
  snapshot: WorkerCameraSnapshot,
  timestamp = Date.now()
): CameraStateSnapshot {
  const rotation = snapshot.quaternion
    ? new Euler().setFromQuaternion(
        new Quaternion().fromArray(snapshot.quaternion)
      )
    : new Euler();
  return {
    position: {
      x: snapshot.position[0],
      y: snapshot.position[1],
      z: snapshot.position[2],
    },
    rotation: { x: rotation.x, y: rotation.y, z: rotation.z },
    fov: snapshot.fov,
    target: {
      x: snapshot.target[0],
      y: snapshot.target[1],
      z: snapshot.target[2],
    },
    timestamp,
  };
}

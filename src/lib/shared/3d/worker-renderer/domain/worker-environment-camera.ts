import type {
  WorkerCameraSnapshot,
  WorkerEnvironmentKey,
} from "./worker-renderer-protocol";

const CAMERA_BY_ENVIRONMENT: Readonly<
  Record<WorkerEnvironmentKey, WorkerCameraSnapshot>
> = {
  ocean: {
    position: [0, 4.5, 19],
    target: [0, 1.6, -2],
    fov: 46,
  },
  rainbow: {
    position: [0, 4.2, 17],
    target: [0, 1.1, -1],
    fov: 48,
  },
  void: {
    position: [0, 4.2, 17],
    target: [0, 1.1, -1],
    fov: 48,
  },
  winter: {
    position: [0, 4.2, 17],
    target: [0, 1.1, -1],
    fov: 48,
  },
};

export function getWorkerEnvironmentCamera(
  environment: WorkerEnvironmentKey
): WorkerCameraSnapshot {
  return CAMERA_BY_ENVIRONMENT[environment];
}

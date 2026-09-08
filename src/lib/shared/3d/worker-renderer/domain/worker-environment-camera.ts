import type {
  WorkerCameraSnapshot,
  WorkerEnvironmentKey,
} from "./worker-renderer-protocol";
import { CLOUDBREAK_LAYOUT } from "../../environments/scenes/celestial/cloudbreak-layout";
import { getBlossomOpeningCamera } from "../../environments/scenes/cherry-blossom/blossom-site";

const CAMERA_BY_ENVIRONMENT: Readonly<
  Record<WorkerEnvironmentKey, WorkerCameraSnapshot>
> = {
  ocean: {
    position: [0, 4.5, 19],
    target: [0, 1.6, -2],
    fov: 46,
  },
  rainbow: {
    position: [0, 3.8, 19],
    target: [0, 1.8, -1],
    fov: 52,
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
  celestial: {
    position: CLOUDBREAK_LAYOUT.cameraPresets.desktop.position,
    target: CLOUDBREAK_LAYOUT.cameraPresets.desktop.target,
    fov: CLOUDBREAK_LAYOUT.cameraPresets.desktop.fovDegrees,
  },
  cosmic: {
    position: [0, 4.2, 17],
    target: [0, 1.1, -1],
    fov: 48,
  },
  forest: {
    position: [0, 4.6, 19],
    target: [0, 1.3, -1.5],
    fov: 46,
  },
  blossom: getBlossomOpeningCamera(),
  autumn: {
    position: [0, 4.2, 17],
    target: [0, 1.1, -1],
    fov: 48,
  },
  ember: {
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

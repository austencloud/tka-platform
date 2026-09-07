import type { PerspectiveCamera } from "three";
import type { CameraControls } from "../../camera/camera-controls-runtime";
import type { CameraRightDragAction } from "../../camera/camera-controls-runtime";
import type {
  WorkerCameraSnapshot,
  WorkerQuaternion,
  WorkerVector3,
} from "./worker-renderer-protocol";

export type ApplicationThreadCameraPoint =
  | WorkerVector3
  | Readonly<{ x: number; y: number; z: number }>;

export interface ApplicationThreadCameraSnapshot extends WorkerCameraSnapshot {
  position: WorkerVector3;
  target: WorkerVector3;
  /** Camera roll in radians. The quaternion already includes this rotation. */
  roll: number;
  up: WorkerVector3;
  quaternion: WorkerQuaternion;
}

export interface ApplicationThreadCameraFrameScheduler {
  request(callback: FrameRequestCallback): number;
  cancel(handle: number): void;
}

export interface ApplicationThreadCameraControllerOptions {
  initialPosition: ApplicationThreadCameraPoint;
  initialTarget: ApplicationThreadCameraPoint;
  fov?: number;
  aspect?: number;
  near?: number;
  far?: number;
  up?: ApplicationThreadCameraPoint;
  roll?: number;
  enabled?: boolean;
  smoothTime?: number;
  draggingSmoothTime?: number;
  minDistance?: number;
  maxDistance?: number;
  minPolarAngle?: number;
  maxPolarAngle?: number;
  minAzimuthAngle?: number;
  maxAzimuthAngle?: number;
  rotateSpeed?: number;
  panSpeed?: number;
  zoomSpeed?: number;
  enablePan?: boolean;
  rightDragAction?: CameraRightDragAction;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  paused?: boolean;
  onChange?: (snapshot: ApplicationThreadCameraSnapshot) => void;
  onControlStart?: (snapshot: ApplicationThreadCameraSnapshot) => void;
  onControlEnd?: (snapshot: ApplicationThreadCameraSnapshot) => void;
  frameScheduler?: ApplicationThreadCameraFrameScheduler;
}

export interface ApplicationThreadCameraSphericalTarget {
  azimuth: number;
  polar: number;
}

export interface IApplicationThreadCameraController {
  readonly camera: PerspectiveCamera;
  readonly controls: CameraControls;
  readonly isPaused: boolean;
  readonly isDisposed: boolean;
  getSnapshot(): ApplicationThreadCameraSnapshot;
  snapTo(
    position: ApplicationThreadCameraPoint,
    target: ApplicationThreadCameraPoint,
    spherical?: ApplicationThreadCameraSphericalTarget,
    animate?: boolean
  ): Promise<void>;
  setViewport(width: number, height: number): void;
  setFov(fov: number): void;
  setRoll(roll: number): void;
  setEnabled(enabled: boolean): void;
  setAutoRotate(enabled: boolean, speed?: number): void;
  pause(): void;
  resume(): void;
  dispose(): void;
}

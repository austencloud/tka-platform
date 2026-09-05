import { PerspectiveCamera, Vector3 } from "three";
import {
  applyCameraControlsInputActions,
  CameraControls,
  resolveCameraControlsRightAction,
} from "../../camera/camera-controls-runtime";
import type {
  ApplicationThreadCameraControllerOptions,
  ApplicationThreadCameraFrameScheduler,
  ApplicationThreadCameraPoint,
  ApplicationThreadCameraSnapshot,
  ApplicationThreadCameraSphericalTarget,
  IApplicationThreadCameraController,
} from "../domain/application-thread-camera";

const AUTO_ROTATE_RAD_PER_SEC = Math.PI / 30;
const MAX_FRAME_DELTA_SECONDS = 0.1;

function isPointTuple(
  point: ApplicationThreadCameraPoint
): point is readonly [number, number, number] {
  return Array.isArray(point);
}

function readPoint(
  point: ApplicationThreadCameraPoint,
  label: string
): readonly [number, number, number] {
  const value: readonly [number, number, number] = isPointTuple(point)
    ? point
    : ([point.x, point.y, point.z] as const);
  if (!value.every(Number.isFinite)) {
    throw new TypeError(`${label} must contain three finite coordinates.`);
  }
  return value;
}

function requireFinite(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${label} must be finite.`);
  }
  return value;
}

function createBrowserFrameScheduler(): ApplicationThreadCameraFrameScheduler {
  if (
    typeof requestAnimationFrame !== "function" ||
    typeof cancelAnimationFrame !== "function"
  ) {
    throw new Error(
      "ApplicationThreadCameraController requires requestAnimationFrame."
    );
  }
  return {
    request: (callback) => requestAnimationFrame(callback),
    cancel: (handle) => cancelAnimationFrame(handle),
  };
}

export class ApplicationThreadCameraController implements IApplicationThreadCameraController {
  readonly camera: PerspectiveCamera;
  readonly controls: CameraControls;

  private readonly frameScheduler: ApplicationThreadCameraFrameScheduler;
  private readonly target = new Vector3();
  private readonly baseUp = new Vector3(0, 1, 0);
  private readonly onChange?: (
    snapshot: ApplicationThreadCameraSnapshot
  ) => void;
  private readonly onControlStart?: (
    snapshot: ApplicationThreadCameraSnapshot
  ) => void;
  private readonly onControlEnd?: (
    snapshot: ApplicationThreadCameraSnapshot
  ) => void;

  private frameHandle: number | null = null;
  private previousFrameAt: number | null = null;
  private paused: boolean;
  private disposed = false;
  private roll: number;
  private autoRotate: boolean;
  private autoRotateSpeed: number;

  private readonly handleControlStart = (): void => {
    this.onControlStart?.(this.getSnapshot());
  };

  private readonly handleControlEnd = (): void => {
    this.applyRoll();
    this.onControlEnd?.(this.getSnapshot());
  };

  private readonly updateFrame = (now: number): void => {
    this.frameHandle = null;
    if (this.paused || this.disposed) return;

    const delta =
      this.previousFrameAt === null
        ? 0
        : Math.min(
            (now - this.previousFrameAt) / 1000,
            MAX_FRAME_DELTA_SECONDS
          );
    this.previousFrameAt = now;

    if (this.autoRotate) {
      this.controls.azimuthAngle +=
        delta * AUTO_ROTATE_RAD_PER_SEC * this.autoRotateSpeed;
    }

    const changed = this.controls.update(delta);
    this.applyRoll();
    if (changed) this.onChange?.(this.getSnapshot());
    this.requestNextFrame();
  };

  constructor(
    element: HTMLElement,
    options: ApplicationThreadCameraControllerOptions
  ) {
    const initialPosition = readPoint(
      options.initialPosition,
      "initialPosition"
    );
    const initialTarget = readPoint(options.initialTarget, "initialTarget");
    const up = readPoint(options.up ?? [0, 1, 0], "up");
    const width = element.clientWidth;
    const height = element.clientHeight;
    const aspect =
      options.aspect ?? (width > 0 && height > 0 ? width / height : 1);
    const minDistance = options.minDistance ?? 1;
    const maxDistance = options.maxDistance ?? 25;

    requireFinite(aspect, "aspect");
    requireFinite(minDistance, "minDistance");
    if (minDistance <= 0) {
      throw new RangeError("minDistance must be greater than zero.");
    }
    if (maxDistance < minDistance) {
      throw new RangeError("maxDistance must be at least minDistance.");
    }

    this.frameScheduler =
      options.frameScheduler ?? createBrowserFrameScheduler();
    this.onChange = options.onChange;
    this.onControlStart = options.onControlStart;
    this.onControlEnd = options.onControlEnd;
    this.paused = options.paused ?? false;
    this.roll = requireFinite(options.roll ?? 0, "roll");
    this.autoRotate = options.autoRotate ?? false;
    this.autoRotateSpeed = requireFinite(
      options.autoRotateSpeed ?? 2,
      "autoRotateSpeed"
    );

    this.baseUp.fromArray(up);
    if (this.baseUp.lengthSq() === 0) {
      throw new RangeError("up must not be the zero vector.");
    }
    this.baseUp.normalize();

    this.camera = new PerspectiveCamera(
      requireFinite(options.fov ?? 50, "fov"),
      aspect,
      options.near ?? 0.1,
      options.far ?? 1000
    );
    this.camera.position.fromArray(initialPosition);
    this.camera.up.copy(this.baseUp);

    this.controls = new CameraControls(this.camera, element);
    this.controls.enabled = options.enabled ?? true;
    this.controls.smoothTime = options.smoothTime ?? 0.08;
    this.controls.draggingSmoothTime = options.draggingSmoothTime ?? 0.05;
    this.controls.minDistance = minDistance;
    this.controls.maxDistance = maxDistance;
    if (options.minPolarAngle != null) {
      this.controls.minPolarAngle = options.minPolarAngle;
    }
    this.controls.maxPolarAngle = options.maxPolarAngle ?? Math.PI / 2;
    if (options.minAzimuthAngle != null) {
      this.controls.minAzimuthAngle = options.minAzimuthAngle;
    }
    if (options.maxAzimuthAngle != null) {
      this.controls.maxAzimuthAngle = options.maxAzimuthAngle;
    }
    if (options.rotateSpeed != null) {
      this.controls.azimuthRotateSpeed = options.rotateSpeed;
      this.controls.polarRotateSpeed = options.rotateSpeed;
    }
    if (options.panSpeed != null) {
      this.controls.truckSpeed = options.panSpeed * 2;
    }
    if (options.zoomSpeed != null) {
      this.controls.dollySpeed = options.zoomSpeed;
    }

    const enablePan = options.enablePan ?? true;
    applyCameraControlsInputActions(
      this.controls,
      resolveCameraControlsRightAction(options.rightDragAction, enablePan),
      enablePan
    );

    this.controls.setLookAt(
      initialPosition[0],
      initialPosition[1],
      initialPosition[2],
      initialTarget[0],
      initialTarget[1],
      initialTarget[2],
      false
    );
    this.controls.update(0);
    this.applyRoll();
    this.controls.addEventListener("controlstart", this.handleControlStart);
    this.controls.addEventListener("controlend", this.handleControlEnd);

    if (!this.paused) this.requestNextFrame();
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  getSnapshot(): ApplicationThreadCameraSnapshot {
    this.controls.getTarget(this.target, false);
    return {
      position: this.camera.position.toArray(),
      target: this.target.toArray(),
      fov: this.camera.fov,
      roll: this.roll,
      up: this.camera.up.toArray(),
      quaternion: this.camera.quaternion.toArray(),
    };
  }

  snapTo(
    position: ApplicationThreadCameraPoint,
    target: ApplicationThreadCameraPoint,
    spherical?: ApplicationThreadCameraSphericalTarget,
    animate = true
  ): Promise<void> {
    this.assertUsable();
    const nextPosition = readPoint(position, "position");
    const nextTarget = readPoint(target, "target");
    const transition = this.controls.setLookAt(
      nextPosition[0],
      nextPosition[1],
      nextPosition[2],
      nextTarget[0],
      nextTarget[1],
      nextTarget[2],
      animate
    );
    if (spherical) {
      void this.controls.rotateTo(spherical.azimuth, spherical.polar, false);
    }
    if (!animate) {
      this.controls.update(0);
      this.applyRoll();
      this.onChange?.(this.getSnapshot());
    }
    return transition;
  }

  setViewport(width: number, height: number): void {
    this.assertUsable();
    requireFinite(width, "width");
    requireFinite(height, "height");
    if (width <= 0 || height <= 0) {
      throw new RangeError(
        "Viewport width and height must be greater than zero."
      );
    }
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  setFov(fov: number): void {
    this.assertUsable();
    this.camera.fov = requireFinite(fov, "fov");
    this.camera.updateProjectionMatrix();
    this.onChange?.(this.getSnapshot());
  }

  setRoll(roll: number): void {
    this.assertUsable();
    this.roll = requireFinite(roll, "roll");
    this.applyRoll();
    this.onChange?.(this.getSnapshot());
  }

  setEnabled(enabled: boolean): void {
    this.assertUsable();
    this.controls.enabled = enabled;
  }

  setAutoRotate(enabled: boolean, speed?: number): void {
    this.assertUsable();
    this.autoRotate = enabled;
    if (speed != null) {
      this.autoRotateSpeed = requireFinite(speed, "autoRotateSpeed");
    }
  }

  pause(): void {
    if (this.disposed || this.paused) return;
    this.paused = true;
    this.previousFrameAt = null;
    if (this.frameHandle !== null) {
      this.frameScheduler.cancel(this.frameHandle);
      this.frameHandle = null;
    }
  }

  resume(): void {
    this.assertUsable();
    if (!this.paused) return;
    this.paused = false;
    this.previousFrameAt = null;
    this.requestNextFrame();
  }

  dispose(): void {
    if (this.disposed) return;
    if (this.frameHandle !== null) {
      this.frameScheduler.cancel(this.frameHandle);
      this.frameHandle = null;
    }
    this.controls.removeEventListener("controlstart", this.handleControlStart);
    this.controls.removeEventListener("controlend", this.handleControlEnd);
    this.controls.dispose();
    this.paused = true;
    this.disposed = true;
  }

  private requestNextFrame(): void {
    if (this.frameHandle !== null || this.paused || this.disposed) return;
    this.frameHandle = this.frameScheduler.request(this.updateFrame);
  }

  private applyRoll(): void {
    this.controls.getTarget(this.target, false);
    this.camera.up.copy(this.baseUp);
    this.camera.lookAt(this.target);
    if (this.roll !== 0) this.camera.rotateZ(this.roll);
    this.camera.updateMatrixWorld(true);
  }

  private assertUsable(): void {
    if (this.disposed) {
      throw new Error("ApplicationThreadCameraController is disposed.");
    }
  }
}

export function createApplicationThreadCameraController(
  element: HTMLElement,
  options: ApplicationThreadCameraControllerOptions
): ApplicationThreadCameraController {
  return new ApplicationThreadCameraController(element, options);
}

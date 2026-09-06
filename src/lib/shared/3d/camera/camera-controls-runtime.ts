import CameraControls from "camera-controls";
import {
  Box3,
  MathUtils,
  Matrix4,
  Quaternion,
  Raycaster,
  Sphere,
  Spherical,
  Vector2,
  Vector3,
  Vector4,
} from "three";

CameraControls.install({
  THREE: {
    Vector2,
    Vector3,
    Vector4,
    Quaternion,
    Matrix4,
    Spherical,
    Box3,
    Sphere,
    Raycaster,
    MathUtils,
  },
});

export type CameraRightDragAction = "pan" | "rotate" | "none";
export type CameraControlsMouseAction =
  | typeof CameraControls.ACTION.ROTATE
  | typeof CameraControls.ACTION.TRUCK
  | typeof CameraControls.ACTION.NONE;

export function resolveCameraControlsRightAction(
  rightDragAction: CameraRightDragAction | undefined,
  enablePan: boolean
): CameraControlsMouseAction {
  if (rightDragAction === "rotate") return CameraControls.ACTION.ROTATE;
  if (rightDragAction === "pan") return CameraControls.ACTION.TRUCK;
  if (rightDragAction === "none") return CameraControls.ACTION.NONE;
  return enablePan ? CameraControls.ACTION.TRUCK : CameraControls.ACTION.NONE;
}

export function applyCameraControlsInputActions(
  controls: CameraControls,
  rightAction: CameraControlsMouseAction,
  enablePan: boolean
): void {
  controls.mouseButtons.right = rightAction;
  controls.mouseButtons.middle = CameraControls.ACTION.DOLLY;
  controls.touches.two = enablePan
    ? CameraControls.ACTION.TOUCH_DOLLY_TRUCK
    : CameraControls.ACTION.TOUCH_DOLLY_ROTATE;
}

export { CameraControls };

export function configureViewerOrbitNavigation(controls: CameraControls): void {
  // Exploring a scene must not strand the camera at an empty, panned target.
  // Continue travelling past the orbit limits, toward the pointer/pinch centre.
  controls.infinityDolly = true;
  controls.dollyToCursor = true;
}

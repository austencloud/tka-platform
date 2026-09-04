import type { WorkerCameraSnapshot } from "../domain/worker-renderer-protocol";

export type WorkerPerformerInteractionBlocker =
  | "camera-unavailable"
  | "camera-invalid"
  | "camera-arbitration-unavailable"
  | "interaction-surface-unavailable"
  | "pointer-capture-unavailable"
  | "stage-bounds-invalid"
  | "ground-height-invalid"
  | "performer-count-invalid"
  | "performer-index-invalid"
  | "performer-position-invalid"
  | "badge-pick-target-unavailable"
  | "rendered-surface-anchor-unavailable";

export type WorkerPerformerInteractionCapability =
  | { supported: true }
  | {
      supported: false;
      blockers: readonly WorkerPerformerInteractionBlocker[];
    };

export interface WorkerPerformerInteractionCapabilityPerformer {
  index: number;
  position: { x: number; z: number };
  badgeVisible?: boolean;
  badgeWorldY?: number;
}

export interface WorkerPerformerInteractionCapabilityInput {
  camera: WorkerCameraSnapshot | null;
  cameraArbitrationAvailable: boolean;
  surfaceWidth: number;
  surfaceHeight: number;
  pointerCaptureAvailable: boolean;
  groundY: number;
  stageBounds: { width: number; depth: number; zOffset?: number };
  performers: readonly WorkerPerformerInteractionCapabilityPerformer[];
  viewerPerformerCount: number;
  requireRenderedSurfaceAnchors?: boolean;
}

function isFiniteTuple(
  value: readonly number[] | undefined,
  length: number
): boolean {
  return value?.length === length && value.every(Number.isFinite);
}

function isValidCamera(camera: WorkerCameraSnapshot): boolean {
  const upLengthSquared = camera.up
    ? camera.up.reduce((sum, value) => sum + value * value, 0)
    : 1;
  const quaternionLengthSquared = camera.quaternion
    ? camera.quaternion.reduce((sum, value) => sum + value * value, 0)
    : 1;
  const viewLengthSquared = camera.position.reduce((sum, value, index) => {
    const delta = value - camera.target[index];
    return sum + delta * delta;
  }, 0);
  return (
    isFiniteTuple(camera.position, 3) &&
    isFiniteTuple(camera.target, 3) &&
    (!camera.up || isFiniteTuple(camera.up, 3)) &&
    (!camera.quaternion || isFiniteTuple(camera.quaternion, 4)) &&
    upLengthSquared > 0 &&
    quaternionLengthSquared > 0 &&
    (camera.quaternion !== undefined || viewLengthSquared > 0) &&
    Number.isFinite(camera.fov) &&
    camera.fov > 0 &&
    camera.fov < 180
  );
}

/**
 * Refuse the worker path when the app cannot preserve the interaction the user
 * already has. A missing pointer capture or camera lock is not a degraded mode:
 * it turns a performer drag into a camera orbit or loses the drag off-canvas.
 */
export function assessWorkerPerformerInteractionCapability(
  input: WorkerPerformerInteractionCapabilityInput
): WorkerPerformerInteractionCapability {
  const blockers = new Set<WorkerPerformerInteractionBlocker>();

  if (!input.camera) blockers.add("camera-unavailable");
  else if (!isValidCamera(input.camera)) blockers.add("camera-invalid");
  if (!input.cameraArbitrationAvailable)
    blockers.add("camera-arbitration-unavailable");
  if (
    !Number.isFinite(input.surfaceWidth) ||
    !Number.isFinite(input.surfaceHeight) ||
    input.surfaceWidth <= 0 ||
    input.surfaceHeight <= 0
  ) {
    blockers.add("interaction-surface-unavailable");
  }
  if (!input.pointerCaptureAvailable)
    blockers.add("pointer-capture-unavailable");
  if (!Number.isFinite(input.groundY)) blockers.add("ground-height-invalid");

  const { width, depth, zOffset = 0 } = input.stageBounds;
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(depth) ||
    !Number.isFinite(zOffset) ||
    width <= 0 ||
    depth <= 0
  ) {
    blockers.add("stage-bounds-invalid");
  }

  const indices = new Set<number>();
  if (
    !Number.isInteger(input.viewerPerformerCount) ||
    input.viewerPerformerCount < 0
  ) {
    blockers.add("performer-count-invalid");
  }
  for (const performer of input.performers) {
    if (
      !Number.isInteger(performer.index) ||
      performer.index < 0 ||
      performer.index >= input.viewerPerformerCount ||
      indices.has(performer.index)
    ) {
      blockers.add("performer-index-invalid");
    }
    indices.add(performer.index);
    if (
      !Number.isFinite(performer.position.x) ||
      !Number.isFinite(performer.position.z)
    ) {
      blockers.add("performer-position-invalid");
    }
    if (performer.badgeVisible && !Number.isFinite(performer.badgeWorldY)) {
      blockers.add("badge-pick-target-unavailable");
    }
  }

  if (input.requireRenderedSurfaceAnchors)
    blockers.add("rendered-surface-anchor-unavailable");

  return blockers.size === 0
    ? { supported: true }
    : { supported: false, blockers: [...blockers] };
}

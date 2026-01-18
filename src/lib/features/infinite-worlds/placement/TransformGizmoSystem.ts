/**
 * TransformGizmoSystem
 *
 * Bridges Three.js TransformControls with the ECS.
 * Allows translate/rotate/scale of selected objects.
 */

import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import type { PerspectiveCamera, Scene, Object3D } from "three";
import {
  world,
  selectedObject,
  type Entity,
  type TransformGizmoComponent,
} from "../core/ecs-world";
import type { SystemContext } from "../core/systems";
import type { GizmoMode } from "./placement-state";

// ============================================================================
// TYPES
// ============================================================================

export interface TransformGizmoSystemState {
  controls: TransformControls | null;
  attachedEntity: Entity | null;
  mode: GizmoMode;
  isActive: boolean;
  isDragging: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

// ============================================================================
// SYSTEM STATE
// ============================================================================

/**
 * Create transform gizmo system state
 */
export function createTransformGizmoSystemState(): TransformGizmoSystemState {
  return {
    controls: null,
    attachedEntity: null,
    mode: "translate",
    isActive: false,
    isDragging: false,
  };
}

/**
 * Initialize transform controls
 */
export function initTransformControls(
  systemState: TransformGizmoSystemState,
  camera: PerspectiveCamera,
  canvas: HTMLCanvasElement,
  scene: Scene
): void {
  if (systemState.controls) {
    disposeTransformControls(systemState, scene);
  }

  const controls = new TransformControls(camera, canvas);
  controls.setMode("translate");
  controls.setSize(0.75);

  // Track drag state
  controls.addEventListener("dragging-changed", (event) => {
    systemState.isDragging = event.value as boolean;

    if (systemState.isDragging && systemState.onDragStart) {
      systemState.onDragStart();
    }

    if (!systemState.isDragging && systemState.onDragEnd) {
      systemState.onDragEnd();
    }
  });

  // Sync ECS transform when gizmo changes
  controls.addEventListener("objectChange", () => {
    syncTransformToECS(systemState);
  });

  scene.add(controls.getHelper());
  systemState.controls = controls;
}

/**
 * Dispose transform controls
 */
export function disposeTransformControls(
  systemState: TransformGizmoSystemState,
  scene: Scene
): void {
  if (systemState.controls) {
    scene.remove(systemState.controls.getHelper());
    systemState.controls.dispose();
    systemState.controls = null;
  }
  systemState.attachedEntity = null;
}

// ============================================================================
// ATTACHMENT
// ============================================================================

/**
 * Attach gizmo to an entity
 */
export function attachGizmo(
  systemState: TransformGizmoSystemState,
  entity: Entity
): void {
  if (!systemState.controls || !entity.mesh?.object3D) return;

  // Detach from previous
  if (systemState.attachedEntity !== entity) {
    detachGizmo(systemState);
  }

  // Attach to new
  systemState.controls.attach(entity.mesh.object3D);
  systemState.attachedEntity = entity;
  systemState.isActive = true;

  // Add transform gizmo component if not present
  if (!entity.transformGizmo) {
    entity.transformGizmo = {
      mode: systemState.mode,
      isActive: true,
    };
  } else {
    entity.transformGizmo.isActive = true;
  }
}

/**
 * Detach gizmo from current entity
 */
export function detachGizmo(systemState: TransformGizmoSystemState): void {
  if (systemState.attachedEntity?.transformGizmo) {
    systemState.attachedEntity.transformGizmo.isActive = false;
  }

  if (systemState.controls) {
    systemState.controls.detach();
  }

  systemState.attachedEntity = null;
  systemState.isActive = false;
}

// ============================================================================
// MODE SWITCHING
// ============================================================================

/**
 * Set gizmo mode (translate/rotate/scale)
 */
export function setGizmoMode(
  systemState: TransformGizmoSystemState,
  mode: GizmoMode
): void {
  systemState.mode = mode;

  if (systemState.controls) {
    systemState.controls.setMode(mode);
  }

  if (systemState.attachedEntity?.transformGizmo) {
    systemState.attachedEntity.transformGizmo.mode = mode;
  }
}

/**
 * Cycle through gizmo modes
 */
export function cycleGizmoMode(systemState: TransformGizmoSystemState): GizmoMode {
  const modes: GizmoMode[] = ["translate", "rotate", "scale"];
  const currentIndex = modes.indexOf(systemState.mode);
  const nextIndex = (currentIndex + 1) % modes.length;
  const nextMode = modes[nextIndex] ?? "translate";

  setGizmoMode(systemState, nextMode);
  return nextMode;
}

// ============================================================================
// TRANSFORM SYNC
// ============================================================================

/**
 * Sync Three.js transform to ECS component
 */
function syncTransformToECS(systemState: TransformGizmoSystemState): void {
  const entity = systemState.attachedEntity;
  if (!entity?.mesh?.object3D || !entity.transform) return;

  const obj = entity.mesh.object3D;

  // Position
  entity.transform.position[0] = obj.position.x;
  entity.transform.position[1] = obj.position.y;
  entity.transform.position[2] = obj.position.z;

  // Rotation (quaternion)
  entity.transform.rotation[0] = obj.quaternion.x;
  entity.transform.rotation[1] = obj.quaternion.y;
  entity.transform.rotation[2] = obj.quaternion.z;
  entity.transform.rotation[3] = obj.quaternion.w;

  // Scale
  entity.transform.scale[0] = obj.scale.x;
  entity.transform.scale[1] = obj.scale.y;
  entity.transform.scale[2] = obj.scale.z;

  // Mark as dirty for persistence
  if (entity.persistent) {
    entity.persistent.isDirty = true;
  }

  // Update lastModified
  if (entity.placeableObject) {
    entity.placeableObject.lastModified = Date.now();
  }
}

/**
 * Sync ECS transform to Three.js object
 */
export function syncECSToThreeJS(entity: Entity): void {
  if (!entity.mesh?.object3D || !entity.transform) return;

  const obj = entity.mesh.object3D;
  const t = entity.transform;

  obj.position.set(t.position[0] ?? 0, t.position[1] ?? 0, t.position[2] ?? 0);
  obj.quaternion.set(t.rotation[0] ?? 0, t.rotation[1] ?? 0, t.rotation[2] ?? 0, t.rotation[3] ?? 1);
  obj.scale.set(t.scale[0] ?? 1, t.scale[1] ?? 1, t.scale[2] ?? 1);
}

// ============================================================================
// KEYBOARD INPUT
// ============================================================================

/**
 * Handle keyboard shortcuts for gizmo
 * W = translate, E = rotate, R = scale
 */
export function handleGizmoKeydown(
  systemState: TransformGizmoSystemState,
  key: string
): boolean {
  const keyLower = key.toLowerCase();

  switch (keyLower) {
    case "w":
      setGizmoMode(systemState, "translate");
      return true;
    case "e":
      setGizmoMode(systemState, "rotate");
      return true;
    case "r":
      setGizmoMode(systemState, "scale");
      return true;
    default:
      return false;
  }
}

// ============================================================================
// SYSTEM RUNNER
// ============================================================================

/**
 * Run transform gizmo system for one frame
 */
export function transformGizmoSystem(
  ctx: SystemContext,
  systemState: TransformGizmoSystemState
): void {
  // Nothing to do each frame - gizmo is event-driven
  // Just ensure gizmo is visible when entity is selected

  // Auto-attach to selected entities with transform gizmo
  for (const entity of selectedObject.entities) {
    if (entity.transformGizmo?.isActive && entity !== systemState.attachedEntity) {
      attachGizmo(systemState, entity);
    }
  }
}

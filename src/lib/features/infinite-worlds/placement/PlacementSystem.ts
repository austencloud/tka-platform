/**
 * PlacementSystem
 *
 * Handles ghost preview and click-to-place functionality.
 * Creates preview entities that follow the cursor, validates placement,
 * and spawns permanent objects on click.
 */

import { Raycaster, Vector2, Vector3, type Mesh, type Scene, type PerspectiveCamera } from "three";
import {
  world,
  createTransform,
  ghostEntities,
  type Entity,
  type MeshComponent,
  type GhostPreviewComponent,
} from "../core/ecs-world";
import type { SystemContext } from "../core/systems";
import type { PlacementState } from "./placement-state";
import { getObjectDefinition } from "../objects/object-catalog";
import { getPlacedObjectRenderer } from "../objects/PlacedObjectRenderer";

// ============================================================================
// TYPES
// ============================================================================

export interface PlacementSystemState {
  ghostEntity: Entity | null;
  raycaster: Raycaster;
  mouseNDC: Vector2;
  intersectionPoint: Vector3;
  isMouseDown: boolean;
  terrainMesh: Mesh | null;
}

// ============================================================================
// SYSTEM STATE
// ============================================================================

/**
 * Create placement system state
 */
export function createPlacementSystemState(): PlacementSystemState {
  return {
    ghostEntity: null,
    raycaster: new Raycaster(),
    mouseNDC: new Vector2(),
    intersectionPoint: new Vector3(),
    isMouseDown: false,
    terrainMesh: null,
  };
}

/**
 * Set terrain mesh for raycasting
 */
export function setTerrainMesh(
  systemState: PlacementSystemState,
  mesh: Mesh | null
): void {
  systemState.terrainMesh = mesh;
}

// ============================================================================
// GHOST PREVIEW
// ============================================================================

/**
 * Create or update ghost preview entity
 */
export function updateGhostPreview(
  systemState: PlacementSystemState,
  placementState: PlacementState,
  scene: Scene
): void {
  const { selectedObjectKey, mode } = placementState;

  // Remove ghost if not in placement mode
  if (mode !== "placing" || !selectedObjectKey) {
    removeGhostPreview(systemState, scene);
    return;
  }

  // Create ghost if needed
  if (!systemState.ghostEntity) {
    createGhostPreview(systemState, selectedObjectKey, scene);
  }

  // Update ghost position to intersection point
  if (systemState.ghostEntity?.transform) {
    systemState.ghostEntity.transform.position[0] = systemState.intersectionPoint.x;
    systemState.ghostEntity.transform.position[1] = systemState.intersectionPoint.y;
    systemState.ghostEntity.transform.position[2] = systemState.intersectionPoint.z;
  }
}

/**
 * Create ghost preview entity
 */
function createGhostPreview(
  systemState: PlacementSystemState,
  objectKey: string,
  scene: Scene
): void {
  const definition = getObjectDefinition(objectKey);
  if (!definition) return;

  const renderer = getPlacedObjectRenderer();
  const mesh = renderer.createPreviewMesh(objectKey);
  if (!mesh) return;

  // Make mesh semi-transparent
  if (mesh.material) {
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (mat && "opacity" in mat) {
      mat.transparent = true;
      mat.opacity = 0.5;
    }
  }

  scene.add(mesh);

  const entity: Entity = {
    id: `ghost-${Date.now()}`,
    transform: createTransform(0, 0, 0),
    mesh: {
      object3D: mesh,
      visible: true,
      castShadow: false,
      receiveShadow: false,
    },
    ghostPreview: {
      sourceModelKey: objectKey,
      opacity: 0.5,
      isValid: true,
    },
  };

  systemState.ghostEntity = world.add(entity);
}

/**
 * Remove ghost preview entity
 */
function removeGhostPreview(
  systemState: PlacementSystemState,
  scene: Scene
): void {
  if (!systemState.ghostEntity) return;

  if (systemState.ghostEntity.mesh?.object3D) {
    scene.remove(systemState.ghostEntity.mesh.object3D);
  }

  world.remove(systemState.ghostEntity);
  systemState.ghostEntity = null;
}

// ============================================================================
// RAYCASTING
// ============================================================================

/**
 * Update raycast intersection with terrain
 */
export function updateRaycastIntersection(
  systemState: PlacementSystemState,
  camera: PerspectiveCamera
): boolean {
  if (!systemState.terrainMesh) return false;

  systemState.raycaster.setFromCamera(systemState.mouseNDC, camera);
  const intersects = systemState.raycaster.intersectObject(systemState.terrainMesh);

  if (intersects.length > 0 && intersects[0]) {
    systemState.intersectionPoint.copy(intersects[0].point);
    return true;
  }

  return false;
}

/**
 * Update mouse position from event
 */
export function updateMousePosition(
  systemState: PlacementSystemState,
  event: MouseEvent,
  canvas: HTMLCanvasElement
): void {
  const rect = canvas.getBoundingClientRect();
  systemState.mouseNDC.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  systemState.mouseNDC.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

// ============================================================================
// PLACEMENT
// ============================================================================

/**
 * Place object at current intersection point
 * Returns the created entity or null if placement failed
 */
export function placeObject(
  systemState: PlacementSystemState,
  placementState: PlacementState,
  scene: Scene,
  userId: string
): Entity | null {
  const { selectedObjectKey, mode, sceneId } = placementState;

  if (mode !== "placing" || !selectedObjectKey) return null;

  const definition = getObjectDefinition(selectedObjectKey);
  if (!definition) return null;

  const renderer = getPlacedObjectRenderer();
  const mesh = renderer.createMesh(selectedObjectKey);
  if (!mesh) return null;

  // Position mesh
  mesh.position.copy(systemState.intersectionPoint);
  scene.add(mesh);

  // Create entity
  const now = Date.now();
  const entity: Entity = {
    id: `placed-${now}`,
    transform: createTransform(
      systemState.intersectionPoint.x,
      systemState.intersectionPoint.y,
      systemState.intersectionPoint.z
    ),
    mesh: {
      object3D: mesh,
      visible: true,
      castShadow: true,
      receiveShadow: true,
    },
    placeableObject: {
      objectType: definition.category,
      modelKey: selectedObjectKey,
      sceneId,
      label: definition.name,
      locked: false,
      createdAt: now,
      lastModified: now,
      userId,
    },
    selectable: {
      isSelected: false,
      isHovered: false,
      selectionPriority: 1,
    },
    persistent: {
      storageKey: `${sceneId}-${now}`,
      isDirty: true,
      lastSaved: 0,
    },
    isActive: true,
  };

  return world.add(entity);
}

// ============================================================================
// SYSTEM RUNNER
// ============================================================================

/**
 * Run placement system for one frame
 */
export function placementSystem(
  ctx: SystemContext,
  systemState: PlacementSystemState,
  placementState: PlacementState
): void {
  // Update raycast each frame
  updateRaycastIntersection(systemState, ctx.camera);

  // Update ghost preview
  updateGhostPreview(systemState, placementState, ctx.scene);

  // Sync ghost mesh position
  for (const entity of ghostEntities.entities) {
    if (entity.mesh?.object3D && entity.transform) {
      entity.mesh.object3D.position.set(
        entity.transform.position[0] ?? 0,
        entity.transform.position[1] ?? 0,
        entity.transform.position[2] ?? 0
      );
    }
  }
}

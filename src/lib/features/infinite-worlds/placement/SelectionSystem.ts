/**
 * SelectionSystem
 *
 * Handles hover detection and click-to-select for placed objects.
 * Updates selectable components based on cursor intersection.
 */

import { Raycaster, Vector2, type PerspectiveCamera, type Object3D } from "three";
import {
  world,
  selectableObjects,
  type Entity,
} from "../core/ecs-world";
import type { SystemContext } from "../core/systems";
import type { SelectionState } from "./placement-state";

// ============================================================================
// TYPES
// ============================================================================

export interface SelectionSystemState {
  raycaster: Raycaster;
  mouseNDC: Vector2;
  hoveredEntity: Entity | null;
  selectedEntities: Entity[];
}

// ============================================================================
// SYSTEM STATE
// ============================================================================

/**
 * Create selection system state
 */
export function createSelectionSystemState(): SelectionSystemState {
  return {
    raycaster: new Raycaster(),
    mouseNDC: new Vector2(),
    hoveredEntity: null,
    selectedEntities: [],
  };
}

// ============================================================================
// HOVER DETECTION
// ============================================================================

/**
 * Update hover detection for selectable objects
 */
export function updateHoverDetection(
  systemState: SelectionSystemState,
  camera: PerspectiveCamera
): Entity | null {
  systemState.raycaster.setFromCamera(systemState.mouseNDC, camera);

  // Collect all selectable meshes
  const meshes: Object3D[] = [];
  const entityMap = new Map<Object3D, Entity>();

  for (const entity of selectableObjects.entities) {
    if (entity.mesh?.object3D && entity.mesh.visible) {
      meshes.push(entity.mesh.object3D);
      entityMap.set(entity.mesh.object3D, entity);
    }
  }

  if (meshes.length === 0) {
    clearHoverState(systemState);
    return null;
  }

  // Raycast against selectable meshes
  const intersects = systemState.raycaster.intersectObjects(meshes, true);

  if (intersects.length === 0) {
    clearHoverState(systemState);
    return null;
  }

  // Find the entity for the first intersection
  const firstIntersect = intersects[0];
  if (!firstIntersect) {
    clearHoverState(systemState);
    return null;
  }

  // Walk up the parent chain to find the root mesh we registered
  let obj: Object3D | null = firstIntersect.object;
  let foundEntity: Entity | null = null;

  while (obj) {
    const entity = entityMap.get(obj);
    if (entity) {
      foundEntity = entity;
      break;
    }
    obj = obj.parent;
  }

  if (foundEntity) {
    setHoverState(systemState, foundEntity);
    return foundEntity;
  }

  clearHoverState(systemState);
  return null;
}

/**
 * Set hover state for an entity
 */
function setHoverState(
  systemState: SelectionSystemState,
  entity: Entity
): void {
  // Clear previous hover
  if (systemState.hoveredEntity && systemState.hoveredEntity !== entity) {
    if (systemState.hoveredEntity.selectable) {
      systemState.hoveredEntity.selectable.isHovered = false;
    }
  }

  // Set new hover
  systemState.hoveredEntity = entity;
  if (entity.selectable) {
    entity.selectable.isHovered = true;
  }
}

/**
 * Clear hover state
 */
function clearHoverState(systemState: SelectionSystemState): void {
  if (systemState.hoveredEntity?.selectable) {
    systemState.hoveredEntity.selectable.isHovered = false;
  }
  systemState.hoveredEntity = null;
}

// ============================================================================
// SELECTION
// ============================================================================

/**
 * Select an entity (single selection)
 */
export function selectEntity(
  systemState: SelectionSystemState,
  entity: Entity | null
): void {
  // Deselect all currently selected
  for (const selected of systemState.selectedEntities) {
    if (selected.selectable) {
      selected.selectable.isSelected = false;
    }
  }
  systemState.selectedEntities = [];

  // Select new entity
  if (entity) {
    systemState.selectedEntities = [entity];
    if (entity.selectable) {
      entity.selectable.isSelected = true;
    }
  }
}

/**
 * Toggle selection for an entity (multi-select support)
 */
export function toggleSelection(
  systemState: SelectionSystemState,
  entity: Entity
): void {
  const index = systemState.selectedEntities.indexOf(entity);

  if (index >= 0) {
    // Deselect
    systemState.selectedEntities.splice(index, 1);
    if (entity.selectable) {
      entity.selectable.isSelected = false;
    }
  } else {
    // Select
    systemState.selectedEntities.push(entity);
    if (entity.selectable) {
      entity.selectable.isSelected = true;
    }
  }
}

/**
 * Clear all selections
 */
export function clearSelection(systemState: SelectionSystemState): void {
  for (const entity of systemState.selectedEntities) {
    if (entity.selectable) {
      entity.selectable.isSelected = false;
    }
  }
  systemState.selectedEntities = [];
}

/**
 * Get the currently selected entity (first one if multi-select)
 */
export function getSelectedEntity(
  systemState: SelectionSystemState
): Entity | null {
  return systemState.selectedEntities[0] ?? null;
}

/**
 * Check if an entity is selected
 */
export function isSelected(
  systemState: SelectionSystemState,
  entity: Entity
): boolean {
  return systemState.selectedEntities.includes(entity);
}

// ============================================================================
// DELETION
// ============================================================================

/**
 * Delete currently selected entities
 */
export function deleteSelected(
  systemState: SelectionSystemState,
  onDelete?: (entity: Entity) => void
): Entity[] {
  const deleted = [...systemState.selectedEntities];

  for (const entity of deleted) {
    if (onDelete) {
      onDelete(entity);
    }
    world.remove(entity);
  }

  systemState.selectedEntities = [];
  return deleted;
}

// ============================================================================
// MOUSE INPUT
// ============================================================================

/**
 * Update mouse position from event
 */
export function updateMousePosition(
  systemState: SelectionSystemState,
  event: MouseEvent,
  canvas: HTMLCanvasElement
): void {
  const rect = canvas.getBoundingClientRect();
  systemState.mouseNDC.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  systemState.mouseNDC.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

// ============================================================================
// SYSTEM RUNNER
// ============================================================================

/**
 * Run selection system for one frame
 */
export function selectionSystem(
  ctx: SystemContext,
  systemState: SelectionSystemState,
  selectionState: SelectionState
): void {
  // Update hover detection
  const hovered = updateHoverDetection(systemState, ctx.camera);
  selectionState.hovered = hovered;

  // Sync selected array
  selectionState.selected = [...systemState.selectedEntities];
}

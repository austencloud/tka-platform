/**
 * Placement State
 *
 * Shared reactive state for object placement and selection systems.
 * Centralizes placement mode, selected object, and UI state.
 */

import type { Entity } from "../core/ecs-world";

// ============================================================================
// TYPES
// ============================================================================

export type PlacementMode = "none" | "placing" | "selecting" | "transforming";

export type GizmoMode = "translate" | "rotate" | "scale";

export interface PlacementState {
  /** Current placement mode */
  mode: PlacementMode;
  /** Currently selected object key (for quick-select) */
  selectedObjectKey: string | null;
  /** Currently hovered entity */
  hoveredEntity: Entity | null;
  /** Currently selected entity */
  selectedEntity: Entity | null;
  /** Transform gizmo mode */
  gizmoMode: GizmoMode;
  /** Whether placement is valid at current position */
  isValidPlacement: boolean;
  /** Current scene/realm ID */
  sceneId: string;
}

export interface SelectionState {
  /** Currently hovered entity */
  hovered: Entity | null;
  /** Currently selected entities (multi-select support) */
  selected: Entity[];
  /** Whether a drag operation is in progress */
  isDragging: boolean;
}

export interface BoundaryState {
  /** Whether boundary editing is active */
  isEditing: boolean;
  /** Current boundary ID being edited */
  activeBoundaryId: string | null;
  /** Points in the current boundary */
  points: Array<{ x: number; z: number }>;
  /** Whether the boundary is closed */
  isClosed: boolean;
}

// ============================================================================
// STATE INSTANCES
// ============================================================================

/**
 * Create initial placement state
 */
export function createPlacementState(sceneId: string = "default"): PlacementState {
  return {
    mode: "none",
    selectedObjectKey: null,
    hoveredEntity: null,
    selectedEntity: null,
    gizmoMode: "translate",
    isValidPlacement: true,
    sceneId,
  };
}

/**
 * Create initial selection state
 */
export function createSelectionState(): SelectionState {
  return {
    hovered: null,
    selected: [],
    isDragging: false,
  };
}

/**
 * Create initial boundary state
 */
export function createBoundaryState(): BoundaryState {
  return {
    isEditing: false,
    activeBoundaryId: null,
    points: [],
    isClosed: false,
  };
}

// ============================================================================
// STATE MUTATIONS
// ============================================================================

/**
 * Enter placement mode with a specific object type
 */
export function enterPlacementMode(
  state: PlacementState,
  objectKey: string
): PlacementState {
  return {
    ...state,
    mode: "placing",
    selectedObjectKey: objectKey,
    selectedEntity: null,
  };
}

/**
 * Exit placement mode
 */
export function exitPlacementMode(state: PlacementState): PlacementState {
  return {
    ...state,
    mode: "none",
    selectedObjectKey: null,
  };
}

/**
 * Select an entity
 */
export function selectEntity(
  state: PlacementState,
  entity: Entity | null
): PlacementState {
  return {
    ...state,
    mode: entity ? "selecting" : "none",
    selectedEntity: entity,
  };
}

/**
 * Set gizmo mode
 */
export function setGizmoMode(
  state: PlacementState,
  mode: GizmoMode
): PlacementState {
  return {
    ...state,
    gizmoMode: mode,
    mode: state.selectedEntity ? "transforming" : state.mode,
  };
}

/**
 * Update hovered entity
 */
export function setHoveredEntity(
  state: PlacementState,
  entity: Entity | null
): PlacementState {
  return {
    ...state,
    hoveredEntity: entity,
  };
}

// ============================================================================
// PERSISTENCE KEYS
// ============================================================================

/**
 * Get localStorage key for placed objects in a scene
 */
export function getStorageKey(sceneId: string): string {
  return `tka-worlds-objects-${sceneId}`;
}

/**
 * Get localStorage key for boundary data in a scene
 */
export function getBoundaryStorageKey(sceneId: string): string {
  return `tka-worlds-boundary-${sceneId}`;
}

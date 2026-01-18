/**
 * BoundarySystem
 *
 * Handles polygon boundary drawing and editing.
 * Creates visual markers and line segments for defining areas.
 */

import {
  SphereGeometry,
  MeshBasicMaterial,
  Mesh,
  LineBasicMaterial,
  BufferGeometry,
  Line,
  Vector3,
  Group,
  type Scene,
} from "three";
import {
  world,
  createTransform,
  boundaryPoints,
  boundaryPolygons,
  type Entity,
} from "../core/ecs-world";
import type { SystemContext } from "../core/systems";
import type { BoundaryState } from "./placement-state";
import { getBoundaryStorageKey } from "./placement-state";

// ============================================================================
// CONSTANTS
// ============================================================================

const MARKER_RADIUS = 0.5;
const MARKER_COLOR = 0xff6600;
const MARKER_HOVER_COLOR = 0xffaa00;
const LINE_COLOR = 0xff6600;
const LINE_WIDTH = 2;

// ============================================================================
// TYPES
// ============================================================================

export interface BoundarySystemState {
  markers: Map<number, Mesh>;
  lineGroup: Group | null;
  previewLine: Line | null;
  boundaryId: string;
  scene: Scene | null;
}

export interface SerializedBoundary {
  id: string;
  points: Array<{ x: number; z: number }>;
  isClosed: boolean;
  savedAt: number;
}

// ============================================================================
// SYSTEM STATE
// ============================================================================

/**
 * Create boundary system state
 */
export function createBoundarySystemState(boundaryId: string = "default"): BoundarySystemState {
  return {
    markers: new Map(),
    lineGroup: null,
    previewLine: null,
    boundaryId,
    scene: null,
  };
}

/**
 * Initialize boundary system with scene
 */
export function initBoundarySystem(
  systemState: BoundarySystemState,
  scene: Scene
): void {
  systemState.scene = scene;

  // Create line group
  systemState.lineGroup = new Group();
  systemState.lineGroup.name = "boundary-lines";
  scene.add(systemState.lineGroup);
}

/**
 * Dispose boundary system
 */
export function disposeBoundarySystem(systemState: BoundarySystemState): void {
  if (!systemState.scene) return;

  // Remove all markers
  for (const marker of systemState.markers.values()) {
    systemState.scene.remove(marker);
    marker.geometry.dispose();
    if (Array.isArray(marker.material)) {
      marker.material.forEach((m) => m.dispose());
    } else {
      marker.material.dispose();
    }
  }
  systemState.markers.clear();

  // Remove line group
  if (systemState.lineGroup) {
    systemState.scene.remove(systemState.lineGroup);
    systemState.lineGroup = null;
  }

  // Remove preview line
  if (systemState.previewLine) {
    systemState.scene.remove(systemState.previewLine);
    systemState.previewLine = null;
  }
}

// ============================================================================
// MARKER MANAGEMENT
// ============================================================================

/**
 * Add a boundary point
 */
export function addBoundaryPoint(
  systemState: BoundarySystemState,
  boundaryState: BoundaryState,
  x: number,
  z: number,
  y: number = 0
): Entity | null {
  if (!systemState.scene) return null;

  const index = boundaryState.points.length;

  // Add to state
  boundaryState.points.push({ x, z });

  // Create marker mesh
  const geometry = new SphereGeometry(MARKER_RADIUS, 16, 16);
  const material = new MeshBasicMaterial({ color: MARKER_COLOR });
  const marker = new Mesh(geometry, material);
  marker.position.set(x, y + MARKER_RADIUS, z);
  marker.name = `boundary-marker-${index}`;

  systemState.scene.add(marker);
  systemState.markers.set(index, marker);

  // Create ECS entity
  const entity: Entity = {
    id: `boundary-point-${systemState.boundaryId}-${index}`,
    transform: createTransform(x, y + MARKER_RADIUS, z),
    mesh: {
      object3D: marker,
      visible: true,
      castShadow: false,
      receiveShadow: false,
    },
    boundaryPoint: {
      index,
      boundaryId: systemState.boundaryId,
    },
    isActive: true,
  };

  // Update lines
  updateBoundaryLines(systemState, boundaryState);

  return world.add(entity);
}

/**
 * Remove a boundary point by index
 */
export function removeBoundaryPoint(
  systemState: BoundarySystemState,
  boundaryState: BoundaryState,
  index: number
): void {
  if (index < 0 || index >= boundaryState.points.length) return;

  // Remove from state
  boundaryState.points.splice(index, 1);

  // Remove marker mesh
  const marker = systemState.markers.get(index);
  if (marker && systemState.scene) {
    systemState.scene.remove(marker);
    marker.geometry.dispose();
    if (Array.isArray(marker.material)) {
      marker.material.forEach((m) => m.dispose());
    } else {
      marker.material.dispose();
    }
  }
  systemState.markers.delete(index);

  // Re-index remaining markers
  const newMarkers = new Map<number, Mesh>();
  let newIndex = 0;
  for (const [oldIndex, mesh] of systemState.markers) {
    if (oldIndex > index) {
      newMarkers.set(newIndex, mesh);
      mesh.name = `boundary-marker-${newIndex}`;
      newIndex++;
    } else {
      newMarkers.set(oldIndex, mesh);
    }
  }
  systemState.markers = newMarkers;

  // Remove ECS entities and recreate
  for (const entity of boundaryPoints.entities) {
    if (entity.boundaryPoint?.boundaryId === systemState.boundaryId) {
      world.remove(entity);
    }
  }

  // Update lines
  updateBoundaryLines(systemState, boundaryState);
}

/**
 * Move a boundary point
 */
export function moveBoundaryPoint(
  systemState: BoundarySystemState,
  boundaryState: BoundaryState,
  index: number,
  x: number,
  z: number
): void {
  if (index < 0 || index >= boundaryState.points.length) return;

  // Update state
  const point = boundaryState.points[index];
  if (point) {
    point.x = x;
    point.z = z;
  }

  // Update marker position
  const marker = systemState.markers.get(index);
  if (marker) {
    marker.position.x = x;
    marker.position.z = z;
  }

  // Update ECS entities
  for (const entity of boundaryPoints.entities) {
    if (
      entity.boundaryPoint?.boundaryId === systemState.boundaryId &&
      entity.boundaryPoint?.index === index
    ) {
      if (entity.transform) {
        entity.transform.position[0] = x;
        entity.transform.position[2] = z;
      }
    }
  }

  // Update lines
  updateBoundaryLines(systemState, boundaryState);
}

// ============================================================================
// LINE MANAGEMENT
// ============================================================================

/**
 * Update boundary lines based on current points
 */
function updateBoundaryLines(
  systemState: BoundarySystemState,
  boundaryState: BoundaryState
): void {
  if (!systemState.lineGroup) return;

  // Clear existing lines
  while (systemState.lineGroup.children.length > 0) {
    const child = systemState.lineGroup.children[0];
    if (child) {
      systemState.lineGroup.remove(child);
      if (child instanceof Line) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
  }

  if (boundaryState.points.length < 2) return;

  // Create line segments
  const points: Vector3[] = boundaryState.points.map(
    (p) => new Vector3(p.x, MARKER_RADIUS, p.z)
  );

  // Close the polygon if needed
  if (boundaryState.isClosed && points.length >= 3) {
    const first = points[0];
    if (first) {
      points.push(first.clone());
    }
  }

  const geometry = new BufferGeometry().setFromPoints(points);
  const material = new LineBasicMaterial({
    color: LINE_COLOR,
    linewidth: LINE_WIDTH,
  });
  const line = new Line(geometry, material);
  line.name = "boundary-line";

  systemState.lineGroup.add(line);
}

/**
 * Close the boundary polygon
 */
export function closeBoundary(
  systemState: BoundarySystemState,
  boundaryState: BoundaryState
): void {
  if (boundaryState.points.length < 3) return;

  boundaryState.isClosed = true;
  updateBoundaryLines(systemState, boundaryState);

  // Create polygon entity
  const entity: Entity = {
    id: `boundary-polygon-${systemState.boundaryId}`,
    boundaryPolygon: {
      boundaryId: systemState.boundaryId,
      isClosed: true,
      pointCount: boundaryState.points.length,
    },
    isActive: true,
  };

  world.add(entity);
}

/**
 * Clear all boundary points
 */
export function clearBoundary(
  systemState: BoundarySystemState,
  boundaryState: BoundaryState
): void {
  // Clear state
  boundaryState.points = [];
  boundaryState.isClosed = false;

  // Remove all markers
  if (systemState.scene) {
    for (const marker of systemState.markers.values()) {
      systemState.scene.remove(marker);
      marker.geometry.dispose();
      if (Array.isArray(marker.material)) {
        marker.material.forEach((m) => m.dispose());
      } else {
        marker.material.dispose();
      }
    }
  }
  systemState.markers.clear();

  // Clear lines
  if (systemState.lineGroup) {
    while (systemState.lineGroup.children.length > 0) {
      const child = systemState.lineGroup.children[0];
      if (child) {
        systemState.lineGroup.remove(child);
      }
    }
  }

  // Remove ECS entities
  for (const entity of boundaryPoints.entities) {
    if (entity.boundaryPoint?.boundaryId === systemState.boundaryId) {
      world.remove(entity);
    }
  }

  for (const entity of boundaryPolygons.entities) {
    if (entity.boundaryPolygon?.boundaryId === systemState.boundaryId) {
      world.remove(entity);
    }
  }
}

// ============================================================================
// PERSISTENCE
// ============================================================================

/**
 * Save boundary to localStorage
 */
export function saveBoundary(
  systemState: BoundarySystemState,
  boundaryState: BoundaryState,
  sceneId: string
): void {
  const data: SerializedBoundary = {
    id: systemState.boundaryId,
    points: [...boundaryState.points],
    isClosed: boundaryState.isClosed,
    savedAt: Date.now(),
  };

  const key = getBoundaryStorageKey(sceneId);
  localStorage.setItem(key, JSON.stringify(data));

  console.log(`[BoundarySystem] Saved ${data.points.length} points to ${key}`);
}

/**
 * Load boundary from localStorage
 */
export function loadBoundary(
  systemState: BoundarySystemState,
  boundaryState: BoundaryState,
  sceneId: string
): boolean {
  const key = getBoundaryStorageKey(sceneId);
  const raw = localStorage.getItem(key);

  if (!raw) return false;

  try {
    const data = JSON.parse(raw) as SerializedBoundary;

    // Clear existing
    clearBoundary(systemState, boundaryState);

    // Recreate points
    for (const point of data.points) {
      addBoundaryPoint(systemState, boundaryState, point.x, point.z);
    }

    if (data.isClosed) {
      closeBoundary(systemState, boundaryState);
    }

    console.log(`[BoundarySystem] Loaded ${data.points.length} points from ${key}`);
    return true;
  } catch (error) {
    console.error("[BoundarySystem] Failed to load:", error);
    return false;
  }
}

// ============================================================================
// SYSTEM RUNNER
// ============================================================================

/**
 * Run boundary system for one frame
 */
export function boundarySystem(
  ctx: SystemContext,
  systemState: BoundarySystemState,
  boundaryState: BoundaryState
): void {
  // Sync marker positions from ECS transforms
  for (const entity of boundaryPoints.entities) {
    if (
      entity.boundaryPoint?.boundaryId === systemState.boundaryId &&
      entity.mesh?.object3D &&
      entity.transform
    ) {
      entity.mesh.object3D.position.set(
        entity.transform.position[0] ?? 0,
        entity.transform.position[1] ?? 0,
        entity.transform.position[2] ?? 0
      );
    }
  }
}

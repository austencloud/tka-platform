/**
 * PersistenceSystem
 *
 * Handles save/load of placed objects to localStorage.
 * Automatically saves dirty entities and restores state on load.
 */

import type { Scene } from "three";
import {
  world,
  persistentEntities,
  createTransform,
  type Entity,
  type PlaceableObjectComponent,
  type TransformComponent,
} from "../core/ecs-world";
import type { SystemContext } from "../core/systems";
import { getStorageKey } from "./placement-state";
import { getPlacedObjectRenderer } from "../objects/PlacedObjectRenderer";

// ============================================================================
// TYPES
// ============================================================================

export interface SerializedObject {
  id: string;
  objectType: string;
  modelKey: string;
  label?: string;
  locked: boolean;
  createdAt: number;
  lastModified: number;
  userId: string;
  transform: {
    position: [number, number, number];
    rotation: [number, number, number, number];
    scale: [number, number, number];
  };
}

export interface SerializedScene {
  version: number;
  sceneId: string;
  savedAt: number;
  objects: SerializedObject[];
}

export interface PersistenceSystemState {
  sceneId: string;
  lastSaveTime: number;
  saveIntervalMs: number;
  isDirty: boolean;
}

// ============================================================================
// SYSTEM STATE
// ============================================================================

const CURRENT_VERSION = 1;

/**
 * Create persistence system state
 */
export function createPersistenceSystemState(
  sceneId: string
): PersistenceSystemState {
  return {
    sceneId,
    lastSaveTime: 0,
    saveIntervalMs: 5000, // Auto-save every 5 seconds
    isDirty: false,
  };
}

// ============================================================================
// SERIALIZATION
// ============================================================================

/**
 * Serialize an entity to storable format
 */
function serializeEntity(entity: Entity): SerializedObject | null {
  if (!entity.placeableObject || !entity.transform || !entity.id) {
    return null;
  }

  const p = entity.placeableObject;
  const t = entity.transform;

  return {
    id: entity.id,
    objectType: p.objectType,
    modelKey: p.modelKey,
    label: p.label,
    locked: p.locked,
    createdAt: p.createdAt,
    lastModified: p.lastModified,
    userId: p.userId,
    transform: {
      position: [t.position[0] ?? 0, t.position[1] ?? 0, t.position[2] ?? 0],
      rotation: [
        t.rotation[0] ?? 0,
        t.rotation[1] ?? 0,
        t.rotation[2] ?? 0,
        t.rotation[3] ?? 1,
      ],
      scale: [t.scale[0] ?? 1, t.scale[1] ?? 1, t.scale[2] ?? 1],
    },
  };
}

/**
 * Serialize all persistent entities
 */
function serializeScene(sceneId: string): SerializedScene {
  const objects: SerializedObject[] = [];

  for (const entity of persistentEntities.entities) {
    const serialized = serializeEntity(entity);
    if (serialized) {
      objects.push(serialized);
    }
  }

  return {
    version: CURRENT_VERSION,
    sceneId,
    savedAt: Date.now(),
    objects,
  };
}

// ============================================================================
// STORAGE OPERATIONS
// ============================================================================

/**
 * Save scene to localStorage
 */
export function saveScene(systemState: PersistenceSystemState): boolean {
  try {
    const data = serializeScene(systemState.sceneId);
    const key = getStorageKey(systemState.sceneId);

    localStorage.setItem(key, JSON.stringify(data));

    // Clear dirty flags
    for (const entity of persistentEntities.entities) {
      if (entity.persistent) {
        entity.persistent.isDirty = false;
        entity.persistent.lastSaved = data.savedAt;
      }
    }

    systemState.lastSaveTime = data.savedAt;
    systemState.isDirty = false;

    console.log(`[PersistenceSystem] Saved ${data.objects.length} objects to ${key}`);
    return true;
  } catch (error) {
    console.error("[PersistenceSystem] Failed to save:", error);
    return false;
  }
}

/**
 * Load scene from localStorage
 */
export function loadScene(
  systemState: PersistenceSystemState,
  scene: Scene
): Entity[] {
  const key = getStorageKey(systemState.sceneId);
  const raw = localStorage.getItem(key);

  if (!raw) {
    console.log(`[PersistenceSystem] No saved data for ${key}`);
    return [];
  }

  try {
    const data = JSON.parse(raw) as SerializedScene;

    // Version migration if needed
    if (data.version !== CURRENT_VERSION) {
      console.warn(`[PersistenceSystem] Version mismatch: ${data.version} vs ${CURRENT_VERSION}`);
      // Future: migrate data
    }

    const entities: Entity[] = [];
    const renderer = getPlacedObjectRenderer();

    for (const obj of data.objects) {
      const entity = deserializeObject(obj, scene, renderer, systemState.sceneId);
      if (entity) {
        entities.push(entity);
      }
    }

    console.log(`[PersistenceSystem] Loaded ${entities.length} objects from ${key}`);
    return entities;
  } catch (error) {
    console.error("[PersistenceSystem] Failed to load:", error);
    return [];
  }
}

/**
 * Deserialize and create an entity
 */
function deserializeObject(
  obj: SerializedObject,
  scene: Scene,
  renderer: ReturnType<typeof getPlacedObjectRenderer>,
  sceneId: string
): Entity | null {
  const mesh = renderer.createMesh(obj.modelKey);
  if (!mesh) {
    console.warn(`[PersistenceSystem] Unknown model: ${obj.modelKey}`);
    return null;
  }

  // Apply transform
  mesh.position.set(
    obj.transform.position[0],
    obj.transform.position[1],
    obj.transform.position[2]
  );
  mesh.quaternion.set(
    obj.transform.rotation[0],
    obj.transform.rotation[1],
    obj.transform.rotation[2],
    obj.transform.rotation[3]
  );
  mesh.scale.set(
    obj.transform.scale[0],
    obj.transform.scale[1],
    obj.transform.scale[2]
  );

  scene.add(mesh);

  // Create entity
  const transform = createTransform(
    obj.transform.position[0],
    obj.transform.position[1],
    obj.transform.position[2]
  );
  transform.rotation.set(obj.transform.rotation);
  transform.scale.set(obj.transform.scale);

  const entity: Entity = {
    id: obj.id,
    transform,
    mesh: {
      object3D: mesh,
      visible: true,
      castShadow: true,
      receiveShadow: true,
    },
    placeableObject: {
      objectType: obj.objectType,
      modelKey: obj.modelKey,
      sceneId,
      label: obj.label,
      locked: obj.locked,
      createdAt: obj.createdAt,
      lastModified: obj.lastModified,
      userId: obj.userId,
    },
    selectable: {
      isSelected: false,
      isHovered: false,
      selectionPriority: 1,
    },
    persistent: {
      storageKey: `${sceneId}-${obj.id}`,
      isDirty: false,
      lastSaved: Date.now(),
    },
    isActive: true,
  };

  return world.add(entity);
}

/**
 * Clear all saved data for a scene
 */
export function clearSavedScene(sceneId: string): void {
  const key = getStorageKey(sceneId);
  localStorage.removeItem(key);
  console.log(`[PersistenceSystem] Cleared saved data for ${key}`);
}

// ============================================================================
// AUTO-SAVE
// ============================================================================

/**
 * Check if any entities need saving
 */
function checkDirty(systemState: PersistenceSystemState): boolean {
  for (const entity of persistentEntities.entities) {
    if (entity.persistent?.isDirty) {
      return true;
    }
  }
  return false;
}

/**
 * Auto-save if enough time has passed and there are dirty entities
 */
function autoSave(systemState: PersistenceSystemState): void {
  const now = Date.now();
  const timeSinceLastSave = now - systemState.lastSaveTime;

  if (timeSinceLastSave >= systemState.saveIntervalMs && checkDirty(systemState)) {
    saveScene(systemState);
  }
}

// ============================================================================
// SYSTEM RUNNER
// ============================================================================

/**
 * Run persistence system for one frame
 */
export function persistenceSystem(
  ctx: SystemContext,
  systemState: PersistenceSystemState
): void {
  // Check for dirty entities and auto-save
  autoSave(systemState);
}

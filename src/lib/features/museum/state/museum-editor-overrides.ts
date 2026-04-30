/**
 * Museum Editor Overrides
 *
 * When the 3D editor drags an object to a new position, this module
 * stores the override so that both the 3D renderer AND the tile-based
 * interaction system use the new coordinates.
 *
 * Overrides are keyed by the Three.js group name (e.g. "performer-station-vulcan-demo",
 * "plaque-entrance-bulletin"). They persist in localStorage so they survive
 * page reloads during development.
 *
 * The override stores the world-space position. Consumers convert to tile
 * coordinates as needed (worldPos / TILE_SIZE).
 */

const STORAGE_KEY = "museum-editor-overrides";

export interface PositionOverride {
  /** World-space X (Three.js) */
  x: number;
  /** World-space Y (Three.js) - vertical */
  y: number;
  /** World-space Z (Three.js) */
  z: number;
}

/** All overrides keyed by Three.js object name */
let overrides: Record<string, PositionOverride> = loadFromStorage();

function loadFromStorage(): Record<string, PositionOverride> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveToStorage(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    /* non-critical */
  }
}

export const museumEditorOverrides = {
  /** Set an override for a named object after an editor drag */
  set(objectName: string, position: PositionOverride): void {
    overrides[objectName] = position;
    saveToStorage();
  },

  /** Get the override for a named object (or null if none) */
  get(objectName: string): PositionOverride | null {
    return overrides[objectName] ?? null;
  },

  /** Remove override for a single object */
  remove(objectName: string): void {
    delete overrides[objectName];
    saveToStorage();
  },

  /** Clear all overrides */
  clear(): void {
    overrides = {};
    saveToStorage();
  },

  /** Get all overrides (for debug/export) */
  getAll(): Readonly<Record<string, PositionOverride>> {
    return overrides;
  },

  /** Export overrides as JSON string (for saving to file) */
  exportJSON(): string {
    return JSON.stringify(overrides, null, 2);
  },

  /** Import overrides from JSON string */
  importJSON(json: string): void {
    try {
      overrides = JSON.parse(json);
      saveToStorage();
    } catch (err) {
      console.warn("[EditorOverrides] Invalid JSON import:", err);
    }
  },
};

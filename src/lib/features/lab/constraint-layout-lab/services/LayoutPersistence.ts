/**
 * Layout Persistence
 *
 * Persists composition lab state to localStorage so it survives refresh.
 * Also handles saving/loading custom user presets.
 */

import type { ConstraintCell, LayoutPreset, ContainerBounds } from "../domain/types";

const STORAGE_KEY = "composition-lab-state";
const LEGACY_STORAGE_KEY = "constraint-layout-state";
const PRESETS_KEY = "composition-lab-custom-presets";
const LEGACY_PRESETS_KEY = "constraint-layout-custom-presets";

export interface PersistedLayoutState {
  cells: ConstraintCell[];
  selectedCellId: string | null;
  version: number;
}

export interface CustomPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** Cells are stored with relative positions (0-1) for container-independent scaling */
  cells: ConstraintCell[];
  /** Original container size when preset was created */
  originalBounds: ContainerBounds;
  createdAt: number;
  updatedAt: number;
}

const CURRENT_VERSION = 1;

/**
 * Save current layout state to localStorage
 */
export function saveLayoutState(cells: ConstraintCell[], selectedCellId: string | null): void {
  const state: PersistedLayoutState = {
    cells,
    selectedCellId,
    version: CURRENT_VERSION,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Failed to save layout state:", e);
  }
}

/**
 * Load layout state from localStorage.
 * Checks the current key first, then falls back to the legacy key for backwards compatibility.
 */
export function loadLayoutState(): PersistedLayoutState | null {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);

    // Fall back to legacy key if current key has no data
    if (!raw) {
      raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) {
        // Migrate: save under new key, remove legacy key
        localStorage.setItem(STORAGE_KEY, raw);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    }

    if (!raw) return null;

    const state = JSON.parse(raw) as PersistedLayoutState;

    // Version check for future migrations
    if (state.version !== CURRENT_VERSION) {
      console.warn("Layout state version mismatch, ignoring saved state");
      return null;
    }

    return state;
  } catch (e) {
    console.warn("Failed to load layout state:", e);
    return null;
  }
}

/**
 * Clear saved layout state (removes both current and legacy keys)
 */
export function clearLayoutState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch (e) {
    console.warn("Failed to clear layout state:", e);
  }
}

/**
 * Save a custom preset
 */
export function saveCustomPreset(
  name: string,
  description: string,
  icon: string,
  cells: ConstraintCell[],
  containerBounds: ContainerBounds
): CustomPreset {
  const presets = loadCustomPresets();

  const preset: CustomPreset = {
    id: `custom-${Date.now()}`,
    name,
    description,
    icon,
    cells: JSON.parse(JSON.stringify(cells)),
    originalBounds: { ...containerBounds },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  presets.push(preset);

  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  } catch (e) {
    console.warn("Failed to save custom preset:", e);
  }

  return preset;
}

/**
 * Load all custom presets.
 * Checks the current key first, then falls back to the legacy key for backwards compatibility.
 */
export function loadCustomPresets(): CustomPreset[] {
  try {
    let raw = localStorage.getItem(PRESETS_KEY);

    // Fall back to legacy key if current key has no data
    if (!raw) {
      raw = localStorage.getItem(LEGACY_PRESETS_KEY);
      if (raw) {
        // Migrate: save under new key, remove legacy key
        localStorage.setItem(PRESETS_KEY, raw);
        localStorage.removeItem(LEGACY_PRESETS_KEY);
      }
    }

    if (!raw) return [];
    return JSON.parse(raw) as CustomPreset[];
  } catch (e) {
    console.warn("Failed to load custom presets:", e);
    return [];
  }
}

/**
 * Delete a custom preset by ID
 */
export function deleteCustomPreset(presetId: string): void {
  const presets = loadCustomPresets().filter((p) => p.id !== presetId);

  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  } catch (e) {
    console.warn("Failed to delete custom preset:", e);
  }
}

/**
 * Update an existing custom preset
 */
export function updateCustomPreset(
  presetId: string,
  updates: Partial<Pick<CustomPreset, "name" | "description" | "icon" | "cells" | "originalBounds">>
): void {
  const presets = loadCustomPresets();
  const existingPreset = presets.find((p) => p.id === presetId);

  if (!existingPreset) return;

  const updatedPreset: CustomPreset = {
    ...existingPreset,
    ...updates,
    updatedAt: Date.now(),
  };

  const index = presets.findIndex((p) => p.id === presetId);
  presets[index] = updatedPreset;

  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  } catch (e) {
    console.warn("Failed to update custom preset:", e);
  }
}

/**
 * Export format for sharing presets - simplified for readability
 */
export interface ExportedPreset {
  name: string;
  description: string;
  icon: string;
  cells: Array<{
    label: string;
    mediaType: string;
    zIndex: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  containerBounds: ContainerBounds;
}

/**
 * Export current layout as a shareable JSON format
 */
export function exportLayoutAsJSON(
  cells: ConstraintCell[],
  containerBounds: ContainerBounds,
  name: string = "Untitled",
  description: string = "",
  icon: string = "bookmark"
): ExportedPreset {
  return {
    name,
    description,
    icon,
    cells: cells.map((cell) => ({
      label: cell.label,
      mediaType: cell.mediaType,
      zIndex: cell.zIndex,
      x: cell.computed.x,
      y: cell.computed.y,
      width: cell.computed.width,
      height: cell.computed.height,
    })),
    containerBounds,
  };
}

/**
 * Convert a custom preset to a LayoutPreset for use with the preset picker
 */
export function customPresetToLayoutPreset(
  preset: CustomPreset
): LayoutPreset {
  return {
    id: preset.id,
    name: preset.name,
    description: preset.description,
    icon: preset.icon,
    createCells: (container: ContainerBounds) => {
      // Scale cells from original bounds to new container
      const scaleX = container.width / preset.originalBounds.width;
      const scaleY = container.height / preset.originalBounds.height;

      return preset.cells.map((cell, index) => {
        const newId = `${preset.id}-cell-${index}`;

        return {
          ...cell,
          id: newId,
          constraints: cell.constraints.map((c) => ({
            ...c,
            id: `${newId}-${c.anchor}`,
            cellId: newId,
            offset: c.anchor === "left" || c.anchor === "right" || c.anchor === "centerX"
              ? c.offset * scaleX
              : c.offset * scaleY,
          })),
          sizeConstraints: cell.sizeConstraints.map((sc) => ({
            ...sc,
            id: `${newId}-${sc.dimension}`,
            cellId: newId,
            value: typeof sc.value === "number"
              ? sc.dimension === "width"
                ? sc.value * scaleX
                : sc.value * scaleY
              : sc.value,
          })),
          computed: {
            x: cell.computed.x * scaleX,
            y: cell.computed.y * scaleY,
            width: cell.computed.width * scaleX,
            height: cell.computed.height * scaleY,
          },
        };
      });
    },
  };
}

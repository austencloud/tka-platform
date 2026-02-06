/**
 * Preset state management for GeneratePanel
 *
 * Manages user-saved generation presets with localStorage persistence.
 * Provides simple load/save/delete operations for configuration presets.
 */

import { untrack } from "svelte";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  GenerationMode,
  PropContinuity,
} from "../shared/domain/models/generate-models";
import { LOOPType, SliceSize } from "../circular/domain/models/circular-models";
import type { UIGenerationConfig } from "../shared/utils/config-mapper";

// ===== Types =====

export interface GenerationPreset {
  id: string;
  name: string;
  icon?: string;
  config: UIGenerationConfig;
  createdAt: number;
  updatedAt: number;
}

// ===== Persistence =====
const STORAGE_KEY = "tka-generate-presets";
const DEFAULT_PRESET_ID = "default-diamond-16";
const INIT_FLAG_KEY = "tka-presets-initialized";

/**
 * Save presets to localStorage
 */
function savePresetsToStorage(presets: GenerationPreset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch (error) {
    console.warn("⚠️ PresetState: Failed to save presets:", error);
  }
}

/**
 * Load presets from localStorage
 */
function loadPresetsFromStorage(): GenerationPreset[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const data = JSON.parse(stored);
    if (!Array.isArray(data)) {
      console.warn("⚠️ PresetState: Invalid presets structure");
      return [];
    }

    return data;
  } catch (error) {
    console.warn("⚠️ PresetState: Failed to load presets:", error);
    return [];
  }
}

/**
 * Generate unique ID for preset
 */
function generatePresetId(): string {
  return `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create default "Diamond 16" preset
 */
function createDefaultPreset(): GenerationPreset {
  const now = Date.now();

  const defaultConfig: UIGenerationConfig = {
    mode: GenerationMode.CIRCULAR,
    length: 16,
    level: 1,
    turnIntensity: 0,
    gridMode: GridMode.DIAMOND,
    propContinuity: PropContinuity.CONTINUOUS,
    sliceSize: SliceSize.HALVED,
    loopType: LOOPType.STRICT_ROTATED,
  };

  return {
    id: DEFAULT_PRESET_ID,
    name: "Diamond 16",
    icon: "💎",
    config: defaultConfig,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Check if presets have been initialized (flag in localStorage)
 */
function hasBeenInitialized(): boolean {
  try {
    return localStorage.getItem(INIT_FLAG_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Mark presets as initialized
 */
function markAsInitialized(): void {
  try {
    localStorage.setItem(INIT_FLAG_KEY, "true");
  } catch (error) {
    console.warn("⚠️ PresetState: Failed to mark as initialized:", error);
  }
}

// ===== State Creator =====

/**
 * Creates reactive state for managing generation presets
 */
export function createPresetState() {
  // Load saved presets
  let presets = $state<GenerationPreset[]>(loadPresetsFromStorage());

  // Initialize with default preset if first time
  // Using untrack to explicitly use initial value (not reactive)
  if (!hasBeenInitialized() && untrack(() => presets.length) === 0) {
    const defaultPreset = createDefaultPreset();
    presets = [defaultPreset];
    savePresetsToStorage(untrack(() => presets));
    markAsInitialized();
  }

  // Derived
  const hasPresets = $derived(presets.length > 0);

  /**
   * Get all presets
   */
  function getPresets(): GenerationPreset[] {
    return [...presets];
  }

  /**
   * Get preset by ID
   */
  function getPreset(id: string): GenerationPreset | undefined {
    return presets.find((p) => p.id === id);
  }

  /**
   * Save a new preset
   */
  function savePreset(
    name: string,
    config: UIGenerationConfig,
    icon?: string
  ): GenerationPreset {
    const now = Date.now();
    const newPreset: GenerationPreset = {
      id: generatePresetId(),
      name,
      icon: icon ?? "🎯", // Provide default icon instead of conditional spread
      config: { ...config }, // Deep copy config
      createdAt: now,
      updatedAt: now,
    };

    presets = [...presets, newPreset];
    savePresetsToStorage(presets);

    return newPreset;
  }

  /**
   * Update an existing preset
   */
  function updatePreset(
    id: string,
    updates: Partial<Pick<GenerationPreset, "name" | "icon" | "config">>
  ): boolean {
    const index = presets.findIndex((p) => p.id === id);
    if (index === -1) {
      return false;
    }

    const currentPreset = presets[index]!;
    const iconValue = updates.icon ?? currentPreset.icon;
    const updated: GenerationPreset = {
      ...currentPreset, // Start with current preset (all required fields)
      // Only apply updates for properties that are defined
      name: updates.name ?? currentPreset.name,
      ...(iconValue && { icon: iconValue }),
      config: updates.config ?? currentPreset.config,
      updatedAt: Date.now(),
    };

    presets = [
      ...presets.slice(0, index),
      updated,
      ...presets.slice(index + 1),
    ];
    savePresetsToStorage(presets);

    return true;
  }

  /**
   * Delete a preset
   */
  function deletePreset(id: string): boolean {
    const originalLength = presets.length;
    presets = presets.filter((p) => p.id !== id);

    if (presets.length < originalLength) {
      savePresetsToStorage(presets);
      return true;
    }

    return false;
  }

  /**
   * Clear all presets
   */
  function clearAllPresets(): void {
    presets = [];
    savePresetsToStorage(presets);
  }

  return {
    // State
    get presets() {
      return presets;
    },
    get hasPresets() {
      return hasPresets;
    },

    // Actions
    getPresets,
    getPreset,
    savePreset,
    updatePreset,
    deletePreset,
    clearAllPresets,
  };
}

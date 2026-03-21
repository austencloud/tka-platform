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
import type { StartEndOptions } from "$lib/features/create/shared/state/panel-coordination-state.svelte";
import { getBlockedPositionsForPreset, StartPositionPreset } from "../shared/domain/start-position-presets";

// ===== Types =====

export interface GenerationPreset {
  id: string;
  name: string;
  icon?: string;
  config: UIGenerationConfig;
  startEndOptions?: StartEndOptions | null;
  author?: string;
  createdAt: number;
  updatedAt: number;
}

// ===== Persistence =====
const STORAGE_KEY = "tka-generate-presets";
const DEFAULT_PRESET_ID = "austens-favorite";
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
 * Create default "Austen's Favorite" preset
 */
function createDefaultPreset(): GenerationPreset {
  const now = Date.now();

  const defaultConfig: UIGenerationConfig = {
    mode: GenerationMode.FREEFORM,
    loopEnabled: true,
    length: 16,
    level: 2,
    turnIntensity: 1,
    gridMode: GridMode.DIAMOND,
    propContinuity: PropContinuity.CONTINUOUS,
    sliceSize: SliceSize.QUARTERED,
    loopType: LOOPType.STRICT_ROTATED,
    constraintPreset: "smooth",
    handPathMode: "mixed",
    motionTypeFilter: null,
    durationTemplateId: null,
    spellTargetLength: null,
  };

  return {
    id: "austens-favorite",
    name: "Austen's Fav",
    icon: "⭐",
    author: "austen",
    config: defaultConfig,
    startEndOptions: {
      blockedStartPositions: getBlockedPositionsForPreset(
        StartPositionPreset.CLASSIC,
        GridMode.DIAMOND
      ),
      startPosition: null,
      endPosition: null,
      mustContainLetters: [],
      mustNotContainLetters: [],
    },
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

  // Active preset tracking
  let activePresetId = $state<string | null>(null);
  const activePreset = $derived(
    activePresetId ? presets.find((p) => p.id === activePresetId) ?? null : null
  );

  function activatePreset(id: string): void {
    const preset = presets.find((p) => p.id === id);
    if (preset) {
      activePresetId = id;
    }
  }

  function deactivatePreset(): void {
    activePresetId = null;
  }

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
    get activePresetId() {
      return activePresetId;
    },
    get activePreset() {
      return activePreset;
    },

    // Actions
    getPresets,
    getPreset,
    savePreset,
    updatePreset,
    deletePreset,
    clearAllPresets,
    activatePreset,
    deactivatePreset,
  };
}

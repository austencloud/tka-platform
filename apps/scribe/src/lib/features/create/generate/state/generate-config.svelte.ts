/**
 * UI Configuration state management for GeneratePanel
 *
 * Manages UI-specific configuration state using UIGenerationConfig.
 * Use config-mapper.ts to convert to/from GenerationOptions for service calls.
 * Includes persistence to localStorage for settings persistence across sessions.
 */

import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { LOOPType, SliceSize } from "../circular/domain/models/circular-models";
import {
  GenerationMode,
  PropContinuity,
} from "../shared/domain/models/generate-models";
import type { UIGenerationConfig } from "../shared/utils/config-mapper";

// Re-export for convenience
export type { UIGenerationConfig };

// ===== Persistence =====
const STORAGE_KEY = "tka-generate-config";

interface SerializedConfig {
  mode: GenerationMode;
  length: number;
  level: number;
  turnIntensity: number;
  gridMode: GridMode;
  propContinuity: PropContinuity;
  sliceSize: SliceSize;
  loopType: LOOPType;
  timestamp: number;
}

/**
 * Save configuration to localStorage
 */
function saveConfig(config: UIGenerationConfig): void {
  try {
    const serialized: SerializedConfig = {
      mode: config.mode as GenerationMode,
      length: config.length,
      level: config.level,
      turnIntensity: config.turnIntensity,
      gridMode: config.gridMode as GridMode,
      propContinuity: config.propContinuity as PropContinuity,
      sliceSize: config.sliceSize as SliceSize,
      loopType: config.loopType as LOOPType,
      timestamp: Date.now(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch (error) {
    console.warn("⚠️ GenerateConfig: Failed to save config:", error);
  }
}

/**
 * Load configuration from localStorage
 */
function loadConfig(): UIGenerationConfig | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const data = JSON.parse(stored) as SerializedConfig;

    // Validate essential properties
    if (
      data.mode === undefined ||
      data.length === undefined ||
      data.level === undefined
    ) {
      console.warn("⚠️ GenerateConfig: Invalid config structure");
      return null;
    }

    // Build config object, only including defined values
    // This prevents undefined values from overriding DEFAULT_CONFIG
    const result: Partial<UIGenerationConfig> = {
      mode: data.mode as GenerationMode,
      length: data.length,
      level: data.level,
    };

    if (data.turnIntensity !== undefined) {
      result.turnIntensity = data.turnIntensity;
    }
    if (data.gridMode !== undefined) {
      result.gridMode = data.gridMode as GridMode;
    }
    if (data.propContinuity !== undefined) {
      result.propContinuity = data.propContinuity as PropContinuity;
    }
    if (data.sliceSize !== undefined) {
      result.sliceSize = data.sliceSize as SliceSize;
    }
    if (data.loopType !== undefined) {
      result.loopType = data.loopType as LOOPType;
    }

    return result as UIGenerationConfig;
  } catch (error) {
    console.warn("⚠️ GenerateConfig: Failed to load config:", error);
    return null;
  }
}

/**
 * Clear saved configuration from localStorage
 */
function clearConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("⚠️ GenerateConfig: Failed to clear config:", error);
  }
}

// ===== Default Config =====
const DEFAULT_CONFIG: UIGenerationConfig = {
  mode: GenerationMode.FREEFORM,
  length: 16,
  level: 2,
  turnIntensity: 1.0,
  gridMode: GridMode.DIAMOND,
  propContinuity: PropContinuity.CONTINUOUS,
  sliceSize: SliceSize.HALVED,
  loopType: LOOPType.STRICT_ROTATED,
};

// ===== Simple State Creator =====
/**
 * Creates simple reactive state for generation configuration
 * Automatically loads saved settings from localStorage and persists changes
 */
export function createGenerationConfigState(
  initialConfig?: Partial<UIGenerationConfig>
) {
  // Load saved config or use defaults
  const savedConfig = loadConfig();

  // Initialize config with priority: initialConfig > savedConfig > DEFAULT_CONFIG
  let config = $state<UIGenerationConfig>({
    ...DEFAULT_CONFIG,
    ...(savedConfig || {}),
    ...initialConfig,
  });

  // Derived values
  const isFreeformMode = $derived(config.mode === GenerationMode.FREEFORM);

  // Simple update function with persistence
  function updateConfig(updates: Partial<UIGenerationConfig>) {
    config = { ...config, ...updates };
    saveConfig(config);
  }

  // Event handlers (matching your updated signatures)
  function onLevelChanged(event: CustomEvent) {
    const newLevel = event.detail.value;
    const updates: Partial<UIGenerationConfig> = { level: newLevel };

    // When switching from level 1 (BEGINNER) to level 2+ (INTERMEDIATE/ADVANCED),
    // ensure turnIntensity is at least 1.0 (never 0)
    if (newLevel >= 2 && config.turnIntensity < 1.0) {
      updates.turnIntensity = 1.0;
    }

    updateConfig(updates);
  }

  function onLengthChanged(event: CustomEvent) {
    updateConfig({ length: event.detail.value });
  }

  function onTurnIntensityChanged(event: CustomEvent) {
    updateConfig({ turnIntensity: event.detail.value });
  }

  function onGridModeChanged(value: GridMode) {
    updateConfig({ gridMode: value });
  }

  function onGenerationModeChanged(mode: GenerationMode) {
    updateConfig({ mode });
  }

  function onPropContinuityChanged(value: PropContinuity) {
    updateConfig({ propContinuity: value });
  }

  function onSliceSizeChanged(value: SliceSize) {
    updateConfig({ sliceSize: value });
  }

  function onLOOPTypeChanged(event: CustomEvent) {
    updateConfig({ loopType: event.detail.value });
  }

  return {
    // State
    get config() {
      return config;
    },
    get isFreeformMode() {
      return isFreeformMode;
    },

    // Actions
    updateConfig,
    clearSavedConfig: clearConfig,

    // Event handlers
    onLevelChanged,
    onLengthChanged,
    onTurnIntensityChanged,
    onGridModeChanged,
    onGenerationModeChanged,
    onPropContinuityChanged,
    onSliceSizeChanged,
    onLOOPTypeChanged,
  };
}

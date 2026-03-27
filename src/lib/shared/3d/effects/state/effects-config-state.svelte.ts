/**
 * Effects Config State for 3D Animation
 *
 * Manages user preferences for all visual effects (trails, particles, etc.).
 * Uses Svelte 5 runes for reactive state management.
 * Persists settings to localStorage for survival across refreshes.
 */

import { browser } from "$app/environment";
import {
  DEFAULT_TRAIL_CONFIG,
  DEFAULT_FIRE_CONFIG,
  DEFAULT_SPARKLE_CONFIG,
  DEFAULT_ELECTRICITY_CONFIG,
  DEFAULT_GLOW_CONFIG,
  type TrailConfig,
  type FireConfig,
  type SparkleConfig,
  type ElectricityConfig,
  type GlowConfig,
} from "../types";

// =============================================================================
// Persistence Keys
// =============================================================================

const STORAGE_KEY = "tka-3d-effects-config";

// =============================================================================
// Motion Effects Configuration
// =============================================================================

/**
 * Configuration for motion-based effects (blur, speed lines)
 */
export interface MotionEffectsConfig {
  /** Enable motion blur */
  blur: boolean;
  /** Enable speed lines */
  speedLines: boolean;
  /** Minimum velocity threshold to trigger effects */
  threshold: number;
  /** Effect intensity (0-1) */
  intensity: number;
}

const DEFAULT_MOTION_CONFIG: MotionEffectsConfig = {
  blur: false,
  speedLines: false,
  threshold: 2,
  intensity: 0.5,
};

// =============================================================================
// Bloom Configuration
// =============================================================================

/**
 * Configuration for bloom post-processing
 */
export interface BloomConfig {
  /** Enable bloom effect */
  enabled: boolean;
  /** Bloom intensity (0-1) */
  intensity: number;
  /** Luminance threshold for bloom (0-1) */
  threshold: number;
}

const DEFAULT_BLOOM_CONFIG: BloomConfig = {
  enabled: false,
  intensity: 0.5,
  threshold: 0.8,
};

// =============================================================================
// Combined Effects Config
// =============================================================================

/**
 * All effect configurations
 */
export interface EffectsConfig {
  trails: TrailConfig;
  fire: FireConfig;
  sparkles: SparkleConfig;
  electricity: ElectricityConfig;
  motion: MotionEffectsConfig;
  bloom: BloomConfig;
  glow: GlowConfig;
}

/**
 * Default configuration for all effects
 */
export const DEFAULT_EFFECTS_CONFIG: EffectsConfig = {
  trails: DEFAULT_TRAIL_CONFIG,
  fire: DEFAULT_FIRE_CONFIG,
  sparkles: DEFAULT_SPARKLE_CONFIG,
  electricity: DEFAULT_ELECTRICITY_CONFIG,
  motion: DEFAULT_MOTION_CONFIG,
  bloom: DEFAULT_BLOOM_CONFIG,
  glow: DEFAULT_GLOW_CONFIG,
};

// =============================================================================
// Persistence Helpers
// =============================================================================

/**
 * Load config from localStorage
 */
function loadPersistedConfig(): Partial<EffectsConfig> | null {
  if (!browser) return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Save config to localStorage
 */
function persistConfig(config: EffectsConfig): void {
  if (!browser) return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Storage quota exceeded or unavailable - fail silently
  }
}

// =============================================================================
// Effects Config State Factory
// =============================================================================

/**
 * Create effects configuration state
 */
export function createEffectsConfigState(
  initialConfig: Partial<EffectsConfig> = {}
) {
  // Load persisted config first, then merge with defaults and initial
  const persisted = loadPersistedConfig();
  const merged = persisted ?? initialConfig;

  // Merge with defaults
  let config = $state<EffectsConfig>({
    trails: { ...DEFAULT_TRAIL_CONFIG, ...merged.trails },
    fire: { ...DEFAULT_FIRE_CONFIG, ...merged.fire },
    sparkles: { ...DEFAULT_SPARKLE_CONFIG, ...merged.sparkles },
    electricity: { ...DEFAULT_ELECTRICITY_CONFIG, ...merged.electricity },
    motion: { ...DEFAULT_MOTION_CONFIG, ...merged.motion },
    bloom: { ...DEFAULT_BLOOM_CONFIG, ...merged.bloom },
    glow: { ...DEFAULT_GLOW_CONFIG, ...merged.glow },
  });

  // Panel collapsed state
  let isCollapsed = $state(false);

  // Auto-persist config on changes (debounced)
  let persistTimeout: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    // Access all config properties to track them
    JSON.stringify(config);

    // Debounce persistence to avoid excessive writes
    if (persistTimeout) clearTimeout(persistTimeout);
    persistTimeout = setTimeout(() => {
      persistConfig(config);
    }, 300);

    return () => {
      if (persistTimeout) {
        clearTimeout(persistTimeout);
        persistTimeout = null;
      }
    };
  });

  // =============================================================================
  // Derived States - Count of enabled effects
  // =============================================================================

  const enabledCount = $derived(
    [
      config.trails.enabled,
      config.fire.enabled,
      config.sparkles.enabled,
      config.electricity.enabled,
      config.motion.blur || config.motion.speedLines,
      config.bloom.enabled,
      config.glow.enabled,
    ].filter(Boolean).length
  );

  // =============================================================================
  // Trail Methods
  // =============================================================================

  function updateTrails(partial: Partial<TrailConfig>) {
    config.trails = { ...config.trails, ...partial };
  }

  function toggleTrails() {
    config.trails.enabled = !config.trails.enabled;
  }

  function setTrailMode(mode: "color" | "rainbow") {
    config.trails.color = mode === "rainbow" ? "rainbow" : "#ffffff";
  }

  function setTrackingMode(mode: "left" | "right" | "both") {
    const modeMap = {
      left: "left_end",
      right: "right_end",
      both: "both_ends",
    } as const;
    config.trails = {
      ...config.trails,
      trackingMode: modeMap[mode] as (typeof config.trails)["trackingMode"],
    };
  }

  function getTrackingModeLabel(): "left" | "right" | "both" {
    switch (config.trails.trackingMode) {
      case "left_end":
        return "left";
      case "right_end":
        return "right";
      default:
        return "both";
    }
  }

  // =============================================================================
  // Fire Methods
  // =============================================================================

  function updateFire(partial: Partial<FireConfig>) {
    config.fire = { ...config.fire, ...partial };
  }

  function toggleFire() {
    config.fire.enabled = !config.fire.enabled;
  }

  // =============================================================================
  // Sparkles Methods
  // =============================================================================

  function updateSparkles(partial: Partial<SparkleConfig>) {
    config.sparkles = { ...config.sparkles, ...partial };
  }

  function toggleSparkles() {
    config.sparkles.enabled = !config.sparkles.enabled;
  }

  // =============================================================================
  // Electricity Methods
  // =============================================================================

  function updateElectricity(partial: Partial<ElectricityConfig>) {
    config.electricity = { ...config.electricity, ...partial };
  }

  function toggleElectricity() {
    config.electricity.enabled = !config.electricity.enabled;
  }

  // =============================================================================
  // Motion Methods
  // =============================================================================

  function updateMotion(partial: Partial<MotionEffectsConfig>) {
    config.motion = { ...config.motion, ...partial };
  }

  function toggleMotionBlur() {
    config.motion.blur = !config.motion.blur;
  }

  function toggleSpeedLines() {
    config.motion.speedLines = !config.motion.speedLines;
  }

  // =============================================================================
  // Bloom Methods
  // =============================================================================

  function updateBloom(partial: Partial<BloomConfig>) {
    config.bloom = { ...config.bloom, ...partial };
  }

  function toggleBloom() {
    config.bloom.enabled = !config.bloom.enabled;
  }

  // =============================================================================
  // Glow Methods
  // =============================================================================

  function updateGlow(partial: Partial<GlowConfig>) {
    config.glow = { ...config.glow, ...partial };
  }

  function toggleGlow() {
    config.glow.enabled = !config.glow.enabled;
  }

  // =============================================================================
  // Panel Methods
  // =============================================================================

  function toggleCollapsed() {
    isCollapsed = !isCollapsed;
  }

  function setCollapsed(collapsed: boolean) {
    isCollapsed = collapsed;
  }

  // =============================================================================
  // Reset Methods
  // =============================================================================

  function resetToDefaults() {
    config = { ...DEFAULT_EFFECTS_CONFIG };
  }

  function disableAll() {
    config.trails.enabled = false;
    config.fire.enabled = false;
    config.sparkles.enabled = false;
    config.electricity.enabled = false;
    config.motion.blur = false;
    config.motion.speedLines = false;
    config.bloom.enabled = false;
    config.glow.enabled = false;
  }

  // =============================================================================
  // Return API
  // =============================================================================

  return {
    // Reactive config (read-only getters)
    get config() {
      return config;
    },
    get trails() {
      return config.trails;
    },
    get fire() {
      return config.fire;
    },
    get sparkles() {
      return config.sparkles;
    },
    get electricity() {
      return config.electricity;
    },
    get motion() {
      return config.motion;
    },
    get bloom() {
      return config.bloom;
    },
    get glow() {
      return config.glow;
    },
    get isCollapsed() {
      return isCollapsed;
    },
    get enabledCount() {
      return enabledCount;
    },

    // Trail methods
    updateTrails,
    toggleTrails,
    setTrailMode,
    setTrackingMode,
    getTrackingModeLabel,

    // Fire methods
    updateFire,
    toggleFire,

    // Sparkles methods
    updateSparkles,
    toggleSparkles,

    // Electricity methods
    updateElectricity,
    toggleElectricity,

    // Motion methods
    updateMotion,
    toggleMotionBlur,
    toggleSpeedLines,

    // Bloom methods
    updateBloom,
    toggleBloom,

    // Glow methods
    updateGlow,
    toggleGlow,

    // Panel methods
    toggleCollapsed,
    setCollapsed,

    // Reset methods
    resetToDefaults,
    disableAll,
  };
}

// =============================================================================
// Type Export
// =============================================================================

export type EffectsConfigState = ReturnType<typeof createEffectsConfigState>;

// =============================================================================
// Singleton Instance
// =============================================================================

let singletonInstance: EffectsConfigState | null = null;

/**
 * Get or create the singleton effects config state
 */
export function getEffectsConfigState(): EffectsConfigState {
  if (!singletonInstance) {
    singletonInstance = createEffectsConfigState();
  }
  return singletonInstance;
}

/**
 * Reset the singleton instance (for testing or cleanup)
 */
export function resetEffectsConfigState(): void {
  singletonInstance = null;
}

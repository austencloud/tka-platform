/**
 * Animation Settings State
 *
 * Shared, persisted animation settings that apply globally.
 * These settings follow the user across the app - Share panel,
 * Animate module, Quick Play, etc.
 *
 * Includes:
 * - Trail settings (mode, tracking, appearance)
 * - Playback settings (BPM, loop)
 * - Motion visibility (blue/red)
 */

// TYPES - Re-export from canonical source in animate module

// Import types from the canonical source
import {
  TrailMode,
  TrackingMode,
  TrailEffect,
  type TrailSettings,
  type TrailPoint,
  DEFAULT_TRAIL_SETTINGS as MODULE_DEFAULT_TRAIL_SETTINGS,
  TAIL_LENGTH_MIN,
  TAIL_LENGTH_MAX,
} from "../domain/types/trail-types";
import { PLAYBACK_MAX_BPM } from "../domain/constants/timing";

// Re-export for convenience
export { TrailMode, TrackingMode, TrailEffect };
export type { TrailSettings, TrailPoint };

/**
 * Trail appearance settings (subset for convenience)
 */
export interface TrailAppearance {
  lineWidth: number;
  maxOpacity: number;
  minOpacity: number;
  glowBlur: number;
  blueColor: string;
  redColor: string;
}

/**
 * Complete animation settings (persisted)
 */
export interface AnimationSettings {
  version: number;

  // Playback
  bpm: number;
  shouldLoop: boolean;

  // Trails
  trail: TrailSettings;
}


import { getMotionColor } from "$lib/shared/utils/svg-color-utils";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export const DEFAULT_TRAIL_APPEARANCE: TrailAppearance = {
  lineWidth: 3.5,
  maxOpacity: 0.95,
  minOpacity: 0.15,
  glowBlur: 2,
  blueColor: getMotionColor(MotionColor.BLUE, "dark"),
  redColor: getMotionColor(MotionColor.RED, "dark"),
};

export const DEFAULT_TRAIL_SETTINGS: TrailSettings = {
  ...MODULE_DEFAULT_TRAIL_SETTINGS,
};

export const ANIMATION_SETTINGS_VERSION = 2;

export const DEFAULT_ANIMATION_SETTINGS: AnimationSettings = {
  version: ANIMATION_SETTINGS_VERSION,
  bpm: 120,
  shouldLoop: true,
  trail: { ...DEFAULT_TRAIL_SETTINGS },
};


import { createPersistenceHelper } from "$lib/shared/state/utils/persistent-state";

const ANIMATION_SETTINGS_STORAGE_KEY = "tka_animation_settings";
const BOTH_ENDS_DEFAULT_VERSION = 2;

const settingsPersistence = createPersistenceHelper({
  key: ANIMATION_SETTINGS_STORAGE_KEY,
  defaultValue: DEFAULT_ANIMATION_SETTINGS,
});

function readStoredSettingsVersion(): number {
  if (typeof window === "undefined") return ANIMATION_SETTINGS_VERSION;

  try {
    const raw = window.localStorage.getItem(ANIMATION_SETTINGS_STORAGE_KEY);
    if (!raw) return ANIMATION_SETTINGS_VERSION;

    const parsed = JSON.parse(raw) as { version?: unknown };
    return typeof parsed.version === "number" ? parsed.version : 1;
  } catch {
    return ANIMATION_SETTINGS_VERSION;
  }
}

export function migrateAnimationSettings(
  settings: AnimationSettings,
  storedVersion: number,
): AnimationSettings {
  // Older installs inherited Thumb End from the old factory default. Promote
  // that value once so a staff opens with both trails, then preserve every
  // tracking choice the user makes after this migration.
  const trail =
    storedVersion < BOTH_ENDS_DEFAULT_VERSION &&
    settings.trail.trackingMode === TrackingMode.RIGHT_END
      ? { ...settings.trail, trackingMode: TrackingMode.BOTH_ENDS }
      : settings.trail;

  return {
    ...settings,
    version: ANIMATION_SETTINGS_VERSION,
    trail,
  };
}

/**
 * Load animation settings with migration logic
 * Forces vivid trail preset for all users
 */
function loadSettings(): AnimationSettings {
  const settings = migrateAnimationSettings(
    settingsPersistence.load(),
    readStoredSettingsVersion(),
  );

  // MIGRATION: Force the vivid trail preset for everyone
  // The rendering now always uses exponential fade and tapered width (hardcoded)
  if (settings.trail) {
    // Always force these "vivid" settings - they're what makes trails look good
    settings.trail.mode = TrailMode.FADE;
    settings.trail.effect = TrailEffect.GLOW;
    // Thicker line width to compensate for tapering (tapered trails thin at tail)
    settings.trail.lineWidth = 5;
    settings.trail.maxOpacity = 1.0; // Full opacity at head
    settings.trail.minOpacity = 0.25; // Higher minimum so tail doesn't fade too much
    settings.trail.glowBlur = 3; // Stronger glow for more visibility
    settings.trail.fadeDurationMs = 2500;
    // Backfill tailLength for users persisted before this setting existed.
    if (
      typeof settings.trail.tailLength !== "number" ||
      !Number.isFinite(settings.trail.tailLength)
    ) {
      settings.trail.tailLength = MODULE_DEFAULT_TRAIL_SETTINGS.tailLength;
    }
  }

  return settings;
}


export type AnimationSettingsState = {
  // Read-only access
  readonly settings: AnimationSettings;
  readonly bpm: number;
  readonly shouldLoop: boolean;
  readonly trail: TrailSettings;

  // Playback setters
  setBpm: (bpm: number) => void;
  setShouldLoop: (loop: boolean) => void;

  // Trail setters
  setTrailMode: (mode: TrailMode) => void;
  setTrailEffect: (effect: TrailEffect) => void;
  setTrackingMode: (mode: TrackingMode) => void;
  setFadeDuration: (ms: number) => void;
  setTailLength: (points: number) => void;
  setTrailAppearance: (appearance: Partial<TrailAppearance>) => void;
  setHideProps: (hide: boolean) => void;

  // Bulk operations
  updateSettings: (partial: Partial<AnimationSettings>) => void;
  resetToDefaults: () => void;

  // Current prop type (set by AnimationEngine, used for UI labels)
  readonly currentPropType: string;
  setCurrentPropType: (propType: string) => void;
};

/**
 * Create the shared animation settings state.
 * This is a singleton - call once at app init and share via context.
 */
export function createAnimationSettingsState(
  options?: { ephemeral?: boolean },
): AnimationSettingsState {
  const ephemeral = options?.ephemeral ?? false;
  let settings = $state<AnimationSettings>(
    ephemeral
      ? { ...DEFAULT_ANIMATION_SETTINGS, trail: { ...DEFAULT_TRAIL_SETTINGS } }
      : loadSettings(),
  );
  let propType = $state("staff");

  if (!ephemeral) {
    // Auto-save on any changes (using $effect.root for module-level usage)
    $effect.root(() => {
      $effect(() => {
        // Access all properties to track changes
        void settings.version;
        void settings.bpm;
        void settings.shouldLoop;
        void settings.trail.mode;
        void settings.trail.effect;
        void settings.trail.trackingMode;
        void settings.trail.lineWidth;
        void settings.trail.maxOpacity;
        void settings.trail.minOpacity;
        void settings.trail.glowBlur;
        void settings.trail.blueColor;
        void settings.trail.redColor;
        void settings.trail.fadeDurationMs;
        void settings.trail.tailLength;
        void settings.trail.hideProps;

        settingsPersistence.setupAutoSave(settings);
      });
    });
  }

  return {
    // Read-only getters
    get settings() {
      return settings;
    },
    get bpm() {
      return settings.bpm;
    },
    get shouldLoop() {
      return settings.shouldLoop;
    },
    get trail() {
      return settings.trail;
    },

    // Playback setters
    setBpm: (bpm: number) => {
      settings = { ...settings, bpm: Math.max(30, Math.min(PLAYBACK_MAX_BPM, bpm)) };
    },

    setShouldLoop: (loop: boolean) => {
      settings = { ...settings, shouldLoop: loop };
    },

    // Trail setters
    setTrailMode: (mode: TrailMode) => {
      settings = {
        ...settings,
        trail: {
          ...settings.trail,
          mode,
        },
      };
    },

    setTrailEffect: (effect: TrailEffect) => {
      settings = {
        ...settings,
        trail: { ...settings.trail, effect },
      };
    },

    setTrackingMode: (mode: TrackingMode) => {
      settings = {
        ...settings,
        trail: { ...settings.trail, trackingMode: mode },
      };
    },

    setFadeDuration: (ms: number) => {
      settings = {
        ...settings,
        trail: {
          ...settings.trail,
          fadeDurationMs: Math.max(500, Math.min(10000, ms)),
        },
      };
    },

    setTailLength: (points: number) => {
      const clamped = Math.round(
        Math.max(TAIL_LENGTH_MIN, Math.min(TAIL_LENGTH_MAX, points)),
      );
      settings = {
        ...settings,
        trail: { ...settings.trail, tailLength: clamped },
      };
    },

    setTrailAppearance: (appearance: Partial<TrailAppearance>) => {
      // TrailSettings is flat, so spread appearance props directly into trail
      settings = {
        ...settings,
        trail: {
          ...settings.trail,
          ...appearance,
        },
      };
    },

    setHideProps: (hide: boolean) => {
      settings = {
        ...settings,
        trail: { ...settings.trail, hideProps: hide },
      };
    },

    // Bulk operations
    updateSettings: (partial: Partial<AnimationSettings>) => {
      settings = { ...settings, ...partial };
    },

    resetToDefaults: () => {
      settings = {
        ...DEFAULT_ANIMATION_SETTINGS,
        trail: { ...DEFAULT_TRAIL_SETTINGS },
      };
    },

    // Current prop type (for UI labels like trail tracking mode)
    get currentPropType() {
      return propType;
    },
    setCurrentPropType: (pt: string) => {
      propType = pt;
    },
  };
}

// Without this, every HMR update recreates the singleton fresh, resetting
// BPM, trail settings, and other animation state the user has configured.

const hmrSettingsData = import.meta.hot?.data as
  | { animationSettings?: AnimationSettingsState }
  | undefined;


/**
 * Global animation settings state instance.
 * Import this directly for easy access across the app.
 */
export const animationSettings =
  hmrSettingsData?.animationSettings ?? createAnimationSettingsState();

if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.animationSettings = animationSettings;
  });
}

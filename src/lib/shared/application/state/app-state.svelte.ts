/**
 * Refactored Application State - Clean Architecture
 *
 * Orchestrates focused state services following Single Responsibility Principle.
 * Each service handles one specific concern, making the code maintainable and testable.
 *
 * This replaces the 460-line monolith with a clean, focused architecture.
 */

import { BackgroundType } from "../../background/shared/domain/enums/background-enums";
import type { PerformanceSnapshot } from "../../foundation/ui/UITypes";
import { GridMode } from "../../pictograph/grid/domain/enums/grid-enums";
import { PropType } from "../../pictograph/prop/domain/enums/PropType";
import type { AppSettings, PropPreset } from "../../settings/domain/AppSettings";
import {
  getIsInitialized,
  getIsInitializing,
  getInitializationError,
  resetInitializationState,
} from "./initialization-state.svelte";
import {
  areServicesInitialized,
  getSettingsServiceSync,
} from "./services.svelte";
import {
  initializeModulePersistence,
  preloadCachedModuleServices,
} from "./ui/module-state";
import {
  getShowSettings,
  getIsFullScreen,
  getIsTransitioning,
  resetUIState,
} from "./ui/ui-state.svelte";
import { userPreviewState } from "../../debug/state/user-preview-state.svelte";

// HMR Test Comment - This should trigger a full reload

// ============================================================================
// SETTINGS
// ============================================================================

// Default prop presets for new users (10 commonly-used configurations)
const DEFAULT_PROP_PRESETS: PropPreset[] = [
  { bluePropType: PropType.STAFF, redPropType: PropType.STAFF, catDogMode: false },
  { bluePropType: PropType.FAN, redPropType: PropType.FAN, catDogMode: false },
  { bluePropType: PropType.CLUB, redPropType: PropType.CLUB, catDogMode: false },
  { bluePropType: PropType.BUUGENG, redPropType: PropType.BUUGENG, catDogMode: false },
  { bluePropType: PropType.MINIHOOP, redPropType: PropType.MINIHOOP, catDogMode: false },
  { bluePropType: PropType.TRIAD, redPropType: PropType.TRIAD, catDogMode: false },
  { bluePropType: PropType.DOUBLESTAR, redPropType: PropType.DOUBLESTAR, catDogMode: false },
  { bluePropType: PropType.BIGDOUBLESTAR, redPropType: PropType.BIGDOUBLESTAR, catDogMode: false },
  { bluePropType: PropType.QUIAD, redPropType: PropType.QUIAD, catDogMode: false },
  { bluePropType: PropType.STAFF, redPropType: PropType.FAN, catDogMode: true },
];

// Default settings returned when services aren't initialized
const DEFAULT_SETTINGS: AppSettings = {
  gridMode: GridMode.DIAMOND,
  backgroundType: BackgroundType.SOLID_COLOR,
  backgroundQuality: "medium",
  backgroundEnabled: true,
  backgroundColor: "#000000",
  propPresets: DEFAULT_PROP_PRESETS,
  bluePropType: PropType.STAFF,
  redPropType: PropType.STAFF,
  selectedPresetIndex: 0,
};

export function getSettings() {
  const initialized = areServicesInitialized();

  if (!initialized) {
    // Return default settings if not initialized
    // Use solidColor (black) to avoid flash while settings load
    return DEFAULT_SETTINGS;
  }

  // When in preview mode, return the previewed user's settings (read-only)
  // This allows admins to see how the app looks with another user's configuration
  if (userPreviewState.isActive && userPreviewState.data.settings) {
    // Merge with defaults to ensure all required fields are present
    return { ...DEFAULT_SETTINGS, ...userPreviewState.data.settings };
  }

  // Return the reactive settings object directly (NOT a snapshot)
  // This ensures components using $derived(getSettings()) will re-render when settings change
  const settings = getSettingsServiceSync().settings;
  return settings;
}

/**
 * Check if settings are currently in read-only preview mode
 * When true, settings changes should be blocked (viewing another user's config)
 */
export function isSettingsPreviewMode(): boolean {
  return userPreviewState.isActive && userPreviewState.data.settings !== null;
}

// ============================================================================
// PERFORMANCE
// ============================================================================

const performanceMetrics = $state({
  initializationTime: 0,
  lastRenderTime: 0,
  memoryUsage: 0,
});

export function getPerformanceMetrics() {
  return performanceMetrics;
}

// ============================================================================
// DERIVED STATE
// ============================================================================

export function getIsReady() {
  return (
    getIsInitialized() && !getIsInitializing() && !getInitializationError()
  );
}

export function getCanUseApp() {
  return getIsReady() && !getShowSettings();
}

// ============================================================================
/**
 * Update a single setting key-value pair.
 * This is the preferred method for individual setting updates as it avoids
 * race conditions when multiple updates happen in quick succession.
 */
export function updateSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K]
): void {
  // Block updates when viewing another user's settings
  if (isSettingsPreviewMode()) {
    console.warn(
      "Cannot update settings while in preview mode (viewing another user's configuration)"
    );
    return;
  }

  if (!areServicesInitialized()) {
    console.warn("Settings service not initialized, cannot update setting");
    return;
  }

  // Use the singular updateSetting method which directly updates the state
  void getSettingsServiceSync().updateSetting(key, value);
}

export async function updateSettings(
  newSettings: Partial<AppSettings>
): Promise<void> {
  // Block updates when viewing another user's settings
  if (isSettingsPreviewMode()) {
    console.warn(
      "Cannot update settings while in preview mode (viewing another user's configuration)"
    );
    return;
  }

  if (!areServicesInitialized()) {
    console.warn("Settings service not initialized, cannot update settings");
    return;
  }

  // Update each setting individually using the interface method
  void getSettingsServiceSync().updateSettings(newSettings);
}

// Performance tracking
export function updateInitializationTime(time: number): void {
  performanceMetrics.initializationTime = time;
}

export function updateLastRenderTime(time: number): void {
  performanceMetrics.lastRenderTime = time;
}

export function updateMemoryUsage(): void {
  if (typeof performance !== "undefined" && "memory" in performance) {
    const memory = (performance as { memory: { usedJSHeapSize: number } })
      .memory;
    performanceMetrics.memoryUsage = Math.round(
      memory.usedJSHeapSize / 1048576
    );
  }
}

// ============================================================================
// APPLICATION LIFECYCLE
// ============================================================================

export async function restoreApplicationState(): Promise<void> {
  try {
    // Preload cached module services first to prevent UI flicker
    preloadCachedModuleServices();

    // Initialize module persistence and restore saved module
    await initializeModulePersistence();
  } catch (error) {
    console.warn("⚠️ Failed to restore application state:", error);
    // Don't throw - app should work even if persistence fails
  }
}

// ============================================================================
// UTILITIES & DEBUG
// ============================================================================

// Performance snapshot for debugging
export function createPerformanceSnapshot(): PerformanceSnapshot {
  return {
    timestamp: Date.now(),
    metrics: performanceMetrics,
    appState: {
      isFullScreen: getIsFullScreen(),
      isTransitioning: getIsTransitioning(),
      showSettings: getShowSettings(),
    },
    memoryUsage: performanceMetrics.memoryUsage,
  };
}

export function resetMetrics(): void {
  performanceMetrics.initializationTime = 0;
  performanceMetrics.lastRenderTime = 0;
  performanceMetrics.memoryUsage = 0;
}

export function clearStoredSettings(): void {
  if (!areServicesInitialized()) {
    console.warn("Settings service not initialized, cannot clear settings");
    return;
  }
  getSettingsServiceSync().clearStoredSettings();
}

export function debugSettings(): void {
  if (!areServicesInitialized()) {
    console.warn("Settings service not initialized, cannot debug settings");
    return;
  }
  getSettingsServiceSync().debugSettings();
}

// Reset all application state to defaults
export function resetAppState(): void {
  // Reset UI state
  resetUIState();

  // Reset initialization state
  resetInitializationState();

  // Reset performance metrics
  resetMetrics();

  // Reset settings
  // TODO: Implement resetToDefaults in ISettingsState interface
  console.warn("resetToDefaults not implemented in ISettingsState");
}

// ============================================================================
// DEVELOPMENT HELPERS
// ============================================================================

declare global {
  interface Window {
    debugSettings?: typeof debugSettings;
    resetAppState?: typeof resetAppState;
    clearStoredSettings?: typeof clearStoredSettings;
  }
}

if (typeof window !== "undefined") {
  window.debugSettings = debugSettings;
  window.resetAppState = resetAppState;
  window.clearStoredSettings = clearStoredSettings;
}

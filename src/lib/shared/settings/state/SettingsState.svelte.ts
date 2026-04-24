/**
 * Settings Service
 *
 * Manages application settings with persistence to localStorage and Firebase.
 * - localStorage: Always used for offline support and fast initial load
 * - Firebase: Used when authenticated for cross-device sync
 *
 * Sync strategy:
 * - On save: Write to localStorage immediately, then to Firebase (if authenticated)
 * - On login: Merge Firebase settings with local (Firebase wins for conflicts)
 * - On logout: Keep local settings (allows offline use)
 */

import { browser } from "$app/environment";
import { BackgroundType } from "@austencloud/backgrounds";
import {
  updateBodyBackground,
  type CustomBackgroundOptions,
} from "../utils/background-preloader";
import { ThemeService } from "../../theme/services/ThemeService";
import {
  applyThemeFromColors,
  applyThemeForBackground,
} from "../../settings/utils/background-theme-calculator";
import { GridMode } from "../../pictograph/grid/domain/enums/grid-enums";
import { PropType } from "../../pictograph/prop/domain/enums/PropType";
import type { AppSettings, PropPreset } from "../domain/AppSettings";
import { container } from "$lib/shared/di";
import { getActivityLogger } from "$lib/shared/analytics/getActivityLogger";
import type { ISettingsPersister } from "../services/contracts/ISettingsPersister";
import { auth } from "../../auth/firebase";
import type { ISettingsState } from "../services/contracts/ISettingsState";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";
import { getAnimationVisibilityManager } from "../../animation-engine/state/animation-visibility-state.svelte";

const debug = createComponentLogger("SettingsState");

const SETTINGS_STORAGE_KEY = "tka-modern-web-settings";
const OFFLINE_QUEUE_KEY = "tka-settings-offline-queue";

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

const DEFAULT_SETTINGS: AppSettings = {
  gridMode: GridMode.DIAMOND,
  backgroundType: BackgroundType.NIGHT_SKY,
  backgroundQuality: "medium",
  backgroundEnabled: true,
  hapticFeedback: true,
  reducedMotion: false,
  catDogMode: false, // Default: both hands use the same prop
  bluePropType: PropType.STAFF, // Default prop type for blue
  redPropType: PropType.STAFF, // Default prop type for red
  blockedStartPositions: [], // No positions blocked by default (allows all)
  propPresets: DEFAULT_PROP_PRESETS,
  selectedPresetIndex: 0,
  darkMode: true, // Dark Mode is the default pictograph appearance for new users and guests
} as AppSettings;

// Initialize with loaded settings immediately (non-reactive)
const initialSettings = (() => {
  if (!browser) return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!stored) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(stored);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
})();

// Create reactive settings state with loaded settings
const settingsState = $state<AppSettings>(initialSettings);

/**
 * Get custom background options from settings for crossfade transition
 */
function getCustomBackgroundOptions(
  settings: Partial<AppSettings>
): CustomBackgroundOptions {
  return {
    color: settings.backgroundColor,
    colors: settings.gradientColors,
    direction: settings.gradientDirection,
  };
}

class SettingsState implements ISettingsState {
  private firebasePersistence: ISettingsPersister | null = null;
  private unsubscribeFirebaseSync: (() => void) | null = null;
  private syncInitialized = false;
  private isSavingToFirebase = false; // Prevent re-entrant saves
  private pendingFirebaseSave: Promise<void> | null = null;
  private onlineHandler: (() => void) | null = null;
  private firebaseSaveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly FIREBASE_SAVE_DEBOUNCE_MS = 300; // Debounce rapid saves

  constructor() {
    // Settings are already loaded from localStorage in the reactive state
    // Firebase sync will be initialized when user authenticates
    // Process any offline queue on startup
    if (browser) {
      this.processOfflineQueue();

      // Listen for online events to process queued changes
      this.onlineHandler = () => {
        this.processOfflineQueue();
      };
      window.addEventListener("online", this.onlineHandler);
    }
  }

  /**
   * Initialize Firebase sync for authenticated users
   * This should be called after the DI container is ready
   */
  async initializeFirebaseSync(): Promise<void> {
    if (this.syncInitialized) return;
    this.syncInitialized = true;

    // Try to get the Firebase persistence service
    try {
      this.firebasePersistence = container.items.settingsPersister;
    } catch {
      console.warn(
        "⚠️ [SettingsState] Firebase persistence service not available"
      );
      return;
    }

    // Process any queued offline changes first
    await this.processOfflineQueue();

    // If user is authenticated, sync settings from Firebase
    if (auth.currentUser && this.firebasePersistence) {
      await this.syncFromFirebase();

      // Subscribe to real-time updates from other devices
      if (this.firebasePersistence.onSettingsChange) {
        this.unsubscribeFirebaseSync =
          this.firebasePersistence.onSettingsChange((remoteSettings) => {
            // Only apply remote settings if we're not saving or about to save.
            // The debounce timer guard prevents a race where the listener fires
            // between a local change (written to localStorage) and the debounced
            // Firebase save, overwriting the local change with stale remote data.
            if (!this.isSavingToFirebase && !this.firebaseSaveDebounceTimer) {
              this.applyRemoteSettings(remoteSettings);
            }
          });
      }
    }
  }

  /**
   * Sync settings from Firebase (called on login)
   * Uses timestamp-based conflict resolution: local wins if newer
   *
   * On initial login, this will apply ALL settings from Firebase including background.
   * Background is only applied if the local device doesn't already have a preference.
   */
  async syncFromFirebase(): Promise<void> {
    if (!this.firebasePersistence || !auth.currentUser) return;

    try {
      const firebaseSettings = await this.firebasePersistence.loadSettings();
      const localTimestamp = settingsState._localTimestamp || 0;

      if (firebaseSettings) {
        // Check if we have pending local changes that are newer
        if (localTimestamp > 0) {
          // We have local changes with a timestamp - push them to Firebase
          // This ensures local changes made while offline are not lost
          debug.success("Local settings are newer, pushing to Firebase");
          await this.firebasePersistence.saveSettings(
            this.getSettingsForPersistence()
          );
        } else {
          // No local timestamp means fresh load - accept Firebase settings
          // This is initial login, so we DO apply background settings
          this.applyRemoteSettings(firebaseSettings);

          // On initial login, also apply background if local doesn't have one set
          // or if local is still using the default
          const localBackground = settingsState.backgroundType;
          const isUsingDefault =
            localBackground === BackgroundType.NIGHT_SKY ||
            localBackground === BackgroundType.SOLID_COLOR;

          if (firebaseSettings.backgroundType && isUsingDefault) {
            // Migration: if Firebase still has the old default (solidColor + black),
            // convert it to nightSky and push the correction back to Firebase
            const isOldDefault =
              firebaseSettings.backgroundType === BackgroundType.SOLID_COLOR &&
              (!firebaseSettings.backgroundColor || firebaseSettings.backgroundColor === "#000000");

            if (isOldDefault) {
              debug.success("Firebase has old default (solidColor/#000000), migrating to nightSky");
              settingsState.backgroundType = BackgroundType.NIGHT_SKY;
              delete settingsState.backgroundColor;
              updateBodyBackground(BackgroundType.NIGHT_SKY);
              applyThemeForBackground(BackgroundType.NIGHT_SKY);
              ThemeService.updateTheme(BackgroundType.NIGHT_SKY);
              this.saveSettingsToStorage(settingsState);
              // Push the corrected background back to Firebase so it doesn't happen again
              await this.firebasePersistence.saveSettings(
                this.getSettingsForPersistence()
              );
              debug.success("Migrated Firebase background from solidColor to nightSky");
            } else {
              // Apply Firebase background preference on initial login
              settingsState.backgroundType = firebaseSettings.backgroundType;
              if (firebaseSettings.backgroundCategory) {
                settingsState.backgroundCategory =
                  firebaseSettings.backgroundCategory;
              }
              if (firebaseSettings.backgroundColor) {
                settingsState.backgroundColor = firebaseSettings.backgroundColor;
              }
              if (firebaseSettings.gradientColors) {
                settingsState.gradientColors = firebaseSettings.gradientColors;
              }
              if (firebaseSettings.gradientDirection !== undefined) {
                settingsState.gradientDirection =
                  firebaseSettings.gradientDirection;
              }

              updateBodyBackground(
                firebaseSettings.backgroundType,
                getCustomBackgroundOptions(firebaseSettings)
              );
              // Apply theme colors properly based on background type
              if (firebaseSettings.backgroundType === BackgroundType.SOLID_COLOR && firebaseSettings.backgroundColor) {
                applyThemeFromColors(firebaseSettings.backgroundColor);
              } else if (firebaseSettings.backgroundType === BackgroundType.LINEAR_GRADIENT && firebaseSettings.gradientColors) {
                applyThemeFromColors(undefined, firebaseSettings.gradientColors);
              } else {
                applyThemeForBackground(firebaseSettings.backgroundType);
              }
              ThemeService.updateTheme(firebaseSettings.backgroundType);
              this.saveSettingsToStorage(settingsState);
              debug.success("Applied background from Firebase on initial login");
            }
          }

          // Sync pictograph dark mode from Firebase profile setting.
          // AnimationVisibilityStateManager uses its own localStorage key, so it
          // doesn't see the Firebase-synced darkMode value without this bridge.
          if (firebaseSettings.darkMode !== undefined) {
            const animVisManager = getAnimationVisibilityManager();
            if (animVisManager.isDarkMode() !== firebaseSettings.darkMode) {
              animVisManager.setDarkMode(firebaseSettings.darkMode);
              debug.success(`Synced pictograph dark mode from Firebase: ${firebaseSettings.darkMode}`);
            }
          }

          debug.success("Applied settings from Firebase");
        }
      } else {
        // No Firebase settings - push local settings to Firebase
        await this.firebasePersistence.saveSettings(
          this.getSettingsForPersistence()
        );
        debug.success("Pushed local settings to Firebase");
      }
    } catch (error) {
      console.error("❌ [SettingsState] Failed to sync from Firebase:", error);
    }
  }

  /**
   * Get settings without internal metadata fields for persistence
   */
  private getSettingsForPersistence(): AppSettings {
     
    const { _localTimestamp, ...settings } = settingsState;
    return settings as AppSettings;
  }

  /**
   * Apply remote settings without triggering a save back to Firebase
   * Only applies settings that weren't modified locally more recently
   *
   * IMPORTANT: Background settings are intentionally EXCLUDED from real-time sync.
   * This prevents jarring background changes when using multiple devices simultaneously.
   * Background preferences are still synced on initial login via syncFromFirebase().
   */
  private applyRemoteSettings(remoteSettings: AppSettings): void {
    // Merge with defaults first, then layer remote settings
     
    const { _localTimestamp: _remoteTs, ...remoteWithoutMeta } = remoteSettings;
    const merged = { ...DEFAULT_SETTINGS, ...remoteWithoutMeta };

    // Settings to exclude from real-time sync
    // These are device-local preferences that shouldn't change while actively using the app
    // Background: Jarring to have background change while using
    // Props: Rapid cycling (P key) causes race conditions with Firebase sync
    const excludeFromRealtimeSync = new Set([
      // Background settings
      "backgroundType",
      "backgroundCategory",
      "backgroundQuality",
      "backgroundEnabled",
      "backgroundColor",
      "gradientColors",
      "gradientDirection",
      // Prop settings - prevent race condition when rapidly cycling props
      "bluePropType",
      "redPropType",
      "catDogMode",
      "selectedPresetIndex",
      "compositionRecipeOverrides",
    ]);

    // Apply to state (preserve local timestamp), excluding background settings
    for (const key in merged) {
      if (
        Object.prototype.hasOwnProperty.call(merged, key) &&
        key !== "_localTimestamp" &&
        !excludeFromRealtimeSync.has(key)
      ) {
        settingsState[key as keyof AppSettings] = merged[
          key as keyof AppSettings
        ] as never;
      }
    }
    // Clear local timestamp since we just synced from remote
    settingsState._localTimestamp = undefined;

    // NOTE: We intentionally do NOT update background here during real-time sync.
    // Background changes from other devices would be jarring during active use.
    // Background is only synced on initial login (see syncFromFirebase).

    // Bridge darkMode into AnimationVisibilityStateManager so pictographs
    // reflect the profile-level preference (it has its own localStorage key)
    if (remoteSettings.darkMode !== undefined) {
      const animVisManager = getAnimationVisibilityManager();
      if (animVisManager.isDarkMode() !== remoteSettings.darkMode) {
        animVisManager.setDarkMode(remoteSettings.darkMode);
      }
    }

    // Save to localStorage for offline access
    this.saveSettingsToStorage(settingsState);
  }

  /**
   * Clean up Firebase sync subscription and event listeners
   * Call this before signout to prevent permission errors
   */
  cleanup(): void {
    if (this.unsubscribeFirebaseSync) {
      this.unsubscribeFirebaseSync();
      this.unsubscribeFirebaseSync = null;
    }

    // Clear any pending debounced save
    if (this.firebaseSaveDebounceTimer) {
      clearTimeout(this.firebaseSaveDebounceTimer);
      this.firebaseSaveDebounceTimer = null;
    }

    // Reset sync state so next sign-in will reinitialize
    this.syncInitialized = false;
    this.firebasePersistence = null;

    // Remove online event listener
    if (browser && this.onlineHandler) {
      window.removeEventListener("online", this.onlineHandler);
      this.onlineHandler = null;
    }
  }

  // ============================================================================
  // GETTERS
  // ============================================================================

  get settings() {
    return settingsState;
  }

  get currentSettings() {
    return settingsState;
  }

  // ============================================================================
  // ACTIONS
  // ============================================================================

  async updateSetting<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ): Promise<void> {
    const previousValue = settingsState[key];

    // Skip if value hasn't changed
    if (previousValue === value) {
      return;
    }

    // CRITICAL: Direct assignment for Svelte 5 reactivity
    settingsState[key] = value;

    // Track when this change was made locally
    settingsState._localTimestamp = Date.now();

    // Update body background and theme immediately if background type changed
    if (key === "backgroundType") {
      const bgType = value as BackgroundType;
      updateBodyBackground(bgType, getCustomBackgroundOptions(settingsState));
      // Apply theme colors properly based on background type
      if (bgType === BackgroundType.SOLID_COLOR && settingsState.backgroundColor) {
        applyThemeFromColors(settingsState.backgroundColor);
      } else if (bgType === BackgroundType.LINEAR_GRADIENT && settingsState.gradientColors) {
        applyThemeFromColors(undefined, settingsState.gradientColors);
      } else {
        applyThemeForBackground(bgType);
      }
      ThemeService.updateTheme(bgType);
    }

    this.saveSettings();

    // Log settings change for analytics (non-blocking)
    try {
      const activityService = getActivityLogger();
      if (activityService) {
        void activityService.logSettingChange(
          key,
          String(previousValue),
          String(value)
        );
      }
    } catch {
      // Silently fail - activity logging is non-critical
    }
  }

  async updateSettings(newSettings: Partial<AppSettings>): Promise<void> {
    // Track if background type actually changed
    const oldBackgroundType = settingsState.backgroundType;
    const newBackgroundType = newSettings.backgroundType;
    const backgroundTypeChanged =
      newBackgroundType && newBackgroundType !== oldBackgroundType;

    // CRITICAL: In Svelte 5, we need to update individual properties to trigger reactivity
    // Object.assign doesn't trigger Svelte 5 runes reactivity
    for (const key in newSettings) {
      if (Object.prototype.hasOwnProperty.call(newSettings, key)) {
        settingsState[key as keyof AppSettings] = newSettings[
          key as keyof AppSettings
        ] as never;
      }
    }

    // Track when these changes were made locally
    settingsState._localTimestamp = Date.now();

    // ALWAYS apply theme colors when a background type is specified in newSettings
    // This ensures CSS variables are restored even if type "didn't change"
    // (the type may be the same but CSS vars may have been cleared by HMR)
    if (newBackgroundType) {
      // Only update body background if type actually changed (to avoid visual glitch)
      if (backgroundTypeChanged) {
        updateBodyBackground(
          newBackgroundType,
          getCustomBackgroundOptions(newSettings)
        );
      }
      // ALWAYS apply theme colors - CSS variables may have been cleared
      // Use settingsState since newSettings might not have all color fields
      if (newBackgroundType === BackgroundType.SOLID_COLOR && settingsState.backgroundColor) {
        applyThemeFromColors(settingsState.backgroundColor);
      } else if (newBackgroundType === BackgroundType.LINEAR_GRADIENT && settingsState.gradientColors) {
        applyThemeFromColors(undefined, settingsState.gradientColors);
      } else {
        applyThemeForBackground(newBackgroundType);
      }
      ThemeService.updateTheme(newBackgroundType);
    }

    this.saveSettings();
  }

  async loadSettings(): Promise<void> {
    const loadedSettings = this.loadSettingsFromStorage();
    Object.assign(settingsState, loadedSettings);
  }

  saveSettings(): void {
    // Always save to localStorage first (offline support)
    this.saveSettingsToStorage(settingsState);

    // If authenticated, also save to Firebase with offline queue support
    // Use debouncing to handle rapid successive updates (e.g., resetToDefaults)
    if (auth.currentUser && this.firebasePersistence) {
      this.debouncedSaveToFirebase();
    }
  }

  /**
   * Debounced Firebase save to handle rapid successive updates
   * This prevents race conditions when multiple settings are updated quickly
   * (e.g., handleResetToDefaults calls onUpdate 7+ times in a row)
   */
  private debouncedSaveToFirebase(): void {
    // Clear any existing debounce timer
    if (this.firebaseSaveDebounceTimer) {
      clearTimeout(this.firebaseSaveDebounceTimer);
    }

    // Schedule the Firebase save after debounce period
    this.firebaseSaveDebounceTimer = setTimeout(() => {
      this.firebaseSaveDebounceTimer = null;
      this.saveToFirebaseWithRetry();
    }, SettingsState.FIREBASE_SAVE_DEBOUNCE_MS);
  }

  /**
   * Save to Firebase with retry and offline queue support
   */
  private saveToFirebaseWithRetry(): void {
    if (!this.firebasePersistence) {
      debug.warn("Cannot save to Firebase: firebasePersistence not initialized");
      return;
    }

    // Mark that we're saving to prevent real-time listener from re-applying our own changes
    this.isSavingToFirebase = true;

    const settingsToSave = this.getSettingsForPersistence();
    debug.info("Saving settings to Firebase", {
      propPresetsCount: settingsToSave.propPresets?.length ?? 0,
      selectedPresetIndex: settingsToSave.selectedPresetIndex,
      bluePropType: settingsToSave.bluePropType,
      redPropType: settingsToSave.redPropType,
    });

    this.pendingFirebaseSave = this.firebasePersistence
      .saveSettings(settingsToSave)
      .then(() => {
        debug.success("Settings saved to Firebase successfully");
        // Successfully saved - clear local timestamp since Firebase is now in sync
        settingsState._localTimestamp = undefined;
        this.saveSettingsToStorage(settingsState);
        // Clear offline queue since save succeeded
        this.clearOfflineQueue();
      })
      .catch((error) => {
        console.error("❌ [SettingsState] Failed to save to Firebase:", error);
        // Queue for later if offline
        this.queueOfflineChange(settingsToSave);
      })
      .finally(() => {
        this.isSavingToFirebase = false;
        this.pendingFirebaseSave = null;
      });
  }

  /**
   * Queue settings for later sync when back online
   */
  private queueOfflineChange(settings: AppSettings): void {
    if (!browser) return;

    try {
      const queueEntry = {
        settings,
        timestamp: Date.now(),
      };
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queueEntry));
    } catch (error) {
      console.error("Failed to queue offline change:", error);
    }
  }

  /**
   * Process any queued offline changes
   */
  private async processOfflineQueue(): Promise<void> {
    if (!browser) return;

    try {
      const queuedData = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (!queuedData) return;

      const queueEntry = JSON.parse(queuedData);
      if (!queueEntry?.settings) return;

      // If we have Firebase persistence and are online, sync the queued changes
      if (this.firebasePersistence && auth.currentUser) {
        await this.firebasePersistence.saveSettings(queueEntry.settings);
        this.clearOfflineQueue();
      }
    } catch (error) {
      console.error("Failed to process offline queue:", error);
    }
  }

  /**
   * Clear the offline queue
   */
  private clearOfflineQueue(): void {
    if (!browser) return;

    try {
      localStorage.removeItem(OFFLINE_QUEUE_KEY);
    } catch (error) {
      console.error("Failed to clear offline queue:", error);
    }
  }

  clearStoredSettings(): void {
    if (!browser) return;

    try {
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
      Object.assign(settingsState, DEFAULT_SETTINGS);

      // Also clear from Firebase if authenticated
      if (auth.currentUser && this.firebasePersistence) {
        void this.firebasePersistence.clearSettings().catch((error) => {
          console.error(
            "❌ [SettingsState] Failed to clear Firebase settings:",
            error
          );
        });
      }
    } catch (error) {
      console.error("Failed to clear stored settings:", error);
    }
  }

  async resetToDefaults(): Promise<void> {
    Object.assign(settingsState, DEFAULT_SETTINGS);
    this.saveSettings();
  }

  debugSettings(): void {
    if (!browser) return;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private loadSettingsFromStorage(): AppSettings {
    if (!browser) return DEFAULT_SETTINGS;

    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!stored) {
        return DEFAULT_SETTINGS;
      }

      const parsed = JSON.parse(stored);
      const merged = { ...DEFAULT_SETTINGS, ...parsed };

      // Clean up any _localTimestamp that was incorrectly saved to localStorage
      // This metadata field should only exist in memory, never persisted
      if ("_localTimestamp" in merged) {
        delete merged._localTimestamp;
      }

      // Ensure developer mode is enabled for all tabs visibility
      if (
        merged.developerMode === false ||
        merged.developerMode === undefined
      ) {
        merged.developerMode = true;
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
      }

      // Migration: Populate empty propPresets with defaults for existing users
      if (!merged.propPresets || merged.propPresets.length === 0) {
        merged.propPresets = DEFAULT_PROP_PRESETS;
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
      }

      // Migration: Move default-Black users to Night Sky
      // Users who never changed from the old default (solid black) get the new default
      if (
        merged.backgroundType === BackgroundType.SOLID_COLOR &&
        merged.backgroundColor === "#000000"
      ) {
        merged.backgroundType = BackgroundType.NIGHT_SKY;
        delete merged.backgroundColor;
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
      }

      return merged;
    } catch (error) {
      console.warn("Failed to load settings from localStorage:", error);
      return DEFAULT_SETTINGS;
    }
  }

  private saveSettingsToStorage(settings: AppSettings): void {
    if (!browser) return;

    try {
      // Preserve _localTimestamp in localStorage so that unsaved local changes
      // survive browser close. syncFromFirebase checks this timestamp to decide
      // whether to push local → Firebase or pull Firebase → local.
      // After a successful Firebase save, _localTimestamp is set to undefined,
      // which JSON.stringify omits — so next load pulls from Firebase as expected.
      localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify(settings)
      );
    } catch (error) {
      console.error("Failed to save settings to localStorage:", error);
    }
  }
}

// Export the class for DI container
export { SettingsState };

// Singleton instance
export const settingsService = new SettingsState();

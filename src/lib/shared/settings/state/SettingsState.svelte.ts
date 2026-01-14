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
import { BackgroundType } from "../../background/shared/domain/enums/background-enums";
import {
  updateBodyBackground,
  type CustomBackgroundOptions,
} from "../../background/shared/background-preloader";
import { ThemeService } from "../../theme/services/ThemeService";
import { GridMode } from "../../pictograph/grid/domain/enums/grid-enums";
import { PropType } from "../../pictograph/prop/domain/enums/PropType";
import type { AppSettings } from "../domain/AppSettings";
import { container } from "$lib/shared/di";
import type { ISettingsPersister } from "../services/contracts/ISettingsPersister";
import { auth } from "../../auth/firebase";
import type { ISettingsState } from "../services/contracts/ISettingsState";
import type { IActivityLogger } from "../../analytics/services/contracts/IActivityLogger";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";

const debug = createComponentLogger("SettingsState");

const SETTINGS_STORAGE_KEY = "tka-modern-web-settings";
const OFFLINE_QUEUE_KEY = "tka-settings-offline-queue";

const DEFAULT_SETTINGS: AppSettings = {
  gridMode: GridMode.DIAMOND,
  // Use solidColor (black) as default to avoid flash while localStorage loads
  backgroundType: BackgroundType.SOLID_COLOR,
  backgroundQuality: "medium",
  backgroundEnabled: true,
  backgroundColor: "#000000", // Black background for solidColor
  hapticFeedback: true,
  reducedMotion: false,
  catDogMode: false, // Default: both hands use the same prop
  bluePropType: PropType.STAFF, // Default prop type for blue
  redPropType: PropType.STAFF, // Default prop type for red
  blockedStartPositions: [], // No positions blocked by default (allows all)
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
      this.firebasePersistence = container.items.settingsPersister as ISettingsPersister;
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
            // Only apply remote settings if we're not in the middle of saving
            // This prevents our own saves from being re-applied
            if (!this.isSavingToFirebase) {
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
          const isUsingDefault = localBackground === BackgroundType.SOLID_COLOR;

          if (firebaseSettings.backgroundType && isUsingDefault) {
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
            ThemeService.updateTheme(firebaseSettings.backgroundType);
            this.saveSettingsToStorage(settingsState);
            debug.success("Applied background from Firebase on initial login");
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

    // Background-related settings to exclude from real-time sync
    // These are device-local preferences that shouldn't change while actively using the app
    const excludeFromRealtimeSync = new Set([
      "backgroundType",
      "backgroundCategory",
      "backgroundQuality",
      "backgroundEnabled",
      "backgroundColor",
      "gradientColors",
      "gradientDirection",
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

    // Update body background immediately if background type changed
    if (key === "backgroundType") {
      updateBodyBackground(
        value as BackgroundType,
        getCustomBackgroundOptions(settingsState)
      );
      ThemeService.updateTheme(value as string);
    }

    this.saveSettings();

    // Log settings change for analytics (non-blocking)
    try {
      const activityService = container.items.activityLogger as IActivityLogger;
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

    // Update body background immediately ONLY if background type actually changed
    if (backgroundTypeChanged) {
      updateBodyBackground(
        newBackgroundType,
        getCustomBackgroundOptions(newSettings)
      );
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
    if (auth.currentUser && this.firebasePersistence) {
      this.saveToFirebaseWithRetry();
    }
  }

  /**
   * Save to Firebase with retry and offline queue support
   */
  private saveToFirebaseWithRetry(): void {
    if (!this.firebasePersistence) return;

    // Mark that we're saving to prevent real-time listener from re-applying our own changes
    this.isSavingToFirebase = true;

    const settingsToSave = this.getSettingsForPersistence();

    this.pendingFirebaseSave = this.firebasePersistence
      .saveSettings(settingsToSave)
      .then(() => {
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

      return merged;
    } catch (error) {
      console.warn("Failed to load settings from localStorage:", error);
      return DEFAULT_SETTINGS;
    }
  }

  private saveSettingsToStorage(settings: AppSettings): void {
    if (!browser) return;

    try {
      // Filter out _localTimestamp - it's only for in-memory conflict resolution
       
      const { _localTimestamp, ...settingsToSave } = settings;
      localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify(settingsToSave)
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

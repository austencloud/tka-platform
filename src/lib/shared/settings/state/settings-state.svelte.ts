import { getSettingsPersister } from "$lib/shared/settings/get-settings-persister";
import { browser } from "$app/environment";
import { BackgroundType } from "@austencloud/backgrounds";
import { getSceneUndoManager } from "$lib/shared/3d/undo/get-scene-undo-manager";
import {
  updateBodyBackground,
} from "../utils/background-preloader";
import { updateTheme as updateThemeService } from "../../theme/services/theme-service";
import {
  applyThemeForBackground,
} from "../../settings/utils/background-theme-calculator";
import { GridMode } from "../../pictograph/grid/domain/enums/grid-enums";
import { PropType } from "../../pictograph/prop/domain/enums/prop-type";
import type { AppSettings, PropPreset } from "../domain/app-settings";
// Dynamic import: posthog-activity-logger → posthog → $env/dynamic/public.
// Static import crashes the composition worker (no globalThis.__sveltekit_dev).
async function logSettingChange(key: string, oldValue: string | number | boolean, newValue: string | number | boolean): Promise<void> {
  const mod = await import("$lib/shared/analytics/services/posthog-activity-logger");
  return mod.logSettingChange(key, oldValue, newValue);
}
import type { FirebaseSettingsPersister } from "../services/firebase-settings-persister";
import { auth } from "../../auth/firebase";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";
import { getAnimationVisibilityManager } from "../../animation-engine/state/animation-visibility-state.svelte";

const debug = createComponentLogger("SettingsState");

const SETTINGS_STORAGE_KEY = "tka-modern-web-settings";
const OFFLINE_QUEUE_KEY = "tka-settings-offline-queue";

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

const LEGACY_THEME_MAP: Record<string, BackgroundType> = {
  nightSky: BackgroundType.COSMIC,
  deepOcean: BackgroundType.OCEAN,
  fireflyForest: BackgroundType.FOREST,
  cherryBlossom: BackgroundType.BLOSSOM,
  emberGlow: BackgroundType.EMBER,
  snowfall: BackgroundType.WINTER,
  autumnDrift: BackgroundType.AUTUMN,
  pureBlack: BackgroundType.VOID,
  solidColor: BackgroundType.VOID,
  linearGradient: BackgroundType.COSMIC,
  pride: BackgroundType.RAINBOW,
};

const DEFAULT_SETTINGS: AppSettings = {
  gridMode: GridMode.DIAMOND,
  backgroundType: BackgroundType.COSMIC,
  backgroundQuality: "medium",
  backgroundEnabled: true,
  hapticFeedback: true,
  reducedMotion: false,
  catDogMode: false,
  bluePropType: PropType.STAFF,
  redPropType: PropType.STAFF,
  blockedStartPositions: [],
  propPresets: DEFAULT_PROP_PRESETS,
  selectedPresetIndex: 0,
  darkMode: true,
} as AppSettings;

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

const settingsState = $state<AppSettings>(initialSettings);

class SettingsState {
  private firebasePersistence: FirebaseSettingsPersister | null = null;
  private unsubscribeFirebaseSync: (() => void) | null = null;
  // Fired only when settings that genuinely came off Firestore are applied.
  // Sub-managers (image composition) cache their own slice at construction, which
  // races auth restore; this is how they learn the authoritative copy arrived.
  private remoteAppliedListeners = new Set<(settings: AppSettings) => void>();
  private syncInitialized = false;
  private isSavingToFirebase = false;
  private pendingFirebaseSave: Promise<void> | null = null;
  private onlineHandler: (() => void) | null = null;
  private firebaseSaveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly FIREBASE_SAVE_DEBOUNCE_MS = 300;

  constructor() {
    if (browser && typeof window !== "undefined") {
      this.processOfflineQueue();

      this.onlineHandler = () => {
        this.processOfflineQueue();
      };
      window.addEventListener("online", this.onlineHandler);

      const sceneUndo = getSceneUndoManager();
      sceneUndo.registerDomain("scene", {
        capture: () => ({
          backgroundType: settingsState.backgroundType ?? BackgroundType.COSMIC,
          gridMode: settingsState.gridMode,
        }),
        restore: (snapshot) => {
          this.updateSetting("backgroundType", snapshot.backgroundType);
          this.updateSetting("gridMode", snapshot.gridMode);
        },
      });
    }
  }

  async initializeFirebaseSync(): Promise<void> {
    if (this.syncInitialized) return;
    this.syncInitialized = true;

    try {
      this.firebasePersistence = getSettingsPersister();
    } catch {
      console.warn(
        "⚠️ [SettingsState] Firebase persistence service not available"
      );
      return;
    }

    await this.processOfflineQueue();

    if (auth.currentUser && this.firebasePersistence) {
      await this.syncFromFirebase();

      if (this.firebasePersistence.onSettingsChange) {
        this.unsubscribeFirebaseSync =
          this.firebasePersistence.onSettingsChange((remoteSettings) => {
            if (!this.isSavingToFirebase && !this.firebaseSaveDebounceTimer) {
              this.applyRemoteSettings(remoteSettings);
            }
          });
      }
    }
  }

  async syncFromFirebase(): Promise<void> {
    if (!this.firebasePersistence || !auth.currentUser) return;

    try {
      const firebaseSettings = await this.firebasePersistence.loadSettings();
      const localTimestamp = settingsState._localTimestamp || 0;

      if (firebaseSettings) {
        if (localTimestamp > 0) {
          debug.success("Local settings are newer, pushing to Firebase");
          await this.firebasePersistence.saveSettings(
            this.getSettingsForPersistence()
          );
        } else {
          this.applyRemoteSettings(firebaseSettings);

          const localBackground = settingsState.backgroundType;
          const isUsingDefault = localBackground === BackgroundType.COSMIC;

          if (firebaseSettings.backgroundType && isUsingDefault) {
            if (LEGACY_THEME_MAP[firebaseSettings.backgroundType as string]) {
              const migratedType = LEGACY_THEME_MAP[firebaseSettings.backgroundType as string]!;
              debug.success(`Firebase has old "${firebaseSettings.backgroundType}", migrating to "${migratedType}"`);
              settingsState.backgroundType = migratedType;
              updateBodyBackground(migratedType);
              applyThemeForBackground(migratedType);
              updateThemeService(migratedType);
              this.saveSettingsToStorage(settingsState);
              await this.firebasePersistence.saveSettings(
                this.getSettingsForPersistence()
              );
            } else {
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

              updateBodyBackground(firebaseSettings.backgroundType);
              applyThemeForBackground(firebaseSettings.backgroundType);
              updateThemeService(firebaseSettings.backgroundType);
              this.saveSettingsToStorage(settingsState);
              debug.success("Applied background from Firebase on initial login");
            }
          }

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
        await this.firebasePersistence.saveSettings(
          this.getSettingsForPersistence()
        );
        debug.success("Pushed local settings to Firebase");
      }
    } catch (error) {
      console.error("❌ [SettingsState] Failed to sync from Firebase:", error);
    }
  }

  private getSettingsForPersistence(): AppSettings {
    const snapshot = $state.snapshot(settingsState) as AppSettings & { _localTimestamp?: number };
    delete snapshot._localTimestamp;
    if (!snapshot.backgroundType) {
      snapshot.backgroundType = BackgroundType.COSMIC;
    }
    const obj = snapshot as unknown as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      if (obj[key] === undefined) {
        delete obj[key];
      }
    }
    return snapshot;
  }

  private applyRemoteSettings(remoteSettings: AppSettings): void {
    const { _localTimestamp: _remoteTs, ...remoteWithoutMeta } = remoteSettings;
    const merged = { ...DEFAULT_SETTINGS, ...remoteWithoutMeta };

    const excludeFromRealtimeSync = new Set([
      "backgroundType",
      "backgroundCategory",
      "backgroundQuality",
      "backgroundEnabled",
      "backgroundColor",
      "gradientColors",
      "gradientDirection",
      "bluePropType",
      "redPropType",
      "catDogMode",
      "selectedPresetIndex",
      "compositionRecipeOverrides",
      "visibility",
    ]);

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
    settingsState._localTimestamp = undefined;

    if (remoteSettings.darkMode !== undefined) {
      const animVisManager = getAnimationVisibilityManager();
      if (animVisManager.isDarkMode() !== remoteSettings.darkMode) {
        animVisManager.setDarkMode(remoteSettings.darkMode);
      }
    }

    this.saveSettingsToStorage(settingsState);

    this.remoteAppliedListeners.forEach((listener) => {
      try {
        listener(remoteSettings);
      } catch (error) {
        console.error("❌ [SettingsState] Remote-applied listener failed:", error);
      }
    });
  }

  /**
   * Subscribe to settings that arrived from Firestore (initial sync or a live
   * snapshot). Distinct from reading `currentSettings`, which at boot is just the
   * localStorage mirror and can be older than both the local slice stores and the
   * server copy.
   */
  onRemoteSettingsApplied(listener: (settings: AppSettings) => void): () => void {
    this.remoteAppliedListeners.add(listener);
    return () => this.remoteAppliedListeners.delete(listener);
  }

  cleanup(): void {
    if (this.unsubscribeFirebaseSync) {
      this.unsubscribeFirebaseSync();
      this.unsubscribeFirebaseSync = null;
    }

    if (this.firebaseSaveDebounceTimer) {
      clearTimeout(this.firebaseSaveDebounceTimer);
      this.firebaseSaveDebounceTimer = null;
    }

    this.syncInitialized = false;
    this.firebasePersistence = null;

    if (browser && typeof window !== "undefined" && this.onlineHandler) {
      window.removeEventListener("online", this.onlineHandler);
      this.onlineHandler = null;
    }
  }

  get settings() {
    return settingsState;
  }

  get currentSettings() {
    return settingsState;
  }

  async updateSetting<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ): Promise<void> {
    const previousValue = settingsState[key];

    if (previousValue === value) {
      return;
    }

    const isSceneUndoable = key === "backgroundType" || key === "gridMode";
    if (isSceneUndoable) {
      const sceneUndo = getSceneUndoManager();
      const opType = key === "backgroundType" ? "change-environment" as const : "change-grid-mode" as const;
      const desc = key === "backgroundType" ? `Environment: ${value}` : `Grid: ${value}`;
      sceneUndo.captureState(opType, desc);
    }

    settingsState[key] = value;

    settingsState._localTimestamp = Date.now();

    if (key === "backgroundType") {
      const bgType = value as BackgroundType;
      updateBodyBackground(bgType);
      applyThemeForBackground(bgType);
      updateThemeService(bgType);
    }

    this.saveSettings();

    if (isSceneUndoable) {
      getSceneUndoManager().commitState();
    }

    try {
      void logSettingChange(
        key,
        String(previousValue),
        String(value)
      );
    } catch {
      // Silent
    }
  }

  async updateSettings(newSettings: Partial<AppSettings>): Promise<void> {
    const oldBackgroundType = settingsState.backgroundType;
    const newBackgroundType = newSettings.backgroundType;
    const backgroundTypeChanged =
      newBackgroundType && newBackgroundType !== oldBackgroundType;

    for (const key in newSettings) {
      if (Object.prototype.hasOwnProperty.call(newSettings, key)) {
        settingsState[key as keyof AppSettings] = newSettings[
          key as keyof AppSettings
        ] as never;
      }
    }

    settingsState._localTimestamp = Date.now();

    if (newBackgroundType) {
      if (backgroundTypeChanged) {
        updateBodyBackground(newBackgroundType);
      }
      applyThemeForBackground(newBackgroundType);
      updateThemeService(newBackgroundType);
    }

    this.saveSettings();
  }

  async loadSettings(): Promise<void> {
    const loadedSettings = this.loadSettingsFromStorage();
    Object.assign(settingsState, loadedSettings);
  }

  saveSettings(): void {
    this.saveSettingsToStorage(settingsState);

    if (auth.currentUser && this.firebasePersistence) {
      this.debouncedSaveToFirebase();
    }
  }

  private debouncedSaveToFirebase(): void {
    if (this.firebaseSaveDebounceTimer) {
      clearTimeout(this.firebaseSaveDebounceTimer);
    }

    this.firebaseSaveDebounceTimer = setTimeout(() => {
      this.firebaseSaveDebounceTimer = null;
      this.saveToFirebaseWithRetry();
    }, SettingsState.FIREBASE_SAVE_DEBOUNCE_MS);
  }

  private saveToFirebaseWithRetry(): void {
    if (!this.firebasePersistence) {
      debug.warn("Cannot save to Firebase: firebasePersistence not initialized");
      return;
    }

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
        settingsState._localTimestamp = undefined;
        this.saveSettingsToStorage(settingsState);
        this.clearOfflineQueue();
      })
      .catch((error) => {
        console.error("❌ [SettingsState] Failed to save to Firebase:", error);
        this.queueOfflineChange(settingsToSave);
      })
      .finally(() => {
        this.isSavingToFirebase = false;
        this.pendingFirebaseSave = null;
      });
  }

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

  private async processOfflineQueue(): Promise<void> {
    if (!browser) return;

    try {
      const queuedData = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (!queuedData) return;

      const queueEntry = JSON.parse(queuedData);
      if (!queueEntry?.settings) return;

      if (this.firebasePersistence && auth.currentUser) {
        await this.firebasePersistence.saveSettings(queueEntry.settings);
        this.clearOfflineQueue();
      }
    } catch (error) {
      console.error("Failed to process offline queue:", error);
    }
  }

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

  private loadSettingsFromStorage(): AppSettings {
    if (!browser) return DEFAULT_SETTINGS;

    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!stored) {
        return DEFAULT_SETTINGS;
      }

      const parsed = JSON.parse(stored);
      const merged = { ...DEFAULT_SETTINGS, ...parsed };

      if ("_localTimestamp" in merged) {
        delete merged._localTimestamp;
      }

      if (
        merged.developerMode === false ||
        merged.developerMode === undefined
      ) {
        merged.developerMode = true;
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
      }

      if (!merged.propPresets || merged.propPresets.length === 0) {
        merged.propPresets = DEFAULT_PROP_PRESETS;
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
      }

      const migrated = LEGACY_THEME_MAP[merged.backgroundType as string];
      if (migrated) {
        merged.backgroundType = migrated;
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
      localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify($state.snapshot(settings))
      );
    } catch (error) {
      console.error("Failed to save settings to localStorage:", error);
    }
  }
}

export { SettingsState };

export const settingsService = new SettingsState();

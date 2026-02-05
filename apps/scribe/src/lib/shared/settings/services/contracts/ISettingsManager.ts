/**
 * Settings Service Interface
 *
 * Interface for managing application settings and user preferences.
 * Handles loading, saving, and updating application configuration.
 * Supports both localStorage (offline) and Firebase (cross-device sync).
 */

import type { AppSettings } from "../../domain/AppSettings";

export interface ISettingsState {
  currentSettings: AppSettings;
  settings: AppSettings;
  updateSetting<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ): void;
  updateSettings(settings: Partial<AppSettings>): void;
  loadSettings(): void;
  clearStoredSettings(): void;
  debugSettings(): void;
  resetToDefaults(): void;

  /**
   * Initialize Firebase sync for authenticated users.
   * Should be called after the DI container is ready and user authenticates.
   */
  initializeFirebaseSync?(): Promise<void>;

  /**
   * Sync settings from Firebase.
   * Typically called on user login to merge cloud settings.
   */
  syncFromFirebase?(): Promise<void>;

  /**
   * Clean up Firebase sync subscription.
   * Should be called on logout or when component unmounts.
   */
  cleanup?(): void;
}

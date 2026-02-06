/**
 * Settings Persistence Service Interface
 *
 * Defines the contract for persisting user settings.
 * Implementations can use localStorage, Firebase, or other storage backends.
 */

import type { AppSettings } from "../../domain/AppSettings";

export interface ISettingsPersister {
  /**
   * Load settings from storage
   * Returns the stored settings or null if not found
   */
  loadSettings(): Promise<AppSettings | null>;

  /**
   * Save settings to storage
   * @param settings - The settings to persist
   */
  saveSettings(settings: AppSettings): Promise<void>;

  /**
   * Clear all stored settings
   */
  clearSettings(): Promise<void>;

  /**
   * Check if settings exist in storage
   */
  hasSettings(): Promise<boolean>;

  /**
   * Subscribe to settings changes from other devices/tabs
   * @param callback - Called when settings change remotely
   * @returns Unsubscribe function
   */
  onSettingsChange?(callback: (settings: AppSettings) => void): () => void;
}

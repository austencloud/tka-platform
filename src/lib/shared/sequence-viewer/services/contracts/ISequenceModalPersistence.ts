/**
 * Persists sequence modal user preferences to localStorage.
 */

export type ViewMode = "animation" | "image" | "split";

export interface ImageSettings {
  word: boolean;
  startPos: boolean;
  difficulty: boolean;
  creatorName: boolean;
  notes: boolean;
  darkMode: boolean;
}

export interface ISequenceModalPersistence {
  /**
   * Load the saved view mode (defaults to "split")
   */
  loadViewMode(): ViewMode;

  /**
   * Save the current view mode
   */
  saveViewMode(mode: ViewMode): void;

  /**
   * Load a specific image setting
   */
  loadImageSetting(key: keyof ImageSettings, defaultValue: boolean): boolean;

  /**
   * Save a specific image setting
   */
  saveImageSetting(key: keyof ImageSettings, value: boolean): void;

  /**
   * Load the column count setting (null = auto)
   */
  loadColumnCount(): number | null;

  /**
   * Save the column count setting
   */
  saveColumnCount(value: number | null): void;

  /**
   * Load all image settings at once
   */
  loadAllImageSettings(): ImageSettings;
}

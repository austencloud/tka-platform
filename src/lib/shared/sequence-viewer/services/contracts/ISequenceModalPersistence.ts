/**
 * Persists sequence modal user preferences to localStorage.
 *
 * Note: Image visibility settings are now managed by ImageCompositionManager
 * for Firebase sync. This service only handles modal-specific settings.
 */

export type ViewMode = "animation" | "image" | "split";

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
   * Load the column count setting (null = auto)
   */
  loadColumnCount(): number | null;

  /**
   * Save the column count setting
   */
  saveColumnCount(value: number | null): void;
}

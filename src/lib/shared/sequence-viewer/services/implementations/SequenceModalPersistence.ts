import type {
  ISequenceModalPersistence,
  ViewMode,
} from "../contracts/ISequenceModalPersistence";

const STORAGE_KEYS = {
  viewMode: "tka_sequence_details_view_mode",
  columnCount: "tka_seq_details_img_columnCount",
} as const;

/**
 * Persists sequence modal user preferences to localStorage.
 *
 * Note: Image visibility settings are now managed by ImageCompositionManager
 * for Firebase sync. This service only handles modal-specific settings.
 */
export class SequenceModalPersistence implements ISequenceModalPersistence {
  loadViewMode(): ViewMode {
    if (typeof localStorage === "undefined") return "split";

    const saved = localStorage.getItem(STORAGE_KEYS.viewMode);
    // Valid animation/split modes
    if (saved === "animation" || saved === "split") {
      return saved;
    }
    // "image" saved mode gets converted to "split" so animation is visible
    // (spacebar implies wanting to see animation, not static image)
    return "split";
  }

  saveViewMode(mode: ViewMode): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.viewMode, mode);
  }

  loadColumnCount(): number | null {
    if (typeof localStorage === "undefined") return null;

    const saved = localStorage.getItem(STORAGE_KEYS.columnCount);
    if (saved !== null && saved !== "null") {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed)) return parsed;
    }
    return null; // Auto
  }

  saveColumnCount(value: number | null): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.columnCount, String(value));
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const sequenceModalPersistence = new SequenceModalPersistence();

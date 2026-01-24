import type {
  ISequenceModalPersistence,
  ViewMode,
  ImageSettings,
} from "../contracts/ISequenceModalPersistence";

const STORAGE_KEYS = {
  viewMode: "tka_sequence_details_view_mode",
  imagePrefix: "tka_seq_details_img_",
  columnCount: "tka_seq_details_img_columnCount",
} as const;

/**
 * Persists sequence modal user preferences to localStorage.
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

  loadImageSetting(key: keyof ImageSettings, defaultValue: boolean): boolean {
    if (typeof localStorage === "undefined") return defaultValue;

    const saved = localStorage.getItem(`${STORAGE_KEYS.imagePrefix}${key}`);
    if (saved !== null) return saved === "true";
    return defaultValue;
  }

  saveImageSetting(key: keyof ImageSettings, value: boolean): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(`${STORAGE_KEYS.imagePrefix}${key}`, String(value));
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

  loadAllImageSettings(): ImageSettings {
    return {
      word: this.loadImageSetting("word", true),
      startPos: this.loadImageSetting("startPos", true),
      difficulty: this.loadImageSetting("difficulty", true),
      creatorName: this.loadImageSetting("creatorName", true),
      notes: this.loadImageSetting("notes", true),
      darkMode: this.loadImageSetting("darkMode", false),
    };
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const sequenceModalPersistence = new SequenceModalPersistence();

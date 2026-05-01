import type {
  ISequenceModalPersistence,
  ViewMode,
} from "../contracts/ISequenceModalPersistence";

const STORAGE_KEYS = {
  viewMode: "tka_sequence_details_view_mode",
  columnCount: "tka_seq_details_img_columnCount",
} as const;

export class SequenceModalPersistence implements ISequenceModalPersistence {
  loadViewMode(): ViewMode {
    if (typeof localStorage === "undefined") return "split";

    const saved = localStorage.getItem(STORAGE_KEYS.viewMode);
    if (saved === "animation" || saved === "split") {
      return saved;
    }
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
    return null; 
  }

  saveColumnCount(value: number | null): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.columnCount, String(value));
  }
}

export const sequenceModalPersistence = new SequenceModalPersistence();

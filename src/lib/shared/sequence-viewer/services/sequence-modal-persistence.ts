export type ViewMode = "animation" | "image" | "split";

const STORAGE_KEYS = {
  viewMode: "tka_sequence_details_view_mode",
  columnCount: "tka_seq_details_img_columnCount",
} as const;

export function loadViewMode(): ViewMode {
  if (typeof localStorage === "undefined") return "split";

  const saved = localStorage.getItem(STORAGE_KEYS.viewMode);
  if (saved === "animation" || saved === "split") {
    return saved;
  }
  return "split";
}

export function saveViewMode(mode: ViewMode): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.viewMode, mode);
}

export function loadColumnCount(): number | null {
  if (typeof localStorage === "undefined") return null;

  const saved = localStorage.getItem(STORAGE_KEYS.columnCount);
  if (saved !== null && saved !== "null") {
    const parsed = parseInt(saved, 10);
    if (!isNaN(parsed)) return parsed;
  }
  return null;
}

export function saveColumnCount(value: number | null): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.columnCount, String(value));
}

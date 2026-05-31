export type ViewMode = "animation" | "image" | "split";

const STORAGE_KEYS = {
  viewMode: "tka_sequence_details_view_mode",
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

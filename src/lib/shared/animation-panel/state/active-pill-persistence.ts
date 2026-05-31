import type { PillId } from "../pill-nav/pill-types";
import { PILL_ORDER } from "../pill-nav/pill-types";

// Remembers which AnimationPanel section the user had open, so the sidebar
// reopens to it instead of an empty rail. Sidebar-scoped only — the mobile
// bottom sheet stays closed on mount so it never pops open unbidden.
const STORAGE_KEY = "tka_animation_panel_active_pill";

export function loadActivePill(fallback: PillId = "effects"): PillId {
  if (typeof localStorage === "undefined") return fallback;
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && (PILL_ORDER as readonly string[]).includes(saved)) {
    return saved as PillId;
  }
  return fallback;
}

export function saveActivePill(pill: PillId): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, pill);
}

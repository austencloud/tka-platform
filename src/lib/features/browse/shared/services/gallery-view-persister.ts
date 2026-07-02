/**
 * GalleryViewPersister
 *
 * Persists where the user is inside the browse gallery to sessionStorage:
 * - Survives reloads and HMR (parallel dev sessions churn the page constantly)
 * - Clears when the browser tab closes, so a fresh session still lands on the
 *   drill with clean filters (the "fresh drill counts" invariant in
 *   BrowseModule stays intact — stale localStorage filters are only kept when
 *   THIS session was mid-browse).
 *
 * The engine already persists filters/sort/source itself (localStorage,
 * `tka-browse-gallery`); this records the two things it can't know: which
 * gallery view is showing (drill vs grid) and the live search query.
 */

const GALLERY_VIEW_KEY = "tka_gallery_view";
const DRILL_SECTION_KEY = "tka_gallery_drill_section";

export interface GalleryViewState {
  view: "start-here" | "browse-all";
  search: string;
}

export function getGalleryViewState(): GalleryViewState | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(GALLERY_VIEW_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GalleryViewState>;
    if (parsed.view !== "start-here" && parsed.view !== "browse-all") return null;
    return {
      view: parsed.view,
      search: typeof parsed.search === "string" ? parsed.search : "",
    };
  } catch {
    return null;
  }
}

export function setGalleryViewState(state: GalleryViewState): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(GALLERY_VIEW_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors (quota, private mode)
  }
}

/**
 * Drill sub-screen (chooser / level / family / ...). Stored as a raw string —
 * GalleryDrill validates it against its own Section union on restore, so a
 * stale value from an older build degrades to the chooser instead of crashing.
 */
export function getDrillSection(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(DRILL_SECTION_KEY);
}

export function setDrillSection(section: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(DRILL_SECTION_KEY, section);
  } catch {
    // Ignore storage errors
  }
}

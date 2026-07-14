/**
 * Reactive singleton for the guide reader's frame mode (sheet vs flow), persisted
 * per-user. Mirrors page-number-prefs.svelte.ts, plus localStorage round-trip.
 * Default: sheet (print-faithful) on first load; the reader nudges to flow on
 * mobile. SSR-safe (guards window/localStorage).
 */
export type GuideFrame = "sheet" | "flow";

const KEY = "guide-frame-mode";

function initial(): GuideFrame {
  if (typeof window === "undefined") return "sheet";
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "flow" || v === "sheet" ? v : "sheet";
  } catch {
    return "sheet";
  }
}

export const guideFramePrefs = $state<{ frame: GuideFrame }>({ frame: initial() });

export function setGuideFrame(frame: GuideFrame): void {
  guideFramePrefs.frame = frame;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, frame);
  } catch {
    // private mode / disabled — the choice just won't persist
  }
}

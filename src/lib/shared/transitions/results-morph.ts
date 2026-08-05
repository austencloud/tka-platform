/**
 * The one seam for "a filter changed — morph the results grid instead of
 * blinking it".
 *
 * The app disables `::view-transition-old/new(root)` globally
 * (`view-transitions.css`), so a same-document view transition only shows where
 * a NAMED element moves. Every results card already carries a `sequence-<id>`
 * name, which is why wrapping a filter mutation makes the grid rearrange:
 * cards that leave fade out, cards that stay slide into the freed space.
 *
 * Austen (2026-08-05) asked for that motion on EVERY filtering path, not just
 * the value tap it shipped on. The paths live in four different files
 * (GalleryDrill, BrowseModule, BrowseToolbar, BrowsePanel), so the wrapper is
 * here rather than `document.startViewTransition` sprayed across call sites —
 * one seam is what keeps the next path that gets added consistent with these.
 *
 * `withResultsMorph` is inert unless a surface has declared a live results grid
 * (`setResultsMorphActive`). That keeps the shared browse components safe to
 * wrap: on every other host — the grid tab, the filter sheet, narrow phones,
 * the Smart Collection builder — the mutation runs exactly as it does today.
 */
import { flushSync } from "svelte";

/** Surfaces currently rendering a live results grid whose changes should morph.
 *  A set (not a boolean) because a sheet can mount over the gallery: the sheet
 *  reporting "not live" must not clear the gallery's own claim. */
const liveSurfaces = new Set<object>();

/** One transition at a time. Starting a second while one runs makes the browser
 *  skip the first, which reads as a snap — worse than not animating. A search
 *  keystroke landing mid-morph just applies plainly. */
let inFlight = false;

/**
 * Declare (or withdraw) a surface's live results grid.
 * `owner` is any stable per-component object; pass the same one to withdraw.
 */
export function setResultsMorphActive(owner: object, active: boolean): void {
  if (active) liveSurfaces.add(owner);
  else liveSurfaces.delete(owner);
}

/** True when some mounted surface is showing results that should morph. */
export function isResultsMorphActive(): boolean {
  return liveSurfaces.size > 0;
}

function morphUnavailable(): boolean {
  if (typeof document === "undefined") return true;
  if (!document.startViewTransition) return true;
  if (inFlight) return true;
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Run `mutate` inside a same-document view transition, unconditionally (the
 * caller has already decided the motion is wanted — e.g. the landing↔workspace
 * morph, which is not gated on a results grid).
 *
 * Returns the transition so a caller can await `ready`/`finished`, or null when
 * it ran plainly.
 */
export function startMorph(mutate: () => void): ViewTransition | null {
  if (morphUnavailable()) {
    mutate();
    return null;
  }
  inFlight = true;
  // Svelte batches; the browser captures the "after" frame the moment this
  // callback returns, so the DOM has to be current BEFORE it does.
  const transition = document.startViewTransition(() => flushSync(mutate));
  void transition.finished.catch(() => {}).finally(() => {
    inFlight = false;
  });
  return transition;
}

/**
 * Run a results-changing mutation through the morph when a live results grid is
 * on screen, and plainly otherwise. This is what filter call sites call.
 */
export function withResultsMorph(mutate: () => void): ViewTransition | null {
  if (!isResultsMorphActive()) {
    mutate();
    return null;
  }
  return startMorph(mutate);
}

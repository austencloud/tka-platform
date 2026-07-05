import { cubicOut } from "svelte/easing";
import type { TransitionConfig } from "svelte/transition";
import { motionDuration } from "./motion";
import { DURATION } from "./transitions";

interface DockSlideParams {
  /** Fade/slide length in ms. Defaults to DURATION.emphasis (280). */
  duration?: number;
  /** Horizontal glide distance in px. The panel eases in from this far right. */
  distance?: number;
}

/**
 * Inline-dock reveal for a right-docked flex sibling (the Choreo add-sequences
 * picker + saved-acts dock). Animates the element's own width so the neighbour
 * (the preview) reflows smoothly instead of being shoved when the dock mounts —
 * a translateX glide + fade on top gives it a from-the-right feel.
 *
 * This is NOT a crossfade (single enter/exit, no second state) — the correct
 * primitive per crossfade-primitive rules. `Drawer.svelte` is deliberately not
 * reused: it is a modal overlay (backdrop, inert siblings), whereas these docks
 * stay inline so the page remains fully visible.
 *
 * PERF CONTRACT: pin the dock's direct children at the dock's final width in
 * consumer CSS (e.g. `.dock > :global(*) { width: <final>; }`). The children
 * then lay out ONCE and the width animation becomes a pure clip-reveal —
 * without the pin, every frame re-lays-out the children (virtualized grids
 * re-measure per frame; traced at 180ms+ of reflow on the Choreo picker).
 *
 * Reduced-motion collapses the whole thing to an instant show/hide.
 */
/**
 * Width cache keyed by element. The outro's rect read used to force a full
 * layout of a style-dirty document (traced at 103ms with the gallery mounted);
 * the intro already measured the same final width, so reuse it. A window
 * resize between intro and outro yields a marginally stale start width — the
 * collapse still lands at 0, visually indistinguishable.
 */
const widthCache = new WeakMap<HTMLElement, number>();

export function dockSlide(
  node: HTMLElement,
  { duration = DURATION.emphasis, distance = 24 }: DockSlideParams = {}
): TransitionConfig {
  let width = widthCache.get(node);
  if (width === undefined) {
    width = node.getBoundingClientRect().width;
    widthCache.set(node, width);
  }

  return {
    duration: motionDuration(duration),
    easing: cubicOut,
    css: (t) =>
      `width: ${t * width}px; opacity: ${t}; ` +
      `transform: translateX(${(1 - t) * distance}px); overflow: hidden;`,
  };
}

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
 * Reduced-motion collapses the whole thing to an instant show/hide.
 */
export function dockSlide(
  node: HTMLElement,
  { duration = DURATION.emphasis, distance = 24 }: DockSlideParams = {}
): TransitionConfig {
  const width = node.getBoundingClientRect().width;

  return {
    duration: motionDuration(duration),
    easing: cubicOut,
    css: (t) =>
      `width: ${t * width}px; opacity: ${t}; ` +
      `transform: translateX(${(1 - t) * distance}px); overflow: hidden;`,
  };
}

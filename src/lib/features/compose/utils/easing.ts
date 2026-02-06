/**
 * Easing Functions
 *
 * Utility module for animation easing curves.
 * Used by playback controller for beat-to-beat transitions.
 */

import type { EasingType } from "../tabs/playback/state/playback-state.svelte";

/**
 * Apply easing function to a progress value (0-1)
 * @param progress - Input progress value (0-1)
 * @param easingType - Type of easing to apply
 * @returns Eased progress value (0-1)
 */
export function applyEasing(progress: number, easingType: EasingType): number {
  // Clamp input to 0-1
  const t = Math.max(0, Math.min(1, progress));

  switch (easingType) {
    case "linear":
      return t;

    case "ease-in":
      // Cubic ease-in: slow start, fast end
      return t * t * t;

    case "ease-out":
      // Cubic ease-out: fast start, slow end
      return 1 - Math.pow(1 - t, 3);

    case "ease-in-out":
      // Cubic ease-in-out: slow start and end, fast middle
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    default:
      return t;
  }
}

/**
 * Easing function descriptions for UI
 */
export const EASING_DESCRIPTIONS: Record<EasingType, string> = {
  linear: "Constant speed",
  "ease-in": "Slow start, fast end",
  "ease-out": "Fast start, slow end",
  "ease-in-out": "Smooth acceleration and deceleration",
};

/**
 * Easing function display labels for UI
 */
export const EASING_LABELS: Record<EasingType, string> = {
  linear: "Linear",
  "ease-in": "Ease In",
  "ease-out": "Ease Out",
  "ease-in-out": "Ease Both",
};

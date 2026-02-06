/**
 * Timeline Mode State
 *
 * Duration-proportional display is now always enabled.
 * Step grid cells are sized proportionally to their duration,
 * so a duration:2.0 step takes twice the horizontal space as a duration:1.0 step.
 */

/**
 * Timeline mode is always enabled - duration affects pictograph size
 */
export function getIsTimelineMode(): boolean {
  return true;
}

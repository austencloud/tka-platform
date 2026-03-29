/**
 * Canonical difficulty level styles.
 *
 * Re-exported from @tka/render-composition (single source of truth).
 * Both the Svelte UI badges and the canvas image compositor read from here.
 */

export {
  DIFFICULTY_LEVELS,
  DIFFICULTY_FONT_FAMILY,
  DEFAULT_DIFFICULTY_STYLE,
  applyGradientStops,
} from "@tka/render-composition";
export type { DifficultyLevel, GradientStop } from "@tka/render-composition";

// Backwards-compat alias — the package calls it DifficultyLevel
export type { DifficultyLevel as DifficultyLevelStyle } from "@tka/render-composition";

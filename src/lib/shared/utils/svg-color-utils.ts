/**
 * Compatibility facade for the shared browser/Node SVG color pipeline.
 *
 * Keep the established app import path while SvelteKit consumes the package's
 * watched source and Node consumers use its compiled build.
 */
export {
  ACCENT_COLORS_TO_PRESERVE,
  MOTION_COLOR_MAP,
  SELECTIVE_COLOR_PROP_TYPES,
  getMotionColor,
  shouldPreserveColor,
  applyColorToSvg,
  applyMotionColorToSvg,
} from "@tka/render-core";

export type {
  ThemeMode,
  SvgColorOptions,
  MotionSvgColorOptions,
} from "@tka/render-core";

/**
 * SVG Color Transformation Service
 *
 * Applies color transformations to SVG content.
 *
 * Theme mode can be passed explicitly (for exports) or defaults to
 * reading from AnimationVisibilityStateManager (for live display).
 */

import type { MotionColor } from "../../../shared/domain/enums/pictograph-enums";
import {
  getMotionColor,
  type ThemeMode,
} from "../../../../utils/svg-color-utils";
import { getAnimationVisibilityManager } from "../../../../animation-engine/state/animation-visibility-state.svelte";

function getCurrentThemeMode(): ThemeMode {
  try {
    const manager = getAnimationVisibilityManager();
    return manager.isDarkMode() ? "dark" : "light";
  } catch {
    return "light";
  }
}

/**
 * Apply color transformation to SVG content.
 * Simple and correct: arrows are blue by default, change to red when needed.
 * Also makes CSS class names unique to prevent conflicts between different colored arrows.
 * @param themeMode Optional explicit theme mode. If not provided, uses global state.
 */
export function applyColorToSvg(
  svgText: string,
  color: MotionColor,
  themeMode?: ThemeMode
): string {
  const effectiveThemeMode = themeMode ?? getCurrentThemeMode();
  const targetColor = getMotionColor(color, effectiveThemeMode);

  let coloredSvg = svgText.replace(
    /fill="#[0-9A-Fa-f]{6}"/g,
    `fill="${targetColor}"`
  );
  coloredSvg = coloredSvg.replace(
    /fill:\s*#[0-9A-Fa-f]{6}/g,
    `fill:${targetColor}`
  );
  coloredSvg = coloredSvg.replace(
    /stroke="#[0-9A-Fa-f]{6}"/g,
    `stroke="${targetColor}"`
  );
  coloredSvg = coloredSvg.replace(
    /stroke:\s*#[0-9A-Fa-f]{6}/g,
    `stroke:${targetColor}`
  );

  coloredSvg = coloredSvg.replace(
    /<(path|polygon|circle|rect|ellipse)([^>]*?)class="st\d+"([^>]*?)>/g,
    (match, tag, before, after) => {
      if (before.includes('style="') || after.includes('style="')) {
        return match.replace(
          /style="([^"]*)"/,
          `style="$1;fill:${targetColor}"`
        );
      }
      return `<${tag}${before}class="st0"${after} style="fill:${targetColor}">`;
    }
  );

  const colorSuffix = color.toLowerCase();
  coloredSvg = coloredSvg.replace(/\.st(\d+)/g, `.st$1-${colorSuffix}`);
  coloredSvg = coloredSvg.replace(
    /class="st(\d+)"/g,
    `class="st$1-${colorSuffix}"`
  );

  coloredSvg = coloredSvg.replace(/<circle[^>]*id="centerPoint"[^>]*\/?>/, "");

  return coloredSvg;
}

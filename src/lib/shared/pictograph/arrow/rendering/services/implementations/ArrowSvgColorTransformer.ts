/**
 * SVG Color Transformation Service
 *
 * Applies color transformations to SVG content.
 * Extracted from ArrowRenderer to improve modularity and reusability.
 *
 * Theme mode can be passed explicitly (for exports) or defaults to
 * reading from AnimationVisibilityStateManager (for live display).
 */

import type { ISvgColorTransformer as IArrowSvgColorTransformer } from "../contracts/IArrowSvgColorTransformer";
import type { MotionColor } from "../../../../shared/domain/enums/pictograph-enums";
import {
  getMotionColor,
  type ThemeMode,
} from "../../../../../utils/svg-color-utils";
import { injectable } from "inversify";
import { getAnimationVisibilityManager } from "../../../../../animation-engine/state/animation-visibility-state.svelte";

@injectable()
export class ArrowSvgColorTransformer implements IArrowSvgColorTransformer {
  /**
   * Get the current theme mode based on dark mode setting
   * Dark mode (Dark Mode) = "dark" theme, Light mode = "light" theme
   */
  private getCurrentThemeMode(): ThemeMode {
    try {
      const manager = getAnimationVisibilityManager();
      return manager.isDarkMode() ? "dark" : "light";
    } catch {
      // Fallback to light mode if manager not available
      return "light";
    }
  }

  /**
   * Set the current theme mode for color selection
   * @deprecated Use getCurrentThemeMode() instead - theme mode is now read dynamically
   */
  setThemeMode(_mode: ThemeMode): void {
    // No-op - theme mode is now read dynamically from AnimationVisibilityStateManager
  }

  /**
   * Apply color transformation to SVG content
   * Simple and correct: arrows are blue by default, change to red when needed
   * Also makes CSS class names unique to prevent conflicts between different colored arrows
   * @param themeMode Optional explicit theme mode. If not provided, uses global state.
   */
  applyColorToSvg(
    svgText: string,
    color: MotionColor,
    themeMode?: ThemeMode
  ): string {
    // Use explicit theme mode if provided, otherwise fall back to global state
    const effectiveThemeMode = themeMode ?? this.getCurrentThemeMode();
    const targetColor = getMotionColor(color, effectiveThemeMode);

    // Replace fill colors in both attribute and CSS style formats
    let coloredSvg = svgText.replace(
      /fill="#[0-9A-Fa-f]{6}"/g,
      `fill="${targetColor}"`
    );
    coloredSvg = coloredSvg.replace(
      /fill:\s*#[0-9A-Fa-f]{6}/g,
      `fill:${targetColor}`
    );

    // Handle CSS class-based fills (Illustrator exports use .st0, .st1 classes)
    // Add inline fill style to path elements that use class-based styling
    // This overrides any CSS class fill with our target color
    coloredSvg = coloredSvg.replace(
      /<(path|polygon|circle|rect|ellipse)([^>]*?)class="st\d+"([^>]*?)>/g,
      (match, tag, before, after) => {
        // Check if there's already an inline style
        if (before.includes('style="') || after.includes('style="')) {
          // Append to existing style
          return match.replace(/style="([^"]*)"/, `style="$1;fill:${targetColor}"`);
        }
        // Add new style attribute
        return `<${tag}${before}class="st0"${after} style="fill:${targetColor}">`;
      }
    );

    // DASH ARROW SCALING FIX
    // Apply scaling transformation to dash arrows to match size of other arrows
    const viewBoxMatch = svgText.match(/viewBox="([^"]+)"/);
    if (viewBoxMatch?.[1]) {
      const viewBoxValues = viewBoxMatch[1].split(/\s+/).map(Number);
      const viewBoxWidth = viewBoxValues[2] || 100;
      const viewBoxHeight = viewBoxValues[3] || 100;

      // Detect dash arrows by small viewBox size
      const isDashArrow = viewBoxWidth < 50 && viewBoxHeight < 50;
      if (isDashArrow) {
        // Calculate scale factor to match other arrows
        const targetSize = 250;
        const currentSize = Math.max(viewBoxWidth, viewBoxHeight);
        const scaleFactor = targetSize / currentSize;

        // Update the viewBox to the scaled size
        const newViewBox = `0 0 ${viewBoxWidth * scaleFactor} ${viewBoxHeight * scaleFactor}`;
        coloredSvg = coloredSvg.replace(
          /viewBox="[^"]*"/,
          `viewBox="${newViewBox}"`
        );

        // Add scale transform to all path and shape elements
        coloredSvg = coloredSvg.replace(
          /<(path|circle|rect|ellipse|polygon|polyline)([^>]*?)>/g,
          `<$1$2 transform="scale(${scaleFactor})">`
        );
      }
    }

    // Make CSS class names unique for each color to prevent conflicts
    // Replace .st0, .st1, etc. with .st0-blue, .st1-blue, etc.
    const colorSuffix = color.toLowerCase();
    coloredSvg = coloredSvg.replace(/\.st(\d+)/g, `.st$1-${colorSuffix}`);

    // Also update class references in elements
    coloredSvg = coloredSvg.replace(
      /class="st(\d+)"/g,
      `class="st$1-${colorSuffix}"`
    );

    // Remove the centerPoint circle entirely to prevent unwanted visual elements
    coloredSvg = coloredSvg.replace(
      /<circle[^>]*id="centerPoint"[^>]*\/?>/,
      ""
    );

    return coloredSvg;
  }
}

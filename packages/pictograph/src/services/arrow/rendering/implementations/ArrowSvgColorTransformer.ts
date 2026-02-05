/**
 * SVG Color Transformation Service
 *
 * Applies color transformations to SVG content.
 * Uses PictographConfig.getDarkMode() instead of global singleton.
 */

import type { IArrowSvgColorTransformer } from "../contracts/IArrowSvgColorTransformer";
import type { MotionColor } from "@tka/types";
import {
  getMotionColor,
  type ThemeMode,
} from "../../../../utils/svg-color-utils";
import type { PictographConfig } from "../../../../config/PictographConfig";

export class ArrowSvgColorTransformer implements IArrowSvgColorTransformer {
  constructor(private readonly config?: PictographConfig) {}

  private getCurrentThemeMode(): ThemeMode {
    try {
      if (this.config) {
        return this.config.getDarkMode() ? "dark" : "light";
      }
      return "dark";
    } catch {
      return "dark";
    }
  }

  applyColorToSvg(
    svgText: string,
    color: MotionColor,
    themeMode?: ThemeMode
  ): string {
    const effectiveThemeMode = themeMode ?? this.getCurrentThemeMode();
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
      /<(path|polygon|circle|rect|ellipse)([^>]*?)class="st\d+"([^>]*?)>/g,
      (match, tag, before, after) => {
        if (before.includes('style="') || after.includes('style="')) {
          return match.replace(/style="([^"]*)"/, `style="$1;fill:${targetColor}"`);
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

    coloredSvg = coloredSvg.replace(
      /<circle[^>]*id="centerPoint"[^>]*\/?>/,
      ""
    );

    return coloredSvg;
  }
}

export const arrowSvgColorTransformer = new ArrowSvgColorTransformer();

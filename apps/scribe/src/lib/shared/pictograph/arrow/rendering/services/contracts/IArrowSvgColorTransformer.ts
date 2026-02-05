/**
 * SVG Color Transformer Interface
 */

import type { MotionColor } from "../../../../shared/domain/enums/pictograph-enums";
import type { ThemeMode } from "../../../../../utils/svg-color-utils";

export interface ISvgColorTransformer {
  /**
   * Apply color transformation to SVG text content
   * Simple regex replacement: blue (#2E3192) to red (#ED1C24) when needed
   * @param svgText The SVG content to transform
   * @param color The motion color to apply
   * @param themeMode Optional theme mode ("dark" or "light"). If not provided, uses global state.
   */
  applyColorToSvg(
    svgText: string,
    color: MotionColor,
    themeMode?: ThemeMode
  ): string;
}

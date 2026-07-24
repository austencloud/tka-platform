/**
 * SVG Generator Service Contract
 *
 * Handles generation of SVG strings for grid and prop staffs.
 */

import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { PropSvgData } from "$lib/shared/animation-engine/domain/types/svg-types";
import type { ThemeMode } from "$lib/shared/utils/svg-color-utils";

export type { PropSvgData } from "$lib/shared/animation-engine/domain/types/svg-types";

export interface ISVGGenerator {
  /**
   * Generate grid SVG
   * @param gridMode - Type of grid to generate (GridMode.DIAMOND or GridMode.BOX)
   */
  generateGridSvg(gridMode?: GridMode): Promise<string>;

  /**
   * Generate prop SVG with custom color
   * @param propType - Type of prop to generate (default: "staff")
   * @param color - Hex color for the prop
   * @returns PropSvgData with SVG string and viewBox dimensions
   */
  generatePropSvg(
    propType: string,
    color: string,
    themeMode?: ThemeMode
  ): Promise<PropSvgData>;

  /**
   * Generate blue prop SVG with dynamic prop type
   * @param propType - Type of prop to generate (default: "staff")
   * @param darkMode - When provided, uses this instead of global dark mode state
   * @returns PropSvgData with SVG string and viewBox dimensions
   */
  generateBluePropSvg(propType?: string, darkMode?: boolean): Promise<PropSvgData>;

  /**
   * Generate red prop SVG with dynamic prop type
   * @param propType - Type of prop to generate (default: "staff")
   * @param darkMode - When provided, uses this instead of global dark mode state
   * @returns PropSvgData with SVG string and viewBox dimensions
   */
  generateRedPropSvg(propType?: string, darkMode?: boolean): Promise<PropSvgData>;

  /**
   * Generate blue staff SVG
   * @deprecated Use generateBluePropSvg instead
   */
  generateBlueStaffSvg(): string;

  /**
   * Generate red staff SVG
   * @deprecated Use generateRedPropSvg instead
   */
  generateRedStaffSvg(): string;
}

/**
 * SVG Loader Interface
 */

import type { ArrowPlacementData } from "../../../positioning/placement/domain/ArrowPlacementData";
import type { ArrowSvgData } from "../../../../shared/domain/models/svg-models";
import type { MotionData } from "../../../../shared/domain/models/MotionData";
import type { ThemeMode } from "../../../../../utils/svg-color-utils";

/**
 * Options for arrow SVG loading
 */
export interface ArrowSvgLoadOptions {
  /** Theme mode for color selection ("dark" or "light"). If not provided, uses global state. */
  themeMode?: ThemeMode;
}

export interface IArrowSvgLoader {
  /**
   * Load arrow SVG data with color transformation based on placement data
   * @param options Optional settings including themeMode for color selection
   */
  loadArrowSvg(
    arrowData: ArrowPlacementData,
    motionData: MotionData,
    options?: ArrowSvgLoadOptions
  ): Promise<ArrowSvgData>;

  /**
   * Fetch SVG content from a given path
   */
  fetchSvgContent(path: string): Promise<string>;
}

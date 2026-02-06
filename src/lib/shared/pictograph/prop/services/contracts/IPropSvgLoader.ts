/**
 * Prop SVG Loader Interface
 *
 * Fast, direct SVG loading for props - mirrors arrow loading approach
 */

import type { MotionData } from "../../../shared/domain/models/MotionData";
import type { PropPlacementData } from "../../domain/models/PropPlacementData";
import type { PropRenderData } from "../../domain/models/PropRenderData";
import type { ThemeMode } from "../../../../utils/svg-color-utils";

/**
 * Options for prop SVG loading
 */
export interface PropSvgLoadOptions {
  /** Theme mode for color selection ("dark" or "light"). If not provided, uses global state. */
  themeMode?: ThemeMode;
}

export interface IPropSvgLoader {
  /**
   * Load prop SVG data with color transformation - fast direct approach
   * @param propData - Prop placement data
   * @param motionData - Motion data including prop type
   * @param useAnimatedVersion - If true, loads {propType}_animated.svg instead of {propType}.svg
   * @param options - Optional settings including themeMode for color selection
   */
  loadPropSvg(
    propData: PropPlacementData,
    motionData: MotionData,
    useAnimatedVersion?: boolean,
    options?: PropSvgLoadOptions
  ): Promise<PropRenderData>;

  /**
   * Fetch SVG content from a given path - direct fetch
   */
  fetchSvgContent(path: string): Promise<string>;
}

// --- From ArrowSvgLoader ---
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


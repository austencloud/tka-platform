// --- From PropPlacer ---
/**
 * Prop Placement Service Interface
 *
 * Calculates prop placement data for pictograph rendering.
 */

import type { PictographData } from "../../../shared/domain/models/PictographData";
import type { MotionData } from "../../../shared/domain/models/MotionData";
import type { PropPlacementData } from "../../domain/models/PropPlacementData";

/** Motion visibility passed into placement so that a hidden partner suppresses
 *  this prop's beta offset (no collision → no offset needed). Omitted fields
 *  default to visible. */
export interface PropPlacementVisibility {
  showBlue?: boolean;
  showRed?: boolean;
}

// --- From PropSvgLoader ---
/**
 * Prop SVG Loader Interface
 *
 * Fast, direct SVG loading for props - mirrors arrow loading approach
 */

import type { PropRenderData } from "../../domain/models/PropRenderData";
import type { ThemeMode } from "../../../../utils/svg-color-utils";

/**
 * Options for prop SVG loading
 */
export interface PropSvgLoadOptions {
  /** Theme mode for color selection ("dark" or "light"). If not provided, uses global state. */
  themeMode?: ThemeMode;
}


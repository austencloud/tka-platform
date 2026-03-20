/**
 * IPictographPreparer - Contract for pictograph preparation
 *
 * Prepares pictographs with pre-calculated positions for efficient rendering.
 * Used before rendering to eliminate per-component async calculations.
 */

import type { PictographData } from "../../domain/models/PictographData";
import type { PreparedPictographData } from "../../domain/models/PreparedPictographData";
import type { ThemeMode } from "../../../../utils/svg-color-utils";
import type { PropType } from "../../../prop/domain/enums/PropType";

// Re-export for convenience
export type { PreparedPictographData };

/**
 * Options for pictograph preparation
 */
export interface PrepareOptions {
  /** Theme mode for color selection ("dark" or "light"). If not provided, uses global state. */
  themeMode?: ThemeMode;
  /**
   * Explicit prop type for blue hand.
   * When provided, this value is used directly. When omitted, falls back to global settings.
   * Export/thumbnail rendering always provides this to ensure consistency during async operations.
   */
  bluePropType?: PropType;
  /**
   * Explicit prop type for red hand.
   * When provided, this value is used directly. When omitted, falls back to global settings.
   */
  redPropType?: PropType;
  /**
   * Load grid-centered prop SVGs (from props/animated/) instead of pictograph versions (from props/).
   * Grid versions use the ghost-half centering strategy - designed for the animation canvas.
   * Pictograph versions (props/) are sized for pictograph grid rendering.
   * Defaults to false - pictographs use the non-animated versions.
   * Set to true only for animation canvas rendering.
   */
  useGridVersion?: boolean;

  /** When true, transforms motions for hand path visualization:
   *  pro/anti → float, propType → HAND, orientation → null. */
  handPathMode?: boolean;
}

export interface IPictographPreparer {
  /**
   * Prepare a batch of pictographs with pre-calculated positions
   * Processes all pictographs in parallel for performance
   * @param options Optional settings including themeMode for color selection
   */
  prepareBatch(
    pictographs: PictographData[],
    options?: PrepareOptions
  ): Promise<PreparedPictographData[]>;

  /**
   * Prepare a single pictograph with pre-calculated positions
   * @param options Optional settings including themeMode for color selection
   */
  prepareSingle(
    pictograph: PictographData,
    options?: PrepareOptions
  ): Promise<PreparedPictographData>;

  /**
   * Clear the preparation cache.
   * Call this when global adjustments change to force re-calculation.
   */
  clearCache(): void;
}

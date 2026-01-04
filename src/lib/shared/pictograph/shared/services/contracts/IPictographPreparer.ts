/**
 * IPictographPreparer - Contract for pictograph preparation
 *
 * Prepares pictographs with pre-calculated positions for efficient rendering.
 * Used before rendering to eliminate per-component async calculations.
 */

import type { PictographData } from "../../domain/models/PictographData";
import type { PreparedPictographData } from "../../domain/models/PreparedPictographData";
import type { ThemeMode } from "../../../../utils/svg-color-utils";

// Re-export for convenience
export type { PreparedPictographData };

/**
 * Options for pictograph preparation
 */
export interface PrepareOptions {
  /** Theme mode for color selection ("dark" or "light"). If not provided, uses global state. */
  themeMode?: ThemeMode;
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
}

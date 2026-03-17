/**
 * Abstracts access to pictograph variation data.
 * MCP server and app each provide their own implementation.
 */

import type { PictographData } from "../constraints/types.js";

export interface IVariationProvider {
  /** Get all pictograph variations for a letter at a given position */
  getVariations(
    letter: string,
    position: string,
    gridMode: string,
  ): PictographData[];

  /** Get all pictograph variations for a grid mode (for start position selection) */
  getAllVariations(gridMode: string): PictographData[];
}

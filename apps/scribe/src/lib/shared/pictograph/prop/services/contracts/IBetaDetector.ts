/**
 * Beta Detector Interface
 *
 * Provides methods for detecting beta positions in pictographs.
 * Beta positions are specific dance positions that require special handling.
 */

import type { GridPosition } from "../../../grid/domain/enums/grid-enums";
import type { PictographData } from "../../../shared/domain/models/PictographData";

export interface IBetaDetector {
  /**
   * Check if a grid position is a beta position
   */
  isBetaPosition(position: GridPosition): boolean;

  /**
   * Check if a pictograph starts with beta (start position is a beta position)
   */
  startsWithBeta(pictographData: PictographData): boolean;

  /**
   * Check if a pictograph ends with beta (end position is a beta position)
   */
  endsWithBeta(pictographData: PictographData): boolean;
}

/**
 * Grid Mode Deriver Interface
 *
 * Derives grid mode from motion data and computes grid data.
 */

import type { GridMode } from "../../domain/enums/grid-enums";
import type { GridData } from "../../domain/models/grid-models";
import type { MotionData } from "../../../shared/domain/models/MotionData";

export interface IGridModeDeriver {
  /**
   * Determine grid mode from motion start/end locations
   * Cardinal locations (N, E, S, W) = DIAMOND mode
   * Intercardinal locations (NE, SE, SW, NW) = BOX mode
   */
  deriveGridMode(blueMotion: MotionData, redMotion: MotionData): GridMode;

  /**
   * Check if motion uses cardinal locations
   */
  usesDiamondLocations(motion: MotionData): boolean;

  /**
   * Check if motion uses intercardinal locations
   */
  usesBoxLocations(motion: MotionData): boolean;

  /**
   * Compute complete GridData from motion data
   * Uses deriveGridMode logic and creates GridData with default positioning
   */
  computeGridData(blueMotion: MotionData, redMotion: MotionData): GridData;
}

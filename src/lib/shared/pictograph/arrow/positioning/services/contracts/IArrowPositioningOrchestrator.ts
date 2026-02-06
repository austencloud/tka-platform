/**
 * Arrow Positioning Orchestrator Interface
 *
 * Main orchestrator for arrow positioning calculations.
 * Coordinates the entire arrow positioning pipeline.
 */

import type { PictographData } from "../../../../shared/domain/models/PictographData";
import type { MotionData } from "../../../../shared/domain/models/MotionData";
import type { ArrowPlacementData } from "../../placement/domain/ArrowPlacementData";
import type { GridMode } from "../../../../grid/domain/enums/grid-enums";

export interface IArrowPositioningOrchestrator {
  /**
   * Calculate complete arrow position using the positioning pipeline.
   * @param gridMode Optional grid mode - if not provided, derived from motion locations
   */
  calculateArrowPoint(
    pictographData: PictographData,
    motionData?: MotionData,
    gridMode?: GridMode
  ): Promise<[number, number, number]>;

  /**
   * Calculate positions for all arrows in the pictograph.
   */
  calculateAllArrowPoints(
    pictographData: PictographData
  ): Promise<PictographData>;

  /**
   * Determine if arrow should be mirrored based on motion type.
   */
  shouldMirrorArrow(
    arrowData: ArrowPlacementData,
    pictographData?: PictographData,
    motionData?: MotionData
  ): boolean;

  /**
   * Apply mirror transformation to arrow graphics item.
   */
  applyMirrorTransform(
    arrowItem: HTMLElement | SVGElement,
    shouldMirror: boolean
  ): void;
}

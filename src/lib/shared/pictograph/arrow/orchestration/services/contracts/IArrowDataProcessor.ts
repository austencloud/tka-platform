/**
 * Arrow Data Processor Contract
 *
 * Interface for data extraction, validation, and manipulation for arrow positioning.
 */

import type { PictographData } from "../../../../shared/domain/models/PictographData";
import type { MotionData } from "../../../../shared/domain/models/MotionData";
import type { ArrowPlacementData } from "../../../positioning/placement/domain/ArrowPlacementData";
import type { Point } from "fabric";

export interface IArrowDataProcessor {
  /**
   * Extract motion data from pictograph data
   */
  getMotionFromPictograph(
    arrowColor: string,
    pictographData: PictographData
  ): MotionData | undefined;

  /**
   * Ensure position object has valid x and y attributes
   */
  ensureValidPosition(initialPosition: Point): Point;

  /**
   * Extract x and y values from adjustment object
   */
  extractAdjustmentValues(adjustment: Point | number): [number, number];

  /**
   * Update arrow in pictograph data
   */
  updateArrowInPictograph(
    pictographData: PictographData,
    color: string,
    updates: Partial<ArrowPlacementData>,
    motionUpdates?: Partial<MotionData>
  ): PictographData;

  /**
   * Validate arrow data structure
   */
  validateArrowData(arrowData: ArrowPlacementData): boolean;

  /**
   * Validate motion data for arrow positioning
   */
  validateMotionData(motion: MotionData): boolean;

  /**
   * Validate pictograph data for arrow processing
   */
  validatePictographData(pictographData: PictographData): boolean;

  /**
   * Extract all arrow colors from pictograph data
   */
  extractArrowColors(pictographData: PictographData): string[];

  /**
   * Get arrow data by color from embedded motion data
   */
  getArrowByColor(
    pictographData: PictographData,
    color: string
  ): ArrowPlacementData | undefined;

  /**
   * Check if motion data exists for the given arrow color
   */
  hasMotionData(pictographData: PictographData, color: string): boolean;

  /**
   * Create a deep clone of pictograph data
   */
  clonePictographData(pictographData: PictographData): PictographData;
}

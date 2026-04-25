/**
 * Arrow Data Processor
 *
 * Handles data extraction, validation, and manipulation for arrow positioning.
 * Responsible for working with pictograph data and arrow data structures.
 */

import type { ArrowPlacementData } from "../../../positioning/placement/domain/ArrowPlacementData";
import type { Point } from "fabric";
import type { MotionData } from "../../../../shared/domain/models/MotionData";
import type { PictographData } from "../../../../shared/domain/models/PictographData";
import type { IArrowGridCoordinator } from "../contracts/IArrowGridCoordinator";
import type { IArrowDataProcessor } from "../contracts/IArrowDataProcessor";

export class ArrowDataProcessor implements IArrowDataProcessor {
  constructor(private coordinateSystem: IArrowGridCoordinator) {}

  getMotionFromPictograph(
    arrowColor: string, // ✅ FIXED: Pass color directly since ArrowPlacementData no longer has color
    pictographData: PictographData
  ): MotionData | undefined {
    /**
     * Extract motion data from pictograph data.
     */
    if (!pictographData.motions) {
      return undefined;
    }
    return pictographData.motions[
      arrowColor as keyof typeof pictographData.motions
    ];
  }

  ensureValidPosition(initialPosition: Point): Point {
    /**
     * Ensure position object has valid x and y attributes.
     */
    if (
      initialPosition &&
      typeof initialPosition.x === "number" &&
      typeof initialPosition.y === "number"
    ) {
      return initialPosition;
    }

    console.warn("Invalid initial position, using scene center");
    return this.coordinateSystem.getSceneCenter();
  }

  extractAdjustmentValues(adjustment: Point | number): [number, number] {
    /**
     * Extract x and y values from adjustment object.
     */
    if (typeof adjustment === "number") {
      return [adjustment, adjustment];
    }

    if (adjustment && typeof adjustment === "object") {
      const x = typeof adjustment.x === "number" ? adjustment.x : 0;
      const y = typeof adjustment.y === "number" ? adjustment.y : 0;
      return [x, y];
    }

    return [0.0, 0.0];
  }

  updateArrowInPictograph(
    pictographData: PictographData,
    color: string,
    updates: Partial<ArrowPlacementData>,
    motionUpdates?: Partial<MotionData>
  ): PictographData {
    /**
     * Update arrow properties in pictograph data (now embedded in motions).
     * Also supports updating motion data properties like arrowLocation.
     */
    const updatedPictograph = { ...pictographData };

    // Update embedded arrow placement data in motion
    const motionKey = color as keyof typeof updatedPictograph.motions;
    const motion = updatedPictograph.motions[motionKey];

    if (motion) {
      updatedPictograph.motions = {
        ...updatedPictograph.motions,
        [motionKey]: {
          ...motion,
          ...motionUpdates, // 🚨 CRITICAL FIX: Apply motion updates (like arrowLocation)
          arrowPlacementData: {
            ...motion.arrowPlacementData,
            ...updates,
          },
        },
      };
    }

    return updatedPictograph;
  }

  validateArrowData(arrowData: ArrowPlacementData): boolean {
    /**
     * Validate arrow data structure.
     */
    if (!arrowData) {
      return false;
    }

    // Check required properties
    // ✅ FIXED: Color is no longer part of ArrowPlacementData
    const hasValidCoordinates =
      typeof arrowData.positionX === "number" &&
      typeof arrowData.positionY === "number";

    return hasValidCoordinates;
  }

  validateMotionData(motionData: MotionData): boolean {
    /**
     * Validate motion data structure.
     */
    if (!motionData) {
      return false;
    }

    // Check required properties
    const hasMotionType = typeof motionData.motionType === "string";
    const hasStartLocation = motionData.startLocation !== undefined;
    const hasEndLocation = motionData.endLocation !== undefined;

    return hasMotionType && hasStartLocation && hasEndLocation;
  }

  validatePictographData(pictographData: PictographData): boolean {
    /**
     * Validate pictograph data structure.
     */
    if (!pictographData) {
      return false;
    }

    // Check for motions object (arrows are now embedded)
    if (!pictographData.motions || typeof pictographData.motions !== "object") {
      return false;
    }

    // Validate at least one motion exists
    const motionColors = Object.keys(pictographData.motions);
    if (motionColors.length === 0) {
      return false;
    }

    // Validate each motion has embedded arrow placement
    for (const color of motionColors) {
      const motion =
        pictographData.motions[color as keyof typeof pictographData.motions];
      if (!motion || typeof motion !== "object" || !motion.arrowPlacementData) {
        return false;
      }
    }

    return true;
  }

  extractArrowColors(pictographData: PictographData): string[] {
    /**
     * Extract all arrow colors from pictograph data (now from motions).
     */
    if (!pictographData.motions) {
      return [];
    }

    return Object.keys(pictographData.motions);
  }

  getArrowByColor(
    pictographData: PictographData,
    color: string
  ): ArrowPlacementData | undefined {
    /**
     * Get arrow data by color (now from embedded motion data).
     */
    if (!pictographData.motions) {
      return undefined;
    }

    const motion =
      pictographData.motions[color as keyof typeof pictographData.motions];
    return motion?.arrowPlacementData;
  }

  hasMotionData(pictographData: PictographData, color: string): boolean {
    /**
     * Check if motion data exists for the given arrow color.
     */
    if (!pictographData.motions) {
      return false;
    }

    return color in pictographData.motions;
  }

  clonePictographData(pictographData: PictographData): PictographData {
    /**
     * Create a deep clone of pictograph data.
     */
    return JSON.parse(JSON.stringify(pictographData));
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
// Use this instead of arrowDataProcessor to avoid DI container rebuilds.
// ============================================================================

import { arrowGridCoordinator } from "./ArrowGridCoordinator";


export const arrowDataProcessor = new ArrowDataProcessor(arrowGridCoordinator);

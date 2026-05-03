/**
 * Arrow Adjustment Processor
 *
 * Handles adjustment calculations and directional tuple processing.
 * Responsible for computing base adjustments and applying directional transformations.
 */

import { Point } from "fabric";
import type { GridLocation } from "../../../../grid/domain/enums/grid-enums";
import type { MotionData } from "../../../../shared/domain/models/MotionData";
import { MotionType } from "../../../../shared/domain/enums/pictograph-enums";
import type { IArrowLocationCalculator } from "../../../positioning/calculation/services/contracts/IArrowLocationCalculator";
import type { IArrowQuadrantCalculator } from "../contracts/IArrowQuadrantCalculator";

export class ArrowAdjustmentProcessor {
  constructor(private quadrantCalculator: IArrowQuadrantCalculator) {}

  getBasicAdjustment(
    motion: MotionData,
    locationCalculator: IArrowLocationCalculator
  ): Point {
    /**
     * Get basic adjustment for synchronous operations with directional tuple processing.
     */
    try {
      // Calculate the arrow location for directional processing
      const location = locationCalculator.calculateLocation(motion);

      // Get base adjustment values
      const baseAdjustment = this.getBaseAdjustmentValues(motion);

      // Process directional tuples for location-specific adjustments
      const processedAdjustment = this.processDirectionalTuples(
        baseAdjustment,
        motion,
        location
      );

      return processedAdjustment;
    } catch (error) {
      console.warn("Basic adjustment calculation failed:", error);
      return new Point(0, 0);
    }
  }

  getBaseAdjustmentValues(motion: MotionData): Point {
    /**
     * Get base adjustment values before directional processing.
     */
    const motionType = motion.motionType;
    const turns = typeof motion.turns === "number" ? motion.turns : 0;
    const turnsStr =
      turns === Math.floor(turns) ? turns.toString() : turns.toString();

    // Base adjustment mappings for different motion types
    const adjustmentMappings: Record<string, Record<string, Point>> = {
      [MotionType.PRO]: {
        "0": new Point(40, 25),
        "0.5": new Point(35, 20),
        "1": new Point(30, 15),
        "1.5": new Point(25, 10),
        "2": new Point(20, 5),
      },
      [MotionType.ANTI]: {
        "0": new Point(40, 25),
        "0.5": new Point(35, 20),
        "1": new Point(30, 15),
        "1.5": new Point(25, 10),
        "2": new Point(20, 5),
      },
      [MotionType.FLOAT]: {
        "0": new Point(30, 20),
        "0.5": new Point(25, 15),
        "1": new Point(20, 10),
      },
      [MotionType.DASH]: {
        "0": new Point(50, 30),
        "1": new Point(45, 25),
      },
      [MotionType.STATIC]: {
        "0": new Point(0, 0),
      },
    };

    const typeAdjustments = adjustmentMappings[motionType];
    if (typeAdjustments?.[turnsStr]) {
      return typeAdjustments[turnsStr];
    }

    return new Point(0, 0);
  }

  processDirectionalTuples(
    baseAdjustment: Point,
    motion: MotionData,
    location: GridLocation
  ): Point {
    /**
     * Process directional tuples to get location-specific adjustments.
     */
    try {
      // Generate directional tuples for all quadrants
      const directionalTuples = this.generateDirectionalTuples(
        motion,
        baseAdjustment.x,
        baseAdjustment.y
      );

      // Calculate quadrant index for the arrow location
      const quadrantIndex = this.quadrantCalculator.calculateQuadrantIndex(
        motion,
        location
      );

      // Apply the appropriate directional tuple
      if (quadrantIndex >= 0 && quadrantIndex < directionalTuples.length) {
        const tuple = directionalTuples[quadrantIndex];
        if (tuple) {
          const [adjustedX, adjustedY] = tuple;
          return new Point(adjustedX, adjustedY);
        }
      }

      console.warn(
        `Invalid quadrant index ${quadrantIndex} for location ${location}`
      );
      return baseAdjustment;
    } catch (error) {
      console.warn("Directional tuple processing failed:", error);
      return baseAdjustment;
    }
  }

  generateDirectionalTuples(
    motion: MotionData,
    baseX: number,
    baseY: number
  ): Array<[number, number]> {
    /**
     * Generate directional tuples using rotation matrices.
     */
    const motionType = motion.motionType;

    // Different rotation strategies based on motion type
    if (motionType === MotionType.STATIC) {
      // Static arrows don't need directional adjustments
      return [
        [baseX, baseY],
        [baseX, baseY],
        [baseX, baseY],
        [baseX, baseY],
      ];
    }

    if (motionType === MotionType.DASH) {
      // Dash arrows use simple directional mapping
      return [
        [baseX, baseY], // North/Northeast
        [baseY, -baseX], // East/Southeast
        [-baseX, -baseY], // South/Southwest
        [-baseY, baseX], // West/Northwest
      ];
    }

    // For PRO, ANTI, FLOAT - use rotation matrices
    const rotations = [0, 90, 180, 270]; // Degrees for each quadrant
    const tuples: Array<[number, number]> = [];

    for (const angle of rotations) {
      const radians = (angle * Math.PI) / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);

      // Apply rotation matrix
      const rotatedX = baseX * cos - baseY * sin;
      const rotatedY = baseX * sin + baseY * cos;

      tuples.push([rotatedX, rotatedY]);
    }

    return tuples;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
// Use this instead of arrowAdjustmentProcessor to avoid DI container rebuilds.
// ============================================================================

import { arrowQuadrantCalculator } from "./ArrowQuadrantCalculator";


export const arrowAdjustmentProcessor = new ArrowAdjustmentProcessor(arrowQuadrantCalculator);

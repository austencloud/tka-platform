/**
 * Arrow Adjustment Processor
 *
 * Handles adjustment calculations and directional tuple processing.
 * Responsible for computing base adjustments and applying directional transformations.
 */

import { Point } from "fabric";
import type { GridLocation } from "../../../grid/domain/enums/grid-enums";
import type { MotionData } from "../../../shared/domain/models/motion-data";
import { MotionType } from "../../../shared/domain/enums/pictograph-enums";
import type { ArrowLocationCalculator } from "../../positioning/calculation/services/arrow-location-calculator";
import { calculateQuadrantIndex } from "./arrow-quadrant-calculator";

export function getBasicAdjustment(
  motion: MotionData,
  locationCalculator: ArrowLocationCalculator
): Point {
  try {
    const location = locationCalculator.calculateLocation(motion);
    const baseAdjustment = getBaseAdjustmentValues(motion);
    const processedAdjustment = processDirectionalTuples(
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

export function getBaseAdjustmentValues(motion: MotionData): Point {
  const motionType = motion.motionType;
  const turns = typeof motion.turns === "number" ? motion.turns : 0;
  const turnsStr =
    turns === Math.floor(turns) ? turns.toString() : turns.toString();

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

export function processDirectionalTuples(
  baseAdjustment: Point,
  motion: MotionData,
  location: GridLocation
): Point {
  try {
    const directionalTuples = generateDirectionalTuples(
      motion,
      baseAdjustment.x,
      baseAdjustment.y
    );

    const quadrantIndex = calculateQuadrantIndex(motion, location);

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

export function generateDirectionalTuples(
  motion: MotionData,
  baseX: number,
  baseY: number
): Array<[number, number]> {
  const motionType = motion.motionType;

  if (motionType === MotionType.STATIC) {
    return [
      [baseX, baseY],
      [baseX, baseY],
      [baseX, baseY],
      [baseX, baseY],
    ];
  }

  if (motionType === MotionType.DASH) {
    return [
      [baseX, baseY],
      [baseY, -baseX],
      [-baseX, -baseY],
      [-baseY, baseX],
    ];
  }

  const rotations = [0, 90, 180, 270];
  const tuples: Array<[number, number]> = [];

  for (const angle of rotations) {
    const radians = (angle * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    const rotatedX = baseX * cos - baseY * sin;
    const rotatedY = baseX * sin + baseY * cos;

    tuples.push([rotatedX, rotatedY]);
  }

  return tuples;
}

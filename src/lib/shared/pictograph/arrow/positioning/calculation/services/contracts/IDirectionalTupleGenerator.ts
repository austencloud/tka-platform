/**
 * Directional Tuple Service Contracts
 *
 * Handles complex directional tuple processing for arrow positioning adjustments.
 * Direct TypeScript port of the Python DirectionalTupleProcessor.
 */

import type { GridLocation } from "../../../../../grid/domain/enums/grid-enums";
import type { MotionData } from "../../../../../shared/domain/models/MotionData";
import type { Point } from "fabric";

export interface IDirectionalTupleCalculator {
  calculateDirectionalTuple(
    motion: MotionData,
    location: GridLocation
  ): [number, number];
  generateDirectionalTuples(
    motion: MotionData,
    baseX: number,
    baseY: number
  ): Array<[number, number]>;
}

export interface IDirectionalTupleProcessor {
  processDirectionalTuples(
    baseAdjustment: Point,
    _motion: MotionData,
    location: GridLocation
  ): Point;
}

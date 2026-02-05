/**
 * Arrow Key Generation Service Contracts
 *
 * Interfaces for generating various types of keys used in arrow placement.
 */

import type { PictographData } from "../../../../../shared/domain/models/PictographData";
import type { MotionData } from "../../../../../shared/domain/models/MotionData";
import type { ArrowPlacementData } from "../../../placement/domain/ArrowPlacementData";

export interface IPlacementKeyGenerator {
  generatePlacementKey(
    motionData: MotionData,
    pictographData: PictographData,
    defaultPlacements: Record<string, unknown>,
    gridMode?: string
  ): string;
}

export interface IAttributeKeyGenerator {
  getKeyFromArrow(
    arrowData: ArrowPlacementData,
    pictographData: PictographData,
    color: string
  ): string;
}

export interface ISpecialPlacementOriKeyGenerator {
  generateOrientationKey(
    motionData: MotionData,
    pictographData: PictographData
  ): string;
}

export interface ITurnsTupleKeyGenerator {
  generateTurnsTuple(pictographData: PictographData): number[];
}

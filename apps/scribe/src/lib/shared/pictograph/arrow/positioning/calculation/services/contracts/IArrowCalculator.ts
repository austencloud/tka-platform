/**
 * Arrow Calculation Service Contracts
 *
 * Interfaces for various arrow calculation services.
 */

import type { ArrowPlacementData } from "../../../placement/domain/ArrowPlacementData";
import type { GridLocation } from "../../../../../grid/domain/enums/grid-enums";
import type { MotionData } from "../../../../../shared/domain/models/MotionData";
import type { MotionType } from "../../../../../shared/domain/enums/pictograph-enums";
import type { PictographData } from "../../../../../shared/domain/models/PictographData";

export interface IArrowPointCalculator {
  calculatePoint(
    arrowData: ArrowPlacementData,
    motionData: MotionData,
    pictographData: PictographData
  ): Promise<{ x: number; y: number; rotation: number }>;

  shouldMirror(
    arrowData: ArrowPlacementData,
    motionData: MotionData,
    pictographData: PictographData
  ): boolean;

  renderArrowAtPoint(
    svg: SVGElement,
    arrowPoint: { x: number; y: number; rotation: number },
    motionData: MotionData
  ): Promise<void>;
}

export interface IDashLocationCalculator {
  /**
   * Calculate dash arrow locations with comprehensive special case handling.
   */
  calculateDashLocationFromPictographData(
    pictographData: PictographData,
    motionData: MotionData,
    arrowColor: string
  ): GridLocation;

  calculateDashLocation(
    letter: string,
    startLocation: GridLocation,
    endLocation: GridLocation,
    motionType: MotionType,
    isLambda?: boolean,
    isLambdaDash?: boolean
  ): GridLocation;
}

export interface IQuadrantIndexCalculator {
  calculateQuadrantIndex(motion: MotionData, location: GridLocation): number;
}

import {
  GridMode,
  GridLocation,
  MotionColor,
  Orientation,
  VectorDirection,
} from "@tka/types";
import type { MotionData, PictographData, PropPlacementData } from "@tka/types";
import type { IGridModeDeriver } from "../../grid/contracts/IGridModeDeriver";
import type { IBetaDetector } from "../contracts/IBetaDetector";
import type { IPropPlacer } from "../contracts/IPropPlacer";
import type { PictographConfig } from "../../../config/PictographConfig";
import {
  getBetaOffsetSize,
  isBuugengFamilyProp,
  isUnilateralProp,
} from "../../../constants/PropClassification";
import { createPropPlacementFromPosition } from "../../../domain/factories";
import { BetaPropDirectionCalculator } from "./BetaPropDirectionCalculator";
import { DefaultPropPositioner } from "./DefaultPropPositioner";
import { PropRotAngleManager } from "./PropRotAngleManager";

/**
 * Prop Placement Service
 *
 * Calculates prop placement (position + rotation) for pictograph rendering.
 * Uses PictographConfig for prop type settings instead of global singletons.
 */
export class PropPlacer implements IPropPlacer {
  constructor(
    private gridModeService: IGridModeDeriver,
    private betaDetector: IBetaDetector,
    private config?: PictographConfig
  ) {}

  async calculatePlacement(
    pictographData: PictographData,
    motionData: MotionData
  ): Promise<PropPlacementData> {
    const gridMode =
      pictographData.motions.blue && pictographData.motions.red
        ? this.gridModeService.deriveGridMode(
            pictographData.motions.blue,
            pictographData.motions.red
          )
        : GridMode.DIAMOND;

    const position = await this.calculatePosition(
      pictographData,
      motionData,
      gridMode
    );

    const rotation =
      motionData.propType === "hand"
        ? 0
        : PropRotAngleManager.calculateRotation(
            motionData.endLocation,
            motionData.endOrientation,
            gridMode
          );

    return createPropPlacementFromPosition(position.x, position.y, rotation);
  }

  private async calculatePosition(
    pictographData: PictographData,
    motionData: MotionData,
    gridMode: GridMode
  ): Promise<{ x: number; y: number }> {
    const basePosition = DefaultPropPositioner.calculatePosition(
      motionData.endLocation,
      gridMode
    );

    const betaOffset = await this.calculateBetaOffset(
      pictographData,
      motionData,
      gridMode
    );

    return {
      x: basePosition.x + betaOffset.x,
      y: basePosition.y + betaOffset.y,
    };
  }

  private async calculateBetaOffset(
    pictographData: PictographData,
    motionData: MotionData,
    gridMode: GridMode
  ): Promise<{ x: number; y: number }> {
    const needsBetaOffset = this.betaDetector.endsWithBeta(pictographData);

    if (!needsBetaOffset) {
      return { x: 0, y: 0 };
    }

    const redMotion = pictographData.motions.red;
    const blueMotion = pictographData.motions.blue;

    if (!redMotion || !blueMotion) {
      return { x: 0, y: 0 };
    }

    if (redMotion.endLocation !== blueMotion.endLocation) {
      return { x: 0, y: 0 };
    }

    // Get actual prop types from config (settings override) or fall back to motion data
    const bluePropType = blueMotion.propType === "hand"
      ? "hand"
      : (this.config?.getBluePropType() ?? blueMotion.propType ?? "staff");
    const redPropType = redMotion.propType === "hand"
      ? "hand"
      : (this.config?.getRedPropType() ?? redMotion.propType ?? "staff");
    const bothAreHands = bluePropType === "hand" && redPropType === "hand";

    if (bothAreHands) {
      const distance = getBetaOffsetSize("hand", gridMode);

      const eastPositions = [
        GridLocation.EAST,
        GridLocation.NORTHEAST,
        GridLocation.SOUTHEAST,
      ];
      const westPositions = [
        GridLocation.WEST,
        GridLocation.NORTHWEST,
        GridLocation.SOUTHWEST,
      ];

      const blueStartLoc = blueMotion.startLocation;
      const redStartLoc = redMotion.startLocation;

      const blueFromEast = eastPositions.includes(blueStartLoc as GridLocation);
      const blueFromWest = westPositions.includes(blueStartLoc as GridLocation);
      const redFromEast = eastPositions.includes(redStartLoc as GridLocation);
      const redFromWest = westPositions.includes(redStartLoc as GridLocation);

      if (blueFromEast && redFromWest) {
        return motionData.color === MotionColor.BLUE
          ? { x: distance, y: 0 }
          : { x: -distance, y: 0 };
      } else if (blueFromWest && redFromEast) {
        return motionData.color === MotionColor.BLUE
          ? { x: -distance, y: 0 }
          : { x: distance, y: 0 };
      } else {
        return motionData.color === MotionColor.BLUE
          ? { x: -distance, y: 0 }
          : { x: distance, y: 0 };
      }
    }

    // Orientation-based beta skip logic
    const redEndOri = redMotion.endOrientation;
    const blueEndOri = blueMotion.endOrientation;

    const radialOrientations = [Orientation.IN, Orientation.OUT];
    const nonRadialOrientations = [Orientation.CLOCK, Orientation.COUNTER];

    const redIsRadial = radialOrientations.includes(redEndOri);
    const blueIsRadial = radialOrientations.includes(blueEndOri);
    const redIsNonRadial = nonRadialOrientations.includes(redEndOri);
    const blueIsNonRadial = nonRadialOrientations.includes(blueEndOri);

    const hybridOrientation =
      (redIsRadial && blueIsNonRadial) || (redIsNonRadial && blueIsRadial);

    if (hybridOrientation) {
      return { x: 0, y: 0 };
    }

    const bothRadial = redIsRadial && blueIsRadial;
    const bothNonRadial = redIsNonRadial && blueIsNonRadial;
    const sameTypeButDifferentOrientation =
      (bothRadial && redEndOri !== blueEndOri) ||
      (bothNonRadial && redEndOri !== blueEndOri);

    // Buugeng nesting check
    const bothAreBuugengFamily =
      isBuugengFamilyProp(bluePropType) &&
      isBuugengFamilyProp(redPropType);

    if (bothAreBuugengFamily) {
      const blueChirality = this.config?.getBlueBuugengFlipped?.() ?? false;
      const redChirality = this.config?.getRedBuugengFlipped?.() ?? false;
      const oppositeChirality = blueChirality !== redChirality;

      if (oppositeChirality) {
        return { x: 0, y: 0 };
      }
    }

    // Unilateral props with different orientations don't need offset
    const actualPropType =
      motionData.color === MotionColor.BLUE ? bluePropType : redPropType;

    if (sameTypeButDifferentOrientation && isUnilateralProp(actualPropType)) {
      return { x: 0, y: 0 };
    }

    // Calculate direction for this prop
    const directionCalculator = new BetaPropDirectionCalculator(
      { red: redMotion, blue: blueMotion },
      pictographData.letter || undefined
    );

    const direction = directionCalculator.getDirectionForMotionData(motionData);

    if (!direction) {
      return { x: 0, y: 0 };
    }

    const offset = this.getOffsetForDirection(
      direction,
      actualPropType,
      gridMode
    );
    return { x: offset.x, y: offset.y };
  }

  private getOffsetForDirection(
    direction: VectorDirection,
    propType: string,
    gridMode: GridMode
  ): { x: number; y: number } {
    const distance = getBetaOffsetSize(propType, gridMode);

    switch (direction) {
      case VectorDirection.UP:
        return { x: 0, y: -distance };
      case VectorDirection.DOWN:
        return { x: 0, y: distance };
      case VectorDirection.LEFT:
        return { x: -distance, y: 0 };
      case VectorDirection.RIGHT:
        return { x: distance, y: 0 };
      case VectorDirection.UPRIGHT:
        return { x: distance, y: -distance };
      case VectorDirection.DOWNRIGHT:
        return { x: distance, y: distance };
      case VectorDirection.UPLEFT:
        return { x: -distance, y: -distance };
      case VectorDirection.DOWNLEFT:
        return { x: -distance, y: distance };
      default:
        return { x: 0, y: 0 };
    }
  }
}

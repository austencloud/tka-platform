/**
 * Prop Placement Service
 *
 * Dedicated service for calculating prop placement data.
 * Follows separation of concerns by focusing only on placement calculations.
 * Returns PropPlacementData that can be attached to PropPlacementData.
 */

import { GridMode, GridLocation } from "../../../grid/domain/enums/grid-enums";
import type { IGridModeDeriver } from "../../../grid/services/contracts/IGridModeDeriver";
import {
  MotionColor,
  Orientation,
  VectorDirection,
} from "../../../shared/domain/enums/pictograph-enums";
import type { MotionData } from "../../../shared/domain/models/MotionData";
import type { PictographData } from "../../../shared/domain/models/PictographData";
import {
  getBetaOffsetSize,
  isBuugengFamilyProp,
  isUnilateralProp,
  pictographRequiresStrictHandpoints,
} from "../../domain/enums/PropClassification";

// Settings interface for Node.js contexts where getSettings() isn't available
interface PropPlacerSettings {
  bluePropType?: string;
  redPropType?: string;
  blueBuugengFlipped?: boolean;
  redBuugengFlipped?: boolean;
}

import { createPropPlacementFromPosition } from "../../domain/factories/createPropPlacementData";
import { getSettings } from "$lib/shared/application/state/app-state.svelte";
import type { PropPlacementData } from "../../domain/models/PropPlacementData";
import type { IBetaDetector } from "../contracts/IBetaDetector";
import type { IPropPlacer } from "../contracts/IPropPlacer";
import { BetaPropDirectionCalculator } from "./BetaPropDirectionCalculator";
import DefaultPropPositioner from "./DefaultPropPositioner";
import { PropRotAngleManager } from "./PropRotAngleManager";

export class PropPlacer implements IPropPlacer {
  constructor(
    private gridModeService: IGridModeDeriver,
    private BetaDetector: IBetaDetector,
    private settings?: PropPlacerSettings
  ) {}

  async calculatePlacement(
    pictographData: PictographData,
    motionData: MotionData
  ): Promise<PropPlacementData> {
    // DEBUG: Log motion data

    // Derive gridMode from both motions when available. For single-motion pictographs
    // (e.g. orientation explainer, start position), use the pictograph's explicit gridMode
    // before falling back to DIAMOND.
    const gridMode =
      pictographData.motions.blue && pictographData.motions.red
        ? this.gridModeService.deriveGridMode(
            pictographData.motions.blue,
            pictographData.motions.red
          )
        : pictographData.gridMode ?? GridMode.DIAMOND;

    const position = await this.calculatePosition(
      pictographData,
      motionData,
      gridMode
    );

    // IMPORTANT: Hands should never rotate - always use default orientation (0 degrees)
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
    // Determine if strict handpoints are needed (large props like bighoop)
    // Legacy: pictograph_checker.has_strict_placed_props() - true when BOTH props are strict types
    const globalSettings = this.settings ? null : getSettings();
    const resolvedSettings = this.settings ?? {
      bluePropType: globalSettings?.bluePropType,
      redPropType: globalSettings?.redPropType,
    };
    const bluePropType =
      resolvedSettings.bluePropType ??
      pictographData.motions.blue?.propType ??
      "staff";
    const redPropType =
      resolvedSettings.redPropType ??
      pictographData.motions.red?.propType ??
      "staff";
    const useStrict = pictographRequiresStrictHandpoints(
      bluePropType,
      redPropType
    );

    // Calculate base position from motion data (not from existing propPlacementData)
    const basePosition = DefaultPropPositioner.calculatePosition(
      motionData.endLocation,
      gridMode,
      useStrict
    );

    // Apply beta offset if this is a beta position
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
    // Check if this pictograph ends with beta position - now synchronous!
    const needsBetaOffset = this.BetaDetector.endsWithBeta(pictographData);

    if (!needsBetaOffset) {
      return { x: 0, y: 0 };
    }

    const redMotion = pictographData.motions.red;
    const blueMotion = pictographData.motions.blue;

    if (!redMotion || !blueMotion) {
      return { x: 0, y: 0 };
    }

    // Only apply beta offset if both props end at the same location
    if (redMotion.endLocation !== blueMotion.endLocation) {
      return { x: 0, y: 0 };
    }

    // SPECIAL CASE: HAND prop type direction-aware beta offset
    // When both props are HAND type, we apply direction-aware positioning:
    // - If blue comes from east and red from west → blue RIGHT, red LEFT
    // - If blue comes from west and red from east → blue LEFT, red RIGHT
    // - Default: blue LEFT, red RIGHT
    const blueMotionIsHand = blueMotion.propType === "hand";
    const redMotionIsHand = redMotion.propType === "hand";
    // Use constructor settings, then fall back to global settings
    const globalSettings = this.settings ? null : getSettings();
    const settings = this.settings ?? {
      bluePropType: globalSettings?.bluePropType,
      redPropType: globalSettings?.redPropType,
    };
    const actualBluePropType = blueMotionIsHand
      ? "hand"
      : (settings.bluePropType ?? blueMotion.propType);
    const actualRedPropType = redMotionIsHand
      ? "hand"
      : (settings.redPropType ?? redMotion.propType);
    const bothAreHands =
      actualBluePropType === "hand" && actualRedPropType === "hand";

    if (bothAreHands) {
      const distance = getBetaOffsetSize("hand", gridMode);

      // Define east and west positions for direction detection
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

      // Direction-aware positioning
      if (blueFromEast && redFromWest) {
        // Blue approaching from east stays RIGHT, red from west stays LEFT
        if (motionData.color === MotionColor.BLUE) {
          return { x: distance, y: 0 }; // Blue goes RIGHT
        } else {
          return { x: -distance, y: 0 }; // Red goes LEFT
        }
      } else if (blueFromWest && redFromEast) {
        // Blue approaching from west stays LEFT, red from east stays RIGHT
        if (motionData.color === MotionColor.BLUE) {
          return { x: -distance, y: 0 }; // Blue goes LEFT
        } else {
          return { x: distance, y: 0 }; // Red goes RIGHT
        }
      } else {
        // Default: blue LEFT, red RIGHT
        if (motionData.color === MotionColor.BLUE) {
          return { x: -distance, y: 0 }; // Blue goes LEFT
        } else {
          return { x: distance, y: 0 }; // Red goes RIGHT
        }
      }
    }

    // ORIENTATION-BASED BETA SKIP LOGIC (from desktop legacy)
    // Beta offset is applied when BOTH props share the same orientation TYPE:
    // - BOTH radial (IN/IN, IN/OUT, OUT/IN, OUT/OUT) → APPLY offset
    // - BOTH non-radial (CLOCK/CLOCK, CLOCK/COUNTER, COUNTER/CLOCK, COUNTER/COUNTER) → APPLY offset
    // - HYBRID (one radial + one non-radial) → SKIP offset
    //
    // This applies to ALL prop types (unilateral AND bilateral)
    const redEndOri = redMotion.endOrientation;
    const blueEndOri = blueMotion.endOrientation;

    // Define radial and non-radial orientations
    const radialOrientations = [Orientation.IN, Orientation.OUT];
    const nonRadialOrientations = [Orientation.CLOCK, Orientation.COUNTER];

    const redIsRadial = radialOrientations.includes(redEndOri);
    const blueIsRadial = radialOrientations.includes(blueEndOri);
    const redIsNonRadial = nonRadialOrientations.includes(redEndOri);
    const blueIsNonRadial = nonRadialOrientations.includes(blueEndOri);

    // Check if one is radial and one is non-radial (hybrid orientation)
    const hybridOrientation =
      (redIsRadial && blueIsNonRadial) || (redIsNonRadial && blueIsRadial);

    // Skip beta offset when hybrid (one radial, one non-radial)
    if (hybridOrientation) {
      return { x: 0, y: 0 };
    }

    // Calculate orientation relationships
    const bothRadial = redIsRadial && blueIsRadial;
    const bothNonRadial = redIsNonRadial && blueIsNonRadial;
    const sameTypeButDifferentOrientation =
      (bothRadial && redEndOri !== blueEndOri) ||
      (bothNonRadial && redEndOri !== blueEndOri);

    // BUUGENG FAMILY SPECIAL CASE:
    // Buugeng props are asymmetric bilateral props that can "nest" together
    // when they have opposite CHIRALITY (mirror-image forms of the asymmetric shape).
    //
    // Two separate concepts (do NOT confuse):
    //   - ORIENTATION: IN/OUT/CLOCK/COUNTER - affects prop rotation angle
    //   - CHIRALITY: Which mirror-image form of the asymmetric Buugeng is used
    //                (controlled by blueBuugengFlipped/redBuugengFlipped settings)
    //
    // Nesting condition: Both Buugeng + opposite chirality → skip beta offset
    // Orientation is irrelevant for this decision.
    //
    // IMPORTANT: We check settings prop type override, not stored motionData.propType,
    // because the user may have a sequence with "staff" stored but rendering as "buugeng".
    // Note: settings/actualBluePropType/actualRedPropType already declared above for HAND logic
    const bothAreBuugengFamily =
      isBuugengFamilyProp(actualBluePropType) &&
      isBuugengFamilyProp(actualRedPropType);

    if (bothAreBuugengFamily) {
      // Chirality is determined by the "flipped" setting - each value represents
      // one of two mirror-image forms of the asymmetric Buugeng shape
      const blueChirality = settings.blueBuugengFlipped ?? false;
      const redChirality = settings.redBuugengFlipped ?? false;
      const oppositeChirality = blueChirality !== redChirality; // XOR

      // When Buugeng have opposite chirality, the asymmetric shapes complement
      // each other and can nest together without needing beta offset separation
      if (oppositeChirality) {
        return { x: 0, y: 0 };
      }
    }

    // Skip beta offset for UNILATERAL props when both props have same orientation TYPE
    // but DIFFERENT specific orientations (OUT/IN or CLOCK/COUNTER)
    // Bilateral props always get the offset (unless hybrid or Buugeng family)
    // Use actual rendered prop type from settings, not stored motionData.propType
    const actualPropType =
      motionData.color === MotionColor.BLUE
        ? actualBluePropType
        : actualRedPropType;

    if (sameTypeButDifferentOrientation && isUnilateralProp(actualPropType)) {
      return { x: 0, y: 0 };
    }

    // Trigeng: opposite orientations (IN/OUT or CLOCK/COUNTER) don't need separation.
    // Physically, trigeng with opposite orientations face away from each other
    // and don't overlap, same as clubs or hoops.
    if (sameTypeButDifferentOrientation && actualPropType === "trigeng") {
      return { x: 0, y: 0 };
    }

    // Calculate direction for this specific prop
    const directionCalculator = new BetaPropDirectionCalculator(
      {
        red: redMotion,
        blue: blueMotion,
      },
      pictographData.letter || undefined
    );

    const direction = directionCalculator.getDirectionForMotionData(motionData);

    if (!direction) {
      return { x: 0, y: 0 };
    }

    // Calculate the offset based on the direction and actual rendered prop type
    const offset = this.getOffsetForDirection(
      direction,
      actualPropType,
      gridMode
    );
    return { x: offset.x, y: offset.y };
  }

  /**
   * Get pixel offset for a given direction
   * Offset distance varies by prop type based on desktop legacy calculations:
   * - Large props (club, eightrings): 15.83px (diamond) / 11.20px (box)
   * - Medium props (doublestar): 19px (diamond) / 13.43px (box)
   * - Default props: 21.11px (diamond) / 14.93px (box)
   * Box mode uses diagonal compensation (÷√2) to achieve equal visual spacing.
   */
  private getOffsetForDirection(
    direction: VectorDirection,
    propType: string,
    gridMode: GridMode
  ): {
    x: number;
    y: number;
  } {
    // Get prop-type-specific offset distance with grid mode scaling
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

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
// Use this instead of container.items.propPlacer to avoid DI container rebuilds.
// ============================================================================

import { gridModeDeriver } from "../../../grid/services/implementations/GridModeDeriver";
import { betaDetector } from "./BetaDetector";

export const propPlacer = new PropPlacer(gridModeDeriver, betaDetector);

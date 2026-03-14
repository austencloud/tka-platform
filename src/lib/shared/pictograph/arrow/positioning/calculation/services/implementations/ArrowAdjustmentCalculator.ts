/**
 * Arrow Adjustment Calculator - Consolidated Service
 *
 * Consolidated service that combines ArrowAdjustmentCalculator and ArrowAdjustmentLookup
 * to eliminate pure delegation layer. Maintains exact same interface and behavior.
 *
 * CONSOLIDATION BENEFITS:
 * - Removes unnecessary delegation layer
 * - Maintains identical logic and results
 * - Preserves all existing interfaces and test compatibility
 * - Better TypeScript organization
 */

import type { MotionType } from "../../../../../shared/domain/enums/pictograph-enums";
import type { IArrowAdjustmentCalculator } from "../../services/contracts/IArrowAdjustmentCalculator";
import type { GridLocation } from "../../../../../grid/domain/enums/grid-enums";
import type { ArrowPlacementKeyGenerator } from "../../../key-generation/services/implementations/ArrowPlacementKeyGenerator";
import type { PictographData } from "../../../../../shared/domain/models/PictographData";
import type { MotionData } from "../../../../../shared/domain/models/MotionData";
import type { IAttributeKeyGenerator } from "../../../key-generation/services/contracts/IAttributeKeyGenerator";
import type { IDefaultPlacer } from "../../../placement/services/contracts/IDefaultPlacer";
import type { IDirectionalTupleProcessor } from "../contracts/IDirectionalTupleGenerator";
import type { IGridModeDeriver } from "../../../../../grid/services/contracts/IGridModeDeriver";
import type { ISpecialPlacementOriKeyGenerator } from "../../../key-generation/services/contracts/ISpecialPlacementOriKeyGenerator";
import type { ISpecialPlacer } from "../../../placement/services/contracts/ISpecialPlacer";
import type { ITurnsTupleKeyGenerator } from "../../../key-generation/services/contracts/ITurnsTupleKeyGenerator";
import { GridMode } from "../../../../../grid/domain/enums/grid-enums";
import { Point } from "fabric";

export class ArrowAdjustmentCalculator implements IArrowAdjustmentCalculator {
  /**
   * Consolidated service combining lookup and calculation logic.
   * Eliminates the pure delegation layer while maintaining identical behavior.
   */

  constructor(
    private gridModeService: IGridModeDeriver,
    private SpecialPlacer: ISpecialPlacer,
    private DefaultPlacer: IDefaultPlacer,
    private orientationKeyService: ISpecialPlacementOriKeyGenerator,
    private placementKeyService: ArrowPlacementKeyGenerator,
    private turnsTupleService: ITurnsTupleKeyGenerator,
    private attributeKeyService: IAttributeKeyGenerator,
    private tupleProcessor: IDirectionalTupleProcessor
  ) {}

  async calculateAdjustment(
    pictographData: PictographData,
    motionData: MotionData,
    letter: string,
    location: GridLocation,
    arrowColor?: string
  ): Promise<Point> {
    /**
     * Calculate arrow position adjustment - IDENTICAL logic to original.
     */
    try {
      return await this.calculateAdjustmentResult(
        pictographData,
        motionData,
        letter,
        location,
        arrowColor
      );
    } catch (error) {
      console.error(`Adjustment calculation failed: ${error}`);
      return new Point(0, 0);
    }
  }

  /**
   * Get the base adjustment (before directional tuple transformation).
   * This is useful for the WASD adjustment panel to get the same base value
   * that the rendering pipeline uses.
   */
  async getBaseAdjustmentPublic(
    pictographData: PictographData,
    motionData: MotionData,
    letter: string,
    arrowColor?: string
  ): Promise<Point> {
    try {
      return await this.getBaseAdjustment(
        pictographData,
        motionData,
        letter,
        arrowColor
      );
    } catch (error) {
      console.error(`Base adjustment lookup failed: ${error}`);
      return new Point(0, 0);
    }
  }

  async calculateAdjustmentResult(
    pictographData: PictographData,
    motionData: MotionData,
    letter: string,
    location: GridLocation,
    arrowColor?: string
  ): Promise<Point> {
    /**
     * Calculate arrow position adjustment with proper error handling.
     * IDENTICAL logic to original ArrowAdjustmentCalculator.
     */
    try {
      // STEP 1: Look up base adjustment (special → default)
      const baseAdjustment = await this.getBaseAdjustment(
        pictographData,
        motionData,
        letter,
        arrowColor
      );

      // STEP 2: Process directional tuples for ALL motion types
      // JSON values are reference adjustments for a specific location (e.g., North)
      // They must be rotated via directional tuple matrices for each quadrant
      // This applies to ALL arrow types: PRO/ANTI/FLOAT/STATIC/DASH
      const finalAdjustment = this.tupleProcessor.processDirectionalTuples(
        baseAdjustment,
        motionData,
        location
      );

      return new Point(finalAdjustment.x, finalAdjustment.y);
    } catch (error) {
      console.error(
        `Adjustment calculation failed for letter ${letter}: ${error}`
      );
      throw new Error(`Arrow adjustment calculation failed: ${error}`);
    }
  }

  // === PRIVATE METHODS - Consolidated from ArrowAdjustmentLookup ===

  private async getBaseAdjustment(
    pictographData: PictographData,
    motionData: MotionData,
    letter: string,
    arrowColor?: string
  ): Promise<Point> {
    /**
     * Get base adjustment using streamlined lookup logic.
     * IDENTICAL to ArrowAdjustmentLookup.getBaseAdjustment()
     */
    if (!motionData) {
      throw new Error("Missing motion data for adjustment lookup");
    }

    try {
      // Special placement lookup requires a letter for key generation.
      // Some beats (e.g., the starting position) have no letter assigned,
      // so we skip special placement and go straight to the default.
      if (letter) {
        // Generate required keys for special placement lookup
        const [, , attrKey] = this.generateLookupKeys(pictographData, motionData);

        try {
          const specialAdjustment = await this.lookupSpecialPlacement(
            motionData,
            pictographData,
            arrowColor,
            attrKey
          );

          if (specialAdjustment) {
            return specialAdjustment;
          }
        } catch (error) {
          console.warn(`Error in special placement lookup for ${letter}:`, error);
        }
      }

      // Fall back to default calculation
      const defaultAdjustment = await this.calculateDefaultAdjustment(
        motionData,
        pictographData
      );
      return defaultAdjustment;
    } catch (error) {
      console.error("Error in base adjustment lookup:", error);
      throw new Error(`Arrow adjustment lookup failed: ${error}`);
    }
  }

  private generateLookupKeys(
    pictographData: PictographData,
    motionData: MotionData
  ): [string, string, string] {
    /**Generate all required keys for special placement lookup.*/
    try {
      const oriKey = this.orientationKeyService.generateOrientationKey(
        motionData,
        pictographData
      );
      const turnsTuple =
        this.turnsTupleService.generateTurnsTuple(pictographData);

      const color = motionData.color;
      const tempArrow = {
        id: "temp",
        arrowLocation: null,
        positionX: 0,
        positionY: 0,
        rotationAngle: 0,
        coordinates: { x: 0, y: 0 },
        svgCenter: { x: 0, y: 0 },
        svgMirrored: false,
        isVisible: true,
        isSelected: false,
      };

      const attrKey = this.attributeKeyService.getKeyFromArrow(
        tempArrow,
        pictographData,
        color
      );

      return [oriKey, turnsTuple.join(","), attrKey];
    } catch (error) {
      console.error("Failed to generate lookup keys:", error);
      throw new Error(`Key generation failed: ${error}`);
    }
  }

  private async lookupSpecialPlacement(
    motionData: MotionData,
    pictographData: PictographData,
    arrowColor?: string,
    attributeKey?: string
  ): Promise<Point | null> {
    /**
     * Look up special placement using exact legacy logic.
     * IDENTICAL to ArrowAdjustmentLookup.lookupSpecialPlacement()
     */
    try {
      const adjustment = await this.SpecialPlacer.getSpecialAdjustment(
        motionData,
        pictographData,
        arrowColor,
        attributeKey
      );

      if (adjustment) {
        return new Point(adjustment.x, adjustment.y);
      }

      return null;
    } catch (error) {
      console.error("Error in special placement lookup:", error);
      return null;
    }
  }

  private async calculateDefaultAdjustment(
    motionData: MotionData,
    pictographData: PictographData
  ): Promise<Point> {
    /**
     * Calculate default adjustment - IDENTICAL to ArrowAdjustmentLookup.
     */
    try {
      // Use gridMode from motion data if available, otherwise derive from locations
      const gridMode =
        motionData.gridMode ||
        (pictographData.motions.blue && pictographData.motions.red
          ? this.gridModeService.deriveGridMode(
              pictographData.motions.blue,
              pictographData.motions.red
            )
          : GridMode.DIAMOND);

      const keys = await this.DefaultPlacer.getAvailablePlacementKeys(
        motionData.motionType as MotionType,
        gridMode as GridMode
      );
      const defaultPlacements: Record<string, unknown> = Object.fromEntries(
        (keys || []).map((k: string) => [k, true])
      );

      const availableKeys = Object.keys(defaultPlacements || []);

      const placementKey = this.placementKeyService.generatePlacementKey(
        motionData,
        pictographData,
        availableKeys
      );

      const adjustmentPoint = await this.DefaultPlacer.getDefaultAdjustment(
        placementKey,
        motionData.turns || 0,
        motionData.motionType as MotionType,
        gridMode as GridMode
      );

      return new Point(adjustmentPoint.x, adjustmentPoint.y);
    } catch (error) {
      console.error("Error calculating default adjustment:", error);
      throw new Error(`Default adjustment calculation failed: ${error}`);
    }
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
// Use this instead of container.items.arrowAdjustmentCalculator to avoid DI container rebuilds.
// ============================================================================

import { gridModeDeriver } from "../../../../../grid/services/implementations/GridModeDeriver";
import { specialPlacer } from "../../../placement/services/implementations/SpecialPlacer";
import { defaultPlacer } from "../../../placement/services/implementations/DefaultPlacer";
import { specialPlacementOriKeyGenerator } from "../../../key-generation/services/implementations/SpecialPlacementOriKeyGenerator";
import { arrowPlacementKeyGenerator } from "../../../key-generation/services/implementations/ArrowPlacementKeyGenerator";
import { turnsTupleKeyGenerator } from "../../../key-generation/services/implementations/TurnsTupleKeyGenerator";
import { attributeKeyGenerator } from "../../../key-generation/services/implementations/AttributeKeyGenerator";
import { directionalTupleProcessor } from "./DirectionalTupleProcessor";

export const arrowAdjustmentCalculator = new ArrowAdjustmentCalculator(
  gridModeDeriver,
  specialPlacer,
  defaultPlacer,
  specialPlacementOriKeyGenerator,
  arrowPlacementKeyGenerator,
  turnsTupleKeyGenerator,
  attributeKeyGenerator,
  directionalTupleProcessor
);

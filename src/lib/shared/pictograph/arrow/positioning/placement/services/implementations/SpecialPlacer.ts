/**
 * Special Placer for Modern Arrow Positioning
 *
 * Orchestrates special placement logic by coordinating specialized services.
 * Provides pixel-perfect special placement adjustments for specific pictograph configurations.
 *
 * ORCHESTRATES SPECIAL PLACEMENT PIPELINE:
 * 1. Check global adjustments (Firestore-backed, admin-set overrides) - NEW
 * 2. Data loading (SpecialPlacementDataProvider)
 * 3. Orientation key generation (SpecialPlacementOriKeyGenerator)
 * 4. Turns tuple generation (TurnsTupleGenerator)
 * 5. Placement lookup with fallback strategies (SpecialPlacementLookup)
 *
 * Direct TypeScript mirror of reference/modern/application/services/positioning/arrows/placement/special_placement_service.py
 */

import type { Point as FabricPoint } from "fabric";
import type { IGridModeDeriver } from "../../../../../grid/services/contracts/IGridModeDeriver";
import { GridMode } from "../../../../../grid/domain/enums/grid-enums";
import type { PictographData } from "../../../../../shared/domain/models/PictographData";
import type { MotionData } from "../../../../../shared/domain/models/MotionData";
import { SpecialPlacementOriKeyGenerator } from "../../../key-generation/services/implementations/SpecialPlacementOriKeyGenerator";
import type { ISpecialPlacer } from "../contracts/ISpecialPlacer";
import type { ISpecialPlacementDataProvider } from "../contracts/ISpecialPlacementDataProvider";
import type { ITurnsTupleGenerator } from "../contracts/ITurnsTupleGenerator";
import type { ISpecialPlacementLookup } from "../contracts/ISpecialPlacementLookup";
import { getGlobalAdjustmentRepository } from "../../../global/services/global-adjustment-singleton";

export class SpecialPlacer implements ISpecialPlacer {
  private oriKeyGenerator: SpecialPlacementOriKeyGenerator;

  constructor(
    private readonly dataService: ISpecialPlacementDataProvider,
    private readonly tupleGenerator: ITurnsTupleGenerator,
    private readonly lookupService: ISpecialPlacementLookup,
    private readonly gridModeService: IGridModeDeriver
  ) {
    this.oriKeyGenerator = new SpecialPlacementOriKeyGenerator();
  }

  /**
   * Get special adjustment for arrow based on special placement logic.
   *
   * Orchestrates the pipeline:
   * 0. Check global adjustments (Firestore-backed, admin-set overrides)
   * 1. Generate orientation key
   * 2. Determine grid mode
   * 3. Generate turns tuple
   * 4. Load letter data
   * 5. Lookup adjustment with fallback strategies
   *
   * @param motionData Motion data containing motion information
   * @param pictographData Pictograph data containing letter and context
   * @param arrowColor Color of the arrow ('red' or 'blue')
   * @param attributeKey Optional attribute key for precise lookup
   * @returns Point with special adjustment or null if no special placement found
   */
  async getSpecialAdjustment(
    motionData: MotionData,
    pictographData: PictographData,
    arrowColor?: string,
    attributeKey?: string
  ): Promise<FabricPoint | null> {
    if (!motionData || !pictographData.letter) {
      return null;
    }

    const letter = pictographData.letter;

    // Step 1: Generate orientation key
    const oriKey = this.oriKeyGenerator.generateOrientationKey(
      motionData,
      pictographData
    );

    // Step 2: Determine grid mode
    const gridMode = this.getGridMode(pictographData);

    // Step 3: Generate turns tuple
    const turnsTuple = this.tupleGenerator.generateTurnsTuple(pictographData);

    // Determine the arrow key for global adjustment lookup
    const arrowKey = arrowColor || motionData.color || "blue";

    // Step 0 (NEW): Check global adjustments first (Firestore-backed overrides)
    const globalAdjustmentRepo = getGlobalAdjustmentRepository();
    if (globalAdjustmentRepo?.isInitialized) {
      const globalAdjustment = globalAdjustmentRepo.getAdjustment({
        gridMode,
        oriKey,
        letter,
        turnsTuple,
        arrowKey,
      });

      if (globalAdjustment) {
        return globalAdjustment;
      }
    }

    // Step 4: Load letter data from static JSON
    const letterData = await this.dataService.getLetterData(
      gridMode,
      oriKey,
      letter
    );

    if (!letterData || Object.keys(letterData).length === 0) {
      return null;
    }

    // Step 5: Lookup adjustment with fallback strategies
    return this.lookupService.lookupAdjustment(
      letterData,
      turnsTuple,
      motionData,
      pictographData,
      arrowColor,
      attributeKey
    );
  }

  /**
   * Check if rotation angle override exists for this motion.
   *
   * Orchestrates the pipeline for rotation override checking:
   * 1. Validate motion type (only DASH/STATIC)
   * 2. Check localStorage for user overrides (priority)
   * 3. Generate orientation key and turns tuple
   * 4. Load letter data
   * 5. Lookup rotation override flag in JSON data
   *
   * @param motionData Motion data containing motion information
   * @param pictographData Pictograph data containing letter and context
   * @param rotationOverrideKey Key generated by RotationAngleOverrideKeyGenerator
   * @returns true if rotation override flag is present in special placement data or localStorage
   */
  async hasRotationAngleOverride(
    motionData: MotionData,
    pictographData: PictographData,
    rotationOverrideKey: string
  ): Promise<boolean> {
    if (!motionData || !pictographData.letter) {
      return false;
    }

    // Only DASH and STATIC motions can have rotation overrides
    const motionType = motionData.motionType.toLowerCase();
    if (motionType !== "dash" && motionType !== "static") {
      return false;
    }

    const letter = pictographData.letter;

    // Step 1: Generate orientation key
    const oriKey = this.oriKeyGenerator.generateOrientationKey(
      motionData,
      pictographData
    );

    // Step 2: Determine grid mode
    const gridMode = this.getGridMode(pictographData);

    // Step 3: Generate turns tuple
    const turnsTuple = this.tupleGenerator.generateTurnsTuple(pictographData);

    // Step 4: Check localStorage for user overrides (takes priority)
    const localStorageOverride = this.checkLocalStorageOverride(
      gridMode,
      oriKey,
      letter,
      turnsTuple,
      rotationOverrideKey
    );
    if (localStorageOverride !== null) {
      return localStorageOverride;
    }

    // Step 5: Load letter data
    const letterData = await this.dataService.getLetterData(
      gridMode,
      oriKey,
      letter
    );

    if (!letterData || Object.keys(letterData).length === 0) {
      return false;
    }

    // Step 6: Lookup rotation override in JSON data
    // Try motion-type-based key first (e.g., static_rot_angle_override)
    let result = this.lookupService.lookupRotationOverride(
      letterData,
      turnsTuple,
      rotationOverrideKey,
      letter
    );

    // FALLBACK: If not found, try color-based key (e.g., red_rot_angle_override)
    // Some JSON files use color-based keys instead of motion-type-based keys
    if (!result && motionData.color) {
      const colorBasedKey = `${motionData.color.toLowerCase()}_rot_angle_override`;
      if (colorBasedKey !== rotationOverrideKey) {
        result = this.lookupService.lookupRotationOverride(
          letterData,
          turnsTuple,
          colorBasedKey,
          letter
        );
      }
    }

    return result;
  }

  /**
   * Check localStorage for rotation override
   * Returns null if not found, true/false if found
   */
  private checkLocalStorageOverride(
    gridMode: string,
    oriKey: string,
    letter: string,
    turnsTuple: string,
    rotationOverrideKey: string
  ): boolean | null {
    if (typeof localStorage === "undefined") {
      return null;
    }

    try {
      const data = localStorage.getItem("tka_rotation_overrides");
      if (!data) return null;

      const overrides = JSON.parse(data);
      const override =
        overrides?.[gridMode]?.[oriKey]?.[letter]?.[turnsTuple]?.[
          rotationOverrideKey
        ];

      if (override === true) return true;
      if (override === false) return false;
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get grid mode from pictograph data
   */
  private getGridMode(pictographData: PictographData): string {
    if (pictographData.motions.blue && pictographData.motions.red) {
      return this.getGridModeService().deriveGridMode(
        pictographData.motions.blue,
        pictographData.motions.red
      );
    }
    return GridMode.DIAMOND;
  }

  /**
   * Get grid mode service
   */
  private getGridModeService(): IGridModeDeriver {
    return this.gridModeService;
  }
}

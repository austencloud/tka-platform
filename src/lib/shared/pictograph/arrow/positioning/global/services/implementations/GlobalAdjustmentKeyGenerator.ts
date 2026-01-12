/**
 * Global Adjustment Key Generator
 *
 * Generates composite keys for global arrow adjustment lookup.
 * Reuses existing key generation services from the special placement pipeline.
 */

import { GridMode } from "../../../../../grid/domain/enums/grid-enums";
import type { IGridModeDeriver } from "../../../../../grid/services/contracts/IGridModeDeriver";
import type { MotionData } from "../../../../../shared/domain/models/MotionData";
import type { PictographData } from "../../../../../shared/domain/models/PictographData";
import type { GlobalAdjustmentKey } from "../../domain/GlobalArrowAdjustment";
import type { IGlobalAdjustmentKeyGenerator } from "../contracts/IGlobalAdjustmentKeyGenerator";
import type { ITurnsTupleGenerator } from "../../../placement/services/contracts/ITurnsTupleGenerator";
import { SpecialPlacementOriKeyGenerator } from "../../../key-generation/services/implementations/SpecialPlacementOriKeyGenerator";

export class GlobalAdjustmentKeyGenerator
  implements IGlobalAdjustmentKeyGenerator
{
  private readonly oriKeyGenerator: SpecialPlacementOriKeyGenerator;

  constructor(
    private readonly gridModeDeriver: IGridModeDeriver,
    private readonly turnsTupleGenerator: ITurnsTupleGenerator
  ) {
    this.oriKeyGenerator = new SpecialPlacementOriKeyGenerator();
  }

  /**
   * Generate a global adjustment key from motion and pictograph data
   */
  generateKey(
    motionData: MotionData,
    pictographData: PictographData,
    arrowKey: string
  ): GlobalAdjustmentKey {
    // Generate grid mode
    const gridMode = this.getGridMode(pictographData);

    // Generate orientation key
    const oriKey = this.oriKeyGenerator.generateOrientationKey(
      motionData,
      pictographData
    );

    // Get letter
    const letter = pictographData.letter || "";

    // Generate turns tuple
    const turnsTuple =
      this.turnsTupleGenerator.generateTurnsTuple(pictographData);

    return {
      gridMode,
      oriKey,
      letter,
      turnsTuple,
      arrowKey,
    };
  }

  /**
   * Get grid mode from pictograph data
   */
  private getGridMode(pictographData: PictographData): string {
    if (pictographData.motions.blue && pictographData.motions.red) {
      return this.gridModeDeriver.deriveGridMode(
        pictographData.motions.blue,
        pictographData.motions.red
      );
    }
    return GridMode.DIAMOND;
  }
}

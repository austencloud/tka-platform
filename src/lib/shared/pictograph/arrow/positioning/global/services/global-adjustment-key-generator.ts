/**
 * Global Adjustment Key Generator
 *
 * Generates composite keys for global arrow adjustment lookup.
 * Reuses existing key generation services from the special placement pipeline.
 */

import { GridMode } from "../../../../grid/domain/enums/grid-enums";
import { deriveGridMode as _deriveGridMode } from "../../../../grid/services/grid-mode-deriver";
import type { MotionData } from "../../../../shared/domain/models/motion-data";
import type { PictographData } from "../../../../shared/domain/models/pictograph-data";
import type { GlobalAdjustmentKey } from "../domain/global-arrow-adjustment";
import type { KeyGeneratorPropOptions } from "./types";
import type { TurnsTupleGenerator } from "../../placement/services/turns-tuple-generator";
import {
  generateOrientationKey,
  resolveEffectiveOriKey,
} from "../../key-generation/services/special-placement-ori-key-generator";
import { createCanonicalPlacementContext } from "../../calculation/services/canonical-placement-frame";
import { placementFrameForGridMode } from "../../placement/domain/placement-frame";

export class GlobalAdjustmentKeyGenerator {
  constructor(private readonly turnsTupleGenerator: TurnsTupleGenerator) {}

  /**
   * Generate a global adjustment key from motion and pictograph data.
   *
   * By default generates a Layer 1 (base) key. Pass options.propType
   * for Layer 2, or both propType and otherPropType for Layer 3.
   */
  generateKey(
    motionData: MotionData,
    pictographData: PictographData,
    arrowKey: string,
    options?: KeyGeneratorPropOptions
  ): GlobalAdjustmentKey {
    const canonicalContext = createCanonicalPlacementContext(
      pictographData,
      motionData
    );
    pictographData = canonicalContext.pictographData;
    motionData = canonicalContext.motionData;
    const placementFrame = placementFrameForGridMode(
      this.getGridMode(pictographData)
    );

    // Generate orientation key.
    // For staff+staff, collapse to legacy bucket - radial variants are identical.
    const rawOriKey = generateOrientationKey(motionData, pictographData);
    const oriKey = resolveEffectiveOriKey(rawOriKey, pictographData);

    // Get letter
    const letter = pictographData.letter || "";

    // Generate turns tuple
    const turnsTuple =
      this.turnsTupleGenerator.generateTurnsTuple(pictographData);

    // Build base key
    const key: GlobalAdjustmentKey = {
      placementFrame,
      oriKey,
      letter,
      turnsTuple,
      arrowKey,
    };

    // Add optional prop types for Layer 2/3
    if (options?.propType) {
      (key as { propType?: string }).propType = options.propType.toLowerCase();
    }
    if (options?.otherPropType) {
      (key as { otherPropType?: string }).otherPropType =
        options.otherPropType.toLowerCase();
    }

    return key;
  }

  /**
   * Get grid mode from pictograph data
   */
  private getGridMode(pictographData: PictographData): string {
    if (pictographData.motions.blue && pictographData.motions.red) {
      return _deriveGridMode(
        pictographData.motions.blue,
        pictographData.motions.red
      );
    }
    return GridMode.DIAMOND;
  }
}

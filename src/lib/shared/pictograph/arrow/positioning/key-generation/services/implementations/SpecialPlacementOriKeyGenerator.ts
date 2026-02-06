import type { ISpecialPlacementOriKeyGenerator } from "../contracts/ISpecialPlacementOriKeyGenerator";
import type { MotionData } from "../../../../../shared/domain/models/MotionData";
import type { PictographData } from "../../../../../shared/domain/models/PictographData";

/**
 * SpecialPlacementOriKeyGenerator
 * Generates ori_key matching SpecialPlacer's internal logic.
 */
export class SpecialPlacementOriKeyGenerator implements ISpecialPlacementOriKeyGenerator {
  generateOrientationKey(
    _motionData: MotionData,
    pictographData: PictographData
  ): string {
    try {
      const blueMotion = pictographData.motions.blue;
      const redMotion = pictographData.motions.red;
      if (blueMotion && redMotion) {
        const blueEndOri = blueMotion.endOrientation || "in";
        const redEndOri = redMotion.endOrientation || "in";
        const blueLayer = ["in", "out"].includes(blueEndOri) ? 1 : 2;
        const redLayer = ["in", "out"].includes(redEndOri) ? 1 : 2;

        let key: string;
        if (blueLayer === 1 && redLayer === 1) key = "from_layer1";
        else if (blueLayer === 2 && redLayer === 2) key = "from_layer2";
        else if (blueLayer === 1 && redLayer === 2)
          key = "from_layer3_blue1_red2";
        else if (blueLayer === 2 && redLayer === 1)
          key = "from_layer3_blue2_red1";
        else key = "from_layer1";

        return key;
      }
    } catch {
      // fallthrough
    }
    return "from_layer1";
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
// Use this instead of container.items.specialPlacementOriKeyGenerator to avoid DI container rebuilds.
// ============================================================================

export const specialPlacementOriKeyGenerator = new SpecialPlacementOriKeyGenerator();

import type { ISpecialPlacementOriKeyGenerator } from "../contracts/ISpecialPlacementOriKeyGenerator";
import type { MotionData } from "../../../../../shared/domain/models/MotionData";
import type { PictographData } from "../../../../../shared/domain/models/PictographData";


/**
 * SpecialPlacementOriKeyGenerator
 * Generates ori_key matching SpecialPlacer's internal logic.
 */
export class SpecialPlacementOriKeyGenerator implements ISpecialPlacementOriKeyGenerator {
  /**
   * Generate an orientation key based on start orientations of both hands.
   * The folder names use "from" — the orientation the motion comes FROM.
   * "from_layer1" = both hands start from radial (in/out).
   * "from_layer2" = both hands start from nonradial (clock/counter).
   * Returns "{blueStartOri}_{redStartOri}" (e.g., "in_in", "counter_clock").
   */
  generateOrientationKey(
    _motionData: MotionData,
    pictographData: PictographData
  ): string {
    try {
      const blueMotion = pictographData.motions.blue;
      const redMotion = pictographData.motions.red;
      if (blueMotion && redMotion) {
        const blueStartOri = blueMotion.startOrientation || "in";
        const redStartOri = redMotion.startOrientation || "in";
        return `${blueStartOri}_${redStartOri}`;
      }
    } catch {
      // fallthrough
    }
    return "in_in";
  }

  /**
   * For staff+staff, collapse to legacy bucket — radial in/out differences
   * don't affect arrow positioning on staves. For any non-staff prop, the
   * specific orientation matters visually, so return it unchanged.
   */
  resolveEffectiveOriKey(
    specificOriKey: string,
    pictographData: PictographData
  ): string {
    const blueMotion = pictographData.motions.blue;
    const redMotion = pictographData.motions.red;
    const blueProp = blueMotion?.propType?.toLowerCase() || "staff";
    const redProp = redMotion?.propType?.toLowerCase() || "staff";

    if (blueProp === "staff" && redProp === "staff") {
      return this.mapToLegacyBucket(specificOriKey);
    }

    return specificOriKey;
  }

  /**
   * Map a specific orientation key back to the legacy bucket key for fallback lookups.
   * "in"/"out" = radial (layer 1), everything else = nonradial (layer 2).
   */
  mapToLegacyBucket(specificOriKey: string): string {
    const separatorIndex = specificOriKey.indexOf("_");
    const blueOri = separatorIndex >= 0 ? specificOriKey.slice(0, separatorIndex) : specificOriKey;
    const redOri = separatorIndex >= 0 ? specificOriKey.slice(separatorIndex + 1) : "in";
    const radialOrientations = ["in", "out"];
    const blueLayer = radialOrientations.includes(blueOri) ? 1 : 2;
    const redLayer = radialOrientations.includes(redOri) ? 1 : 2;

    if (blueLayer === 1 && redLayer === 1) return "from_layer1";
    if (blueLayer === 2 && redLayer === 2) return "from_layer2";
    if (blueLayer === 1 && redLayer === 2) return "from_layer3_blue1_red2";
    return "from_layer3_blue2_red1";
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
// Use this instead of specialPlacementOriKeyGenerator to avoid DI container rebuilds.
// ============================================================================

export const specialPlacementOriKeyGenerator = new SpecialPlacementOriKeyGenerator();

/**
 * Special Placement Orientation Key Generator Contract
 */

import type { PictographData } from "../../../../../shared/domain/models/PictographData";
import type { MotionData } from "../../../../../shared/domain/models/MotionData";

export interface ISpecialPlacementOriKeyGenerator {
  generateOrientationKey(
    motionData: MotionData,
    pictographData: PictographData
  ): string;

  /**
   * Map a specific orientation key (e.g., "counter_counter") back to the
   * legacy bucket key (e.g., "from_layer2") for fallback lookups.
   * Pure function on the key string - no pictograph data needed.
   */
  mapToLegacyBucket(specificOriKey: string): string;

  /**
   * Resolve the effective orientation key based on prop context.
   *
   * For staff+staff pictographs, radial orientation differences don't
   * affect arrow positioning, so we collapse to the legacy bucket key.
   * For non-staff props, return the specific oriKey unchanged.
   */
  resolveEffectiveOriKey(
    specificOriKey: string,
    pictographData: PictographData
  ): string;
}

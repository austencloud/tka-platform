/**
 * Pictograph Arrow State
 *
 * Manages arrow positioning, assets, and lifecycle.
 * Independent sub-state - no dependencies on prop state.
 */

import type { PictographData } from "../../domain/models/PictographData";
import type { ArrowAssets } from "../../../arrow/orchestration/domain/arrow-models";
import type { IArrowLifecycleManager } from "../../../arrow/orchestration/services/contracts/IArrowLifecycleManager";

export interface PictographArrowState {
  readonly arrowPositions: Record<
    string,
    { x: number; y: number; rotation: number }
  >;
  readonly arrowMirroring: Record<string, boolean>;
  readonly arrowAssets: Record<string, ArrowAssets>;
  readonly showArrows: boolean;
  calculateArrowPositions(pictographData: PictographData | null): Promise<void>;
}

export function createPictographArrowState(
  arrowLifecycleManager: IArrowLifecycleManager
): PictographArrowState {
  // Arrow positioning state
  let arrowPositions = $state<
    Record<string, { x: number; y: number; rotation: number }>
  >({});
  let arrowMirroring = $state<Record<string, boolean>>({});
  let arrowAssets = $state<Record<string, ArrowAssets>>({});
  let showArrows = $state(false);

  async function calculateArrowPositions(
    pictographData: PictographData | null
  ): Promise<void> {
    if (!pictographData?.motions) {
      // Only clear if we don't have valid data - don't clear during transitions
      arrowPositions = {};
      arrowMirroring = {};
      arrowAssets = {};
      showArrows = true;
      return;
    }

    try {
      // Use the arrow lifecycle manager to coordinate complete arrow loading
      const arrowLifecycleResult =
        await arrowLifecycleManager.coordinateArrowLifecycle(pictographData);

      // Only update state after async loading completes - keeps old data visible during transitions
      arrowPositions = arrowLifecycleResult.positions;
      arrowMirroring = arrowLifecycleResult.mirroring;
      arrowAssets = arrowLifecycleResult.assets;
      showArrows =
        arrowLifecycleResult.allReady &&
        Object.keys(arrowLifecycleResult.positions).length > 0;

      // Log any errors
      if (Object.keys(arrowLifecycleResult.errors).length > 0) {
        console.warn(
          "⚠️ Arrow lifecycle had errors:",
          arrowLifecycleResult.errors
        );
      }
    } catch (error) {
      console.error("❌ Arrow lifecycle coordination failed:", error);
      // Only clear on error - keeps old data visible if loading fails
      arrowPositions = {};
      arrowMirroring = {};
      arrowAssets = {};
      showArrows = false;
    }
  }

  return {
    get arrowPositions() {
      return arrowPositions;
    },
    get arrowMirroring() {
      return arrowMirroring;
    },
    get arrowAssets() {
      return arrowAssets;
    },
    get showArrows() {
      return showArrows;
    },
    calculateArrowPositions,
  };
}

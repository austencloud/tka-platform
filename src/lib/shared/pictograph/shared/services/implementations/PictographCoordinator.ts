/**
 * Pictograph Coordinator Implementation
 *
 * Single responsibility service for coordinating pictograph lifecycle.
 * Orchestrates arrow loading, positioning, and rendering coordination.
 */

import type { PictographData } from "../../domain/models/PictographData";
import { createArrowLifecycleResult } from "../../../arrow/orchestration/domain/arrow-factories";
import type { IArrowLifecycleManager } from "../../../arrow/orchestration/services/contracts/IArrowLifecycleManager";
import type {
  IPictographCoordinator,
  PictographRenderingState,
} from "../contracts/IPictographCoordinator";

export class PictographCoordinator implements IPictographCoordinator {
  constructor(private arrowLifecycleManager: IArrowLifecycleManager) {}

  /**
   * Coordinate complete pictograph lifecycle
   * Ensures proper loading order and state coordination
   */
  async coordinatePictographLifecycle(
    pictographData: PictographData
  ): Promise<PictographRenderingState> {
    try {
      // Use the arrow lifecycle manager to coordinate all arrow operations
      const arrowLifecycleResult =
        await this.arrowLifecycleManager.coordinateArrowLifecycle(
          pictographData
        );

      const errors: string[] = [];

      // Collect any errors from arrow lifecycle
      Object.values(arrowLifecycleResult.errors).forEach((error) => {
        if (error) errors.push(String(error));
      });

      const isReady = arrowLifecycleResult.allReady && errors.length === 0;

      return {
        arrowLifecycleResult,
        isReady,
        errors,
      };
    } catch (error) {
      console.error("Pictograph coordination failed:", error);

      const errorMessage =
        error instanceof Error ? error.message : "Unknown coordination error";

      return {
        arrowLifecycleResult: createArrowLifecycleResult({ allReady: false }),
        isReady: false,
        errors: [errorMessage],
      };
    }
  }

  /**
   * Reset coordinator state (for data changes)
   */
  resetCoordinatorState(): void {
    // Reset arrow lifecycle manager state
    this.arrowLifecycleManager.resetArrowState();
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
// Use this instead of pictographCoordinator to avoid DI container rebuilds.
// ============================================================================

import { arrowLifecycleManager } from "../../../arrow/orchestration/services/implementations/ArrowLifecycleManager";


export const pictographCoordinator = new PictographCoordinator(arrowLifecycleManager);

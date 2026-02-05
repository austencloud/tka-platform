/**
 * Pictograph Coordinator Contract
 *
 * Single responsibility service for coordinating pictograph lifecycle.
 * Orchestrates loading, positioning, and rendering coordination.
 */

import type { PictographData } from "../../domain/models/PictographData";
import type { ArrowLifecycleResult } from "../../../arrow/orchestration/domain/arrow-models";

export interface PictographRenderingState {
  readonly arrowLifecycleResult: ArrowLifecycleResult;
  readonly isReady: boolean;
  readonly errors: string[];
}

/**
 * Pictograph Coordinator - Single point of coordination for pictograph lifecycle
 */
export interface IPictographCoordinator {
  /**
   * Coordinate complete pictograph lifecycle
   * Ensures proper loading order and state coordination
   */
  coordinatePictographLifecycle(
    pictographData: PictographData
  ): Promise<PictographRenderingState>;

  /**
   * Reset coordinator state (for data changes)
   */
  resetCoordinatorState(): void;
}

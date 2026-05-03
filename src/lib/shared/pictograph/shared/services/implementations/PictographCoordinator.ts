import type { PictographData } from "../../domain/models/PictographData";
import { createArrowLifecycleResult } from "../../../arrow/orchestration/domain/arrow-factories";
import type { ArrowLifecycleManager } from "../../../arrow/orchestration/services/implementations/ArrowLifecycleManager";
import type { PictographRenderingState } from "../contracts/types";

export class PictographCoordinator {
  constructor(private arrowLifecycleManager: ArrowLifecycleManager) {}

  async coordinatePictographLifecycle(
    pictographData: PictographData
  ): Promise<PictographRenderingState> {
    try {
      const arrowLifecycleResult =
        await this.arrowLifecycleManager.coordinateArrowLifecycle(
          pictographData
        );

      const errors: string[] = [];

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

  resetCoordinatorState(): void {
    this.arrowLifecycleManager.resetArrowState();
  }
}

import { arrowLifecycleManager } from "../../../arrow/orchestration/services/implementations/ArrowLifecycleManager";

export const pictographCoordinator = new PictographCoordinator(arrowLifecycleManager);

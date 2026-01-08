import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import type { GradientState } from "../../domain/models/DeepOceanModels";

/**
 * Contract for ocean gradient background rendering
 */
export interface IGradientRenderer {
  /**
   * Initialize gradient animation state
   */
  initializeGradientState(dimensions: Dimensions): GradientState;

  /**
   * Update gradient animation state
   */
  updateGradientState(
    state: GradientState,
    frameMultiplier: number
  ): GradientState;

  /**
   * Draw the ocean gradient background with animated effects
   */
  drawOceanGradient(
    ctx: CanvasRenderingContext2D,
    dimensions: Dimensions,
    state?: GradientState | null
  ): void;
}

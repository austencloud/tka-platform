/**
 * ICharcoalRenderer
 *
 * Interface for the charcoal/steel-wool particle renderer that
 * draws spark showers instead of fluid flames. Shares the same
 * WebGL2 context and canvas as the fluid fire renderer.
 */

import type { FireFrameInput, FireOverlayConfig } from "../../domain/types/FireTypes";

export interface ICharcoalRenderer {
  /**
   * Initialize WebGL resources (shaders, VAO, VBO) using the shared context.
   * Does NOT create a new canvas or context — receives both from the caller.
   */
  init(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext): void;

  /**
   * Simulate and render one frame of spark particles.
   * Called in place of the fluid simulation when fuel type is "charcoal".
   */
  renderSparks(input: FireFrameInput, config: FireOverlayConfig): void;

  /**
   * Release all WebGL resources (program, VBO, VAO).
   * Does NOT destroy the shared GL context.
   */
  dispose(): void;
}

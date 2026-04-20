/**
 * ISparklesOverlayRenderer
 *
 * Interface for the Canvas2D sparkles overlay that draws particle sparkles
 * around blue/red prop tips on top of the main animation. Wraps
 * `Sparkles2DRenderer` from `$lib/shared/effects/renderers` and owns its own
 * absolutely-positioned canvas element following the trail/fire/zap overlay
 * pattern.
 */

import type { Sparkles2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import type { SparklesTipInput } from "$lib/shared/effects/renderers/Sparkles2DRenderer";

export interface ISparklesOverlayRenderer {
  /**
   * Create the Canvas2D overlay and append it to the container.
   */
  initialize(container: HTMLElement, width: number, height: number): boolean;

  /**
   * Resize the overlay canvas (e.g., when container resizes).
   */
  resize(width: number, height: number): void;

  /**
   * Render one frame of sparkles. Caller passes deltaTime (seconds);
   * renderer manages the particle pool internally.
   */
  renderFrame(params: Sparkles2DParams, tips: SparklesTipInput, dt: number): void;

  /**
   * Clear the overlay canvas (used when toggling off / between sequences).
   */
  clear(): void;

  /**
   * Toggle canvas visibility without disposing.
   */
  setVisible(visible: boolean): void;
  setCanvasZIndex(z: number): void;

  /**
   * Tear down the canvas + remove it from the DOM.
   */
  dispose(): void;

  /**
   * Whether the renderer has a live canvas attached.
   */
  isInitialized(): boolean;

  /**
   * Get the overlay canvas element (null until initialize() succeeds).
   */
  getCanvas(): HTMLCanvasElement | null;
}

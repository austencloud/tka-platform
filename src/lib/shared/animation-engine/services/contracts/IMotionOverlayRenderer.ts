/**
 * IMotionOverlayRenderer
 *
 * Interface for the Canvas2D motion overlay that draws velocity-gated
 * speed feedback (ghost stamps + anime-style speed lines) around blue/red
 * prop tips on top of the main animation. Wraps `Motion2DRenderer` from
 * `$lib/shared/effects/renderers` and owns its own absolutely-positioned
 * canvas element following the trail/fire/zap/sparkles overlay pattern.
 */

import type { Motion2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import type { MotionTipInput } from "$lib/shared/effects/renderers/Motion2DRenderer";

export interface IMotionOverlayRenderer {
  /**
   * Create the Canvas2D overlay and append it to the container.
   */
  initialize(container: HTMLElement, width: number, height: number): boolean;

  /**
   * Resize the overlay canvas (e.g., when container resizes).
   */
  resize(width: number, height: number): void;

  /**
   * Render one frame of motion overlay. Caller passes deltaTime (seconds);
   * renderer manages per-tip velocity history internally.
   */
  renderFrame(params: Motion2DParams, tips: MotionTipInput, dt: number): void;

  /**
   * Clear the overlay canvas (used when toggling off / between sequences).
   */
  clear(): void;

  /**
   * Toggle canvas visibility without disposing.
   */
  setVisible(visible: boolean): void;

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

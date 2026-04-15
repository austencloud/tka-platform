/**
 * IZapOverlayRenderer
 *
 * Interface for the Canvas2D zap (lightning) overlay that draws procedural
 * arcs between blue/red prop tips on top of the main animation. Wraps
 * `Zap2DRenderer` from `$lib/shared/effects/renderers` and owns its own
 * absolutely-positioned canvas element following the trail/fire overlay
 * pattern.
 */

import type { Zap2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import type { ZapTipInput } from "$lib/shared/effects/renderers/Zap2DRenderer";

export interface IZapOverlayRenderer {
  /**
   * Create the Canvas2D overlay and append it to the container.
   * @param container - Parent element to append the overlay canvas into
   * @param width - Initial canvas width in CSS pixels
   * @param height - Initial canvas height in CSS pixels
   */
  initialize(container: HTMLElement, width: number, height: number): boolean;

  /**
   * Resize the overlay canvas (e.g., when container resizes).
   */
  resize(width: number, height: number): void;

  /**
   * Render one frame of zap arcs. Caller clears the canvas; renderer composes
   * arcs in 'lighter' mode so trails/fire show through underneath.
   */
  renderFrame(params: Zap2DParams, tips: ZapTipInput): void;

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

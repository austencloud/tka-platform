/**
 * IEchoOverlayRenderer
 *
 * Interface for the Canvas2D echo overlay that draws beat-onset phantoms
 * of the staff (stroboscope-style) on top of the main animation. Wraps
 * `Echo2DRenderer` from `$lib/shared/effects/renderers` and owns its own
 * absolutely-positioned canvas element following the trail/fire/zap/sparkles
 * overlay pattern.
 *
 * Unlike sparkles/motion, echo does not need `dt` — phantoms age by the
 * `currentStep` index already present in `EchoTipInput`, so the beat
 * lattice is authoritative regardless of frame timing jitter.
 */

import type { Echo2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import type { EchoTipInput } from "$lib/shared/effects/renderers/Echo2DRenderer";

export interface IEchoOverlayRenderer {
  /**
   * Create the Canvas2D overlay and append it to the container.
   */
  initialize(container: HTMLElement, width: number, height: number): boolean;

  /**
   * Resize the overlay canvas (e.g., when container resizes).
   */
  resize(width: number, height: number): void;

  /**
   * Render one frame of echo overlay. Phantoms age by `tips.currentStep`
   * so there is no `dt` parameter — the renderer only needs the current
   * animation step index to detect beat onsets and cull expired phantoms.
   */
  renderFrame(params: Echo2DParams, tips: EchoTipInput): void;

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

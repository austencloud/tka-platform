/**
 * IWaterOverlayRenderer
 *
 * Interface for the Canvas2D water overlay — per-tip droplet emitter with
 * palette-driven shading. Wraps `Water2DRenderer` and owns its own absolutely-
 * positioned canvas element, following the bloom/echo/sparkles overlay pattern.
 *
 * Unlike bloom, water has persistent particle state across frames (droplet
 * pool), so the renderer must receive dt per frame for physics integration.
 */

import type { Water2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import type { WaterTipInput } from "$lib/shared/effects/renderers/Water2DRenderer";

export interface IWaterOverlayRenderer {
  /** Create the Canvas2D overlay and append it to the container. */
  initialize(container: HTMLElement, width: number, height: number): boolean;

  /** Resize the overlay canvas. */
  resize(width: number, height: number): void;

  /**
   * Render one frame of water. dt is the seconds-since-last-frame; drives
   * particle physics + spawn rate integration.
   */
  renderFrame(params: Water2DParams, tips: WaterTipInput, dt: number): void;

  /** Clear the overlay canvas (toggling off / between sequences). */
  clear(): void;

  /** Toggle canvas visibility without disposing. */
  setVisible(visible: boolean): void;
  setCanvasZIndex(z: number): void;

  /** Tear down the canvas + remove it from the DOM. */
  dispose(): void;

  /** Whether the renderer has a live canvas attached. */
  isInitialized(): boolean;

  /** Get the overlay canvas element (null until initialize() succeeds). */
  getCanvas(): HTMLCanvasElement | null;
}

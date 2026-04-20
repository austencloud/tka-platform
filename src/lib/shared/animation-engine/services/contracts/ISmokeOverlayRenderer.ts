/**
 * ISmokeOverlayRenderer
 *
 * Interface for the Canvas2D smoke overlay — per-tip curl-noise puff
 * emitter with palette-driven color + behavior. Wraps `Smoke2DRenderer`
 * and owns its own absolutely-positioned canvas element, following the
 * bloom/echo/water/bubbles/petals overlay pattern.
 *
 * Smoke has persistent particle state across frames, so the renderer
 * must receive dt per frame for curl-field sampling and lifetime
 * integration.
 */

import type { Smoke2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import type { SmokeTipInput } from "$lib/shared/effects/renderers/Smoke2DRenderer";

export interface ISmokeOverlayRenderer {
  /** Create the Canvas2D overlay and append it to the container. */
  initialize(container: HTMLElement, width: number, height: number): boolean;

  /** Resize the overlay canvas. */
  resize(width: number, height: number): void;

  /**
   * Render one frame of smoke. dt is seconds-since-last-frame; drives
   * curl-field sampling, spawn rate, and lifetime integration.
   */
  renderFrame(params: Smoke2DParams, tips: SmokeTipInput, dt: number): void;

  /** Clear the overlay canvas (toggling off / between sequences). */
  clear(): void;

  /** Toggle canvas visibility without disposing. */
  setVisible(visible: boolean): void;

  /** Tear down the canvas + remove it from the DOM. */
  dispose(): void;

  /** Whether the renderer has a live canvas attached. */
  isInitialized(): boolean;

  /** Get the overlay canvas element (null until initialize() succeeds). */
  getCanvas(): HTMLCanvasElement | null;
}

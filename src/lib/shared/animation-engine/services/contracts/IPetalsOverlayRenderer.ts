/**
 * IPetalsOverlayRenderer
 *
 * Interface for the Canvas2D petals overlay - per-tip falling silhouette
 * emitter with palette-driven shape + tint. Wraps `Petals2DRenderer` and
 * owns its own absolutely-positioned canvas element, following the
 * bloom/echo/water/bubbles overlay pattern.
 *
 * Petals have persistent particle state across frames, so the renderer
 * must receive dt per frame for physics integration.
 */

import type { Petals2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import type { PetalsTipInput } from "$lib/shared/effects/renderers/Petals2DRenderer";

export interface IPetalsOverlayRenderer {
  /** Create the Canvas2D overlay and append it to the container. */
  initialize(container: HTMLElement, width: number, height: number): boolean;

  /** Resize the overlay canvas. */
  resize(width: number, height: number): void;

  /**
   * Render one frame of petals. dt is the seconds-since-last-frame; drives
   * particle physics + spawn rate integration.
   */
  renderFrame(params: Petals2DParams, tips: PetalsTipInput, dt: number): void;

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

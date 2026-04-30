/**
 * IBubblesOverlayRenderer
 *
 * Interface for the Canvas2D bubbles overlay - per-tip buoyant emitter with
 * palette-driven shading. Wraps `Bubbles2DRenderer` and owns its own absolutely-
 * positioned canvas element, following the bloom/echo/water overlay pattern.
 *
 * Like water, bubbles have persistent particle state across frames, so the
 * renderer must receive dt per frame for physics integration.
 */

import type { Bubbles2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import type { BubblesTipInput } from "$lib/shared/effects/renderers/Bubbles2DRenderer";

export interface IBubblesOverlayRenderer {
  /** Create the Canvas2D overlay and append it to the container. */
  initialize(container: HTMLElement, width: number, height: number): boolean;

  /** Resize the overlay canvas. */
  resize(width: number, height: number): void;

  /**
   * Render one frame of bubbles. dt is the seconds-since-last-frame; drives
   * particle physics + spawn rate integration.
   */
  renderFrame(params: Bubbles2DParams, tips: BubblesTipInput, dt: number): void;

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

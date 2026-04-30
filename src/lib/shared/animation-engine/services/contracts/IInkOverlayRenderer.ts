/**
 * IInkOverlayRenderer
 *
 * Interface for the Canvas2D ink overlay - per-tip stroke path builder
 * with variable lineWidth from velocity. Wraps `Ink2DRenderer` and owns
 * its own absolutely-positioned canvas element, following the smoke /
 * bloom / petals overlay pattern.
 *
 * Ink has persistent per-tip point history across frames, so the
 * renderer must receive dt per frame for lifetime aging.
 */

import type { Ink2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import type { InkTipInput } from "$lib/shared/effects/renderers/Ink2DRenderer";

export interface IInkOverlayRenderer {
  /** Create the Canvas2D overlay and append it to the container. */
  initialize(container: HTMLElement, width: number, height: number): boolean;

  /** Resize the overlay canvas. */
  resize(width: number, height: number): void;

  /**
   * Render one frame of ink. dt is seconds-since-last-frame; drives
   * emission spawn rate and point lifetime.
   */
  renderFrame(params: Ink2DParams, tips: InkTipInput, dt: number): void;

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

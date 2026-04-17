/**
 * IBloomOverlayRenderer
 *
 * Interface for the Canvas2D bloom overlay that draws per-tip radial
 * halation — a continuous additive light field fixed to each active
 * prop tip. Wraps `Bloom2DRenderer` from `$lib/shared/effects/renderers`
 * and owns its own absolutely-positioned canvas element, following the
 * sparkles/echo overlay pattern.
 *
 * Unlike echo, bloom is not beat-driven — it uses `performance.now()`
 * internally for pulse modulation. Callers pass per-tip positions only.
 */

import type { Bloom2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import type { BloomTipInput } from "$lib/shared/effects/renderers/Bloom2DRenderer";

export interface IBloomOverlayRenderer {
  /** Create the Canvas2D overlay and append it to the container. */
  initialize(container: HTMLElement, width: number, height: number): boolean;

  /** Resize the overlay canvas (e.g., when container resizes). */
  resize(width: number, height: number): void;

  /**
   * Render one frame of bloom overlay. Time advances via
   * `performance.now()` inside the renderer — pulse modulation is
   * continuous regardless of playback state.
   */
  renderFrame(params: Bloom2DParams, tips: BloomTipInput[]): void;

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

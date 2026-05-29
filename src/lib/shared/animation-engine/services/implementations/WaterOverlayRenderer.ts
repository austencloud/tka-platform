/**
 * Water Overlay Renderer
 *
 * Owns an absolutely-positioned Canvas2D element on top of the animator
 * surface and delegates per-frame drawing to `Water2DRenderer`. Follows
 * the bloom/echo/sparkles overlay pattern: position:absolute, pointer-
 * events:none, z-index above trails.
 *
 * Water has persistent particle state (droplet pool), so unlike bloom we
 * do NOT clear the accumulated droplets on each frame - only the canvas
 * pixels. The pool is cleared on dispose() or explicit clear().
 */

import type { Water2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import {
  Water2DRenderer,
  type WaterTipInput,
} from "$lib/shared/effects/renderers/Water2DRenderer";
import { EffectRenderer } from "../effects/EffectRenderer";

export class WaterOverlayRenderer extends EffectRenderer {
  private renderer = new Water2DRenderer();

  renderFrame(params: Water2DParams, tips: WaterTipInput, dt: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.width, this.height);
    this.renderer.render(ctx, params, tips, dt, this.scale);
  }

  protected override onClear(): void {
    this.renderer.dispose();
  }

  protected override onDispose(): void {
    this.renderer.dispose();
  }
}

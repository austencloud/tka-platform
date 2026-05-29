/**
 * Petals Overlay Renderer
 *
 * Owns an absolutely-positioned Canvas2D element on top of the animator
 * surface and delegates per-frame drawing to `Petals2DRenderer`. Follows
 * the bloom/echo/water/bubbles overlay pattern: position:absolute, pointer-
 * events:none, z-index above trails.
 *
 * Petals have persistent particle state (falling particles + per-petal
 * sway phase), so unlike bloom we do NOT clear accumulated state on each
 * frame - only the canvas pixels. The pool is cleared on dispose() or
 * explicit clear().
 */

import type { Petals2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import {
  Petals2DRenderer,
  type PetalsTipInput,
} from "$lib/shared/effects/renderers/Petals2DRenderer";
import { EffectRenderer } from "../effects/EffectRenderer";

export class PetalsOverlayRenderer extends EffectRenderer {
  private renderer = new Petals2DRenderer();

  renderFrame(params: Petals2DParams, tips: PetalsTipInput, dt: number): void {
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

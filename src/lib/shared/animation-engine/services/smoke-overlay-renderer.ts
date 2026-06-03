/**
 * Smoke Overlay Renderer
 *
 * Owns an absolutely-positioned Canvas2D element on top of the animator
 * surface and delegates per-frame drawing to `Smoke2DRenderer`. Follows
 * the bloom/echo/water/bubbles/petals overlay pattern: position:absolute,
 * pointer-events:none, z-index above trails.
 *
 * Smoke has persistent particle state (curl-noise-driven puffs + per-
 * puff phase), so unlike bloom we do NOT clear accumulated state on each
 * frame - only the canvas pixels. The pool is cleared on dispose() or
 * explicit clear().
 */

import type { Smoke2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import {
  Smoke2DRenderer,
  type SmokeTipInput,
} from "$lib/shared/effects/renderers/smoke-2d-renderer";
import { EffectRenderer } from "./effects/effect-renderer";

export class SmokeOverlayRenderer extends EffectRenderer {
  private renderer = new Smoke2DRenderer();

  renderFrame(params: Smoke2DParams, tips: SmokeTipInput, dt: number): void {
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

// ── EffectPlugin descriptor ──────────────────────────────────────────────────
import type { EffectPlugin } from "./effects/effect-plugin";
import type { SmokeIntent } from "$lib/shared/effects/domain/effects-config";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";

export const smokeEffectPlugin: EffectPlugin<SmokeIntent> = {
  id: "smoke",
  kind: "canvas2d",
  createRenderer: () => new SmokeOverlayRenderer(),
  defaultConfig: DEFAULT_EFFECTS_CONFIG.smoke,
  configKey: "smokeRenderer",
};

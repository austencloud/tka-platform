/**
 * Echo Overlay Renderer
 *
 * Owns an absolutely-positioned Canvas2D element on top of the animator
 * surface and delegates per-frame drawing to `Echo2DRenderer`. Mirrors
 * the sparkles overlay pattern: position:absolute, pointer-events:none,
 * z-index sits above the trails canvas (1) but below LED.
 *
 * The overlay canvas is fully cleared each frame before drawing - the
 * Echo2DRenderer uses additive blending and its own phantom ring buffer
 * to manage persistence across frames. Drawing a fresh frame each tick
 * keeps fade behavior predictable when the step index doesn't advance
 * (paused) or jumps (seek).
 */

import type { Echo2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import {
  Echo2DRenderer,
  type EchoTipInput,
} from "$lib/shared/effects/renderers/Echo2DRenderer";
import { EffectRenderer } from "./effects/EffectRenderer";

export class EchoOverlayRenderer extends EffectRenderer {
  private renderer = new Echo2DRenderer();

  renderFrame(params: Echo2DParams, tips: EchoTipInput): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.width, this.height);
    this.renderer.render(ctx, params, tips, this.scale);
  }

  protected override onDispose(): void {
    this.renderer.dispose();
  }
}

// ── EffectPlugin descriptor ──────────────────────────────────────────────────
import type { EffectPlugin } from "./effects/EffectPlugin";
import type { EchoIntent } from "$lib/shared/effects/domain/EffectsConfig";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";

export const echoEffectPlugin: EffectPlugin<EchoIntent> = {
  id: "echo",
  kind: "canvas2d",
  createRenderer: () => new EchoOverlayRenderer(),
  defaultConfig: DEFAULT_EFFECTS_CONFIG.echo,
  configKey: "echoRenderer",
};

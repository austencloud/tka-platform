import type { Silk2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import {
  Silk2DRenderer,
  type SilkTipInput,
} from "$lib/shared/effects/renderers/silk-2d-renderer";
import { EffectRenderer } from "./effects/effect-renderer";

export class SilkOverlayRenderer extends EffectRenderer {
  private renderer = new Silk2DRenderer();

  renderFrame(params: Silk2DParams, tips: SilkTipInput, dt: number, loopDetected?: boolean): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.width, this.height);
    this.renderer.render(ctx, params, tips, dt, this.scale, loopDetected);
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
import type { SilkIntent } from "$lib/shared/effects/domain/effects-config";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";

export const silkEffectPlugin: EffectPlugin<SilkIntent> = {
  id: "silk",
  kind: "canvas2d",
  createRenderer: () => new SilkOverlayRenderer(),
  defaultConfig: DEFAULT_EFFECTS_CONFIG.silk,
  configKey: "silkRenderer",
};

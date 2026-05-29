import type { Silk2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import {
  Silk2DRenderer,
  type SilkTipInput,
} from "$lib/shared/effects/renderers/Silk2DRenderer";
import { EffectRenderer } from "../effects/EffectRenderer";

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

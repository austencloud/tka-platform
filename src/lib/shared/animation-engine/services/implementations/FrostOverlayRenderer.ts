import type { Frost2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import {
  Frost2DRenderer,
  type FrostTipInput,
} from "$lib/shared/effects/renderers/Frost2DRenderer";
import { EffectRenderer } from "../effects/EffectRenderer";

export class FrostOverlayRenderer extends EffectRenderer {
  private renderer = new Frost2DRenderer();

  renderFrame(params: Frost2DParams, tips: FrostTipInput, dt: number): void {
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

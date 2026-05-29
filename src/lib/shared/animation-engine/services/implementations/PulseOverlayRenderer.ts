import type { Pulse2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import {
  Pulse2DRenderer,
  type PulseTipInput,
} from "$lib/shared/effects/renderers/Pulse2DRenderer";
import { EffectRenderer } from "../effects/EffectRenderer";

export class PulseOverlayRenderer extends EffectRenderer {
  private renderer = new Pulse2DRenderer();

  renderFrame(params: Pulse2DParams, tips: PulseTipInput[], currentStep: number, dt: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.width, this.height);
    this.renderer.render(ctx, params, tips, currentStep, dt, this.scale);
  }

  protected override onDispose(): void {
    this.renderer.dispose();
  }
}

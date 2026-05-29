import type { Pulse2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import {
  Pulse2DRenderer,
  type PulseTipInput,
} from "$lib/shared/effects/renderers/Pulse2DRenderer";
import { EffectRenderer } from "./effects/EffectRenderer";

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

// ── EffectPlugin descriptor ──────────────────────────────────────────────────
import type { EffectPlugin } from "./effects/EffectPlugin";
import type { PulseIntent } from "$lib/shared/effects/domain/EffectsConfig";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";

export const pulseEffectPlugin: EffectPlugin<PulseIntent> = {
  id: "pulse",
  kind: "canvas2d",
  createRenderer: () => new PulseOverlayRenderer(),
  defaultConfig: DEFAULT_EFFECTS_CONFIG.pulse,
  configKey: "pulseRenderer",
};

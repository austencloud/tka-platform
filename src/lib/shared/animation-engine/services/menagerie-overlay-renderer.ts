import type { Menagerie2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import { Menagerie2DRenderer } from "$lib/shared/effects/renderers/menagerie-2d-renderer";
import type { EmitterTip } from "$lib/shared/effects/renderers/emitter-tip";
import { EffectRenderer } from "./effects/effect-renderer";

export class MenagerieOverlayRenderer extends EffectRenderer {
  private renderer = new Menagerie2DRenderer();

  renderFrame(params: Menagerie2DParams, tips: EmitterTip[], dt: number, loopDetected?: boolean): void {
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
import type { MenagerieIntent } from "$lib/shared/effects/domain/effects-config";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";

export const menagerieEffectPlugin: EffectPlugin<MenagerieIntent> = {
  id: "menagerie",
  kind: "canvas2d",
  createRenderer: () => new MenagerieOverlayRenderer(),
  defaultConfig: DEFAULT_EFFECTS_CONFIG.menagerie,
  configKey: "menagerieRenderer",
};

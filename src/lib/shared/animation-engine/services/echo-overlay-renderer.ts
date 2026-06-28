/**
 * Echo Overlay Renderer — Long-Exposure Strobe
 *
 * Owns an absolutely-positioned Canvas2D element on top of the animator surface
 * plus a private OffscreenCanvas accumulation buffer. The Echo2DRenderer stamps
 * a crisp light-painted clone of the prop into the accumulator on each beat; the
 * overlay fades the accumulator over the exposure window and composites it to
 * the visible canvas. This is what turns discrete beat-snapshots into a single
 * baked long exposure - the real strobe-photography look.
 *
 * The accumulation + fade pattern (destination-out fade, throttled
 * smoothAlphaDecay to beat 8-bit rounding, drawImage composite) mirrors the
 * shipped TrailOverlayCanvas. z-index sits in the bloom/echo/sparkles band (2).
 */

import type { Echo2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import {
  Echo2DRenderer,
  type EchoTipInput,
} from "$lib/shared/effects/renderers/echo-2d-renderer";
import { EffectRenderer } from "./effects/effect-renderer";

export class EchoOverlayRenderer extends EffectRenderer {
  private renderer = new Echo2DRenderer();
  private accumCanvas: OffscreenCanvas | null = null;
  private accumCtx: OffscreenCanvasRenderingContext2D | null = null;
  private previousStep = -1;
  private decayFrameCounter = 0;

  /** Backward `currentStep` jump beyond this = animation loop → fresh exposure. */
  private static readonly LOOP_THRESHOLD = 0.5;
  /** Fraction of a stamp's alpha that survives `decay` beats (≈ fully faded). */
  private static readonly TARGET_REMAINING = 0.04;
  /** smoothAlphaDecay runs every N frames (GPU↔CPU readback is costly). */
  private static readonly DECAY_INTERVAL = 10;
  /** Base subtractive alpha step that guarantees stamps reach 0 despite rounding. */
  private static readonly DECAY_STEP = 14;

  renderFrame(params: Echo2DParams, tips: EchoTipInput): void {
    const ctx = this.ctx;
    const accumCtx = this.accumCtx;
    if (!ctx || !accumCtx) return;

    const currentStep = tips.currentStep;

    // Animation loop → clear the exposure and reset the stamp's onset/streak
    // memory so the next iteration paints a fresh exposure.
    if (
      this.previousStep >= 0 &&
      this.previousStep - currentStep > EchoOverlayRenderer.LOOP_THRESHOLD
    ) {
      accumCtx.clearRect(0, 0, this.width, this.height);
      this.renderer.reset();
    }
    const deltaStep =
      this.previousStep >= 0 ? currentStep - this.previousStep : 0;
    this.previousStep = currentStep;

    // 1. Fade the exposure. The fade amount is keyed to beats-per-frame so the
    //    exposure length stays `decay` beats regardless of frame rate. A paused
    //    or seeked-back frame (deltaStep <= 0) holds the exposure.
    if (deltaStep > 0) {
      const decay = Math.max(0.25, params.decay);
      const perFrameRemaining = Math.pow(
        EchoOverlayRenderer.TARGET_REMAINING,
        deltaStep / decay,
      );
      const fadeAmount = 1 - perFrameRemaining;
      accumCtx.save();
      accumCtx.globalCompositeOperation = "destination-out";
      accumCtx.globalAlpha = fadeAmount;
      accumCtx.fillStyle = "black";
      accumCtx.fillRect(0, 0, this.width, this.height);
      accumCtx.restore();

      this.smoothAlphaDecay(accumCtx, params.depth ?? 0);
    }

    // 2. Stamp this beat's clone(s) into the accumulator (no-op off-beat).
    this.renderer.render(
      accumCtx as unknown as CanvasRenderingContext2D,
      params,
      tips,
      this.scale,
    );

    // 3. Composite the exposure onto the visible canvas at peak `intensity`.
    ctx.clearRect(0, 0, this.width, this.height);
    if (this.accumCanvas) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, params.intensity));
      ctx.drawImage(this.accumCanvas, 0, 0);
      ctx.restore();
    }
  }

  /**
   * Subtract a constant from every low-alpha pixel so destination-out's
   * multiplicative fade actually reaches 0 (8-bit rounding never gets there on
   * its own). Throttled - the full-canvas getImageData/putImageData is a
   * GPU↔CPU roundtrip. `depth` steepens the tail (older = dimmer faster).
   */
  private smoothAlphaDecay(
    ctx: OffscreenCanvasRenderingContext2D,
    depth: number,
  ): void {
    this.decayFrameCounter++;
    if (this.decayFrameCounter < EchoOverlayRenderer.DECAY_INTERVAL) return;
    this.decayFrameCounter = 0;

    const w = this.width;
    const h = this.height;
    if (w === 0 || h === 0) return;

    const step = Math.round(
      EchoOverlayRenderer.DECAY_STEP * (1 + depth * 2),
    );
    const threshold = step + 10;
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    let dirty = false;
    for (let i = 3; i < data.length; i += 4) {
      const a = data[i]!;
      if (a > 0 && a <= threshold) {
        data[i] = Math.max(0, a - step);
        dirty = true;
      }
    }
    if (dirty) ctx.putImageData(imageData, 0, 0);
  }

  private ensureAccumulator(): void {
    if (typeof OffscreenCanvas === "undefined") return;
    this.accumCanvas = new OffscreenCanvas(
      Math.max(1, this.width),
      Math.max(1, this.height),
    );
    this.accumCtx = this.accumCanvas.getContext("2d", {
      willReadFrequently: true,
    });
  }

  protected override onInitialized(): void {
    this.previousStep = -1;
    this.decayFrameCounter = 0;
    this.ensureAccumulator();
  }

  override resize(width: number, height: number): void {
    super.resize(width, height);
    if (this.accumCanvas) {
      this.accumCanvas.width = Math.max(1, width);
      this.accumCanvas.height = Math.max(1, height);
    }
  }

  protected override onClear(): void {
    this.accumCtx?.clearRect(0, 0, this.width, this.height);
    this.previousStep = -1;
    this.renderer.reset();
  }

  protected override onDispose(): void {
    this.renderer.dispose();
    this.accumCanvas = null;
    this.accumCtx = null;
    this.previousStep = -1;
  }
}

// ── EffectPlugin descriptor ──────────────────────────────────────────────────
import type { EffectPlugin } from "./effects/effect-plugin";
import type { EchoIntent } from "$lib/shared/effects/domain/effects-config";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";

export const echoEffectPlugin: EffectPlugin<EchoIntent> = {
  id: "echo",
  kind: "canvas2d",
  createRenderer: () => new EchoOverlayRenderer(),
  defaultConfig: DEFAULT_EFFECTS_CONFIG.echo,
  configKey: "echoRenderer",
};

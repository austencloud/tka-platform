/**
 * Zap Overlay Renderer
 *
 * Owns an absolutely-positioned Canvas2D element on top of the animator
 * surface and delegates per-frame drawing to `Zap2DRenderer`. Mirrors the
 * trail/fire overlay pattern: position:absolute, pointer-events:none,
 * z-index sits above the trails canvas (1) but below LED (which composites
 * via WebGL on its own layer).
 *
 * The overlay canvas is fully cleared each frame before drawing - Zap2DRenderer
 * uses additive blending, so we don't want stale arcs from the previous frame
 * to fade in/out unpredictably. Procedural midpoint-displacement regenerates
 * arcs every few frames inside the renderer to produce the flicker.
 */

import type { Zap2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import { Zap2DRenderer, type ZapTipInput } from "$lib/shared/effects/renderers/Zap2DRenderer";
import { computeEffectScale } from "$lib/shared/effects/renderers/scale";

export class ZapOverlayRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private renderer = new Zap2DRenderer();
  private width = 0;
  private height = 0;
  private scale = 1;

  initialize(container: HTMLElement, width: number, height: number): boolean {
    this.dispose();

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.setAttribute("aria-hidden", "true");

    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    // Sit above the trail overlay (z-index 1) so arcs render on top of trails.
    canvas.style.zIndex = "2";
    canvas.style.background = "transparent";

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      // Browser refused 2D context - bail without attaching to the DOM.
      return false;
    }

    container.appendChild(canvas);
    this.canvas = canvas;
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.scale = computeEffectScale(width, height);
    return true;
  }

  resize(width: number, height: number): void {
    if (!this.canvas) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.width = width;
    this.height = height;
    this.scale = computeEffectScale(width, height);
  }

  renderFrame(params: Zap2DParams, tips: ZapTipInput): void {
    const ctx = this.ctx;
    if (!ctx) return;

    // Always clear - the underlying renderer uses 'lighter' composite, so
    // residual pixels from the previous frame would accumulate brightness.
    ctx.clearRect(0, 0, this.width, this.height);

    // If no tips at all, we already cleared - nothing more to draw.
    if (!tips.bluePosA && !tips.bluePosB && !tips.redPosA && !tips.redPosB) {
      return;
    }

    this.renderer.render(ctx, params, tips, this.scale);
  }

  clear(): void {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  setVisible(visible: boolean): void {
    if (!this.canvas) return;
    this.canvas.style.display = visible ? "" : "none";
  }

  setCanvasZIndex(z: number): void {
    if (this.canvas) this.canvas.style.zIndex = String(z);
  }

  dispose(): void {
    if (this.canvas?.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
    this.renderer.dispose();
    this.canvas = null;
    this.ctx = null;
    this.width = 0;
    this.height = 0;
    this.scale = 1;
  }

  isInitialized(): boolean {
    return this.canvas !== null && this.ctx !== null;
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }
}

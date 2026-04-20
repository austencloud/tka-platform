/**
 * Sparkles Overlay Renderer
 *
 * Owns an absolutely-positioned Canvas2D element on top of the animator
 * surface and delegates per-frame drawing to `Sparkles2DRenderer`. Mirrors
 * the zap overlay pattern: position:absolute, pointer-events:none, z-index
 * sits above the trails canvas (1) but below LED.
 *
 * The overlay canvas is fully cleared each frame before drawing — Sparkles2DRenderer
 * uses additive blending, so we don't want stale particles from the previous frame
 * to fade in/out unpredictably. The renderer holds particle pool state across frames.
 */

import type { ISparklesOverlayRenderer } from "../contracts/ISparklesOverlayRenderer";
import type { Sparkles2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import {
  Sparkles2DRenderer,
  type SparklesTipInput,
} from "$lib/shared/effects/renderers/Sparkles2DRenderer";
import { computeEffectScale } from "$lib/shared/effects/renderers/scale";

export class SparklesOverlayRenderer implements ISparklesOverlayRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private renderer = new Sparkles2DRenderer();
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
    // Sit above the trail overlay (z-index 1) so particles render on top of trails.
    canvas.style.zIndex = "2";
    canvas.style.background = "transparent";

    const ctx = canvas.getContext("2d");
    if (!ctx) {
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

  renderFrame(params: Sparkles2DParams, tips: SparklesTipInput, dt: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.width, this.height);
    // Step physics every frame so existing particles continue decaying even when
    // tips drop out (e.g., between sequence loops).
    this.renderer.render(ctx, params, tips, dt, this.scale);
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

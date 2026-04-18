/**
 * Echo Overlay Renderer
 *
 * Owns an absolutely-positioned Canvas2D element on top of the animator
 * surface and delegates per-frame drawing to `Echo2DRenderer`. Mirrors
 * the sparkles overlay pattern: position:absolute, pointer-events:none,
 * z-index sits above the trails canvas (1) but below LED.
 *
 * The overlay canvas is fully cleared each frame before drawing — the
 * Echo2DRenderer uses additive blending and its own phantom ring buffer
 * to manage persistence across frames. Drawing a fresh frame each tick
 * keeps fade behavior predictable when the step index doesn't advance
 * (paused) or jumps (seek).
 */

import type { IEchoOverlayRenderer } from "../contracts/IEchoOverlayRenderer";
import type { Echo2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import {
  Echo2DRenderer,
  type EchoTipInput,
} from "$lib/shared/effects/renderers/Echo2DRenderer";
import { computeEffectScale } from "$lib/shared/effects/renderers/scale";

export class EchoOverlayRenderer implements IEchoOverlayRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private renderer = new Echo2DRenderer();
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
    // Sit above the trail overlay (z-index 1) so phantoms render on top of trails.
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

  renderFrame(params: Echo2DParams, tips: EchoTipInput): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.width, this.height);
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

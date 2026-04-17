/**
 * Motion Overlay Renderer
 *
 * Owns an absolutely-positioned Canvas2D element on top of the animator
 * surface and delegates per-frame drawing to `Motion2DRenderer`. Mirrors
 * the sparkles overlay pattern: position:absolute, pointer-events:none,
 * z-index sits above the trails canvas (1) but below LED.
 *
 * The overlay canvas is fully cleared each frame before drawing — Motion2DRenderer
 * uses additive blending, so we don't want stale ghost stamps from the previous
 * frame to fade in/out unpredictably. The renderer holds per-tip velocity
 * history state across frames.
 */

import type { IMotionOverlayRenderer } from "../contracts/IMotionOverlayRenderer";
import type { Motion2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import {
  Motion2DRenderer,
  type MotionTipInput,
} from "$lib/shared/effects/renderers/Motion2DRenderer";

export class MotionOverlayRenderer implements IMotionOverlayRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private renderer = new Motion2DRenderer();
  private width = 0;
  private height = 0;

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
    // Sit above the trail overlay (z-index 1) so streaks render on top of trails.
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
    return true;
  }

  resize(width: number, height: number): void {
    if (!this.canvas) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.width = width;
    this.height = height;
  }

  renderFrame(params: Motion2DParams, tips: MotionTipInput, dt: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.width, this.height);
    // Step renderer every frame so per-tip history continues to update even
    // when individual tips drop out (e.g., between sequence loops).
    this.renderer.render(ctx, params, tips, dt);
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
  }

  isInitialized(): boolean {
    return this.canvas !== null && this.ctx !== null;
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }
}

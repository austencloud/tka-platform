/**
 * Ink Overlay Renderer
 *
 * Owns an absolutely-positioned Canvas2D element on top of the animator
 * surface and delegates per-frame drawing to `Ink2DRenderer`. Follows
 * the smoke overlay pattern: position:absolute, pointer-events:none,
 * z-index above trails.
 *
 * Ink has persistent per-tip point history (for the stroke path), so
 * unlike bloom we don't clear accumulated state on each frame — only
 * the canvas pixels. The per-tip history is cleared on dispose() or
 * explicit clear() (e.g. sequence boundary).
 */

import type { IInkOverlayRenderer } from "../contracts/IInkOverlayRenderer";
import type { Ink2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import {
  Ink2DRenderer,
  type InkTipInput,
} from "$lib/shared/effects/renderers/Ink2DRenderer";
import { computeEffectScale } from "$lib/shared/effects/renderers/scale";

export class InkOverlayRenderer implements IInkOverlayRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private renderer = new Ink2DRenderer();
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
    canvas.style.zIndex = "2";
    canvas.style.background = "transparent";

    const ctx = canvas.getContext("2d");
    if (!ctx) return false;

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

  renderFrame(params: Ink2DParams, tips: InkTipInput, dt: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.width, this.height);
    this.renderer.render(ctx, params, tips, dt, this.scale);
  }

  clear(): void {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.renderer.dispose();
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

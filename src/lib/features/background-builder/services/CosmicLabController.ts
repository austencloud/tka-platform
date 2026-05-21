/**
 * Controller for managing the Cosmic Lab canvas and animation lifecycle
 */

import { CosmicBackgroundSystem, type QualityLevel } from "@austencloud/backgrounds";
import type { CosmicLayers } from "./types";

export class CosmicLabController {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private system: CosmicBackgroundSystem | null = null;
  private animationFrame: number | null = null;
  private lastFrameTime = 0;

  initialize(canvas: HTMLCanvasElement, quality: QualityLevel, layers: CosmicLayers): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    if (!this.ctx) return;

    const parentEl = canvas.parentElement;
    if (parentEl) {
      canvas.width = parentEl.clientWidth;
      canvas.height = parentEl.clientHeight;
    }

    try {
      this.system = CosmicBackgroundSystem.create();
      const dimensions = { width: canvas.width, height: canvas.height };
      this.system.initialize(dimensions, quality);

      if (this.system.setLayerVisibility) {
        this.system.setLayerVisibility(layers);
      }
    } catch (error) {
      console.error("Failed to initialize Cosmic preview:", error);
    }
  }

  start(): void {
    if (!this.canvas || !this.ctx || !this.system) return;

    const animate = (currentTime: number) => {
      if (!this.canvas || !this.system || !this.ctx) return;

      const deltaTime = currentTime - this.lastFrameTime;
      const frameMultiplier = deltaTime / 16.67;
      this.lastFrameTime = currentTime;

      const dimensions = { width: this.canvas.width, height: this.canvas.height };
      this.system.update(dimensions, frameMultiplier);
      this.ctx.clearRect(0, 0, dimensions.width, dimensions.height);
      this.system.draw(this.ctx, dimensions);

      this.animationFrame = requestAnimationFrame(animate);
    };

    this.lastFrameTime = performance.now();
    this.animationFrame = requestAnimationFrame(animate);
  }

  stop(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  handleResize(): void {
    if (!this.canvas || !this.system) return;

    const parentEl = this.canvas.parentElement;
    if (parentEl) {
      const oldDimensions = { width: this.canvas.width, height: this.canvas.height };
      this.canvas.width = parentEl.clientWidth;
      this.canvas.height = parentEl.clientHeight;
      const newDimensions = { width: this.canvas.width, height: this.canvas.height };
      this.system.handleResize?.(oldDimensions, newDimensions);
    }
  }

  cleanup(): void {
    this.stop();
    this.system?.cleanup?.();
    this.system = null;
    this.canvas = null;
    this.ctx = null;
  }

  regenerate(quality: QualityLevel, layers: CosmicLayers): void {
    if (!this.canvas) return;

    this.stop();
    this.system?.cleanup?.();
    this.system = null;

    // Re-initialize with same canvas
    this.ctx = this.canvas.getContext("2d");
    if (!this.ctx) return;

    try {
      this.system = CosmicBackgroundSystem.create();
      const dimensions = { width: this.canvas.width, height: this.canvas.height };
      this.system.initialize(dimensions, quality);

      if (this.system.setLayerVisibility) {
        this.system.setLayerVisibility(layers);
      }

      this.start();
    } catch (error) {
      console.error("Failed to regenerate Cosmic preview:", error);
    }
  }

  setLayerVisibility(layers: CosmicLayers): void {
    if (this.system?.setLayerVisibility) {
      this.system.setLayerVisibility(layers);
    }
  }

  getSystem(): CosmicBackgroundSystem | null {
    return this.system;
  }

  isInitialized(): boolean {
    return this.system !== null;
  }

  handleCanvasClick(clickX: number, clickY: number): void {
    this.system?.handleCanvasClick(clickX, clickY);
  }
}

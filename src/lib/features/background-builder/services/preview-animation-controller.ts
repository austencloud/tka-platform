/**
 * Controller for managing the Forest preview animation
 */

import {
  ForestBackgroundSystem,
  ECOLOGICAL_PATTERNS,
  type QualityLevel,
  type ForestLayers,
  type TreeTypeVisibility,
  type EcologicalPattern,
  type RenderedTree,
} from "@austencloud/backgrounds";
import type { PreviewStats, PlacementConfig } from "./types";

export class PreviewAnimationController {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private system: ForestBackgroundSystem | null = null;
  private animationFrame: number | null = null;
  private lastFrameTime = 0;
  private lastStatsUpdate = 0;
  private currentStats: PreviewStats = {
    fireflies: 0,
    stars: 0,
    ambientParticles: 0,
    hasShootingStar: false,
  };

  initialize(
    canvas: HTMLCanvasElement,
    quality: QualityLevel,
    layers: ForestLayers
  ): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    if (!this.ctx) return;

    const parentEl = canvas.parentElement;
    if (parentEl) {
      canvas.width = parentEl.clientWidth;
      canvas.height = parentEl.clientHeight;
    }

    try {
      this.system = new ForestBackgroundSystem();
      const dimensions = { width: canvas.width, height: canvas.height };
      this.system.initialize(dimensions, quality);
      this.system.setLayerVisibility(layers);
      this.updateStats();
    } catch (error) {
      console.error("Failed to initialize Forest preview:", error);
    }
  }

  start(): void {
    if (!this.canvas || !this.ctx) return;

    const animate = (currentTime: number) => {
      if (!this.canvas || !this.system || !this.ctx) return;

      const deltaTime = currentTime - this.lastFrameTime;
      const frameMultiplier = deltaTime / 16.67;
      this.lastFrameTime = currentTime;

      const dimensions = { width: this.canvas.width, height: this.canvas.height };
      this.system.update(dimensions, frameMultiplier);
      this.ctx.clearRect(0, 0, dimensions.width, dimensions.height);
      this.system.draw(this.ctx, dimensions);

      // Update stats every second
      if (currentTime - this.lastStatsUpdate > 1000) {
        this.updateStats();
        this.lastStatsUpdate = currentTime;
      }

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
    if (!this.canvas) return;
    const parentEl = this.canvas.parentElement;
    if (parentEl) {
      const oldDimensions = { width: this.canvas.width, height: this.canvas.height };
      this.canvas.width = parentEl.clientWidth;
      this.canvas.height = parentEl.clientHeight;
      this.system?.handleResize(oldDimensions, {
        width: this.canvas.width,
        height: this.canvas.height,
      });
    }
  }

  cleanup(): void {
    this.stop();
    this.system?.cleanup();
    this.system = null;
    this.canvas = null;
    this.ctx = null;
  }

  regenerate(): void {
    if (!this.canvas) return;

    // Preserve current settings before cleanup
    const quality = this.system ? "high" : "high";
    const layers = this.getDefaultLayers();
    const patternId = this.system?.getEcologicalPatternId() ?? "random";

    this.stop();
    this.system?.cleanup();
    this.system = null;

    // Re-initialize with same canvas
    this.ctx = this.canvas.getContext("2d");
    if (!this.ctx) return;

    try {
      this.system = new ForestBackgroundSystem();
      const dimensions = { width: this.canvas.width, height: this.canvas.height };
      this.system.initialize(dimensions, quality);
      this.system.setLayerVisibility(layers);
      // Restore the ecological pattern
      this.system.setEcologicalPattern(patternId);
      this.system.regenerateTrees();
      this.updateStats();
      this.start();
    } catch (error) {
      console.error("Failed to regenerate Forest preview:", error);
    }
  }

  setQuality(quality: QualityLevel): void {
    if (this.system) {
      this.system.setQuality(quality);
      this.updateStats();
    }
  }

  setLayerVisibility(layers: ForestLayers): void {
    this.system?.setLayerVisibility(layers);
  }

  setTreeVisibility(treeTypes: TreeTypeVisibility): void {
    if (this.system) {
      this.system.setTreeVisibility(treeTypes);
      this.system.regenerateTrees();
    }
  }

  applyPlacement(config: PlacementConfig): void {
    if (!this.system) return;
    const minSpacing = 0.08 * (1 - config.density);
    const crossLayerThreshold = 0.06 * (1 - config.density);
    const jitter = 0.5 * (1 - config.style);
    const heroStrength = config.style;
    this.system.setPlacementConfig({ minSpacing, crossLayerThreshold, jitter, heroStrength });
    this.system.regenerateTrees();
  }

  resetPlacement(): void {
    this.system?.resetPlacementConfig();
    this.system?.regenerateTrees();
  }

  updateMousePosition(clientX: number, clientY: number): void {
    this.system?.updateMousePosition(
      clientX,
      clientY,
      window.innerWidth,
      window.innerHeight
    );
  }

  resetMousePosition(): void {
    this.system?.updateMousePosition(
      window.innerWidth / 2,
      window.innerHeight / 2,
      window.innerWidth,
      window.innerHeight
    );
  }

  getStats(): PreviewStats {
    return { ...this.currentStats };
  }

  isInitialized(): boolean {
    return this.system !== null;
  }

  getAvailablePatterns(): EcologicalPattern[] {
    return ECOLOGICAL_PATTERNS;
  }

  getEcologicalPatternId(): string {
    return this.system?.getEcologicalPatternId() ?? "random";
  }

  setEcologicalPattern(patternId: string): void {
    if (this.system) {
      this.system.setEcologicalPattern(patternId);
      this.system.regenerateTrees();
    }
  }

  setRandomEcologicalPattern(): string {
    if (this.system) {
      const patternId = this.system.setRandomEcologicalPattern();
      this.system.regenerateTrees();
      return patternId;
    }
    return "random";
  }

  getRenderedTrees(): RenderedTree[] {
    return this.system?.getRenderedTrees() ?? [];
  }

  removeTree(treeId: string): boolean {
    return this.system?.removeTree(treeId) ?? false;
  }

  removeTreesByImage(imageFilename: string): number {
    return this.system?.removeTreesByImage(imageFilename) ?? 0;
  }

  getTreeCounts(): { total: number; byLayer: number[] } {
    return this.system?.getTreeCounts() ?? { total: 0, byLayer: [] };
  }

  private updateStats(): void {
    if (this.system) {
      const systemStats = this.system.getStats();
      this.currentStats = { ...this.currentStats, ...systemStats };
    }
  }

  private getDefaultLayers(): ForestLayers {
    return {
      gradient: true,
      stars: true,
      moon: true,
      shootingStars: true,
      trees: true,
      grass: true,
      ambientParticles: true,
      campfire: true,
      fireflies: true,
    };
  }
}

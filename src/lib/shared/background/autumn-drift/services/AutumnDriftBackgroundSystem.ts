// AutumnDriftBackgroundSystem.ts
// Main background system for autumn falling leaves animation

import type { IBackgroundSystem } from "../../shared/services/contracts/IBackgroundSystem";
import type {
  Dimensions,
  QualityLevel,
  PerformanceMetrics,
} from "../../shared/domain/types/background-types";
import type { AccessibilitySettings } from "../../shared/domain/models/background-models";
import { createLeafSystem, type LeafSystem } from "./LeafSystem";
import { createWindSystem, type WindSystem } from "./WindSystem";
import {
  AUTUMN_PARTICLE_COUNTS,
  AUTUMN_BACKGROUND,
} from "../domain/constants/autumn-constants";

export interface AutumnDriftLayers {
  gradient: boolean;
  leaves: boolean;
}

export class AutumnDriftBackgroundSystem implements IBackgroundSystem {
  private leafSystem: LeafSystem;
  private windSystem: WindSystem;

  private quality: QualityLevel = "medium";
  private isInitialized = false;
  private reducedMotion = false;
  private thumbnailMode = false;

  private dimensions: Dimensions = { width: 0, height: 0 };
  private frameCount = 0;

  // Layer visibility
  private layers: AutumnDriftLayers = {
    gradient: true,
    leaves: true,
  };

  constructor() {
    this.leafSystem = createLeafSystem();
    this.windSystem = createWindSystem();
  }

  public initialize(dimensions: Dimensions, quality: QualityLevel): void {
    this.dimensions = dimensions;
    this.quality = quality;

    const particleCount = this.getParticleCount();

    this.leafSystem.initialize({
      particleCount,
      canvasWidth: dimensions.width,
      canvasHeight: dimensions.height,
    });

    this.windSystem.initialize();

    this.isInitialized = true;
    this.frameCount = 0;
  }

  public update(dimensions: Dimensions, frameMultiplier: number = 1.0): void {
    if (!this.isInitialized) return;

    // Update dimensions if changed
    if (
      dimensions.width !== this.dimensions.width ||
      dimensions.height !== this.dimensions.height
    ) {
      this.dimensions = dimensions;
      this.leafSystem.resize(dimensions.width, dimensions.height);
    }

    // 95% reduction for users with vestibular disorders (WCAG AAA)
    const effectiveMultiplier = this.reducedMotion
      ? frameMultiplier * 0.05
      : frameMultiplier;

    // Update wind system
    if (!this.reducedMotion) {
      this.windSystem.update(effectiveMultiplier);
    }

    // Get wind force and update leaves
    const windForce = this.reducedMotion ? 0 : this.windSystem.getWindForce();
    this.leafSystem.update(windForce, effectiveMultiplier);

    this.frameCount++;
  }

  public draw(ctx: CanvasRenderingContext2D, dimensions: Dimensions): void {
    if (!this.isInitialized) return;

    // Draw background gradient
    if (this.layers.gradient) {
      this.drawBackground(ctx, dimensions);
    }

    // Draw leaves
    if (this.layers.leaves) {
      this.leafSystem.draw(ctx);
    }
  }

  private drawBackground(
    ctx: CanvasRenderingContext2D,
    dimensions: Dimensions
  ): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, dimensions.height);

    for (const stop of AUTUMN_BACKGROUND.gradient) {
      gradient.addColorStop(stop.stop, stop.color);
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);
  }

  public setQuality(quality: QualityLevel): void {
    if (this.quality === quality) return;

    this.quality = quality;

    if (this.isInitialized) {
      const particleCount = this.getParticleCount();
      this.leafSystem.setParticleCount(particleCount);
    }
  }

  private getParticleCount(): number {
    const baseCount =
      AUTUMN_PARTICLE_COUNTS[this.quality] || AUTUMN_PARTICLE_COUNTS.medium;

    // Thumbnail mode uses fewer particles but they're more visible
    if (this.thumbnailMode) {
      return Math.max(15, Math.floor(baseCount * 0.3));
    }

    return baseCount;
  }

  public cleanup(): void {
    this.isInitialized = false;
    this.frameCount = 0;
  }

  public handleResize(
    oldDimensions: Dimensions,
    newDimensions: Dimensions
  ): void {
    this.dimensions = newDimensions;
    this.leafSystem.resize(newDimensions.width, newDimensions.height);
  }

  public setAccessibility(settings: AccessibilitySettings): void {
    this.reducedMotion = settings.reducedMotion ?? false;
  }

  public setThumbnailMode(enabled: boolean): void {
    this.thumbnailMode = enabled;

    if (this.isInitialized) {
      const particleCount = this.getParticleCount();
      this.leafSystem.setParticleCount(particleCount);
    }
  }

  public getMetrics(): PerformanceMetrics {
    return {
      fps: 0, // Would need timing to calculate
      particleCount: this.leafSystem.leaves.length,
      warnings: [],
    };
  }

  /**
   * Set layer visibility
   */
  public setLayerVisibility(layers: Partial<AutumnDriftLayers>): void {
    this.layers = { ...this.layers, ...layers };
  }

  /**
   * Get current scene statistics
   */
  public getStats(): { leaves: number } {
    return {
      leaves: this.leafSystem.leaves.length,
    };
  }
}

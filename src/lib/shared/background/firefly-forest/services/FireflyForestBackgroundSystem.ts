import type { IBackgroundSystem } from "$lib/shared/background/shared/services/contracts/IBackgroundSystem";
import type {
  Dimensions,
  QualityLevel,
} from "$lib/shared/background/shared/domain/types/background-types";
import type { AccessibilitySettings } from "$lib/shared/background/shared/domain/models/background-models";
import type { Firefly } from "../domain/models/firefly-models";
import {
  FIREFLY_BACKGROUND_GRADIENT,
  STAR_CONFIG,
  SHOOTING_STAR,
} from "../domain/constants/firefly-constants";
import { createFireflySystem } from "./FireflySystem";
import { createTreeSilhouetteSystem } from "./TreeSilhouetteSystem";

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
}

interface ShootingStar {
  x: number;
  y: number;
  angle: number; // Direction of travel (radians)
  progress: number; // 0-1 animation progress
  opacity: number;
}

export interface FireflyForestLayers {
  gradient: boolean;
  stars: boolean;
  shootingStars: boolean;
  trees: boolean;
  fireflies: boolean;
}

export class FireflyForestBackgroundSystem implements IBackgroundSystem {
  private fireflySystem: ReturnType<typeof createFireflySystem>;
  private treeSystem: ReturnType<typeof createTreeSilhouetteSystem>;
  private fireflies: Firefly[] = [];
  private stars: Star[] = [];
  private shootingStar: ShootingStar | null = null;
  private framesSinceLastShootingStar = 0;
  private quality: QualityLevel = "medium";
  private isInitialized = false;
  private reducedMotion = false;
  private dimensions: Dimensions = { width: 0, height: 0 };

  private readonly gradientStops = FIREFLY_BACKGROUND_GRADIENT;

  // Layer visibility for lab mode
  private layerVisibility: FireflyForestLayers = {
    gradient: true,
    stars: true,
    shootingStars: true,
    trees: true,
    fireflies: true,
  };

  constructor() {
    this.fireflySystem = createFireflySystem();
    this.treeSystem = createTreeSilhouetteSystem();
  }

  private generateStars(dimensions: Dimensions, quality: QualityLevel): Star[] {
    const count = STAR_CONFIG.COUNT[quality];
    const stars: Star[] = [];
    const maxY = dimensions.height * STAR_CONFIG.ZONE_BOTTOM;

    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * dimensions.width,
        y: Math.random() * maxY,
        size: STAR_CONFIG.SIZE_MIN + Math.random() * STAR_CONFIG.SIZE_RANGE,
        opacity:
          STAR_CONFIG.OPACITY_MIN + Math.random() * STAR_CONFIG.OPACITY_RANGE,
      });
    }

    return stars;
  }

  public initialize(dimensions: Dimensions, quality: QualityLevel): void {
    this.dimensions = dimensions;
    this.quality = quality;
    this.fireflies = this.fireflySystem.initialize(dimensions, quality);
    this.stars = this.generateStars(dimensions, quality);
    this.treeSystem.initialize(dimensions);
    this.isInitialized = true;
  }

  public update(dimensions: Dimensions, frameMultiplier: number = 1.0): void {
    if (!this.isInitialized) return;

    this.dimensions = dimensions;

    if (!this.reducedMotion) {
      this.fireflies = this.fireflySystem.update(
        this.fireflies,
        dimensions,
        frameMultiplier
      );
      this.updateShootingStar(dimensions, frameMultiplier);
    }
  }

  private updateShootingStar(
    dimensions: Dimensions,
    frameMultiplier: number
  ): void {
    this.framesSinceLastShootingStar += frameMultiplier;

    // Update existing shooting star
    if (this.shootingStar) {
      this.shootingStar.progress +=
        frameMultiplier / SHOOTING_STAR.DURATION_FRAMES;

      // Move the shooting star
      this.shootingStar.x +=
        Math.cos(this.shootingStar.angle) *
        SHOOTING_STAR.SPEED *
        frameMultiplier;
      this.shootingStar.y +=
        Math.sin(this.shootingStar.angle) *
        SHOOTING_STAR.SPEED *
        frameMultiplier;

      // Fade out near the end
      if (this.shootingStar.progress > 0.7) {
        this.shootingStar.opacity =
          1 - (this.shootingStar.progress - 0.7) / 0.3;
      }

      // Remove when animation complete
      if (this.shootingStar.progress >= 1) {
        this.shootingStar = null;
      }
      return;
    }

    // Check if we should spawn a new shooting star
    if (this.framesSinceLastShootingStar < SHOOTING_STAR.MIN_INTERVAL_FRAMES)
      return;

    if (Math.random() < SHOOTING_STAR.CHANCE_PER_FRAME) {
      const zoneTop = dimensions.height * SHOOTING_STAR.ZONE_TOP;
      const zoneBottom = dimensions.height * SHOOTING_STAR.ZONE_BOTTOM;

      // Start from left or right edge, travel diagonally downward
      const startFromLeft = Math.random() > 0.5;
      const startX = startFromLeft ? -20 : dimensions.width + 20;
      const startY = zoneTop + Math.random() * (zoneBottom - zoneTop);

      // Angle: slight downward diagonal (toward center of screen)
      const baseAngle = startFromLeft ? 0.2 : Math.PI - 0.2; // ~11 degrees down
      const angle = baseAngle + (Math.random() - 0.5) * 0.3;

      this.shootingStar = {
        x: startX,
        y: startY,
        angle,
        progress: 0,
        opacity: 1,
      };
      this.framesSinceLastShootingStar = 0;
    }
  }

  public draw(ctx: CanvasRenderingContext2D, dimensions: Dimensions): void {
    if (!this.isInitialized) return;

    // Draw gradient background
    if (this.layerVisibility.gradient) {
      this.drawBackground(ctx, dimensions);
    } else {
      ctx.fillStyle = "#0a1628";
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);
    }

    // Draw stars in the sky
    if (this.layerVisibility.stars) {
      this.drawStars(ctx);
    }

    // Draw shooting star (Easter egg)
    if (this.layerVisibility.shootingStars) {
      this.drawShootingStar(ctx);
    }

    // Draw tree silhouettes (static, cached)
    if (this.layerVisibility.trees) {
      this.treeSystem.draw(ctx, dimensions);
    }

    // Draw fireflies on top
    if (this.layerVisibility.fireflies) {
      this.fireflySystem.draw(this.fireflies, ctx);
    }
  }

  private drawBackground(
    ctx: CanvasRenderingContext2D,
    dimensions: Dimensions
  ): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, dimensions.height);

    for (const stop of this.gradientStops) {
      gradient.addColorStop(stop.position, stop.color);
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);
  }

  private drawStars(ctx: CanvasRenderingContext2D): void {
    for (const star of this.stars) {
      ctx.fillStyle = `rgba(200, 212, 232, ${star.opacity})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawShootingStar(ctx: CanvasRenderingContext2D): void {
    if (!this.shootingStar) return;

    const { x, y, angle, opacity } = this.shootingStar;

    // Calculate trail end point (opposite direction of travel)
    const tailX = x - Math.cos(angle) * SHOOTING_STAR.LENGTH;
    const tailY = y - Math.sin(angle) * SHOOTING_STAR.LENGTH;

    // Draw gradient trail
    const gradient = ctx.createLinearGradient(tailX, tailY, x, y);
    gradient.addColorStop(0, `rgba(255, 255, 255, 0)`);
    gradient.addColorStop(0.6, `rgba(200, 220, 255, ${opacity * 0.3})`);
    gradient.addColorStop(1, `rgba(255, 255, 255, ${opacity})`);

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(x, y);
    ctx.stroke();

    // Draw bright head
    ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
    ctx.beginPath();
    ctx.arc(x, y, SHOOTING_STAR.HEAD_SIZE, 0, Math.PI * 2);
    ctx.fill();

    // Add subtle glow around head
    const glowGradient = ctx.createRadialGradient(
      x,
      y,
      0,
      x,
      y,
      SHOOTING_STAR.HEAD_SIZE * 4
    );
    glowGradient.addColorStop(0, `rgba(200, 220, 255, ${opacity * 0.4})`);
    glowGradient.addColorStop(1, `rgba(200, 220, 255, 0)`);
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(x, y, SHOOTING_STAR.HEAD_SIZE * 4, 0, Math.PI * 2);
    ctx.fill();
  }

  public setQuality(quality: QualityLevel): void {
    if (this.quality === quality) return;

    this.quality = quality;
    if (this.isInitialized) {
      this.fireflies = this.fireflySystem.setQuality(
        this.fireflies,
        this.dimensions,
        quality
      );
      this.stars = this.generateStars(this.dimensions, quality);
    }
  }

  public setAccessibility(settings: AccessibilitySettings): void {
    this.reducedMotion = settings.reducedMotion;
  }

  public handleResize(
    oldDimensions: Dimensions,
    newDimensions: Dimensions
  ): void {
    if (!this.isInitialized) return;

    this.dimensions = newDimensions;
    this.fireflies = this.fireflySystem.adjustToResize(
      this.fireflies,
      oldDimensions,
      newDimensions,
      this.quality
    );
    this.stars = this.generateStars(newDimensions, this.quality);
    this.treeSystem.handleResize(oldDimensions, newDimensions);
  }

  public setLayerVisibility(layers: Partial<FireflyForestLayers>): void {
    this.layerVisibility = { ...this.layerVisibility, ...layers };
  }

  public getLayerVisibility(): FireflyForestLayers {
    return { ...this.layerVisibility };
  }

  public getStats(): { fireflies: number; stars: number; hasShootingStar: boolean } {
    return {
      fireflies: this.fireflies.length,
      stars: this.stars.length,
      hasShootingStar: this.shootingStar !== null,
    };
  }

  public cleanup(): void {
    this.fireflies = [];
    this.stars = [];
    this.shootingStar = null;
    this.framesSinceLastShootingStar = 0;
    this.treeSystem.cleanup();
    this.isInitialized = false;
  }
}

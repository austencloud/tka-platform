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
import { createTreeSilhouetteSystem, type TreeTypeVisibility, type PlacementConfig } from "./TreeSilhouetteSystem";
import { MoonRenderer, createCrescentMoon } from "$lib/shared/background/shared/services/MoonRenderer";

// Re-export for Lab UI
export type { PlacementConfig };

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

interface GrassBlade {
  x: number;
  baseY: number; // Ground level (bottom of blade)
  height: number;
  width: number;
  swayOffset: number; // Phase offset for sway animation
  swaySpeed: number; // How fast it sways
  color: string;
  layer: 0 | 1 | 2; // Depth layer matching tree layers (0=far, 1=mid, 2=near)
}

export interface FireflyForestLayers {
  gradient: boolean;
  stars: boolean;
  moon: boolean;
  shootingStars: boolean;
  trees: boolean;
  grass: boolean;
  fireflies: boolean;
}

export class FireflyForestBackgroundSystem implements IBackgroundSystem {
  private fireflySystem: ReturnType<typeof createFireflySystem>;
  private treeSystem: ReturnType<typeof createTreeSilhouetteSystem>;
  private moonRenderer: MoonRenderer;
  private fireflies: Firefly[] = [];
  private stars: Star[] = [];
  private grassBlades: GrassBlade[] = [];
  private shootingStar: ShootingStar | null = null;
  private framesSinceLastShootingStar = 0;
  private animationTime = 0;
  private quality: QualityLevel = "medium";
  private isInitialized = false;
  private reducedMotion = false;
  private dimensions: Dimensions = { width: 0, height: 0 };

  private readonly gradientStops = FIREFLY_BACKGROUND_GRADIENT;

  // Layer visibility for lab mode
  private layerVisibility: FireflyForestLayers = {
    gradient: true,
    stars: true,
    moon: true,
    shootingStars: true,
    trees: true,
    grass: true,
    fireflies: true,
  };

  constructor() {
    this.fireflySystem = createFireflySystem();
    this.treeSystem = createTreeSilhouetteSystem();
    // Random position - left or right side
    const onRightSide = Math.random() > 0.5;
    const horizontalOffset = 0.15 + Math.random() * 0.15;
    this.moonRenderer = createCrescentMoon({
      x: onRightSide ? (1 - horizontalOffset) : horizontalOffset,
      y: 0.1 + Math.random() * 0.15,
      radiusFraction: 0.04,
      crescentRotation: onRightSide ? -0.3 : 0.3,
      staticPhase: 0.12 + Math.random() * 0.08, // Thin crescent
    });
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

  private generateGrass(dimensions: Dimensions, quality: QualityLevel): GrassBlade[] {
    const blades: GrassBlade[] = [];

    // Grass count based on quality (per layer)
    const countMap: Record<QualityLevel, number> = {
      "ultra-minimal": 5,
      minimal: 10,
      low: 15,
      medium: 25,
      high: 40,
    };
    const countPerLayer = countMap[quality];

    // Ground line is at the bottom of the screen
    const groundY = dimensions.height;

    // Layer configuration:
    // - Far grass is SMALL (appears distant)
    // - Near grass is LARGE (prominent foreground element)
    const layerConfigs: Array<{
      layer: 0 | 1 | 2;
      yOffset: number;
      heightMin: number;
      heightMax: number;
      colors: string[];
    }> = [
      {
        layer: 0, // Far - small, faded
        yOffset: -12,
        heightMin: 8,
        heightMax: 15,
        colors: ["#1a2d2a", "#1c2f2c", "#1b2e2b"], // Blue-tinted dark
      },
      {
        layer: 1, // Mid - medium
        yOffset: -5,
        heightMin: 15,
        heightMax: 30,
        colors: ["#1a3520", "#1c3722", "#1b3621"], // Medium dark greens
      },
      {
        layer: 2, // Near - large, prominent
        yOffset: 0,
        heightMin: 25,
        heightMax: 50,
        colors: ["#1a3d1a", "#1f4220", "#1d401d", "#234823"], // Rich forest greens
      },
    ];

    for (const config of layerConfigs) {
      for (let i = 0; i < countPerLayer; i++) {
        const x = Math.random() * dimensions.width;
        const height = config.heightMin + Math.random() * (config.heightMax - config.heightMin);
        const width = 2 + (height / 50) * 3;

        blades.push({
          x,
          baseY: groundY + config.yOffset,
          height,
          width,
          swayOffset: Math.random() * Math.PI * 2,
          swaySpeed: 0.3 + Math.random() * 0.4,
          color: config.colors[Math.floor(Math.random() * config.colors.length)]!,
          layer: config.layer,
        });
      }
    }

    return blades;
  }

  public initialize(dimensions: Dimensions, quality: QualityLevel): void {
    this.dimensions = dimensions;
    this.quality = quality;
    this.fireflies = this.fireflySystem.initialize(dimensions, quality);
    this.stars = this.generateStars(dimensions, quality);
    this.moonRenderer.initialize(dimensions.width, dimensions.height);
    this.grassBlades = this.generateGrass(dimensions, quality);
    this.treeSystem.initialize(dimensions);
    this.isInitialized = true;
  }

  public update(dimensions: Dimensions, frameMultiplier: number = 1.0): void {
    if (!this.isInitialized) return;

    this.dimensions = dimensions;

    if (!this.reducedMotion) {
      this.animationTime += frameMultiplier * 0.02; // Slow time progression for gentle sway
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

    // Draw crescent moon with soft glow
    if (this.layerVisibility.moon) {
      this.drawMoon(ctx);
    }

    // Draw shooting star (Easter egg)
    if (this.layerVisibility.shootingStars) {
      this.drawShootingStar(ctx);
    }

    // Draw ground fill at the bottom to anchor the scene
    this.drawGround(ctx, dimensions);

    // Draw grass and trees interleaved by depth layer
    // Layer 0 (far) -> Layer 1 (mid) -> Layer 2 (near)
    for (let layer = 0; layer < 3; layer++) {
      // Draw grass for this layer
      if (this.layerVisibility.grass) {
        this.drawGrassLayer(ctx, layer as 0 | 1 | 2);
      }

      // Draw trees for this layer
      if (this.layerVisibility.trees) {
        this.treeSystem.drawLayer(ctx, dimensions, layer);
      }
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

  private drawMoon(ctx: CanvasRenderingContext2D): void {
    this.moonRenderer.draw(ctx);
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

  private drawGround(ctx: CanvasRenderingContext2D, dimensions: Dimensions): void {
    // Simple dark ground strip at the very bottom to anchor the scene
    const groundHeight = dimensions.height * 0.025;
    const groundY = dimensions.height - groundHeight;

    ctx.fillStyle = "rgb(4, 8, 6)";
    ctx.fillRect(0, groundY, dimensions.width, groundHeight);
  }

  private drawGrassLayer(ctx: CanvasRenderingContext2D, layer: 0 | 1 | 2): void {
    const bladesToDraw = this.grassBlades.filter((b) => b.layer === layer);

    for (const blade of bladesToDraw) {
      const { x, baseY, height, width, swayOffset, swaySpeed, color } = blade;

      // Calculate sway based on animation time
      // Uses sine wave with individual phase offset for natural variation
      const sway = Math.sin(this.animationTime * swaySpeed + swayOffset) * (height * 0.15);

      // Secondary sway for more organic movement
      const sway2 = Math.sin(this.animationTime * swaySpeed * 0.7 + swayOffset * 1.3) * (height * 0.05);

      const totalSway = sway + sway2;

      // Draw blade as a curved quadratic bezier
      ctx.beginPath();

      // Base of blade (ground level)
      ctx.moveTo(x - width / 2, baseY);

      // Control point (middle of blade, offset by sway)
      const controlX = x + totalSway * 0.5;
      const controlY = baseY - height * 0.6;

      // Tip of blade (top, full sway effect)
      const tipX = x + totalSway;
      const tipY = baseY - height;

      // Left edge curve
      ctx.quadraticCurveTo(controlX - width / 3, controlY, tipX, tipY);

      // Right edge curve back down
      ctx.quadraticCurveTo(controlX + width / 3, controlY, x + width / 2, baseY);

      ctx.closePath();

      // Fill with subtle gradient for depth
      const gradient = ctx.createLinearGradient(x, baseY, tipX, tipY);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, this.lightenColor(color, 0.15));
      ctx.fillStyle = gradient;
      ctx.fill();
    }
  }

  private lightenColor(hex: string, amount: number): string {
    // Parse hex color and lighten it
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result || !result[1] || !result[2] || !result[3]) return hex;

    const r = Math.min(255, parseInt(result[1], 16) + Math.floor(255 * amount));
    const g = Math.min(255, parseInt(result[2], 16) + Math.floor(255 * amount));
    const b = Math.min(255, parseInt(result[3], 16) + Math.floor(255 * amount));

    return `rgb(${r}, ${g}, ${b})`;
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
      this.grassBlades = this.generateGrass(this.dimensions, quality);
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
    this.moonRenderer.resize(newDimensions.width, newDimensions.height);
    this.grassBlades = this.generateGrass(newDimensions, this.quality);
    this.treeSystem.handleResize(oldDimensions, newDimensions);
  }

  public setLayerVisibility(layers: Partial<FireflyForestLayers>): void {
    this.layerVisibility = { ...this.layerVisibility, ...layers };
  }

  public getLayerVisibility(): FireflyForestLayers {
    return { ...this.layerVisibility };
  }

  public setTreeVisibility(visibility: Partial<TreeTypeVisibility>): void {
    this.treeSystem.setTreeVisibility(visibility);
  }

  public getTreeVisibility(): TreeTypeVisibility {
    return this.treeSystem.getTreeVisibility();
  }

  public regenerateTrees(): void {
    if (this.isInitialized) {
      this.treeSystem.regenerate(this.dimensions);
    }
  }

  // Placement config for tree distribution tuning
  public setPlacementConfig(config: Partial<PlacementConfig>): void {
    this.treeSystem.setPlacementConfig(config);
  }

  public getPlacementConfig(): PlacementConfig {
    return this.treeSystem.getPlacementConfig();
  }

  public resetPlacementConfig(): void {
    this.treeSystem.resetPlacementConfig();
  }

  public getStats(): {
    fireflies: number;
    stars: number;
    hasShootingStar: boolean;
  } {
    return {
      fireflies: this.fireflies.length,
      stars: this.stars.length,
      hasShootingStar: this.shootingStar !== null,
    };
  }

  public cleanup(): void {
    this.fireflies = [];
    this.stars = [];
    this.moonRenderer.cleanup();
    this.grassBlades = [];
    this.shootingStar = null;
    this.framesSinceLastShootingStar = 0;
    this.animationTime = 0;
    this.treeSystem.cleanup();
    this.isInitialized = false;
  }
}

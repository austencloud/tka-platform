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
import { createTreeSilhouetteSystem, type TreeTypeVisibility } from "./TreeSilhouetteSystem";

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

interface CrescentMoon {
  x: number;
  y: number;
  radius: number;
  rotation: number; // Radians, controls crescent orientation
  phase: number; // 0-1, how much of the moon is lit (0.2-0.3 for nice crescent)
}

interface GrassBlade {
  x: number;
  baseY: number; // Ground level (bottom of blade)
  height: number;
  width: number;
  swayOffset: number; // Phase offset for sway animation
  swaySpeed: number; // How fast it sways
  color: string;
  layer: "back" | "front"; // Render order relative to trees
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
  private fireflies: Firefly[] = [];
  private stars: Star[] = [];
  private moon: CrescentMoon | null = null;
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

  private generateMoon(dimensions: Dimensions): CrescentMoon {
    // Position moon in upper portion of sky, slightly off-center
    // Randomize left or right side to add variety
    const onRightSide = Math.random() > 0.5;
    const horizontalOffset = 0.15 + Math.random() * 0.15; // 15-30% from edge

    return {
      x: onRightSide
        ? dimensions.width * (1 - horizontalOffset)
        : dimensions.width * horizontalOffset,
      y: dimensions.height * (0.1 + Math.random() * 0.15), // 10-25% from top
      radius: Math.min(dimensions.width, dimensions.height) * 0.04, // 4% of smaller dimension
      rotation: onRightSide ? -0.3 : 0.3, // Tilt based on side
      phase: 0.22 + Math.random() * 0.08, // Thin crescent (22-30% lit)
    };
  }

  private generateGrass(dimensions: Dimensions, quality: QualityLevel): GrassBlade[] {
    const blades: GrassBlade[] = [];

    // Grass count based on quality
    const countMap: Record<QualityLevel, number> = {
      "ultra-minimal": 15,
      minimal: 20,
      low: 30,
      medium: 60,
      high: 100,
    };
    const count = countMap[quality];

    // Ground line is at the bottom of the screen
    const groundY = dimensions.height;

    // Green color variations for natural look
    const colors = [
      "#1a3d1a", // Dark forest green
      "#234523", // Medium dark green
      "#1f3a1f", // Deep green
      "#2d4a2d", // Muted green
      "#1e331e", // Very dark green
    ];

    for (let i = 0; i < count; i++) {
      // Distribute across width with some clustering
      const x = Math.random() * dimensions.width;

      // Vary height - taller blades are less common
      const heightBase = 20 + Math.random() * 40; // 20-60 pixels base
      const heightMultiplier = quality === "high" ? 1.2 : quality === "medium" ? 1 : 0.8;
      const height = heightBase * heightMultiplier;

      // Width proportional to height
      const width = 2 + (height / 60) * 3;

      // Front or back layer (roughly 30% in front of trees)
      const layer: "back" | "front" = Math.random() > 0.7 ? "front" : "back";

      blades.push({
        x,
        baseY: groundY,
        height,
        width,
        swayOffset: Math.random() * Math.PI * 2, // Random phase
        swaySpeed: 0.3 + Math.random() * 0.4, // 0.3-0.7 speed variation
        color: colors[Math.floor(Math.random() * colors.length)]!,
        layer,
      });
    }

    return blades;
  }

  public initialize(dimensions: Dimensions, quality: QualityLevel): void {
    this.dimensions = dimensions;
    this.quality = quality;
    this.fireflies = this.fireflySystem.initialize(dimensions, quality);
    this.stars = this.generateStars(dimensions, quality);
    this.moon = this.generateMoon(dimensions);
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

    // Draw back layer grass (behind trees)
    if (this.layerVisibility.grass) {
      this.drawGrass(ctx, "back");
    }

    // Draw tree silhouettes (static, cached)
    if (this.layerVisibility.trees) {
      this.treeSystem.draw(ctx, dimensions);
    }

    // Draw front layer grass (in front of trees)
    if (this.layerVisibility.grass) {
      this.drawGrass(ctx, "front");
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
    if (!this.moon) return;

    const { x, y, radius, rotation } = this.moon;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    // Outer glow (largest, most diffuse)
    const outerGlow = ctx.createRadialGradient(0, 0, radius * 0.5, 0, 0, radius * 6);
    outerGlow.addColorStop(0, "rgba(220, 230, 255, 0.08)");
    outerGlow.addColorStop(0.4, "rgba(200, 215, 240, 0.04)");
    outerGlow.addColorStop(1, "rgba(180, 200, 230, 0)");
    ctx.fillStyle = outerGlow;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 6, 0, Math.PI * 2);
    ctx.fill();

    // Inner glow (tighter around moon)
    const innerGlow = ctx.createRadialGradient(0, 0, radius * 0.8, 0, 0, radius * 2.5);
    innerGlow.addColorStop(0, "rgba(235, 240, 255, 0.15)");
    innerGlow.addColorStop(0.5, "rgba(220, 230, 250, 0.08)");
    innerGlow.addColorStop(1, "rgba(200, 215, 240, 0)");
    ctx.fillStyle = innerGlow;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Draw crescent using offscreen canvas with destination-out technique
    const moonSize = Math.ceil(radius * 2.5);
    const offscreen = new OffscreenCanvas(moonSize, moonSize);
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) {
      ctx.restore();
      return;
    }

    const center = moonSize / 2;

    // Draw full moon circle
    offCtx.fillStyle = "rgba(245, 248, 255, 0.95)";
    offCtx.beginPath();
    offCtx.arc(center, center, radius, 0, Math.PI * 2);
    offCtx.fill();

    // Cut out overlapping circle to create crescent
    offCtx.globalCompositeOperation = "destination-out";
    offCtx.beginPath();
    // Offset to the right creates a left-facing crescent
    offCtx.arc(center + radius * 0.7, center, radius * 0.9, 0, Math.PI * 2);
    offCtx.fill();

    // Draw the offscreen canvas onto main canvas
    ctx.drawImage(offscreen, -moonSize / 2, -moonSize / 2);

    ctx.restore();
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

  private drawGrass(ctx: CanvasRenderingContext2D, layer: "back" | "front"): void {
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
    this.moon = this.generateMoon(newDimensions);
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
    this.moon = null;
    this.grassBlades = [];
    this.shootingStar = null;
    this.framesSinceLastShootingStar = 0;
    this.animationTime = 0;
    this.treeSystem.cleanup();
    this.isInitialized = false;
  }
}

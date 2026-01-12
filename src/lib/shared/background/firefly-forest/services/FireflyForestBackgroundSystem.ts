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
import {
  createTreeSilhouetteSystem,
  type TreeTypeVisibility,
  type PlacementConfig,
  type EcologicalPattern,
  type RenderedTree,
  NUM_LAYERS,
} from "./TreeSilhouetteSystem";
import { createAmbientParticleSystem } from "./AmbientParticleSystem";
import { createCampfireSystem } from "./CampfireSystem";
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
  ambientParticles: boolean;
  campfire: boolean;
  fireflies: boolean;
}

export class FireflyForestBackgroundSystem implements IBackgroundSystem {
  private fireflySystem: ReturnType<typeof createFireflySystem>;
  private treeSystem: ReturnType<typeof createTreeSilhouetteSystem>;
  private ambientParticleSystem: ReturnType<typeof createAmbientParticleSystem>;
  private campfireSystem: ReturnType<typeof createCampfireSystem>;
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

  // Mouse parallax state - normalized position from center (-1 to 1)
  // Disabled by default - can be enabled via setParallaxEnabled()
  private mouseX = 0;
  private mouseY = 0;
  private targetMouseX = 0;
  private targetMouseY = 0;
  private parallaxEnabled = false;

  // Parallax intensity per layer type (subtle effect)
  private readonly PARALLAX_CONFIG = {
    stars: 0.008,      // Very subtle - stars are far away
    moon: 0.012,       // Slightly more than stars
    farTrees: 0.015,   // Far trees move slightly
    midTrees: 0.025,   // Mid trees move more
    nearTrees: 0.04,   // Near trees move most
    farGrass: 0.02,    // Far grass
    midGrass: 0.03,    // Mid grass
    nearGrass: 0.045,  // Near grass moves most
    // Firefly parallax by depth layer (far = less, near = more)
    fireflyLayers: [0.01, 0.015, 0.025, 0.035],
  };

  // Map firefly depth layers to tree layers for interleaving
  // Fireflies have 4 layers, trees have 7 layers
  // Format: [fireflyLayer, drawAfterTreeLayer]
  // -1 means draw before any trees, 7 means draw after all trees
  private readonly FIREFLY_TREE_INTERLEAVE = [
    { fireflyLayer: 0, drawAfterTreeLayer: 1 },  // Far fireflies after tree layer 1
    { fireflyLayer: 1, drawAfterTreeLayer: 3 },  // Mid-far fireflies after tree layer 3
    { fireflyLayer: 2, drawAfterTreeLayer: 5 },  // Mid-near fireflies after tree layer 5
    { fireflyLayer: 3, drawAfterTreeLayer: 7 },  // Near fireflies after all trees (last)
  ];

  private readonly gradientStops = FIREFLY_BACKGROUND_GRADIENT;

  // Layer visibility for lab mode
  private layerVisibility: FireflyForestLayers = {
    gradient: true,
    stars: true,
    moon: true,
    shootingStars: true,
    trees: true,
    grass: true,
    ambientParticles: true,
    campfire: false, // Off by default - optional cozy element
    fireflies: true,
  };

  constructor() {
    this.fireflySystem = createFireflySystem();
    this.treeSystem = createTreeSilhouetteSystem();
    this.ambientParticleSystem = createAmbientParticleSystem();
    this.campfireSystem = createCampfireSystem();
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

  /**
   * Get the ground/base Y position for a grass layer
   * Matches the tree layer ground positions (below the horizon)
   */
  private getGrassLayerBaseY(layer: 0 | 1 | 2, height: number): number {
    // Map grass layers (0, 1, 2) to tree layer positions (0, 3, 6)
    // Far grass (0) at ~82% (below horizon), near grass (2) at bottom (~100%)
    const farBaseRatio = 0.82;   // Match tree far base
    const nearBaseRatio = 1.0;

    const t = layer / 2; // 0, 0.5, 1
    // Ease-out curve matching tree system
    const easedT = 1 - Math.pow(1 - t, 1.5);
    const baseRatio = farBaseRatio + (nearBaseRatio - farBaseRatio) * easedT;

    return height * baseRatio;
  }

  private generateGrass(dimensions: Dimensions, quality: QualityLevel): GrassBlade[] {
    const blades: GrassBlade[] = [];

    // Grass count based on quality - tripled for dense meadow coverage
    const countMap: Record<QualityLevel, number> = {
      "ultra-minimal": 40,
      minimal: 80,
      low: 140,
      medium: 220,
      high: 350,
    };
    const countPerLayer = countMap[quality];

    // Layer configuration:
    // - Far layers need MORE grass to compensate for smaller visual size
    // - Near grass is larger but fewer in count for balanced visual distribution
    const layerConfigs: Array<{
      layer: 0 | 1 | 2;
      heightMin: number;
      heightMax: number;
      verticalSpread: number; // How much grass can vary vertically within the layer
      densityMultiplier: number; // Extra density for this layer
      colors: string[];
    }> = [
      {
        layer: 0, // Far - many tiny grass blades at horizon
        heightMin: 2,
        heightMax: 5,
        verticalSpread: 0.06, // Spread in far ground area
        densityMultiplier: 1.8, // Many more to fill the distance
        colors: ["#1a2d2a", "#1c2f2c", "#1b2e2b", "#182b28", "#1d302d"], // Blue-tinted (atmospheric)
      },
      {
        layer: 1, // Mid - medium grass fills the mid-ground
        heightMin: 6,
        heightMax: 14,
        verticalSpread: 0.08, // Spread in mid-ground
        densityMultiplier: 1.3, // More than near, less than far
        colors: ["#1a3520", "#1c3722", "#1b3621", "#193420", "#1e3923"], // Medium greens
      },
      {
        layer: 2, // Near - fewer but larger foreground grass
        heightMin: 12,
        heightMax: 24,
        verticalSpread: 0.05, // Concentrated near bottom
        densityMultiplier: 0.6, // Fewer blades - they're bigger
        colors: ["#1a3d1a", "#1f4220", "#1d401d", "#234823", "#1e4220"], // Rich forest greens
      },
    ];

    for (const config of layerConfigs) {
      // Get the base Y for this layer (matching tree horizon positions)
      const layerBaseY = this.getGrassLayerBaseY(config.layer, dimensions.height);

      // Apply density multiplier for this layer
      const layerCount = Math.floor(countPerLayer * config.densityMultiplier);

      for (let i = 0; i < layerCount; i++) {
        // Spread horizontally across full width
        const x = Math.random() * dimensions.width;

        // Vertical position: at the layer's ground line with spread BELOW the base
        // Grass must stay BELOW the visible ground line (no floating grass in sky)
        const groundStartY = dimensions.height * 0.80; // Just below sky/ground transition
        const yVariation = Math.random() * dimensions.height * config.verticalSpread;
        const baseY = Math.max(groundStartY, Math.min(dimensions.height, layerBaseY + yVariation));

        // Size: far grass is tiny, near grass is large
        const height = config.heightMin + Math.random() * (config.heightMax - config.heightMin);
        const width = 1.5 + (height / 45) * 2.5;

        blades.push({
          x,
          baseY,
          height,
          width,
          swayOffset: Math.random() * Math.PI * 2,
          swaySpeed: 0.25 + Math.random() * 0.35,
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
    this.ambientParticleSystem.initialize(dimensions, quality);
    this.campfireSystem.initialize(dimensions, quality);
    this.isInitialized = true;
  }

  public update(dimensions: Dimensions, frameMultiplier: number = 1.0): void {
    if (!this.isInitialized) return;

    this.dimensions = dimensions;

    if (!this.reducedMotion) {
      this.animationTime += frameMultiplier * 0.02; // Slow time progression for gentle sway

      // Smooth mouse position interpolation (eased parallax response)
      const smoothing = 0.08 * frameMultiplier;
      this.mouseX += (this.targetMouseX - this.mouseX) * smoothing;
      this.mouseY += (this.targetMouseY - this.mouseY) * smoothing;

      this.fireflies = this.fireflySystem.update(
        this.fireflies,
        dimensions,
        frameMultiplier
      );
      this.ambientParticleSystem.update(dimensions, frameMultiplier);
      this.campfireSystem.update(dimensions, frameMultiplier);
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

    // Draw campfire ambient glow (affects the whole scene with warm light)
    if (this.layerVisibility.campfire) {
      this.campfireSystem.drawAmbientGlow(ctx, dimensions);
    }

    // Draw trees, grass, and fireflies interleaved by depth
    // Trees have 7 layers (0-6), grass has 3 layers (0-2), fireflies have 4 layers (0-3)
    // Grass layers are drawn at tree layer positions: 0, 3, 6
    const grassAtTreeLayer = [0, 3, 6]; // Which tree layers get grass drawn before them

    for (let treeLayer = 0; treeLayer < NUM_LAYERS; treeLayer++) {
      // Get parallax offset for this tree layer
      const treeParallax = this.getParallaxOffset(this.getTreeLayerParallax(treeLayer));

      // Draw grass and ambient particles before certain tree layers
      const grassIndex = grassAtTreeLayer.indexOf(treeLayer);
      if (grassIndex !== -1) {
        const particleLayer = grassIndex as 0 | 1 | 2;
        const particleParallax = this.getParallaxOffset(this.getGrassLayerParallax(particleLayer));

        // Draw ambient particles for this depth layer (behind grass and trees)
        if (this.layerVisibility.ambientParticles) {
          this.ambientParticleSystem.drawLayer(ctx, particleLayer, particleParallax);
        }

        // Draw grass
        if (this.layerVisibility.grass) {
          this.drawGrassLayer(ctx, particleLayer);
        }
      }

      // Draw trees for this layer with parallax
      if (this.layerVisibility.trees) {
        ctx.save();
        ctx.translate(treeParallax.x, treeParallax.y);
        this.treeSystem.drawLayer(ctx, dimensions, treeLayer);
        ctx.restore();
      }

      // Draw campfire at far layer (layer 1) - distant Easter egg at the horizon
      if (treeLayer === 1 && this.layerVisibility.campfire) {
        const campfireParallax = this.getParallaxOffset(this.PARALLAX_CONFIG.farTrees);
        this.campfireSystem.draw(ctx, dimensions, campfireParallax);
      }

      // Draw firefly layers that should appear after this tree layer
      if (this.layerVisibility.fireflies) {
        for (const mapping of this.FIREFLY_TREE_INTERLEAVE) {
          if (mapping.drawAfterTreeLayer === treeLayer) {
            const fireflyParallax = this.getParallaxOffset(
              this.PARALLAX_CONFIG.fireflyLayers[mapping.fireflyLayer] ?? 0.02
            );
            ctx.save();
            ctx.translate(fireflyParallax.x, fireflyParallax.y);
            this.fireflySystem.drawLayer(this.fireflies, ctx, mapping.fireflyLayer);
            ctx.restore();
          }
        }
      }
    }

    // Draw any firefly layers that come after all tree layers (layer 7+)
    if (this.layerVisibility.fireflies) {
      for (const mapping of this.FIREFLY_TREE_INTERLEAVE) {
        if (mapping.drawAfterTreeLayer >= NUM_LAYERS) {
          const fireflyParallax = this.getParallaxOffset(
            this.PARALLAX_CONFIG.fireflyLayers[mapping.fireflyLayer] ?? 0.02
          );
          ctx.save();
          ctx.translate(fireflyParallax.x, fireflyParallax.y);
          this.fireflySystem.drawLayer(this.fireflies, ctx, mapping.fireflyLayer);
          ctx.restore();
        }
      }
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
    const parallax = this.getParallaxOffset(this.PARALLAX_CONFIG.stars);

    for (const star of this.stars) {
      ctx.fillStyle = `rgba(200, 212, 232, ${star.opacity})`;
      ctx.beginPath();
      ctx.arc(star.x + parallax.x, star.y + parallax.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawMoon(ctx: CanvasRenderingContext2D): void {
    const parallax = this.getParallaxOffset(this.PARALLAX_CONFIG.moon);
    ctx.save();
    ctx.translate(parallax.x, parallax.y);
    this.moonRenderer.draw(ctx);
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

  private drawGround(ctx: CanvasRenderingContext2D, dimensions: Dimensions): void {
    // Ground extends from just below the sky transition down to the bottom
    // Creates the visible meadow floor - lighter to contrast with dark tree silhouettes
    const groundStartY = dimensions.height * 0.80; // Ground starts below sky gradient transition
    const groundHeight = dimensions.height - groundStartY;

    // Gradient from ground start (lighter, atmospheric) to bottom (darker but still visible)
    // Significantly lighter than trees so silhouettes stand out
    const gradient = ctx.createLinearGradient(0, groundStartY, 0, dimensions.height);
    gradient.addColorStop(0, "rgb(18, 32, 24)");   // Lighter at horizon (forest green)
    gradient.addColorStop(0.3, "rgb(14, 26, 18)"); // Mid-upper ground
    gradient.addColorStop(0.6, "rgb(10, 20, 14)"); // Mid-lower ground
    gradient.addColorStop(1, "rgb(6, 14, 10)");    // Darker at bottom but still visible

    ctx.fillStyle = gradient;
    ctx.fillRect(0, groundStartY, dimensions.width, groundHeight);
  }

  private drawGrassLayer(ctx: CanvasRenderingContext2D, layer: 0 | 1 | 2): void {
    const bladesToDraw = this.grassBlades.filter((b) => b.layer === layer);
    const parallax = this.getParallaxOffset(this.getGrassLayerParallax(layer));

    for (const blade of bladesToDraw) {
      const { x: bladeX, baseY: bladeBaseY, height, width, swayOffset, swaySpeed, color } = blade;

      // Apply parallax offset
      const x = bladeX + parallax.x;
      const baseY = bladeBaseY + parallax.y;

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
      this.ambientParticleSystem.setQuality(quality, this.dimensions);
      this.campfireSystem.setQuality(quality, this.dimensions);
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

  // ===================
  // ECOLOGICAL PATTERNS
  // ===================

  /**
   * Set the ecological pattern for tree distribution
   * @param patternId Pattern ID (e.g., "random", "conifer-ridge", "riparian")
   */
  public setEcologicalPattern(patternId: string): void {
    this.treeSystem.setEcologicalPattern(patternId);
  }

  /**
   * Get the current ecological pattern ID
   */
  public getEcologicalPatternId(): string {
    return this.treeSystem.getEcologicalPatternId();
  }

  /**
   * Get the current ecological pattern details
   */
  public getEcologicalPattern(): EcologicalPattern {
    return this.treeSystem.getEcologicalPattern();
  }

  /**
   * Get all available ecological patterns
   */
  public getAvailablePatterns(): EcologicalPattern[] {
    return this.treeSystem.getAvailablePatterns();
  }

  /**
   * Set a random ecological pattern (excluding "random" uniform distribution)
   * Returns the selected pattern ID
   */
  public setRandomEcologicalPattern(): string {
    return this.treeSystem.setRandomEcologicalPattern();
  }

  // ===================
  // MOUSE PARALLAX
  // ===================

  /**
   * Update mouse position for parallax effect
   * @param clientX - Mouse X position in viewport
   * @param clientY - Mouse Y position in viewport
   * @param viewportWidth - Viewport width
   * @param viewportHeight - Viewport height
   */
  public updateMousePosition(
    clientX: number,
    clientY: number,
    viewportWidth: number,
    viewportHeight: number
  ): void {
    if (!this.parallaxEnabled || this.reducedMotion) return;

    // Normalize to -1 to 1 range from center
    this.targetMouseX = (clientX / viewportWidth - 0.5) * 2;
    this.targetMouseY = (clientY / viewportHeight - 0.5) * 2;
  }

  /**
   * Enable or disable parallax effect
   */
  public setParallaxEnabled(enabled: boolean): void {
    this.parallaxEnabled = enabled;
    if (!enabled) {
      this.mouseX = 0;
      this.mouseY = 0;
      this.targetMouseX = 0;
      this.targetMouseY = 0;
    }
  }

  /**
   * Calculate parallax offset for a given depth layer
   * Returns pixel offset to apply when drawing
   */
  private getParallaxOffset(intensity: number): { x: number; y: number } {
    return {
      x: this.mouseX * this.dimensions.width * intensity,
      y: this.mouseY * this.dimensions.height * intensity * 0.5, // Less vertical movement
    };
  }

  /**
   * Get parallax intensity for a tree layer (0-6)
   */
  private getTreeLayerParallax(layer: number): number {
    const t = layer / (NUM_LAYERS - 1);
    // Interpolate from far to near intensity
    return this.PARALLAX_CONFIG.farTrees +
      (this.PARALLAX_CONFIG.nearTrees - this.PARALLAX_CONFIG.farTrees) * t;
  }

  /**
   * Get parallax intensity for a grass layer (0-2)
   */
  private getGrassLayerParallax(layer: 0 | 1 | 2): number {
    const intensities: [number, number, number] = [
      this.PARALLAX_CONFIG.farGrass,
      this.PARALLAX_CONFIG.midGrass,
      this.PARALLAX_CONFIG.nearGrass,
    ];
    return intensities[layer];
  }

  public getStats(): {
    fireflies: number;
    stars: number;
    ambientParticles: number;
    hasShootingStar: boolean;
  } {
    return {
      fireflies: this.fireflies.length,
      stars: this.stars.length,
      ambientParticles: this.ambientParticleSystem.getCount(),
      hasShootingStar: this.shootingStar !== null,
    };
  }

  // ===================
  // TREE MANAGEMENT
  // ===================

  /**
   * Get all currently rendered trees
   */
  public getRenderedTrees(): RenderedTree[] {
    return this.treeSystem.getRenderedTrees();
  }

  /**
   * Remove a tree by its ID and re-render
   */
  public removeTree(treeId: string): boolean {
    return this.treeSystem.removeTree(treeId);
  }

  /**
   * Remove all trees using a specific image filename
   */
  public removeTreesByImage(imageFilename: string): number {
    return this.treeSystem.removeTreesByImage(imageFilename);
  }

  /**
   * Get tree counts by layer
   */
  public getTreeCounts(): { total: number; byLayer: number[] } {
    return this.treeSystem.getTreeCounts();
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
    this.ambientParticleSystem.cleanup();
    this.campfireSystem.cleanup();
    this.isInitialized = false;
  }
}

/**
 * CampfireSystem - Cozy campfire with flickering flames and ambient glow
 *
 * Creates a warm campfire that:
 * - Sits at the bottom center of the scene
 * - Has flickering flames with multiple layers
 * - Emits rising sparks
 * - Casts warm ambient glow onto the surrounding scene
 * - Adds a subtle smoke column rising
 */

import type {
  Dimensions,
  QualityLevel,
} from "$lib/shared/background/shared/domain/types/background-types";

interface Flame {
  x: number;
  baseY: number;
  width: number;
  height: number;
  phase: number;
  speed: number;
  color: FlameColor;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: { r: number; g: number; b: number };
}

interface SmokeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  life: number;
}

type FlameColor = "core" | "inner" | "outer" | "tip";

// Configuration - Distant, subtle campfire (Easter egg in the distance)
const CAMPFIRE_CONFIG = {
  // Position (relative to viewport) - off to the side, at the horizon
  POSITION_X: 0.18, // Left side, not center
  POSITION_Y: 0.82, // At the horizon line (far distance)

  // Fire pit (logs/stones) - tiny at this distance
  PIT_WIDTH: 0.012, // Very small - it's far away
  PIT_HEIGHT: 0.003,

  // Flames - tiny distant flames
  FLAME_COUNT: { high: 3, medium: 2, low: 2, minimal: 1, "ultra-minimal": 1 } as Record<QualityLevel, number>,
  FLAME_WIDTH_MIN: 0.004,
  FLAME_WIDTH_MAX: 0.008,
  FLAME_HEIGHT_MIN: 0.012,
  FLAME_HEIGHT_MAX: 0.022,
  FLAME_FLICKER_SPEED: 0.06,

  // Sparks - rare and tiny
  SPARK_CHANCE: 0.008, // Much rarer
  SPARK_COUNT_MAX: 4,
  SPARK_SPEED_Y: -0.4,
  SPARK_SPEED_X_RANGE: 0.15,
  SPARK_SIZE_MIN: 0.5,
  SPARK_SIZE_MAX: 1.2,
  SPARK_LIFE: 50, // Shorter life

  // Smoke - very subtle wisp
  SMOKE_CHANCE: 0.005,
  SMOKE_COUNT_MAX: 3,
  SMOKE_SPEED_Y: -0.15,
  SMOKE_SIZE_START: 2,
  SMOKE_SIZE_END: 8,
  SMOKE_LIFE: 120,

  // Glow - subtle warm dot in the distance
  GLOW_RADIUS_MULTIPLIER: 4, // Smaller glow
  GLOW_INTENSITY: 0.08, // Very subtle
  GLOW_FLICKER_RANGE: 0.03,
} as const;

// Flame colors from core (white-yellow) to tip (red-orange)
const FLAME_COLORS = {
  core: { r: 255, g: 250, b: 220 },    // White-yellow
  inner: { r: 255, g: 200, b: 80 },    // Bright orange
  outer: { r: 255, g: 120, b: 40 },    // Deep orange
  tip: { r: 200, g: 60, b: 30 },       // Red-orange
} as const;

export interface CampfireAPI {
  initialize: (dimensions: Dimensions, quality: QualityLevel) => void;
  update: (dimensions: Dimensions, frameMultiplier: number) => void;
  draw: (ctx: CanvasRenderingContext2D, dimensions: Dimensions, parallaxOffset: { x: number; y: number }) => void;
  drawAmbientGlow: (ctx: CanvasRenderingContext2D, dimensions: Dimensions) => void;
  setQuality: (quality: QualityLevel, dimensions: Dimensions) => void;
  cleanup: () => void;
}

export function createCampfireSystem(): CampfireAPI {
  let flames: Flame[] = [];
  let sparks: Spark[] = [];
  let smokeParticles: SmokeParticle[] = [];
  let currentQuality: QualityLevel = "medium";
  let flickerPhase = 0;

  function createFlame(dimensions: Dimensions, index: number, total: number): Flame {
    const fireX = dimensions.width * CAMPFIRE_CONFIG.POSITION_X;
    const fireY = dimensions.height * CAMPFIRE_CONFIG.POSITION_Y;

    // Spread flames across the pit width
    const spread = dimensions.width * CAMPFIRE_CONFIG.PIT_WIDTH * 0.7;
    const offsetX = total > 1 ? (index / (total - 1) - 0.5) * spread : 0;

    const width = dimensions.width * (CAMPFIRE_CONFIG.FLAME_WIDTH_MIN +
      Math.random() * (CAMPFIRE_CONFIG.FLAME_WIDTH_MAX - CAMPFIRE_CONFIG.FLAME_WIDTH_MIN));
    const height = dimensions.height * (CAMPFIRE_CONFIG.FLAME_HEIGHT_MIN +
      Math.random() * (CAMPFIRE_CONFIG.FLAME_HEIGHT_MAX - CAMPFIRE_CONFIG.FLAME_HEIGHT_MIN));

    // Assign color based on position (center flames brighter)
    const centerDistance = Math.abs(index - (total - 1) / 2) / Math.max(1, (total - 1) / 2);
    let color: FlameColor;
    if (centerDistance < 0.3) color = "core";
    else if (centerDistance < 0.5) color = "inner";
    else if (centerDistance < 0.8) color = "outer";
    else color = "tip";

    return {
      x: fireX + offsetX,
      baseY: fireY,
      width,
      height,
      phase: Math.random() * Math.PI * 2,
      speed: CAMPFIRE_CONFIG.FLAME_FLICKER_SPEED * (0.8 + Math.random() * 0.4),
      color,
    };
  }

  function createSpark(dimensions: Dimensions): Spark {
    const fireX = dimensions.width * CAMPFIRE_CONFIG.POSITION_X;
    const fireY = dimensions.height * CAMPFIRE_CONFIG.POSITION_Y;
    const pitWidth = dimensions.width * CAMPFIRE_CONFIG.PIT_WIDTH * 0.5;

    return {
      x: fireX + (Math.random() - 0.5) * pitWidth,
      y: fireY - dimensions.height * CAMPFIRE_CONFIG.FLAME_HEIGHT_MIN * 0.5,
      vx: (Math.random() - 0.5) * CAMPFIRE_CONFIG.SPARK_SPEED_X_RANGE,
      vy: CAMPFIRE_CONFIG.SPARK_SPEED_Y * (0.8 + Math.random() * 0.4),
      size: CAMPFIRE_CONFIG.SPARK_SIZE_MIN + Math.random() * (CAMPFIRE_CONFIG.SPARK_SIZE_MAX - CAMPFIRE_CONFIG.SPARK_SIZE_MIN),
      life: CAMPFIRE_CONFIG.SPARK_LIFE * (0.6 + Math.random() * 0.4),
      maxLife: CAMPFIRE_CONFIG.SPARK_LIFE,
      color: Math.random() > 0.3 ? FLAME_COLORS.inner : FLAME_COLORS.core,
    };
  }

  function createSmoke(dimensions: Dimensions): SmokeParticle {
    const fireX = dimensions.width * CAMPFIRE_CONFIG.POSITION_X;
    const fireY = dimensions.height * CAMPFIRE_CONFIG.POSITION_Y - dimensions.height * CAMPFIRE_CONFIG.FLAME_HEIGHT_MAX;

    return {
      x: fireX + (Math.random() - 0.5) * 10,
      y: fireY,
      vx: (Math.random() - 0.5) * 0.3,
      vy: CAMPFIRE_CONFIG.SMOKE_SPEED_Y,
      size: CAMPFIRE_CONFIG.SMOKE_SIZE_START,
      opacity: 0.15 + Math.random() * 0.1,
      life: CAMPFIRE_CONFIG.SMOKE_LIFE * (0.8 + Math.random() * 0.4),
    };
  }

  function initialize(dimensions: Dimensions, quality: QualityLevel): void {
    currentQuality = quality;
    const flameCount = CAMPFIRE_CONFIG.FLAME_COUNT[quality];

    flames = [];
    for (let i = 0; i < flameCount; i++) {
      flames.push(createFlame(dimensions, i, flameCount));
    }

    sparks = [];
    smokeParticles = [];
    flickerPhase = 0;
  }

  function update(dimensions: Dimensions, frameMultiplier: number): void {
    // Update flicker phase for ambient glow
    flickerPhase += 0.05 * frameMultiplier;

    // Update flames
    for (const flame of flames) {
      flame.phase += flame.speed * frameMultiplier;
    }

    // Spawn new sparks
    if (sparks.length < CAMPFIRE_CONFIG.SPARK_COUNT_MAX &&
        Math.random() < CAMPFIRE_CONFIG.SPARK_CHANCE * frameMultiplier) {
      sparks.push(createSpark(dimensions));
    }

    // Update sparks
    sparks = sparks.filter(spark => {
      spark.x += spark.vx * frameMultiplier;
      spark.y += spark.vy * frameMultiplier;
      spark.vy += 0.02 * frameMultiplier; // Slight upward deceleration
      spark.life -= frameMultiplier;
      return spark.life > 0;
    });

    // Spawn smoke
    if (currentQuality !== "ultra-minimal" && currentQuality !== "minimal") {
      if (smokeParticles.length < CAMPFIRE_CONFIG.SMOKE_COUNT_MAX &&
          Math.random() < CAMPFIRE_CONFIG.SMOKE_CHANCE * frameMultiplier) {
        smokeParticles.push(createSmoke(dimensions));
      }
    }

    // Update smoke
    smokeParticles = smokeParticles.filter(smoke => {
      smoke.x += smoke.vx * frameMultiplier;
      smoke.y += smoke.vy * frameMultiplier;
      smoke.vx += (Math.random() - 0.5) * 0.01 * frameMultiplier; // Drift
      smoke.size += 0.1 * frameMultiplier; // Expand
      smoke.opacity -= 0.001 * frameMultiplier; // Fade
      smoke.life -= frameMultiplier;
      return smoke.life > 0 && smoke.opacity > 0.01;
    });
  }

  function draw(
    ctx: CanvasRenderingContext2D,
    dimensions: Dimensions,
    parallaxOffset: { x: number; y: number }
  ): void {
    const fireX = dimensions.width * CAMPFIRE_CONFIG.POSITION_X + parallaxOffset.x;
    const fireY = dimensions.height * CAMPFIRE_CONFIG.POSITION_Y + parallaxOffset.y;
    const pitWidth = dimensions.width * CAMPFIRE_CONFIG.PIT_WIDTH;
    const pitHeight = dimensions.height * CAMPFIRE_CONFIG.PIT_HEIGHT;

    // Draw fire pit (logs/stones) - dark silhouette
    ctx.fillStyle = "rgb(20, 15, 10)";
    ctx.beginPath();
    ctx.ellipse(fireX, fireY, pitWidth / 2, pitHeight / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw small log silhouettes
    ctx.fillStyle = "rgb(30, 20, 15)";
    ctx.beginPath();
    ctx.ellipse(fireX - pitWidth * 0.2, fireY - pitHeight * 0.3, pitWidth * 0.15, pitHeight * 0.4, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(fireX + pitWidth * 0.15, fireY - pitHeight * 0.2, pitWidth * 0.18, pitHeight * 0.35, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Draw smoke behind flames
    for (const smoke of smokeParticles) {
      const gradient = ctx.createRadialGradient(
        smoke.x + parallaxOffset.x, smoke.y + parallaxOffset.y, 0,
        smoke.x + parallaxOffset.x, smoke.y + parallaxOffset.y, smoke.size
      );
      gradient.addColorStop(0, `rgba(80, 80, 90, ${smoke.opacity * 0.7})`);
      gradient.addColorStop(0.5, `rgba(60, 60, 70, ${smoke.opacity * 0.4})`);
      gradient.addColorStop(1, `rgba(50, 50, 60, 0)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(smoke.x + parallaxOffset.x, smoke.y + parallaxOffset.y, smoke.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw flames (from outer to inner for proper layering)
    const sortedFlames = [...flames].sort((a, b) => {
      const order: Record<FlameColor, number> = { tip: 0, outer: 1, inner: 2, core: 3 };
      return order[a.color] - order[b.color];
    });

    for (const flame of sortedFlames) {
      const flicker = Math.sin(flame.phase) * 0.2 + Math.sin(flame.phase * 1.7) * 0.1;
      const currentHeight = flame.height * (0.8 + flicker * 0.4);
      const currentWidth = flame.width * (0.9 + flicker * 0.2);

      const flameX = flame.x + parallaxOffset.x;
      const flameY = flame.baseY + parallaxOffset.y;

      const baseColor = FLAME_COLORS[flame.color];

      // Flame gradient
      const gradient = ctx.createRadialGradient(
        flameX, flameY - currentHeight * 0.3, 0,
        flameX, flameY - currentHeight * 0.4, currentHeight * 0.8
      );
      gradient.addColorStop(0, `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, 0.95)`);
      gradient.addColorStop(0.4, `rgba(${baseColor.r}, ${baseColor.g * 0.7}, ${baseColor.b * 0.5}, 0.7)`);
      gradient.addColorStop(0.7, `rgba(${baseColor.r * 0.8}, ${baseColor.g * 0.4}, 0, 0.4)`);
      gradient.addColorStop(1, `rgba(${baseColor.r * 0.5}, 0, 0, 0)`);

      // Draw flame shape (teardrop-ish)
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(flameX - currentWidth / 2, flameY);

      // Left curve
      ctx.quadraticCurveTo(
        flameX - currentWidth * 0.6,
        flameY - currentHeight * 0.4,
        flameX + (Math.sin(flame.phase * 2) * currentWidth * 0.1),
        flameY - currentHeight
      );

      // Right curve back down
      ctx.quadraticCurveTo(
        flameX + currentWidth * 0.6,
        flameY - currentHeight * 0.4,
        flameX + currentWidth / 2,
        flameY
      );

      ctx.closePath();
      ctx.fill();
    }

    // Draw sparks on top
    for (const spark of sparks) {
      const lifeRatio = spark.life / spark.maxLife;
      const opacity = lifeRatio * 0.9;

      ctx.fillStyle = `rgba(${spark.color.r}, ${spark.color.g}, ${spark.color.b}, ${opacity})`;
      ctx.beginPath();
      ctx.arc(spark.x + parallaxOffset.x, spark.y + parallaxOffset.y, spark.size * lifeRatio, 0, Math.PI * 2);
      ctx.fill();

      // Spark glow
      const glowGradient = ctx.createRadialGradient(
        spark.x + parallaxOffset.x, spark.y + parallaxOffset.y, 0,
        spark.x + parallaxOffset.x, spark.y + parallaxOffset.y, spark.size * 3
      );
      glowGradient.addColorStop(0, `rgba(${spark.color.r}, ${spark.color.g}, ${spark.color.b}, ${opacity * 0.5})`);
      glowGradient.addColorStop(1, `rgba(${spark.color.r}, ${spark.color.g}, 0, 0)`);
      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(spark.x + parallaxOffset.x, spark.y + parallaxOffset.y, spark.size * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawAmbientGlow(ctx: CanvasRenderingContext2D, dimensions: Dimensions): void {
    const fireX = dimensions.width * CAMPFIRE_CONFIG.POSITION_X;
    const fireY = dimensions.height * CAMPFIRE_CONFIG.POSITION_Y;
    const fireHeight = dimensions.height * CAMPFIRE_CONFIG.FLAME_HEIGHT_MAX;
    const glowRadius = fireHeight * CAMPFIRE_CONFIG.GLOW_RADIUS_MULTIPLIER;

    // Flickering intensity
    const flicker = Math.sin(flickerPhase) * CAMPFIRE_CONFIG.GLOW_FLICKER_RANGE +
                   Math.sin(flickerPhase * 2.3) * CAMPFIRE_CONFIG.GLOW_FLICKER_RANGE * 0.5;
    const intensity = CAMPFIRE_CONFIG.GLOW_INTENSITY + flicker;

    // Warm ambient glow
    const gradient = ctx.createRadialGradient(
      fireX, fireY - fireHeight * 0.3, 0,
      fireX, fireY - fireHeight * 0.3, glowRadius
    );
    gradient.addColorStop(0, `rgba(255, 150, 50, ${intensity * 0.4})`);
    gradient.addColorStop(0.2, `rgba(255, 100, 30, ${intensity * 0.25})`);
    gradient.addColorStop(0.5, `rgba(200, 60, 20, ${intensity * 0.1})`);
    gradient.addColorStop(1, `rgba(150, 30, 10, 0)`);

    ctx.fillStyle = gradient;
    ctx.fillRect(
      fireX - glowRadius,
      fireY - fireHeight - glowRadius,
      glowRadius * 2,
      glowRadius + fireHeight
    );
  }

  function setQuality(quality: QualityLevel, dimensions: Dimensions): void {
    if (quality === currentQuality) return;
    currentQuality = quality;

    // Reinitialize flames for new quality
    const flameCount = CAMPFIRE_CONFIG.FLAME_COUNT[quality];
    flames = [];
    for (let i = 0; i < flameCount; i++) {
      flames.push(createFlame(dimensions, i, flameCount));
    }
  }

  function cleanup(): void {
    flames = [];
    sparks = [];
    smokeParticles = [];
    flickerPhase = 0;
  }

  return {
    initialize,
    update,
    draw,
    drawAmbientGlow,
    setQuality,
    cleanup,
  };
}

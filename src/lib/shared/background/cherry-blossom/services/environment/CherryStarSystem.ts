/**
 * CherryStarSystem
 *
 * Renders a subtle star field for night mode.
 * Less dense than Night Sky - acts as backdrop rather than focus.
 */

import type { Dimensions, QualityLevel } from "$lib/shared/background/shared/domain/types/background-types";

interface Star {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  twinklePhase: number;
  twinkleSpeed: number;
  isTwinkling: boolean;
}

export interface StarConfig {
  /** Stars per 1000x1000 area */
  density: number;
  /** Min/max star radius */
  radiusMin: number;
  radiusMax: number;
  /** Percentage of stars that twinkle */
  twinkleChance: number;
}

const STAR_CONFIG_BY_QUALITY: Record<QualityLevel, StarConfig> = {
  high: {
    density: 0.00008,
    radiusMin: 0.5,
    radiusMax: 1.5,
    twinkleChance: 0.3,
  },
  medium: {
    density: 0.00005,
    radiusMin: 0.5,
    radiusMax: 1.2,
    twinkleChance: 0.2,
  },
  low: {
    density: 0.00003,
    radiusMin: 0.5,
    radiusMax: 1.0,
    twinkleChance: 0.1,
  },
  minimal: {
    density: 0.00002,
    radiusMin: 0.5,
    radiusMax: 0.8,
    twinkleChance: 0.05,
  },
  "ultra-minimal": {
    density: 0.00001,
    radiusMin: 0.5,
    radiusMax: 0.7,
    twinkleChance: 0,
  },
};

export class CherryStarSystem {
  private stars: Star[] = [];
  private config: StarConfig;
  private isInitialized = false;

  constructor(quality: QualityLevel = "medium") {
    this.config = STAR_CONFIG_BY_QUALITY[quality];
  }

  initialize(dimensions: Dimensions): void {
    const { width, height } = dimensions;
    const area = width * height;
    const count = Math.floor(area * this.config.density);

    this.stars = [];
    for (let i = 0; i < count; i++) {
      this.stars.push(this.createStar(dimensions));
    }

    this.isInitialized = true;
  }

  private createStar(dimensions: Dimensions): Star {
    return {
      x: Math.random() * dimensions.width,
      y: Math.random() * dimensions.height,
      radius: this.config.radiusMin + Math.random() * (this.config.radiusMax - this.config.radiusMin),
      opacity: 0.3 + Math.random() * 0.5,
      twinklePhase: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.02 + Math.random() * 0.03,
      isTwinkling: Math.random() < this.config.twinkleChance,
    };
  }

  update(dimensions: Dimensions, frameMultiplier: number = 1.0): void {
    if (!this.isInitialized || this.stars.length === 0) {
      this.initialize(dimensions);
      return;
    }

    for (const star of this.stars) {
      if (star.isTwinkling) {
        star.twinklePhase += star.twinkleSpeed * frameMultiplier;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.isInitialized) return;

    ctx.save();

    for (const star of this.stars) {
      // Calculate current opacity (twinkle effect)
      let currentOpacity = star.opacity;
      if (star.isTwinkling) {
        // Gentle twinkle: 0.5 to 1.0 multiplier
        const twinkleMult = 0.75 + 0.25 * Math.sin(star.twinklePhase);
        currentOpacity *= twinkleMult;
      }

      ctx.globalAlpha = currentOpacity;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      ctx.fill();

      // Add subtle glow to brighter stars
      if (star.opacity > 0.6 && star.radius > 1) {
        ctx.globalAlpha = currentOpacity * 0.3;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  setQuality(quality: QualityLevel, dimensions: Dimensions): void {
    this.config = STAR_CONFIG_BY_QUALITY[quality];
    this.initialize(dimensions);
  }

  handleResize(oldDimensions: Dimensions, newDimensions: Dimensions): void {
    if (!this.isInitialized) return;

    const scaleX = newDimensions.width / oldDimensions.width;
    const scaleY = newDimensions.height / oldDimensions.height;

    // Scale existing star positions
    for (const star of this.stars) {
      star.x *= scaleX;
      star.y *= scaleY;

      // Wrap if out of bounds
      star.x = star.x % newDimensions.width;
      star.y = star.y % newDimensions.height;
    }

    // Adjust star count if viewport changed significantly
    const oldArea = oldDimensions.width * oldDimensions.height;
    const newArea = newDimensions.width * newDimensions.height;
    const targetCount = Math.floor(newArea * this.config.density);

    if (this.stars.length < targetCount) {
      const toAdd = targetCount - this.stars.length;
      for (let i = 0; i < toAdd; i++) {
        this.stars.push(this.createStar(newDimensions));
      }
    } else if (this.stars.length > targetCount) {
      this.stars = this.stars.slice(0, targetCount);
    }
  }

  cleanup(): void {
    this.stars = [];
    this.isInitialized = false;
  }
}

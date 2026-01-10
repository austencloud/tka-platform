/**
 * AmbientParticleSystem - Floating dust motes and pollen for atmospheric depth
 *
 * Creates subtle ambient particles that:
 * - Float slowly at various depths (3 layers like grass)
 * - Respond to mouse parallax for depth illusion
 * - Catch moonlight occasionally (brief shimmer)
 * - Add atmospheric haze to the forest scene
 */

import type {
  Dimensions,
  QualityLevel,
} from "$lib/shared/background/shared/domain/types/background-types";

interface AmbientParticle {
  x: number;
  y: number;
  size: number;
  opacity: number;
  layer: 0 | 1 | 2; // Depth layer (0=far, 2=near)
  driftAngle: number; // Direction of slow drift
  driftSpeed: number;
  shimmerPhase: number; // For occasional light catch
  shimmerSpeed: number;
  isShimmering: boolean;
}

// Configuration
const PARTICLE_COUNTS: Record<QualityLevel, number> = {
  high: 80,
  medium: 50,
  low: 30,
  minimal: 15,
  "ultra-minimal": 8,
};

const PARTICLE_CONFIG = {
  // Size ranges per layer (far = tiny, near = larger)
  SIZE: {
    far: { min: 0.8, max: 1.5 },
    mid: { min: 1.2, max: 2.2 },
    near: { min: 1.8, max: 3.5 },
  },
  // Opacity ranges per layer (far = faint, near = more visible)
  OPACITY: {
    far: { min: 0.08, max: 0.18 },
    mid: { min: 0.12, max: 0.25 },
    near: { min: 0.15, max: 0.35 },
  },
  // Movement
  DRIFT_SPEED: { min: 0.02, max: 0.08 }, // Very slow floating
  DRIFT_ANGLE_CHANGE: 0.01, // Gentle direction changes
  // Shimmer (catching moonlight)
  SHIMMER_CHANCE: 0.0003, // Rare per frame
  SHIMMER_DURATION: 60, // Frames
  SHIMMER_BOOST: 0.4, // Added opacity
  // Distribution - mostly in upper/mid areas (not ground level)
  ZONE_TOP: 0.05,
  ZONE_BOTTOM: 0.75, // Keep above ground grass
} as const;

// Color for particles - very pale, bluish (moonlit dust)
const PARTICLE_COLOR = { r: 200, g: 210, b: 230 };

export interface AmbientParticleAPI {
  initialize: (dimensions: Dimensions, quality: QualityLevel) => void;
  update: (dimensions: Dimensions, frameMultiplier: number) => void;
  drawLayer: (ctx: CanvasRenderingContext2D, layer: 0 | 1 | 2, parallaxOffset: { x: number; y: number }) => void;
  setQuality: (quality: QualityLevel, dimensions: Dimensions) => void;
  getCount: () => number;
  cleanup: () => void;
}

export function createAmbientParticleSystem(): AmbientParticleAPI {
  let particles: AmbientParticle[] = [];
  let currentQuality: QualityLevel = "medium";

  function randomInRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  function createParticle(dimensions: Dimensions, layer: 0 | 1 | 2): AmbientParticle {
    const layerKey = layer === 0 ? "far" : layer === 1 ? "mid" : "near";
    const sizeConfig = PARTICLE_CONFIG.SIZE[layerKey];
    const opacityConfig = PARTICLE_CONFIG.OPACITY[layerKey];

    const zoneHeight = dimensions.height * (PARTICLE_CONFIG.ZONE_BOTTOM - PARTICLE_CONFIG.ZONE_TOP);
    const zoneTop = dimensions.height * PARTICLE_CONFIG.ZONE_TOP;

    return {
      x: Math.random() * dimensions.width,
      y: zoneTop + Math.random() * zoneHeight,
      size: randomInRange(sizeConfig.min, sizeConfig.max),
      opacity: randomInRange(opacityConfig.min, opacityConfig.max),
      layer,
      driftAngle: Math.random() * Math.PI * 2,
      driftSpeed: randomInRange(PARTICLE_CONFIG.DRIFT_SPEED.min, PARTICLE_CONFIG.DRIFT_SPEED.max),
      shimmerPhase: 0,
      shimmerSpeed: 0.05 + Math.random() * 0.03,
      isShimmering: false,
    };
  }

  function initialize(dimensions: Dimensions, quality: QualityLevel): void {
    currentQuality = quality;
    const count = PARTICLE_COUNTS[quality];
    particles = [];

    // Distribute across layers: 40% far, 35% mid, 25% near
    const farCount = Math.floor(count * 0.4);
    const midCount = Math.floor(count * 0.35);
    const nearCount = count - farCount - midCount;

    for (let i = 0; i < farCount; i++) {
      particles.push(createParticle(dimensions, 0));
    }
    for (let i = 0; i < midCount; i++) {
      particles.push(createParticle(dimensions, 1));
    }
    for (let i = 0; i < nearCount; i++) {
      particles.push(createParticle(dimensions, 2));
    }
  }

  function update(dimensions: Dimensions, frameMultiplier: number): void {
    const zoneTop = dimensions.height * PARTICLE_CONFIG.ZONE_TOP;
    const zoneBottom = dimensions.height * PARTICLE_CONFIG.ZONE_BOTTOM;

    for (const particle of particles) {
      // Gentle drift angle change
      particle.driftAngle += (Math.random() - 0.5) * PARTICLE_CONFIG.DRIFT_ANGLE_CHANGE * frameMultiplier;

      // Update position
      particle.x += Math.cos(particle.driftAngle) * particle.driftSpeed * frameMultiplier;
      particle.y += Math.sin(particle.driftAngle) * particle.driftSpeed * frameMultiplier;

      // Add slight upward tendency (dust rises)
      particle.y -= 0.01 * frameMultiplier;

      // Wrap horizontally
      if (particle.x < -10) {
        particle.x = dimensions.width + 10;
      } else if (particle.x > dimensions.width + 10) {
        particle.x = -10;
      }

      // Wrap vertically (respawn at bottom if floats too high)
      if (particle.y < zoneTop - 10) {
        particle.y = zoneBottom;
        particle.x = Math.random() * dimensions.width;
      } else if (particle.y > zoneBottom + 10) {
        particle.y = zoneTop;
        particle.x = Math.random() * dimensions.width;
      }

      // Handle shimmer state
      if (particle.isShimmering) {
        particle.shimmerPhase += particle.shimmerSpeed * frameMultiplier;
        if (particle.shimmerPhase >= 1) {
          particle.isShimmering = false;
          particle.shimmerPhase = 0;
        }
      } else {
        // Chance to start shimmering
        if (Math.random() < PARTICLE_CONFIG.SHIMMER_CHANCE * frameMultiplier) {
          particle.isShimmering = true;
          particle.shimmerPhase = 0;
        }
      }
    }
  }

  function drawLayer(
    ctx: CanvasRenderingContext2D,
    layer: 0 | 1 | 2,
    parallaxOffset: { x: number; y: number }
  ): void {
    const layerParticles = particles.filter((p) => p.layer === layer);

    for (const particle of layerParticles) {
      const { x, y, size, opacity, isShimmering, shimmerPhase } = particle;

      // Apply parallax
      const drawX = x + parallaxOffset.x;
      const drawY = y + parallaxOffset.y;

      // Calculate opacity with shimmer boost
      let finalOpacity = opacity;
      if (isShimmering) {
        // Sine curve for smooth shimmer in/out
        const shimmerIntensity = Math.sin(shimmerPhase * Math.PI);
        finalOpacity += PARTICLE_CONFIG.SHIMMER_BOOST * shimmerIntensity;
      }

      // Draw particle with soft glow
      const glowRadius = size * 3;

      // Outer soft glow
      const gradient = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, glowRadius);
      gradient.addColorStop(0, `rgba(${PARTICLE_COLOR.r}, ${PARTICLE_COLOR.g}, ${PARTICLE_COLOR.b}, ${finalOpacity * 0.6})`);
      gradient.addColorStop(0.4, `rgba(${PARTICLE_COLOR.r}, ${PARTICLE_COLOR.g}, ${PARTICLE_COLOR.b}, ${finalOpacity * 0.2})`);
      gradient.addColorStop(1, `rgba(${PARTICLE_COLOR.r}, ${PARTICLE_COLOR.g}, ${PARTICLE_COLOR.b}, 0)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(drawX, drawY, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // Bright core
      ctx.fillStyle = `rgba(${PARTICLE_COLOR.r + 30}, ${PARTICLE_COLOR.g + 25}, ${PARTICLE_COLOR.b + 20}, ${Math.min(1, finalOpacity * 1.5)})`;
      ctx.beginPath();
      ctx.arc(drawX, drawY, size * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function setQuality(quality: QualityLevel, dimensions: Dimensions): void {
    if (quality === currentQuality) return;
    currentQuality = quality;

    const targetCount = PARTICLE_COUNTS[quality];
    const farTarget = Math.floor(targetCount * 0.4);
    const midTarget = Math.floor(targetCount * 0.35);
    const nearTarget = targetCount - farTarget - midTarget;

    // Adjust counts per layer
    const adjustLayer = (layer: 0 | 1 | 2, target: number) => {
      const current = particles.filter((p) => p.layer === layer);
      while (current.length < target) {
        const newParticle = createParticle(dimensions, layer);
        particles.push(newParticle);
        current.push(newParticle);
      }
      // Remove excess
      let removed = 0;
      particles = particles.filter((p) => {
        if (p.layer === layer && removed < current.length - target) {
          removed++;
          return false;
        }
        return true;
      });
    };

    adjustLayer(0, farTarget);
    adjustLayer(1, midTarget);
    adjustLayer(2, nearTarget);
  }

  function getCount(): number {
    return particles.length;
  }

  function cleanup(): void {
    particles = [];
  }

  return {
    initialize,
    update,
    drawLayer,
    setQuality,
    getCount,
    cleanup,
  };
}

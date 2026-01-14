import type {
  Bubble,
  BubbleSize,
  BubbleTrailParticle,
} from "../../domain/models/DeepOceanModels";
import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import type { IBubblePhysics } from "../contracts/IBubblePhysics";

/**
 * Bubble Configuration
 * Tuned for beautiful, physically-accurate bubble behavior
 */
const BUBBLE_CONFIG = {
  // Size categories with behavior profiles
  sizes: {
    small: {
      radius: { min: 2, max: 4 },
      speed: { min: 0.8, max: 1.5 },
      acceleration: 0.002, // Fast acceleration
      wobbleAmplitude: { min: 0.08, max: 0.12 },
      wobbleSpeed: { min: 0.04, max: 0.06 },
      turbulence: 0.8, // High jitter
      opacity: { min: 0.2, max: 0.35 },
      iridescentSpeed: { min: 0.015, max: 0.025 },
      trailSpawnRate: 0.02, // Rarely spawn trails
      weight: 0.5, // 50% chance
    },
    medium: {
      radius: { min: 5, max: 8 },
      speed: { min: 0.5, max: 1.0 },
      acceleration: 0.0015,
      wobbleAmplitude: { min: 0.06, max: 0.1 },
      wobbleSpeed: { min: 0.025, max: 0.04 },
      turbulence: 0.5,
      opacity: { min: 0.25, max: 0.45 },
      iridescentSpeed: { min: 0.01, max: 0.018 },
      trailSpawnRate: 0.04,
      weight: 0.35, // 35% chance
    },
    large: {
      radius: { min: 10, max: 15 },
      speed: { min: 0.3, max: 0.6 },
      acceleration: 0.001, // Slow acceleration
      wobbleAmplitude: { min: 0.04, max: 0.08 },
      wobbleSpeed: { min: 0.015, max: 0.025 },
      turbulence: 0.3, // Stable rise
      opacity: { min: 0.35, max: 0.55 },
      iridescentSpeed: { min: 0.006, max: 0.012 },
      trailSpawnRate: 0.08, // Frequently spawn trails
      weight: 0.15, // 15% chance
    },
  },

  // Depth/parallax (0 = close, 1 = far)
  depth: { min: 0.2, max: 0.9 },
  depthSwayScale: { min: 0.4, max: 1.4 }, // Sway multiplier by depth (close = more sway)

  // Physics
  maxSpeed: 2.5, // Cap on upward velocity
  swayMagnitude: { min: 0.3, max: 0.8 },
  turbulenceFrequency: 0.03,

  // Visual
  fadeZoneHeight: 0.15, // Top 15% of screen = fade zone
  rimHighlightSpeed: 0.008, // Slow rotation of highlight

  // Trails
  trailMaxAge: 0.8, // Seconds before trail fades
  trailMaxParticles: 4, // Max particles per bubble
  trailSizeRatio: 0.3, // Trail particle size relative to parent

  // Clustering
  clusterChance: 0.15, // 15% of bubbles are in clusters
  clusterSize: { min: 2, max: 3 },
  clusterSpread: 20, // Pixels between clustered bubbles
};

export class BubblePhysics implements IBubblePhysics {
  private nextClusterId = 1;

  initializeBubbles(dimensions: Dimensions, count: number): Bubble[] {
    const bubbles: Bubble[] = [];

    // Create clusters first
    let remaining = count;
    while (remaining > 0) {
      if (Math.random() < BUBBLE_CONFIG.clusterChance && remaining >= 2) {
        const clusterSize = this.randomIntInRange(
          BUBBLE_CONFIG.clusterSize.min,
          Math.min(BUBBLE_CONFIG.clusterSize.max, remaining)
        );
        const cluster = this.createCluster(dimensions, clusterSize);
        bubbles.push(...cluster);
        remaining -= clusterSize;
      } else {
        bubbles.push(this.createBubble(dimensions));
        remaining--;
      }
    }

    return bubbles;
  }

  createBubble(
    dimensions: Dimensions,
    clusterId?: number,
    clusterOffset?: { x: number; y: number }
  ): Bubble {
    const sizeCategory = this.pickSizeCategory();
    const config = BUBBLE_CONFIG.sizes[sizeCategory];

    const radius = this.randomInRange(config.radius.min, config.radius.max);
    const baseSpeed = this.randomInRange(config.speed.min, config.speed.max);
    const baseOpacity = this.randomInRange(config.opacity.min, config.opacity.max);

    // Assign depth (0 = close, 1 = far)
    const depth = this.randomInRange(
      BUBBLE_CONFIG.depth.min,
      BUBBLE_CONFIG.depth.max
    );

    // Depth affects sway: closer = more horizontal movement (parallax)
    const depthSwayMultiplier = this.lerp(
      BUBBLE_CONFIG.depthSwayScale.max,
      BUBBLE_CONFIG.depthSwayScale.min,
      depth
    );

    const startY = dimensions.height + 50 + Math.random() * 100;

    return {
      // Position
      x: Math.random() * dimensions.width,
      y: startY,
      startY,

      // Depth
      depth,

      // Size
      radius,
      sizeCategory,

      // Physics
      speed: baseSpeed,
      baseSpeed,
      acceleration: config.acceleration,
      sway: this.randomInRange(
        BUBBLE_CONFIG.swayMagnitude.min,
        BUBBLE_CONFIG.swayMagnitude.max
      ) * depthSwayMultiplier,
      swayOffset: Math.random() * Math.PI * 2,
      turbulenceX: 0,
      turbulencePhase: Math.random() * Math.PI * 2,

      // Wobble
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleAmplitude: this.randomInRange(
        config.wobbleAmplitude.min,
        config.wobbleAmplitude.max
      ),
      wobbleSpeed: this.randomInRange(
        config.wobbleSpeed.min,
        config.wobbleSpeed.max
      ),

      // Visual
      opacity: baseOpacity,
      baseOpacity,
      iridescentPhase: Math.random() * Math.PI * 2,
      iridescentSpeed: this.randomInRange(
        config.iridescentSpeed.min,
        config.iridescentSpeed.max
      ),
      rimHighlightAngle: Math.random() * Math.PI * 2,

      // Trail
      trailParticles: [],
      lastTrailSpawn: 0,

      // Clustering
      clusterId,
      clusterOffset,

      // Lifecycle
      age: 0,
      fadeZone: dimensions.height * BUBBLE_CONFIG.fadeZoneHeight,
    };
  }

  private createCluster(dimensions: Dimensions, size: number): Bubble[] {
    const clusterId = this.nextClusterId++;
    const bubbles: Bubble[] = [];

    // Leader bubble (no offset)
    bubbles.push(this.createBubble(dimensions, clusterId, { x: 0, y: 0 }));

    // Follower bubbles with offsets
    for (let i = 1; i < size; i++) {
      const angle = (i / (size - 1)) * Math.PI - Math.PI / 2;
      const offset = {
        x:
          Math.cos(angle) *
          BUBBLE_CONFIG.clusterSpread *
          (0.5 + Math.random() * 0.5),
        y:
          Math.sin(angle) *
          BUBBLE_CONFIG.clusterSpread *
          0.5 *
          (0.5 + Math.random() * 0.5),
      };
      bubbles.push(this.createBubble(dimensions, clusterId, offset));
    }

    return bubbles;
  }

  updateBubbles(
    bubbles: Bubble[],
    dimensions: Dimensions,
    frameMultiplier: number,
    animationTime: number
  ): Bubble[] {
    const updatedBubbles: Bubble[] = [];

    // Group bubbles by cluster for synchronized movement
    const clusterLeaders = new Map<number, Bubble>();

    for (const bubble of bubbles) {
      if (
        bubble.clusterId !== undefined &&
        bubble.clusterOffset?.x === 0 &&
        bubble.clusterOffset?.y === 0
      ) {
        clusterLeaders.set(bubble.clusterId, bubble);
      }
    }

    for (const bubble of bubbles) {
      // Update physics
      this.updateBubblePhysics(bubble, dimensions, frameMultiplier, animationTime);

      // Update cluster position (followers track leaders)
      if (
        bubble.clusterId !== undefined &&
        bubble.clusterOffset &&
        (bubble.clusterOffset.x !== 0 || bubble.clusterOffset.y !== 0)
      ) {
        const leader = clusterLeaders.get(bubble.clusterId);
        if (leader) {
          bubble.x = leader.x + bubble.clusterOffset.x;
          bubble.y = leader.y + bubble.clusterOffset.y;
        }
      }

      // Update trail particles
      this.updateTrailParticles(bubble, animationTime, frameMultiplier);

      // Update visual phases
      this.updateVisualPhases(bubble, frameMultiplier);

      // Check if off-screen
      if (bubble.y < -bubble.radius * 2) {
        // Replace with new bubble (or cluster)
        if (bubble.clusterId !== undefined) {
          // Only replace cluster leader
          if (
            bubble.clusterOffset?.x === 0 &&
            bubble.clusterOffset?.y === 0
          ) {
            const cluster = this.createCluster(
              dimensions,
              this.randomIntInRange(
                BUBBLE_CONFIG.clusterSize.min,
                BUBBLE_CONFIG.clusterSize.max
              )
            );
            updatedBubbles.push(...cluster);
          }
          // Followers are automatically replaced with leader
        } else {
          updatedBubbles.push(this.createBubble(dimensions));
        }
      } else {
        updatedBubbles.push(bubble);
      }
    }

    return updatedBubbles;
  }

  private updateBubblePhysics(
    bubble: Bubble,
    dimensions: Dimensions,
    frameMultiplier: number,
    animationTime: number
  ): void {
    const config = BUBBLE_CONFIG.sizes[bubble.sizeCategory];

    // Acceleration (buoyancy - bubbles speed up as they rise)
    bubble.speed = Math.min(
      BUBBLE_CONFIG.maxSpeed,
      bubble.speed + bubble.acceleration * frameMultiplier
    );

    // Upward movement
    bubble.y -= bubble.speed * frameMultiplier;

    // Sinusoidal sway
    const swayAmount =
      Math.sin(animationTime * bubble.sway + bubble.swayOffset) *
      0.5 *
      frameMultiplier;

    // Turbulence (random jitter)
    bubble.turbulencePhase += BUBBLE_CONFIG.turbulenceFrequency * frameMultiplier;
    const turbulenceAmount =
      Math.sin(bubble.turbulencePhase * 7.3) *
      Math.cos(bubble.turbulencePhase * 3.1) *
      config.turbulence *
      0.3 *
      frameMultiplier;

    bubble.turbulenceX = turbulenceAmount;
    bubble.x += swayAmount + turbulenceAmount;

    // Fade as approaching surface
    if (bubble.y < bubble.fadeZone) {
      const fadeProgress = 1 - bubble.y / bubble.fadeZone;
      bubble.opacity = bubble.baseOpacity * (1 - fadeProgress * 0.8);
    } else {
      // Fade in at start
      const riseProgress = (bubble.startY - bubble.y) / (bubble.startY * 0.2);
      bubble.age = Math.min(1, riseProgress);
      bubble.opacity = bubble.baseOpacity * Math.min(1, bubble.age * 2);
    }
  }

  private updateTrailParticles(
    bubble: Bubble,
    animationTime: number,
    frameMultiplier: number
  ): void {
    const config = BUBBLE_CONFIG.sizes[bubble.sizeCategory];

    // Age existing particles
    for (let i = bubble.trailParticles.length - 1; i >= 0; i--) {
      const particle = bubble.trailParticles[i];
      if (particle) {
        particle.age += (0.016 / BUBBLE_CONFIG.trailMaxAge) * frameMultiplier;
        if (particle.age > 1) {
          bubble.trailParticles.splice(i, 1);
        }
      }
    }

    // Spawn new trail particles
    const timeSinceLastSpawn = animationTime - bubble.lastTrailSpawn;
    if (
      timeSinceLastSpawn > 0.1 &&
      Math.random() < config.trailSpawnRate * frameMultiplier &&
      bubble.trailParticles.length < BUBBLE_CONFIG.trailMaxParticles
    ) {
      bubble.trailParticles.push({
        x: bubble.x + (Math.random() - 0.5) * bubble.radius * 0.5,
        y: bubble.y + bubble.radius * 0.8,
        age: 0,
        size: bubble.radius * BUBBLE_CONFIG.trailSizeRatio * (0.5 + Math.random() * 0.5),
      });
      bubble.lastTrailSpawn = animationTime;
    }
  }

  private updateVisualPhases(bubble: Bubble, frameMultiplier: number): void {
    // Wobble animation
    bubble.wobblePhase += bubble.wobbleSpeed * frameMultiplier;

    // Iridescent shimmer
    bubble.iridescentPhase += bubble.iridescentSpeed * frameMultiplier;

    // Rim highlight rotation (very slow)
    bubble.rimHighlightAngle += BUBBLE_CONFIG.rimHighlightSpeed * frameMultiplier;
  }

  private pickSizeCategory(): BubbleSize {
    const roll = Math.random();
    const { small, medium, large } = BUBBLE_CONFIG.sizes;

    if (roll < small.weight) return "small";
    if (roll < small.weight + medium.weight) return "medium";
    return "large";
  }

  getBubbleCount(quality: string): number {
    switch (quality) {
      case "minimal":
        return 6;
      case "low":
        return 12;
      case "medium":
        return 20;
      case "high":
        return 28;
      default:
        return 20;
    }
  }

  private randomInRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  private randomIntInRange(min: number, max: number): number {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
}

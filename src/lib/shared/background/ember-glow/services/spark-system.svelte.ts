/**
 * SparkSystem - Small, fast, bright particles (Runes-based for HMR)
 *
 * Creates energy above embers with small, bright particles
 * that rise quickly and burn out (short lifetime).
 * Supports optional trails for a classier effect.
 *
 * Converted to .svelte.ts for Vite HMR support.
 */
import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import type { SparkParticle } from "../domain/models/ember-models";
import { SPARK_CONFIG } from "../domain/constants/ember-constants";

// ============================================================================
// REACTIVE STATE (HMR-preserved via Svelte 5 runes)
// ============================================================================

let particles = $state<SparkParticle[]>([]);
let motionMultiplier = $state<number>(1.0);
let targetCount = $state<number>(0);
let trailsEnabled = $state<boolean>(false);
let trailLength = $state<number>(10);
let trailFade = $state<number>(0.85);

// Burst spawning state - tuned for chill, ambient vibe
let burstTimer = $state<number>(0);
const BURST_INTERVAL_MIN = 90; // frames between bursts (1.5 sec at 60fps)
const BURST_INTERVAL_MAX = 240; // frames (4 sec at 60fps)
const BURST_COUNT_MIN = 1;
const BURST_COUNT_MAX = 3;

// ============================================================================
// DERIVED VALUES (exported as getters per Svelte rules)
// ============================================================================

// Note: Cannot export $derived directly from modules, use getCount() instead

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/**
 * Create a spark particle with realistic fire behavior
 * - Variable lifetime: some pop quickly, some soar high
 * - Horizontal spread: sparks shoot sideways, not just up
 * - Spawn from bottom center area (like a fire pit)
 */
function createParticle(dimensions: Dimensions, randomizeY = false): SparkParticle {
  // Spawn from bottom-center area (like a fire pit) with some spread
  const centerX = dimensions.width / 2;
  const spawnSpread = dimensions.width * 0.3; // 30% of width
  const x = centerX + (Math.random() - 0.5) * spawnSpread;
  const y = randomizeY
    ? dimensions.height * 0.3 + Math.random() * dimensions.height * 0.7
    : dimensions.height + 10;

  const size = SPARK_CONFIG.SIZE_MIN + Math.random() * SPARK_CONFIG.SIZE_RANGE;

  // VARIABLE LIFETIME: Most sparks are short-lived, but some soar high
  // Use exponential distribution: many short, few long
  const lifetimeRoll = Math.random();
  let maxLifetime: number;
  if (lifetimeRoll < 0.6) {
    // 60% - Short-lived sparks (pop quickly near bottom)
    maxLifetime = 20 + Math.random() * 40; // 20-60 frames
  } else if (lifetimeRoll < 0.9) {
    // 30% - Medium sparks (rise partway)
    maxLifetime = 60 + Math.random() * 80; // 60-140 frames
  } else {
    // 10% - High flyers (soar across much of screen)
    maxLifetime = 150 + Math.random() * 150; // 150-300 frames
  }

  // HORIZONTAL SPREAD: Sparks shoot sideways too
  // Angle from vertical: -60 to +60 degrees
  const angle = (Math.random() - 0.5) * (Math.PI / 1.5); // ±60 degrees
  const speed = SPARK_CONFIG.SPEED_BASE + Math.random() * SPARK_CONFIG.SPEED_RANGE;
  const vx = Math.sin(angle) * speed * 0.8; // Horizontal component
  const vy = -Math.cos(angle) * speed; // Vertical component (negative = up)

  return {
    x,
    y,
    size,
    vx,
    vy,
    opacity: SPARK_CONFIG.OPACITY_MIN + Math.random() * SPARK_CONFIG.OPACITY_RANGE,
    lifetime: randomizeY ? Math.random() * maxLifetime : maxLifetime,
    maxLifetime,
    color: {
      r: SPARK_CONFIG.COLOR_R,
      g:
        SPARK_CONFIG.COLOR_G_MIN +
        Math.floor(Math.random() * (SPARK_CONFIG.COLOR_G_MAX - SPARK_CONFIG.COLOR_G_MIN)),
      b:
        SPARK_CONFIG.COLOR_B_MIN +
        Math.floor(Math.random() * (SPARK_CONFIG.COLOR_B_MAX - SPARK_CONFIG.COLOR_B_MIN)),
    },
    trail: [],
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Initialize spark particles
 */
export function initialize(dimensions: Dimensions, count: number): void {
  particles = [];
  targetCount = count;
  burstTimer = 0; // Trigger immediate first burst

  if (count <= 0) return;

  // Start with a few particles distributed across the screen
  // (not full count - bursts will fill in naturally)
  const initialCount = Math.min(count, Math.floor(count * 0.3));
  const newParticles: SparkParticle[] = [];
  for (let i = 0; i < initialCount; i++) {
    newParticles.push(createParticle(dimensions, true));
  }
  particles = newParticles;
}

/**
 * Update spark particles with burst spawning
 */
export function update(dimensions: Dimensions, frameMultiplier: number): void {
  const effectiveMultiplier = frameMultiplier * motionMultiplier;

  let updatedParticles = particles
    .map((particle) => {
      // Track trail before moving (if enabled)
      let newTrail = particle.trail;
      if (trailsEnabled) {
        newTrail = [{ x: particle.x, y: particle.y, opacity: particle.opacity }, ...particle.trail];
        if (newTrail.length > trailLength) {
          newTrail = newTrail.slice(0, trailLength);
        }
        // Fade trail points
        newTrail = newTrail.map((point) => ({
          ...point,
          opacity: point.opacity * trailFade,
        }));
      }

      // Move horizontally AND vertically
      const newX = particle.x + particle.vx * effectiveMultiplier;
      const newY = particle.y + particle.vy * effectiveMultiplier;
      const newLifetime = particle.lifetime - effectiveMultiplier;

      // Calculate fade based on lifetime
      const lifetimeRatio = Math.max(0, newLifetime / particle.maxLifetime);
      const newOpacity = particle.opacity * lifetimeRatio;

      return {
        ...particle,
        x: newX,
        y: newY,
        lifetime: newLifetime,
        opacity: newOpacity,
        trail: newTrail,
      };
    })
    .filter((particle) => {
      // Remove if lifetime expired, off screen top, or off screen sides
      return particle.lifetime > 0 &&
             particle.y > -10 &&
             particle.x > -20 &&
             particle.x < dimensions.width + 20;
    });

  // BURST SPAWNING: Spawn in bursts, not constantly
  burstTimer -= effectiveMultiplier;

  if (burstTimer <= 0 && updatedParticles.length < targetCount * 1.5) {
    // Reset timer for next burst
    burstTimer = BURST_INTERVAL_MIN + Math.random() * (BURST_INTERVAL_MAX - BURST_INTERVAL_MIN);

    // Spawn a burst of sparks
    const burstCount = BURST_COUNT_MIN + Math.floor(Math.random() * (BURST_COUNT_MAX - BURST_COUNT_MIN + 1));
    for (let i = 0; i < burstCount; i++) {
      updatedParticles = [...updatedParticles, createParticle(dimensions, false)];
    }
  }

  particles = updatedParticles;
}

/**
 * Draw spark particles
 */
export function draw(ctx: CanvasRenderingContext2D, _dimensions: Dimensions): void {
  for (const particle of particles) {
    const { x, y, size, opacity, color, trail } = particle;

    // Skip invalid or invisible particles
    if (!Number.isFinite(x) || !Number.isFinite(y) || opacity <= 0) continue;

    // Draw trail first (behind spark) as connected line segments
    if (trailsEnabled && trail.length > 1) {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Draw trail segments with fading opacity and width
      for (let i = 0; i < trail.length - 1; i++) {
        const curr = trail[i];
        const next = trail[i + 1];
        if (!curr || !next) continue;
        if (!Number.isFinite(curr.x) || !Number.isFinite(curr.y)) continue;
        if (!Number.isFinite(next.x) || !Number.isFinite(next.y)) continue;

        const progress = i / trail.length;
        const segmentOpacity = curr.opacity * (1 - progress * 0.5);
        const segmentWidth = size * 2 * (1 - progress * 0.7);

        ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${segmentOpacity})`;
        ctx.lineWidth = Math.max(0.5, segmentWidth);
        ctx.beginPath();
        ctx.moveTo(curr.x, curr.y);
        ctx.lineTo(next.x, next.y);
        ctx.stroke();
      }

      // Draw glow along trail head
      if (trail[0]) {
        const headGlow = ctx.createRadialGradient(
          trail[0].x, trail[0].y, 0,
          trail[0].x, trail[0].y, size * 2
        );
        headGlow.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${trail[0].opacity * 0.3})`);
        headGlow.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
        ctx.fillStyle = headGlow;
        ctx.fillRect(trail[0].x - size * 2, trail[0].y - size * 2, size * 4, size * 4);
      }
    }

    // Draw bright point with small glow
    const glowSize = size * 3;

    // Glow
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowSize);
    gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`);
    gradient.addColorStop(0.3, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * 0.5})`);
    gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);

    ctx.fillStyle = gradient;
    ctx.fillRect(x - glowSize, y - glowSize, glowSize * 2, glowSize * 2);

    // Bright core
    ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Set motion multiplier for accessibility
 */
export function setMotionMultiplier(multiplier: number): void {
  motionMultiplier = multiplier;
}

/**
 * Get particle count for stats
 */
export function getCount(): number {
  return particles.length;
}

/**
 * Set target count (with heat bonus)
 */
export function setCount(dimensions: Dimensions, count: number, heatBonus: number = 0): void {
  targetCount = Math.floor(count * (1 + heatBonus));

  // If we need more particles, add them
  if (particles.length < targetCount) {
    const newParticles = [...particles];
    while (newParticles.length < targetCount) {
      newParticles.push(createParticle(dimensions, true));
    }
    particles = newParticles;
  }
}

/**
 * Enable or disable spark trails
 */
export function setTrailsEnabled(enabled: boolean): void {
  trailsEnabled = enabled;
  // Clear existing trails when disabled
  if (!enabled) {
    particles = particles.map(p => ({ ...p, trail: [] }));
  }
}

/**
 * Configure trail appearance
 */
export function setTrailConfig(length: number, fade: number): void {
  trailLength = length;
  trailFade = fade;
}

/**
 * Cleanup
 */
export function cleanup(): void {
  particles = [];
  targetCount = 0;
}

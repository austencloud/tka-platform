/**
 * SmokeSystem - Dark, slow-rising smoke particles (Runes-based for HMR)
 *
 * Creates depth behind embers with larger, more diffuse particles
 * that drift slowly upward with low opacity.
 *
 * Converted to .svelte.ts for Vite HMR support.
 */
import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import type { SmokeParticle } from "../domain/models/ember-models";
import { SMOKE_CONFIG, EMBER_BOUNDS } from "../domain/constants/ember-constants";

// ============================================================================
// REACTIVE STATE (HMR-preserved via Svelte 5 runes)
// ============================================================================

let particles = $state<SmokeParticle[]>([]);
let motionMultiplier = $state<number>(1.0);

// ============================================================================
// DERIVED VALUES (exported as getters per Svelte rules)
// ============================================================================

// Note: Cannot export $derived directly from modules, use getCount() instead

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/**
 * Create a smoke particle at a specific Y position
 */
function createParticle(dimensions: Dimensions, y?: number): SmokeParticle {
  const x = Math.random() * dimensions.width;
  const actualY = y ?? dimensions.height + EMBER_BOUNDS.RESPAWN_BUFFER;

  const size = SMOKE_CONFIG.SIZE_MIN + Math.random() * SMOKE_CONFIG.SIZE_RANGE;
  const colorValue =
    SMOKE_CONFIG.COLOR_MIN +
    Math.floor(Math.random() * (SMOKE_CONFIG.COLOR_MAX - SMOKE_CONFIG.COLOR_MIN));

  return {
    x,
    y: actualY,
    size,
    vx: (Math.random() - 0.5) * SMOKE_CONFIG.DRIFT_AMPLITUDE,
    vy: -(SMOKE_CONFIG.SPEED_BASE + Math.random() * SMOKE_CONFIG.SPEED_RANGE),
    opacity: SMOKE_CONFIG.OPACITY_MIN + Math.random() * SMOKE_CONFIG.OPACITY_RANGE,
    color: { r: colorValue, g: colorValue, b: colorValue },
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Initialize smoke particles with stratified distribution
 */
export function initialize(dimensions: Dimensions, count: number): void {
  particles = [];

  if (count <= 0) return;

  const bandHeight = dimensions.height / count;

  for (let i = 0; i < count; i++) {
    const stratifiedY = i * bandHeight + Math.random() * bandHeight;
    particles = [...particles, createParticle(dimensions, stratifiedY)];
  }
}

/**
 * Update smoke particles
 */
export function update(dimensions: Dimensions, frameMultiplier: number): void {
  const effectiveMultiplier = frameMultiplier * motionMultiplier;

  particles = particles.map((particle) => {
    let newX = particle.x + particle.vx * effectiveMultiplier;
    const newY = particle.y + particle.vy * effectiveMultiplier;

    // Respawn if risen above viewport
    if (newY < -particle.size * 2) {
      return createParticle(dimensions);
    }

    // Wrap horizontally
    if (newX < -particle.size) {
      newX = dimensions.width + particle.size;
    } else if (newX > dimensions.width + particle.size) {
      newX = -particle.size;
    }

    return { ...particle, x: newX, y: newY };
  });
}

/**
 * Draw smoke particles
 */
export function draw(ctx: CanvasRenderingContext2D, _dimensions: Dimensions): void {
  for (const particle of particles) {
    const { x, y, size, opacity, color } = particle;

    // Skip invalid particles
    if (!Number.isFinite(x) || !Number.isFinite(y) || size <= 0) continue;

    // Draw soft, diffuse circle
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
    gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`);
    gradient.addColorStop(0.5, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * 0.5})`);
    gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);

    ctx.fillStyle = gradient;
    ctx.fillRect(x - size, y - size, size * 2, size * 2);
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
 * Adjust particle count
 */
export function setCount(dimensions: Dimensions, count: number): void {
  const currentCount = particles.length;

  if (count > currentCount) {
    // Add more particles
    const newParticles = [...particles];
    for (let i = 0; i < count - currentCount; i++) {
      const randomY = Math.random() * dimensions.height;
      newParticles.push(createParticle(dimensions, randomY));
    }
    particles = newParticles;
  } else if (count < currentCount) {
    // Remove excess particles
    particles = particles.slice(0, count);
  }
}

/**
 * Cleanup
 */
export function cleanup(): void {
  particles = [];
}

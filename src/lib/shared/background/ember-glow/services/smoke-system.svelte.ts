/**
 * SmokeSystem - Billowing smoke particles (A+ Enhancement)
 *
 * Creates atmospheric depth with smoke that:
 * - Expands as it rises (larger at higher altitudes)
 * - Fades as it rises (lower opacity at higher altitudes)
 * - Drifts with sine wave motion (organic, wispy feel)
 * - Has multiple wispy segments per plume
 *
 * Converted to .svelte.ts for Vite HMR support.
 */
import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import type { SmokeParticle } from "../domain/models/ember-models";
import { SMOKE_CONFIG, EMBER_BOUNDS } from "../domain/constants/ember-constants";

// ============================================================================
// BILLOWING SMOKE CONFIGURATION (A+ Enhancement)
// ============================================================================

const BILLOW_CONFIG = {
  /** How much smoke expands as it rises (1 = double size at top) */
  EXPANSION_FACTOR: 0.8,
  /** How much smoke fades as it rises (1 = fully transparent at top) */
  FADE_FACTOR: 0.7,
  /** Drift frequency range - disabled */
  DRIFT_FREQUENCY_MIN: 0,
  DRIFT_FREQUENCY_RANGE: 0,
  /** Drift amplitude - no side motion */
  DRIFT_AMPLITUDE: 0,
  /** Number of wispy segments per smoke particle */
  WISP_COUNT: 1,  // Single smoke puff, no layered wisps
  /** Offset between wispy segments */
  WISP_OFFSET: 0,
} as const;

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
 * Create a smoke particle at a specific Y position with billowing properties
 */
function createParticle(dimensions: Dimensions, y?: number): SmokeParticle {
  // Spawn from bottom-center area (like rising from the fire)
  const centerBias = Math.random() * Math.random(); // Bias toward center
  const x = dimensions.width / 2 + (Math.random() - 0.5) * dimensions.width * 0.5 * (1 - centerBias * 0.5);
  const actualY = y ?? dimensions.height + EMBER_BOUNDS.RESPAWN_BUFFER;

  const baseSize = SMOKE_CONFIG.SIZE_MIN + Math.random() * SMOKE_CONFIG.SIZE_RANGE;
  const baseOpacity = SMOKE_CONFIG.OPACITY_MIN + Math.random() * SMOKE_CONFIG.OPACITY_RANGE;
  const colorValue =
    SMOKE_CONFIG.COLOR_MIN +
    Math.floor(Math.random() * (SMOKE_CONFIG.COLOR_MAX - SMOKE_CONFIG.COLOR_MIN));

  return {
    x,
    y: actualY,
    size: baseSize,
    baseSize,
    vx: (Math.random() - 0.5) * SMOKE_CONFIG.DRIFT_AMPLITUDE,
    vy: -(SMOKE_CONFIG.SPEED_BASE + Math.random() * SMOKE_CONFIG.SPEED_RANGE),
    opacity: baseOpacity,
    baseOpacity,
    color: { r: colorValue, g: colorValue, b: colorValue },
    // Billowing properties
    driftOffset: Math.random() * Math.PI * 2,
    driftFrequency: BILLOW_CONFIG.DRIFT_FREQUENCY_MIN + Math.random() * BILLOW_CONFIG.DRIFT_FREQUENCY_RANGE,
    spawnY: actualY,
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
 * Update smoke particles with billowing behavior
 */
export function update(dimensions: Dimensions, frameMultiplier: number): void {
  const effectiveMultiplier = frameMultiplier * motionMultiplier;

  particles = particles.map((particle) => {
    // Base movement
    const newY = particle.y + particle.vy * effectiveMultiplier;

    // Calculate how far the particle has risen (0 = just spawned, 1 = at top)
    const travelDistance = particle.spawnY - newY;
    const altitudeRatio = Math.min(1, Math.max(0, travelDistance / dimensions.height));

    // Sine wave drift (organic, wispy motion)
    const newDriftOffset = particle.driftOffset + particle.driftFrequency * effectiveMultiplier;
    const sineOffset = Math.sin(newDriftOffset) * BILLOW_CONFIG.DRIFT_AMPLITUDE * altitudeRatio;

    // Apply base velocity plus sine drift
    let newX = particle.x + particle.vx * effectiveMultiplier + sineOffset * 0.1;

    // Expansion: smoke gets larger as it rises
    const expansionMultiplier = 1 + altitudeRatio * BILLOW_CONFIG.EXPANSION_FACTOR;
    const newSize = particle.baseSize * expansionMultiplier;

    // Fade: smoke gets more transparent as it rises
    const fadeMultiplier = 1 - altitudeRatio * BILLOW_CONFIG.FADE_FACTOR;
    const newOpacity = particle.baseOpacity * fadeMultiplier;

    // Respawn if risen above viewport or fully faded
    if (newY < -newSize * 2 || newOpacity < 0.01) {
      return createParticle(dimensions);
    }

    // Wrap horizontally
    if (newX < -newSize) {
      newX = dimensions.width + newSize;
    } else if (newX > dimensions.width + newSize) {
      newX = -newSize;
    }

    return {
      ...particle,
      x: newX,
      y: newY,
      size: newSize,
      opacity: newOpacity,
      driftOffset: newDriftOffset,
    };
  });
}

/**
 * Draw smoke particles with wispy segments
 */
export function draw(ctx: CanvasRenderingContext2D, _dimensions: Dimensions): void {
  for (const particle of particles) {
    const { x, y, size, opacity, color, driftOffset } = particle;

    // Skip invalid particles
    if (!Number.isFinite(x) || !Number.isFinite(y) || size <= 0 || opacity <= 0) continue;

    // Draw multiple wispy segments per smoke particle for organic look
    for (let i = 0; i < BILLOW_CONFIG.WISP_COUNT; i++) {
      // Offset each wisp slightly for organic layering
      const wispOffset = (i - 1) * size * BILLOW_CONFIG.WISP_OFFSET;
      const wispX = x + Math.sin(driftOffset + i * 1.5) * wispOffset;
      const wispY = y + Math.cos(driftOffset + i * 1.2) * wispOffset * 0.5;

      // Each wisp has slightly different size and opacity
      const wispSize = size * (0.8 + i * 0.1);
      const wispOpacity = opacity * (0.7 + i * 0.1);

      // Draw soft, diffuse circle
      const gradient = ctx.createRadialGradient(wispX, wispY, 0, wispX, wispY, wispSize);
      gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${wispOpacity})`);
      gradient.addColorStop(0.4, `rgba(${color.r}, ${color.g}, ${color.b}, ${wispOpacity * 0.4})`);
      gradient.addColorStop(0.7, `rgba(${color.r}, ${color.g}, ${color.b}, ${wispOpacity * 0.15})`);
      gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);

      ctx.fillStyle = gradient;
      ctx.fillRect(wispX - wispSize, wispY - wispSize, wispSize * 2, wispSize * 2);
    }
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

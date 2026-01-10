/**
 * EmberSystem - Rising glowing ember particles (Runes-based for HMR)
 *
 * Creates warm atmosphere with embers that rise, flicker, and glow.
 * Supports heat intensity (affects colors, speed, glow) and density multipliers.
 *
 * Converted to .svelte.ts for Vite HMR support - edits to this file
 * will hot-reload without full page refresh.
 */
import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import type { Ember } from "../domain/models/ember-models";
import {
  EMBER_PHYSICS,
  EMBER_SIZE,
  EMBER_OPACITY,
  EMBER_COLORS,
  EMBER_GRADIENT,
  EMBER_BOUNDS,
  HEAT_INTENSITY_CONFIGS,
  type HeatIntensity,
} from "../domain/constants/ember-constants";

// ============================================================================
// REACTIVE STATE (HMR-preserved via Svelte 5 runes)
// ============================================================================

let particles = $state<Ember[]>([]);
let motionMultiplier = $state<number>(1.0);
let heatIntensity = $state<HeatIntensity>("warm");
let densityMultiplier = $state<number>(1.0);
let targetCount = $state<number>(0);
let flickerEnabled = $state<boolean>(true);
let flickerSpeed = $state<number>(EMBER_PHYSICS.FLICKER_SPEED);

// ============================================================================
// DERIVED VALUES (exported as getters per Svelte rules)
// ============================================================================

// Note: Cannot export $derived directly from modules, use getCount() instead

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/**
 * Get color based on heat intensity shift
 * 0 = cooler (more red/orange), 1 = hotter (more yellow/white)
 */
function getColorForHeat(colorShift: number): { r: number; g: number; b: number } {
  const colorVariant = Math.random();
  const adjustedVariant = colorVariant * (1 - colorShift * 0.5);

  let r: number, g: number, b: number;

  if (adjustedVariant < EMBER_COLORS.ORANGE_RED.probability * (1 - colorShift)) {
    r = EMBER_COLORS.ORANGE_RED.r;
    g =
      EMBER_COLORS.ORANGE_RED.gMin +
      Math.floor(
        Math.random() * (EMBER_COLORS.ORANGE_RED.gMax - EMBER_COLORS.ORANGE_RED.gMin)
      );
    b =
      EMBER_COLORS.ORANGE_RED.bMin +
      Math.floor(
        Math.random() * (EMBER_COLORS.ORANGE_RED.bMax - EMBER_COLORS.ORANGE_RED.bMin)
      );
  } else if (adjustedVariant < EMBER_COLORS.AMBER.probability * (1 - colorShift * 0.3)) {
    r = EMBER_COLORS.AMBER.r;
    g =
      EMBER_COLORS.AMBER.gMin +
      Math.floor(Math.random() * (EMBER_COLORS.AMBER.gMax - EMBER_COLORS.AMBER.gMin));
    b =
      EMBER_COLORS.AMBER.bMin +
      Math.floor(Math.random() * (EMBER_COLORS.AMBER.bMax - EMBER_COLORS.AMBER.bMin));
  } else {
    r = EMBER_COLORS.WHITE_HOT.r;
    g =
      EMBER_COLORS.WHITE_HOT.gMin +
      Math.floor(
        Math.random() * (EMBER_COLORS.WHITE_HOT.gMax - EMBER_COLORS.WHITE_HOT.gMin)
      );
    b =
      EMBER_COLORS.WHITE_HOT.bMin +
      Math.floor(
        Math.random() * (EMBER_COLORS.WHITE_HOT.bMax - EMBER_COLORS.WHITE_HOT.bMin)
      );
  }

  // Shift green channel up for hotter colors
  g = Math.min(255, Math.floor(g + colorShift * 40));

  return { r, g, b };
}

/**
 * Create an ember particle at a specific Y position
 */
function createParticle(dimensions: Dimensions, y?: number): Ember {
  const x = Math.random() * dimensions.width;
  const actualY = y ?? dimensions.height + EMBER_BOUNDS.RESPAWN_BUFFER;

  const size = EMBER_SIZE.MIN + Math.random() * EMBER_SIZE.RANGE;
  const heatConfig = HEAT_INTENSITY_CONFIGS[heatIntensity];

  // Rising speed - slower for larger embers, modified by heat
  const baseSpeed =
    EMBER_PHYSICS.RISING_SPEED_BASE +
    Math.random() * EMBER_PHYSICS.RISING_SPEED_RANGE;
  const vy = -(baseSpeed * heatConfig.speedMultiplier * (1 / size));

  // Gentle horizontal drift
  const vx = (Math.random() - 0.5) * EMBER_PHYSICS.DRIFT_AMPLITUDE;

  // Color based on heat intensity
  const color = getColorForHeat(heatConfig.colorShift);

  // Glow radius modified by heat
  const glowRadius = size * EMBER_PHYSICS.GLOW_MULTIPLIER * heatConfig.glowMultiplier;

  return {
    x,
    y: actualY,
    size,
    vx,
    vy,
    opacity: EMBER_OPACITY.MIN + Math.random() * EMBER_OPACITY.RANGE,
    glowRadius,
    flickerOffset: Math.random() * Math.PI * 2,
    color,
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Initialize embers with stratified vertical distribution
 */
export function initialize(dimensions: Dimensions, count: number): void {
  particles = [];
  targetCount = Math.floor(count * densityMultiplier);

  if (targetCount <= 0) return;

  // Stratified sampling for even vertical distribution
  const bandHeight = dimensions.height / targetCount;

  for (let i = 0; i < targetCount; i++) {
    const bandStart = i * bandHeight;
    const stratifiedY = bandStart + Math.random() * bandHeight;
    particles.push(createParticle(dimensions, stratifiedY));
  }
}

/**
 * Update ember particles
 */
export function update(dimensions: Dimensions, frameMultiplier: number): void {
  const effectiveMultiplier = frameMultiplier * motionMultiplier;

  particles = particles.map((particle) => {
    let newX = particle.x + particle.vx * effectiveMultiplier;
    const newY = particle.y + particle.vy * effectiveMultiplier;

    // Flicker animation
    let newOpacity = particle.opacity;
    let newFlickerOffset = particle.flickerOffset;

    if (flickerEnabled) {
      newFlickerOffset = particle.flickerOffset + flickerSpeed * effectiveMultiplier;
      const flickerFactor =
        EMBER_PHYSICS.FLICKER_BASE +
        Math.sin(newFlickerOffset) * EMBER_PHYSICS.FLICKER_AMPLITUDE;
      newOpacity = Math.max(
        EMBER_PHYSICS.FLICKER_MIN_OPACITY,
        particle.opacity * flickerFactor
      );
    }

    // Respawn if risen above viewport
    if (newY < -EMBER_BOUNDS.RESPAWN_BUFFER) {
      return createParticle(dimensions);
    }

    // Wrap horizontally
    if (newX < -EMBER_BOUNDS.RESPAWN_BUFFER) {
      newX = dimensions.width + EMBER_BOUNDS.RESPAWN_BUFFER;
    } else if (newX > dimensions.width + EMBER_BOUNDS.RESPAWN_BUFFER) {
      newX = -EMBER_BOUNDS.RESPAWN_BUFFER;
    }

    return {
      ...particle,
      x: newX,
      y: newY,
      opacity: newOpacity,
      flickerOffset: newFlickerOffset,
    };
  });
}

/**
 * Draw ember particles with glow effect
 */
export function draw(ctx: CanvasRenderingContext2D, _dimensions: Dimensions): void {
  for (const particle of particles) {
    const { x, y, size, opacity, glowRadius, color } = particle;

    // Skip invalid particles
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(glowRadius) ||
      glowRadius <= 0
    ) {
      continue;
    }

    // Draw glow
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
    gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`);
    gradient.addColorStop(
      EMBER_GRADIENT.INNER_STOP,
      `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * EMBER_GRADIENT.INNER_OPACITY})`
    );
    gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);

    ctx.fillStyle = gradient;
    ctx.fillRect(x - glowRadius, y - glowRadius, glowRadius * 2, glowRadius * 2);

    // Draw solid core
    ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * EMBER_OPACITY.CORE_MULTIPLIER})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Set motion multiplier for accessibility (reduced motion)
 */
export function setMotionMultiplier(multiplier: number): void {
  motionMultiplier = multiplier;
}

/**
 * Set heat intensity (affects color, speed, glow)
 */
export function setHeatIntensity(intensity: HeatIntensity): void {
  heatIntensity = intensity;
}

/**
 * Set density multiplier
 */
export function setDensityMultiplier(multiplier: number): void {
  densityMultiplier = multiplier;
}

/**
 * Configure flicker animation
 */
export function setFlicker(enabled: boolean, speed: number = EMBER_PHYSICS.FLICKER_SPEED): void {
  flickerEnabled = enabled;
  flickerSpeed = speed;
}

/**
 * Get particle count for stats
 */
export function getCount(): number {
  return particles.length;
}

/**
 * Adjust particle count (for quality changes)
 */
export function setCount(dimensions: Dimensions, count: number): void {
  targetCount = Math.floor(count * densityMultiplier);

  if (particles.length < targetCount) {
    // Add more particles
    while (particles.length < targetCount) {
      const randomY = Math.random() * dimensions.height;
      particles = [...particles, createParticle(dimensions, randomY)];
    }
  } else if (particles.length > targetCount) {
    // Remove excess
    particles = particles.slice(0, targetCount);
  }
}

/**
 * Handle resize
 */
export function handleResize(oldDimensions: Dimensions, newDimensions: Dimensions): void {
  const scaleX = newDimensions.width / oldDimensions.width;
  const scaleY = newDimensions.height / oldDimensions.height;

  particles = particles.map((particle) => ({
    ...particle,
    x: particle.x * scaleX,
    y: particle.y * scaleY,
  }));
}

/**
 * Cleanup
 */
export function cleanup(): void {
  particles = [];
  targetCount = 0;
}

/**
 * Create a new instance-like object for compatibility with class-based consumers
 * This allows gradual migration - consumers can use either the module functions
 * directly or create an "instance" that wraps them.
 */
export function createInstance() {
  return {
    initialize,
    update,
    draw,
    setMotionMultiplier,
    setHeatIntensity,
    setDensityMultiplier,
    setFlicker,
    getCount,
    setCount,
    handleResize,
    cleanup,
  };
}

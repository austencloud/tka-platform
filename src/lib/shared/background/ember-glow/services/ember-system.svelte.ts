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
import type { Ember, EmberType } from "../domain/models/ember-models";
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
// EMBER TYPE CONFIGURATION (A+ Enhancement)
// ============================================================================

/** Distribution of ember types - size variety only, no weird motion */
const EMBER_TYPE_DISTRIBUTION = {
  normal: 0.75,   // 75% - Standard embers
  spiral: 0,      // Disabled - looked unrealistic
  micro: 0.15,    // 15% - Tiny embers
  lazy: 0.10,     // 10% - Large, slow embers
} as const;

/** Type-specific behavior modifiers - no horizontal drift */
const EMBER_TYPE_CONFIG = {
  normal: {
    sizeMultiplier: 1.0,
    speedMultiplier: 1.0,
    driftMultiplier: 0, // No side-to-side
    deceleration: 0.9995,
  },
  spiral: {
    sizeMultiplier: 1.0,
    speedMultiplier: 1.0,
    driftMultiplier: 0,
    angularVelocity: { min: 0, range: 0 }, // Disabled
    spiralRadius: { min: 0, range: 0 },
    deceleration: 0.9995,
  },
  micro: {
    sizeMultiplier: 0.4,
    speedMultiplier: 1.2,
    driftMultiplier: 0, // No side-to-side
    deceleration: 0.999,
  },
  lazy: {
    sizeMultiplier: 1.8,
    speedMultiplier: 0.4,
    driftMultiplier: 0, // No side-to-side
    deceleration: 0.9998,
  },
} as const;

// ============================================================================
// PHOENIX EASTER EGG CONFIGURATION (A+ Enhancement)
// ============================================================================

const PHOENIX_CONFIG = {
  /** Chance of phoenix ember spawning (0.002 = 0.2% = 1 in 500) */
  SPAWN_CHANCE: 0.002,
  /** Phoenix size multiplier (larger than normal) */
  SIZE_MULTIPLIER: 1.8,
  /** Phoenix glow multiplier (brighter) */
  GLOW_MULTIPLIER: 2.5,
  /** Phoenix color (white-hot core) */
  COLOR: { r: 255, g: 250, b: 220 },
  /** Phoenix sparkle burst on death */
  DEATH_SPARK_COUNT: { min: 3, max: 5 },
  /** Phoenix rises slower (more majestic) */
  SPEED_MULTIPLIER: 0.6,
} as const;

/** Callback for phoenix death events (spawns falling sparks) */
let phoenixDeathCallback: ((x: number, y: number) => void) | null = null;

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
 * Select ember type based on probability distribution
 */
function selectEmberType(): EmberType {
  const roll = Math.random();
  let cumulative = 0;

  for (const [type, probability] of Object.entries(EMBER_TYPE_DISTRIBUTION)) {
    cumulative += probability;
    if (roll < cumulative) {
      return type as EmberType;
    }
  }

  return "normal"; // Fallback
}

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
 * Create an ember particle at a specific Y position with type-specific behavior
 */
function createParticle(dimensions: Dimensions, y?: number): Ember {
  const emberType = selectEmberType();
  const typeConfig = EMBER_TYPE_CONFIG[emberType];

  // Spawn position - center-biased for lazy, wider spread for micro
  let x: number;
  if (emberType === "lazy") {
    // Lazy embers spawn more toward center
    x = dimensions.width / 2 + (Math.random() - 0.5) * dimensions.width * 0.6;
  } else if (emberType === "micro") {
    // Micro embers spawn from coal bed area (center-bottom)
    x = dimensions.width / 2 + (Math.random() - 0.5) * dimensions.width * 0.4;
  } else {
    x = Math.random() * dimensions.width;
  }

  const actualY = y ?? dimensions.height + EMBER_BOUNDS.RESPAWN_BUFFER;

  // Size modified by type
  const baseSize = EMBER_SIZE.MIN + Math.random() * EMBER_SIZE.RANGE;
  const size = baseSize * typeConfig.sizeMultiplier;

  const heatConfig = HEAT_INTENSITY_CONFIGS[heatIntensity];

  // Rising speed - modified by type and heat
  const baseSpeed =
    EMBER_PHYSICS.RISING_SPEED_BASE +
    Math.random() * EMBER_PHYSICS.RISING_SPEED_RANGE;
  const vy = -(baseSpeed * heatConfig.speedMultiplier * typeConfig.speedMultiplier * (1 / Math.max(1, size)));

  // Horizontal drift - modified by type
  const vx = (Math.random() - 0.5) * EMBER_PHYSICS.DRIFT_AMPLITUDE * typeConfig.driftMultiplier;

  // Color based on heat intensity
  const color = getColorForHeat(heatConfig.colorShift);

  // Glow radius modified by heat
  const glowRadius = size * EMBER_PHYSICS.GLOW_MULTIPLIER * heatConfig.glowMultiplier;

  // Base ember properties
  const ember: Ember = {
    x,
    y: actualY,
    size,
    vx,
    vy,
    opacity: EMBER_OPACITY.MIN + Math.random() * EMBER_OPACITY.RANGE,
    glowRadius,
    flickerOffset: Math.random() * Math.PI * 2,
    color,
    emberType,
  };

  // Add spiral-specific properties
  if (emberType === "spiral") {
    const spiralConfig = EMBER_TYPE_CONFIG.spiral;
    ember.angularVelocity = spiralConfig.angularVelocity.min + Math.random() * spiralConfig.angularVelocity.range;
    ember.spiralRadius = spiralConfig.spiralRadius.min + Math.random() * spiralConfig.spiralRadius.range;
    ember.spiralPhase = Math.random() * Math.PI * 2;
  }

  // Phoenix easter egg - very rare special ember
  if (Math.random() < PHOENIX_CONFIG.SPAWN_CHANCE) {
    ember.isPhoenix = true;
    ember.size *= PHOENIX_CONFIG.SIZE_MULTIPLIER;
    ember.glowRadius *= PHOENIX_CONFIG.GLOW_MULTIPLIER;
    ember.vy *= PHOENIX_CONFIG.SPEED_MULTIPLIER; // Slower rise (more majestic)
    ember.color = { ...PHOENIX_CONFIG.COLOR };
  }

  return ember;
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
 * Update ember particles with type-specific motion
 */
export function update(dimensions: Dimensions, frameMultiplier: number): void {
  const effectiveMultiplier = frameMultiplier * motionMultiplier;

  particles = particles.map((particle) => {
    const typeConfig = EMBER_TYPE_CONFIG[particle.emberType];

    // Apply deceleration (embers slow as they cool/rise)
    const decelerationFactor = Math.pow(typeConfig.deceleration, effectiveMultiplier);
    let newVy = particle.vy * decelerationFactor;
    let newVx = particle.vx * decelerationFactor;

    // Base position update
    let newX = particle.x + newVx * effectiveMultiplier;
    let newY = particle.y + newVy * effectiveMultiplier;

    // Spiral motion (for spiral embers)
    let newSpiralPhase = particle.spiralPhase;
    if (particle.emberType === "spiral" && particle.spiralPhase !== undefined) {
      newSpiralPhase = particle.spiralPhase + (particle.angularVelocity ?? 0) * effectiveMultiplier;

      // Add spiral offset to position
      const spiralRadius = particle.spiralRadius ?? 20;
      const spiralOffset = Math.sin(newSpiralPhase) * spiralRadius * 0.1;
      newX += spiralOffset * effectiveMultiplier;
    }

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
      // Phoenix death burst - trigger callback before respawning
      if (particle.isPhoenix && phoenixDeathCallback) {
        phoenixDeathCallback(particle.x, 0); // Burst at top of screen
      }
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
      vx: newVx,
      vy: newVy,
      opacity: newOpacity,
      flickerOffset: newFlickerOffset,
      spiralPhase: newSpiralPhase,
    };
  });
}

/**
 * Draw ember particles with glow effect
 * Phoenix embers get enhanced rendering with extra glow and trail
 */
export function draw(ctx: CanvasRenderingContext2D, _dimensions: Dimensions): void {
  for (const particle of particles) {
    const { x, y, size, opacity, glowRadius, color, isPhoenix } = particle;

    // Skip invalid particles
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(glowRadius) ||
      glowRadius <= 0
    ) {
      continue;
    }

    // Phoenix embers get special enhanced rendering
    if (isPhoenix) {
      // Draw a subtle trail below the phoenix
      const trailLength = 40;
      const trailGradient = ctx.createLinearGradient(x, y, x, y + trailLength);
      trailGradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * 0.5})`);
      trailGradient.addColorStop(0.5, `rgba(255, 180, 80, ${opacity * 0.2})`);
      trailGradient.addColorStop(1, `rgba(255, 100, 30, 0)`);

      ctx.fillStyle = trailGradient;
      ctx.beginPath();
      ctx.moveTo(x - size * 1.5, y);
      ctx.quadraticCurveTo(x, y + trailLength * 0.3, x + size * 1.5, y);
      ctx.lineTo(x + size * 0.3, y + trailLength);
      ctx.lineTo(x - size * 0.3, y + trailLength);
      ctx.closePath();
      ctx.fill();

      // Outer glow (larger, more intense)
      const outerGlowRadius = glowRadius * 1.5;
      const outerGlow = ctx.createRadialGradient(x, y, 0, x, y, outerGlowRadius);
      outerGlow.addColorStop(0, `rgba(255, 255, 255, ${opacity * 0.6})`);
      outerGlow.addColorStop(0.2, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * 0.4})`);
      outerGlow.addColorStop(0.5, `rgba(255, 180, 80, ${opacity * 0.2})`);
      outerGlow.addColorStop(1, `rgba(255, 100, 30, 0)`);

      ctx.fillStyle = outerGlow;
      ctx.fillRect(x - outerGlowRadius, y - outerGlowRadius, outerGlowRadius * 2, outerGlowRadius * 2);

      // White-hot core
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
      ctx.beginPath();
      ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
      ctx.fill();

      // Colored corona
      ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * 0.8})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Normal ember rendering
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
 * Set callback for phoenix death events
 * Called when a phoenix ember reaches the top of the screen
 */
export function setPhoenixDeathCallback(callback: ((x: number, y: number) => void) | null): void {
  phoenixDeathCallback = callback;
}

/**
 * Get count of active phoenix embers (for stats/debugging)
 */
export function getPhoenixCount(): number {
  return particles.filter(p => p.isPhoenix).length;
}

/**
 * Cleanup
 */
export function cleanup(): void {
  particles = [];
  targetCount = 0;
  phoenixDeathCallback = null;
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
    setPhoenixDeathCallback,
    getPhoenixCount,
    cleanup,
  };
}

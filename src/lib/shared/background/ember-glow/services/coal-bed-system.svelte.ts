/**
 * CoalBedSystem - Glowing heat source at bottom (A+ Enhancement)
 *
 * Creates a visible bed of glowing coals that:
 * - Pulse with offset phases (not synchronized)
 * - Randomly flare as hotspots
 * - Provide grounding for the scene (particles come FROM here)
 * - Sync with scene breathing for cohesive feel
 *
 * Converted to .svelte.ts for Vite HMR support.
 */
import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import type { Coal } from "../domain/models/ember-models";
import { COAL_CONFIG, COAL_COUNTS } from "../domain/constants/ember-constants";
import type { QualityLevel } from "$lib/shared/background/shared/domain/types/background-types";

// ============================================================================
// REACTIVE STATE (HMR-preserved via Svelte 5 runes)
// ============================================================================

let coals = $state<Coal[]>([]);
let motionMultiplier = $state<number>(1.0);
let breathingMult = $state<number>(1.0);

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/**
 * Create a coal at a specific position
 */
function createCoal(x: number, y: number): Coal {
  const size = COAL_CONFIG.SIZE_MIN + Math.random() * COAL_CONFIG.SIZE_RANGE;
  const baseIntensity = COAL_CONFIG.INTENSITY_MIN + Math.random() * COAL_CONFIG.INTENSITY_RANGE;

  // Interpolate color based on intensity
  const t = baseIntensity;
  const color = {
    r: Math.floor(COAL_CONFIG.COLOR_COOL.r + (COAL_CONFIG.COLOR_HOT.r - COAL_CONFIG.COLOR_COOL.r) * t),
    g: Math.floor(COAL_CONFIG.COLOR_COOL.g + (COAL_CONFIG.COLOR_HOT.g - COAL_CONFIG.COLOR_COOL.g) * t),
    b: Math.floor(COAL_CONFIG.COLOR_COOL.b + (COAL_CONFIG.COLOR_HOT.b - COAL_CONFIG.COLOR_COOL.b) * t),
  };

  return {
    x,
    y,
    size,
    glowRadius: size * COAL_CONFIG.GLOW_MULTIPLIER,
    pulsePhase: Math.random() * Math.PI * 2, // Random start phase
    pulseSpeed: COAL_CONFIG.PULSE_SPEED_MIN + Math.random() * COAL_CONFIG.PULSE_SPEED_RANGE,
    baseIntensity,
    currentIntensity: baseIntensity,
    isFlaring: false,
    flareTimer: 0,
    color,
  };
}

/**
 * Lerp between two colors
 */
function lerpColor(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  t: number
): { r: number; g: number; b: number } {
  return {
    r: Math.floor(a.r + (b.r - a.r) * t),
    g: Math.floor(a.g + (b.g - a.g) * t),
    b: Math.floor(a.b + (b.b - a.b) * t),
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Initialize coal bed
 */
export function initialize(dimensions: Dimensions, quality: QualityLevel): void {
  const count = COAL_COUNTS[quality] ?? COAL_COUNTS.medium;
  const newCoals: Coal[] = [];

  // Distribute coals across bottom zone
  const bottomY = dimensions.height * (1 - COAL_CONFIG.BOTTOM_ZONE);
  const zoneHeight = dimensions.height * COAL_CONFIG.BOTTOM_ZONE;

  for (let i = 0; i < count; i++) {
    // Spread horizontally with some clustering in center
    const centerBias = Math.random() * Math.random(); // Bias toward center
    const xOffset = (Math.random() - 0.5) * 2;
    const x = dimensions.width / 2 + xOffset * dimensions.width * 0.4 * (1 - centerBias * 0.5);

    // Vertical position within bottom zone
    const y = bottomY + Math.random() * zoneHeight;

    newCoals.push(createCoal(x, y));
  }

  coals = newCoals;
}

/**
 * Update coal bed - pulse and flare
 */
export function update(_dimensions: Dimensions, frameMultiplier: number): void {
  const effectiveMultiplier = frameMultiplier * motionMultiplier;

  coals = coals.map((coal) => {
    // Advance pulse phase
    const newPulsePhase = coal.pulsePhase + coal.pulseSpeed * effectiveMultiplier;

    // Calculate pulsing intensity
    const pulseEffect = Math.sin(newPulsePhase) * COAL_CONFIG.PULSE_AMPLITUDE;
    let newIntensity = coal.baseIntensity * (1 + pulseEffect);

    // Apply breathing multiplier
    newIntensity *= breathingMult;

    // Handle flare state
    let newIsFlaring = coal.isFlaring;
    let newFlareTimer = coal.flareTimer;

    if (coal.isFlaring) {
      // Count down flare
      newFlareTimer -= effectiveMultiplier;
      if (newFlareTimer <= 0) {
        newIsFlaring = false;
        newFlareTimer = 0;
      } else {
        // Boost intensity during flare
        newIntensity += COAL_CONFIG.FLARE_INTENSITY_BOOST;
      }
    } else {
      // Random chance to start flare
      if (Math.random() < COAL_CONFIG.FLARE_CHANCE * effectiveMultiplier) {
        newIsFlaring = true;
        newFlareTimer =
          COAL_CONFIG.FLARE_DURATION_MIN + Math.random() * COAL_CONFIG.FLARE_DURATION_RANGE;
      }
    }

    // Clamp intensity
    newIntensity = Math.min(1.4, Math.max(0.3, newIntensity));

    // Update color based on current intensity
    const colorT = Math.min(1, (newIntensity - 0.3) / 0.7);
    const baseColor = lerpColor(COAL_CONFIG.COLOR_COOL, COAL_CONFIG.COLOR_HOT, colorT);
    const newColor = newIsFlaring
      ? lerpColor(baseColor, COAL_CONFIG.COLOR_FLARE, 0.5)
      : baseColor;

    return {
      ...coal,
      pulsePhase: newPulsePhase,
      currentIntensity: newIntensity,
      isFlaring: newIsFlaring,
      flareTimer: newFlareTimer,
      color: newColor,
    };
  });
}

/**
 * Draw coal bed
 */
export function draw(ctx: CanvasRenderingContext2D, _dimensions: Dimensions): void {
  for (const coal of coals) {
    const { x, y, size, glowRadius, currentIntensity, color, isFlaring } = coal;

    // Skip invalid coals
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    const effectiveGlow = glowRadius * (isFlaring ? 1.3 : 1);

    // Draw outer glow
    const outerGradient = ctx.createRadialGradient(x, y, 0, x, y, effectiveGlow);
    outerGradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${currentIntensity * 0.8})`);
    outerGradient.addColorStop(0.3, `rgba(${color.r}, ${color.g}, ${color.b}, ${currentIntensity * 0.4})`);
    outerGradient.addColorStop(0.6, `rgba(${color.r}, ${color.g}, ${color.b}, ${currentIntensity * 0.15})`);
    outerGradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);

    ctx.fillStyle = outerGradient;
    ctx.fillRect(x - effectiveGlow, y - effectiveGlow, effectiveGlow * 2, effectiveGlow * 2);

    // Draw core (brighter center)
    const coreGradient = ctx.createRadialGradient(x, y, 0, x, y, size);
    const coreColor = isFlaring ? COAL_CONFIG.COLOR_FLARE : color;
    coreGradient.addColorStop(0, `rgba(${coreColor.r}, ${coreColor.g}, ${coreColor.b}, ${currentIntensity})`);
    coreGradient.addColorStop(0.5, `rgba(${color.r}, ${color.g}, ${color.b}, ${currentIntensity * 0.7})`);
    coreGradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);

    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
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
 * Set breathing multiplier (syncs with scene breathing)
 */
export function setBreathingMultiplier(multiplier: number): void {
  breathingMult = multiplier;
}

/**
 * Get a random coal position for spark spawning
 */
export function getRandomCoalPosition(): { x: number; y: number } | null {
  if (coals.length === 0) return null;

  // Prefer flaring coals, but fall back to any coal
  const flaringCoals = coals.filter((c) => c.isFlaring);
  const pool = flaringCoals.length > 0 ? flaringCoals : coals;

  const coal = pool[Math.floor(Math.random() * pool.length)]!;
  return { x: coal.x, y: coal.y };
}

/**
 * Get coal count for stats
 */
export function getCount(): number {
  return coals.length;
}

/**
 * Cleanup
 */
export function cleanup(): void {
  coals = [];
}

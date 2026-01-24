import type { FishMarineLife } from "../../domain/models/DeepOceanModels";
import type { WobbleOffset, FishWobbleType } from "../../domain/types/fish-personality-types";
import type { IFishWobbleAnimator } from "../contracts/IFishWobbleAnimator";

// =============================================================================
// SPRING PHYSICS HELPERS
// =============================================================================

/**
 * Critically damped spring decay - fastest settle without oscillation.
 * From theorangeduck.com/page/spring-roll-call
 *
 * @param t - Time elapsed (seconds)
 * @param halflife - Time for amplitude to decay to 50%
 * @returns Decay multiplier (0-1, starts at 1)
 */
function criticallyDampedDecay(t: number, halflife: number): number {
  const damping = (4 * Math.LN2) / halflife; // LN2 = 0.693...
  const y = damping / 2;
  return Math.exp(-y * t) * (1 + y * t);
}

/**
 * easeOutExpo - Quick initial response, smooth settle.
 * From easings.net
 *
 * @param x - Progress (0-1)
 * @returns Eased value (0-1)
 */
function easeOutExpo(x: number): number {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

// =============================================================================
// ENVELOPE TYPES
// =============================================================================

/**
 * Envelope determines how the wobble intensity decays over time.
 * Different envelopes create different "feels":
 * - linear: Uniform decay, predictable (robotic)
 * - exponential: Fast initial decay, long tail (current default)
 * - critically_damped: Spring physics, fastest settle without bounce
 * - underdamped: Spring with overshoot, more organic
 * - ease_out_expo: Quick response, smooth hold at target
 */
type EnvelopeType = "linear" | "exponential" | "critically_damped" | "underdamped" | "ease_out_expo";

/**
 * Wobble animation configurations by type
 */
const WOBBLE_CONFIGS: Record<
  Exclude<FishWobbleType, "none">,
  {
    duration: number; // Seconds
    rotationAmplitude: number; // Radians
    scaleXAmplitude: number; // 0.1 = 10% stretch
    scaleYAmplitude: number;
    offsetXAmplitude: number; // Pixels
    offsetYAmplitude: number;
    frequency: number; // Oscillations per second
    decay: "linear" | "exponential"; // Legacy field
    // Spring physics parameters (new)
    envelope: EnvelopeType;
    halflife?: number; // For critically_damped/underdamped
    overshoot?: number; // For underdamped (0.2 = 20% overshoot)
  }
> = {
  curious_tilt: {
    duration: 0.6,
    rotationAmplitude: 0.15, // ~8 degrees
    scaleXAmplitude: 0,
    scaleYAmplitude: 0.05,
    offsetXAmplitude: 0,
    offsetYAmplitude: -3, // Rise up slightly
    frequency: 1.5,
    decay: "linear",
    envelope: "ease_out_expo", // Quick response, holds the curious pose
  },
  startled_dart: {
    duration: 0.3,
    rotationAmplitude: 0.1,
    scaleXAmplitude: 0.08, // Stretch horizontally (backward)
    scaleYAmplitude: -0.05, // Compress vertically
    offsetXAmplitude: -5, // Jerk backward
    offsetYAmplitude: 2,
    frequency: 4,
    decay: "exponential",
    envelope: "critically_damped", // Spring physics, fastest settle
    halflife: 0.15, // Fast recovery from startle
  },
  playful_wiggle: {
    duration: 0.8,
    rotationAmplitude: 0.2, // More rotation
    scaleXAmplitude: 0.03,
    scaleYAmplitude: 0.03,
    offsetXAmplitude: 3, // Side to side
    offsetYAmplitude: 2,
    frequency: 6,
    decay: "linear",
    envelope: "underdamped", // Allows overshoot for playfulness
    halflife: 0.3,
    overshoot: 0.2, // 20% overshoot for bouncy feel
  },
  tired_drift: {
    duration: 1.2,
    rotationAmplitude: 0.08, // Slight droop
    scaleXAmplitude: 0,
    scaleYAmplitude: -0.03, // Slightly compressed
    offsetXAmplitude: 0,
    offsetYAmplitude: 4, // Sink down
    frequency: 0.5,
    decay: "linear",
    envelope: "linear", // Slow, predictable fade for tired feeling
  },
  feeding_lunge: {
    duration: 0.4,
    rotationAmplitude: 0.05,
    scaleXAmplitude: 0.1, // Stretch forward
    scaleYAmplitude: -0.05,
    offsetXAmplitude: 8, // Lunge forward
    offsetYAmplitude: 0,
    frequency: 2,
    decay: "exponential",
    envelope: "critically_damped", // Sharp attack, clean settle
    halflife: 0.12,
  },
  social_shimmer: {
    duration: 0.7,
    rotationAmplitude: 0.05,
    scaleXAmplitude: 0.02,
    scaleYAmplitude: 0.04, // Puff up slightly
    offsetXAmplitude: 1,
    offsetYAmplitude: 1,
    frequency: 8, // Fast shimmer
    decay: "linear",
    envelope: "underdamped", // Gentle oscillation for social display
    halflife: 0.4,
    overshoot: 0.1,
  },
  // Rare special behaviors
  barrel_roll: {
    duration: 0.8,
    rotationAmplitude: Math.PI, // Full 180° each way = 360° total
    scaleXAmplitude: 0.05,
    scaleYAmplitude: 0.05,
    offsetXAmplitude: 0,
    offsetYAmplitude: 5, // Slight lift during roll
    frequency: 1.25, // One full rotation
    decay: "linear",
    envelope: "linear", // Consistent through the roll
  },
  freeze: {
    duration: 0.6,
    rotationAmplitude: 0, // No movement
    scaleXAmplitude: 0,
    scaleYAmplitude: 0,
    offsetXAmplitude: 0,
    offsetYAmplitude: 0,
    frequency: 0,
    decay: "linear",
    envelope: "linear",
  },
  double_take: {
    duration: 0.5,
    rotationAmplitude: 0.4, // Strong head turn
    scaleXAmplitude: 0.03,
    scaleYAmplitude: 0,
    offsetXAmplitude: -4, // Slight backward motion
    offsetYAmplitude: 0,
    frequency: 2, // Quick back-and-forth
    decay: "exponential",
    envelope: "critically_damped", // Sharp snap, clean settle
    halflife: 0.1,
  },
  happy_flip: {
    duration: 0.6,
    rotationAmplitude: 0.5, // Upward tilt
    scaleXAmplitude: 0.08,
    scaleYAmplitude: 0.08,
    offsetXAmplitude: 3,
    offsetYAmplitude: -12, // Strong upward pop
    frequency: 1.5,
    decay: "exponential",
    envelope: "underdamped", // Bouncy, joyful overshoot
    halflife: 0.2,
    overshoot: 0.25,
  },
  sync_pulse: {
    duration: 0.4,
    rotationAmplitude: 0.02,
    scaleXAmplitude: 0.06, // Brief expansion
    scaleYAmplitude: 0.06,
    offsetXAmplitude: 0,
    offsetYAmplitude: 0,
    frequency: 3,
    decay: "exponential",
    envelope: "ease_out_expo", // Quick pulse, smooth fade
  },
};

/**
 * FishWobbleAnimator - Produces expressive wobble animations
 *
 * Each wobble type creates a unique visual expression through
 * rotation, scale, and position offsets that decay over time.
 */
export class FishWobbleAnimator implements IFishWobbleAnimator {
  updateWobble(fish: FishMarineLife, deltaSeconds: number): void {
    if (!fish.wobbleTimer || fish.wobbleTimer <= 0) {
      fish.wobbleType = "none";
      fish.wobbleIntensity = 0;
      return;
    }

    // Decay timer
    fish.wobbleTimer -= deltaSeconds;

    // Decay intensity based on wobble type
    const wobbleType = fish.wobbleType;
    if (wobbleType && wobbleType !== "none") {
      const config = WOBBLE_CONFIGS[wobbleType];
      if (config.decay === "exponential") {
        // Fast initial decay, slows down
        fish.wobbleIntensity = (fish.wobbleIntensity ?? 1) * (1 - deltaSeconds * 3);
      } else {
        // Linear decay
        fish.wobbleIntensity = Math.max(0, fish.wobbleTimer / config.duration);
      }
    }

    // Clear when done
    if (fish.wobbleTimer <= 0) {
      fish.wobbleType = "none";
      fish.wobbleIntensity = 0;
      fish.wobbleTimer = 0;
    }
  }

  getWobbleOffset(fish: FishMarineLife): WobbleOffset {
    const noOffset: WobbleOffset = {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      offsetX: 0,
      offsetY: 0,
    };

    const wobbleType = fish.wobbleType;
    if (!wobbleType || wobbleType === "none" || !fish.wobbleTimer) {
      return noOffset;
    }

    const config = WOBBLE_CONFIGS[wobbleType];
    const timeInWobble = config.duration - fish.wobbleTimer;
    const progress = timeInWobble / config.duration; // 0 to 1
    const phase = timeInWobble * config.frequency * Math.PI * 2;

    // Calculate envelope based on type - this replaces the simple intensity decay
    let envelope: number;
    switch (config.envelope) {
      case "critically_damped":
        // Spring physics - fastest settle without oscillation
        envelope = criticallyDampedDecay(timeInWobble, config.halflife ?? 0.2);
        break;

      case "underdamped":
        // Spring with overshoot for bouncy, organic feel
        const decay = criticallyDampedDecay(timeInWobble, config.halflife ?? 0.3);
        // Add overshoot oscillation that fades with progress
        const overshootAmount = config.overshoot ?? 0.15;
        const overshoot = Math.sin(timeInWobble * 8) * overshootAmount * (1 - progress);
        envelope = Math.max(0, decay + overshoot);
        break;

      case "ease_out_expo":
        // Quick response, smooth hold - good for curious/attention poses
        envelope = 1 - easeOutExpo(progress);
        break;

      case "exponential":
        // Legacy: fast initial decay with long tail
        envelope = fish.wobbleIntensity ?? Math.pow(1 - progress, 2);
        break;

      case "linear":
      default:
        // Simple linear decay
        envelope = 1 - progress;
        break;
    }

    // Direction-aware offsets (fish swimming left should jerk in opposite direction)
    const dir = fish.direction ?? 1;

    // Calculate each offset component with oscillation and envelope
    const rotation =
      Math.sin(phase) * config.rotationAmplitude * envelope * dir;

    const scaleX =
      1 + Math.sin(phase) * config.scaleXAmplitude * envelope;

    const scaleY =
      1 + Math.cos(phase * 0.7) * config.scaleYAmplitude * envelope;

    const offsetX =
      Math.sin(phase) * config.offsetXAmplitude * envelope * dir;

    const offsetY =
      Math.sin(phase * 1.3) * config.offsetYAmplitude * envelope;

    return {
      rotation,
      scaleX,
      scaleY,
      offsetX,
      offsetY,
    };
  }

  triggerWobble(
    fish: FishMarineLife,
    wobbleType: FishMarineLife["wobbleType"],
    intensity: number = 1
  ): void {
    if (!wobbleType || wobbleType === "none") {
      return;
    }

    const config = WOBBLE_CONFIGS[wobbleType];
    fish.wobbleType = wobbleType;
    fish.wobbleTimer = config.duration;
    fish.wobbleIntensity = Math.min(1, Math.max(0, intensity));
  }

  isWobbling(fish: FishMarineLife): boolean {
    return (
      !!fish.wobbleType &&
      fish.wobbleType !== "none" &&
      (fish.wobbleTimer ?? 0) > 0
    );
  }
}

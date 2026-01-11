import type { FishMarineLife } from "../../domain/models/DeepOceanModels";
import type { WobbleOffset, FishWobbleType } from "../../domain/types/fish-personality-types";
import type { IFishWobbleAnimator } from "../contracts/IFishWobbleAnimator";

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
    decay: "linear" | "exponential";
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
    const intensity = fish.wobbleIntensity ?? 0;
    const timeInWobble = config.duration - fish.wobbleTimer;
    const phase = timeInWobble * config.frequency * Math.PI * 2;

    // Direction-aware offsets (fish swimming left should jerk in opposite direction)
    const dir = fish.direction ?? 1;

    // Calculate each offset component with oscillation and intensity decay
    const rotation =
      Math.sin(phase) * config.rotationAmplitude * intensity * dir;

    const scaleX =
      1 + Math.sin(phase) * config.scaleXAmplitude * intensity;

    const scaleY =
      1 + Math.cos(phase * 0.7) * config.scaleYAmplitude * intensity;

    const offsetX =
      Math.sin(phase) * config.offsetXAmplitude * intensity * dir;

    const offsetY =
      Math.sin(phase * 1.3) * config.offsetYAmplitude * intensity;

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

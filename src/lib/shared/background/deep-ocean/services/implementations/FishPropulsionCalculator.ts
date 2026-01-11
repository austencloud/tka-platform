import type { FishMarineLife } from "../../domain/models/DeepOceanModels";
import type { IFishPropulsionCalculator } from "../contracts/IFishPropulsionCalculator";

/**
 * Propulsion configuration constants
 */
const PROPULSION_CONFIG = {
  /**
   * Base thrust coefficient - scales how much tail motion affects speed
   * Higher = more responsive to tail beats
   */
  thrustCoefficient: 0.8,

  /**
   * Minimum thrust multiplier (fish never completely stops from thrust alone)
   */
  minThrustMultiplier: 0.3,

  /**
   * Maximum thrust multiplier (limits top speed boost from vigorous swimming)
   */
  maxThrustMultiplier: 1.6,

  /**
   * How quickly speed responds to thrust changes (0-1, lower = smoother)
   * Prevents jerky speed changes
   */
  speedSmoothing: 0.15,

  /**
   * Amplitude influence - how much tail amplitude affects thrust
   * Larger amplitude = more water displaced = more thrust
   */
  amplitudeInfluence: 0.5,

  /**
   * Frequency influence - how much swim speed affects thrust
   * Faster tail beats = more thrust
   */
  frequencyInfluence: 0.5,
};

/**
 * FishPropulsionCalculator - Derives forward thrust from tail physics
 *
 * Physics model:
 * - Tail position: sin(swimPhase) - oscillates side to side
 * - Tail velocity: cos(swimPhase) - derivative, peaks at center crossing
 * - Thrust: |cos(swimPhase)| - magnitude of velocity generates thrust
 *
 * This creates realistic behavior:
 * - Fish accelerate as tail crosses center (fastest sweep)
 * - Fish coast slightly at extremes (tail reversing direction)
 * - Speed varies naturally with swimming intensity
 */
export class FishPropulsionCalculator implements IFishPropulsionCalculator {
  calculateThrust(fish: FishMarineLife): number {
    // Must have spine chain data for propulsion
    if (!fish.useSpineChain || fish.swimPhase === undefined) {
      return 1.0; // Legacy fish: constant thrust
    }

    const swimPhase = fish.swimPhase;
    const swimSpeed = fish.swimSpeed ?? 0.08;
    const tailAmplitude = fish.tailAmplitude ?? 8;

    // Core thrust calculation:
    // cos(swimPhase) gives instantaneous lateral velocity
    // Absolute value because thrust is generated in both directions
    const instantaneousVelocity = Math.abs(Math.cos(swimPhase));

    // Scale by tail amplitude (bigger tail = more thrust)
    // Normalize by a reference amplitude (~10 pixels)
    const amplitudeScale =
      1.0 +
      (tailAmplitude / 10 - 1.0) * PROPULSION_CONFIG.amplitudeInfluence;

    // Scale by swim frequency (faster beats = more thrust)
    // Normalize by reference frequency (~0.08)
    const frequencyScale =
      1.0 +
      (swimSpeed / 0.08 - 1.0) * PROPULSION_CONFIG.frequencyInfluence;

    // Combine factors
    let thrust =
      instantaneousVelocity *
      amplitudeScale *
      frequencyScale *
      PROPULSION_CONFIG.thrustCoefficient;

    // Add base thrust so fish don't completely stop
    thrust =
      PROPULSION_CONFIG.minThrustMultiplier +
      thrust * (1 - PROPULSION_CONFIG.minThrustMultiplier);

    // Clamp to max
    return Math.min(thrust, PROPULSION_CONFIG.maxThrustMultiplier);
  }

  calculateTargetSpeed(fish: FishMarineLife): number {
    const thrust = this.calculateThrust(fish);
    const baseSpeed = fish.baseSpeed;

    // Target speed is base speed modulated by thrust
    return baseSpeed * thrust;
  }

  getTailVelocity(fish: FishMarineLife): { lateral: number; angular: number } {
    if (!fish.useSpineChain || fish.swimPhase === undefined) {
      return { lateral: 0, angular: 0 };
    }

    const swimPhase = fish.swimPhase;
    const swimSpeed = fish.swimSpeed ?? 0.08;
    const tailAmplitude = fish.tailAmplitude ?? 8;

    // Lateral velocity: derivative of sin(phase) = cos(phase), scaled by amplitude and frequency
    const lateral = Math.cos(swimPhase) * tailAmplitude * swimSpeed;

    // Angular velocity: rate of angle change at tail
    // Approximated as derivative of the angle offset
    const angular = -Math.sin(swimPhase) * 0.15 * swimSpeed;

    return { lateral, angular };
  }
}

/**
 * Smoothly interpolate speed toward target
 * Used by movement controller to prevent jerky speed changes
 */
export function smoothSpeed(
  currentSpeed: number,
  targetSpeed: number,
  deltaSeconds: number
): number {
  const smoothingFactor = 1 - Math.pow(1 - PROPULSION_CONFIG.speedSmoothing, deltaSeconds * 60);
  return currentSpeed + (targetSpeed - currentSpeed) * smoothingFactor;
}

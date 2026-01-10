/**
 * UFOMoodManager - Manages UFO emotional state and wobble animations
 *
 * Handles mood transitions, visual modifiers, tiredness accumulation,
 * and idle wobble animations that give the UFO personality.
 */

import type { IUFOMoodManager } from "../contracts/IUFOMoodManager";
import type {
  UFO,
  UFOConfig,
  UFOMood,
  MoodVisuals,
  WobbleOffset,
  WobbleType,
} from "../domain/ufo-types";

/** Wobble animation durations in frames */
const WOBBLE_DURATIONS: Record<WobbleType, number> = {
  none: 0,
  curious_tilt: 30,
  startled_jolt: 20,
  disappointed_shake: 45,
  happy_bounce: 25,
  yawn_stretch: 90,
};

/** Default visual modifiers when no mood config */
const DEFAULT_MOOD_VISUALS: MoodVisuals = {
  lightSpeed: 1.0,
  bobDepth: 1.0,
  shieldBrightness: 1.0,
};

export class UFOMoodManager implements IUFOMoodManager {
  updateMood(ufo: UFO, config: UFOConfig, speedMult: number): void {
    const moodConfig = config.mood;
    if (!moodConfig) return;

    // Increment mood timer
    ufo.moodTimer += speedMult;

    // Accumulate tiredness over lifetime (never resets)
    ufo.tiredness = Math.min(1, ufo.tiredness + moodConfig.tirednessRate * speedMult);

    // Check for tired mood (overrides other moods when very tired)
    if (ufo.tiredness > moodConfig.tiredThreshold && ufo.mood !== "tired") {
      ufo.mood = "tired";
      ufo.moodTimer = 0;
      return;
    }

    // Handle mood-specific decay back to curious
    switch (ufo.mood) {
      case "excited":
        if (ufo.moodTimer >= moodConfig.excitedDecay) {
          ufo.mood = "curious";
          ufo.moodTimer = 0;
        }
        break;

      case "startled":
        if (ufo.moodTimer >= moodConfig.startledDecay) {
          ufo.mood = "curious";
          ufo.moodTimer = 0;
        }
        break;

      case "playful":
        if (ufo.moodTimer >= moodConfig.playfulDecay) {
          ufo.mood = "curious";
          ufo.moodTimer = 0;
        }
        break;

      case "bored":
        // Bored can transition back to curious if something interesting happens
        // (handled externally via setMood when interest is triggered)
        break;

      case "curious":
        // Check if UFO has been uninterested for too long → become bored
        const timeSinceInterest = ufo.totalTime - ufo.lastInterestTime;
        if (timeSinceInterest >= moodConfig.boredThreshold) {
          ufo.mood = "bored";
          ufo.moodTimer = 0;
        }
        break;

      case "tired":
        // Tired is permanent for this visit - UFO will leave soon
        break;
    }
  }

  getMoodVisuals(ufo: UFO | null, config: UFOConfig): MoodVisuals {
    if (!ufo || !config.mood) {
      return DEFAULT_MOOD_VISUALS;
    }

    return config.mood.moodVisuals[ufo.mood] ?? DEFAULT_MOOD_VISUALS;
  }

  setMood(ufo: UFO, mood: UFOMood): void {
    ufo.mood = mood;
    ufo.moodTimer = 0;

    // Certain moods count as "interesting" and reset bored timer
    if (mood === "excited" || mood === "playful" || mood === "startled") {
      this.markInterest(ufo);
    }
  }

  markInterest(ufo: UFO): void {
    ufo.lastInterestTime = ufo.totalTime;

    // If bored, snap back to curious
    if (ufo.mood === "bored") {
      ufo.mood = "curious";
      ufo.moodTimer = 0;
    }
  }

  updateWobble(ufo: UFO, speedMult: number): void {
    if (ufo.wobbleType === "none") return;

    ufo.wobbleTimer += speedMult;

    const duration = WOBBLE_DURATIONS[ufo.wobbleType];

    if (ufo.wobbleTimer >= duration) {
      // Wobble complete
      ufo.wobbleType = "none";
      ufo.wobbleTimer = 0;
      ufo.wobbleIntensity = 0;
    } else {
      // Calculate intensity (peaks in middle, fades at ends)
      const progress = ufo.wobbleTimer / duration;
      ufo.wobbleIntensity = Math.sin(progress * Math.PI);
    }
  }

  triggerWobble(ufo: UFO, type: WobbleType): void {
    // Don't interrupt existing wobble
    if (ufo.wobbleType !== "none") return;

    ufo.wobbleType = type;
    ufo.wobbleTimer = 0;
    ufo.wobbleIntensity = 0;
  }

  getWobbleOffset(ufo: UFO | null): WobbleOffset {
    if (!ufo || ufo.wobbleType === "none") {
      return { x: 0, y: 0, rotation: 0, scale: 1 };
    }

    const intensity = ufo.wobbleIntensity;

    switch (ufo.wobbleType) {
      case "curious_tilt":
        // Lean to one side
        return {
          x: intensity * 3,
          y: 0,
          rotation: intensity * 0.15,
          scale: 1,
        };

      case "startled_jolt":
        // Quick shake and slight jump
        const joltShake = Math.sin(ufo.wobbleTimer * 1.5) * intensity;
        return {
          x: joltShake * 4,
          y: -intensity * 5,
          rotation: joltShake * 0.1,
          scale: 1 + intensity * 0.05,
        };

      case "disappointed_shake":
        // Side to side head shake
        const shakeOscillation = Math.sin(ufo.wobbleTimer * 0.4) * intensity;
        return {
          x: shakeOscillation * 6,
          y: intensity * 2, // Slight droop
          rotation: shakeOscillation * 0.08,
          scale: 1,
        };

      case "happy_bounce":
        // Up-down bounce
        const bouncePhase = Math.sin(ufo.wobbleTimer * 0.5) * intensity;
        return {
          x: 0,
          y: -Math.abs(bouncePhase) * 8,
          rotation: 0,
          scale: 1 + bouncePhase * 0.08,
        };

      case "yawn_stretch":
        // Stretch up then settle
        const yawnProgress = ufo.wobbleTimer / 90;
        const stretchAmount =
          yawnProgress < 0.4
            ? yawnProgress / 0.4 // Stretch up
            : 1 - (yawnProgress - 0.4) / 0.6; // Settle back
        return {
          x: 0,
          y: -stretchAmount * intensity * 6,
          rotation: 0,
          scale: 1 + stretchAmount * intensity * 0.1,
        };

      default:
        return { x: 0, y: 0, rotation: 0, scale: 1 };
    }
  }
}

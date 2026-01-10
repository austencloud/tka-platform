/**
 * IUFOMoodManager - Manages UFO emotional state and wobble animations
 *
 * Handles mood transitions, visual modifiers, tiredness accumulation,
 * and idle wobble animations that give the UFO personality.
 */

import type {
  UFO,
  UFOConfig,
  UFOMood,
  MoodVisuals,
  WobbleOffset,
  WobbleType,
} from "../domain/ufo-types";

export interface IUFOMoodManager {
  /**
   * Update the UFO's emotional state
   * Handles mood decay, tiredness accumulation, and bored detection
   */
  updateMood(ufo: UFO, config: UFOConfig, speedMult: number): void;

  /**
   * Get visual modifiers based on current mood
   */
  getMoodVisuals(ufo: UFO | null, config: UFOConfig): MoodVisuals;

  /**
   * Set the UFO's mood directly
   */
  setMood(ufo: UFO, mood: UFOMood): void;

  /**
   * Mark that something interesting happened (resets bored timer)
   */
  markInterest(ufo: UFO): void;

  /**
   * Update wobble animation progress
   */
  updateWobble(ufo: UFO, speedMult: number): void;

  /**
   * Trigger a wobble animation
   */
  triggerWobble(ufo: UFO, type: WobbleType): void;

  /**
   * Get wobble offset for rendering
   */
  getWobbleOffset(ufo: UFO | null): WobbleOffset;
}

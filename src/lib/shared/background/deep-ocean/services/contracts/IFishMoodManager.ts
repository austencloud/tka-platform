import type { FishMarineLife } from "../../domain/models/DeepOceanModels";
import type { FishMood, MoodVisuals } from "../../domain/types/fish-personality-types";

/**
 * IFishMoodManager - Manages emotional state transitions for fish
 *
 * Moods affect behavior decisions and visual expression.
 * They decay over time back to 'calm' and can be triggered by stimuli.
 */
export interface IFishMoodManager {
  /**
   * Update mood state based on current conditions
   * Handles decay, energy/hunger effects, and stimulus timeout
   * @param fish - The fish to update
   * @param deltaSeconds - Time since last frame
   */
  updateMood(fish: FishMarineLife, deltaSeconds: number): void;

  /**
   * Get visual modifiers for the current mood
   * Used by renderers to adjust appearance
   * @param fish - The fish to query
   * @returns Visual modifier values
   */
  getMoodVisuals(fish: FishMarineLife): MoodVisuals;

  /**
   * Set mood directly (e.g., from external trigger)
   * @param fish - The fish to update
   * @param mood - The new mood
   */
  setMood(fish: FishMarineLife, mood: FishMood): void;

  /**
   * Mark that something interesting happened to this fish
   * Can trigger mood changes based on stimulus type
   * @param fish - The fish that experienced the stimulus
   * @param type - Type of stimulus
   */
  markStimulus(
    fish: FishMarineLife,
    type: "food" | "threat" | "friend" | "novelty"
  ): void;

  /**
   * Check if a mood transition should occur based on conditions
   * @param fish - The fish to check
   * @returns Whether the fish should consider changing behavior
   */
  shouldTransitionBehavior(fish: FishMarineLife): boolean;
}

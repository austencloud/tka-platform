import type { FishSpecies } from "../../domain/models/DeepOceanModels";
import type {
  FishPersonality,
  BehaviorModifiers,
} from "../../domain/types/fish-personality-types";

/**
 * IFishPersonalityGenerator - Creates unique personality traits for fish
 *
 * Each fish gets a personality at spawn that influences their behavior
 * throughout their lifetime. Species affects the trait ranges.
 */
export interface IFishPersonalityGenerator {
  /**
   * Generate personality traits for a new fish
   * Traits are influenced by species (tropical = bold, deep = shy, etc.)
   * @param species - The fish species
   * @returns Personality trait values (0-1 for each)
   */
  generatePersonality(species: FishSpecies): FishPersonality;

  /**
   * Calculate behavior probability modifiers from personality
   * Used by decision maker to weight behavior choices
   * @param personality - The fish's personality traits
   * @returns Modifiers for various behavior probabilities
   */
  getBehaviorModifiers(personality: FishPersonality): BehaviorModifiers;

  /**
   * Get a description of the personality (for debugging/display)
   * @param personality - The fish's personality traits
   * @returns Human-readable description
   */
  describePersonality(personality: FishPersonality): string;
}

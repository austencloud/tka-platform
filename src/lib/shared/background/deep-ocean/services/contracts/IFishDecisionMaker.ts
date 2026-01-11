import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import type { FishMarineLife, FishBehavior } from "../../domain/models/DeepOceanModels";

/**
 * Decision context provided to the decision maker
 */
export interface DecisionContext {
  fish: FishMarineLife;
  nearbyFish: FishMarineLife[];
  dimensions: Dimensions;
  animationTime: number;
}

/**
 * Decision result - what behavior to transition to
 */
export interface FishDecision {
  /** The behavior to transition to */
  behavior: FishBehavior;

  /** Optional target direction for turning */
  targetDirection?: 1 | -1;

  /** Speed multiplier for the new behavior */
  speedMultiplier?: number;

  /** Whether to trigger a wobble animation */
  triggerWobble?: "curious_tilt" | "startled_dart" | "playful_wiggle" | "tired_drift";
}

/**
 * IFishDecisionMaker - Decides behavior transitions based on personality and mood
 *
 * Replaces simple random behavior selection with personality-influenced decisions.
 * Integrates with the mood system to create varied, believable behavior.
 */
export interface IFishDecisionMaker {
  /**
   * Decide what behavior to transition to
   * Called when behavior timer expires
   * @param ctx - Context including fish state and environment
   * @returns Decision with new behavior and optional modifiers
   */
  decideNextBehavior(ctx: DecisionContext): FishDecision;

  /**
   * Get modified probabilities for behavior transitions
   * Based on personality traits
   * @param fish - The fish making the decision
   * @returns Modified probability weights
   */
  getTransitionWeights(fish: FishMarineLife): {
    turn: number;
    dart: number;
    cruise: number;
    school: number;
  };
}

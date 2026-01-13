import type { FishMarineLife } from "../../domain/models/DeepOceanModels";

/**
 * Interaction types between fish
 */
export type FishInteractionType =
  | "passing_greeting" // Fish pass close, acknowledge each other
  | "yield" // Less bold fish slows for bolder one
  | "social_approach" // Social fish veers toward neighbor
  | "shy_avoidance"; // Shy fish veers away from neighbor

/**
 * Result of processing an interaction
 */
export interface InteractionResult {
  type: FishInteractionType;
  /** Fish that initiated or was primary in interaction */
  fish: FishMarineLife;
  /** The other fish involved */
  other: FishMarineLife;
  /** Wobble to trigger (if any) */
  triggerWobble?: FishMarineLife["wobbleType"];
  /** Speed modifier to apply temporarily */
  speedModifier?: number;
  /** Vertical nudge in pixels */
  verticalNudge?: number;
}

/**
 * IFishInteractionHandler - Detects and handles micro-interactions between fish
 *
 * Creates emergent social behaviors by detecting when fish pass close to each
 * other and triggering personality-appropriate responses. This makes fish
 * feel like they exist in a shared world where they notice each other.
 */
export interface IFishInteractionHandler {
  /**
   * Process potential interactions for all fish
   * Should be called once per frame before movement updates
   *
   * @param fish - All fish in the scene
   * @param deltaSeconds - Time since last frame
   * @returns Array of interactions that occurred this frame
   */
  processInteractions(
    fish: FishMarineLife[],
    deltaSeconds: number
  ): InteractionResult[];

  /**
   * Apply the effects of an interaction to the fish involved
   * Triggers wobbles, speed changes, and position nudges
   *
   * @param result - The interaction result to apply
   */
  applyInteraction(result: InteractionResult): void;

  /**
   * Check if a fish is on interaction cooldown
   * Prevents fish from constantly triggering interactions
   *
   * @param fish - The fish to check
   * @returns true if fish cannot trigger new interactions
   */
  isOnCooldown(fish: FishMarineLife): boolean;
}

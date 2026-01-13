import type { FishMarineLife } from "../../domain/models/DeepOceanModels";

/**
 * Rare behavior types that create memorable "did that fish just...?" moments
 */
export type RareBehaviorType =
  | "barrel_roll" // Full 360° rotation - playful delight
  | "freeze" // Complete stillness before darting - alert
  | "double_take" // Quick look-back - curiosity
  | "happy_flip" // Upward arc - joy/excitement
  | "sync_swim"; // Brief synchronized movement with neighbor

/**
 * Result of a rare behavior check
 */
export interface RareBehaviorResult {
  type: RareBehaviorType;
  fish: FishMarineLife;
  /** For sync_swim, the partner fish */
  partner?: FishMarineLife;
  /** Wobble type to trigger */
  wobbleType: FishMarineLife["wobbleType"];
  /** How long to pause normal behavior (seconds) */
  pauseDuration?: number;
}

/**
 * IFishRareBehaviorHandler - Triggers rare, memorable fish behaviors
 *
 * These are low-probability behaviors that create user delight:
 * - Barrel rolls during playful mood
 * - Freeze-then-dart when alert
 * - Double-takes when curious
 * - Happy flips when energy is high
 * - Synchronized swimming with recognized "friends"
 */
export interface IFishRareBehaviorHandler {
  /**
   * Check if any rare behaviors should trigger this frame
   * Called once per frame for all fish
   *
   * @param fish - All fish in the scene
   * @param deltaSeconds - Time since last frame
   * @returns Array of rare behaviors that triggered
   */
  checkRareBehaviors(
    fish: FishMarineLife[],
    deltaSeconds: number
  ): RareBehaviorResult[];

  /**
   * Apply a rare behavior result
   * Triggers wobbles and any special effects
   *
   * @param result - The rare behavior to apply
   */
  applyRareBehavior(result: RareBehaviorResult): void;

  /**
   * Manually trigger a rare behavior on a fish (for lab testing)
   *
   * @param fish - The fish to trigger on
   * @param type - The rare behavior type
   * @param partner - Optional partner for sync behaviors
   */
  triggerRareBehavior(
    fish: FishMarineLife,
    type: RareBehaviorType,
    partner?: FishMarineLife
  ): void;
}

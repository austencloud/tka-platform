import type { FishMarineLife } from "../../domain/models/DeepOceanModels";

/**
 * Hunt state - lifecycle of a predator/prey chase sequence
 */
export type HuntState = "idle" | "stalking" | "chasing" | "cooldown";

/**
 * Hunt outcome - how a chase ended
 */
export type HuntOutcome = "escaped" | "caught" | "timeout" | "cancelled";

/**
 * Active hunt data
 */
export interface ActiveHunt {
  /** ID of the hunting predator */
  hunterId: number;

  /** ID of the prey being hunted */
  targetId: number;

  /** Current hunt phase */
  state: HuntState;

  /** Animation time when hunt started */
  startTime: number;

  /** Maximum duration before predator gives up */
  maxDuration: number;
}

/**
 * Hunt result - returned when a hunt completes
 */
export interface HuntResult {
  hunt: ActiveHunt;
  outcome: HuntOutcome;
}

/**
 * Hunt statistics for debugging/lab display
 */
export interface HuntStats {
  activeHunts: number;
  totalHunts: number;
  successfulCatches: number;
  escapes: number;
}

/**
 * IFishHuntingHandler - Manages predator/prey chase sequences
 *
 * Creates emergent drama through pursuit and escape. Sleek fish hunt,
 * tropical/schooling fish flee. No death - just pursuit behavior.
 *
 * Hunt lifecycle:
 * 1. Detection - hungry predator spots nearby prey
 * 2. Stalking - slow approach, prey unaware (2-3 seconds)
 * 3. Chasing - burst pursuit, prey flees (4-6 seconds)
 * 4. Resolution - prey escapes (80%) or predator "catches" (20%)
 * 5. Cooldown - predator rests before hunting again (30 seconds)
 */
export interface IFishHuntingHandler {
  /**
   * Process hunting behavior for all fish
   * Detects new hunts, updates active hunts, resolves completions
   * @returns Array of hunts that completed this frame
   */
  processHunting(
    fish: FishMarineLife[],
    deltaSeconds: number,
    animationTime: number
  ): HuntResult[];

  /**
   * Apply effects from a completed hunt
   * - Catch: predator does feeding_lunge, hunger resets
   * - Escape: prey darts away, mood becomes alert
   */
  applyHuntResult(result: HuntResult, fish: FishMarineLife[]): void;

  /**
   * Check if a fish is a predator species
   */
  isPredator(fish: FishMarineLife): boolean;

  /**
   * Check if a fish is prey species
   */
  isPrey(fish: FishMarineLife): boolean;

  /**
   * Get all currently active hunts
   */
  getActiveHunts(): ActiveHunt[];

  /**
   * Get hunt statistics for display
   */
  getStats(): HuntStats;

  /**
   * Force a specific predator to hunt a specific prey (for lab testing)
   */
  forceHunt(predator: FishMarineLife, prey: FishMarineLife, animationTime: number): void;

  /**
   * Cancel all active hunts (for reset/cleanup)
   */
  cancelAllHunts(): void;

  /**
   * Get the hunt visualization data for a specific fish
   * Returns predator -> prey line data if fish is hunting
   */
  getHuntVisualization(
    fish: FishMarineLife
  ): { targetX: number; targetY: number; state: HuntState } | null;
}

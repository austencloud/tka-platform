/**
 * Tempo Ramp Orchestrator Interface
 *
 * Manages progressive tempo training: tracks loop completions,
 * bumps BPM when enough rounds at the current level are completed.
 *
 * Pure state machine - does NOT control playback directly.
 * Fires callbacks to let the consumer handle BPM changes and playback.
 */

export interface TempoRampConfig {
  /** Starting BPM (default: 15) */
  startBpm: number;
  /** BPM increase per level (default: 5) */
  increment: number;
  /** Number of full sequence loops per level before bumping BPM (default: 5) */
  roundsPerLevel: number;
  /** Optional maximum BPM cap (default: 300) */
  maxBpm: number;
}

export interface TempoRampProgress {
  /** Whether ramp is currently running */
  active: boolean;
  /** Current BPM */
  currentBpm: number;
  /** Which round within the current level (1-based) */
  currentRound: number;
  /** How many rounds per level */
  roundsPerLevel: number;
  /** How many levels completed */
  currentLevel: number;
  /** Total rounds completed across all levels */
  totalRoundsCompleted: number;
}

export interface ITempoRampOrchestrator {
  /**
   * Start a ramp session with the given config.
   * Returns the starting BPM.
   */
  start(config?: Partial<TempoRampConfig>): number;

  /**
   * Stop the current ramp session.
   * Returns the final BPM reached.
   */
  stop(): number;

  /**
   * Called each time a full loop of the sequence completes.
   * Returns the new BPM if it changed, or null if same level continues.
   */
  onLoopComplete(): number | null;

  /**
   * Called when the user manually adjusts BPM during an active ramp.
   * Updates the baseline BPM and resets the round counter for the current level.
   */
  adjustBpm(newBpm: number): void;

  /** Whether a ramp session is currently active. */
  isActive(): boolean;

  /** Get current progress snapshot. */
  getProgress(): TempoRampProgress;
}

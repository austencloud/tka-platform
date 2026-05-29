/**
 * Tempo Practice Orchestrator
 *
 * Pure state machine for progressive tempo training.
 * Tracks loop completions and determines when to bump BPM.
 * Does NOT control playback - fires return values for the consumer to act on.
 */

export interface TempoPracticeConfig {
  /** Starting BPM (default: 15) */
  startBpm: number;
  /** BPM increase per level (default: 5) */
  increment: number;
  /** Number of full sequence loops per level before bumping BPM (default: 5) */
  roundsPerLevel: number;
  /** Optional maximum BPM cap (default: 300) */
  maxBpm: number;
}

export interface TempoPracticeProgress {
  /** Whether practice is currently running */
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
const DEFAULT_CONFIG: TempoPracticeConfig = {
  startBpm: 15,
  increment: 5,
  roundsPerLevel: 5,
  maxBpm: 300,
};

export class TempoPracticeOrchestrator {
  private config: TempoPracticeConfig = { ...DEFAULT_CONFIG };
  private active = false;
  private currentBpm = 0;
  private currentRound = 0; // 0-based within level
  private currentLevel = 0;
  private totalRoundsCompleted = 0;

  start(partialConfig?: Partial<TempoPracticeConfig>): number {
    this.config = { ...DEFAULT_CONFIG, ...partialConfig };
    this.active = true;
    this.currentBpm = this.config.startBpm;
    this.currentRound = 0;
    this.currentLevel = 0;
    this.totalRoundsCompleted = 0;

    return this.currentBpm;
  }

  stop(): number {
    const finalBpm = this.currentBpm;
    this.active = false;
    return finalBpm;
  }

  onLoopComplete(): number | null {
    if (!this.active) return null;

    this.currentRound++;
    this.totalRoundsCompleted++;

    // Check if we've completed enough rounds at this level
    if (this.currentRound >= this.config.roundsPerLevel) {
      // Bump to next level
      this.currentRound = 0;
      this.currentLevel++;

      const newBpm = Math.min(
        this.currentBpm + this.config.increment,
        this.config.maxBpm
      );

      if (newBpm === this.currentBpm) {
        // Already at max - stop the practice
        this.active = false;
        return null;
      }

      this.currentBpm = newBpm;
      return newBpm;
    }

    return null;
  }

  adjustBpm(newBpm: number): void {
    if (!this.active) return;
    this.currentBpm = Math.min(Math.max(newBpm, 1), this.config.maxBpm);
    // Reset round counter - user changed the tempo, start fresh at this speed
    this.currentRound = 0;
  }

  isActive(): boolean {
    return this.active;
  }

  getProgress(): TempoPracticeProgress {
    return {
      active: this.active,
      currentBpm: this.currentBpm,
      currentRound: this.currentRound + 1, // 1-based for display
      roundsPerLevel: this.config.roundsPerLevel,
      currentLevel: this.currentLevel,
      totalRoundsCompleted: this.totalRoundsCompleted,
    };
  }
}

/**
 * Tempo Practice Orchestrator
 *
 * Pure state machine for progressive tempo training.
 * Tracks loop completions and determines when to bump BPM.
 * Does NOT control playback - fires return values for the consumer to act on.
 *
 * Progression modes:
 * - "auto":   onLoopComplete() bumps BPM automatically once roundsPerLevel
 *             clean loops are done.
 * - "manual": onLoopComplete() never changes BPM. It counts loops and, once
 *             roundsPerLevel is reached, raises `readyToAdvance`. The consumer
 *             calls advanceLevel() when the user taps "Speed Up". Self-paced.
 */

export type ProgressionMode = "auto" | "manual";

export interface TempoPracticeConfig {
  /** Starting BPM (default: 15) */
  startBpm: number;
  /** BPM increase per level (default: 5) */
  increment: number;
  /** Number of full sequence loops per level before bumping BPM (default: 5) */
  roundsPerLevel: number;
  /** Optional maximum BPM cap (default: 300) */
  maxBpm: number;
  /** How the ramp progresses between levels (default: "manual") */
  progressionMode: ProgressionMode;
}

export interface TempoPracticeProgress {
  /** Whether practice is currently running */
  active: boolean;
  /** Current BPM */
  currentBpm: number;
  /** Which round within the current level (1-based, clamped to roundsPerLevel) */
  currentRound: number;
  /** How many rounds per level */
  roundsPerLevel: number;
  /** How many levels completed */
  currentLevel: number;
  /** Total rounds completed across all levels */
  totalRoundsCompleted: number;
  /** Loops completed at the current level (0..roundsPerLevel) — drives the dots */
  loopsCompleted: number;
  /** Loops left before the level completes (max(0, roundsPerLevel - loopsCompleted)) */
  loopsRemaining: number;
  /** Active progression mode */
  progressionMode: ProgressionMode;
  /** Manual mode only: the level is complete and waiting for a "Speed Up" tap */
  readyToAdvance: boolean;
}
const DEFAULT_CONFIG: TempoPracticeConfig = {
  startBpm: 15,
  increment: 5,
  roundsPerLevel: 5,
  maxBpm: 300,
  progressionMode: "auto",
};

export class TempoPracticeOrchestrator {
  private config: TempoPracticeConfig = { ...DEFAULT_CONFIG };
  private active = false;
  private currentBpm = 0;
  private currentRound = 0; // 0-based count of completed loops within level
  private currentLevel = 0;
  private totalRoundsCompleted = 0;
  private readyToAdvance = false;

  start(partialConfig?: Partial<TempoPracticeConfig>): number {
    this.config = { ...DEFAULT_CONFIG, ...partialConfig };
    this.active = true;
    this.currentBpm = this.config.startBpm;
    this.currentRound = 0;
    this.currentLevel = 0;
    this.totalRoundsCompleted = 0;
    this.readyToAdvance = false;

    return this.currentBpm;
  }

  stop(): number {
    const finalBpm = this.currentBpm;
    this.active = false;
    return finalBpm;
  }

  /**
   * Call once per full sequence loop.
   * Auto mode: returns the new BPM when a level completes (or null), and stops
   * the session if already at max. Manual mode: always returns null; raises
   * `readyToAdvance` once the level is complete and ignores further loops until
   * the consumer calls advanceLevel().
   */
  onLoopComplete(): number | null {
    if (!this.active) return null;

    // Manual mode parks at the level boundary until the user advances.
    if (this.config.progressionMode === "manual" && this.readyToAdvance) {
      return null;
    }

    this.currentRound++;
    this.totalRoundsCompleted++;

    if (this.currentRound >= this.config.roundsPerLevel) {
      if (this.config.progressionMode === "manual") {
        // Hold tempo; flag that the user can speed up when ready.
        this.readyToAdvance = true;
        return null;
      }

      // Auto: bump to the next level immediately.
      return this.bumpLevel();
    }

    return null;
  }

  /**
   * Manual progression: advance one level on demand (the "Speed Up" action).
   * Returns the new BPM, or null if already at the max cap (which stops the
   * session, mirroring auto behavior).
   */
  advanceLevel(): number | null {
    if (!this.active) return null;
    return this.bumpLevel();
  }

  /** Shared level-up: reset the round counter, raise BPM, stop at the cap. */
  private bumpLevel(): number | null {
    this.currentRound = 0;
    this.currentLevel++;
    this.readyToAdvance = false;

    const newBpm = Math.min(
      this.currentBpm + this.config.increment,
      this.config.maxBpm
    );

    if (newBpm === this.currentBpm) {
      // Already at max - stop the practice.
      this.active = false;
      return null;
    }

    this.currentBpm = newBpm;
    return newBpm;
  }

  adjustBpm(newBpm: number): void {
    if (!this.active) return;
    this.currentBpm = Math.min(Math.max(newBpm, 1), this.config.maxBpm);
    // Reset round counter - user changed the tempo, start fresh at this speed.
    this.currentRound = 0;
    this.readyToAdvance = false;
  }

  isActive(): boolean {
    return this.active;
  }

  getProgress(): TempoPracticeProgress {
    return {
      active: this.active,
      currentBpm: this.currentBpm,
      // 1-based for display, clamped so manual's parked state never reads N+1.
      currentRound: Math.min(this.currentRound + 1, this.config.roundsPerLevel),
      roundsPerLevel: this.config.roundsPerLevel,
      currentLevel: this.currentLevel,
      totalRoundsCompleted: this.totalRoundsCompleted,
      loopsCompleted: this.currentRound,
      loopsRemaining: Math.max(0, this.config.roundsPerLevel - this.currentRound),
      progressionMode: this.config.progressionMode,
      readyToAdvance: this.readyToAdvance,
    };
  }
}

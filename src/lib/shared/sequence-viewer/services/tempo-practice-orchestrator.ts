/**
 * Tempo Practice Orchestrator
 *
 * Pure state machine for progressive tempo training.
 * Tracks loop completions and determines when to raise BPM.
 * Does NOT control playback - fires return values for the consumer to act on.
 *
 * Single source of truth: `currentBpm`. The displayed level is a pure function
 * of BPM (round((bpm - startBpm) / increment)), so fine-trims, level jumps, and
 * the smooth creep can never desync the level readout.
 *
 * Progression modes:
 * - "smooth":  onLoopComplete() raises BPM by `smoothStep` (default 1) every
 *              single loop. Imperceptible creep — same average rate as a
 *              5-loops-then-+5 staircase, but never a jarring jump. The default.
 * - "stepped": onLoopComplete() holds BPM for `roundsPerLevel` clean loops, then
 *              jumps by `increment`. Stable reps before each bump.
 * - "manual":  onLoopComplete() never changes BPM. It counts loops and, once
 *              roundsPerLevel is reached, raises `readyToAdvance`. The consumer
 *              calls advanceLevel() when the user taps "Level Up". Self-paced.
 */

export type ProgressionMode = "smooth" | "stepped" | "manual";

export interface TempoPracticeConfig {
  /** Starting BPM (default: 15) */
  startBpm: number;
  /** BPM jump per level for stepped/manual + the bar's big -/+ buttons (default: 5) */
  increment: number;
  /** Smooth mode: BPM added after every loop (default: 1) */
  smoothStep: number;
  /** Number of full sequence loops per level before bumping BPM (default: 5) */
  roundsPerLevel: number;
  /** Optional maximum BPM cap (default: 300) */
  maxBpm: number;
  /** How the ramp progresses (default: "smooth") */
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
  /** Derived level: how many increments above the start tempo (0 in smooth mode) */
  currentLevel: number;
  /** Total rounds completed across all levels */
  totalRoundsCompleted: number;
  /** Loops completed at the current level (0..roundsPerLevel) — drives the dots */
  loopsCompleted: number;
  /** Loops left before the level completes (max(0, roundsPerLevel - loopsCompleted)) */
  loopsRemaining: number;
  /** Active progression mode */
  progressionMode: ProgressionMode;
  /** Manual mode only: the level is complete and waiting for a "Level Up" tap */
  readyToAdvance: boolean;
  /** Hold toggle: the auto-climb is frozen at the current tempo until released */
  held: boolean;
  /** Configured starting tempo — floor for level-down / fine-trim disable logic */
  startBpm: number;
  /** Configured max tempo — ceiling for level-up / fine-trim disable logic */
  maxBpm: number;
  /** Smooth mode per-loop BPM gain — surfaced for the bar's caption */
  smoothStep: number;
}

const DEFAULT_CONFIG: TempoPracticeConfig = {
  startBpm: 15,
  increment: 5,
  smoothStep: 1,
  roundsPerLevel: 5,
  maxBpm: 300,
  progressionMode: "smooth",
};

export class TempoPracticeOrchestrator {
  private config: TempoPracticeConfig = { ...DEFAULT_CONFIG };
  private active = false;
  private currentBpm = 0;
  private currentRound = 0; // 0-based count of completed loops within level
  private totalRoundsCompleted = 0;
  private readyToAdvance = false;
  private held = false;

  start(partialConfig?: Partial<TempoPracticeConfig>): number {
    const merged = { ...DEFAULT_CONFIG, ...partialConfig };
    // Legacy persisted configs used "auto" as the (never-deliberately-chosen)
    // default auto-ramp. The new default auto-ramp is "smooth", so map it there
    // — not "stepped" — so existing users get the gentle +1/loop default.
    if ((merged.progressionMode as string) === "auto") {
      merged.progressionMode = "smooth";
    }
    this.config = merged;
    this.active = true;
    this.currentBpm = this.config.startBpm;
    this.currentRound = 0;
    this.totalRoundsCompleted = 0;
    this.readyToAdvance = false;
    this.held = false;

    return this.currentBpm;
  }

  /** Freeze/resume the auto-climb. Faster/Slower still work while held. */
  setHeld(held: boolean): void {
    this.held = held;
  }

  stop(): number {
    const finalBpm = this.currentBpm;
    this.active = false;
    return finalBpm;
  }

  /**
   * Call once per full sequence loop.
   * - smooth:  always raises BPM by smoothStep (stops at the cap).
   * - stepped: raises by increment once roundsPerLevel clean loops are done.
   * - manual:  never raises; flags readyToAdvance at the level boundary.
   * Returns the new BPM when it changes, otherwise null.
   */
  onLoopComplete(): number | null {
    if (!this.active) return null;

    // Hold freezes the auto-climb at the current tempo until released.
    if (this.held) return null;

    // Manual mode parks at the level boundary until the user advances.
    if (this.config.progressionMode === "manual" && this.readyToAdvance) {
      return null;
    }

    this.totalRoundsCompleted++;

    // Smooth: creep up every loop. No level boundary to wait for.
    if (this.config.progressionMode === "smooth") {
      return this.stepBpm(this.config.smoothStep);
    }

    this.currentRound++;

    if (this.currentRound >= this.config.roundsPerLevel) {
      if (this.config.progressionMode === "manual") {
        // Hold tempo; flag that the user can level up when ready.
        this.readyToAdvance = true;
        return null;
      }
      // Stepped: jump to the next level immediately.
      return this.stepBpm(this.config.increment);
    }

    return null;
  }

  /**
   * Level up on demand (the bar's big "+" / "Level Up"). Returns the new BPM,
   * or null if already at the cap (which stops the session, mirroring stepped).
   */
  advanceLevel(): number | null {
    if (!this.active) return null;
    return this.stepBpm(this.config.increment);
  }

  /**
   * Level down on demand (the bar's big "−"). Returns the new BPM, or null if
   * already at the start tempo. Never stops the session.
   */
  decreaseLevel(): number | null {
    if (!this.active) return null;
    return this.stepBpm(-this.config.increment);
  }

  /**
   * Shared tempo step: reset the round counter, move BPM by delta clamped to
   * [startBpm, maxBpm]. Returns the new BPM, or null when clamping made no
   * change — and in that no-change case, an upward step at the ceiling stops the
   * session (you can't go faster), while a downward step at the floor is a no-op.
   */
  private stepBpm(delta: number): number | null {
    this.currentRound = 0;
    this.readyToAdvance = false;

    const target = this.currentBpm + delta;
    const clamped = Math.max(
      this.config.startBpm,
      Math.min(target, this.config.maxBpm)
    );

    if (clamped === this.currentBpm) {
      if (delta > 0) this.active = false; // hit the ceiling going up → done
      return null;
    }

    this.currentBpm = clamped;
    return this.currentBpm;
  }

  /** Fine-trim BPM directly (the bar's small ±1). Restarts the level's reps. */
  adjustBpm(newBpm: number): void {
    if (!this.active) return;
    this.currentBpm = Math.min(Math.max(newBpm, 1), this.config.maxBpm);
    this.currentRound = 0;
    this.readyToAdvance = false;
  }

  isActive(): boolean {
    return this.active;
  }

  getProgress(): TempoPracticeProgress {
    const mode = this.config.progressionMode;
    return {
      active: this.active,
      currentBpm: this.currentBpm,
      // 1-based for display, clamped so manual's parked state never reads N+1.
      currentRound: Math.min(this.currentRound + 1, this.config.roundsPerLevel),
      roundsPerLevel: this.config.roundsPerLevel,
      // Derived from BPM — never an independent counter that can desync.
      currentLevel:
        mode === "smooth"
          ? 0
          : Math.max(
              0,
              Math.round((this.currentBpm - this.config.startBpm) / this.config.increment)
            ),
      totalRoundsCompleted: this.totalRoundsCompleted,
      loopsCompleted: this.currentRound,
      loopsRemaining: Math.max(0, this.config.roundsPerLevel - this.currentRound),
      progressionMode: mode,
      readyToAdvance: this.readyToAdvance,
      held: this.held,
      startBpm: this.config.startBpm,
      maxBpm: this.config.maxBpm,
      smoothStep: this.config.smoothStep,
    };
  }
}

/**
 * Animation Playback Controller Implementation
 *
 * Orchestrates animation playback by coordinating:
 * - Animation engine (state calculations)
 * - Loop service (timing and frames)
 * - Panel state (UI updates)
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { PropState } from "../../shared/domain/types/PropState";
import type { AnimationPanelState } from "../../state/animation-panel-state.svelte";
import type { IAnimationLoop } from "../contracts/IAnimationLoop";
import type { IAnimationPlaybackController } from "../contracts/IAnimationPlaybackController";
import type { ISequenceAnimationOrchestrator } from "../contracts/ISequenceAnimationOrchestrator";
import type { ISequenceLoopabilityChecker } from "../contracts/ISequenceLoopabilityChecker";

export class AnimationPlaybackController implements IAnimationPlaybackController {
  private state: AnimationPanelState | null = null;
  private sequenceData: SequenceData | null = null;
  private isSeamlesslyLoopable: boolean = false;

  // Step playback (auto-step) state
  private stepPlaybackTimer: ReturnType<typeof setTimeout> | null = null;
  private stepPlaybackRunId = 0;

  // Animation-to-beat state
  private animationTarget: number | null = null;
  private animationStartBeat: number = 0;
  private animationStartTime: number = 0;
  private animationDuration: number = 300; // ms
  private useLinearAnimation: boolean = false;

  constructor(
    private readonly animationEngine: ISequenceAnimationOrchestrator,
    private readonly loopService: IAnimationLoop,
    private readonly loopabilityChecker: ISequenceLoopabilityChecker
  ) {}

  initialize(sequenceData: SequenceData, state: AnimationPanelState): boolean {
    this.state = state;
    this.sequenceData = sequenceData;

    // Check if sequence is seamlessly loopable
    this.isSeamlesslyLoopable =
      this.loopabilityChecker.isSeamlesslyLoopable(sequenceData);

    // Initialize animation engine with sequence data
    const success = this.animationEngine.initializeWithDomainData(sequenceData);
    if (!success) {
      return false;
    }

    // Get metadata from engine
    const metadata = this.animationEngine.getMetadata();
    state.setTotalBeats(metadata.totalBeats);
    state.setSequenceMetadata(metadata.word, metadata.author);

    // Set sequence data on state (data arrives already normalized from SequenceService)
    state.setSequenceData(sequenceData);

    // Reset playback state
    state.setCurrentBeat(0);
    state.setIsPlaying(false);

    // Update prop states from initial initialization
    this.updatePropStatesFromEngine();

    return true;
  }

  togglePlayback(): void {
    if (!this.state) return;

    if (this.state.isPlaying) {
      // Pause
      this.stopStepPlayback();
      this.loopService.stop();
      this.state.setIsPlaying(false);
    } else {
      // Play
      if (this.state.playbackMode === "step") {
        this.startStepPlayback();
      } else {
        this.state.setIsPlaying(true);
        this.loopService.start(
          (deltaTime) => this.onAnimationUpdate(deltaTime),
          this.state.speed
        );
      }
    }
  }

  stop(): void {
    if (!this.state) return;

    // Stop animation loop
    this.stopStepPlayback();
    this.loopService.stop();
    this.state.setIsPlaying(false);

    // Reset to start
    this.state.setCurrentBeat(0);

    // Re-initialize engine if we have sequence data
    if (this.sequenceData) {
      this.animationEngine.initializeWithDomainData(this.sequenceData);
    }

    // Update prop states
    this.updatePropStatesFromEngine();
  }

  jumpToBeat(beat: number): void {
    if (!this.state) return;

    // Stop any current playback/animation
    this.stopStepPlayback();
    this.loopService.stop();
    this.state.setIsPlaying(false);
    this.animationTarget = null;

    // Clamp beat to valid range
    const clampedBeat = Math.max(0, Math.min(beat, this.state.totalBeats));
    this.state.setCurrentBeat(clampedBeat);

    // Calculate state for this beat
    this.animationEngine.calculateState(clampedBeat);
    this.updatePropStatesFromEngine();
  }

  animateToBeat(
    beat: number,
    duration: number = 300,
    linear: boolean = false
  ): void {
    this.animateToBeatInternal(beat, duration, linear, true);
  }

  private animateToBeatInternal(
    beat: number,
    duration: number,
    linear: boolean,
    cancelStepPlayback: boolean
  ): void {
    if (!this.state) return;

    if (cancelStepPlayback) {
      // Manual/one-shot animation should cancel step playback
      this.stopStepPlayback();
    }

    // Clamp target beat to valid animation range
    // Allow totalBeats + 1 to show the final beat's motion (which spans from totalBeats to totalBeats + 1)
    const clampedBeat = Math.max(0, Math.min(beat, this.state.totalBeats + 1));

    // If already animating to this target, don't restart
    if (this.animationTarget === clampedBeat) {
      return;
    }

    // If already at target, just update state
    if (Math.abs(this.state.currentBeat - clampedBeat) < 0.01) {
      this.animationEngine.calculateState(clampedBeat);
      this.updatePropStatesFromEngine();
      return;
    }

    // Stop any current playback/animation
    this.loopService.stop();
    if (cancelStepPlayback) {
      this.state.setIsPlaying(false);
    }

    // Set up animation parameters
    this.animationTarget = clampedBeat;
    this.animationStartBeat = this.state.currentBeat;
    this.animationStartTime = performance.now();
    this.animationDuration = duration;
    this.useLinearAnimation = linear;

    // Start the animation loop with a custom callback
    this.loopService.start(
      () => this.onAnimateToBeatUpdate(),
      1.0 // Speed doesn't matter for time-based animation
    );
  }

  private onAnimateToBeatUpdate(): void {
    if (!this.state || this.animationTarget === null) {
      this.loopService.stop();
      return;
    }

    const elapsed = performance.now() - this.animationStartTime;
    const progress = Math.min(elapsed / this.animationDuration, 1.0);

    // Use linear interpolation for continuous playback, ease-out for manual selection
    const interpolatedProgress = this.useLinearAnimation
      ? progress
      : 1 - Math.pow(1 - progress, 3); // Ease-out cubic

    // Interpolate from start to target beat
    const currentBeat =
      this.animationStartBeat +
      (this.animationTarget - this.animationStartBeat) * interpolatedProgress;

    this.state.setCurrentBeat(currentBeat);
    this.animationEngine.calculateState(currentBeat);
    this.updatePropStatesFromEngine();

    // Check if animation is complete
    if (progress >= 1.0) {
      const finalBeat = this.animationTarget;
      this.loopService.stop();
      this.animationTarget = null;
      // Ensure we're exactly at the target
      this.state.setCurrentBeat(finalBeat);
      this.animationEngine.calculateState(finalBeat);
      this.updatePropStatesFromEngine();
    }
  }

  /**
   * Calculate animation duration based on speed multiplier and step size
   * Speed is a multiplier where 1.0 = 60 BPM, 2.0 = 120 BPM, etc.
   * @param stepSize Size of step in beats (0.5 or 1.0)
   */
  private getStepDuration(stepSize: number): number {
    const speedMultiplier = this.state?.speed ?? 1.0;
    // At speed=1.0 (60 BPM): 1000ms per beat
    // At speed=2.0 (120 BPM): 500ms per beat
    const msPerBeat = 1000 / speedMultiplier;
    return msPerBeat * stepSize;
  }

  stepHalfBeatForward(): void {
    if (!this.state) return;

    this.stopStepPlayback();

    const currentBeat = this.state.currentBeat;
    // Find next half-beat position (0, 0.5, 1, 1.5, 2, etc.)
    // Add small epsilon to handle exact positions (e.g., at 2.0, go to 2.5 not stay at 2.0)
    const nextHalfBeat = Math.ceil((currentBeat + 0.001) * 2) / 2;

    // Allow stepping to totalBeats + 1 to show final beat's motion
    const animationEndBeat = this.state.totalBeats + 1;
    if (nextHalfBeat <= animationEndBeat) {
      this.animateToBeat(nextHalfBeat, this.getStepDuration(0.5), true);
    }
  }

  stepHalfBeatBackward(): void {
    if (!this.state) return;

    this.stopStepPlayback();

    const currentBeat = this.state.currentBeat;
    // Find previous half-beat position (0, 0.5, 1, 1.5, 2, etc.)
    // Subtract small epsilon to handle exact positions (e.g., at 2.0, go to 1.5 not stay at 2.0)
    const prevHalfBeat = Math.floor((currentBeat - 0.001) * 2) / 2;

    if (prevHalfBeat >= 0) {
      this.animateToBeat(prevHalfBeat, this.getStepDuration(0.5), true);
    }
  }

  stepFullBeatForward(): void {
    if (!this.state) return;

    this.stopStepPlayback();

    const currentBeat = this.state.currentBeat;
    // Find next full-beat position (0, 1, 2, 3, etc.)
    const nextFullBeat = Math.ceil(currentBeat + 0.001);

    // Allow stepping to totalBeats + 1 to show final beat's motion
    const animationEndBeat = this.state.totalBeats + 1;
    if (nextFullBeat <= animationEndBeat) {
      this.animateToBeat(nextFullBeat, this.getStepDuration(1.0), true);
    }
  }

  stepFullBeatBackward(): void {
    if (!this.state) return;

    this.stopStepPlayback();

    const currentBeat = this.state.currentBeat;
    // Find previous full-beat position (0, 1, 2, 3, etc.)
    const prevFullBeat = Math.floor(currentBeat - 0.001);

    if (prevFullBeat >= 0) {
      this.animateToBeat(prevFullBeat, this.getStepDuration(1.0), true);
    }
  }

  // Deprecated - use stepHalfBeatForward() instead
  nextBeat(): void {
    this.stepHalfBeatForward();
  }

  // Deprecated - use stepHalfBeatBackward() instead
  previousBeat(): void {
    this.stepHalfBeatBackward();
  }

  setSpeed(speed: number): void {
    if (!this.state) return;

    this.state.setSpeed(speed);

    // Update loop service if currently playing
    if (this.state.isPlaying) {
      this.loopService.setSpeed(speed);
    }
  }

  getCurrentPropStates(): { blue: PropState; red: PropState } {
    return this.animationEngine.getCurrentPropStates();
  }

  dispose(): void {
    this.stopStepPlayback();
    this.loopService.stop();
    this.state = null;
    this.sequenceData = null;
  }

  private startStepPlayback(): void {
    if (!this.state) return;

    this.stopStepPlayback();

    this.state.setIsPlaying(true);
    const runId = ++this.stepPlaybackRunId;

    // Step immediately on start (no initial pause)
    this.stepPlaybackTimer = setTimeout(() => {
      void this.runStepPlaybackTick(runId);
    }, 0);
  }

  private stopStepPlayback(): void {
    this.stepPlaybackRunId++;
    if (this.stepPlaybackTimer) {
      clearTimeout(this.stepPlaybackTimer);
      this.stepPlaybackTimer = null;
    }
  }

  private runStepPlaybackTick(runId: number): void {
    if (!this.state || runId !== this.stepPlaybackRunId) return;
    if (!this.state.isPlaying) return;
    if (this.state.playbackMode !== "step") return;

    const stepSize = this.state.stepPlaybackStepSize;

    const currentBeat = this.state.currentBeat;
    const nextBeat =
      stepSize === 0.5
        ? Math.ceil((currentBeat + 0.001) * 2) / 2
        : Math.ceil(currentBeat + 0.001);

    // End reached - use totalBeats + 1 to allow final beat's motion to complete
    // (Beat N's motion spans from currentBeat N to N+1)
    const animationEndBeat = this.state.totalBeats + 1;
    if (nextBeat > animationEndBeat) {
      if (this.state.shouldLoop) {
        // Loop back to start without leaving "playing" state
        this.state.setCurrentBeat(0);
        if (this.sequenceData) {
          this.animationEngine.initializeWithDomainData(this.sequenceData);
        }
        this.animationEngine.calculateState(0);
        this.updatePropStatesFromEngine();

        // For seamlessly loopable sequences (circular), beat 0 is identical
        // to totalBeats, so immediately animate to the first step instead
        // of pausing at beat 0. This shows beat 1's motion without the
        // redundant pause at the start position.
        if (this.isSeamlesslyLoopable) {
          const duration = this.getStepDuration(stepSize);
          this.animateToBeatInternal(stepSize, duration, true, false);
        }

        // Schedule next tick to continue looping
        // Use pause at start position (unless seamlessly loopable, where we animate immediately)
        const duration = this.isSeamlesslyLoopable
          ? this.getStepDuration(stepSize)
          : 0;
        const pauseMs = this.state.stepPlaybackPauseMs;
        const nextDelay = duration + pauseMs;

        this.stepPlaybackTimer = setTimeout(() => {
          this.runStepPlaybackTick(runId);
        }, nextDelay);
      } else {
        // Stay at the end position (after final beat's motion completed)
        // Don't reset currentBeat - let it stay where the animation left it
        this.state.setIsPlaying(false);
        return;
      }
    } else {
      const duration = this.getStepDuration(stepSize);
      this.animateToBeatInternal(nextBeat, duration, true, false);

      // If we just stepped to the animation end beat, loop immediately after animation
      // (no pause at the "past the end" position since it's not a real beat)
      const isAtAnimationEnd = nextBeat >= animationEndBeat;
      const pauseMs = isAtAnimationEnd ? 0 : this.state.stepPlaybackPauseMs;
      const nextDelay = duration + pauseMs;

      this.stepPlaybackTimer = setTimeout(() => {
        this.runStepPlaybackTick(runId);
      }, nextDelay);
    }
  }

  private onAnimationUpdate(deltaTime: number): void {
    if (!this.state) return;

    // Calculate beat delta based on deltaTime (milliseconds)
    // NOTE: deltaTime is already adjusted by speed in AnimationLoopService
    // Assuming 60 BPM as default (1 beat per second)
    const DEFAULT_BPM = 60;
    const beatsPerSecond = DEFAULT_BPM / 60; // = 1.0
    const beatDelta = (deltaTime / 1000) * beatsPerSecond;
    const newBeat = this.state.currentBeat + beatDelta;

    // Animation timing explained:
    // - Start position is at currentBeat < 1 (before beat 1)
    // - Beat N's motion spans from currentBeat N to N+1
    // - For a 4-beat sequence, totalBeats = 4
    // - To complete beat 4's motion, we need currentBeat to reach 5 (totalBeats + 1)
    //
    // For seamlessly loopable sequences (circular patterns):
    // - Skip showing start position entirely in continuous playback
    // - Loop from end of last beat (totalBeats + 1) back to beat 1
    //
    // For non-loopable sequences:
    // - Show start position at the end before looping
    // - Loop from totalBeats + 1 back to beat 0 (start position)
    const animationEndBeat = this.state.totalBeats + 1;

    if (newBeat > animationEndBeat) {
      if (this.state.shouldLoop) {
        // For seamlessly loopable sequences, skip start position and loop to beat 1
        // For non-loopable sequences, show start position briefly by looping to 0
        const loopBackBeat = this.isSeamlesslyLoopable ? 1 : 0;
        this.state.setCurrentBeat(loopBackBeat);

        // Re-initialize engine if needed
        if (this.sequenceData) {
          this.animationEngine.initializeWithDomainData(this.sequenceData);
        }
      } else {
        // Stop at end
        this.state.setCurrentBeat(this.state.totalBeats);
        this.loopService.stop();
        this.state.setIsPlaying(false);
      }
    } else {
      this.state.setCurrentBeat(newBeat);
    }

    // Calculate state for current beat
    this.animationEngine.calculateState(this.state.currentBeat);

    // Update prop states
    this.updatePropStatesFromEngine();
  }

  private updatePropStatesFromEngine(): void {
    if (!this.state) return;

    const states = this.animationEngine.getCurrentPropStates();

    this.state.setPropStates(states.blue, states.red);
  }
}

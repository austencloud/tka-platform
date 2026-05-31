/**
 * Animation Playback Controller Implementation
 *
 * Orchestrates animation playback by coordinating:
 * - Animation engine (state calculations)
 * - Loop service (timing and frames)
 * - Panel state (UI updates)
 * - Shared animation state (for workspace beat grid sync)
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { PropState } from "$lib/shared/foundation/domain/types/prop-state";
import type { AnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
import type { AnimationLoop } from "$lib/shared/animation-engine/services/animation-loop";
import type { SequenceAnimationOrchestrator } from "$lib/shared/animation-engine/services/sequence-animation-orchestrator";
import { isSeamlesslyLoopable } from "$lib/shared/foundation/services/sequence-loopability-checker";
import { sharedAnimationState } from "$lib/shared/animation-engine/state/shared-animation-state.svelte";
import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";

export class AnimationPlaybackController {
  private state: AnimationPanelState | null = null;
  private sequenceData: SequenceData | null = null;
  private _isSeamlesslyLoopable: boolean = false;

  // Step playback (auto-step) state
  private stepPlaybackTimer: ReturnType<typeof setTimeout> | null = null;
  private stepPlaybackRunId = 0;

  // Animation-to-beat state
  private animationTarget: number | null = null;
  private animationStartStep: number = 0;
  private animationStartTime: number = 0;
  private animationDuration: number = 300; // ms
  private useLinearAnimation: boolean = false;

  // Duration-aware timing: track time position separately from beat number
  // timePosition: 0 to totalDuration (accounts for variable beat durations)
  // currentStep in state: 0 for start pos, 1+ for motion beats (for UI display)
  private timePosition: number = 0;
  private totalDuration: number = 0; // Includes start position duration

  // Track if this is the first loop (for loopable sequences that skip start pos on subsequent loops)
  private isFirstLoop: boolean = true;

  // End position hold duration for freeform (non-looping) sequences
  // Adds a 1-step pause at the end position so the user can see the final state
  private endPositionHoldDuration: number = 0;

  // Loop completion callback (used by tempo practice training)
  private loopCompleteCallback: (() => void) | null = null;

  constructor(
    private readonly animationEngine: SequenceAnimationOrchestrator,
    private readonly loopService: AnimationLoop
  ) {}

  /**
   * Sync current beat to both internal state and shared state (for workspace beat grid sync)
   */
  private syncCurrentStep(step: number): void {
    this.state?.setCurrentStep(step);
    sharedAnimationState.setCurrentStep(step);
  }

  /**
   * Sync playing state to both internal state and shared state (for workspace beat grid sync)
   */
  private syncIsPlaying(playing: boolean): void {
    this.state?.setIsPlaying(playing);
    sharedAnimationState.setIsPlaying(playing);
  }

  initialize(sequenceData: SequenceData, state: AnimationPanelState): boolean {
    this.state = state;
    this.sequenceData = sequenceData;

    // Check if sequence is seamlessly loopable
    this._isSeamlesslyLoopable =
      isSeamlesslyLoopable(sequenceData);

    // Initialize animation engine with sequence data
    const success = this.animationEngine.initializeWithDomainData(sequenceData);
    if (!success) {
      return false;
    }

    // Get metadata from engine
    const metadata = this.animationEngine.getMetadata();
    state.setTotalSteps(metadata.totalSteps);
    state.setSequenceMetadata(metadata.word, metadata.author);

    // Store total duration for duration-aware playback (includes start position)
    // For freeform sequences, add 1-step end position hold so the user can see the final state
    this.endPositionHoldDuration = this._isSeamlesslyLoopable ? 0 : 1;
    this.totalDuration = this.animationEngine.getTotalDurationWithStartPosition() + this.endPositionHoldDuration;
    this.timePosition = 0;
    this.isFirstLoop = true;

    // Set sequence data on state (data arrives already normalized from SequenceService)
    state.setSequenceData(sequenceData);

    // Reset playback state (sync to shared state for beat grid highlighting)
    this.syncCurrentStep(0);
    this.syncIsPlaying(false);

    // Update prop states from initial initialization
    this.updatePropStatesFromEngine();

    return true;
  }

  updateSequenceData(sequenceData: SequenceData): void {
    if (!this.state) return;

    // Store current playback state
    const wasPlaying = this.state.isPlaying;
    const currentTimePos = this.timePosition;

    // Update stored sequence data
    this.sequenceData = sequenceData;

    // Check if sequence is seamlessly loopable
    this._isSeamlesslyLoopable =
      isSeamlesslyLoopable(sequenceData);

    // Re-initialize animation engine with updated data
    const success = this.animationEngine.initializeWithDomainData(sequenceData);
    if (!success) {
      console.warn("AnimationPlaybackController: Failed to update sequence data");
      return;
    }

    // Update metadata
    const metadata = this.animationEngine.getMetadata();
    this.state.setTotalSteps(metadata.totalSteps);
    this.state.setSequenceMetadata(metadata.word, metadata.author);

    // Update total duration (includes start position + end hold for freeform sequences)
    this.endPositionHoldDuration = this._isSeamlesslyLoopable ? 0 : 1;
    this.totalDuration = this.animationEngine.getTotalDurationWithStartPosition() + this.endPositionHoldDuration;

    // Clamp time position to new duration range
    this.timePosition = Math.min(currentTimePos, this.totalDuration);

    // Update sequence data on state
    this.state.setSequenceData(sequenceData);

    // Restore playback state
    if (wasPlaying) {
      // Calculate current state at the clamped time position
      const currentStepNumber = this.animationEngine.calculateStateDurationAware(this.timePosition);
      this.syncCurrentStep(currentStepNumber);
      this.updatePropStatesFromEngine();
    } else {
      // Just update prop states at current position
      this.updatePropStatesFromEngine();
    }
  }

  togglePlayback(): void {
    if (!this.state) return;

    if (this.state.isPlaying) {
      // Pause - clear animationTarget so resuming doesn't hit the
      // "already animating to this target" early-return in animateToStepInternal
      this.animationTarget = null;
      this.stopStepPlayback();
      this.loopService.stop();
      this.syncIsPlaying(false);
    } else {
      // Play
      if (this.state.playbackMode === "step") {
        this.startStepPlayback();
      } else {
        this.syncIsPlaying(true);
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
    this.syncIsPlaying(false);

    // Reset to start (both time position and beat number)
    this.timePosition = 0;
    this.syncCurrentStep(0);
    this.isFirstLoop = true;

    // Re-initialize engine if we have sequence data
    if (this.sequenceData) {
      this.animationEngine.initializeWithDomainData(this.sequenceData);
      this.totalDuration = this.animationEngine.getTotalDurationWithStartPosition() + this.endPositionHoldDuration;
    }

    // Update prop states
    this.updatePropStatesFromEngine();
  }

  jumpToStep(step: number): void {
    if (!this.state) return;

    // Stop any current playback/animation
    this.stopStepPlayback();
    this.loopService.stop();
    this.syncIsPlaying(false);
    this.animationTarget = null;

    // Clamp step to valid range
    const clampedStep = Math.max(0, Math.min(step, this.state.totalSteps));
    this.syncCurrentStep(clampedStep);

    // Sync time position so continuous playback starts from here
    this.timePosition = this.animationEngine.getTimePositionForBeat(clampedStep);

    // Calculate state for this beat
    this.animationEngine.calculateState(clampedStep);
    this.updatePropStatesFromEngine();
  }

  seekToStep(step: number): void {
    if (!this.state) return;

    // Cancel any animated seek in progress
    this.animationTarget = null;

    // Clamp step to valid range
    const clampedStep = Math.max(0, Math.min(step, this.state.totalSteps));

    // If the caller passed an integer beat (e.g. step-cell click), preserve
    // the current fractional offset so playback continues smoothly from the
    // analogous moment of the new beat. If the caller passed a fractional
    // beat (e.g. scrubbing the transport bar), honor that exact position -
    // mixing in the old fraction would snap the scrubber unpredictably.
    const isIntegerBeat = clampedStep === Math.floor(clampedStep);
    const currentFraction = isIntegerBeat
      ? this.state.currentStep - Math.floor(this.state.currentStep)
      : 0;
    const targetStepWithFraction = clampedStep + currentFraction;

    this.syncCurrentStep(targetStepWithFraction);

    // Sync time position to match the fractional beat position
    this.timePosition = this.animationEngine.getTimePositionForBeat(targetStepWithFraction);

    // Calculate state for this beat (with fraction)
    this.animationEngine.calculateState(targetStepWithFraction);
    this.updatePropStatesFromEngine();

    // If was playing, the loop is still running and will continue from new position
    // No need to restart - the loop reads currentStep on each frame
  }

  animateToStep(
    step: number,
    duration: number = 300,
    linear: boolean = false
  ): void {
    this.animateToStepInternal(step, duration, linear, true);
  }

  private animateToStepInternal(
    step: number,
    duration: number,
    linear: boolean,
    cancelStepPlayback: boolean
  ): void {
    if (!this.state) return;

    if (cancelStepPlayback) {
      // Manual/one-shot animation should cancel step playback
      this.stopStepPlayback();
    }

    // Clamp target step to valid animation range
    // Allow totalSteps + 1 to show the final step's motion (which spans from totalSteps to totalSteps + 1)
    const clampedStep = Math.max(0, Math.min(step, this.state.totalSteps + 1));

    // If already animating to this target, don't restart
    if (this.animationTarget === clampedStep) {
      return;
    }

    // If already at target, just update state
    if (Math.abs(this.state.currentStep - clampedStep) < 0.01) {
      this.animationEngine.calculateState(clampedStep);
      this.updatePropStatesFromEngine();
      return;
    }

    // Stop any current playback/animation
    this.loopService.stop();
    if (cancelStepPlayback) {
      this.syncIsPlaying(false);
    }

    // Set up animation parameters
    this.animationTarget = clampedStep;
    this.animationStartStep = this.state.currentStep;
    this.animationStartTime = performance.now();
    this.animationDuration = duration;
    this.useLinearAnimation = linear;

    // Start the animation loop with a custom callback
    this.loopService.start(
      () => this.onAnimateToStepUpdate(),
      1.0 // Speed doesn't matter for time-based animation
    );
  }

  private onAnimateToStepUpdate(): void {
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
    const currentStep =
      this.animationStartStep +
      (this.animationTarget - this.animationStartStep) * interpolatedProgress;

    this.syncCurrentStep(currentStep);
    this.animationEngine.calculateState(currentStep);
    this.updatePropStatesFromEngine();

    // Check if animation is complete
    if (progress >= 1.0) {
      const finalStep = this.animationTarget;
      this.loopService.stop();
      this.animationTarget = null;
      // Ensure we're exactly at the target
      this.syncCurrentStep(finalStep);
      this.animationEngine.calculateState(finalStep);
      this.updatePropStatesFromEngine();

      // Sync time position so continuous playback starts from the stepped position
      this.timePosition = this.animationEngine.getTimePositionForBeat(finalStep);
    }
  }

  /**
   * Calculate animation duration based on speed multiplier and step size
   * Speed is a multiplier where 1.0 = 60 BPM, 2.0 = 120 BPM, etc.
   * @param stepSize Size of step in steps (0.5 or 1.0)
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

    const currentStep = this.state.currentStep;
    // Find next half-beat position (0, 0.5, 1, 1.5, 2, etc.)
    // Add small epsilon to handle exact positions (e.g., at 2.0, go to 2.5 not stay at 2.0)
    const nextHalfBeat = Math.ceil((currentStep + 0.001) * 2) / 2;

    // Allow stepping to totalSteps + 1 to show final beat's motion
    const animationEndStep = this.state.totalSteps + 1;
    if (nextHalfBeat <= animationEndStep) {
      this.animateToStep(nextHalfBeat, this.getStepDuration(0.5), true);
    }
  }

  stepHalfBeatBackward(): void {
    if (!this.state) return;

    this.stopStepPlayback();

    const currentStep = this.state.currentStep;
    // Find previous half-beat position (0, 0.5, 1, 1.5, 2, etc.)
    // Subtract small epsilon to handle exact positions (e.g., at 2.0, go to 1.5 not stay at 2.0)
    const prevHalfBeat = Math.floor((currentStep - 0.001) * 2) / 2;

    if (prevHalfBeat >= 0) {
      this.animateToStep(prevHalfBeat, this.getStepDuration(0.5), true);
    }
  }

  stepFullBeatForward(): void {
    if (!this.state) return;

    this.stopStepPlayback();

    const currentStep = this.state.currentStep;
    // Find next full-beat position (0, 1, 2, 3, etc.)
    const nextFullBeat = Math.ceil(currentStep + 0.001);

    // Allow stepping to totalSteps + 1 to show final beat's motion
    const animationEndStep = this.state.totalSteps + 1;
    if (nextFullBeat <= animationEndStep) {
      this.animateToStep(nextFullBeat, this.getStepDuration(1.0), true);
    }
  }

  stepFullBeatBackward(): void {
    if (!this.state) return;

    this.stopStepPlayback();

    const currentStep = this.state.currentStep;
    // Find previous full-beat position (0, 1, 2, 3, etc.)
    const prevFullBeat = Math.floor(currentStep - 0.001);

    if (prevFullBeat >= 0) {
      this.animateToStep(prevFullBeat, this.getStepDuration(1.0), true);
    }
  }

  // Deprecated - use stepHalfBeatForward() instead
  nextStep(): void {
    this.stepHalfBeatForward();
  }

  // Deprecated - use stepHalfBeatBackward() instead
  previousStep(): void {
    this.stepHalfBeatBackward();
  }

  setSpeed(speed: number): void {
    if (!this.state) return;

    this.state.setSpeed(speed);

    // Sync to global visibility manager so fire cache invalidates on BPM change.
    // Without this, the fire renderer reads stale speed from the global singleton
    // and keeps replaying cached frames recorded at the old BPM.
    getAnimationVisibilityManager().setSpeed(speed);

    // Update loop service if currently playing
    if (this.state.isPlaying) {
      this.loopService.setSpeed(speed);
    }
  }

  getCurrentPropStates(): { blue: PropState; red: PropState } {
    return this.animationEngine.getCurrentPropStates();
  }

  /**
   * PURE prop-state sampler at an arbitrary (fractional) step. Used by the
   * offscreen export renderer to over-sample trail sub-steps without mutating
   * playback state. Passthrough to the orchestrator's shared interpolation chain.
   */
  samplePropStateAt(step: number): { blue: PropState; red: PropState } {
    return this.animationEngine.samplePropStateAt(step);
  }

  onLoopComplete(callback: () => void): void {
    this.loopCompleteCallback = callback;
  }

  offLoopComplete(): void {
    this.loopCompleteCallback = null;
  }

  dispose(): void {
    this.stopStepPlayback();
    this.loopService.stop();
    // Clear shared animation state so workspace highlighting stops
    this.syncIsPlaying(false);
    this.loopCompleteCallback = null;
    this.state = null;
    this.sequenceData = null;
    this.timePosition = 0;
    this.totalDuration = 0;
    this.isFirstLoop = true;
  }

  /**
   * Whether the loaded sequence returns to its starting position
   */
  get isSeamlesslyLoopable(): boolean {
    return this._isSeamlesslyLoopable;
  }

  private startStepPlayback(): void {
    if (!this.state) return;

    this.stopStepPlayback();

    this.syncIsPlaying(true);
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

    const currentStep = this.state.currentStep;
    const nextStep =
      stepSize === 0.5
        ? Math.ceil((currentStep + 0.001) * 2) / 2
        : Math.ceil(currentStep + 0.001);

    // End reached - use totalSteps + 1 to allow final beat's motion to complete
    // (Beat N's motion spans from currentStep N to N+1)
    const animationEndStep = this.state.totalSteps + 1;
    if (nextStep > animationEndStep) {
      if (this.state.shouldLoop) {
        // Notify loop completion listener (used by tempo practice training)
        this.loopCompleteCallback?.();

        // Loop back to start without leaving "playing" state
        this.syncCurrentStep(0);
        if (this.sequenceData) {
          this.animationEngine.initializeWithDomainData(this.sequenceData);
        }
        this.animationEngine.calculateState(0);
        this.updatePropStatesFromEngine();

        // For seamlessly loopable sequences (circular), beat 0 is identical
        // to totalSteps, so immediately animate to the first step instead
        // of pausing at beat 0. This shows beat 1's motion without the
        // redundant pause at the start position.
        if (this._isSeamlesslyLoopable) {
          const duration = this.getStepDuration(stepSize);
          this.animateToStepInternal(stepSize, duration, true, false);
        }

        // Schedule next tick to continue looping
        // Use pause at start position (unless seamlessly loopable, where we animate immediately)
        const duration = this._isSeamlesslyLoopable
          ? this.getStepDuration(stepSize)
          : 0;
        const pauseMs = this.state.stepPlaybackPauseMs;
        const nextDelay = duration + pauseMs;

        this.stepPlaybackTimer = setTimeout(() => {
          this.runStepPlaybackTick(runId);
        }, nextDelay);
      } else {
        // Stay at the end position (after final beat's motion completed)
        // Don't reset currentStep - let it stay where the animation left it
        this.syncIsPlaying(false);
        return;
      }
    } else {
      const duration = this.getStepDuration(stepSize);
      this.animateToStepInternal(nextStep, duration, true, false);

      // If we just stepped to the animation end beat:
      // - Loopable sequences: loop immediately (no pause, it's not a real beat)
      // - Freeform sequences: pause at end position so user can see the final state
      const isAtAnimationEnd = nextStep >= animationEndStep;
      const pauseMs = isAtAnimationEnd
        ? (this._isSeamlesslyLoopable ? 0 : this.state.stepPlaybackPauseMs)
        : this.state.stepPlaybackPauseMs;
      const nextDelay = duration + pauseMs;

      this.stepPlaybackTimer = setTimeout(() => {
        this.runStepPlaybackTick(runId);
      }, nextDelay);
    }
  }

  private onAnimationUpdate(deltaTime: number): void {
    if (!this.state) return;

    // Duration-aware timing:
    // - deltaTime is adjusted by speed in AnimationLoopService
    // - We advance timePosition uniformly (in "duration units")
    // - At speed 1.0, 1 duration unit = 1 second
    // - The animation engine maps timePosition to the correct beat and progress
    const timeDelta = deltaTime / 1000; // Convert ms to seconds (= duration units at speed 1.0)
    const newTimePosition = this.timePosition + timeDelta;

    // Animation timing with duration-aware playback:
    // - timePosition 0 to startPosDuration: start position
    // - timePosition startPosDuration to totalDuration: motion beats
    //
    // Start position behavior:
    // - Loopable sequences: Show start position ONLY on first loop, skip on subsequent loops
    // - Freeform sequences: Show start position EVERY time when looping back

    if (newTimePosition > this.totalDuration) {
      if (this.state.shouldLoop) {
        // Get start position duration to know where motion beats begin
        const startPosDuration = this.animationEngine.getStartPositionDuration();

        // Mark that we've completed the first loop
        this.isFirstLoop = false;

        // Notify loop completion listener (used by tempo practice training)
        this.loopCompleteCallback?.();

        // For seamlessly loopable sequences: skip start position on subsequent loops
        // For freeform sequences: show start position every time
        this.timePosition = this._isSeamlesslyLoopable ? startPosDuration : 0;

        // Re-initialize engine if needed
        if (this.sequenceData) {
          this.animationEngine.initializeWithDomainData(this.sequenceData);
          this.totalDuration = this.animationEngine.getTotalDurationWithStartPosition() + this.endPositionHoldDuration;
        }
      } else {
        // Stop at end
        this.timePosition = this.totalDuration;
        this.loopService.stop();
        this.syncIsPlaying(false);
      }
    } else {
      this.timePosition = newTimePosition;
    }

    // Calculate state using duration-aware timing
    // Returns the beat number (0 for start pos, 1+ for motion beats) with fractional progress
    const currentStepNumber = this.animationEngine.calculateStateDurationAware(this.timePosition);

    // Sync the beat number (not time position) for UI highlighting
    // The beat number is what the StepGrid needs for highlighting
    this.syncCurrentStep(currentStepNumber);

    // Update prop states
    this.updatePropStatesFromEngine();
  }

  private updatePropStatesFromEngine(): void {
    if (!this.state) return;

    const states = this.animationEngine.getCurrentPropStates();

    this.state.setPropStates(states.blue, states.red);
  }

  /**
   * Calculate and update prop states for a specific beat without affecting playback.
   * Used when an external beat source (like composition state) drives the animation.
   */
  calculateStateForStep(step: number): void {
    if (!this.state) return;

    // Sync currentStep so the live UI (GlyphOverlay, step numbers) tracks the step
    this.syncCurrentStep(step);

    // Calculate state for the given step
    this.animationEngine.calculateState(step);

    // Update prop states on the animation panel state
    this.updatePropStatesFromEngine();
  }
}

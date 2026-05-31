/**
 * Sequence Animation Orchestrator
 *
 * Lightweight coordinator that orchestrates focused services.
 * Single responsibility: Coordinate animation services and manage sequence lifecycle.
 */

import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type {
  PropState,
  PropStates,
} from "$lib/shared/foundation/domain/types/PropState";
import type {
  SequenceData,
  SequenceMetadata,
} from "$lib/shared/foundation/domain/models/SequenceData";
import { getSettings } from "$lib/shared/application/state/app-state.svelte";
import type {
  AnimationStateManager,
  InterpolationResult,
} from "$lib/shared/animation-engine/services/animation-state-manager";
import {
  validateSteps,
  calculateBeatState,
  calculateTotalDuration,
  calculateBeatStateDurationAware,
  getStepStartTime,
} from "$lib/shared/animation-engine/services/step-calculator";
import {
  interpolatePropAngles,
  calculateInitialAngles,
} from "$lib/shared/animation-engine/services/prop-interpolator";
import { getAnimationVisibilityManager, type AnimationVisibilityStateManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import { applyEffort } from "$lib/shared/effort/domain/effort-easing-unified";
import { interpolatePhrase } from "$lib/shared/phrase-effort-lab/services/phrase-interpolator";
import { findPhraseAtBeat } from "$lib/shared/effort/domain/effort-timeline-types";
import type { EffortTimeline } from "$lib/shared/effort/domain/effort-timeline-types";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

/**
 * Lightweight Animation Orchestrator
 * Coordinates focused services instead of doing everything itself
 *
 * IMPORTANT: Start position is derived from steps[0]
 * - steps[0].startLocation/startOrientation = the initial pose before animation begins
 * - No separate startPosition field needed
 *
 * When currentStep < 1: We're at the start position (derived from steps[0])
 * When currentStep >= 1: We're at a motion beat (beat N uses this.steps[N-1])
 */
export class SequenceAnimationOrchestrator {
  // Motion steps (beat 1 = steps[0], beat 2 = steps[1], etc.)
  // Start position is derived from steps[0].startLocation/startOrientation
  private steps: readonly StepData[] = [];
  private totalSteps = 0; // Number of motion steps (NOT including start position)

  private hasMotionData = false;
  private missingMotionLogged = new Set<number>();
  private metadata: SequenceMetadata = { word: "", author: "", totalSteps: 0 };
  private effortTimeline: EffortTimeline | null = null;
  private visibilityManagerOverride: AnimationVisibilityStateManager | null = null;
  private initialized = false;
  private currentStepIndex = 0;
  private currentStepProgress = 0; // Sub-beat progress (0.0 to 1.0)
  private atStartPosition = true; // Track if we're at start position

  constructor(
    private readonly animationStateService: AnimationStateManager
  ) {}

  setVisibilityManager(vm: AnimationVisibilityStateManager): void {
    this.visibilityManagerOverride = vm;
  }

  protected getDefaultPropConfig(): { bluePropType: PropType; redPropType: PropType } {
    const settings = getSettings();
    return {
      bluePropType: settings.bluePropType || settings.propType || PropType.STAFF,
      redPropType: settings.redPropType || settings.propType || PropType.STAFF,
    };
  }

  /**
   * Initialize with domain sequence data (PURE DOMAIN!)
   * Data arrives already normalized from SequenceService
   *
   * Start position is derived from steps[0].startLocation/startOrientation
   * - No separate startPosition field needed
   * - steps: Motion steps (beat 1 = steps[0], beat 2 = steps[1], etc.)
   */
  initializeWithDomainData(sequenceData: SequenceData): boolean {
    try {
      // Start position is derived from steps[0] - no separate storage needed

      // Store motion steps (beat 1+). Filter out step 0 (start position) which
      // is handled separately by the start position duration logic. Including it
      // here would double-count it and shift all beat indices by one.
      const steps = (sequenceData.steps ?? [])
        .filter((step): step is StepData => !!step && step.stepNumber !== 0)
        .map((step, index) => ({
          ...step,
          stepNumber:
            typeof step.stepNumber === "number" ? step.stepNumber : index + 1,
          motions: step.motions ?? { blue: undefined, red: undefined },
        }));

      if (steps.length === 0) {
        // Don't throw - return false to indicate initialization failed
        // This is expected for sequences without motion data
        console.warn("SequenceAnimationOrchestrator: No steps found in sequence data");
        return false;
      }

      // Validate steps using focused service
      if (!validateSteps(steps)) {
        throw new Error("Invalid step data structure");
      }

      this.missingMotionLogged.clear();
      this.hasMotionData = steps.some(
        (step) => step?.motions?.blue || step?.motions?.red
      );

      // Extract metadata from domain data
      const propConfig = this.getDefaultPropConfig();

      this.metadata = {
        word: sequenceData.word || sequenceData.name || "",
        author:
          sequenceData.author ||
          (sequenceData.metadata?.["author"] as string) ||
          "",
        totalSteps: steps.length,
        bluePropType: propConfig.bluePropType,
        redPropType: propConfig.redPropType,
        gridMode: sequenceData.gridMode,
      };

      // Store effort timeline for phrase-level easing (if present).
      // creatorIntent.effortTimeline is the canonical location going forward;
      // fall back to the top-level field for sequences saved before the migration.
      this.effortTimeline = sequenceData.creatorIntent?.effortTimeline ?? sequenceData.effortTimeline ?? null;

      // Store motion steps - beat 1 is at index 0, beat 2 at index 1, etc.
      this.steps = steps;
      this.totalSteps = this.metadata.totalSteps;
      this.atStartPosition = true; // Start at start position

      this.initializePropStates();
      this.initialized = true;

      return true;
    } catch (error) {
      console.error(
        "SequenceAnimationOrchestrator: Failed to initialize:",
        error
      );
      return false;
    }
  }

  /**
   * Calculate animation state for given beat using focused services
   *
   * IMPORTANT: currentStep semantics
   * - currentStep < 1: We're at the start position (use startPosition data)
   * - currentStep >= 1: We're at a motion beat (beat N uses this.steps[N-1])
   */
  calculateState(currentStep: number): void {
    if (this.steps.length === 0 || this.totalSteps === 0) {
      console.warn("SequenceAnimationOrchestrator: No sequence data available");
      return;
    }

    // Check if we're at start position (before beat 1)
    this.atStartPosition = currentStep < 1;

    if (this.atStartPosition) {
      // At start position - derive from first beat's starting state
      this.currentStepIndex = 0;
      this.currentStepProgress = 0;

      const firstStep = this.steps[0];
      if (firstStep?.motions?.blue || firstStep?.motions?.red) {
        const initialAngles = calculateInitialAngles(firstStep);
        if (initialAngles.isValid) {
          if (initialAngles.blueAngles) {
            this.animationStateService.updateBluePropState({
              centerPathAngle: initialAngles.blueAngles.centerPathAngle,
              staffRotationAngle: initialAngles.blueAngles.staffRotationAngle,
            });
          }
          if (initialAngles.redAngles) {
            this.animationStateService.updateRedPropState({
              centerPathAngle: initialAngles.redAngles.centerPathAngle,
              staffRotationAngle: initialAngles.redAngles.staffRotationAngle,
            });
          }
        }
      }
      return;
    }

    // At a motion beat - adjust currentStep to use correct array index
    // Beat 1 uses steps[0], beat 2 uses steps[1], etc.
    const adjustedBeat = currentStep - 1;

    // Use focused service for beat calculations
    const stepState = calculateBeatState(
      adjustedBeat,
      this.steps,
      this.totalSteps
    );

    if (!stepState.isValid) {
      console.error("SequenceAnimationOrchestrator: Invalid beat state");
      return;
    }

    // Store current beat index and progress for trail rendering
    // Note: currentStepIndex here is the array index, not the beat number
    this.currentStepIndex = stepState.currentStepIndex;
    this.currentStepProgress = stepState.stepProgress;

    // Skip steps without ANY motion data (neither hand present) and log once
    const beatMotions = stepState.currentStepData?.motions;
    const hasStepMotions = beatMotions?.blue || beatMotions?.red;
    if (!hasStepMotions) {
      const key =
        stepState.currentStepData?.stepNumber ?? stepState.currentStepIndex;
      if (!this.missingMotionLogged.has(key)) {
        this.missingMotionLogged.add(key);
        console.warn(
          "SequenceAnimationOrchestrator: Skipping beat without motion data",
          {
            stepNumber: stepState.currentStepData?.stepNumber,
            stepIndex: stepState.currentStepIndex,
          }
        );
      }
      return;
    }

    // Run the PURE interpolation chain (shared with samplePropStateAt — DRY:
    // guarantees live render and over-sampled export never diverge).
    const interpolationResult = this.interpolateAtBeat(stepState);

    if (!interpolationResult?.isValid) {
      console.warn(
        "SequenceAnimationOrchestrator: Skipping beat without motion data",
        {
          stepNumber: stepState.currentStepData?.stepNumber,
          stepIndex: stepState.currentStepIndex,
        }
      );
      return;
    }

    // Use focused service to update prop states (the ONLY mutation).
    this.animationStateService.updatePropStates(interpolationResult);
  }

  /**
   * PURE interpolation chain for a resolved beat state.
   *
   * Extracted verbatim from calculateState's effort-timeline-vs-preset branch so
   * both the live render (calculateState, which mutates afterward) and the export
   * sampler (samplePropStateAt, which does not) share one source of truth.
   *
   * Reads no `this` mutable state beyond effortTimeline/visibility config; returns
   * an InterpolationResult and mutates nothing.
   */
  private interpolateAtBeat(
    stepState: ReturnType<typeof calculateBeatState>
  ): InterpolationResult | undefined {
    let interpolationResult: InterpolationResult | undefined;

    if (this.effortTimeline?.phrases?.length) {
      // Phrase mode: check if current beat falls within a phrase
      const currentStep = stepState.currentStepIndex + 1 + stepState.stepProgress; // 1-based
      const phrase = findPhraseAtBeat(this.effortTimeline, currentStep);

      if (phrase) {
        // Use phrase-level interpolation
        const phraseResult = interpolatePhrase(
          phrase, currentStep, this.steps.length,
        );
        const targetStep = this.steps[phraseResult.stepIndex];
        if (targetStep) {
          interpolationResult = interpolatePropAngles(
            targetStep, phraseResult.localProgress,
          );
        }
      } else {
        // Gap between phrases - use linear (no easing)
        interpolationResult = interpolatePropAngles(
          stepState.currentStepData, stepState.stepProgress,
        );
      }
    } else {
      // No effort timeline - existing behavior (global preset)
      const effortPreset = (this.visibilityManagerOverride ?? getAnimationVisibilityManager()).getEffortPreset();
      const easedProgress = applyEffort(effortPreset, stepState.stepProgress);
      interpolationResult = interpolatePropAngles(
        stepState.currentStepData, easedProgress,
      );
    }

    return interpolationResult;
  }

  /**
   * PURE sampler: compute interpolated prop state at an arbitrary (fractional)
   * step WITHOUT mutating the shared animation state. Built for the deterministic
   * video export, which over-samples sub-positions to build dense trails and must
   * not disturb the live render's shared state.
   *
   * Boundary: this covers ONLY the motion-beat interpolation path (step >= 1).
   * The start-position special case (step < 1) and the missing-motion skip in
   * calculateState mutate/short-circuit and are intentionally NOT represented
   * here — a sampler at those positions returns the zero default. Callers that
   * need start-position angles use calculateInitialAngles directly.
   */
  samplePropStateAt(step: number): { blue: PropState; red: PropState } {
    const fallback = (): { blue: PropState; red: PropState } => ({
      blue: { centerPathAngle: 0, staffRotationAngle: 0 },
      red: { centerPathAngle: 0, staffRotationAngle: 0 },
    });

    if (this.steps.length === 0 || this.totalSteps === 0 || step < 1) {
      return fallback();
    }

    // Same adjustedBeat + beat-state resolution calculateState uses (verbatim).
    const adjustedBeat = step - 1;
    const stepState = calculateBeatState(
      adjustedBeat,
      this.steps,
      this.totalSteps
    );

    if (!stepState.isValid) {
      return fallback();
    }

    const beatMotions = stepState.currentStepData?.motions;
    if (!(beatMotions?.blue || beatMotions?.red)) {
      return fallback();
    }

    const result = this.interpolateAtBeat(stepState);
    if (!result?.isValid) {
      return fallback();
    }

    return {
      blue: result.blueAngles ?? { centerPathAngle: 0, staffRotationAngle: 0 },
      red: result.redAngles ?? { centerPathAngle: 0, staffRotationAngle: 0 },
    };
  }

  /**
   * Get current prop states
   */
  getPropStates(): PropStates {
    return this.animationStateService.getPropStates();
  }

  /**
   * Get blue prop state
   */
  getBluePropState(): PropState {
    return this.animationStateService.getBluePropState();
  }

  /**
   * Get red prop state
   */
  getRedPropState(): PropState {
    return this.animationStateService.getRedPropState();
  }

  /**
   * Get current beat progress (0.0 to 1.0 within current beat)
   */
  getStepProgress(): number {
    return this.currentStepProgress;
  }

  /**
   * Get sequence metadata
   */
  getMetadata(): SequenceMetadata {
    return { ...this.metadata };
  }

  private findFirstBeatWithMotion(): StepData | null {
    return (
      this.steps.find((step) => step?.motions?.blue || step?.motions?.red) ??
      null
    );
  }

  /**
   * Initialize prop states using focused services
   * Uses first beat with motion data to derive initial pose
   */
  private initializePropStates(): void {
    // Use first beat with motion data to derive initial pose
    if (!this.steps || this.steps.length === 0) {
      console.warn(
        "SequenceAnimationOrchestrator: No steps available, using fallback"
      );
      this.animationStateService.resetPropStates();
      return;
    }

    const firstStepWithMotion = this.findFirstBeatWithMotion();

    if (!firstStepWithMotion) {
      console.warn(
        "SequenceAnimationOrchestrator: No steps with motion data, resetting prop states"
      );
      this.animationStateService.resetPropStates();
      return;
    }

    const initialAngles =
      calculateInitialAngles(firstStepWithMotion);

    if (initialAngles.isValid) {
      if (initialAngles.blueAngles) {
        this.animationStateService.updateBluePropState({
          centerPathAngle: initialAngles.blueAngles.centerPathAngle,
          staffRotationAngle: initialAngles.blueAngles.staffRotationAngle,
        });
      }
      if (initialAngles.redAngles) {
        this.animationStateService.updateRedPropState({
          centerPathAngle: initialAngles.redAngles.centerPathAngle,
          staffRotationAngle: initialAngles.redAngles.staffRotationAngle,
        });
      }
    } else {
      console.warn(
        "SequenceAnimationOrchestrator: Failed to calculate initial angles"
      );
      this.animationStateService.resetPropStates();
    }
  }

  /**
   * Get current prop states
   */
  getCurrentPropStates(): PropStates {
    return this.animationStateService.getPropStates();
  }

  /**
   * Get the letter for the current beat
   * At start position, returns steps[0]'s letter
   */
  getCurrentLetter(): Letter | null {
    if (!this.initialized || this.steps.length === 0) {
      return null;
    }

    // Clamp beat index to valid range (0 for start position, otherwise current beat)
    const stepIndex = Math.max(
      0,
      Math.min(this.currentStepIndex, this.steps.length - 1)
    );
    const currentStep = this.steps[stepIndex];

    return currentStep?.letter || null;
  }

  /**
   * Check if orchestrator is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if currently showing the start position (before beat 1)
   * Start position is conceptually different from steps - it's the pose held before animation begins
   */
  isAtStartPosition(): boolean {
    return this.atStartPosition;
  }

  /**
   * Get the total number of motion steps (NOT including start position)
   */
  getTotalBeats(): number {
    return this.totalSteps;
  }

  /**
   * Get the total duration of all steps (sum of individual beat durations).
   * Does NOT include start position duration.
   */
  getTotalDuration(): number {
    return calculateTotalDuration(this.steps);
  }

  /**
   * Get the duration of the start position (default: 1 beat).
   * Start position is shown as a beat before motion begins.
   */
  getStartPositionDuration(): number {
    return 1; // Start position always lasts 1 beat
  }

  /**
   * Get the total duration INCLUDING start position.
   * This is the proper "end time" for duration-aware playback.
   */
  getTotalDurationWithStartPosition(): number {
    return this.getStartPositionDuration() + this.getTotalDuration();
  }

  /**
   * Calculate animation state using duration-aware timing.
   * Maps a time position to the correct beat and progress within that beat,
   * accounting for variable beat durations.
   *
   * Timeline with start position:
   * - Time 0 to startPositionDuration: Start position (beat 0)
   * - Time startPositionDuration onwards: Motion beats (beat 1, 2, 3...)
   *
   * @param timePosition - Position in sequence time (0 to totalDurationWithStartPosition)
   * @returns The beat number (0 for start position, 1+ for motion beats), with fractional progress
   */
  calculateStateDurationAware(timePosition: number): number {
    if (this.steps.length === 0) {
      return 0;
    }

    const startPosDuration = this.getStartPositionDuration();

    // Time 0 to startPositionDuration = start position (beat 0)
    if (timePosition < startPosDuration) {
      this.calculateStartPositionState();
      // Return 0 with fractional progress within start position
      return timePosition / startPosDuration; // 0.0 to ~0.99
    }

    // Adjust time position to account for start position duration
    // Now timePosition is relative to after start position
    const adjustedTimePosition = timePosition - startPosDuration;

    // Use duration-aware beat calculation
    const stepState = calculateBeatStateDurationAware(
      adjustedTimePosition,
      this.steps
    );

    if (!stepState.isValid) {
      console.error("SequenceAnimationOrchestrator: Invalid beat state from duration-aware calculation");
      return 0;
    }

    // Store current beat index and progress
    this.currentStepIndex = stepState.currentStepIndex;
    this.currentStepProgress = stepState.stepProgress;
    this.atStartPosition = false;

    // Skip steps without ANY motion data (neither hand present)
    const beatMotions = stepState.currentStepData?.motions;
    const hasStepMotions = beatMotions?.blue || beatMotions?.red;
    if (!hasStepMotions) {
      const key = stepState.currentStepData?.stepNumber ?? stepState.currentStepIndex;
      if (!this.missingMotionLogged.has(key)) {
        this.missingMotionLogged.add(key);
        console.warn(
          "SequenceAnimationOrchestrator: Skipping beat without motion data",
          { stepNumber: stepState.currentStepData?.stepNumber, stepIndex: stepState.currentStepIndex }
        );
      }
      return stepState.currentStepIndex + 1; // Return 1-based beat number
    }

    // Determine interpolation based on effort timeline or global preset
    let interpolationResult;

    if (this.effortTimeline?.phrases?.length) {
      // Phrase mode: check if current beat falls within a phrase
      const currentStep = stepState.currentStepIndex + 1 + stepState.stepProgress; // 1-based
      const phrase = findPhraseAtBeat(this.effortTimeline, currentStep);

      if (phrase) {
        // Use phrase-level interpolation
        const phraseResult = interpolatePhrase(
          phrase, currentStep, this.steps.length,
        );
        const targetStep = this.steps[phraseResult.stepIndex];
        if (targetStep) {
          interpolationResult = interpolatePropAngles(
            targetStep, phraseResult.localProgress,
          );
        }
      } else {
        // Gap between phrases - use linear (no easing)
        interpolationResult = interpolatePropAngles(
          stepState.currentStepData, stepState.stepProgress,
        );
      }
    } else {
      // No effort timeline - existing behavior (global preset)
      const effortPreset = (this.visibilityManagerOverride ?? getAnimationVisibilityManager()).getEffortPreset();
      const easedProgress = applyEffort(effortPreset, stepState.stepProgress);
      interpolationResult = interpolatePropAngles(
        stepState.currentStepData, easedProgress,
      );
    }

    if (interpolationResult?.isValid) {
      this.animationStateService.updatePropStates(interpolationResult);
    }

    // Return 1-based beat number with fractional progress for UI updates
    return stepState.currentStepIndex + 1 + stepState.stepProgress;
  }

  /**
   * Helper to calculate start position state
   */
  private calculateStartPositionState(): void {
    this.atStartPosition = true;
    this.currentStepIndex = 0;
    this.currentStepProgress = 0;

    const firstStep = this.steps[0];
    if (firstStep?.motions?.blue || firstStep?.motions?.red) {
      const initialAngles = calculateInitialAngles(firstStep);
      if (initialAngles.isValid) {
        if (initialAngles.blueAngles) {
          this.animationStateService.updateBluePropState({
            centerPathAngle: initialAngles.blueAngles.centerPathAngle,
            staffRotationAngle: initialAngles.blueAngles.staffRotationAngle,
          });
        }
        if (initialAngles.redAngles) {
          this.animationStateService.updateRedPropState({
            centerPathAngle: initialAngles.redAngles.centerPathAngle,
            staffRotationAngle: initialAngles.redAngles.staffRotationAngle,
          });
        }
      }
    }
  }

  /**
   * Get the current step data (the beat being animated).
   * Returns null if at start position or not initialized.
   */
  getCurrentStepBeatData(): StepData | null {
    if (!this.initialized || this.atStartPosition) {
      return null;
    }
    const index = Math.max(0, Math.min(this.currentStepIndex, this.steps.length - 1));
    return this.steps[index] ?? null;
  }

  /**
   * Get the current beat index (0-based array index).
   * Returns -1 if at start position.
   */
  getCurrentStepIndex(): number {
    if (!this.initialized || this.atStartPosition) {
      return -1;
    }
    return this.currentStepIndex;
  }

  /**
   * Get the continuous musical position as a decimal.
   * Formula: stepNumber + (progress × duration)
   *
   * Example: Beat 2 with duration 2 at 50% progress = 2 + (0.5 × 2) = 3.0
   * Returns 0 if at start position.
   */
  getContinuousMusicalPosition(): number {
    if (!this.initialized || this.atStartPosition) {
      return 0;
    }

    const stepNumber = this.currentStepIndex + 1; // Convert 0-based to 1-based
    const stepData = this.steps[this.currentStepIndex];
    const duration = stepData?.duration ?? 1;

    // Musical position = stepNumber + (progress × duration)
    return stepNumber + this.currentStepProgress * duration;
  }

  /**
   * Convert a beat number (0 for start position, 1+ for motion beats) to a time position.
   * Handles fractional beats by interpolating within the beat's duration.
   *
   * Timeline with start position:
   * - Beat 0 to <1: Start position
   * - Beat 1+: Motion beats
   *
   * @param beat - The beat number (0 for start pos, 1-based for motion, can be fractional)
   * @returns The time position in duration units
   */
  getTimePositionForBeat(beat: number): number {
    if (this.steps.length === 0) {
      return 0;
    }

    const startPosDuration = this.getStartPositionDuration();

    // Beat 0 to <1 = within start position
    if (beat < 1) {
      return beat * startPosDuration; // 0 to startPosDuration
    }

    // Beat 1+ = motion beats
    // Get the integer beat index (0-based) and fractional progress
    const stepNumber = Math.floor(beat) - 1; // Convert 1-based to 0-based
    const beatProgress = beat - Math.floor(beat);

    // Calculate time position: startPosDuration + sum of all previous beat durations + progress
    let timePosition = startPosDuration + getStepStartTime(stepNumber, this.steps);

    // Add progress within current beat
    if (stepNumber >= 0 && stepNumber < this.steps.length) {
      const currentStepDuration = this.steps[stepNumber]?.duration ?? 1;
      timePosition += beatProgress * currentStepDuration;
    }

    return timePosition;
  }

  /**
   * Update the prop types used for rendering without full re-initialization.
   * Called when the user toggles between creator-intent and viewer props.
   */
  updatePropTypes(bluePropType: PropType, redPropType: PropType): void {
    if (!this.initialized) return;
    this.metadata = {
      ...this.metadata,
      bluePropType,
      redPropType,
    };
    // Re-initialize prop states so the canvas renders with the new prop visuals
    this.initializePropStates();
  }

  /**
   * Dispose of resources and reset state
   */
  dispose(): void {
    this.steps = [];
    this.totalSteps = 0;
    this.metadata = { word: "", author: "", totalSteps: 0 };
    this.effortTimeline = null;
    this.initialized = false;
    this.currentStepIndex = 0;
    this.atStartPosition = true;
    this.animationStateService.resetPropStates();
  }
}

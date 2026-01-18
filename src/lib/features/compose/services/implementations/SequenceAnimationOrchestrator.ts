/**
 * Sequence Animation Orchestrator
 *
 * Lightweight coordinator that orchestrates focused services.
 * Single responsibility: Coordinate animation services and manage sequence lifecycle.
 */

import type { StepData } from "../../../create/shared/domain/models/StepData";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type {
  PropState,
  PropStates,
} from "../../shared/domain/types/PropState";
import type {
  SequenceData,
  SequenceMetadata,
} from "$lib/shared/foundation/domain/models/SequenceData";
import { getSettings } from "$lib/shared/application/state/app-state.svelte";
import type { IAnimationStateManager } from "../contracts/IAnimationStateManager";
import type { IStepCalculator } from "../contracts/IStepCalculator";
import type { IPropInterpolator } from "../contracts/IPropInterpolator";
import type { ISequenceAnimationOrchestrator } from "../contracts/ISequenceAnimationOrchestrator";

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
export class SequenceAnimationOrchestrator implements ISequenceAnimationOrchestrator {
  // Motion steps (beat 1 = steps[0], beat 2 = steps[1], etc.)
  // Start position is derived from steps[0].startLocation/startOrientation
  private steps: readonly StepData[] = [];
  private totalSteps = 0; // Number of motion steps (NOT including start position)

  private hasMotionData = false;
  private missingMotionLogged = new Set<number>();
  private metadata: SequenceMetadata = { word: "", author: "", totalSteps: 0 };
  private initialized = false;
  private currentStepIndex = 0;
  private currentStepProgress = 0; // Sub-beat progress (0.0 to 1.0)
  private atStartPosition = true; // Track if we're at start position

  constructor(
    private readonly animationStateService: IAnimationStateManager,
    private readonly stepCalculationService: IStepCalculator,
    private readonly propInterpolationService: IPropInterpolator
  ) {}

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

      // Store motion steps (beat 1+)
      const steps = (sequenceData.steps ?? [])
        .filter((beat): beat is StepData => !!beat)
        .map((beat, index) => ({
          ...beat,
          stepNumber:
            typeof beat.stepNumber === "number" ? beat.stepNumber : index + 1,
          motions: beat.motions ?? { blue: undefined, red: undefined },
        }));

      if (steps.length === 0) {
        throw new Error("No steps found in sequence data");
      }

      // Validate steps using focused service
      if (!this.stepCalculationService.validateBeats(steps)) {
        throw new Error("Invalid beat data structure");
      }

      this.missingMotionLogged.clear();
      this.hasMotionData = steps.some(
        (beat) => beat?.motions?.blue && beat?.motions?.red
      );

      // Extract metadata from domain data
      // Get per-color prop types from settings
      const settings = getSettings();

      this.metadata = {
        word: sequenceData.word || sequenceData.name || "",
        author:
          sequenceData.author ||
          (sequenceData.metadata?.["author"] as string) ||
          "",
        totalSteps: steps.length, // Number of motion steps (NOT including start position)
        // propType removed from sequences - use settings (viewer preference)
        bluePropType: settings.bluePropType || settings.propType,
        redPropType: settings.redPropType || settings.propType,
        gridMode: sequenceData.gridMode,
      };

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
      if (firstStep?.motions?.blue && firstStep?.motions?.red) {
        const initialAngles =
          this.propInterpolationService.calculateInitialAngles(firstStep);
        if (initialAngles.isValid) {
          this.animationStateService.setPropStates(
            {
              centerPathAngle: initialAngles.blueAngles.centerPathAngle,
              staffRotationAngle: initialAngles.blueAngles.staffRotationAngle,
            },
            {
              centerPathAngle: initialAngles.redAngles.centerPathAngle,
              staffRotationAngle: initialAngles.redAngles.staffRotationAngle,
            }
          );
        }
      }
      return;
    }

    // At a motion beat - adjust currentStep to use correct array index
    // Beat 1 uses steps[0], beat 2 uses steps[1], etc.
    const adjustedBeat = currentStep - 1;

    // Use focused service for beat calculations
    const stepState = this.stepCalculationService.calculateBeatState(
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

    // Skip steps without motion data (common in legacy/shared URLs) and log once
    const beatMotions = stepState.currentStepData?.motions;
    const hasBeatMotions = beatMotions?.blue && beatMotions?.red;
    if (!hasBeatMotions) {
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

    // Use focused service for interpolation
    const interpolationResult =
      this.propInterpolationService.interpolatePropAngles(
        stepState.currentStepData,
        stepState.stepProgress
      );

    if (!interpolationResult.isValid) {
      console.warn(
        "SequenceAnimationOrchestrator: Skipping beat without motion data",
        {
          stepNumber: stepState.currentStepData?.stepNumber,
          stepIndex: stepState.currentStepIndex,
        }
      );
      return;
    }

    // Use focused service to update prop states
    this.animationStateService.updatePropStates(interpolationResult);
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
  getBeatProgress(): number {
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
      this.steps.find((beat) => beat?.motions?.blue && beat?.motions?.red) ??
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

    const firstBeatWithMotion = this.findFirstBeatWithMotion();

    if (!firstBeatWithMotion) {
      console.warn(
        "SequenceAnimationOrchestrator: No steps with motion data, resetting prop states"
      );
      this.animationStateService.resetPropStates();
      return;
    }

    const initialAngles =
      this.propInterpolationService.calculateInitialAngles(firstBeatWithMotion);

    if (initialAngles.isValid) {
      this.animationStateService.setPropStates(
        {
          centerPathAngle: initialAngles.blueAngles.centerPathAngle,
          staffRotationAngle: initialAngles.blueAngles.staffRotationAngle,
        },
        {
          centerPathAngle: initialAngles.redAngles.centerPathAngle,
          staffRotationAngle: initialAngles.redAngles.staffRotationAngle,
        }
      );
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
   * This is the proper "end time" for duration-aware playback.
   */
  getTotalDuration(): number {
    return this.stepCalculationService.calculateTotalDuration(this.steps);
  }

  /**
   * Calculate animation state using duration-aware timing.
   * Maps a time position to the correct beat and progress within that beat,
   * accounting for variable beat durations.
   *
   * @param timePosition - Position in sequence time (0 to totalDuration)
   * @returns The beat number (1-based) currently being animated, for UI sync
   */
  calculateStateDurationAware(timePosition: number): number {
    if (this.steps.length === 0) {
      return 0;
    }

    // Time position 0 to ~1 (first beat's duration) = start position / first beat
    // We use a small threshold to determine if we're at the start position
    const totalDuration = this.getTotalDuration();
    const firstBeatDuration = this.steps[0]?.duration ?? 1;

    // At start position if timePosition < first beat duration threshold
    // (using 0.01 as threshold to handle floating point)
    if (timePosition < 0.01) {
      this.calculateStartPositionState();
      return 0;
    }

    // Use duration-aware beat calculation
    const stepState = this.stepCalculationService.calculateBeatStateDurationAware(
      timePosition,
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

    // Skip steps without motion data
    const beatMotions = stepState.currentStepData?.motions;
    const hasBeatMotions = beatMotions?.blue && beatMotions?.red;
    if (!hasBeatMotions) {
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

    // Use focused service for interpolation
    const interpolationResult = this.propInterpolationService.interpolatePropAngles(
      stepState.currentStepData,
      stepState.stepProgress
    );

    if (interpolationResult.isValid) {
      this.animationStateService.updatePropStates(interpolationResult);
    }

    // Return 1-based beat number WITH fractional progress for smooth UI updates
    // e.g., beat 2 at 50% progress returns 2.5 (not just 2)
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
    if (firstStep?.motions?.blue && firstStep?.motions?.red) {
      const initialAngles = this.propInterpolationService.calculateInitialAngles(firstStep);
      if (initialAngles.isValid) {
        this.animationStateService.setPropStates(
          {
            centerPathAngle: initialAngles.blueAngles.centerPathAngle,
            staffRotationAngle: initialAngles.blueAngles.staffRotationAngle,
          },
          {
            centerPathAngle: initialAngles.redAngles.centerPathAngle,
            staffRotationAngle: initialAngles.redAngles.staffRotationAngle,
          }
        );
      }
    }
  }

  /**
   * Get the current beat data (the beat being animated).
   * Returns null if at start position or not initialized.
   */
  getCurrentBeatData(): StepData | null {
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
   * Dispose of resources and reset state
   */
  dispose(): void {
    this.steps = [];
    this.totalSteps = 0;
    this.metadata = { word: "", author: "", totalSteps: 0 };
    this.initialized = false;
    this.currentStepIndex = 0;
    this.atStartPosition = true;
    this.animationStateService.resetPropStates();
  }
}

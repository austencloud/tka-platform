/**
 * Step Grid Display State Factory
 *
 * Svelte 5 runes-based state management for step grid display animations.
 * Handles entrance/exit animations, sequential reveals, and animation coordination.
 * This is for DISPLAY animations (how steps appear in grid), NOT playback animations.
 */

import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type {
  AnimationMode,
  AnimationTiming,
  StepLetterAnimatedEvent,
} from "../domain/models/step-grid-display-models";
import { DEFAULT_ANIMATION_TIMING } from "../domain/models/step-grid-display-models";

export interface PictographArrivalRequest {
  stepIndex: number;
  requestId: number;
  owner: "stage" | "cell";
  phase: "preview" | "landing";
}

/**
 * Global flag to indicate a generation is pending.
 * This is set when the prepare-sequence-animation event fires, BEFORE the StepGrid
 * component might be mounted (since the workspace transitions from empty to visible).
 * Used to distinguish between:
 * - First generation: flag is true, should animate
 * - Loading saved sequence: flag is false, should NOT animate
 */
let pendingGenerationAnimation = false;

export function setPendingGenerationAnimation(pending: boolean) {
  pendingGenerationAnimation = pending;
}

export function isPendingGenerationAnimation(): boolean {
  return pendingGenerationAnimation;
}

/**
 * When true, the next sequence change should NOT trigger entrance animations.
 * Set by undo/redo/jumpToState before restoring a sequence so that the grid
 * renders the restored state instantly instead of playing the generation animation.
 */
let suppressNextAnimation = false;

export function setSuppressNextAnimation(suppress: boolean) {
  suppressNextAnimation = suppress;
}

export function consumeSuppressNextAnimation(): boolean {
  if (suppressNextAnimation) {
    suppressNextAnimation = false;
    return true;
  }
  return false;
}

/**
 * Create step grid display animation state
 */
export function createStepGridDisplayState() {
  // Animation state
  let newlyAddedStepIndex = $state<number | null>(null);
  let shouldAnimateAllSteps = $state<boolean>(false);
  let shouldAnimateStartPosition = $state<boolean>(false);
  let isSequentialMode = $state<boolean>(true); // Default to sequential
  let stepsToAnimate = $state<Set<number>>(new Set());
  let isPreparingFullAnimation = $state<boolean>(false);
  let isWaitingForSequentialAnimation = $state<boolean>(false);
  let isClearingForGeneration = $state<boolean>(false);

  // Construct gives one committed step the workspace stage, then hands the
  // finished pictograph to its grid cell. Keeping both owners in one request
  // guarantees that only one of them is visible at a time.
  let arrivalRequest = $state<PictographArrivalRequest | null>(null);
  let nextArrivalRequestId = 0;

  // Animation generation counter - used to cancel previous animations when a new one starts
  // Each new animation increments this, and running animations check if they're still current
  let animationGeneration = 0;

  // Animation epoch - increments each time a NEW sequence animation starts
  // This is exposed to components so they can reset hasAnimated when a new epoch begins
  // (even if beat.id stays the same across generations)
  let animationEpoch = $state(0);

  // Animation timing configuration
  let animationTiming = $state<AnimationTiming>({
    ...DEFAULT_ANIMATION_TIMING,
  });

  /**
   * Set animation mode (sequential vs all-at-once)
   */
  function setAnimationMode(mode: AnimationMode) {
    isSequentialMode = mode === "sequential";
  }

  /**
   * Prepare for full sequence animation
   * Called BEFORE new sequence is set
   */
  function prepareSequenceAnimation(_stepCount: number, mode: AnimationMode) {
    arrivalRequest = null;
    // Increment epoch to signal all StepCells to reset their hasAnimated state
    // This is critical when beat IDs are reused across generations (e.g., beat-5, beat-6)
    animationEpoch++;

    // Set animation state IMMEDIATELY so steps render invisible
    isPreparingFullAnimation = true;
    shouldAnimateStartPosition = true;
    newlyAddedStepIndex = null;

    if (mode === "sequential") {
      // Sequential mode: Start with empty stepsToAnimate
      shouldAnimateAllSteps = false;
      stepsToAnimate.clear();
      isWaitingForSequentialAnimation = true;
    } else {
      // All at once mode: All steps animate immediately
      shouldAnimateAllSteps = true;
      stepsToAnimate.clear();
      isWaitingForSequentialAnimation = false;
    }
  }

  /**
   * Prepare for cycle extension animation (only new beats from offset onward).
   * Existing beats stay visible and untouched.
   */
  function prepareCycleExtensionAnimation(
    totalBeatCount: number,
    existingBeatCount: number
  ) {
    arrivalRequest = null;
    // Increment epoch so new StepCells know to animate
    animationEpoch++;

    // DO NOT set isPreparingFullAnimation - existing beats must stay visible
    isPreparingFullAnimation = false;
    shouldAnimateStartPosition = false;
    shouldAnimateAllSteps = false;
    newlyAddedStepIndex = null;

    // Mark only the new beats (from existingBeatCount onward) as waiting
    stepsToAnimate.clear();
    // Pre-populate existing beats so they're not hidden
    for (let i = 0; i < existingBeatCount; i++) {
      stepsToAnimate.add(i);
    }
    stepsToAnimate = new Set(stepsToAnimate);

    isWaitingForSequentialAnimation = true;
  }

  /**
   * Trigger sequential animation with progressive reveal
   */
  async function triggerSequentialAnimation(
    steps: readonly StepData[],
    dispatchEvent: (event: CustomEvent) => void,
    startFromIndex: number = 0
  ): Promise<void> {
    // Increment generation to cancel any previous running animation
    const thisGeneration = ++animationGeneration;
    const stepCount = steps.length;

    // Small delay to ensure DOM has updated
    await new Promise((resolve) =>
      setTimeout(resolve, animationTiming.sequentialDelay / 6)
    );

    // Check if this animation was superseded by a newer one
    if (thisGeneration !== animationGeneration) {
      cleanupAnimation();
      return;
    }

    // Trigger steps sequentially (from startFromIndex onward)
    for (let i = startFromIndex; i < stepCount; i++) {
      // Check if this animation was superseded by a newer one
      if (thisGeneration !== animationGeneration) {
        cleanupAnimation();
        return;
      }

      // Add this beat to stepsToAnimate to trigger its animation
      stepsToAnimate.add(i);
      stepsToAnimate = new Set(stepsToAnimate); // Trigger reactivity

      // Dispatch event with the letter from this beat
      const beat = steps[i];
      if (beat?.letter) {
        const event = new CustomEvent<StepLetterAnimatedEvent>(
          "beat-letter-animated",
          {
            detail: {
              stepIndex: i,
              letter: beat.letter,
              totalSteps: stepCount,
            },
            bubbles: true,
          }
        );
        dispatchEvent(event);
      }

      // Wait before next beat
      await new Promise((resolve) =>
        setTimeout(resolve, animationTiming.sequentialDelay)
      );
    }

    // Only proceed if this animation is still current
    if (thisGeneration !== animationGeneration) {
      cleanupAnimation();
      return;
    }

    // Dispatch completion event
    const completeEvent = new CustomEvent("sequential-animation-complete", {
      detail: { totalSteps: stepCount },
      bubbles: true,
    });
    dispatchEvent(completeEvent);

    // Clear animation state after all steps have animated
    setTimeout(() => {
      // Only cleanup if this animation is still current
      if (thisGeneration === animationGeneration) {
        cleanupAnimation();
      }
    }, animationTiming.cleanupDelay);
  }

  /**
   * Trigger all-at-once animation
   */
  function triggerAllAtOnceAnimation() {
    // Increment generation to cancel any previous running animation
    const thisGeneration = ++animationGeneration;

    // All steps already set to animate via shouldAnimateAllSteps
    // Just clean up after animation duration
    setTimeout(() => {
      // Only cleanup if this animation is still current
      if (thisGeneration === animationGeneration) {
        cleanupAnimation();
      }
    }, animationTiming.cleanupDelay);
  }

  /**
   * Handle single beat addition (Construct mode)
   */
  function handleSingleBeatAddition(
    stepIndex: number,
    shouldStageArrival: boolean = false
  ) {
    isPreparingFullAnimation = false;
    newlyAddedStepIndex = stepIndex;
    shouldAnimateAllSteps = false;
    shouldAnimateStartPosition = false;
    stepsToAnimate.clear();
    arrivalRequest = shouldStageArrival
      ? {
          stepIndex,
          requestId: ++nextArrivalRequestId,
          owner: "stage",
          phase: "preview",
        }
      : null;

    // Clear after animation completes
    setTimeout(() => {
      newlyAddedStepIndex = null;
    }, animationTiming.entranceDuration);
  }

  function beginArrivalLanding(requestId: number) {
    if (!arrivalRequest || arrivalRequest.requestId !== requestId) return;
    arrivalRequest = { ...arrivalRequest, phase: "landing" };
  }

  function beginArrivalHandoff(requestId: number) {
    if (!arrivalRequest || arrivalRequest.requestId !== requestId) return;
    arrivalRequest = { ...arrivalRequest, owner: "cell" };
  }

  function completeArrival(requestId: number) {
    if (!arrivalRequest || arrivalRequest.requestId !== requestId) return;
    arrivalRequest = null;
  }

  function cancelArrival() {
    arrivalRequest = null;
  }

  /**
   * Handle sequence clearing animation
   */
  function handleClearSequence() {
    arrivalRequest = null;
    isClearingForGeneration = true;

    // Reset after animation completes
    setTimeout(() => {
      isClearingForGeneration = false;
    }, animationTiming.clearDuration);
  }

  /**
   * Clean up animation state
   */
  function cleanupAnimation() {
    isPreparingFullAnimation = false;
    isWaitingForSequentialAnimation = false;
    shouldAnimateStartPosition = false;
    shouldAnimateAllSteps = false;
    stepsToAnimate.clear();
    arrivalRequest = null;
  }

  /**
   * Check if a beat should animate
   */
  function shouldBeatAnimate(stepIndex: number): boolean {
    return (
      shouldAnimateAllSteps ||
      stepIndex === newlyAddedStepIndex ||
      stepsToAnimate.has(stepIndex)
    );
  }

  /**
   * Check if a beat should be hidden (sequential mode waiting)
   */
  function shouldBeatBeHidden(stepIndex: number): boolean {
    if (!isWaitingForSequentialAnimation) return false;
    // If this step has already been revealed, don't hide it
    if (stepsToAnimate.has(stepIndex)) return false;
    return true;
  }

  /**
   * Update animation timing configuration
   */
  function setAnimationTiming(timing: Partial<AnimationTiming>) {
    animationTiming = { ...animationTiming, ...timing };
  }

  return {
    // Getters for reactive state
    get newlyAddedStepIndex() {
      return newlyAddedStepIndex;
    },
    get shouldAnimateAllSteps() {
      return shouldAnimateAllSteps;
    },
    get shouldAnimateStartPosition() {
      return shouldAnimateStartPosition;
    },
    get isSequentialMode() {
      return isSequentialMode;
    },
    get stepsToAnimate() {
      return stepsToAnimate;
    },
    get isPreparingFullAnimation() {
      return isPreparingFullAnimation;
    },
    get isWaitingForSequentialAnimation() {
      return isWaitingForSequentialAnimation;
    },
    get isClearingForGeneration() {
      return isClearingForGeneration;
    },
    get animationTiming() {
      return animationTiming;
    },
    get animationEpoch() {
      return animationEpoch;
    },
    get arrivalRequest() {
      return arrivalRequest;
    },

    // Actions
    setAnimationMode,
    prepareSequenceAnimation,
    prepareCycleExtensionAnimation,
    triggerSequentialAnimation,
    triggerAllAtOnceAnimation,
    handleSingleBeatAddition,
    beginArrivalLanding,
    beginArrivalHandoff,
    completeArrival,
    cancelArrival,
    handleClearSequence,
    cleanupAnimation,
    shouldBeatAnimate,
    shouldBeatBeHidden,
    setAnimationTiming,
  };
}

export type StepGridDisplayState = ReturnType<
  typeof createStepGridDisplayState
>;

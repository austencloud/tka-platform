/**
 * Beat Grid Display State Factory
 *
 * Svelte 5 runes-based state management for beat grid display animations.
 * Handles entrance/exit animations, sequential reveals, and animation coordination.
 * This is for DISPLAY animations (how steps appear in grid), NOT playback animations.
 */

import type { StepData } from "../../../domain/models/StepData";
import type {
  AnimationMode,
  AnimationTiming,
  BeatLetterAnimatedEvent,
} from "../domain/models/step-grid-display-models";
import { DEFAULT_ANIMATION_TIMING } from "../domain/models/step-grid-display-models";

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
 * Create beat grid display animation state
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
  function prepareSequenceAnimation(_beatCount: number, mode: AnimationMode) {
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
   * Trigger sequential animation with progressive reveal
   */
  async function triggerSequentialAnimation(
    steps: readonly StepData[],
    dispatchEvent: (event: CustomEvent) => void
  ): Promise<void> {
    const stepCount = steps.length;

    // Small delay to ensure DOM has updated
    await new Promise((resolve) =>
      setTimeout(resolve, animationTiming.sequentialDelay / 6)
    );

    // Trigger steps sequentially
    for (let i = 0; i < stepCount; i++) {
      // Add this beat to stepsToAnimate to trigger its animation
      stepsToAnimate.add(i);
      stepsToAnimate = new Set(stepsToAnimate); // Trigger reactivity

      // Dispatch event with the letter from this beat
      const beat = steps[i];
      if (beat?.letter) {
        const event = new CustomEvent<BeatLetterAnimatedEvent>(
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

    // Dispatch completion event
    const completeEvent = new CustomEvent("sequential-animation-complete", {
      detail: { totalSteps: stepCount },
      bubbles: true,
    });
    dispatchEvent(completeEvent);

    // Clear animation state after all steps have animated
    setTimeout(() => {
      cleanupAnimation();
    }, animationTiming.cleanupDelay);
  }

  /**
   * Trigger all-at-once animation
   */
  function triggerAllAtOnceAnimation() {
    // All steps already set to animate via shouldAnimateAllSteps
    // Just clean up after animation duration
    setTimeout(() => {
      cleanupAnimation();
    }, animationTiming.cleanupDelay);
  }

  /**
   * Handle single beat addition (Construct mode)
   */
  function handleSingleBeatAddition(stepIndex: number) {
    isPreparingFullAnimation = false;
    newlyAddedStepIndex = stepIndex;
    shouldAnimateAllSteps = false;
    shouldAnimateStartPosition = false;
    stepsToAnimate.clear();

    // Clear after animation completes
    setTimeout(() => {
      newlyAddedStepIndex = null;
    }, animationTiming.entranceDuration);
  }

  /**
   * Handle sequence clearing animation
   */
  function handleClearSequence() {
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
    return isWaitingForSequentialAnimation && !stepsToAnimate.has(stepIndex);
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

    // Actions
    setAnimationMode,
    prepareSequenceAnimation,
    triggerSequentialAnimation,
    triggerAllAtOnceAnimation,
    handleSingleBeatAddition,
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

/**
 * Beat Grid Display State Factory
 *
 * Svelte 5 runes-based state management for beat grid display animations.
 * Handles entrance/exit animations, sequential reveals, and animation coordination.
 * This is for DISPLAY animations (how beats appear in grid), NOT playback animations.
 */

import type { BeatData } from "../../../domain/models/BeatData";
import type {
  AnimationMode,
  AnimationTiming,
  BeatLetterAnimatedEvent,
} from "../domain/models/beat-grid-display-models";
import { DEFAULT_ANIMATION_TIMING } from "../domain/models/beat-grid-display-models";

/**
 * Global flag to indicate a generation is pending.
 * This is set when the prepare-sequence-animation event fires, BEFORE the BeatGrid
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
export function createBeatGridDisplayState() {
  // Animation state
  let newlyAddedBeatIndex = $state<number | null>(null);
  let shouldAnimateAllBeats = $state<boolean>(false);
  let shouldAnimateStartPosition = $state<boolean>(false);
  let isSequentialMode = $state<boolean>(true); // Default to sequential
  let beatsToAnimate = $state<Set<number>>(new Set());
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
    // Set animation state IMMEDIATELY so beats render invisible
    isPreparingFullAnimation = true;
    shouldAnimateStartPosition = true;
    newlyAddedBeatIndex = null;

    if (mode === "sequential") {
      // Sequential mode: Start with empty beatsToAnimate
      shouldAnimateAllBeats = false;
      beatsToAnimate.clear();
      isWaitingForSequentialAnimation = true;
    } else {
      // All at once mode: All beats animate immediately
      shouldAnimateAllBeats = true;
      beatsToAnimate.clear();
      isWaitingForSequentialAnimation = false;
    }
  }

  /**
   * Trigger sequential animation with progressive reveal
   */
  async function triggerSequentialAnimation(
    beats: readonly BeatData[],
    dispatchEvent: (event: CustomEvent) => void
  ): Promise<void> {
    const beatCount = beats.length;

    // Small delay to ensure DOM has updated
    await new Promise((resolve) =>
      setTimeout(resolve, animationTiming.sequentialDelay / 6)
    );

    // Trigger beats sequentially
    for (let i = 0; i < beatCount; i++) {
      // Add this beat to beatsToAnimate to trigger its animation
      beatsToAnimate.add(i);
      beatsToAnimate = new Set(beatsToAnimate); // Trigger reactivity

      // Dispatch event with the letter from this beat
      const beat = beats[i];
      if (beat?.letter) {
        const event = new CustomEvent<BeatLetterAnimatedEvent>(
          "beat-letter-animated",
          {
            detail: {
              beatIndex: i,
              letter: beat.letter,
              totalBeats: beatCount,
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
      detail: { totalBeats: beatCount },
      bubbles: true,
    });
    dispatchEvent(completeEvent);

    // Clear animation state after all beats have animated
    setTimeout(() => {
      cleanupAnimation();
    }, animationTiming.cleanupDelay);
  }

  /**
   * Trigger all-at-once animation
   */
  function triggerAllAtOnceAnimation() {
    // All beats already set to animate via shouldAnimateAllBeats
    // Just clean up after animation duration
    setTimeout(() => {
      cleanupAnimation();
    }, animationTiming.cleanupDelay);
  }

  /**
   * Handle single beat addition (Construct mode)
   */
  function handleSingleBeatAddition(beatIndex: number) {
    isPreparingFullAnimation = false;
    newlyAddedBeatIndex = beatIndex;
    shouldAnimateAllBeats = false;
    shouldAnimateStartPosition = false;
    beatsToAnimate.clear();

    // Clear after animation completes
    setTimeout(() => {
      newlyAddedBeatIndex = null;
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
    shouldAnimateAllBeats = false;
    beatsToAnimate.clear();
  }

  /**
   * Check if a beat should animate
   */
  function shouldBeatAnimate(beatIndex: number): boolean {
    return (
      shouldAnimateAllBeats ||
      beatIndex === newlyAddedBeatIndex ||
      beatsToAnimate.has(beatIndex)
    );
  }

  /**
   * Check if a beat should be hidden (sequential mode waiting)
   */
  function shouldBeatBeHidden(beatIndex: number): boolean {
    return isWaitingForSequentialAnimation && !beatsToAnimate.has(beatIndex);
  }

  /**
   * Update animation timing configuration
   */
  function setAnimationTiming(timing: Partial<AnimationTiming>) {
    animationTiming = { ...animationTiming, ...timing };
  }

  return {
    // Getters for reactive state
    get newlyAddedBeatIndex() {
      return newlyAddedBeatIndex;
    },
    get shouldAnimateAllBeats() {
      return shouldAnimateAllBeats;
    },
    get shouldAnimateStartPosition() {
      return shouldAnimateStartPosition;
    },
    get isSequentialMode() {
      return isSequentialMode;
    },
    get beatsToAnimate() {
      return beatsToAnimate;
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

export type BeatGridDisplayState = ReturnType<
  typeof createBeatGridDisplayState
>;

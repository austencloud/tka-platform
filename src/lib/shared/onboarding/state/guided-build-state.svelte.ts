/**
 * Guided Build State
 *
 * Manages the interactive first-build walkthrough.
 * Steps auto-advance when the user completes each action.
 * The orchestrator observes constructor state and dispatches advances.
 */

import {
  GUIDED_BUILD_STEPS,
  type GuidedBuildStep,
} from "../config/guided-build-steps";

interface GuidedBuildState {
  currentStepIndex: number;
  isActive: boolean;
  isSkipped: boolean;
}

function createGuidedBuildState() {
  const state = $state<GuidedBuildState>({
    currentStepIndex: 0,
    isActive: false,
    isSkipped: false,
  });

  let autoAdvanceTimer: ReturnType<typeof setTimeout> | null = null;

  function clearTimer() {
    if (autoAdvanceTimer !== null) {
      clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
    }
  }

  function setupTimerIfNeeded() {
    clearTimer();
    const step = GUIDED_BUILD_STEPS[state.currentStepIndex];
    if (step?.advanceOn.type === "timer") {
      autoAdvanceTimer = setTimeout(() => {
        advanceStep();
      }, step.advanceOn.ms);
    }
  }

  function advanceStep() {
    clearTimer();
    if (state.currentStepIndex < GUIDED_BUILD_STEPS.length - 1) {
      state.currentStepIndex++;
      setupTimerIfNeeded();
    } else {
      // All steps done
      state.isActive = false;
    }
  }

  return {
    get currentStepIndex() {
      return state.currentStepIndex;
    },
    get isActive() {
      return state.isActive;
    },
    get isSkipped() {
      return state.isSkipped;
    },
    get currentStep(): GuidedBuildStep | null {
      if (!state.isActive) return null;
      return GUIDED_BUILD_STEPS[state.currentStepIndex] ?? null;
    },
    get totalSteps() {
      return GUIDED_BUILD_STEPS.length;
    },

    /**
     * Start the guided build walkthrough.
     */
    start() {
      state.currentStepIndex = 0;
      state.isActive = true;
      state.isSkipped = false;
      setupTimerIfNeeded();
    },

    /**
     * Called by the orchestrator when a state-change advance condition is met.
     */
    notifyStateChange(key: string) {
      if (!state.isActive) return;
      const step = GUIDED_BUILD_STEPS[state.currentStepIndex];
      if (
        step?.advanceOn.type === "state-change" &&
        step.advanceOn.key === key
      ) {
        advanceStep();
      }
    },

    /**
     * Dismiss the current step (user taps "Got it" on final step).
     */
    dismissCurrent() {
      if (!state.isActive) return;
      const step = GUIDED_BUILD_STEPS[state.currentStepIndex];
      if (step?.advanceOn.type === "dismiss" || step?.advanceOn.type === "timer") {
        advanceStep();
      }
    },

    /**
     * Skip the entire guided build.
     */
    skip() {
      clearTimer();
      state.isActive = false;
      state.isSkipped = true;
    },

    /**
     * Reset for replay.
     */
    reset() {
      clearTimer();
      state.currentStepIndex = 0;
      state.isActive = false;
      state.isSkipped = false;
    },

    /**
     * Cleanup timers on destroy.
     */
    cleanup() {
      clearTimer();
    },
  };
}

export const guidedBuildState = createGuidedBuildState();

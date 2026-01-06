/**
 * Sidebar Tour State
 *
 * Manages the desktop sidebar tour lifecycle using Svelte 5 runes.
 */

import {
  hasCompletedSidebarTour,
  markSidebarTourCompleted,
  markSidebarTourSkipped,
  resetSidebarTour,
} from "../config/storage-keys";
import {
  SIDEBAR_TOUR_STEPS,
  TOUR_STEP_COUNT,
} from "../config/sidebar-tour-content";

export type TourPhase = "idle" | "prompt" | "touring" | "complete";

interface SidebarTourState {
  /** Current phase of the tour */
  phase: TourPhase;
  /** Current step index (0-based) */
  currentStep: number;
  /** Whether sidebar was collapsed before tour started (to restore after) */
  wasCollapsed: boolean;
}

/**
 * Reactive tour state
 */
function createSidebarTourState() {
  const state = $state<SidebarTourState>({
    phase: "idle",
    currentStep: 0,
    wasCollapsed: false,
  });

  // Derived values
  const currentStepData = $derived(SIDEBAR_TOUR_STEPS[state.currentStep]);
  const isFirstStep = $derived(state.currentStep === 0);
  const isLastStep = $derived(state.currentStep === TOUR_STEP_COUNT - 1);
  const progress = $derived((state.currentStep + 1) / TOUR_STEP_COUNT);

  return {
    // State getters
    get phase() {
      return state.phase;
    },
    get currentStep() {
      return state.currentStep;
    },
    get wasCollapsed() {
      return state.wasCollapsed;
    },
    get currentStepData() {
      return currentStepData;
    },
    get isFirstStep() {
      return isFirstStep;
    },
    get isLastStep() {
      return isLastStep;
    },
    get progress() {
      return progress;
    },
    get totalSteps() {
      return TOUR_STEP_COUNT;
    },
    get steps() {
      return SIDEBAR_TOUR_STEPS;
    },

    /**
     * Check if tour should be shown (not yet completed/skipped)
     */
    shouldShowTour(): boolean {
      return !hasCompletedSidebarTour();
    },

    /**
     * Show the initial "Take a tour?" prompt
     */
    showPrompt(): void {
      state.phase = "prompt";
    },

    /**
     * Start the tour (user chose "Take the tour")
     */
    startTour(sidebarWasCollapsed: boolean): void {
      state.wasCollapsed = sidebarWasCollapsed;
      state.currentStep = 0;
      state.phase = "touring";
    },

    /**
     * Skip the tour (user chose "Explore on my own")
     */
    skipTour(): void {
      markSidebarTourSkipped();
      state.phase = "idle";
    },

    /**
     * Go to next step
     */
    nextStep(): void {
      if (state.currentStep < TOUR_STEP_COUNT - 1) {
        state.currentStep++;
      } else {
        // Tour complete
        this.completeTour();
      }
    },

    /**
     * Go to previous step
     */
    prevStep(): void {
      if (state.currentStep > 0) {
        state.currentStep--;
      }
    },

    /**
     * Jump to a specific step
     */
    goToStep(index: number): void {
      if (index >= 0 && index < TOUR_STEP_COUNT) {
        state.currentStep = index;
      }
    },

    /**
     * Complete the tour
     */
    completeTour(): void {
      markSidebarTourCompleted();
      state.phase = "complete";
      // Brief delay before hiding to show completion state
      setTimeout(() => {
        state.phase = "idle";
      }, 300);
    },

    /**
     * Dismiss the tour mid-way (X button)
     */
    dismissTour(): void {
      // Treat dismissal as skip - user can replay from settings if needed
      markSidebarTourSkipped();
      state.phase = "idle";
    },

    /**
     * Reset tour state (for dev/testing)
     */
    reset(): void {
      resetSidebarTour();
      state.phase = "idle";
      state.currentStep = 0;
      state.wasCollapsed = false;
    },
  };
}

/**
 * Singleton instance of sidebar tour state
 */
export const sidebarTourState = createSidebarTourState();

/**
 * Sidebar Tour State
 *
 * Manages the desktop sidebar tour lifecycle using Svelte 5 runes.
 * Dynamically filters tour steps to only show modules visible in the sidebar.
 */

import {
  hasCompletedSidebarTour,
  markSidebarTourCompleted,
  markSidebarTourSkipped,
  resetSidebarTour,
} from "../config/storage-keys";
import {
  SIDEBAR_TOUR_STEPS,
  type TourStep,
} from "../config/sidebar-tour-content";
import { getModuleDefinitions } from "../../navigation-coordinator/navigation-coordinator.svelte";

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
 * Get tour steps filtered to only include modules visible in the sidebar.
 * This ensures the tour doesn't try to highlight modules the user can't see.
 */
function getVisibleTourSteps(): TourStep[] {
  const visibleModuleIds = new Set<string>(getModuleDefinitions().map((m) => m.id));
  return SIDEBAR_TOUR_STEPS.filter((step) => visibleModuleIds.has(step.moduleId as string));
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

  // Filter steps to only visible modules (reactive to auth/feature flag changes)
  const visibleSteps = $derived(getVisibleTourSteps());
  const stepCount = $derived(visibleSteps.length);

  // Derived values based on filtered steps
  const currentStepData = $derived(visibleSteps[state.currentStep]);
  const isFirstStep = $derived(state.currentStep === 0);
  const isLastStep = $derived(state.currentStep === stepCount - 1);
  const progress = $derived(stepCount > 0 ? (state.currentStep + 1) / stepCount : 0);

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
      return stepCount;
    },
    get steps() {
      return visibleSteps;
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
     * Skip the tour (user chose "Browse on my own")
     */
    skipTour(): void {
      markSidebarTourSkipped();
      state.phase = "idle";
    },

    /**
     * Go to next step
     */
    nextStep(): void {
      if (state.currentStep < stepCount - 1) {
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
      if (index >= 0 && index < stepCount) {
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

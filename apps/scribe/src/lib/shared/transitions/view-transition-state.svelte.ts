/**
 * View Transition State Manager
 * Modern 2025/2026 approach using Svelte 5 runes
 *
 * Manages smooth transitions between modules/tabs with proper timing coordination
 * Uses CSS View Transitions API when available with fallback
 */

export type TransitionPhase =
  | "idle"
  | "preparing"
  | "transitioning"
  | "completing";
export type TransitionDirection = "forward" | "backward" | "neutral";

interface ViewTransitionState {
  phase: TransitionPhase;
  currentView: string | null;
  previousView: string | null;
  direction: TransitionDirection;
  isTransitioning: boolean;
  startTime: number | null;
}

// Global transition state using Svelte 5 runes
const transitionState = $state<ViewTransitionState>({
  phase: "idle",
  currentView: null,
  previousView: null,
  direction: "neutral",
  isTransitioning: false,
  startTime: null,
});

// Timing configuration (can be customized)
const TIMING = {
  PREPARE_DURATION: 50, // Time to prepare new view before transition
  TRANSITION_DURATION: 400, // Main transition duration
  COMPLETE_DURATION: 50, // Cleanup after transition
} as const;

/**
 * Create a view transition manager instance
 */
export function createViewTransitionManager() {
  // Track pending transitions to prevent overlap
  let pendingTransition: Promise<void> | null = null;

  /**
   * Check if browser supports View Transitions API
   */
  const supportsViewTransitions = $derived(
    typeof document !== "undefined" && "startViewTransition" in document
  );

  /**
   * Get current state (reactive)
   */
  const state = $derived.by(() => ({
    phase: transitionState.phase,
    currentView: transitionState.currentView,
    previousView: transitionState.previousView,
    direction: transitionState.direction,
    isTransitioning: transitionState.isTransitioning,
  }));

  /**
   * Transition to a new view
   * @param viewId - Unique identifier for the target view
   * @param direction - Animation direction (forward/backward/neutral)
   */
  async function transitionTo(
    viewId: string,
    direction: TransitionDirection = "neutral"
  ): Promise<void> {
    // If already transitioning to this view, skip
    if (
      transitionState.isTransitioning &&
      transitionState.currentView === viewId
    ) {
      return;
    }

    // If transition is in progress, wait for it to complete
    if (pendingTransition) {
      await pendingTransition;
    }

    // Create new transition promise
    pendingTransition = executeTransition(viewId, direction);

    try {
      await pendingTransition;
    } finally {
      pendingTransition = null;
    }
  }

  /**
   * Execute the transition sequence
   */
  async function executeTransition(
    viewId: string,
    direction: TransitionDirection
  ): Promise<void> {
    // Phase 1: Preparing
    transitionState.phase = "preparing";
    transitionState.previousView = transitionState.currentView;
    transitionState.currentView = viewId;
    transitionState.direction = direction;
    transitionState.isTransitioning = true;
    transitionState.startTime = Date.now();

    // Give time for new view to prepare/mount
    await delay(TIMING.PREPARE_DURATION);

    // Phase 2: Transitioning
    transitionState.phase = "transitioning";

    // Use View Transitions API if available
    if (supportsViewTransitions) {
      await performViewTransition();
    } else {
      // Fallback: CSS-based transition
      await performCSSTransition();
    }

    // Phase 3: Completing
    transitionState.phase = "completing";
    await delay(TIMING.COMPLETE_DURATION);

    // Phase 4: Idle
    transitionState.phase = "idle";
    transitionState.isTransitioning = false;
    transitionState.previousView = null;
    transitionState.startTime = null;
  }

  /**
   * Perform transition using View Transitions API
   */
  async function performViewTransition(): Promise<void> {
    return new Promise((resolve) => {
      if (!document.startViewTransition) {
        resolve();
        return;
      }

      const transition = document.startViewTransition(() => {
        // DOM update happens here
        // The transition is automatically handled by the browser
      });

      transition.finished.then(() => resolve()).catch(() => resolve()); // Resolve even on error
    });
  }

  /**
   * Perform CSS-based transition (fallback)
   */
  async function performCSSTransition(): Promise<void> {
    await delay(TIMING.TRANSITION_DURATION);
  }

  /**
   * Force reset transition state (emergency escape hatch)
   */
  function reset(): void {
    transitionState.phase = "idle";
    transitionState.isTransitioning = false;
    transitionState.previousView = null;
    transitionState.startTime = null;
    pendingTransition = null;
  }

  /**
   * Get transition progress (0-1)
   */
  const progress = $derived.by(() => {
    if (!transitionState.isTransitioning || !transitionState.startTime) {
      return 0;
    }
    const elapsed = Date.now() - transitionState.startTime;
    const total =
      TIMING.PREPARE_DURATION +
      TIMING.TRANSITION_DURATION +
      TIMING.COMPLETE_DURATION;
    return Math.min(elapsed / total, 1);
  });

  return {
    get state() {
      return state;
    },
    get progress() {
      return progress;
    },
    get supportsViewTransitions() {
      return supportsViewTransitions;
    },
    transitionTo,
    reset,
  };
}

/**
 * Utility: Promise-based delay
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Global singleton instance (can be used across the app)
 */
export const viewTransitionManager = createViewTransitionManager();

/**
 * IOptionTransitionCoordinator - Orchestrates option selection transitions
 *
 * Manages the complex setTimeout choreography for smooth fade-out/fade-in
 * transitions when options are selected or undone.
 *
 * EXTRACTED FROM: OptionViewer.svelte lines 278-327, 348-369
 */

export interface TransitionLifecycle {
  /** Current fade-out state */
  readonly isFadingOut: boolean;

  /** Current transitioning state (prevents navigation during transition) */
  readonly isTransitioning: boolean;

  /** Cancel any in-flight transitions */
  cancel(): void;
}

export interface TransitionCallbacks {
  /** Called halfway through fade-out (ideal time for data updates) */
  onMidFadeOut?: () => void;

  /** Called when fade-out completes and fade-in begins */
  onFadeInStart?: () => void;

  /** Called when entire transition completes */
  onComplete?: () => void;
}

export interface IOptionTransitionCoordinator {
  /**
   * Begin option selection transition
   *
   * Choreography:
   * 1. Start fade-out immediately
   * 2. Update data mid-fade-out (while invisible)
   * 3. Start fade-in with new data
   * 4. Complete transition
   *
   * @param callbacks Lifecycle callbacks for data updates
   * @returns TransitionLifecycle control object
   */
  beginOptionSelection(callbacks: TransitionCallbacks): TransitionLifecycle;

  /**
   * Begin undo transition (simpler, no immediate callback needed)
   *
   * @param callbacks Lifecycle callbacks for data reload
   * @returns TransitionLifecycle control object
   */
  beginUndoTransition(callbacks: TransitionCallbacks): TransitionLifecycle;

  /**
   * Get current transition state
   */
  getState(): TransitionLifecycle;

  /**
   * Check if currently transitioning
   */
  isTransitioning(): boolean;

  /**
   * Cleanup any active transitions (call on unmount)
   */
  dispose(): void;
}

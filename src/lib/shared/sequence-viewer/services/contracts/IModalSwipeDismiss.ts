/**
 * Modal swipe-to-dismiss gesture handler.
 *
 * Supports:
 * - Swipe from anywhere on the modal
 * - Distinguishes vertical swipe from horizontal scroll
 * - Applies visual feedback (transform + opacity)
 * - Blocks clicks after swipe to prevent accidental interactions
 */

export interface ModalSwipeDismissConfig {
  /** Pixel threshold to trigger dismiss (default: 100) */
  threshold?: number;
  /** Minimum vertical movement to commit to swipe gesture (default: 10) */
  commitThreshold?: number;
  /** Vertical must be > horizontal * this to swipe (default: 2) */
  horizontalTolerance?: number;
  /** Duration to block clicks after swipe gesture (default: 100ms) */
  clickBlockDuration?: number;
}

export interface ModalSwipeDismissState {
  /** Current vertical offset in pixels */
  readonly swipeY: number;
  /** Whether actively swiping */
  readonly isSwiping: boolean;
  /** Whether gesture has committed to swipe (past commit threshold) */
  readonly isCommitted: boolean;
  /** Whether clicks should be blocked (after a swipe gesture) */
  readonly blockClicks: boolean;
}

export interface IModalSwipeDismiss {
  /** Current state (reactive getters) */
  readonly state: ModalSwipeDismissState;

  /**
   * Handle touch start event.
   * Call from ontouchstart on the modal container.
   */
  handleTouchStart(e: TouchEvent): void;

  /**
   * Handle touch move event.
   * Call from document-level touchmove with capture.
   * Returns true if event was handled (should prevent default).
   */
  handleTouchMove(e: TouchEvent): boolean;

  /**
   * Handle touch end event.
   * Returns true if modal should be dismissed.
   */
  handleTouchEnd(): boolean;

  /**
   * Apply visual feedback to a dialog element during swipe.
   * Call this from an effect that watches swipeY.
   */
  applyTransformToDialog(dialog: HTMLDialogElement | null): void;

  /**
   * Animate dismiss (slide down and fade out).
   * Returns a promise that resolves when animation completes.
   */
  animateDismiss(dialog: HTMLDialogElement | null): Promise<void>;

  /**
   * Snap back to original position with animation.
   * Returns a promise that resolves when animation completes.
   */
  animateSnapBack(dialog: HTMLDialogElement | null): Promise<void>;

  /**
   * Reset all state. Call when modal closes.
   */
  reset(): void;

  /**
   * Dispose of the handler. Call in onDestroy.
   */
  dispose(): void;
}

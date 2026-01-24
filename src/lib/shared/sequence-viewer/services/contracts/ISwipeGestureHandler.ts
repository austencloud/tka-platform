/**
 * Handles swipe-to-dismiss gesture detection for mobile modals.
 */
export interface ISwipeGestureHandler {
  /** Current vertical swipe offset in pixels */
  readonly swipeY: number;
  /** Whether a swipe is currently in progress */
  readonly isSwiping: boolean;
  /** Threshold in pixels to trigger dismiss */
  readonly threshold: number;

  /** Call on touchstart - returns true if swipe tracking started */
  handleTouchStart(clientY: number, maxStartY?: number): boolean;
  /** Call on touchmove - updates swipeY if swiping */
  handleTouchMove(clientY: number): void;
  /** Call on touchend - returns true if should dismiss */
  handleTouchEnd(): boolean;
  /** Reset state */
  reset(): void;
}

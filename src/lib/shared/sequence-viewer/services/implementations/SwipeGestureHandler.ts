import type { ISwipeGestureHandler } from "../contracts/ISwipeGestureHandler";

/**
 * Handles swipe-to-dismiss gesture detection for mobile modals.
 * Tracks vertical swipe gestures starting from top of screen.
 */
export class SwipeGestureHandler implements ISwipeGestureHandler {
  private _swipeY = 0;
  private _swipeStartY = 0;
  private _isSwiping = false;
  private readonly _threshold: number;

  constructor(threshold = 100) {
    this._threshold = threshold;
  }

  get swipeY(): number {
    return this._swipeY;
  }

  get isSwiping(): boolean {
    return this._isSwiping;
  }

  get threshold(): number {
    return this._threshold;
  }

  handleTouchStart(clientY: number, maxStartY = 150): boolean {
    // Only start swipe from top portion of modal
    if (clientY < maxStartY) {
      this._swipeStartY = clientY;
      this._isSwiping = true;
      return true;
    }
    return false;
  }

  handleTouchMove(clientY: number): void {
    if (!this._isSwiping) return;
    const delta = clientY - this._swipeStartY;
    // Only allow downward swipe
    if (delta > 0) {
      this._swipeY = delta;
    }
  }

  handleTouchEnd(): boolean {
    if (!this._isSwiping) return false;
    const shouldDismiss = this._swipeY > this._threshold;
    this.reset();
    return shouldDismiss;
  }

  reset(): void {
    this._swipeY = 0;
    this._swipeStartY = 0;
    this._isSwiping = false;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const swipeGestureHandler = new SwipeGestureHandler();

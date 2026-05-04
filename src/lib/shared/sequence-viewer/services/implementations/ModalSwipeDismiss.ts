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
/**
 * Modal swipe-to-dismiss gesture handler.
 *
 * Handles swipe-to-dismiss from anywhere on the modal with:
 * - Gesture discrimination (vertical vs horizontal)
 * - Visual feedback during drag
 * - Click blocking after swipe
 */
export class ModalSwipeDismiss {
  private readonly threshold: number;
  private readonly commitThreshold: number;
  private readonly horizontalTolerance: number;
  private readonly clickBlockDuration: number;

  // Internal state
  private _swipeY = 0;
  private _swipeStartY = 0;
  private _swipeStartX = 0;
  private _isTracking = false;
  private _isCommitted = false;
  private _isSwiping = false;
  private _blockClicks = false;
  private blockClicksTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(config: ModalSwipeDismissConfig = {}) {
    this.threshold = config.threshold ?? 100;
    this.commitThreshold = config.commitThreshold ?? 10;
    this.horizontalTolerance = config.horizontalTolerance ?? 2;
    this.clickBlockDuration = config.clickBlockDuration ?? 100;
  }

  get state(): ModalSwipeDismissState {
    return {
      swipeY: this._swipeY,
      isSwiping: this._isSwiping,
      isCommitted: this._isCommitted,
      blockClicks: this._blockClicks,
    };
  }

  handleTouchStart(e: TouchEvent): void {
    const touch = e.touches[0];
    if (!touch) return;

    // Track touch start from anywhere - decide if it's a swipe during move
    this._swipeStartY = touch.clientY;
    this._swipeStartX = touch.clientX;
    this._isTracking = true;
    this._isSwiping = false;
    this._isCommitted = false;
    this._swipeY = 0;
  }

  handleTouchMove(e: TouchEvent): boolean {
    if (!this._isTracking) return false;

    const touch = e.touches[0];
    if (!touch) return false;

    const deltaY = touch.clientY - this._swipeStartY;
    const deltaX = Math.abs(touch.clientX - this._swipeStartX);

    // If we haven't committed to a swipe yet, check if this looks like a vertical swipe
    if (!this._isCommitted) {
      // Only start swiping if:
      // 1. Movement is downward (deltaY > 0)
      // 2. Vertical movement exceeds the commit threshold
      // 3. Vertical movement is significantly more than horizontal
      if (
        deltaY > this.commitThreshold &&
        deltaY > deltaX * this.horizontalTolerance
      ) {
        this._isCommitted = true;
        this._isSwiping = true;
      } else if (deltaX > this.commitThreshold) {
        // This looks like a horizontal gesture, stop tracking for swipe
        this._isTracking = false;
        return false;
      } else {
        // Not enough movement yet to decide
        return false;
      }
    }

    // We're committed to swiping - update the offset
    if (this._isSwiping && deltaY > 0) {
      this._swipeY = deltaY;
      return true; // Signal to prevent default
    }

    return false;
  }

  handleTouchEnd(): boolean {
    const wasSwipeGesture = this._isCommitted;
    const currentSwipeY = this._swipeY;

    // Reset tracking state
    this._isTracking = false;

    if (!wasSwipeGesture) {
      // No swipe gesture - let the click event through
      this._isSwiping = false;
      this._swipeY = 0;
      this._isCommitted = false;
      return false;
    }

    // A swipe gesture was made - block clicks temporarily
    this._blockClicks = true;
    this.blockClicksTimeout = setTimeout(() => {
      this._blockClicks = false;
    }, this.clickBlockDuration);

    // Check if swipe exceeded threshold
    const shouldDismiss = currentSwipeY > this.threshold;

    // Reset swipe state (but keep blockClicks active)
    this._swipeY = 0;
    this._isSwiping = false;
    this._isCommitted = false;

    return shouldDismiss;
  }

  applyTransformToDialog(dialog: HTMLDialogElement | null): void {
    if (!dialog) return;

    if (this._swipeY > 0) {
      dialog.style.transform = `translateY(${this._swipeY}px)`;
      dialog.style.opacity = `${Math.max(0.3, 1 - this._swipeY / 300)}`;
    } else {
      dialog.style.transform = "";
      dialog.style.opacity = "";
    }
  }

  async animateDismiss(dialog: HTMLDialogElement | null): Promise<void> {
    if (!dialog) return;

    return new Promise((resolve) => {
      dialog.style.transition =
        "transform 200ms ease-out, opacity 200ms ease-out";
      dialog.style.transform = "translateY(100%)";
      dialog.style.opacity = "0";

      setTimeout(() => {
        // Reset styles after animation
        dialog.style.transform = "";
        dialog.style.opacity = "";
        dialog.style.transition = "";
        resolve();
      }, 200);
    });
  }

  async animateSnapBack(dialog: HTMLDialogElement | null): Promise<void> {
    if (!dialog) return;

    return new Promise((resolve) => {
      dialog.style.transition =
        "transform 200ms ease-out, opacity 200ms ease-out";
      dialog.style.transform = "";
      dialog.style.opacity = "";

      setTimeout(() => {
        dialog.style.transition = "";
        resolve();
      }, 200);
    });
  }

  reset(): void {
    this._swipeY = 0;
    this._swipeStartY = 0;
    this._swipeStartX = 0;
    this._isTracking = false;
    this._isCommitted = false;
    this._isSwiping = false;
    // Note: Don't reset _blockClicks here - it has its own timeout
  }

  dispose(): void {
    if (this.blockClicksTimeout) {
      clearTimeout(this.blockClicksTimeout);
      this.blockClicksTimeout = null;
    }
    this._blockClicks = false;
  }
}

/**
 * Factory function to create a modal swipe dismiss handler.
 * Each modal instance should create its own handler.
 */
export function createModalSwipeDismiss(
  config?: ModalSwipeDismissConfig
): ModalSwipeDismiss {
  return new ModalSwipeDismiss(config);
}

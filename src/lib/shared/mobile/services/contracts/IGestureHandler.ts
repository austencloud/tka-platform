/**
 * Gesture Service Contract
 *
 * Provides reusable touch gesture handling for common interaction patterns.
 */

export type GestureDirection = "vertical" | "horizontal";
export type GestureOrientation = "down" | "up" | "left" | "right";

export interface SwipeGestureConfig {
  /**
   * The direction of the swipe gesture
   */
  direction: GestureDirection;

  /**
   * Which orientation(s) should trigger the dismiss action
   * For vertical: 'down' or 'up'
   * For horizontal: 'right' or 'left'
   */
  dismissOrientation: GestureOrientation;

  /**
   * Minimum distance in pixels to trigger dismiss
   * @default 100
   */
  threshold?: number;

  /**
   * Callback when gesture meets dismiss threshold
   */
  onDismiss: () => void;

  /**
   * Optional callback for visual feedback during drag
   * @param delta - The current drag distance
   */
  onDrag?: (delta: number) => void;

  /**
   * Optional callback when gesture is released but doesn't meet threshold (snap back)
   */
  onSnapBack?: () => void;
}

export interface SwipeGestureHandler {
  handleTouchStart: (e: TouchEvent) => void;
  handleTouchMove: (e: TouchEvent) => void;
  handleTouchEnd: () => void;
}

export interface IGestureHandler {
  /**
   * Create a stateful swipe gesture handler
   * Returns handler functions for touch events
   */
  createSwipeGestureHandler(config: SwipeGestureConfig): SwipeGestureHandler;

  /**
   * Apply transform to element during drag
   */
  applyDragTransform(
    element: HTMLElement | null,
    delta: number,
    direction: GestureDirection
  ): void;

  /**
   * Snap element back to original position with animation
   */
  snapBackTransform(
    element: HTMLElement | null,
    direction: GestureDirection,
    duration?: number
  ): void;
}

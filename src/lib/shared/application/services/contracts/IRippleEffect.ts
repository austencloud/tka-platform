/**
 * Ripple Effect Service Contract
 *
 * Handles Material Design-style ripple effects for touch/click interactions.
 * Provides visual feedback emanating from interaction point on UI elements.
 */

export interface RippleOptions {
  /** Duration of the ripple animation in milliseconds */
  duration?: number;
  /** Color of the ripple (CSS color value) */
  color?: string;
  /** Opacity of the ripple at peak */
  opacity?: number;
}

export interface IRippleEffect {
  /**
   * Create a ripple effect on an element from a specific interaction point
   *
   * @param element - The element to attach the ripple to
   * @param event - The mouse or touch event that triggered the ripple
   * @param options - Optional configuration for the ripple
   */
  createRipple(
    element: HTMLElement,
    event: MouseEvent | TouchEvent,
    options?: RippleOptions
  ): void;

  /**
   * Attach ripple effect to an element for all future interactions
   *
   * Returns a cleanup function to remove the event listeners
   *
   * @param element - The element to attach ripple to
   * @param options - Optional configuration for the ripple
   * @returns Cleanup function to remove event listeners
   */
  attachRipple(element: HTMLElement, options?: RippleOptions): () => void;
}

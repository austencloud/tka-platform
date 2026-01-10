/**
 * createSwipeDismiss - Swipe-to-dismiss gesture handler for bottom sheets
 *
 * Returns reactive state and handlers for implementing swipe-to-dismiss behavior.
 * When the user swipes down past a threshold, onDismiss is called.
 *
 * @example
 * ```svelte
 * <script>
 *   const swipe = createSwipeDismiss({
 *     threshold: 100,
 *     onDismiss: () => isOpen = false
 *   });
 * </script>
 *
 * <div
 *   bind:this={swipe.element}
 *   ontouchstart={swipe.handleTouchStart}
 *   ontouchmove={swipe.handleTouchMove}
 *   ontouchend={swipe.handleTouchEnd}
 *   style:transform={swipe.transform}
 * >
 * ```
 */

export interface SwipeDismissOptions {
  /** Pixels to swipe before triggering dismiss (default: 100) */
  threshold?: number;
  /** Called when swipe exceeds threshold */
  onDismiss: () => void;
}

export interface SwipeDismissState {
  /** Bind this to the swipeable element */
  element: HTMLElement | null;
  /** Current Y translation (for inline transform) */
  transform: string;
  /** Whether user is actively dragging */
  isDragging: boolean;
  /** Touch start handler */
  handleTouchStart: (e: TouchEvent) => void;
  /** Touch move handler */
  handleTouchMove: (e: TouchEvent) => void;
  /** Touch end handler */
  handleTouchEnd: () => void;
  /** Reset the element transform */
  reset: () => void;
}

export function createSwipeDismiss(
  options: SwipeDismissOptions
): SwipeDismissState {
  const threshold = options.threshold ?? 100;

  let element = $state<HTMLElement | null>(null);
  let touchStartY = $state(0);
  let touchCurrentY = $state(0);
  let isDragging = $state(false);

  const deltaY = $derived(Math.max(0, touchCurrentY - touchStartY));
  const transform = $derived(
    isDragging && deltaY > 0 ? `translateY(${deltaY}px)` : ""
  );

  function handleTouchStart(e: TouchEvent) {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartY = touch.clientY;
    touchCurrentY = touchStartY;
    isDragging = true;
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isDragging) return;
    const touch = e.touches[0];
    if (!touch) return;
    touchCurrentY = touch.clientY;

    // Apply transform directly for smooth feedback
    if (element && deltaY > 0) {
      element.style.transform = `translateY(${deltaY}px)`;
    }
  }

  function handleTouchEnd() {
    if (!isDragging) return;
    isDragging = false;

    const finalDelta = touchCurrentY - touchStartY;

    if (finalDelta > threshold) {
      options.onDismiss();
    }

    // Reset transform
    reset();
  }

  function reset() {
    if (element) {
      element.style.transform = "";
    }
  }

  return {
    get element() {
      return element;
    },
    set element(el: HTMLElement | null) {
      element = el;
    },
    get transform() {
      return transform;
    },
    get isDragging() {
      return isDragging;
    },
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    reset,
  };
}

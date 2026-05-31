/**
 * createSwipeDismiss - Swipe-to-dismiss gesture handler for bottom sheets
 *
 * Auto-attaches non-passive touch listeners when the element is bound,
 * so it works correctly on scrollable containers (overflow-y: auto).
 *
 * Handles the scroll vs. dismiss conflict: only initiates dismiss when
 * the element is scrolled to the top and the user swipes downward.
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
 * <div bind:this={swipe.element}>
 *   <!-- content -->
 * </div>
 * ```
 */

export interface SwipeDismissOptions {
  /** Pixels to swipe before triggering dismiss (default: 100) */
  threshold?: number;
  /** Called when swipe exceeds threshold */
  onDismiss: () => void;
}

export interface SwipeDismissState {
  /** Bind this to the swipeable element. Listeners auto-attach. */
  element: HTMLElement | null;
  /** Whether user is actively dragging to dismiss */
  isDragging: boolean;
  /** Reset the element transform */
  reset: () => void;
}

export function createSwipeDismiss(
  options: SwipeDismissOptions
): SwipeDismissState {
  const threshold = options.threshold ?? 100;

  let element = $state<HTMLElement | null>(null);

  // Plain variables - no reactivity needed, only used inside handlers
  let touchStartY = 0;
  let touchCurrentY = 0;
  let isDragging = false;
  let isSwipingToDismiss = false;

  function handleTouchStart(e: TouchEvent) {
    const touch = e.touches[0];
    if (!touch) return;

    // Only allow swipe-to-dismiss when scrolled to top
    if (element && element.scrollTop > 0) return;

    touchStartY = touch.clientY;
    touchCurrentY = touchStartY;
    isDragging = true;
    isSwipingToDismiss = false;
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isDragging) return;
    const touch = e.touches[0];
    if (!touch) return;

    touchCurrentY = touch.clientY;
    const delta = touchCurrentY - touchStartY;

    // Once we detect a downward swipe while at scroll top, lock into dismiss mode
    if (delta > 10 && element && element.scrollTop <= 0) {
      isSwipingToDismiss = true;
    }

    if (isSwipingToDismiss && delta > 0) {
      // Prevent native scroll so the dismiss gesture isn't interrupted.
      // This requires non-passive listener (set up in $effect below).
      e.preventDefault();
      element!.style.transform = `translateY(${delta}px)`;
      element!.style.transition = "none";
    }
  }

  function handleTouchEnd() {
    if (!isDragging) return;
    isDragging = false;

    if (isSwipingToDismiss) {
      const finalDelta = touchCurrentY - touchStartY;
      if (finalDelta > threshold) {
        options.onDismiss();
      }
    }

    isSwipingToDismiss = false;
    reset();
  }

  function handleTouchCancel() {
    // Browser cancelled the touch (e.g. scroll takeover). Clean up.
    isDragging = false;
    isSwipingToDismiss = false;
    reset();
  }

  function reset() {
    if (element) {
      element.style.transform = "";
      element.style.transition = "";
    }
  }

  // Auto-attach listeners with correct passive flags when element is bound.
  // touchmove MUST be non-passive so preventDefault() works on scrollable containers.
  $effect(() => {
    const el = element;
    if (!el) return;

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    el.addEventListener("touchcancel", handleTouchCancel, { passive: true });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
      el.removeEventListener("touchcancel", handleTouchCancel);
    };
  });

  return {
    get element() {
      return element;
    },
    set element(el: HTMLElement | null) {
      element = el;
    },
    get isDragging() {
      return isDragging;
    },
    reset,
  };
}

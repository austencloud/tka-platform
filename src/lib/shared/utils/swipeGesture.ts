/**
 * Swipe gesture action for Svelte elements
 * Detects vertical swipe gestures (up/down)
 */

export interface SwipeGestureOptions {
  onSwipeDown?: () => void;
  onSwipeUp?: () => void;
  threshold?: number; // Minimum distance in pixels to trigger swipe
  maxDuration?: number; // Maximum time in ms for swipe to be valid
}

interface SwipeState {
  startY: number;
  startTime: number;
  isSwiping: boolean;
}

export function swipeGesture(
  node: HTMLElement,
  options: SwipeGestureOptions = {}
) {
  const { onSwipeDown, onSwipeUp, threshold = 50, maxDuration = 500 } = options;

  const state: SwipeState = {
    startY: 0,
    startTime: 0,
    isSwiping: false,
  };

  function handleTouchStart(event: TouchEvent) {
    const touch = event.touches[0];
    if (!touch) return;
    state.startY = touch.clientY;
    state.startTime = Date.now();
    state.isSwiping = true;
  }

  function handleTouchMove(event: TouchEvent) {
    if (!state.isSwiping) return;

    // Optional: Add visual feedback during swipe
    const touch = event.touches[0];
    if (!touch) return;
    const deltaY = touch.clientY - state.startY;
    const distance = Math.abs(deltaY);

    // Prevent default if swiping significantly
    if (distance > threshold / 2) {
      event.preventDefault();
    }
  }

  function handleTouchEnd(event: TouchEvent) {
    if (!state.isSwiping) return;

    const touch = event.changedTouches[0];
    if (!touch) return;
    const endY = touch.clientY;
    const deltaY = endY - state.startY;
    const distance = Math.abs(deltaY);
    const duration = Date.now() - state.startTime;

    // Check if swipe meets threshold and duration requirements
    if (distance >= threshold && duration <= maxDuration) {
      if (deltaY > 0 && onSwipeDown) {
        // Swiped down
        onSwipeDown();
      } else if (deltaY < 0 && onSwipeUp) {
        // Swiped up
        onSwipeUp();
      }
    }

    state.isSwiping = false;
  }

  function handleMouseDown(event: MouseEvent) {
    state.startY = event.clientY;
    state.startTime = Date.now();
    state.isSwiping = true;
  }

  function handleMouseMove(_event: MouseEvent) {
    if (!state.isSwiping) return;
  }

  function handleMouseUp(event: MouseEvent) {
    if (!state.isSwiping) return;

    const endY = event.clientY;
    const deltaY = endY - state.startY;
    const distance = Math.abs(deltaY);
    const duration = Date.now() - state.startTime;

    if (distance >= threshold && duration <= maxDuration) {
      if (deltaY > 0 && onSwipeDown) {
        onSwipeDown();
      } else if (deltaY < 0 && onSwipeUp) {
        onSwipeUp();
      }
    }

    state.isSwiping = false;
  }

  // Add event listeners
  node.addEventListener("touchstart", handleTouchStart, { passive: true });
  node.addEventListener("touchmove", handleTouchMove, { passive: false });
  node.addEventListener("touchend", handleTouchEnd, { passive: true });
  node.addEventListener("mousedown", handleMouseDown);
  node.addEventListener("mousemove", handleMouseMove);
  node.addEventListener("mouseup", handleMouseUp);

  return {
    destroy() {
      node.removeEventListener("touchstart", handleTouchStart);
      node.removeEventListener("touchmove", handleTouchMove);
      node.removeEventListener("touchend", handleTouchEnd);
      node.removeEventListener("mousedown", handleMouseDown);
      node.removeEventListener("mousemove", handleMouseMove);
      node.removeEventListener("mouseup", handleMouseUp);
    },
  };
}

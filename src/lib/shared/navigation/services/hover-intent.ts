/**
 * Hover-Intent Controller
 * Domain: Desktop Navigation Sidebar
 *
 * Pure timer logic for the hover-expand overlay rail: a short open delay so
 * pointers crossing the rail en route elsewhere don't trigger expansion, and
 * a close grace so brief overshoots don't collapse it. No DOM, no runes —
 * the consumer owns state and guards.
 */

export interface HoverIntentOptions {
  /** ms of sustained hover before onOpen fires (default 120) */
  openDelay?: number;
  /** ms of grace after pointer leaves before onClose fires (default 300) */
  closeDelay?: number;
  onOpen: () => void;
  onClose: () => void;
}

export interface HoverIntentController {
  /** Pointer entered the target: cancel pending close, schedule open. */
  pointerEnter(): void;
  /** Pointer left the target: cancel pending open, schedule close. */
  pointerLeave(): void;
  /** Open immediately (keyboard focus), clearing all timers. */
  openNow(): void;
  /** Close immediately (Escape, guard teardown), clearing all timers. */
  closeNow(): void;
  /** Clear all timers without firing callbacks. */
  cancel(): void;
}

export function createHoverIntent({
  openDelay = 120,
  closeDelay = 300,
  onOpen,
  onClose,
}: HoverIntentOptions): HoverIntentController {
  let openTimer: ReturnType<typeof setTimeout> | null = null;
  let closeTimer: ReturnType<typeof setTimeout> | null = null;

  function clearOpenTimer() {
    if (openTimer !== null) {
      clearTimeout(openTimer);
      openTimer = null;
    }
  }

  function clearCloseTimer() {
    if (closeTimer !== null) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  }

  return {
    pointerEnter() {
      clearCloseTimer();
      if (openTimer !== null) return;
      openTimer = setTimeout(() => {
        openTimer = null;
        onOpen();
      }, openDelay);
    },
    pointerLeave() {
      clearOpenTimer();
      if (closeTimer !== null) return;
      closeTimer = setTimeout(() => {
        closeTimer = null;
        onClose();
      }, closeDelay);
    },
    openNow() {
      clearOpenTimer();
      clearCloseTimer();
      onOpen();
    },
    closeNow() {
      clearOpenTimer();
      clearCloseTimer();
      onClose();
    },
    cancel() {
      clearOpenTimer();
      clearCloseTimer();
    },
  };
}

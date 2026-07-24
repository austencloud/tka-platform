import type { Attachment } from "svelte/attachments";

export const OPTION_AUDITION_HOLD_MS = 350;
export const OPTION_AUDITION_MOVE_TOLERANCE_PX = 12;

const CLICK_SUPPRESSION_MS = 700;
const AUDITION_ACTIVE_CLASS = "option-audition-active";
const AUDITION_PENDING_CLASS = "option-audition-pending";

type HoldState = "idle" | "pending" | "auditioning";

interface HoldToAuditionOptions {
  isDisabled?: () => boolean;
  onStart: (node: HTMLButtonElement) => boolean;
  onEnd: (node: HTMLButtonElement) => void;
  holdMs?: number;
  moveTolerancePx?: number;
}

/**
 * Turns a button's primary-pointer hold into a reversible audition while
 * leaving its native click and keyboard activation intact.
 *
 * The picker sits inside a horizontal carousel, so movement past touch slop
 * cancels the hold and suppresses the accidental click without blocking the
 * carousel's own pointer handling.
 */
export function createHoldToAuditionAttachment({
  isDisabled = () => false,
  onStart,
  onEnd,
  holdMs = OPTION_AUDITION_HOLD_MS,
  moveTolerancePx = OPTION_AUDITION_MOVE_TOLERANCE_PX,
}: HoldToAuditionOptions): Attachment<HTMLButtonElement> {
  return (node) => {
    let state: HoldState = "idle";
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pointerId: number | null = null;
    let pointerType = "";
    let startX = 0;
    let startY = 0;
    let suppressClickUntil = Number.NEGATIVE_INFINITY;
    let keyboardAudition = false;

    function clearTimer() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    }

    function setVisualState(next: HoldState) {
      node.classList.toggle(AUDITION_PENDING_CLASS, next === "pending");
      node.classList.toggle(AUDITION_ACTIVE_CLASS, next === "auditioning");

      if (next === "auditioning") {
        node.dataset.auditioning = "true";
      } else {
        delete node.dataset.auditioning;
      }
    }

    function releasePointerCapture(capturedPointerId: number | null) {
      if (
        capturedPointerId !== null &&
        node.hasPointerCapture?.(capturedPointerId)
      ) {
        node.releasePointerCapture?.(capturedPointerId);
      }
    }

    function finish({
      suppressClick = false,
    }: {
      suppressClick?: boolean;
    } = {}) {
      const previousState = state;
      const capturedPointerId = pointerId;

      clearTimer();
      state = "idle";
      pointerId = null;
      keyboardAudition = false;
      setVisualState(state);

      if (suppressClick) {
        suppressClickUntil = performance.now() + CLICK_SUPPRESSION_MS;
      }
      if (previousState === "auditioning") {
        onEnd(node);
      }

      releasePointerCapture(capturedPointerId);
    }

    function beginAudition() {
      timer = null;
      if (state !== "pending" || isDisabled()) {
        finish();
        return;
      }

      if (!onStart(node)) {
        finish();
        return;
      }

      // Expanding the animation workspace can reinitialize the option carousel.
      // Pointer capture keeps the release routed here, while dropping DOM focus
      // prevents a held option from remaining inside a newly inert slide.
      node.blur();
      state = "auditioning";
      suppressClickUntil = Number.POSITIVE_INFINITY;
      setVisualState(state);
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        event.button !== 0 ||
        !event.isPrimary ||
        isDisabled() ||
        state !== "idle"
      ) {
        return;
      }

      state = "pending";
      pointerId = event.pointerId;
      pointerType = event.pointerType;
      startX = event.clientX;
      startY = event.clientY;
      setVisualState(state);
      node.setPointerCapture?.(event.pointerId);
      timer = setTimeout(beginAudition, holdMs);
    }

    function handlePointerMove(event: PointerEvent) {
      if (
        event.pointerId !== pointerId ||
        (state !== "pending" && state !== "auditioning")
      ) {
        return;
      }

      if (
        Math.hypot(event.clientX - startX, event.clientY - startY) >
        moveTolerancePx
      ) {
        finish({ suppressClick: true });
      }
    }

    function handlePointerUp(event: PointerEvent) {
      if (event.pointerId !== pointerId) return;
      finish({ suppressClick: state === "auditioning" });
    }

    function handlePointerInterrupted(event: PointerEvent) {
      if (event.pointerId !== pointerId) return;
      finish({ suppressClick: state === "auditioning" });
    }

    function handleClick(event: MouseEvent) {
      if (performance.now() > suppressClickUntil) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      suppressClickUntil = Number.NEGATIVE_INFINITY;
    }

    function handleContextMenu(event: MouseEvent) {
      if (event.button === 2) return;

      const isTouchHold =
        pointerType !== "" &&
        pointerType !== "mouse" &&
        (state !== "idle" || performance.now() <= suppressClickUntil);
      if (!isTouchHold) return;

      event.preventDefault();
      event.stopImmediatePropagation();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.key === " " &&
        event.shiftKey &&
        !event.repeat &&
        state === "idle" &&
        !isDisabled()
      ) {
        event.preventDefault();
        event.stopPropagation();

        if (onStart(node)) {
          state = "auditioning";
          keyboardAudition = true;
          suppressClickUntil = Number.POSITIVE_INFINITY;
          setVisualState(state);
        }
        return;
      }

      if (event.key === "Escape" && state === "auditioning") {
        event.preventDefault();
        event.stopPropagation();
        finish({ suppressClick: true });
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key !== " " || !keyboardAudition) return;

      event.preventDefault();
      event.stopPropagation();
      finish({ suppressClick: true });
    }

    function handleWindowBlur() {
      if (state !== "idle") {
        finish({ suppressClick: state === "auditioning" });
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        handleWindowBlur();
      }
    }

    node.addEventListener("pointerdown", handlePointerDown);
    node.addEventListener("pointermove", handlePointerMove);
    node.addEventListener("pointerup", handlePointerUp);
    node.addEventListener("pointercancel", handlePointerInterrupted);
    node.addEventListener("lostpointercapture", handlePointerInterrupted);
    node.addEventListener("click", handleClick, true);
    node.addEventListener("contextmenu", handleContextMenu, true);
    node.addEventListener("keydown", handleKeyDown);
    node.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      finish({ suppressClick: state === "auditioning" });
      node.removeEventListener("pointerdown", handlePointerDown);
      node.removeEventListener("pointermove", handlePointerMove);
      node.removeEventListener("pointerup", handlePointerUp);
      node.removeEventListener("pointercancel", handlePointerInterrupted);
      node.removeEventListener("lostpointercapture", handlePointerInterrupted);
      node.removeEventListener("click", handleClick, true);
      node.removeEventListener("contextmenu", handleContextMenu, true);
      node.removeEventListener("keydown", handleKeyDown);
      node.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  };
}

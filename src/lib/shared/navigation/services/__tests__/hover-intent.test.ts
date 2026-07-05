import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { createHoverIntent } from "../hover-intent";

describe("createHoverIntent", () => {
  let onOpen: Mock<() => void>;
  let onClose: Mock<() => void>;

  beforeEach(() => {
    vi.useFakeTimers();
    onOpen = vi.fn<() => void>();
    onClose = vi.fn<() => void>();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function make() {
    return createHoverIntent({ openDelay: 120, closeDelay: 300, onOpen, onClose });
  }

  it("opens after openDelay on pointerEnter", () => {
    const intent = make();
    intent.pointerEnter();
    expect(onOpen).not.toHaveBeenCalled();
    vi.advanceTimersByTime(119);
    expect(onOpen).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("cancels pending open when pointer leaves before openDelay", () => {
    const intent = make();
    intent.pointerEnter();
    vi.advanceTimersByTime(60);
    intent.pointerLeave();
    vi.advanceTimersByTime(1000);
    expect(onOpen).not.toHaveBeenCalled();
    // leave-before-open still schedules a close (harmless; consumer is idempotent)
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes after closeDelay on pointerLeave", () => {
    const intent = make();
    intent.pointerEnter();
    vi.advanceTimersByTime(120);
    intent.pointerLeave();
    vi.advanceTimersByTime(299);
    expect(onClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("re-enter within closeDelay cancels the pending close", () => {
    const intent = make();
    intent.pointerEnter();
    vi.advanceTimersByTime(120);
    intent.pointerLeave();
    vi.advanceTimersByTime(150);
    intent.pointerEnter();
    vi.advanceTimersByTime(1000);
    expect(onClose).not.toHaveBeenCalled();
    // already open — a second onOpen fire is fine (idempotent consumer),
    // but the pending close MUST have been cancelled
  });

  it("openNow fires synchronously and clears timers", () => {
    const intent = make();
    intent.pointerLeave(); // arm a close
    intent.openNow();
    expect(onOpen).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closeNow fires synchronously and clears timers", () => {
    const intent = make();
    intent.pointerEnter(); // arm an open
    intent.closeNow();
    expect(onClose).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("cancel clears both timers without firing callbacks", () => {
    const intent = make();
    intent.pointerEnter();
    intent.cancel();
    vi.advanceTimersByTime(1000);
    expect(onOpen).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("uses default delays of 120/300 when not provided", () => {
    const intent = createHoverIntent({ onOpen, onClose });
    intent.pointerEnter();
    vi.advanceTimersByTime(120);
    expect(onOpen).toHaveBeenCalledTimes(1);
    intent.pointerLeave();
    vi.advanceTimersByTime(300);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

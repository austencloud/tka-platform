import { afterEach, describe, expect, it, vi } from "vitest";
import { ALT_HINT_HOLD_DELAY_MS, createAltHoldIntent } from "./alt-hold-intent";

afterEach(() => {
  vi.useRealTimers();
});

describe("Alt hold intent", () => {
  it("does not reveal for a quick accidental tap", () => {
    vi.useFakeTimers();
    const changes: boolean[] = [];
    const intent = createAltHoldIntent({
      onVisibilityChange: (visible) => changes.push(visible),
    });

    intent.press();
    vi.advanceTimersByTime(ALT_HINT_HOLD_DELAY_MS - 1);
    intent.release();
    vi.runAllTimers();

    expect(changes).toEqual([]);
  });

  it("keeps a practiced Alt chord invisible", () => {
    vi.useFakeTimers();
    const changes: boolean[] = [];
    const intent = createAltHoldIntent({
      onVisibilityChange: (visible) => changes.push(visible),
    });

    intent.press();
    vi.advanceTimersByTime(100);
    intent.useChord();
    vi.runAllTimers();

    expect(changes).toEqual([]);
  });

  it("reveals after the hold threshold and hides on release", () => {
    vi.useFakeTimers();
    const changes: boolean[] = [];
    const intent = createAltHoldIntent({
      onVisibilityChange: (visible) => changes.push(visible),
    });

    intent.press();
    vi.advanceTimersByTime(ALT_HINT_HOLD_DELAY_MS);
    intent.release();

    expect(changes).toEqual([true, false]);
  });

  it("keeps an already-visible guide open while commands are chained", () => {
    vi.useFakeTimers();
    const changes: boolean[] = [];
    const intent = createAltHoldIntent({
      onVisibilityChange: (visible) => changes.push(visible),
    });

    intent.press();
    vi.advanceTimersByTime(ALT_HINT_HOLD_DELAY_MS);
    intent.useChord();

    expect(intent.visible).toBe(true);
    expect(changes).toEqual([true]);

    intent.cancel();
    expect(changes).toEqual([true, false]);
  });
});

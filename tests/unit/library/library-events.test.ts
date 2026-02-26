/**
 * library-events.ts Tests
 *
 * Tests the cross-module event bus that notifies gallery subscribers when
 * the user's sequence library is mutated (e.g. after a delete).
 *
 * HIGH VALUE: These tests catch two silent failure modes:
 *   1. onLibraryMutated fails to clean up — gallery reloads on every future
 *      mutation even after the component is destroyed (listener leak).
 *   2. notifyLibraryMutated dispatches under a different event name than
 *      onLibraryMutated listens for — gallery silently stops refreshing.
 *
 * Note: the event-name test spies on window.dispatchEvent so it will fail
 * if the constant in library-events.ts is renamed without updating subscribers.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  notifyLibraryMutated,
  onLibraryMutated,
  LIBRARY_MUTATED_EVENT,
} from "$lib/shared/library/library-events";

afterEach(() => {
  // Clean up any lingering listeners between tests
  vi.restoreAllMocks();
});

describe("notifyLibraryMutated", () => {
  it("dispatches an event named 'tka:library-mutated'", () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    notifyLibraryMutated();
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: LIBRARY_MUTATED_EVENT })
    );
  });

  it("calls a registered handler", () => {
    const handler = vi.fn();
    const cleanup = onLibraryMutated(handler);

    notifyLibraryMutated();

    expect(handler).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("calls multiple registered handlers", () => {
    const handlerA = vi.fn();
    const handlerB = vi.fn();
    const cleanupA = onLibraryMutated(handlerA);
    const cleanupB = onLibraryMutated(handlerB);

    notifyLibraryMutated();

    expect(handlerA).toHaveBeenCalledTimes(1);
    expect(handlerB).toHaveBeenCalledTimes(1);
    cleanupA();
    cleanupB();
  });

  it("calls handlers each time it is dispatched", () => {
    const handler = vi.fn();
    const cleanup = onLibraryMutated(handler);

    notifyLibraryMutated();
    notifyLibraryMutated();
    notifyLibraryMutated();

    expect(handler).toHaveBeenCalledTimes(3);
    cleanup();
  });
});

describe("onLibraryMutated cleanup", () => {
  it("stops calling the handler after cleanup is invoked", () => {
    const handler = vi.fn();
    const cleanup = onLibraryMutated(handler);

    notifyLibraryMutated();
    expect(handler).toHaveBeenCalledTimes(1);

    cleanup();
    notifyLibraryMutated();

    // Still only 1 call — cleanup removed the listener
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("only removes the specific handler, not others", () => {
    const handlerA = vi.fn();
    const handlerB = vi.fn();
    const cleanupA = onLibraryMutated(handlerA);
    const cleanupB = onLibraryMutated(handlerB);

    cleanupA();
    notifyLibraryMutated();

    expect(handlerA).toHaveBeenCalledTimes(0);
    expect(handlerB).toHaveBeenCalledTimes(1);
    cleanupB();
  });

  it("is safe to call cleanup more than once", () => {
    const handler = vi.fn();
    const cleanup = onLibraryMutated(handler);

    cleanup();
    expect(() => cleanup()).not.toThrow();

    notifyLibraryMutated();
    expect(handler).toHaveBeenCalledTimes(0);
  });
});

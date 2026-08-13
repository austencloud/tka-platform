import { describe, expect, it, vi } from "vitest";
import {
  beginNativeScanViewerTransition,
  clearNativeScanViewerReady,
  isNativeScanViewerTransitionPending,
  isNativeScanViewerReady,
  markNativeScanLoadingSurfaceReady,
  markNativeScanViewerFailed,
  markNativeScanViewerReady,
  subscribeNativeScanViewerTransition,
  waitForNativeScanLoadingSurfaceReady,
  waitForNativeScanViewerReady,
} from "$lib/shared/platform/services/native-scan-viewer-readiness";

describe("native scan viewer readiness", () => {
  it("waits for the matching viewer card instead of an older open sequence", async () => {
    clearNativeScanViewerReady();
    markNativeScanViewerReady("OLD42");

    beginNativeScanViewerTransition("new42");
    const readiness = waitForNativeScanViewerReady("new42");
    markNativeScanViewerReady("NEW42");

    await expect(readiness).resolves.toBe("ready");
    expect(isNativeScanViewerReady("new42")).toBe(true);
  });

  it("releases the native surface when resolution fails", async () => {
    clearNativeScanViewerReady();
    beginNativeScanViewerTransition("MISS42");
    const readiness = waitForNativeScanViewerReady("MISS42");

    markNativeScanViewerFailed("MISS42");

    await expect(readiness).resolves.toBe("failed");
  });

  it("has a safety ceiling when the viewer never reports readiness", async () => {
    vi.useFakeTimers();
    clearNativeScanViewerReady();
    beginNativeScanViewerTransition("SLOW42");
    const readiness = waitForNativeScanViewerReady("SLOW42", 500);

    await vi.advanceTimersByTimeAsync(500);

    await expect(readiness).resolves.toBe("timeout");
    vi.useRealTimers();
  });

  it("hands off to the app loader while playback stays gated", async () => {
    clearNativeScanViewerReady();
    const transitions: Array<{ code: string; phase: string }> = [];
    const unsubscribe = subscribeNativeScanViewerTransition((transition) => {
      transitions.push(transition);
    });

    beginNativeScanViewerTransition("wow42");
    expect(isNativeScanViewerTransitionPending("WOW42")).toBe(true);

    const loadingSurface = waitForNativeScanLoadingSurfaceReady("WOW42");
    markNativeScanLoadingSurfaceReady("WOW42");
    await expect(loadingSurface).resolves.toBe("ready");
    expect(isNativeScanViewerTransitionPending("WOW42")).toBe(true);

    markNativeScanViewerReady("WOW42");
    expect(isNativeScanViewerTransitionPending("WOW42")).toBe(false);
    expect(transitions).toEqual([
      { code: "WOW42", phase: "started" },
      { code: "WOW42", phase: "revealed" },
    ]);

    unsubscribe();
  });

  it("keeps a painted loader ready when Android repeats the same deep link", async () => {
    clearNativeScanViewerReady();
    beginNativeScanViewerTransition("SAME42");
    markNativeScanLoadingSurfaceReady("SAME42");

    beginNativeScanViewerTransition("same42");

    await expect(
      waitForNativeScanLoadingSurfaceReady("SAME42")
    ).resolves.toBe("ready");
    expect(isNativeScanViewerTransitionPending("SAME42")).toBe(true);
  });
});

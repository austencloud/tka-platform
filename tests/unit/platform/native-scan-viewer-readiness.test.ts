import { describe, expect, it, vi } from "vitest";
import {
  clearNativeScanViewerReady,
  isNativeScanViewerReady,
  markNativeScanViewerFailed,
  markNativeScanViewerReady,
  waitForNativeScanViewerReady,
} from "$lib/shared/platform/services/native-scan-viewer-readiness";

describe("native scan viewer readiness", () => {
  it("waits for the matching viewer card instead of an older open sequence", async () => {
    clearNativeScanViewerReady();
    markNativeScanViewerReady("OLD42");

    const readiness = waitForNativeScanViewerReady("new42");
    markNativeScanViewerReady("NEW42");

    await expect(readiness).resolves.toBe("ready");
    expect(isNativeScanViewerReady("new42")).toBe(true);
  });

  it("releases the native surface when resolution fails", async () => {
    clearNativeScanViewerReady();
    const readiness = waitForNativeScanViewerReady("MISS42");

    markNativeScanViewerFailed("MISS42");

    await expect(readiness).resolves.toBe("failed");
  });

  it("has a safety ceiling when the viewer never reports readiness", async () => {
    vi.useFakeTimers();
    clearNativeScanViewerReady();
    const readiness = waitForNativeScanViewerReady("SLOW42", 500);

    await vi.advanceTimersByTimeAsync(500);

    await expect(readiness).resolves.toBe("timeout");
    vi.useRealTimers();
  });
});

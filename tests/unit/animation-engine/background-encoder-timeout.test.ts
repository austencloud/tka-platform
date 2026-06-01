// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BackgroundVideoEncoder } from "$lib/shared/animation-engine/services/background-video-encoder";

// Stub Worker that never posts "ready" — simulates a stalled configure().
class SilentWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  postMessage() {} // swallow config; never reply
  terminate() {}
}

describe("BackgroundVideoEncoder.initialize timeout", () => {
  beforeEach(() => {
    vi.stubGlobal("Worker", SilentWorker as unknown as typeof Worker);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("rejects when the worker never reports ready", async () => {
    const enc = new BackgroundVideoEncoder();
    const p = enc.initialize({ width: 1080, height: 1080, fps: 60, bitrate: 1_000_000, totalFrames: 60 });
    const assertion = expect(p).rejects.toThrow(/timed out|ready/i);
    await vi.advanceTimersByTimeAsync(20_000);
    await assertion;
  });
});

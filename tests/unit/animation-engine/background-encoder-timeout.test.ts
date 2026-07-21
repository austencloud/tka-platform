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
    // Must clear BackgroundVideoEncoder.READY_TIMEOUT_MS (30s since the
    // "pause render loop before encoder init" fix raised it from 15s — a cold
    // mediabunny load can legitimately take >15s). Advancing less than the
    // ceiling never fires the timer, so the rejection never arrives.
    await vi.advanceTimersByTimeAsync(35_000);
    await assertion;
  });
});

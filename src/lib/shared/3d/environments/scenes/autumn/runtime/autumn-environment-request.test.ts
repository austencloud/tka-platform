import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AUTUMN_ENVIRONMENT_STALL_TIMEOUT_MS,
  AUTUMN_ENVIRONMENT_TOTAL_TIMEOUT_MS,
  startAutumnEnvironmentRequest,
} from "./autumn-environment-request";

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => vi.useRealTimers());

describe("Autumn environment request", () => {
  it("delivers a successful retry request exactly once", async () => {
    const onReady = vi.fn();
    const onFailure = vi.fn();
    const load = vi.fn(async () => "loaded-scene");

    startAutumnEnvironmentRequest({
      retryRequest: 3,
      load,
      onReady,
      onFailure,
    });
    await flushPromises();

    expect(load).toHaveBeenCalledWith(
      "/models/autumn/autumn-environment.glb?retry=3",
      expect.any(Function),
      expect.any(AbortSignal)
    );
    expect(onReady).toHaveBeenCalledOnce();
    expect(onReady).toHaveBeenCalledWith("loaded-scene");
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("reports a rejected main asset without pretending it is ready", async () => {
    const error = new Error("decode failed");
    const onReady = vi.fn();
    const onFailure = vi.fn();

    startAutumnEnvironmentRequest({
      retryRequest: 0,
      load: async () => {
        throw error;
      },
      onReady,
      onFailure,
    });
    await flushPromises();

    expect(onReady).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "rejected", error })
    );
  });

  it("times out once and ignores a late resolution", async () => {
    vi.useFakeTimers();
    let resolve!: (value: string) => void;
    let signal!: AbortSignal;
    const load = (
      _url: string,
      _onProgress: unknown,
      nextSignal: AbortSignal
    ) => {
      signal = nextSignal;
      return new Promise<string>((nextResolve) => {
        resolve = nextResolve;
      });
    };
    const onReady = vi.fn();
    const onFailure = vi.fn();

    startAutumnEnvironmentRequest({
      retryRequest: 0,
      load,
      onReady,
      onFailure,
    });
    await flushPromises();
    vi.advanceTimersByTime(AUTUMN_ENVIRONMENT_STALL_TIMEOUT_MS);
    resolve("too-late");
    await flushPromises();

    expect(onFailure).toHaveBeenCalledOnce();
    expect(onFailure).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "timeout" })
    );
    expect(signal.aborted).toBe(true);
    expect(onReady).not.toHaveBeenCalled();
  });

  it("keeps a healthy long download alive while bytes continue arriving", async () => {
    vi.useFakeTimers();
    let resolve!: (value: string) => void;
    let reportProgress!: (progress: { loaded: number; total?: number }) => void;
    const onReady = vi.fn();
    const onFailure = vi.fn();

    startAutumnEnvironmentRequest({
      retryRequest: 0,
      load: (_url, onProgress) => {
        reportProgress = onProgress;
        return new Promise<string>((nextResolve) => {
          resolve = nextResolve;
        });
      },
      onReady,
      onFailure,
    });
    await flushPromises();

    for (let loaded = 1; loaded <= 4; loaded += 1) {
      vi.advanceTimersByTime(AUTUMN_ENVIRONMENT_STALL_TIMEOUT_MS - 1_000);
      reportProgress({ loaded: loaded * 4_000_000, total: 18_165_324 });
    }
    resolve("loaded-after-56-seconds");
    await flushPromises();

    expect(onFailure).not.toHaveBeenCalled();
    expect(onReady).toHaveBeenCalledWith("loaded-after-56-seconds");
  });

  it("still enforces a bounded total request lifetime", async () => {
    vi.useFakeTimers();
    let reportProgress!: (progress: { loaded: number; total?: number }) => void;
    const onFailure = vi.fn();

    startAutumnEnvironmentRequest({
      retryRequest: 0,
      load: (_url, onProgress) => {
        reportProgress = onProgress;
        return new Promise<string>(() => undefined);
      },
      onReady: vi.fn(),
      onFailure,
    });
    await flushPromises();

    for (
      let elapsed = 0;
      elapsed < AUTUMN_ENVIRONMENT_TOTAL_TIMEOUT_MS;
      elapsed += 10_000
    ) {
      vi.advanceTimersByTime(10_000);
      reportProgress({ loaded: elapsed + 1 });
    }

    expect(onFailure).toHaveBeenCalledOnce();
    expect(onFailure).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "timeout" })
    );
  });

  it("silences callbacks after retained-scene teardown", async () => {
    let resolve!: (value: string) => void;
    let signal!: AbortSignal;
    const onReady = vi.fn();
    const onFailure = vi.fn();
    const stop = startAutumnEnvironmentRequest({
      retryRequest: 0,
      load: (_url, _onProgress, nextSignal) =>
        new Promise<string>((nextResolve) => {
          signal = nextSignal;
          resolve = nextResolve;
        }),
      onReady,
      onFailure,
    });
    await flushPromises();

    stop();
    expect(signal.aborted).toBe(true);
    resolve("cancelled");
    await flushPromises();

    expect(onReady).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
  });
});

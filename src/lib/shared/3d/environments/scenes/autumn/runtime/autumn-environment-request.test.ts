import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AUTUMN_ENVIRONMENT_TIMEOUT_MS,
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
      "/models/autumn/autumn-environment.glb?retry=3"
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
    const load = () =>
      new Promise<string>((nextResolve) => {
        resolve = nextResolve;
      });
    const onReady = vi.fn();
    const onFailure = vi.fn();

    startAutumnEnvironmentRequest({
      retryRequest: 0,
      load,
      onReady,
      onFailure,
    });
    await flushPromises();
    vi.advanceTimersByTime(AUTUMN_ENVIRONMENT_TIMEOUT_MS);
    resolve("too-late");
    await flushPromises();

    expect(onFailure).toHaveBeenCalledOnce();
    expect(onFailure).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "timeout" })
    );
    expect(onReady).not.toHaveBeenCalled();
  });

  it("silences callbacks after retained-scene teardown", async () => {
    let resolve!: (value: string) => void;
    const onReady = vi.fn();
    const onFailure = vi.fn();
    const stop = startAutumnEnvironmentRequest({
      retryRequest: 0,
      load: () =>
        new Promise<string>((nextResolve) => {
          resolve = nextResolve;
        }),
      onReady,
      onFailure,
    });
    await flushPromises();

    stop();
    resolve("cancelled");
    await flushPromises();

    expect(onReady).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
  });
});

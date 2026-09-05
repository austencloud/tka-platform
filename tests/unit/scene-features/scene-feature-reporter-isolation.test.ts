import { afterEach, describe, expect, it, vi } from "vitest";
import { flushSync } from "svelte";

const mockStorage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, value: string) => mockStorage.set(key, value),
  removeItem: (key: string) => mockStorage.delete(key),
});

import { mountFeatureReporter } from "./scene-feature-reporter-test-helper.svelte";

// A scene's load effect reports "environment 0%" and then starts an asset
// load. That effect must not rerun because another feature — or its own
// loader, asynchronously — reported progress: every rerun cancels the load
// in flight and starts it again.
describe("scene feature reporters do not subscribe their caller", () => {
  let dispose: (() => void) | null = null;
  afterEach(() => {
    dispose?.();
    dispose = null;
    vi.restoreAllMocks();
  });

  it("reportProgress from an effect does not rerun it when other progress lands", () => {
    vi.spyOn(console, "debug").mockImplementation(() => {});
    const mounted = mountFeatureReporter((state) =>
      state.reportProgress("environment", 0)
    );
    dispose = mounted.dispose;
    flushSync();
    expect(mounted.runs()).toBe(1);

    mounted.state.reportProgress("performers", 0.5);
    flushSync();
    mounted.state.reportProgress("environment", 0.4);
    flushSync();
    mounted.state.reportReady("performers");
    flushSync();

    expect(mounted.runs()).toBe(1);
  });

  it("reportReady from an effect does not rerun it when other features settle", () => {
    vi.spyOn(console, "debug").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const mounted = mountFeatureReporter((state) =>
      state.reportReady("environment")
    );
    dispose = mounted.dispose;
    flushSync();
    expect(mounted.runs()).toBe(1);

    mounted.state.reportFailed("performers", "boom");
    flushSync();
    mounted.state.reportReady("performers");
    flushSync();
    mounted.state.reportProgress("props", 1);
    flushSync();

    expect(mounted.runs()).toBe(1);
  });
});

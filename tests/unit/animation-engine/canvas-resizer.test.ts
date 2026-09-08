// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasResizer } from "$lib/shared/animation-engine/services/canvas-resizer.svelte";

describe("CanvasResizer", () => {
  let notifyResize: ResizeObserverCallback;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          notifyResize = callback;
        }

        observe(): void {}
        disconnect(): void {}
        unobserve(): void {}
      }
    );
  });

  afterEach(() => {
    delete document.documentElement.dataset.motionPreference;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("retains the readable backing size while its workspace pane is inert", async () => {
    let width = 630;
    let inert = false;
    const container = {
      closest: (selector: string) =>
        inert && selector === "[inert]" ? {} : null,
      getBoundingClientRect: () =>
        ({
          width,
          height: 780,
          top: 0,
          right: width,
          bottom: 780,
          left: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect,
    } as unknown as HTMLDivElement;

    const renderer = { resize: vi.fn().mockResolvedValue(undefined) };
    const resizer = new CanvasResizer();
    resizer.initialize(container, renderer);
    resizer.setup();

    notifyResize([], {} as ResizeObserver);
    await Promise.resolve();
    expect(renderer.resize).toHaveBeenLastCalledWith(630);

    inert = true;
    width = 48;
    notifyResize([], {} as ResizeObserver);
    await vi.advanceTimersByTimeAsync(100);
    expect(renderer.resize).toHaveBeenCalledTimes(1);
    expect(resizer.state.currentSize).toBe(630);

    inert = false;
    width = 48;
    notifyResize([], {} as ResizeObserver);
    await vi.advanceTimersByTimeAsync(200);
    expect(renderer.resize).toHaveBeenCalledTimes(1);

    width = 560;
    notifyResize([], {} as ResizeObserver);
    await vi.advanceTimersByTimeAsync(120);
    expect(renderer.resize).toHaveBeenLastCalledWith(560);
    expect(resizer.state.currentSize).toBe(560);

    resizer.dispose();
  });

  it("waits for the final reduced-motion layout before rebuilding", async () => {
    let width = 630;
    let inert = false;
    const container = {
      closest: (selector: string) =>
        inert && selector === "[inert]" ? {} : null,
      getBoundingClientRect: () =>
        ({
          width,
          height: 780,
          top: 0,
          right: width,
          bottom: 780,
          left: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect,
    } as unknown as HTMLDivElement;
    const renderer = { resize: vi.fn().mockResolvedValue(undefined) };
    const resizer = new CanvasResizer();
    resizer.initialize(container, renderer);
    resizer.setup();

    notifyResize([], {} as ResizeObserver);
    await Promise.resolve();

    inert = true;
    width = 48;
    notifyResize([], {} as ResizeObserver);
    document.documentElement.dataset.motionPreference = "reduce";
    inert = false;
    notifyResize([], {} as ResizeObserver);

    await vi.advanceTimersByTimeAsync(39);
    expect(renderer.resize).toHaveBeenCalledTimes(1);

    width = 560;
    await vi.advanceTimersByTimeAsync(1);
    expect(renderer.resize).toHaveBeenLastCalledWith(560);
    expect(renderer.resize).toHaveBeenCalledTimes(2);

    resizer.dispose();
  });
});

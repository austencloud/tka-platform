// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

const initialize = vi.fn().mockResolvedValue(undefined);
const dispose = vi.fn();
const fakeCanvas = { width: 720, height: 720 } as HTMLCanvasElement;
const getRenderContext = vi.fn(() => ({
  id: "x", canvas: fakeCanvas, container: {} as any,
  renderer: {} as any, effectManager: {} as any, trailCapturer: {} as any,
  renderLoop: {} as any, resizer: {} as any, precomputer: {} as any,
  size: 720, resize() {}, restoreSize() {}, dispose,
}));

// NOTE: vitest 4 cannot `new` a mock whose implementation is an arrow fn, so the
// implementation is a regular function returning the fake engine (same contract).
vi.mock("../AnimationEngine.svelte", () => ({
  AnimationEngine: vi.fn(function () { return { initialize, getRenderContext, dispose }; }),
}));

import { RenderContextFactory } from "../RenderContextFactory";

describe("RenderContextFactory.createOffscreenContext", () => {
  beforeEach(() => { initialize.mockClear(); dispose.mockClear(); getRenderContext.mockClear(); });

  it("builds a headless engine, returns a context, and disposes cleanly", async () => {
    const factory = new RenderContextFactory();
    const handle = await factory.createOffscreenContext(720);
    expect(initialize).toHaveBeenCalledOnce();
    expect(handle.engine).toBeDefined();
    expect(handle.context.canvas).toBe(fakeCanvas);
    expect(document.body.querySelector("div[data-offscreen-render]")).not.toBeNull();
    handle.dispose();
    expect(dispose).toHaveBeenCalledOnce();
    expect(document.body.querySelector("div[data-offscreen-render]")).toBeNull();
  });

  it("no longer exposes createLiveContext", () => {
    const factory = new RenderContextFactory() as unknown as Record<string, unknown>;
    expect(factory.createLiveContext).toBeUndefined();
  });
});

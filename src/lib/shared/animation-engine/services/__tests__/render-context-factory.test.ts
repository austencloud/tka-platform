// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const initialize = vi.fn().mockResolvedValue(undefined);
const dispose = vi.fn();
// Seeding/wiring hooks the factory calls before initialize. The real
// AnimationEngine exposes these (animation-engine.svelte.ts:183/196/208); the
// mock must expose them too or `createOffscreenContext` throws when it seeds
// the canvas size / visibility / effects config.
const setInitialCanvasSize = vi.fn();
const setVisibilityManager = vi.fn();
const setEffectsConfigState = vi.fn();
const fakeCanvas = { width: 720, height: 720 } as HTMLCanvasElement;
const getRenderContext = vi.fn(() => ({
  id: "x", canvas: fakeCanvas, container: {} as any,
  renderer: {} as any, effectManager: {} as any, trailCapturer: {} as any,
  renderLoop: {} as any, resizer: {} as any, precomputer: {} as any,
  size: 720, resize() {}, restoreSize() {}, dispose,
}));

// NOTE: vitest 4 cannot `new` a mock whose implementation is an arrow fn, so the
// implementation is a regular function returning the fake engine (same contract).
vi.mock("../animation-engine.svelte", () => ({
  AnimationEngine: vi.fn(function () {
    return {
      initialize,
      getRenderContext,
      dispose,
      setInitialCanvasSize,
      setVisibilityManager,
      setEffectsConfigState,
    };
  }),
}));

import { RenderContextFactory } from "../render-context-factory";

// The global test setup (tests/setup/vitest-setup.ts) shadows document.createElement
// with a fake that returns plain objects for EVERY tag (so canvas tests get a stub
// 2D context). createOffscreenContext, though, builds a real <div> and calls
// document.body.appendChild on it — the plain-object fake makes jsdom reject the
// node ("parameter 1 is not of type 'Node'"). Restore jsdom's real createElement for
// this suite so the factory can append + query + remove a genuine container. The
// setup defined the override as writable, so a plain assignment un-shadows it; the
// real method still lives on the document prototype.
const realCreateElement = Object.getPrototypeOf(document).createElement.bind(document);

describe("RenderContextFactory.createOffscreenContext", () => {
  let fakeCreateElement: typeof document.createElement;
  beforeEach(() => {
    initialize.mockClear(); dispose.mockClear(); getRenderContext.mockClear();
    fakeCreateElement = document.createElement;
    document.createElement = realCreateElement;
  });
  afterEach(() => {
    document.createElement = fakeCreateElement;
  });

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

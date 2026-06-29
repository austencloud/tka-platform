// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The manager builds OVERLAY_PLUGINS from EFFECT_PLUGINS at module load and calls
// plugin.createRenderer() to make real WebGL renderers — which can't init in node.
// Mock the registry with a single fake webgl "fire" plugin whose renderer is a
// plain stub, so we can exercise the prewarm + keep-warm STATE LOGIC in isolation.
function makeFakeRenderer() {
  const canvas = { style: { display: "" } } as unknown as HTMLCanvasElement;
  let inited = false;
  return {
    canvas,
    initialize: vi.fn(() => { inited = true; return true; }),
    isInitialized: () => inited,
    dispose: vi.fn(() => { inited = false; }),
    getCanvas: () => canvas,
    resize: vi.fn(),
    setCanvasZIndex: vi.fn(),
  };
}

// vi.mock is hoisted above top-level code, so the fake plugin + spies it
// references must be created inside vi.hoisted (also hoisted) — not as plain
// top-level consts (which would be in the temporal dead zone at mock time).
const h = vi.hoisted(() => {
  const createRenderer = vi.fn();
  const onDisable = vi.fn();
  const firePlugin = {
    id: "fire",
    kind: "webgl",
    createRenderer,
    configKey: "fireRenderer",
    defaultConfig: {},
    onDisable,
  };
  return { createRenderer, onDisable, firePlugin };
});
const { createRenderer, onDisable } = h;

let fakeRenderer: ReturnType<typeof makeFakeRenderer>;

vi.mock("../effects/registry", () => ({
  EFFECT_PLUGINS: [h.firePlugin],
  EFFECT_PLUGIN_BY_ID: { fire: h.firePlugin },
}));

import { EffectRendererManager } from "../effect-renderer-manager";

function wiredManager() {
  const manager = new EffectRendererManager();
  const renderLoopService = { updateConfig: vi.fn(), triggerRender: vi.fn() };
  manager.wire({
    containerElement: {} as HTMLDivElement,
    canvasSize: 500,
    renderLoopService: renderLoopService as never,
    getFrameParams: () => ({}) as never,
    getVM: () => ({}) as never,
  });
  return { manager, renderLoopService };
}

describe("EffectRendererManager — prewarm + keep-warm", () => {
  beforeEach(() => {
    fakeRenderer = makeFakeRenderer();
    createRenderer.mockReset();
    createRenderer.mockReturnValue(fakeRenderer);
    onDisable.mockClear();
    // Run the deferred init rAF synchronously so the test is linear.
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { cb(0); return 1; });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("prewarmRenderer creates the renderer but leaves it disabled + parked (hidden)", () => {
    const { manager } = wiredManager();
    manager.prewarmRenderer("fire");

    expect(createRenderer).toHaveBeenCalledTimes(1);
    expect(manager.getRenderer("fire")).toBe(fakeRenderer);
    expect(fakeRenderer.isInitialized()).toBe(true);
    // Warmed, not enabled — the render loop will not simulate it.
    expect(manager.isEffectEnabled("fire")).toBe(false);
    // Parked: canvas hidden so a preserveDrawingBuffer frame can't leak through.
    expect(fakeRenderer.canvas.style.display).toBe("none");
  });

  it("enabling a prewarmed effect reuses the warm renderer (no re-create) and shows it", () => {
    const { manager } = wiredManager();
    manager.prewarmRenderer("fire");
    createRenderer.mockClear();

    manager.setWasEnabled("fire", true);
    manager.syncEffectOverlay("fire");

    expect(createRenderer).not.toHaveBeenCalled(); // un-parked, not rebuilt
    expect(manager.getRenderer("fire")).toBe(fakeRenderer);
    expect(fakeRenderer.canvas.style.display).toBe(""); // shown
  });

  it("disabling a webgl effect parks it warm instead of disposing", () => {
    const { manager } = wiredManager();
    // Cold enable (no prewarm): the deferred webgl init runs via the stubbed rAF.
    manager.setWasEnabled("fire", true);
    manager.syncEffectOverlay("fire");
    expect(fakeRenderer.isInitialized()).toBe(true);

    // Disable.
    manager.setWasEnabled("fire", false);
    manager.syncEffectOverlay("fire");

    expect(fakeRenderer.dispose).not.toHaveBeenCalled(); // kept warm
    expect(manager.getRenderer("fire")).toBe(fakeRenderer); // still held
    expect(fakeRenderer.canvas.style.display).toBe("none"); // parked hidden
    expect(onDisable).toHaveBeenCalledTimes(1); // transition fired exactly once
  });

  it("repeated disabled syncs are a no-op (the warmHidden guard prevents per-frame onDisable)", () => {
    const { manager } = wiredManager();
    manager.setWasEnabled("fire", true);
    manager.syncEffectOverlay("fire");
    manager.setWasEnabled("fire", false);
    manager.syncEffectOverlay("fire"); // park (onDisable #1)
    onDisable.mockClear();

    // Mimics CanvasSurface calling setFireConfig every frame while fire is off.
    manager.syncEffectOverlay("fire");
    manager.syncEffectOverlay("fire");

    expect(onDisable).not.toHaveBeenCalled();
    expect(fakeRenderer.dispose).not.toHaveBeenCalled();
  });

  it("full dispose() tears down the parked renderer", () => {
    const { manager } = wiredManager();
    manager.prewarmRenderer("fire");
    expect(fakeRenderer.isInitialized()).toBe(true);

    manager.dispose();

    expect(fakeRenderer.dispose).toHaveBeenCalled();
    expect(manager.getRenderer("fire")).toBeNull();
  });
});

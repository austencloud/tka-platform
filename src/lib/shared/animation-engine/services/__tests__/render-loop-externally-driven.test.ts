import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AnimationRenderLoop } from "../animation-render-loop";
import type { RenderLoopConfig, RenderFrameParams } from "../IAnimationRenderLoop";

// Regression guard for the "fire/charcoal/LED video export drops all props" bug.
//
// The offscreen export engine renders every frame deterministically via
// renderSync() and stops its free-running rAF loop in initialize(). But the
// fire/charcoal/LED keep-warm + prewarm paths (effect-renderer-manager) call
// renderLoop.triggerRender(), which RESTARTED the loop. The restarted loop then
// rendered the engine's OWN internal state (which never receives per-frame prop
// positions → blueProp/redProp null) with a wall clock, calling setVisible(false)
// on the prop fade managers between capture frames. That raced the export's
// virtual-clock setVisible(true), pinning prop alpha to 0 in every captured
// frame — props vanished from the export while grid + the effect survived.
//
// setExternallyDriven(true) makes start()/triggerRender()/self-reschedule no-ops
// so effect keep-warm can no longer restart the loop. renderSync() is unaffected.
describe("AnimationRenderLoop.setExternallyDriven", () => {
  let rafSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    rafSpy = vi.fn(() => 123);
    vi.stubGlobal("requestAnimationFrame", rafSpy);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function makeLoop(): AnimationRenderLoop {
    const loop = new AnimationRenderLoop();
    // Only `renderer` gates rAF scheduling in start()/triggerRender(); the rest
    // is irrelevant to this test, so a truthy stub is enough.
    loop.initialize({ renderer: {} } as unknown as RenderLoopConfig);
    return loop;
  }

  const params = () => ({}) as RenderFrameParams;

  it("start() schedules an rAF frame when NOT externally driven (baseline)", () => {
    const loop = makeLoop();
    loop.start(params);
    expect(rafSpy).toHaveBeenCalledTimes(1);
    expect(loop.isRunning()).toBe(true);
  });

  it("triggerRender() schedules an rAF frame when NOT externally driven (baseline)", () => {
    const loop = makeLoop();
    loop.triggerRender(params);
    expect(rafSpy).toHaveBeenCalledTimes(1);
    expect(loop.isRunning()).toBe(true);
  });

  it("start() and triggerRender() are no-ops once externally driven", () => {
    const loop = makeLoop();
    loop.setExternallyDriven(true);
    loop.start(params);
    loop.triggerRender(params);
    expect(rafSpy).not.toHaveBeenCalled();
    expect(loop.isRunning()).toBe(false);
  });

  it("setExternallyDriven(true) stops an already-running loop", () => {
    const loop = makeLoop();
    loop.start(params);
    expect(loop.isRunning()).toBe(true);
    loop.setExternallyDriven(true);
    expect(loop.isRunning()).toBe(false);
  });

  it("re-enabling (false) restores rAF scheduling", () => {
    const loop = makeLoop();
    loop.setExternallyDriven(true);
    loop.setExternallyDriven(false);
    loop.triggerRender(params);
    expect(rafSpy).toHaveBeenCalledTimes(1);
    expect(loop.isRunning()).toBe(true);
  });
});

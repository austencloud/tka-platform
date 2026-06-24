import { describe, it, expect, vi } from "vitest";
import { CanvasLifecycleManager } from "$lib/shared/animation-engine/services/canvas-lifecycle-manager";

describe("CanvasLifecycleManager", () => {
  it("pauseResize delegates to resizer", () => {
    const resizer = { pauseObservation: vi.fn(), resumeObservation: vi.fn() };
    const mgr = new CanvasLifecycleManager();
    mgr.setResizer(resizer as any);
    mgr.pauseResize();
    expect(resizer.pauseObservation).toHaveBeenCalled();
  });

  it("resumeResize delegates to resizer", () => {
    const resizer = { pauseObservation: vi.fn(), resumeObservation: vi.fn() };
    const mgr = new CanvasLifecycleManager();
    mgr.setResizer(resizer as any);
    mgr.resumeResize();
    expect(resizer.resumeObservation).toHaveBeenCalled();
  });

  it("pauseResize is safe when no resizer set", () => {
    const mgr = new CanvasLifecycleManager();
    expect(() => mgr.pauseResize()).not.toThrow();
  });

  it("resumeResize is safe when no resizer set", () => {
    const mgr = new CanvasLifecycleManager();
    expect(() => mgr.resumeResize()).not.toThrow();
  });

  it("dispose tears down resizer and render loop", () => {
    const resizer = { teardown: vi.fn() };
    const renderLoop = { dispose: vi.fn() };
    const effectManager = { dispose: vi.fn() };
    const trailCapturer = { clearTrails: vi.fn() };
    const mgr = new CanvasLifecycleManager();
    mgr.setResizer(resizer as any);
    mgr.setRenderLoop(renderLoop as any);
    mgr.setEffectManager(effectManager as any);
    mgr.setTrailCapturer(trailCapturer as any);
    mgr.dispose();
    expect(resizer.teardown).toHaveBeenCalled();
    expect(renderLoop.dispose).toHaveBeenCalled();
    expect(effectManager.dispose).toHaveBeenCalled();
    expect(trailCapturer.clearTrails).toHaveBeenCalled();
  });

  it("dispose calls unsubscribeVisibility", () => {
    const unsubscribe = vi.fn();
    const mgr = new CanvasLifecycleManager();
    mgr.setUnsubscribeVisibility(unsubscribe);
    mgr.dispose();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("dispose tears down all services", () => {
    const visibilitySync = { dispose: vi.fn() };
    const glyphTransition = { dispose: vi.fn() };
    const sequenceCache = { dispose: vi.fn() };
    const trailSettingsSync = { dispose: vi.fn() };
    const propTypeChange = { dispose: vi.fn() };
    const precomputer = { dispose: vi.fn() };
    const glyphTexture = { dispose: vi.fn() };
    const propTexture = { dispose: vi.fn() };

    const mgr = new CanvasLifecycleManager();
    mgr.setVisibilitySyncService(visibilitySync as any);
    mgr.setGlyphTransitionService(glyphTransition as any);
    mgr.setSequenceCacheService(sequenceCache as any);
    mgr.setTrailSettingsSyncService(trailSettingsSync as any);
    mgr.setPropTypeChangeService(propTypeChange as any);
    mgr.setPrecomputer(precomputer as any);
    mgr.setGlyphTextureService(glyphTexture as any);
    mgr.setPropTextureService(propTexture as any);
    mgr.dispose();

    expect(visibilitySync.dispose).toHaveBeenCalled();
    expect(glyphTransition.dispose).toHaveBeenCalled();
    expect(sequenceCache.dispose).toHaveBeenCalled();
    expect(trailSettingsSync.dispose).toHaveBeenCalled();
    expect(propTypeChange.dispose).toHaveBeenCalled();
    expect(precomputer.dispose).toHaveBeenCalled();
    expect(glyphTexture.dispose).toHaveBeenCalled();
    expect(propTexture.dispose).toHaveBeenCalled();
  });

  it("dispose calls canvasInitializer.destroy with callbacks", () => {
    const canvasInitializer = { destroy: vi.fn() };
    const onCanvasReady = vi.fn();
    const onInitialized = vi.fn();

    const mgr = new CanvasLifecycleManager();
    mgr.setCanvasInitializer(canvasInitializer as any);
    mgr.dispose({ onCanvasReady, onInitialized });

    expect(canvasInitializer.destroy).toHaveBeenCalledWith({
      onCanvasReady: expect.any(Function),
      onInitialized: expect.any(Function),
    });
  });

  it("dispose is safe with no services set", () => {
    const mgr = new CanvasLifecycleManager();
    expect(() => mgr.dispose()).not.toThrow();
  });
});

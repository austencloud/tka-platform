import { describe, it, expect } from "vitest";
import { Canvas2DVisibilityFadeManager } from "../canvas-2d-visibility-fade-manager";
import { Canvas2DGridFadeManager } from "../canvas-2d-grid-fade-manager";
import { Canvas2DFadeManager } from "../canvas-2d-fade-manager";

/**
 * Regression guard for the "props invisible in exported video" bug.
 *
 * The fade managers must use the SAME clock for the transition start and the
 * elapsed measurement. The live path drives them with rAF performance.now();
 * the offscreen video-export path drives them with a virtual clock that starts
 * at 0. The original code stamped the start with performance.now() in
 * setVisible() but subtracted the caller's currentTime in updateProgress(), so
 * the export's virtual clock produced a massively negative elapsed → alpha
 * clamped to 0 → a fade-in never completed → props pinned invisible.
 *
 * These tests drive each manager with ONLY a virtual clock and assert that a
 * fade-in actually reaches alpha 1. They fail against the wall-clock version
 * (alpha stays clamped at 0) and pass once the manager is clock-agnostic.
 */
describe("fade managers are clock-agnostic (virtual-clock export path)", () => {
  it("Canvas2DVisibilityFadeManager completes a fade-in on a virtual clock from 0", () => {
    const m = new Canvas2DVisibilityFadeManager(250, 200);

    // Hide, then settle to fully hidden using only the virtual clock.
    m.setVisible(false);
    m.updateProgress(0); // lazy-stamp start = 0
    const hidden = m.updateProgress(200); // fade-out duration elapsed
    expect(hidden.alpha).toBeCloseTo(0, 5);

    // Flip back to visible — this is the fade-in that the bug pinned at 0.
    m.setVisible(true);
    const mid = m.updateProgress(200); // start re-stamped to 200; elapsed 0
    expect(mid.alpha).toBeLessThan(1);

    const done = m.updateProgress(450); // 250ms of virtual time → fully in
    expect(done.alpha).toBeCloseTo(1, 5);
    expect(done.isTransitioning).toBe(false);
  });

  it("Canvas2DVisibilityFadeManager never yields a negative/clamped alpha mid-fade", () => {
    const m = new Canvas2DVisibilityFadeManager(250, 200);
    m.setVisible(false);
    m.updateProgress(0);
    m.updateProgress(200);
    m.setVisible(true);
    // Sample the whole fade on the virtual clock; alpha must rise monotonically
    // within [0, 1], never the negative→clamp-0 collapse the wall clock caused.
    let prev = -1;
    for (let t = 200; t <= 450; t += 25) {
      const a = m.updateProgress(t).alpha;
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
      expect(a).toBeGreaterThanOrEqual(prev);
      prev = a;
    }
    expect(prev).toBeCloseTo(1, 5);
  });

  it("Canvas2DGridFadeManager completes a fade-in on a virtual clock from 0", () => {
    const m = new Canvas2DGridFadeManager();
    m.setVisible(false);
    m.updateProgress(0);
    expect(m.updateProgress(200).alpha).toBeCloseTo(0, 5);

    m.setVisible(true);
    expect(m.updateProgress(200).alpha).toBeLessThan(1);
    const done = m.updateProgress(450);
    expect(done.alpha).toBeCloseTo(1, 5);
    expect(done.isTransitioning).toBe(false);
  });

  it("Canvas2DFadeManager (glyph cross-fade) completes on a virtual clock from 0", () => {
    const m = new Canvas2DFadeManager();
    m.startFadeTransition();
    const mid = m.updateFadeProgress(0); // lazy-stamp start = 0
    expect(mid.currentAlpha).toBeGreaterThanOrEqual(0);
    expect(mid.currentAlpha).toBeLessThan(1);
    expect(mid.isComplete).toBe(false);

    const done = m.updateFadeProgress(300); // FADE_DURATION_MS elapsed
    expect(done.currentAlpha).toBe(1);
    expect(done.previousAlpha).toBe(0);
    expect(done.isComplete).toBe(true);
  });

  it("steady state with no transition returns the target alpha regardless of clock", () => {
    const m = new Canvas2DVisibilityFadeManager();
    // Default visible, no setVisible flip → not transitioning → alpha 1 at any t.
    expect(m.updateProgress(0).alpha).toBe(1);
    expect(m.updateProgress(999999).alpha).toBe(1);
  });
});

import { describe, it, expect } from "vitest";
import { Canvas2DFadeManager } from "../canvas-2d-fade-manager";

/**
 * Guards the constructor parameterization added for the hero-act prop morph
 * (2026-07-19 design, section A). Canvas2DFadeManager originally hardcoded
 * FADE_DURATION_MS = 300 for the glyph fade; the prop morph reuses the same
 * mechanism at ~400ms via `new Canvas2DFadeManager(400)`. The default (no
 * argument) must stay 300 so the existing glyph consumer is byte-identical.
 */
describe("Canvas2DFadeManager duration parameterization", () => {
  it("defaults to 300ms when constructed with no argument (glyph behavior unchanged)", () => {
    const m = new Canvas2DFadeManager();
    m.startFadeTransition();
    m.updateFadeProgress(0); // lazy-stamp start = 0
    const mid = m.updateFadeProgress(150); // halfway through 300ms
    expect(mid.currentAlpha).toBeCloseTo(0.5, 2);
    expect(mid.isComplete).toBe(false);

    const done = m.updateFadeProgress(300);
    expect(done.currentAlpha).toBe(1);
    expect(done.isComplete).toBe(true);
  });

  it("honors a custom duration (400ms, the prop morph fade)", () => {
    const m = new Canvas2DFadeManager(400);
    m.startFadeTransition();
    m.updateFadeProgress(0);

    // At 300ms (the old hardcoded duration) a 400ms fade must NOT be done yet.
    const at300 = m.updateFadeProgress(300);
    expect(at300.isComplete).toBe(false);
    expect(at300.currentAlpha).toBeCloseTo(0.75, 2);

    const done = m.updateFadeProgress(400);
    expect(done.currentAlpha).toBe(1);
    expect(done.previousAlpha).toBe(0);
    expect(done.isComplete).toBe(true);
  });

  it("two independently-constructed instances run on independent clocks/durations", () => {
    // Mirrors bluePropMorphFadeManager / redPropMorphFadeManager: one color
    // morphing must not affect the other's timer.
    const blue = new Canvas2DFadeManager(400);
    const red = new Canvas2DFadeManager(400);

    blue.startFadeTransition();
    blue.updateFadeProgress(1000); // blue starts fading at virtual t=1000

    // Red never started — must report the steady "not fading" state regardless
    // of what time blue is being driven at.
    const redState = red.updateFadeProgress(1000);
    expect(redState.isComplete).toBe(true);
    expect(redState.currentAlpha).toBe(1);

    const blueMid = blue.updateFadeProgress(1200); // 200ms into blue's fade
    expect(blueMid.isComplete).toBe(false);
    expect(blueMid.currentAlpha).toBeCloseTo(0.5, 2);
  });
});

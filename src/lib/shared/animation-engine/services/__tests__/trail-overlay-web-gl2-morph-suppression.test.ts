import { describe, it, expect } from "vitest";
import { TrailOverlayWebGL2 } from "../trail-overlay-web-gl2";
import type { TrailOverlayRenderParams } from "../ITrailOverlayCanvas";
import { DEFAULT_TRAIL_SETTINGS, TrackingMode } from "../../domain/types/trail-types";
import type { RenderBackend, BackendStats } from "$lib/shared/render-graph/domain/backend";
import type { PropState } from "$lib/shared/foundation/domain/types/prop-state";

/**
 * Regression guard for the 2026-07-19 round-2 hero-act feedback: "as it
 * morphs the trail effect jumps over from one end to the other creating a
 * straight line." Root cause: getTipPoints/getTrailPointConfig return
 * different tip geometry per prop type (e.g. staff has two tips at
 * dx=±135, club has one at dx=130), so a capture during the prop-type
 * hot-swap or its morph crossfade stamps a straight line connecting the
 * old prop's tip to the new prop's differently-located tip.
 *
 * TrailOverlayWebGL2.renderFrame is the ACTIVE trail path in normal
 * operation (canvas-lifecycle-manager always registers the "trails" effect
 * renderer, so skipTrailRendering is always true and the legacy Canvas2D
 * draw + TrailCapturer never run) — this is what these tests target.
 *
 * initialize() needs a real WebGL2 context (createBackend), unavailable in
 * jsdom, so these tests bypass it: poke the private canvas/backend fields
 * with a stub RenderBackend and zero the warmup counter. renderFrame()
 * only branches on canvas/backend truthiness and calls backend methods
 * that don't need to do anything for these assertions (which inspect the
 * overlay's own ring/tail state, not backend output).
 */

function makeStubBackend(): RenderBackend {
  return {
    kind: "webgl2",
    initialize: async () => {},
    executeFrame: () => {},
    resize: () => {},
    clearScreen: () => {},
    dispose: () => {},
    getStats: (): BackendStats => ({ lastFrameMs: 0, longestPassMs: 0, fboCount: 0 }),
  };
}

function makeOverlay(): TrailOverlayWebGL2 {
  const overlay = new TrailOverlayWebGL2();
  const overlayInternals = overlay as unknown as {
    canvas: HTMLCanvasElement | null;
    backend: RenderBackend | null;
    width: number;
    height: number;
    warmupFramesRemaining: number;
  };
  overlayInternals.canvas = document.createElement("canvas");
  overlayInternals.backend = makeStubBackend();
  overlayInternals.width = 500;
  overlayInternals.height = 500;
  overlayInternals.warmupFramesRemaining = 0;
  return overlay;
}

/** A staff-type PropState at a given center-path angle (radians). Constant
 *  staffRotationAngle=0 keeps the per-tip offset math trivial (cosA=1, sinA=0). */
function propAt(centerPathAngle: number): PropState {
  return { centerPathAngle, staffRotationAngle: 0 };
}

function baseParams(
  overrides: Partial<TrailOverlayRenderParams>
): TrailOverlayRenderParams {
  return {
    blueTrailPoints: [],
    redTrailPoints: [],
    trailSettings: { ...DEFAULT_TRAIL_SETTINGS, trackingMode: TrackingMode.BOTH_ENDS },
    deltaTime: 1 / 60,
    currentTime: 0,
    canvasSize: 500,
    hasBlue: true,
    hasRed: false,
    bluePropType: "staff",
    ...overrides,
  };
}

/** Reach into the private ring/tail fields the same way the production
 *  suppression logic does — there is no public accessor, and adding one
 *  purely for this test would be a bigger surface change than the fix itself. */
function blueLeftRingOf(overlay: TrailOverlayWebGL2): unknown[] {
  return (overlay as unknown as { blueLeftRing: unknown[] }).blueLeftRing;
}
function blueLeftTailOf(overlay: TrailOverlayWebGL2): { prog: number; visibleCount: number; speedPxPerMs: number } {
  return (overlay as unknown as { blueLeftTail: { prog: number; visibleCount: number; speedPxPerMs: number } }).blueLeftTail;
}

describe("TrailOverlayWebGL2 prop-morph suppression", () => {
  it("captures normally when never suppressed (baseline, zero behavior change)", () => {
    const overlay = makeOverlay();
    overlay.renderFrame(baseParams({ blueProp: propAt(0), currentTime: 0 }));
    overlay.renderFrame(baseParams({ blueProp: propAt(0.05), currentTime: 16 }));
    expect(blueLeftRingOf(overlay).length).toBe(2);
  });

  it("freezes the ring (no new capture) while blueMorphSuppressed is true", () => {
    const overlay = makeOverlay();
    overlay.renderFrame(baseParams({ blueProp: propAt(0), currentTime: 0 }));
    overlay.renderFrame(baseParams({ blueProp: propAt(0.05), currentTime: 16 }));
    const ringSizeBeforeSuppression = blueLeftRingOf(overlay).length;
    expect(ringSizeBeforeSuppression).toBe(2);

    // Prop keeps moving (as it does mid-motion in the live hero act) but the
    // ring must not grow while suppressed — a capture here would use the
    // swap target's tip geometry while the wrong sprite is still on screen.
    overlay.renderFrame(
      baseParams({ blueProp: propAt(0.1), currentTime: 32, blueMorphSuppressed: true })
    );
    overlay.renderFrame(
      baseParams({ blueProp: propAt(0.3), currentTime: 48, blueMorphSuppressed: true })
    );
    expect(blueLeftRingOf(overlay).length).toBe(ringSizeBeforeSuppression);
  });

  it("resets the ring/tail exactly on the suppression-lift frame — no line connects pre- and post-morph points", () => {
    const overlay = makeOverlay();
    overlay.renderFrame(baseParams({ blueProp: propAt(0), currentTime: 0 }));
    overlay.renderFrame(baseParams({ blueProp: propAt(0.05), currentTime: 16 }));
    expect(blueLeftRingOf(overlay).length).toBe(2);
    // Movement gave the tail a nonzero speed memory — reset must clear it too,
    // or the post-morph tail would recede at the pre-morph prop's speed.
    expect(blueLeftTailOf(overlay).speedPxPerMs).toBeGreaterThan(0);

    overlay.renderFrame(
      baseParams({ blueProp: propAt(0.1), currentTime: 32, blueMorphSuppressed: true })
    );
    overlay.renderFrame(
      baseParams({ blueProp: propAt(0.3), currentTime: 900, blueMorphSuppressed: true })
    );

    // Lift, now on the new prop type — this is the frame the old code would
    // have stamped a straight line on (old frozen point -> new geometry point).
    overlay.renderFrame(
      baseParams({
        blueProp: propAt(0.3),
        bluePropType: "club",
        currentTime: 916,
        blueMorphSuppressed: false,
      })
    );

    // Exactly one point: the ring was cleared before this frame's capture ran,
    // so appendToRing saw an empty ring and pushed a single fresh point — not
    // three (which would mean the pre-suppression points survived to connect).
    expect(blueLeftRingOf(overlay).length).toBe(1);
    expect(blueLeftTailOf(overlay).speedPxPerMs).toBe(0);
  });

  it("keeps capturing normally once suppression stays lifted", () => {
    const overlay = makeOverlay();
    overlay.renderFrame(baseParams({ blueProp: propAt(0), currentTime: 0, blueMorphSuppressed: true }));
    overlay.renderFrame(
      baseParams({ blueProp: propAt(0.05), currentTime: 916, blueMorphSuppressed: false })
    );
    overlay.renderFrame(
      baseParams({ blueProp: propAt(0.1), currentTime: 932, blueMorphSuppressed: false })
    );
    // Suppressed frame captured nothing; the two lifted frames captured
    // normally (first point on the reset ring, second point extends it).
    expect(blueLeftRingOf(overlay).length).toBe(2);
  });

  it("red-hand suppression is independent of blue (per-color, matches the round-1 morph fade)", () => {
    const overlay = makeOverlay();
    const params = (overrides: Partial<TrailOverlayRenderParams>) =>
      baseParams({ hasRed: true, redPropType: "staff", ...overrides });

    overlay.renderFrame(
      params({ blueProp: propAt(0), redProp: propAt(0), currentTime: 0 })
    );
    overlay.renderFrame(
      params({
        blueProp: propAt(0.05), // blue morphing
        redProp: propAt(0.05), // red not morphing
        currentTime: 16,
        blueMorphSuppressed: true,
        redMorphSuppressed: false,
      })
    );
    overlay.renderFrame(
      params({
        blueProp: propAt(0.1),
        redProp: propAt(0.1),
        currentTime: 32,
        blueMorphSuppressed: true,
        redMorphSuppressed: false,
      })
    );

    const blueRing = blueLeftRingOf(overlay);
    const redRing = (overlay as unknown as { redLeftRing: unknown[] }).redLeftRing;
    // Blue: 1 point from the unsuppressed first frame, frozen after that.
    expect(blueRing.length).toBe(1);
    // Red: never suppressed, captures every frame.
    expect(redRing.length).toBe(3);
  });
});

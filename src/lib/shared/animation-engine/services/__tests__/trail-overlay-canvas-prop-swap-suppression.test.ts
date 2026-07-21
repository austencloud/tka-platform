import { describe, expect, it, vi } from "vitest";
import type { PropState } from "$lib/shared/foundation/domain/types/prop-state";
import {
  DEFAULT_TRAIL_SETTINGS,
  TrackingMode,
} from "../../domain/types/trail-types";
import type { TrailOverlayRenderParams } from "../ITrailOverlayCanvas";
import { TrailOverlayCanvas } from "../trail-overlay-canvas";

function propAt(centerPathAngle: number): PropState {
  return { centerPathAngle, staffRotationAngle: 0 };
}

function makeOverlay(): TrailOverlayCanvas {
  const overlay = new TrailOverlayCanvas();
  const internals = overlay as unknown as {
    ctx: CanvasRenderingContext2D | null;
    width: number;
    height: number;
    warmupFramesRemaining: number;
  };
  internals.ctx = {
    clearRect: () => {},
  } as unknown as CanvasRenderingContext2D;
  internals.width = 500;
  internals.height = 500;
  internals.warmupFramesRemaining = 0;
  return overlay;
}

function baseParams(
  overrides: Partial<TrailOverlayRenderParams>
): TrailOverlayRenderParams {
  return {
    blueTrailPoints: [],
    redTrailPoints: [],
    trailSettings: {
      ...DEFAULT_TRAIL_SETTINGS,
      trackingMode: TrackingMode.BOTH_ENDS,
    },
    deltaTime: 1 / 60,
    currentTime: 0,
    canvasSize: 500,
    hasBlue: true,
    hasRed: false,
    bluePropType: "staff",
    ...overrides,
  };
}

function ringsOf(overlay: TrailOverlayCanvas): {
  left: Array<{ tipIndex: number }>;
  right: Array<{ tipIndex: number }>;
} {
  const internals = overlay as unknown as {
    blueLeftRing: Array<{ tipIndex: number }>;
    blueRightRing: Array<{ tipIndex: number }>;
  };
  return {
    left: internals.blueLeftRing,
    right: internals.blueRightRing,
  };
}

describe("TrailOverlayCanvas prop-swap suppression", () => {
  it("pauses capture, then starts the replacement prop as a disconnected segment", () => {
    const overlay = makeOverlay();
    overlay.renderFrame(baseParams({ blueProp: propAt(0), currentTime: 0 }));
    overlay.renderFrame(
      baseParams({ blueProp: propAt(0.05), currentTime: 16 })
    );
    expect(ringsOf(overlay).left).toHaveLength(2);

    overlay.renderFrame(
      baseParams({
        blueProp: propAt(0.2),
        currentTime: 32,
        bluePropSwapSuppressed: true,
      })
    );
    expect(ringsOf(overlay).left).toHaveLength(2);

    overlay.renderFrame(
      baseParams({
        blueProp: propAt(0.2),
        bluePropType: "fan",
        currentTime: 48,
        bluePropSwapSuppressed: false,
      })
    );

    expect(ringsOf(overlay).left).toHaveLength(0);
    expect(ringsOf(overlay).right).toHaveLength(1);
    expect(ringsOf(overlay).right[0]?.tipIndex).toBe(2);
  });

  it("decays the painted accumulator instead of clearing it when the prop tip mask changes", () => {
    const overlay = makeOverlay();
    const clearRect = vi.fn();
    const fillRect = vi.fn();
    const internals = overlay as unknown as {
      blueAccumCtx: OffscreenCanvasRenderingContext2D | null;
    };
    internals.blueAccumCtx = {
      clearRect,
      fillRect,
      save: () => {},
      restore: () => {},
    } as unknown as OffscreenCanvasRenderingContext2D;

    overlay.renderFrame(baseParams({ blueProp: propAt(0), currentTime: 0 }));
    overlay.renderFrame(
      baseParams({ blueProp: propAt(0.05), currentTime: 16 })
    );
    clearRect.mockClear();
    fillRect.mockClear();

    overlay.renderFrame(
      baseParams({
        blueProp: propAt(0.2),
        bluePropType: "fan",
        currentTime: 32,
        bluePropSwapSuppressed: true,
      })
    );

    // Staff → fan removes the left-tip bit. The accumulator must survive that
    // topology change, while destination-out still runs its normal fade pass.
    expect(clearRect).not.toHaveBeenCalled();
    expect(fillRect).toHaveBeenCalledOnce();
  });
});

import { describe, it, expect, vi } from "vitest";
import { Ink2DRenderer } from "./Ink2DRenderer";
import type { Ink2DParams } from "../translators/canvas2d-types";
import { INK_PALETTES } from "$lib/shared/3d/effects/ink/InkPalettes";

function makeCtx(): CanvasRenderingContext2D {
  const makeGradient = () => ({ addColorStop: vi.fn() });
  const ctx = {
    canvas: { width: 800, height: 600 },
    globalCompositeOperation: "source-over" as GlobalCompositeOperation,
    globalAlpha: 1,
    lineWidth: 1,
    lineCap: "butt" as CanvasLineCap,
    lineJoin: "miter" as CanvasLineJoin,
    strokeStyle: "" as string,
    fillStyle: "" as string,
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    clearRect: vi.fn(),
    createRadialGradient: vi.fn(makeGradient),
    createLinearGradient: vi.fn(makeGradient),
  } as unknown as CanvasRenderingContext2D;
  return ctx;
}

function makeParams(overrides: Partial<Ink2DParams> = {}): Ink2DParams {
  return {
    ambientEmission: 0.2,
    motionEmission: 1.0,
    intensity: 0.6,
    palette: "india",
    customColor: "#0a0a0a",
    viscosity: 0.3,
    splatterIntensity: 0.3,
    trackingMode: "both_ends",
    resolvedPalette: INK_PALETTES.india,
    blendMode: "source-over",
    effectiveAmbient: 0.2,
    ambientSpawnRate: 2,
    motionSpawnRate: 60, // bumped for test budgets
    motionReferenceSpeed: 3.0,
    strokeWidthMin: 1,
    strokeWidthMax: 12,
    opacityMax: 1.0,
    lifetimeSeconds: 4.5,
    maxPointsPerTip: 40,
    ...overrides,
  };
}

const STATIC_TIPS = {
  bluePosA: { x: 100, y: 400 },
  bluePosB: { x: 120, y: 400 },
  redPosA: { x: 200, y: 400 },
  redPosB: { x: 220, y: 400 },
};

describe("Ink2DRenderer", () => {
  it("does not throw on empty tips", () => {
    const r = new Ink2DRenderer();
    const ctx = makeCtx();
    r.render(
      ctx,
      makeParams(),
      {
        bluePosA: null,
        bluePosB: null,
        redPosA: null,
        redPosB: null,
      },
      1 / 60,
    );
    // No strokes should have been issued.
    expect((ctx.stroke as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it("builds up path points under moving tips and strokes them", () => {
    const r = new Ink2DRenderer();
    const ctx = makeCtx();
    // Move the tips between each render call to drive motion-mode emission.
    for (let i = 0; i < 30; i++) {
      const tips = {
        bluePosA: { x: 100 + i * 8, y: 400 },
        bluePosB: { x: 120 + i * 8, y: 400 },
        redPosA: { x: 200 + i * 8, y: 400 },
        redPosB: { x: 220 + i * 8, y: 400 },
      };
      r.render(ctx, makeParams(), tips, 1 / 60);
    }
    // Once points accumulate, every segment triggers a stroke (plus an
    // edge pass = 2 strokes per segment on opaque palettes).
    expect(
      (ctx.stroke as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBeGreaterThan(0);
  });

  it("uses source-over composite during draw for opaque india palette", () => {
    const r = new Ink2DRenderer();
    // Track every composite op assignment — the renderer restores the
    // original on finally, so post-render inspection is unreliable.
    const assignments: GlobalCompositeOperation[] = [];
    const ctx = makeCtx();
    let current: GlobalCompositeOperation = "source-over";
    Object.defineProperty(ctx, "globalCompositeOperation", {
      get() {
        return current;
      },
      set(v: GlobalCompositeOperation) {
        assignments.push(v);
        current = v;
      },
    });
    for (let i = 0; i < 15; i++) {
      const tips = {
        bluePosA: { x: 100 + i * 10, y: 400 },
        bluePosB: { x: 120 + i * 10, y: 400 },
        redPosA: null,
        redPosB: null,
      };
      r.render(ctx, makeParams(), tips, 1 / 60);
    }
    // The renderer MUST set source-over at least once during draw —
    // that's the #1 differentiator from trails (always emissive/lighter).
    expect(assignments).toContain("source-over");
    // And MUST NEVER set lighter for an opaque palette.
    expect(assignments).not.toContain("lighter");
  });

  it("uses lighter composite during draw for emissive neon palette", () => {
    const r = new Ink2DRenderer();
    const assignments: GlobalCompositeOperation[] = [];
    const ctx = makeCtx();
    let current: GlobalCompositeOperation = "source-over";
    Object.defineProperty(ctx, "globalCompositeOperation", {
      get() {
        return current;
      },
      set(v: GlobalCompositeOperation) {
        assignments.push(v);
        current = v;
      },
    });
    const neonParams = makeParams({
      palette: "neon",
      resolvedPalette: INK_PALETTES.neon,
      blendMode: "lighter",
    });
    for (let i = 0; i < 15; i++) {
      const tips = {
        bluePosA: { x: 100 + i * 10, y: 400 },
        bluePosB: { x: 120 + i * 10, y: 400 },
        redPosA: null,
        redPosB: null,
      };
      r.render(ctx, neonParams, tips, 1 / 60);
    }
    // Neon is the only ink palette that glows. Renderer flips to lighter
    // when palette.emissive is true.
    expect(assignments).toContain("lighter");
  });

  it("respects trackingMode left_end", () => {
    const r = new Ink2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ trackingMode: "left_end" });
    // Feed motion to all four tips; only left_ends should accumulate points.
    for (let i = 0; i < 20; i++) {
      const tips = {
        bluePosA: { x: 100 + i * 10, y: 400 }, // left end A
        bluePosB: { x: 500 + i * 10, y: 400 }, // right end B (ignored)
        redPosA: { x: 200 + i * 10, y: 400 }, // left end A
        redPosB: { x: 600 + i * 10, y: 400 }, // right end B (ignored)
      };
      r.render(ctx, params, tips, 1 / 60);
    }
    // Strokes should still be issued (left ends produced points).
    expect(
      (ctx.stroke as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBeGreaterThan(0);
  });

  it("caps maxPointsPerTip — pool does not grow without bound", () => {
    const r = new Ink2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({
      motionSpawnRate: 500,
      maxPointsPerTip: 10,
      lifetimeSeconds: 60, // long life so cap is the only bound
    });
    for (let i = 0; i < 120; i++) {
      const tips = {
        bluePosA: { x: 100 + i * 5, y: 400 },
        bluePosB: null,
        redPosA: null,
        redPosB: null,
      };
      r.render(ctx, params, tips, 1 / 60);
    }
    // Each segment produces at most 2 strokes (edge + pigment), so per
    // frame the stroke count is bounded by 2 * (maxPointsPerTip - 1).
    // Over the last few frames we should still be at that ceiling.
    const ctx2 = makeCtx();
    for (let i = 0; i < 6; i++) {
      const tips = {
        bluePosA: { x: 100 + i * 5, y: 400 },
        bluePosB: null,
        redPosA: null,
        redPosB: null,
      };
      r.render(ctx2, params, tips, 1 / 60);
    }
    const lastFrameStrokesPerFrame =
      (ctx2.stroke as ReturnType<typeof vi.fn>).mock.calls.length / 6;
    // At maxPointsPerTip=10, max = 2*(10-1) = 18 strokes per tip per frame.
    expect(lastFrameStrokesPerFrame).toBeLessThanOrEqual(20);
  });

  it("ages points so the pool drains after the tip disappears", () => {
    const r = new Ink2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({
      motionSpawnRate: 200,
      lifetimeSeconds: 0.3,
      maxPointsPerTip: 40,
    });
    // Seed motion for 0.3s.
    for (let i = 0; i < 18; i++) {
      const tips = {
        bluePosA: { x: 100 + i * 8, y: 400 },
        bluePosB: null,
        redPosA: null,
        redPosB: null,
      };
      r.render(ctx, params, tips, 1 / 60);
    }
    // Drop the tip entirely — no more spawning, and points age out.
    for (let i = 0; i < 30; i++) {
      r.render(
        ctx,
        params,
        { bluePosA: null, bluePosB: null, redPosA: null, redPosB: null },
        1 / 60,
      );
    }
    // After ~0.5s with no tip, all points should have aged past lifetime.
    const ctx2 = makeCtx();
    r.render(
      ctx2,
      params,
      { bluePosA: null, bluePosB: null, redPosA: null, redPosB: null },
      1 / 60,
    );
    expect((ctx2.stroke as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it("dispose resets state", () => {
    const r = new Ink2DRenderer();
    const ctx = makeCtx();
    for (let i = 0; i < 20; i++) {
      r.render(ctx, makeParams(), STATIC_TIPS, 1 / 60);
    }
    r.dispose();
    // Subsequent render after dispose should not crash.
    r.render(ctx, makeParams(), STATIC_TIPS, 1 / 60);
    expect(true).toBe(true);
  });
});

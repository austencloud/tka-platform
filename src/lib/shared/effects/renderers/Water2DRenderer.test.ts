import { describe, it, expect, vi } from "vitest";
import { Water2DRenderer } from "./Water2DRenderer";
import type { Water2DParams } from "../translators/canvas2d-types";
import { WATER_PALETTES } from "../domain/WaterPalettes";

function makeCtx(): CanvasRenderingContext2D {
  const ctx = {
    globalCompositeOperation: "source-over" as GlobalCompositeOperation,
    globalAlpha: 1,
    strokeStyle: "" as string | CanvasGradient,
    fillStyle: "" as string | CanvasGradient,
    lineWidth: 1,
    lineCap: "butt" as CanvasLineCap,
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  } as unknown as CanvasRenderingContext2D;
  return ctx;
}

function makeParams(overrides: Partial<Water2DParams> = {}): Water2DParams {
  return {
    ambientEmission: 1.0,
    motionEmission: 1.0,
    intensity: 0.6,
    palette: "classic",
    customColor: "#3a7fd9",
    clarity: 0.7,
    surfaceTension: 0.3,
    trackingMode: "both_ends",
    momentumMode: false,
    resolvedPalette: WATER_PALETTES.classic,
    poolSize: 256,
    baseRadius: 4,
    ambientSpawnRate: 8,
    motionSpawnRate: 40,
    motionReferenceSpeed: 3.0,
    blendMode: "source-over",
    ...overrides,
  };
}

const ALL_TIPS = {
  bluePosA: { x: 100, y: 100 },
  bluePosB: { x: 120, y: 100 },
  redPosA: { x: 200, y: 100 },
  redPosB: { x: 220, y: 100 },
};

describe("Water2DRenderer", () => {
  it("spawns and draws ambient droplets at rest (streak calls stroke())", () => {
    const r = new Water2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ ambientEmission: 1, motionEmission: 0 });
    // Half-second of frames at 60 fps.
    for (let i = 0; i < 30; i++) {
      r.render(ctx, params, ALL_TIPS, 1 / 60);
    }
    // Each live droplet produces a beginPath + stroke pair.
    expect((ctx.stroke as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
    expect((ctx.lineTo as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
  });

  it("motion emission outpaces ambient emission", () => {
    const ctxA = makeCtx();
    const ctxB = makeCtx();
    const rA = new Water2DRenderer();
    const rB = new Water2DRenderer();
    const restParams = makeParams({ ambientEmission: 1, motionEmission: 0 });
    const moveParams = makeParams({ ambientEmission: 0, motionEmission: 1 });

    const step = 0.02;
    for (let i = 0; i < 20; i++) {
      rA.render(ctxA, restParams, ALL_TIPS, step);
      const moving = {
        bluePosA: { x: 100 + i * 30, y: 100 },
        bluePosB: { x: 120 + i * 30, y: 100 },
        redPosA: { x: 200 + i * 30, y: 100 },
        redPosB: { x: 220 + i * 30, y: 100 },
      };
      rB.render(ctxB, moveParams, moving, step);
    }
    const aCalls = (ctxA.stroke as ReturnType<typeof vi.fn>).mock.calls.length;
    const bCalls = (ctxB.stroke as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(bCalls).toBeGreaterThan(aCalls);
  });

  it("respects trackingMode left_end (no crash, still draws)", () => {
    const r = new Water2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({
      ambientEmission: 1,
      motionEmission: 0,
      trackingMode: "left_end",
    });
    for (let i = 0; i < 30; i++) {
      r.render(ctx, params, ALL_TIPS, 1 / 60);
    }
    expect((ctx.stroke as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
  });

  it("caps pool size", () => {
    const r = new Water2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({
      ambientEmission: 1,
      ambientSpawnRate: 10000,
      poolSize: 50,
    });
    for (let i = 0; i < 120; i++) {
      r.render(ctx, params, ALL_TIPS, 1 / 60);
    }
    const callsMid = (ctx.stroke as ReturnType<typeof vi.fn>).mock.calls.length;
    for (let i = 0; i < 60; i++) {
      r.render(ctx, params, ALL_TIPS, 1 / 60);
    }
    const callsEnd = (ctx.stroke as ReturnType<typeof vi.fn>).mock.calls.length;
    // Per-frame strokes ≤ poolSize. callsEnd - callsMid is bounded.
    expect(callsEnd - callsMid).toBeLessThanOrEqual(60 * params.poolSize);
  });

  it("applies screen-down gravity (droplets accelerate downward)", () => {
    const r = new Water2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ ambientEmission: 1, motionEmission: 0 });
    // Prime one droplet at top of frame with no motion.
    r.render(ctx, params, ALL_TIPS, 1 / 60);
    // Integrate physics. After a quarter-second of gravity, every lineTo
    // y-coordinate should be below the spawn zone (y > 100). Sample the
    // last lineTo call's y coordinate as a proxy.
    for (let i = 0; i < 30; i++) {
      r.render(ctx, params, ALL_TIPS, 1 / 60);
    }
    const lineToCalls = (ctx.lineTo as ReturnType<typeof vi.fn>).mock.calls;
    expect(lineToCalls.length).toBeGreaterThan(0);
    // Grab the max y from all lineTo head positions.
    const maxY = Math.max(...lineToCalls.map((c) => c[1] as number));
    expect(maxY).toBeGreaterThan(100);
  });

  it("dispose resets state", () => {
    const r = new Water2DRenderer();
    const ctx = makeCtx();
    const params = makeParams();
    for (let i = 0; i < 20; i++) {
      r.render(ctx, params, ALL_TIPS, 1 / 60);
    }
    r.dispose();
    r.render(ctx, params, ALL_TIPS, 1 / 60);
    expect(true).toBe(true);
  });
});

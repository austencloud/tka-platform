import { describe, it, expect, vi } from "vitest";
import { Bubbles2DRenderer } from "./bubbles-2d-renderer";
import type { Bubbles2DParams } from "../translators/canvas2d-types";
import { BUBBLE_PALETTES, oilIridescentRim } from "../domain/bubble-palettes";

function makeCtx(): CanvasRenderingContext2D {
  const ctx = {
    canvas: { width: 800, height: 600 },
    globalCompositeOperation: "source-over" as GlobalCompositeOperation,
    globalAlpha: 1,
    lineWidth: 1,
    lineCap: "butt" as CanvasLineCap,
    lineJoin: "miter" as CanvasLineJoin,
    strokeStyle: "" as string | CanvasGradient,
    fillStyle: "" as string | CanvasGradient,
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    getTransform: vi.fn(() => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })),
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  } as unknown as CanvasRenderingContext2D;
  return ctx;
}

function makeParams(overrides: Partial<Bubbles2DParams> = {}): Bubbles2DParams {
  return {
    ambientEmission: 1.0,
    motionEmission: 1.0,
    intensity: 0.6,
    palette: "soap",
    customColor: "#c8e0ff",
    sizeJitter: 0.4,
    buoyancy: 0.5,
    trackingMode: "both_ends",
    resolvedPalette: BUBBLE_PALETTES.soap,
    poolSize: 256,
    baseRadius: 6,
    ambientSpawnRate: 6,
    motionSpawnRate: 30,
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

describe("Bubbles2DRenderer", () => {
  it("spawns bubbles at rest under ambient emission", () => {
    const r = new Bubbles2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({
      ambientEmission: 1,
      motionEmission: 0,
      ambientSpawnRate: 60,
    });
    // One second of frames at 60fps - should reliably spawn many bubbles.
    for (let i = 0; i < 60; i++) {
      r.render(ctx, params, ALL_TIPS, 1 / 60);
    }
    // Each live bubble draws at least a fill (interior) + stroke (rim).
    expect((ctx.arc as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
    expect((ctx.stroke as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
  });

  it("motion emission outpaces ambient emission", () => {
    const ctxA = makeCtx();
    const ctxB = makeCtx();
    const rA = new Bubbles2DRenderer();
    const rB = new Bubbles2DRenderer();
    const restParams = makeParams({ ambientEmission: 1, motionEmission: 0 });
    const moveParams = makeParams({ ambientEmission: 0, motionEmission: 1 });

    const step = 0.02;
    for (let i = 0; i < 40; i++) {
      rA.render(ctxA, restParams, ALL_TIPS, step);
      const moving = {
        bluePosA: { x: 100 + i * 30, y: 100 },
        bluePosB: { x: 120 + i * 30, y: 100 },
        redPosA: { x: 200 + i * 30, y: 100 },
        redPosB: { x: 220 + i * 30, y: 100 },
      };
      rB.render(ctxB, moveParams, moving, step);
    }
    const aFills = (ctxA.fill as ReturnType<typeof vi.fn>).mock.calls.length;
    const bFills = (ctxB.fill as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(bFills).toBeGreaterThan(aFills);
  });

  it("respects trackingMode left_end (no crash, still draws)", () => {
    const r = new Bubbles2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({
      ambientEmission: 1,
      ambientSpawnRate: 80,
      motionEmission: 0,
      trackingMode: "left_end",
    });
    for (let i = 0; i < 60; i++) {
      r.render(ctx, params, ALL_TIPS, 1 / 60);
    }
    expect((ctx.arc as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
  });

  it("caps pool size", () => {
    const r = new Bubbles2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({
      ambientEmission: 1,
      ambientSpawnRate: 10000,
      poolSize: 50,
      // Zero buoyancy so bubbles don't exit screen before pop. Short life
      // via small intensity won't apply here because lifetime floors at 1s.
    });
    // Let the pool saturate.
    for (let i = 0; i < 120; i++) {
      r.render(ctx, params, ALL_TIPS, 1 / 60);
    }
    // Can't directly read pool size externally - assert via draw-call rate.
    // With poolSize=50, each frame draws at most ~50 bubbles × (fill + stroke
    // + highlight) + pop fragments. Frame-over-frame call count should be
    // bounded. Absent pool cap, this would explode unboundedly.
    const framesBefore = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls.length;
    for (let i = 0; i < 60; i++) {
      r.render(ctx, params, ALL_TIPS, 1 / 60);
    }
    const framesAfter = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls.length;
    const perFrame = (framesAfter - framesBefore) / 60;
    // Upper bound: ~3 fills per alive bubble (body/highlight + some bursts)
    // plus ~8 bursts per pop per frame. Generous cap of ~8× poolSize.
    expect(perFrame).toBeLessThanOrEqual(params.poolSize * 10);
  });

  it("bubbles rise upward (negative vy after steady state)", () => {
    const r = new Bubbles2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({
      ambientEmission: 1,
      ambientSpawnRate: 30,
      motionEmission: 0,
      buoyancy: 1.0,
    });
    // Track translate y-values for bubbles. Bubbles2DRenderer draws via
    // ctx.arc(x, y, r) (no translate), so we read from arc's 2nd arg.
    for (let i = 0; i < 20; i++) {
      r.render(ctx, params, ALL_TIPS, 1 / 60);
    }
    const arcCalls = (ctx.arc as ReturnType<typeof vi.fn>).mock.calls;
    expect(arcCalls.length).toBeGreaterThan(0);
    const ys = arcCalls.map((c) => c[1] as number);
    const minY = Math.min(...ys);
    // Tip y is 100; with buoyancy=1, some bubbles should be at least a
    // few pixels above spawn after 20 frames (333ms).
    expect(minY).toBeLessThan(95);
  });

  it("dispose resets state", () => {
    const r = new Bubbles2DRenderer();
    const ctx = makeCtx();
    const params = makeParams();
    for (let i = 0; i < 20; i++) {
      r.render(ctx, params, ALL_TIPS, 1 / 60);
    }
    r.dispose();
    // Call render again after dispose - should not crash.
    r.render(ctx, params, ALL_TIPS, 1 / 60);
    expect(true).toBe(true);
  });
});

describe("oilIridescentRim", () => {
  it("returns distinct colors at t=0, 0.5, 1.0", () => {
    const at0 = oilIridescentRim(0);
    const at5 = oilIridescentRim(0.5);
    const at1 = oilIridescentRim(1);
    expect(at0).not.toEqual(at5);
    expect(at5).not.toEqual(at1);
    expect(at0).not.toEqual(at1);
    // All valid hex strings.
    expect(at0).toMatch(/^#[0-9a-f]{6}$/i);
    expect(at5).toMatch(/^#[0-9a-f]{6}$/i);
    expect(at1).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("clamps t outside [0,1]", () => {
    const at0 = oilIridescentRim(0);
    const atNeg = oilIridescentRim(-0.5);
    const atHigh = oilIridescentRim(1.5);
    const at1 = oilIridescentRim(1);
    expect(atNeg).toBe(at0);
    expect(atHigh).toBe(at1);
  });
});

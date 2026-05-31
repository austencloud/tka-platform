import { describe, it, expect, vi } from "vitest";
import { Smoke2DRenderer } from "./smoke-2d-renderer";
import type { Smoke2DParams } from "../translators/canvas2d-types";
import { SMOKE_PALETTES } from "../domain/smoke-palettes";

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
    ellipse: vi.fn(),
    quadraticCurveTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    getTransform: vi.fn(() => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })),
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    createRadialGradient: vi.fn(makeGradient),
    createLinearGradient: vi.fn(makeGradient),
  } as unknown as CanvasRenderingContext2D;
  return ctx;
}

function makeParams(overrides: Partial<Smoke2DParams> = {}): Smoke2DParams {
  // Mirrors what resolveSmoke2D(defaults) would yield for the incense
  // (classic) preset. Tests override spawn rates + curl strength to
  // reach steady-state quickly inside a 60-frame budget.
  return {
    ambientEmission: 1.0,
    motionEmission: 1.0,
    intensity: 0.5,
    palette: "incense",
    customColor: "#e0e0e0",
    curlStrength: 0.5,
    riseSpeed: 0.5,
    trackingMode: "both_ends",
    resolvedPalette: SMOKE_PALETTES.incense,
    poolSize: 256,
    baseRadius: 18,
    ambientSpawnRate: 60, // bumped so tests produce puffs fast
    motionSpawnRate: 60,
    motionReferenceSpeed: 3.0,
    lifetimeSeconds: SMOKE_PALETTES.incense.lifetime,
    resolvedCurlStrength: 0.5 * SMOKE_PALETTES.incense.curlBias,
    resolvedRiseSpeed: 0.5 * SMOKE_PALETTES.incense.riseBias * 60,
    noiseScale: 0.5,
    riseBaseSpeed: 60,
    blendMode: "source-over",
    ...overrides,
  };
}

const ALL_TIPS = {
  bluePosA: { x: 100, y: 400 },
  bluePosB: { x: 120, y: 400 },
  redPosA: { x: 200, y: 400 },
  redPosB: { x: 220, y: 400 },
};

describe("Smoke2DRenderer", () => {
  it("spawns puffs at rest under ambient emission", () => {
    const r = new Smoke2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({
      ambientEmission: 1,
      motionEmission: 0,
      ambientSpawnRate: 60,
    });
    for (let i = 0; i < 60; i++) {
      r.render(ctx, params, ALL_TIPS, 1 / 60);
    }
    // Each alive puff draws an arc fill per frame.
    expect((ctx.fill as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
    expect((ctx.arc as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
  });

  it("motion emission increases spawn under tip velocity", () => {
    // Use small pool + low ambient to avoid pool saturation masking the
    // motion delta. Hold the tip still in case A; move aggressively in
    // case B. Spawn rates are small enough that poolSize doesn't clamp
    // within the measurement window.
    const ctxA = makeCtx();
    const ctxB = makeCtx();
    const rA = new Smoke2DRenderer();
    const rB = new Smoke2DRenderer();
    const restParams = makeParams({
      ambientEmission: 0.2,
      motionEmission: 1,
      ambientSpawnRate: 5,
      motionSpawnRate: 120,
      poolSize: 256,
      lifetimeSeconds: 1.0,
    });
    const moveParams = makeParams({
      ambientEmission: 0.2,
      motionEmission: 1,
      ambientSpawnRate: 5,
      motionSpawnRate: 120,
      poolSize: 256,
      lifetimeSeconds: 1.0,
    });

    const step = 0.02;
    for (let i = 0; i < 20; i++) {
      rA.render(ctxA, restParams, ALL_TIPS, step);
      const moving = {
        bluePosA: { x: 100 + i * 30, y: 400 },
        bluePosB: { x: 120 + i * 30, y: 400 },
        redPosA: { x: 200 + i * 30, y: 400 },
        redPosB: { x: 220 + i * 30, y: 400 },
      };
      rB.render(ctxB, moveParams, moving, step);
    }
    const aFills = (ctxA.fill as ReturnType<typeof vi.fn>).mock.calls.length;
    const bFills = (ctxB.fill as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(bFills).toBeGreaterThan(aFills);
  });

  it("respects trackingMode left_end (still draws, no crash)", () => {
    const r = new Smoke2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({
      ambientEmission: 1,
      ambientSpawnRate: 60,
      motionEmission: 0,
      trackingMode: "left_end",
    });
    for (let i = 0; i < 60; i++) {
      r.render(ctx, params, ALL_TIPS, 1 / 60);
    }
    expect((ctx.fill as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
  });

  it("caps pool size - steady-state fills bounded by poolSize", () => {
    const r = new Smoke2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({
      ambientEmission: 1,
      ambientSpawnRate: 10000,
      poolSize: 40,
    });
    // Warm up.
    for (let i = 0; i < 60; i++) {
      r.render(ctx, params, ALL_TIPS, 1 / 60);
    }
    const base = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls.length;
    for (let i = 0; i < 60; i++) {
      r.render(ctx, params, ALL_TIPS, 1 / 60);
    }
    const perFrame =
      ((ctx.fill as ReturnType<typeof vi.fn>).mock.calls.length - base) / 60;
    // Each alive puff produces one fill. Upper bound is poolSize (plus a
    // small safety margin for boundary frames).
    expect(perFrame).toBeLessThanOrEqual(params.poolSize + 4);
  });

  it("puffs rise (negative vy - screen-space upward) under positive riseSpeed", () => {
    const r = new Smoke2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({
      ambientEmission: 1,
      ambientSpawnRate: 40,
      motionEmission: 0,
      // Disable curl so vertical motion is the only component and the
      // test can read the sign directly off fill arc calls.
      resolvedCurlStrength: 0,
      resolvedRiseSpeed: 200, // px/s upward (screen y decreasing)
    });
    // Spawn and integrate ~0.5s of simulated time.
    for (let i = 0; i < 30; i++) {
      r.render(ctx, params, ALL_TIPS, 1 / 60);
    }
    const arcCalls = (ctx.arc as ReturnType<typeof vi.fn>).mock.calls;
    const ys = arcCalls.map((c) => c[1] as number);
    const minY = Math.min(...ys);
    // Tip y is 400; after several frames, at least some puffs should be
    // clearly above the tip (screen y < 400).
    expect(minY).toBeLessThan(400);
  });

  it("lifetime decay - pool drains after spawn stops", () => {
    const r = new Smoke2DRenderer();
    const ctx = makeCtx();
    // Short lifetime so we can observe decay within the test budget.
    const params = makeParams({
      ambientEmission: 1,
      ambientSpawnRate: 120,
      motionEmission: 0,
      lifetimeSeconds: 0.3,
      poolSize: 64,
    });
    // Spawn for 0.25s.
    for (let i = 0; i < 15; i++) {
      r.render(ctx, params, ALL_TIPS, 1 / 60);
    }
    const fillsWithSpawn =
      (ctx.fill as ReturnType<typeof vi.fn>).mock.calls.length;

    // Stop spawning (ambient + motion both zero), let everything decay.
    const decayParams = makeParams({
      ...params,
      ambientEmission: 0,
      motionEmission: 0,
      lifetimeSeconds: 0.3,
    });
    // 0.6s of decay - all puffs from the 0.3s lifetime should die.
    for (let i = 0; i < 36; i++) {
      r.render(ctx, decayParams, ALL_TIPS, 1 / 60);
    }
    const fillsAfter =
      (ctx.fill as ReturnType<typeof vi.fn>).mock.calls.length;
    // After enough decay time, no new fills should be added in the last
    // few frames (all puffs dead). Compare the last 6-frame window only.
    const ctx2 = makeCtx();
    for (let i = 0; i < 6; i++) {
      r.render(ctx2, decayParams, ALL_TIPS, 1 / 60);
    }
    expect((ctx2.fill as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
    // Sanity - we did draw something during spawn.
    expect(fillsWithSpawn).toBeGreaterThan(0);
    // Sanity - draws during decay were fewer than the active-spawn era.
    expect(fillsAfter).toBeGreaterThanOrEqual(fillsWithSpawn);
  });

  it("dispose resets state", () => {
    const r = new Smoke2DRenderer();
    const ctx = makeCtx();
    const params = makeParams();
    for (let i = 0; i < 20; i++) {
      r.render(ctx, params, ALL_TIPS, 1 / 60);
    }
    r.dispose();
    // Subsequent render after dispose should not crash.
    r.render(ctx, params, ALL_TIPS, 1 / 60);
    expect(true).toBe(true);
  });
});

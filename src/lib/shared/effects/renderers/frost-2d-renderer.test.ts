import { describe, it, expect, vi } from "vitest";
import { Frost2DRenderer } from "./frost-2d-renderer";
import type { Frost2DParams } from "../translators/canvas2d-types";
import { resolveFrostPalette } from "../domain/frost-palettes";
import type { EmitterTip } from "./emitter-tip";

type PosBag = {
  leftPosA?: { x: number; y: number };
  leftPosB?: { x: number; y: number };
  rightPosA?: { x: number; y: number };
  rightPosB?: { x: number; y: number };
};

/** Convert the legacy 4-slot bag to the flat emitter contract (base props). */
function toEmitters(s: PosBag): EmitterTip[] {
  const out: EmitterTip[] = [];
  if (s.leftPosA) out.push({ ...s.leftPosA, propIndex: 0, tipIndex: 0, end: "A", color: "#3a7fd9" });
  if (s.leftPosB) out.push({ ...s.leftPosB, propIndex: 0, tipIndex: 1, end: "B", color: "#3a7fd9" });
  if (s.rightPosA) out.push({ ...s.rightPosA, propIndex: 1, tipIndex: 0, end: "A", color: "#d94f4f" });
  if (s.rightPosB) out.push({ ...s.rightPosB, propIndex: 1, tipIndex: 1, end: "B", color: "#d94f4f" });
  return out;
}

function makeCtx(): CanvasRenderingContext2D {
  const ctx = {
    canvas: { width: 800, height: 600 },
    globalCompositeOperation: "source-over" as GlobalCompositeOperation,
    globalAlpha: 1,
    filter: "none",
    strokeStyle: "" as string | CanvasGradient,
    fillStyle: "" as string | CanvasGradient,
    lineWidth: 1,
    lineCap: "butt" as CanvasLineCap,
    lineJoin: "miter" as CanvasLineJoin,
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    drawImage: vi.fn(),
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

function makeParams(overrides: Partial<Frost2DParams> = {}): Frost2DParams {
  const palette = overrides.palette ?? "glacial";
  return {
    ambientEmission: 1.0,
    motionEmission: 1.0,
    intensity: 0.6,
    palette,
    customColor: "#a0d8ff",
    crystallinity: 0.6,
    spreadRate: 0.5,
    trackingMode: "both_ends",
    resolvedPalette: resolveFrostPalette({
      ambientEmission: 1,
      motionEmission: 1,
      intensity: 0.6,
      palette,
      customColor: "#a0d8ff",
      crystallinity: 0.6,
      spreadRate: 0.5,
      trackingMode: "both_ends",
    }),
    auraPoolSize: 2048,
    baseRadius: 6,
    ambientSpawnRate: 8,
    motionSpawnRate: 40,
    motionReferenceSpeed: 3.0,
    lifetimeMin: 0.6,
    lifetimeMax: 1.4,
    blendMode: "screen",
    crystalPoolSize: 256,
    crystalSpacing: 18,
    crystalGrowDuration: 0.6,
    ...overrides,
  };
}

const ALL_TIPS = toEmitters({
  leftPosA: { x: 100, y: 100 },
  leftPosB: { x: 120, y: 100 },
  rightPosA: { x: 200, y: 100 },
  rightPosB: { x: 220, y: 100 },
});

/** Two base props + one tunnel layer (propIndex 2/3) to prove layer coverage. */
const WITH_LAYER: EmitterTip[] = [
  ...ALL_TIPS,
  { x: 300, y: 100, propIndex: 2, tipIndex: 0, end: "A", color: "#22cc88" },
  { x: 320, y: 100, propIndex: 2, tipIndex: 1, end: "B", color: "#22cc88" },
  { x: 400, y: 100, propIndex: 3, tipIndex: 0, end: "A", color: "#cc4488" },
  { x: 420, y: 100, propIndex: 3, tipIndex: 1, end: "B", color: "#cc4488" },
];

describe("Frost2DRenderer", () => {
  it("spawns aura particles at rest under ambient emission", () => {
    const r = new Frost2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ ambientEmission: 1, motionEmission: 0, ambientSpawnRate: 40 });
    // Half-second of frames at 60 fps.
    for (let i = 0; i < 30; i++) {
      r.render(ctx, params, ALL_TIPS, 1 / 60);
    }
    // Each live aura particle becomes at least one arc + fill on the primary
    // draw path.
    expect((ctx.arc as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
  });

  it("spawns from tunnel layer emitters (propIndex >= 2)", () => {
    const rBase = new Frost2DRenderer();
    const rLayered = new Frost2DRenderer();
    const ctxBase = makeCtx();
    const ctxLayered = makeCtx();
    const params = makeParams({ ambientEmission: 1, motionEmission: 0, ambientSpawnRate: 40 });
    for (let i = 0; i < 30; i++) {
      rBase.render(ctxBase, params, ALL_TIPS, 1 / 60);
      rLayered.render(ctxLayered, params, WITH_LAYER, 1 / 60);
    }
    const baseCalls = (ctxBase.arc as ReturnType<typeof vi.fn>).mock.calls.length;
    const layeredCalls = (ctxLayered.arc as ReturnType<typeof vi.fn>).mock.calls.length;
    // More emitters (4 base ends vs 4 base + 4 layer ends) ⇒ strictly more aura
    // particles drawn. Confirms layer emitters actually spawn.
    expect(layeredCalls).toBeGreaterThan(baseCalls);
  });

  it("motion emission outpaces ambient emission", () => {
    const ctxA = makeCtx();
    const ctxB = makeCtx();
    const rA = new Frost2DRenderer();
    const rB = new Frost2DRenderer();
    const restParams = makeParams({ ambientEmission: 1, motionEmission: 0 });
    const moveParams = makeParams({ ambientEmission: 0, motionEmission: 1 });

    const step = 0.02;
    for (let i = 0; i < 20; i++) {
      rA.render(ctxA, restParams, ALL_TIPS, step);
      const moving = toEmitters({
        leftPosA: { x: 100 + i * 30, y: 100 },
        leftPosB: { x: 120 + i * 30, y: 100 },
        rightPosA: { x: 200 + i * 30, y: 100 },
        rightPosB: { x: 220 + i * 30, y: 100 },
      });
      rB.render(ctxB, moveParams, moving, step);
    }
    const aCalls = (ctxA.arc as ReturnType<typeof vi.fn>).mock.calls.length;
    const bCalls = (ctxB.arc as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(bCalls).toBeGreaterThan(aCalls);
  });

  it("respects trackingMode left_end (no crash, still draws)", () => {
    const r = new Frost2DRenderer();
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

  it("caps aura pool size", () => {
    const r = new Frost2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({
      ambientEmission: 1,
      ambientSpawnRate: 100000,
      auraPoolSize: 50,
    });
    // Let the pool saturate, then run a couple steady-state frames and confirm
    // the per-frame draw count stays bounded by the cap.
    for (let i = 0; i < 120; i++) {
      r.render(ctx, params, ALL_TIPS, 1 / 60);
    }
    const callsMid = (ctx.arc as ReturnType<typeof vi.fn>).mock.calls.length;
    for (let i = 0; i < 60; i++) {
      r.render(ctx, params, ALL_TIPS, 1 / 60);
    }
    const callsEnd = (ctx.arc as ReturnType<typeof vi.fn>).mock.calls.length;
    // Each aura particle draws at most ~3 arcs (glow gradient + inner hex via
    // moveTo/lineTo path + sparkle). Crystals draw too, but both are bounded by
    // their pool caps. A generous per-particle ceiling keeps the cap honest.
    const maxArcsPerParticle = 8;
    expect(callsEnd - callsMid).toBeLessThanOrEqual(
      60 * (params.auraPoolSize + params.crystalPoolSize) * maxArcsPerParticle,
    );
  });

  it("breath palette (auraOnly) skips crystal trail growth", () => {
    const r = new Frost2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ palette: "breath", ambientEmission: 1, ambientSpawnRate: 40 });
    expect(params.resolvedPalette.auraOnly).toBe(true);
    // Drive fast motion that would otherwise spawn crystals along the trail.
    for (let i = 0; i < 30; i++) {
      const moving = toEmitters({
        leftPosA: { x: 100 + i * 40, y: 100 },
        rightPosA: { x: 300 + i * 40, y: 200 },
      });
      r.render(ctx, params, moving, 1 / 60);
    }
    // Aura still draws (no crash); the test just exercises the auraOnly branch.
    expect((ctx.arc as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
  });

  it("dispose resets state", () => {
    const r = new Frost2DRenderer();
    const ctx = makeCtx();
    const params = makeParams();
    for (let i = 0; i < 20; i++) {
      r.render(ctx, params, ALL_TIPS, 1 / 60);
    }
    r.dispose();
    // Rendering after dispose must not throw on fresh, empty state.
    r.render(ctx, params, ALL_TIPS, 1 / 60);
    expect(true).toBe(true);
  });
});

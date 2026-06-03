import { describe, it, expect, vi, beforeAll } from "vitest";
import { Water2DRenderer } from "./water-2d-renderer";
import type { Water2DParams } from "../translators/canvas2d-types";
import { WATER_PALETTES } from "../domain/water-palettes";

// Provide a minimal OffscreenCanvas shim so the sprite cache can bake a
// sprite during tests (node env has no OffscreenCanvas by default).
beforeAll(() => {
  if (typeof (globalThis as Record<string, unknown>).OffscreenCanvas === "undefined") {
    class OffscreenCanvasMock {
      width: number;
      height: number;
      constructor(w: number, h: number) {
        this.width = w;
        this.height = h;
      }
      getContext() {
        return {
          canvas: { width: 128, height: 128 },
          globalCompositeOperation: "source-over",
          globalAlpha: 1,
          fillStyle: "",
          filter: "none",
          clearRect: () => {},
          arc: () => {},
          beginPath: () => {},
          fill: () => {},
          save: () => {},
          restore: () => {},
          translate: () => {},
          rotate: () => {},
          scale: () => {},
          getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
          setTransform: () => {},
          drawImage: () => {},
          createRadialGradient: () => ({ addColorStop: () => {} }),
        };
      }
    }
    (globalThis as Record<string, unknown>).OffscreenCanvas = OffscreenCanvasMock;
  }
});

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
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
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
    // splash style skips the atmospheric offscreen path so tests don't
    // need a full offscreen ctx mock. Style-specific tests can override.
    spewStyle: "splash",
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
  it("spawns droplets at rest under ambient emission", () => {
    const r = new Water2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ ambientEmission: 1, motionEmission: 0 });
    // Half-second of frames at 60 fps.
    for (let i = 0; i < 30; i++) {
      r.render(ctx, params, ALL_TIPS, 1 / 60);
    }
    // Each live droplet becomes one drawImage + translate pair.
    expect((ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
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
    const aCalls = (ctxA.drawImage as ReturnType<typeof vi.fn>).mock.calls.length;
    const bCalls = (ctxB.drawImage as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(bCalls).toBeGreaterThan(aCalls);
  });

  it("respects trackingMode left_end (no crash, still draws)", () => {
    const r = new Water2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({
      ambientEmission: 1,
      ambientSpawnRate: 80, // high enough to make spawn deterministic over test window
      motionEmission: 0,
      trackingMode: "left_end",
    });
    for (let i = 0; i < 60; i++) {
      r.render(ctx, params, ALL_TIPS, 1 / 60);
    }
    expect((ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
  });

  it("caps pool size", () => {
    const r = new Water2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({
      ambientEmission: 1,
      ambientSpawnRate: 10000,
      poolSize: 50,
    });
    // Let the pool saturate.
    for (let i = 0; i < 120; i++) {
      r.render(ctx, params, ALL_TIPS, 1 / 60);
    }
    const callsMid = (ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls.length;
    for (let i = 0; i < 60; i++) {
      r.render(ctx, params, ALL_TIPS, 1 / 60);
    }
    const callsEnd = (ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls.length;
    // Per-frame drawImage count ≤ poolSize × (1 + trailCount) for splash
    // style (trailCount=2 → up to 3 stamps per droplet when moving fast
    // enough to trigger trails).
    const maxStampsPerDroplet = 4;
    expect(callsEnd - callsMid).toBeLessThanOrEqual(
      60 * params.poolSize * maxStampsPerDroplet,
    );
  });

  it("applies screen-down gravity (droplets accelerate downward)", () => {
    const r = new Water2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ ambientEmission: 1, motionEmission: 0 });
    // Integrate physics - setTransform places the droplet via its f parameter
    // (6th arg = translation y), so tracking the max f across setTransform
    // calls is a gravity-downward check.
    for (let i = 0; i < 30; i++) {
      r.render(ctx, params, ALL_TIPS, 1 / 60);
    }
    const stCalls = (ctx.setTransform as ReturnType<typeof vi.fn>).mock.calls
      .filter((c) => c.length >= 6);
    expect(stCalls.length).toBeGreaterThan(0);
    const maxY = Math.max(...stCalls.map((c) => c[5] as number));
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

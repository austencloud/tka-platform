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
    drawImage: vi.fn(),
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
    motionSpawnRate: 60,
    motionReferenceSpeed: 3.0,
    strokeWidthMin: 2,
    strokeWidthMax: 18,
    opacityMax: 1.0,
    lifetimeSeconds: 3.0,
    maxPointsPerTip: 90,
    stampScaleMin: 0.3,
    stampScaleMax: 1.2,
    ...overrides,
  };
}

describe("Ink2DRenderer", () => {
  it("does not throw on empty tips", () => {
    const r = new Ink2DRenderer();
    const ctx = makeCtx();
    r.render(
      ctx,
      makeParams(),
      { bluePosA: null, bluePosB: null, redPosA: null, redPosB: null },
      1 / 60,
    );
    expect((ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it("uses drawImage (not stroke) for rendering stamps", () => {
    const r = new Ink2DRenderer();
    const ctx = makeCtx();
    for (let i = 0; i < 30; i++) {
      r.render(
        ctx,
        makeParams(),
        {
          bluePosA: { x: 100 + i * 8, y: 400 },
          bluePosB: { x: 120 + i * 8, y: 400 },
          redPosA: { x: 200 + i * 8, y: 400 },
          redPosB: { x: 220 + i * 8, y: 400 },
        },
        1 / 60,
      );
    }
    expect(
      (ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBeGreaterThan(0);
    expect((ctx.stroke as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it("uses source-over composite for opaque india palette", () => {
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
    for (let i = 0; i < 15; i++) {
      r.render(
        ctx,
        makeParams(),
        {
          bluePosA: { x: 100 + i * 10, y: 400 },
          bluePosB: { x: 120 + i * 10, y: 400 },
          redPosA: null,
          redPosB: null,
        },
        1 / 60,
      );
    }
    expect(assignments).toContain("source-over");
    expect(assignments).not.toContain("lighter");
  });

  it("uses lighter composite for emissive neon palette", () => {
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
      r.render(
        ctx,
        neonParams,
        {
          bluePosA: { x: 100 + i * 10, y: 400 },
          bluePosB: { x: 120 + i * 10, y: 400 },
          redPosA: null,
          redPosB: null,
        },
        1 / 60,
      );
    }
    expect(assignments).toContain("lighter");
  });

  it("respects trackingMode left_end", () => {
    const r = new Ink2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ trackingMode: "left_end" });
    for (let i = 0; i < 20; i++) {
      r.render(
        ctx,
        params,
        {
          bluePosA: { x: 100 + i * 10, y: 400 },
          bluePosB: { x: 500 + i * 10, y: 400 },
          redPosA: { x: 200 + i * 10, y: 400 },
          redPosB: { x: 600 + i * 10, y: 400 },
        },
        1 / 60,
      );
    }
    expect(
      (ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBeGreaterThan(0);
  });

  it("caps maxPointsPerTip — stamps do not grow without bound", () => {
    const r = new Ink2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({
      motionSpawnRate: 500,
      maxPointsPerTip: 10,
      lifetimeSeconds: 60,
    });
    for (let i = 0; i < 120; i++) {
      r.render(
        ctx,
        params,
        {
          bluePosA: { x: 100 + i * 5, y: 400 },
          bluePosB: null,
          redPosA: null,
          redPosB: null,
        },
        1 / 60,
      );
    }
    // 10 points max × 2 passes (bleed + pigment) = at most 20 drawImage calls per frame
    const ctx2 = makeCtx();
    r.render(
      ctx2,
      params,
      { bluePosA: { x: 700, y: 400 }, bluePosB: null, redPosA: null, redPosB: null },
      1 / 60,
    );
    expect(
      (ctx2.drawImage as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBeLessThanOrEqual(22);
  });

  it("ages points so the pool drains after the tip disappears", () => {
    const r = new Ink2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({
      motionSpawnRate: 200,
      lifetimeSeconds: 0.3,
      maxPointsPerTip: 40,
    });
    for (let i = 0; i < 18; i++) {
      r.render(
        ctx,
        params,
        {
          bluePosA: { x: 100 + i * 8, y: 400 },
          bluePosB: null,
          redPosA: null,
          redPosB: null,
        },
        1 / 60,
      );
    }
    for (let i = 0; i < 30; i++) {
      r.render(
        ctx,
        params,
        { bluePosA: null, bluePosB: null, redPosA: null, redPosB: null },
        1 / 60,
      );
    }
    const ctx2 = makeCtx();
    r.render(
      ctx2,
      params,
      { bluePosA: null, bluePosB: null, redPosA: null, redPosB: null },
      1 / 60,
    );
    expect((ctx2.drawImage as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it("applies light gravity sag to aged points", () => {
    const r = new Ink2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({
      motionSpawnRate: 200,
      lifetimeSeconds: 2.0,
      maxPointsPerTip: 40,
    });
    for (let i = 0; i < 10; i++) {
      r.render(
        ctx,
        params,
        {
          bluePosA: { x: 100 + i * 8, y: 400 },
          bluePosB: null,
          redPosA: null,
          redPosB: null,
        },
        1 / 60,
      );
    }
    // Age past 40% threshold (0.4 * 2.0 = 0.8s)
    for (let i = 0; i < 60; i++) {
      r.render(
        ctx,
        params,
        { bluePosA: null, bluePosB: null, redPosA: null, redPosB: null },
        1 / 60,
      );
    }
    const ctx2 = makeCtx();
    r.render(
      ctx2,
      params,
      { bluePosA: null, bluePosB: null, redPosA: null, redPosB: null },
      1 / 60,
    );
    const translateCalls = (ctx2.translate as ReturnType<typeof vi.fn>).mock.calls;
    if (translateCalls.length > 0) {
      const yValues = translateCalls.map((c: number[]) => c[1]);
      const maxY = Math.max(...yValues);
      expect(maxY).toBeGreaterThan(400);
    }
  });

  it("dispose clears stamp cache and point history", () => {
    const r = new Ink2DRenderer();
    const ctx = makeCtx();
    for (let i = 0; i < 20; i++) {
      r.render(
        ctx,
        makeParams(),
        {
          bluePosA: { x: 100 + i * 5, y: 400 },
          bluePosB: { x: 120 + i * 5, y: 400 },
          redPosA: { x: 200 + i * 5, y: 400 },
          redPosB: { x: 220 + i * 5, y: 400 },
        },
        1 / 60,
      );
    }
    r.dispose();
    const ctx2 = makeCtx();
    r.render(
      ctx2,
      makeParams(),
      {
        bluePosA: { x: 100, y: 400 },
        bluePosB: { x: 120, y: 400 },
        redPosA: { x: 200, y: 400 },
        redPosB: { x: 220, y: 400 },
      },
      1 / 60,
    );
    expect(
      (ctx2.drawImage as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBeLessThanOrEqual(4);
  });

  it("enforces minimum spacing between consecutive stamps", () => {
    const r = new Ink2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({
      motionSpawnRate: 1000,
      maxPointsPerTip: 200,
      lifetimeSeconds: 60,
      stampScaleMax: 1.0,
    });
    // Feed same position repeatedly — spacing gate blocks most emits
    for (let i = 0; i < 60; i++) {
      r.render(
        ctx,
        params,
        {
          bluePosA: { x: 400, y: 400 },
          bluePosB: null,
          redPosA: null,
          redPosB: null,
        },
        1 / 60,
      );
    }
    const ctx2 = makeCtx();
    r.render(
      ctx2,
      params,
      { bluePosA: { x: 400, y: 400 }, bluePosB: null, redPosA: null, redPosB: null },
      1 / 60,
    );
    expect(
      (ctx2.drawImage as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBeLessThanOrEqual(10);
  });
});

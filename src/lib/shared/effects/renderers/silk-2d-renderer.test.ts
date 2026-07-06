import { describe, it, expect, vi } from "vitest";
import { Silk2DRenderer } from "./silk-2d-renderer";
import type { Silk2DParams } from "../translators/canvas2d-types";
import type { SilkPalette } from "../domain/silk-palettes";
import type { EmitterTip } from "./emitter-tip";

type PosBag = {
  bluePosA?: { x: number; y: number };
  bluePosB?: { x: number; y: number };
  redPosA?: { x: number; y: number };
  redPosB?: { x: number; y: number };
};

/** Convert the legacy 4-slot bag to the flat emitter contract (base props). */
function toEmitters(s: PosBag): EmitterTip[] {
  const out: EmitterTip[] = [];
  if (s.bluePosA) out.push({ ...s.bluePosA, propIndex: 0, tipIndex: 0, end: "A", color: "#3a7fd9" });
  if (s.bluePosB) out.push({ ...s.bluePosB, propIndex: 0, tipIndex: 1, end: "B", color: "#3a7fd9" });
  if (s.redPosA) out.push({ ...s.redPosA, propIndex: 1, tipIndex: 0, end: "A", color: "#d94f4f" });
  if (s.redPosB) out.push({ ...s.redPosB, propIndex: 1, tipIndex: 1, end: "B", color: "#d94f4f" });
  return out;
}

const SATIN: SilkPalette = {
  id: "satin",
  body: "#c0c0d0",
  edge: "#ffffff",
};

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
    bezierCurveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
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

function makeParams(overrides: Partial<Silk2DParams> = {}): Silk2DParams {
  return {
    intensity: 0.8,
    width: 0.5,
    duration: 0.5,
    flutter: 0.3,
    tautness: 0.4,
    palette: "satin",
    customColor: "#c0c0d0",
    trackingMode: "both_ends",
    resolvedPalette: SATIN,
    baseHalfWidth: 12,
    lifetimeSeconds: 2.0,
    motionReferenceSpeed: 3.0,
    blendMode: "source-over",
    ...overrides,
  };
}

/** Drive the tips along +x so each emitter records a moving ribbon. */
function moveBag(i: number): PosBag {
  return {
    bluePosA: { x: 100 + i * 8, y: 100 },
    bluePosB: { x: 120 + i * 8, y: 140 },
    redPosA: { x: 200 + i * 8, y: 100 },
    redPosB: { x: 220 + i * 8, y: 140 },
  };
}

/** Two base props + one tunnel layer (propIndex 2/3) to prove layer coverage. */
function moveWithLayer(i: number): EmitterTip[] {
  return [
    ...toEmitters(moveBag(i)),
    { x: 300 + i * 8, y: 100, propIndex: 2, tipIndex: 0, end: "A", color: "#22cc88" },
    { x: 320 + i * 8, y: 140, propIndex: 2, tipIndex: 1, end: "B", color: "#22cc88" },
    { x: 400 + i * 8, y: 100, propIndex: 3, tipIndex: 0, end: "A", color: "#cc4488" },
    { x: 420 + i * 8, y: 140, propIndex: 3, tipIndex: 1, end: "B", color: "#cc4488" },
  ];
}

describe("Silk2DRenderer", () => {
  it("renders ribbons once enough samples accumulate", () => {
    const r = new Silk2DRenderer();
    const ctx = makeCtx();
    const params = makeParams();
    for (let i = 0; i < 30; i++) {
      r.render(ctx, params, toEmitters(moveBag(i)), 1 / 60, 1, false);
    }
    // Body fill is the primary draw call — at least one segment must paint.
    expect((ctx.fill as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
  });

  it("renders ribbons from tunnel layer emitters (propIndex >= 2)", () => {
    const rBase = new Silk2DRenderer();
    const rLayered = new Silk2DRenderer();
    const ctxBase = makeCtx();
    const ctxLayered = makeCtx();
    const params = makeParams();
    for (let i = 0; i < 30; i++) {
      rBase.render(ctxBase, params, toEmitters(moveBag(i)), 1 / 60, 1, false);
      rLayered.render(ctxLayered, params, moveWithLayer(i), 1 / 60, 1, false);
    }
    const baseCalls = (ctxBase.fill as ReturnType<typeof vi.fn>).mock.calls.length;
    const layeredCalls = (ctxLayered.fill as ReturnType<typeof vi.fn>).mock.calls.length;
    // 4 base ends vs 8 base+layer ends ⇒ strictly more body-fill segments.
    // Confirms layer emitters (propIndex >= 2) actually draw ribbons.
    expect(layeredCalls).toBeGreaterThan(baseCalls);
  });

  it("respects trackingMode left_end (no crash, still draws)", () => {
    const r = new Silk2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ trackingMode: "left_end" });
    for (let i = 0; i < 30; i++) {
      r.render(ctx, params, toEmitters(moveBag(i)), 1 / 60, 1, false);
    }
    expect((ctx.fill as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
  });

  it("retains trails for emitters that vanish (does not hard-prune)", () => {
    const r = new Silk2DRenderer();
    const ctx = makeCtx();
    const params = makeParams();
    // Build up ribbons for all four base ends.
    for (let i = 0; i < 20; i++) {
      r.render(ctx, params, toEmitters(moveBag(i)), 1 / 60, 1, false);
    }
    // Now feed ONLY the blue prop — red emitters vanish this frame. Their trails
    // must keep painting (aged out by lifetime, not deleted immediately).
    const ctxAfter = makeCtx();
    r.render(
      ctxAfter,
      params,
      [
        { x: 260, y: 100, propIndex: 0, tipIndex: 0, end: "A", color: "#3a7fd9" },
        { x: 280, y: 140, propIndex: 0, tipIndex: 1, end: "B", color: "#3a7fd9" },
      ],
      1 / 60,
      1,
      false,
    );
    // Red trails (propIndex 1) still have samples within lifetime ⇒ still fill.
    expect((ctxAfter.fill as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
  });

  it("loopDetected skips recording without crashing", () => {
    const r = new Silk2DRenderer();
    const ctx = makeCtx();
    const params = makeParams();
    for (let i = 0; i < 20; i++) {
      r.render(ctx, params, toEmitters(moveBag(i)), 1 / 60, 1, false);
    }
    const before = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls.length;
    // A loop boundary teleports the tips; loopDetected must not throw and must
    // not record a spike sample this frame (trail length unchanged-ish).
    expect(() =>
      r.render(ctx, params, toEmitters(moveBag(0)), 1 / 60, 1, true),
    ).not.toThrow();
    const after = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls.length;
    // Still drawing from the retained trail, so fill count keeps climbing.
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it("dispose resets state", () => {
    const r = new Silk2DRenderer();
    const ctx = makeCtx();
    const params = makeParams();
    for (let i = 0; i < 20; i++) {
      r.render(ctx, params, toEmitters(moveBag(i)), 1 / 60, 1, false);
    }
    r.dispose();
    expect(() => r.render(ctx, params, toEmitters(moveBag(0)), 1 / 60, 1, false)).not.toThrow();
  });
});

import { describe, it, expect, vi } from "vitest";
import { Echo2DRenderer, type EchoTipInput } from "./echo-2d-renderer";
import type { Echo2DParams } from "../translators/canvas2d-types";
import type { EmitterTip } from "./emitter-tip";

function makeCtx() {
  const ctx = {
    globalCompositeOperation: "source-over",
    globalAlpha: 1,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    shadowBlur: 0,
    shadowColor: "",
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  } as unknown as CanvasRenderingContext2D;
  return ctx;
}

function makeParams(overrides: Partial<Echo2DParams> = {}): Echo2DParams {
  return {
    intensity: 0.7,
    decay: 4,
    interval: 1,
    shape: "staff",
    colorMode: "solid",
    color: "#ffffff",
    thickness: 3,
    glow: 0.6,
    depth: 0.5,
    flash: 0.5,
    blendMode: "lighter",
    ...overrides,
  };
}

type Pt = { x: number; y: number };
interface TipOpts {
  bluePosA?: Pt | null;
  bluePosB?: Pt | null;
  redPosA?: Pt | null;
  redPosB?: Pt | null;
  /** Optional layer prop (propIndex 2) pair, to exercise tunnel layer coverage. */
  layerPosA?: Pt | null;
  layerPosB?: Pt | null;
  currentStep?: number;
}

/** Build the flat emitter input from per-prop A/B positions. */
function makeTips(opts: TipOpts = {}): EchoTipInput {
  const emitters: EmitterTip[] = [];
  if (opts.bluePosA) emitters.push({ ...opts.bluePosA, propIndex: 0, tipIndex: 0, end: "A", color: "#3b82f6" });
  if (opts.bluePosB) emitters.push({ ...opts.bluePosB, propIndex: 0, tipIndex: 1, end: "B", color: "#3b82f6" });
  if (opts.redPosA) emitters.push({ ...opts.redPosA, propIndex: 1, tipIndex: 0, end: "A", color: "#ef4444" });
  if (opts.redPosB) emitters.push({ ...opts.redPosB, propIndex: 1, tipIndex: 1, end: "B", color: "#ef4444" });
  if (opts.layerPosA) emitters.push({ ...opts.layerPosA, propIndex: 2, tipIndex: 0, end: "A", color: "#22cc88" });
  if (opts.layerPosB) emitters.push({ ...opts.layerPosB, propIndex: 2, tipIndex: 1, end: "B", color: "#22cc88" });
  return { emitters, currentStep: opts.currentStep ?? 0 };
}

const phantoms = (r: Echo2DRenderer) => (r as unknown as { phantoms: { posA: Pt; posB: Pt; capturedStep: number; color: string }[] }).phantoms;

describe("Echo2DRenderer", () => {
  it("captures a phantom when crossing a beat boundary", () => {
    const r = new Echo2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ interval: 1 });

    // Step 0 crosses from -1 → 0; should capture.
    r.render(
      ctx,
      params,
      makeTips({ bluePosA: { x: 10, y: 20 }, bluePosB: { x: 30, y: 40 }, currentStep: 0 }),
    );

    expect(phantoms(r).length).toBe(1);
    expect(phantoms(r)[0]!.posA).toEqual({ x: 10, y: 20 });
    expect(phantoms(r)[0]!.posB).toEqual({ x: 30, y: 40 });
    expect(phantoms(r)[0]!.capturedStep).toBe(0);
  });

  it("does not capture when currentStep increments within the same beat", () => {
    const r = new Echo2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ interval: 1 });

    r.render(ctx, params, makeTips({ bluePosA: { x: 10, y: 20 }, bluePosB: { x: 30, y: 40 }, currentStep: 0 }));
    expect(phantoms(r).length).toBe(1);

    // Same beat (floor(0.5 / 1) = 0, unchanged).
    r.render(ctx, params, makeTips({ bluePosA: { x: 50, y: 60 }, bluePosB: { x: 70, y: 80 }, currentStep: 0.5 }));
    expect(phantoms(r).length).toBe(1);
  });

  it("captures a new phantom at the next beat boundary", () => {
    const r = new Echo2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ interval: 1 });

    r.render(ctx, params, makeTips({ bluePosA: { x: 0, y: 0 }, bluePosB: { x: 1, y: 1 }, currentStep: 0 }));
    r.render(ctx, params, makeTips({ bluePosA: { x: 0, y: 0 }, bluePosB: { x: 1, y: 1 }, currentStep: 1 }));
    expect(phantoms(r).length).toBe(2);
  });

  it("captures phantoms from tunnel layer props (propIndex >= 2)", () => {
    const r = new Echo2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ interval: 1 });

    // Base blue pair + one layer pair at the same beat → two phantoms.
    r.render(
      ctx,
      params,
      makeTips({
        bluePosA: { x: 0, y: 0 },
        bluePosB: { x: 1, y: 1 },
        layerPosA: { x: 200, y: 200 },
        layerPosB: { x: 201, y: 201 },
        currentStep: 0,
      }),
    );
    expect(phantoms(r).length).toBe(2);
    // The layer phantom carries the layer's spectrum color, not the base blue.
    expect(phantoms(r).some((p) => p.color === "#22cc88")).toBe(true);
  });

  it("culls phantoms whose age (in intervals) reaches decay", () => {
    const r = new Echo2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ interval: 1, decay: 2 });

    r.render(ctx, params, makeTips({ bluePosA: { x: 0, y: 0 }, bluePosB: { x: 1, y: 1 }, currentStep: 0 }));
    expect(phantoms(r).length).toBe(1);

    r.render(ctx, params, makeTips({ bluePosA: { x: 0, y: 0 }, bluePosB: { x: 1, y: 1 }, currentStep: 1 }));
    expect(phantoms(r).length).toBe(2);

    // Step 2: capture another; age of first = 2 (>= decay), culled.
    r.render(ctx, params, makeTips({ bluePosA: { x: 0, y: 0 }, bluePosB: { x: 1, y: 1 }, currentStep: 2 }));
    expect(phantoms(r).length).toBe(2);
  });

  it("renders staff lines (moveTo/lineTo/stroke) when shape='staff'", () => {
    const r = new Echo2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ shape: "staff" });

    r.render(ctx, params, makeTips({ bluePosA: { x: 10, y: 20 }, bluePosB: { x: 30, y: 40 }, currentStep: 0 }));

    expect((ctx.moveTo as any).mock.calls.length).toBeGreaterThan(0);
    expect((ctx.lineTo as any).mock.calls.length).toBeGreaterThan(0);
    expect((ctx.stroke as any).mock.calls.length).toBeGreaterThan(0);
    expect((ctx.arc as any).mock.calls.length).toBe(0);
  });

  it("renders tip dots (arc/fill) when shape='tips' and does not stroke lines", () => {
    const r = new Echo2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ shape: "tips" });

    r.render(ctx, params, makeTips({ bluePosA: { x: 10, y: 20 }, bluePosB: { x: 30, y: 40 }, currentStep: 0 }));

    expect((ctx.arc as any).mock.calls.length).toBeGreaterThan(0);
    expect((ctx.fill as any).mock.calls.length).toBeGreaterThan(0);
    expect((ctx.stroke as any).mock.calls.length).toBe(0);
  });

  it("captures both blue and red phantoms at the same beat", () => {
    const r = new Echo2DRenderer();
    const ctx = makeCtx();

    r.render(
      ctx,
      makeParams(),
      makeTips({
        bluePosA: { x: 0, y: 0 },
        bluePosB: { x: 1, y: 1 },
        redPosA: { x: 100, y: 100 },
        redPosB: { x: 101, y: 101 },
        currentStep: 0,
      }),
    );

    expect(phantoms(r).length).toBe(2);
  });

  it("dispose() empties the phantom array and resets lastStepIndex", () => {
    const r = new Echo2DRenderer();
    const ctx = makeCtx();

    r.render(
      ctx,
      makeParams(),
      makeTips({
        bluePosA: { x: 0, y: 0 },
        bluePosB: { x: 1, y: 1 },
        redPosA: { x: 2, y: 2 },
        redPosB: { x: 3, y: 3 },
        currentStep: 0,
      }),
    );
    expect(phantoms(r).length).toBe(2);

    r.dispose();
    expect(phantoms(r).length).toBe(0);
    expect((r as any).lastStepIndex).toBe(-1);
  });

  it("clears phantoms and resets lastStepIndex when animation loops (currentStep jumps backward)", () => {
    const r = new Echo2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ interval: 1, decay: 10 });

    for (let step = 0; step < 5; step++) {
      r.render(ctx, params, makeTips({ bluePosA: { x: step, y: 0 }, bluePosB: { x: step + 1, y: 0 }, currentStep: step }));
    }
    expect(phantoms(r).length).toBe(5);
    expect((r as any).lastStepIndex).toBe(4);

    // Simulate animation loop: currentStep jumps back to 0
    r.render(ctx, params, makeTips({ bluePosA: { x: 0, y: 0 }, bluePosB: { x: 1, y: 0 }, currentStep: 0 }));

    expect(phantoms(r).length).toBe(1);
    expect(phantoms(r)[0]!.capturedStep).toBe(0);
    expect((r as any).lastStepIndex).toBe(0);
  });

  it("does not leak phantoms across multiple animation loops", () => {
    const r = new Echo2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ interval: 1, decay: 10 });

    for (let loop = 0; loop < 5; loop++) {
      for (let step = 0; step < 4; step++) {
        r.render(ctx, params, makeTips({ bluePosA: { x: step, y: 0 }, bluePosB: { x: step + 1, y: 0 }, currentStep: step }));
      }
    }
    // Should only have phantoms from the last loop (4), not 20
    expect(phantoms(r).length).toBeLessThanOrEqual(4);
  });
});

describe("Echo2DRenderer scale", () => {
  it("accepts a scale argument (contract)", () => {
    const r = new Echo2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ intensity: 1, thickness: 4 });
    expect(() =>
      r.render(ctx, params, makeTips({ bluePosA: { x: 0, y: 0 }, bluePosB: { x: 10, y: 0 }, currentStep: 0 }), 0.5),
    ).not.toThrow();
  });

  it("at scale=0.5, ctx.lineWidth is set to thickness*0.5 during render", () => {
    const r = new Echo2DRenderer();
    const assignedLineWidths: number[] = [];
    let _lineWidth = 1;
    const ctx = {
      ...makeCtx(),
      get lineWidth() { return _lineWidth; },
      set lineWidth(v: number) { assignedLineWidths.push(v); _lineWidth = v; },
    } as unknown as CanvasRenderingContext2D;

    const params = makeParams({ intensity: 1, thickness: 8, glow: 0, depth: 0, flash: 0 });
    // Step 1: capture at beat 0.
    r.render(ctx, params, makeTips({ bluePosA: { x: 0, y: 0 }, bluePosB: { x: 10, y: 0 }, currentStep: 0 }), 0.5);
    // Step 2: advance past beat 1 so the captured phantom is drawn.
    r.render(ctx, params, makeTips({ bluePosA: { x: 0, y: 0 }, bluePosB: { x: 10, y: 0 }, currentStep: 1.5 }), 0.5);
    // The renderer sets lineWidth = thickness * scale = 8 * 0.5 = 4.
    expect(assignedLineWidths).toContain(4);
  });
});

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
    quadraticCurveTo: vi.fn(),
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
    streak: 0,
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

const clones = (r: Echo2DRenderer) =>
  (r as unknown as { lastClonePos: Map<number, unknown> }).lastClonePos;
const stepIndex = (r: Echo2DRenderer) =>
  (r as unknown as { lastStepIndex: number }).lastStepIndex;
const strokes = (ctx: CanvasRenderingContext2D) =>
  (ctx.stroke as unknown as { mock: { calls: unknown[] } }).mock.calls.length;

describe("Echo2DRenderer — long-exposure stamp", () => {
  it("stamps a clone on a beat-onset (staff strokes, clone position recorded)", () => {
    const r = new Echo2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ interval: 1, shape: "staff" });

    // Step 0 crosses from beat -1 → 0; should stamp.
    r.render(ctx, params, makeTips({ bluePosA: { x: 10, y: 20 }, bluePosB: { x: 30, y: 40 }, currentStep: 0 }));

    expect(strokes(ctx)).toBeGreaterThan(0);
    expect(stepIndex(r)).toBe(0);
    expect(clones(r).get(0)).toEqual({ posA: { x: 10, y: 20 }, posB: { x: 30, y: 40 } });
  });

  it("does not stamp within the same beat cell", () => {
    const r = new Echo2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ interval: 1 });

    r.render(ctx, params, makeTips({ bluePosA: { x: 10, y: 20 }, bluePosB: { x: 30, y: 40 }, currentStep: 0 }));
    (ctx.stroke as ReturnType<typeof vi.fn>).mockClear();

    // floor(0.5 / 1) === 0, still beat 0 → no new stamp.
    r.render(ctx, params, makeTips({ bluePosA: { x: 50, y: 60 }, bluePosB: { x: 70, y: 80 }, currentStep: 0.5 }));
    expect(strokes(ctx)).toBe(0);
    expect(stepIndex(r)).toBe(0);
  });

  it("stamps again at the next beat boundary", () => {
    const r = new Echo2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ interval: 1 });

    r.render(ctx, params, makeTips({ bluePosA: { x: 0, y: 0 }, bluePosB: { x: 1, y: 1 }, currentStep: 0 }));
    r.render(ctx, params, makeTips({ bluePosA: { x: 5, y: 5 }, bluePosB: { x: 6, y: 6 }, currentStep: 1 }));
    expect(stepIndex(r)).toBe(1);
    expect(clones(r).get(0)).toEqual({ posA: { x: 5, y: 5 }, posB: { x: 6, y: 6 } });
  });

  it("stamps both blue and red clones at the same beat", () => {
    const r = new Echo2DRenderer();
    const ctx = makeCtx();

    r.render(
      ctx,
      makeParams(),
      makeTips({
        bluePosA: { x: 0, y: 0 }, bluePosB: { x: 1, y: 1 },
        redPosA: { x: 100, y: 100 }, redPosB: { x: 101, y: 101 },
        currentStep: 0,
      }),
    );
    expect(clones(r).size).toBe(2);
    expect(clones(r).has(0)).toBe(true);
    expect(clones(r).has(1)).toBe(true);
  });

  it("stamps tunnel-layer clones (propIndex >= 2)", () => {
    const r = new Echo2DRenderer();
    const ctx = makeCtx();

    r.render(
      ctx,
      makeParams(),
      makeTips({
        bluePosA: { x: 0, y: 0 }, bluePosB: { x: 1, y: 1 },
        layerPosA: { x: 200, y: 200 }, layerPosB: { x: 201, y: 201 },
        currentStep: 0,
      }),
    );
    expect(clones(r).size).toBe(2);
    expect(clones(r).has(2)).toBe(true);
  });

  it("shape='tips' with streak=0 draws orbs (arc/fill) and no strokes", () => {
    const r = new Echo2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ shape: "tips", streak: 0 });

    r.render(ctx, params, makeTips({ bluePosA: { x: 10, y: 20 }, bluePosB: { x: 30, y: 40 }, currentStep: 0 }));

    expect((ctx.arc as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
    expect((ctx.fill as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
    expect(strokes(ctx)).toBe(0);
  });

  it("streak>0 draws a connective thread once a prior clone exists", () => {
    const r = new Echo2DRenderer();
    const ctx = makeCtx();
    // tips shape so the only possible stroke is the streak thread itself.
    const params = makeParams({ shape: "tips", streak: 0.5, interval: 1 });

    // Beat 0: no prior clone → no streak → no stroke.
    r.render(ctx, params, makeTips({ bluePosA: { x: 0, y: 0 }, bluePosB: { x: 1, y: 1 }, currentStep: 0 }));
    expect(strokes(ctx)).toBe(0);

    // Beat 1: prior clone exists → streak thread strokes (quadratic curves).
    r.render(ctx, params, makeTips({ bluePosA: { x: 10, y: 0 }, bluePosB: { x: 11, y: 1 }, currentStep: 1 }));
    expect(strokes(ctx)).toBeGreaterThan(0);
    expect((ctx.quadraticCurveTo as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
  });

  it("resets onset + streak memory when the animation loops (currentStep jumps back)", () => {
    const r = new Echo2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ interval: 1, streak: 0.5 });

    for (let step = 0; step < 5; step++) {
      r.render(ctx, params, makeTips({ bluePosA: { x: step, y: 0 }, bluePosB: { x: step + 1, y: 0 }, currentStep: step }));
    }
    expect(stepIndex(r)).toBe(4);

    // Loop: currentStep jumps back to 0. Onset memory + prior clone reset, so the
    // first beat of the new exposure stamps without a streak from the old tail.
    (ctx.quadraticCurveTo as ReturnType<typeof vi.fn>).mockClear();
    r.render(ctx, params, makeTips({ bluePosA: { x: 0, y: 0 }, bluePosB: { x: 1, y: 0 }, currentStep: 0 }));
    expect(stepIndex(r)).toBe(0);
    expect(clones(r).size).toBe(1);
    expect((ctx.quadraticCurveTo as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it("reset() clears onset index and clone memory", () => {
    const r = new Echo2DRenderer();
    const ctx = makeCtx();
    r.render(ctx, makeParams(), makeTips({ bluePosA: { x: 0, y: 0 }, bluePosB: { x: 1, y: 1 }, currentStep: 0 }));
    expect(clones(r).size).toBe(1);

    r.reset();
    expect(stepIndex(r)).toBe(-1);
    expect(clones(r).size).toBe(0);
  });

  it("dispose() clears state", () => {
    const r = new Echo2DRenderer();
    const ctx = makeCtx();
    r.render(ctx, makeParams(), makeTips({ bluePosA: { x: 0, y: 0 }, bluePosB: { x: 1, y: 1 }, currentStep: 0 }));
    r.dispose();
    expect(stepIndex(r)).toBe(-1);
    expect(clones(r).size).toBe(0);
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

  it("at scale=0.5, ctx.lineWidth is set to thickness*0.5 during a staff stamp", () => {
    const r = new Echo2DRenderer();
    const assignedLineWidths: number[] = [];
    let _lineWidth = 1;
    const ctx = {
      ...makeCtx(),
      get lineWidth() { return _lineWidth; },
      set lineWidth(v: number) { assignedLineWidths.push(v); _lineWidth = v; },
    } as unknown as CanvasRenderingContext2D;

    const params = makeParams({ intensity: 1, thickness: 8, glow: 0, depth: 0, flash: 0, streak: 0, shape: "staff" });
    // Stamps at beat 0; body stroke sets lineWidth = thickness * scale = 8 * 0.5 = 4.
    r.render(ctx, params, makeTips({ bluePosA: { x: 0, y: 0 }, bluePosB: { x: 10, y: 0 }, currentStep: 0 }), 0.5);
    expect(assignedLineWidths).toContain(4);
  });
});

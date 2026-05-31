/**
 * card-back-raster.test.ts
 *
 * Unit tests for paintBackJob and applyLinearGradient.
 *
 * OffscreenCanvas is not available in jsdom/vitest, so we drive everything
 * through a fake context + fake canvas injected via the createCanvas factory.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { paintBackJob, applyLinearGradient } from "../card-back-raster";
import type { BackJob, GradientSpec, PlacedBitmap } from "../back-job";

// ---------------------------------------------------------------------------
// Fake canvas infrastructure
// ---------------------------------------------------------------------------

interface FakeGradient {
  type: "linearGradient";
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  stops: { offset: number; color: string }[];
  addColorStop(offset: number, color: string): void;
}

type CtxCall =
  | { op: "fillRect"; x: number; y: number; w: number; h: number }
  | { op: "drawImage"; img: unknown; x: number; y: number; w: number; h: number }
  | { op: "save" }
  | { op: "restore" }
  | { op: "setTransform"; a: number; b: number; c: number; d: number; e: number; f: number }
  | { op: "translate"; x: number; y: number }
  | { op: "scale"; sx: number; sy: number }
  | { op: "fill"; path?: Path2D }
  | { op: "stroke"; path?: Path2D }
  | { op: "fillRect2"; args: unknown[] };

function makeFakeCtx(canvasW = 1644, canvasH = 2244) {
  const calls: CtxCall[] = [];
  const createdGradients: FakeGradient[] = [];
  let _globalAlpha = 1;
  let _fillStyle: unknown = "#000";

  // Minimal DOMMatrix-alike for getTransform()
  const identityTransform = {
    a: 1, b: 0, c: 0, d: 1, e: 0, f: 0,
    is2D: true,
  };

  const ctx = {
    canvas: { width: canvasW, height: canvasH },
    get globalAlpha() { return _globalAlpha; },
    set globalAlpha(v: number) { _globalAlpha = v; },
    get fillStyle() { return _fillStyle; },
    set fillStyle(v: unknown) { _fillStyle = v; },
    strokeStyle: "black" as unknown,
    lineWidth: 1,
    lineCap: "butt" as CanvasLineCap,
    globalCompositeOperation: "source-over" as GlobalCompositeOperation,

    createLinearGradient(x0: number, y0: number, x1: number, y1: number): FakeGradient {
      const g: FakeGradient = {
        type: "linearGradient",
        x0, y0, x1, y1,
        stops: [],
        addColorStop(offset: number, color: string) {
          this.stops.push({ offset, color });
        },
      };
      createdGradients.push(g);
      return g;
    },

    fillRect(x: number, y: number, w: number, h: number) {
      calls.push({ op: "fillRect", x, y, w, h });
    },

    drawImage(img: unknown, x: number, y: number, w: number, h: number) {
      calls.push({ op: "drawImage", img, x, y, w, h });
    },

    save() { calls.push({ op: "save" }); },
    restore() { calls.push({ op: "restore" }); },

    getTransform() { return identityTransform; },
    setTransform(a: number, b: number, c: number, d: number, e: number, f: number) {
      calls.push({ op: "setTransform", a, b, c, d, e, f });
    },
    translate(x: number, y: number) { calls.push({ op: "translate", x, y }); },
    scale(sx: number, sy: number) { calls.push({ op: "scale", sx, sy }); },
    fill(path?: Path2D) { calls.push({ op: "fill", path }); },
    stroke(path?: Path2D) { calls.push({ op: "stroke", path }); },
  };

  const fakeCanvas = {
    width: canvasW,
    height: canvasH,
    getContext(_type: string) { return ctx; },
  } as unknown as OffscreenCanvas;

  return { ctx, calls, createdGradients, fakeCanvas };
}

// ---------------------------------------------------------------------------
// Helpers for building minimal BackJob fixtures
// ---------------------------------------------------------------------------

function makeGrad(angleDeg = 180): GradientSpec {
  return {
    type: "linear",
    angleDeg,
    stops: [{ offset: 0, color: "#111" }, { offset: 1, color: "#999" }],
  };
}

function makeMinimalJob(overrides: Partial<BackJob> = {}): BackJob {
  return {
    width: 1644,
    height: 2244,
    bleedPx: 72,
    borderPx: 144, // wide colored border (≠ bleedPx) — raster fills the bg against this
    borderGradient: makeGrad(0),
    bgGradient: makeGrad(180),
    decorations: null,
    mandala: null,
    bitmaps: [],
    ...overrides,
  };
}

function makeFakeBitmap(): ImageBitmap {
  // Any object — drawImage is mocked in the fake ctx
  return {} as ImageBitmap;
}

// ---------------------------------------------------------------------------
// applyLinearGradient — geometry unit tests
// ---------------------------------------------------------------------------

describe("applyLinearGradient", () => {
  const W = 100, H = 200;

  it("180deg → vertical top-to-bottom gradient (x0 === x1 === cx, y0 < y1)", () => {
    const fakeCtx = {
      createLinearGradient(x0: number, y0: number, x1: number, y1: number) {
        return { x0, y0, x1, y1, addColorStop() {} };
      },
    };

    const spec: GradientSpec = { type: "linear", angleDeg: 180, stops: [] };
    const g = applyLinearGradient(fakeCtx, spec, 0, 0, W, H) as unknown as {
      x0: number; y0: number; x1: number; y1: number;
    };

    const cx = W / 2;
    expect(g.x0).toBeCloseTo(cx, 5);
    expect(g.x1).toBeCloseTo(cx, 5);
    expect(g.y0).toBeLessThan(g.y1);
  });

  it("0deg → vertical bottom-to-top gradient (x0 === x1 === cx, y0 > y1)", () => {
    const fakeCtx = {
      createLinearGradient(x0: number, y0: number, x1: number, y1: number) {
        return { x0, y0, x1, y1, addColorStop() {} };
      },
    };

    const spec: GradientSpec = { type: "linear", angleDeg: 0, stops: [] };
    const g = applyLinearGradient(fakeCtx, spec, 0, 0, W, H) as unknown as {
      x0: number; y0: number; x1: number; y1: number;
    };

    const cx = W / 2;
    expect(g.x0).toBeCloseTo(cx, 5);
    expect(g.x1).toBeCloseTo(cx, 5);
    // 0deg = up = start is at BOTTOM (higher y in canvas), end at TOP (lower y)
    expect(g.y0).toBeGreaterThan(g.y1);
  });

  it("90deg → horizontal left-to-right gradient (y0 === y1 === cy, x0 < x1)", () => {
    const fakeCtx = {
      createLinearGradient(x0: number, y0: number, x1: number, y1: number) {
        return { x0, y0, x1, y1, addColorStop() {} };
      },
    };

    const spec: GradientSpec = { type: "linear", angleDeg: 90, stops: [] };
    const g = applyLinearGradient(fakeCtx, spec, 0, 0, W, H) as unknown as {
      x0: number; y0: number; x1: number; y1: number;
    };

    const cy = H / 2;
    expect(g.y0).toBeCloseTo(cy, 5);
    expect(g.y1).toBeCloseTo(cy, 5);
    expect(g.x0).toBeLessThan(g.x1);
  });

  it("respects box offset — gradient centre tracks (x + w/2, y + h/2)", () => {
    const fakeCtx = {
      createLinearGradient(x0: number, y0: number, x1: number, y1: number) {
        return { x0, y0, x1, y1, addColorStop() {} };
      },
    };

    const spec: GradientSpec = { type: "linear", angleDeg: 90, stops: [] };
    // Offset box: x=50, y=100
    const g = applyLinearGradient(fakeCtx, spec, 50, 100, W, H) as unknown as {
      x0: number; y0: number; x1: number; y1: number;
    };

    const expectedCy = 100 + H / 2;
    expect(g.y0).toBeCloseTo(expectedCy, 5);
    expect(g.y1).toBeCloseTo(expectedCy, 5);
  });

  it("clamps stop offsets to [0, 1]", () => {
    const stops: { offset: number; color: string }[] = [];
    const fakeCtx = {
      createLinearGradient() {
        return {
          addColorStop(offset: number, color: string) {
            stops.push({ offset, color });
          },
        };
      },
    };

    const spec: GradientSpec = {
      type: "linear",
      angleDeg: 0,
      stops: [
        { offset: -0.5, color: "red" },
        { offset: 0.5, color: "green" },
        { offset: 1.5, color: "blue" },
      ],
    };
    applyLinearGradient(fakeCtx, spec, 0, 0, W, H);
    expect(stops[0]!.offset).toBe(0);
    expect(stops[1]!.offset).toBe(0.5);
    expect(stops[2]!.offset).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// paintBackJob — call-order and drawImage placement tests
// ---------------------------------------------------------------------------

describe("paintBackJob", () => {
  it("emits two fillRects in order: full canvas then inner rect", () => {
    const { fakeCanvas, calls } = makeFakeCtx();
    const job = makeMinimalJob();
    paintBackJob(job, () => fakeCanvas);

    const fillRects = calls.filter((c): c is Extract<CtxCall, { op: "fillRect" }> => c.op === "fillRect");
    expect(fillRects.length).toBeGreaterThanOrEqual(2);

    // First fillRect = full canvas
    expect(fillRects[0]!.x).toBe(0);
    expect(fillRects[0]!.y).toBe(0);
    expect(fillRects[0]!.w).toBe(1644);
    expect(fillRects[0]!.h).toBe(2244);

    // Second fillRect = inner rect (inside the colored border = borderPx)
    expect(fillRects[1]!.x).toBe(144);
    expect(fillRects[1]!.y).toBe(144);
    expect(fillRects[1]!.w).toBe(1644 - 144 * 2);
    expect(fillRects[1]!.h).toBe(2244 - 144 * 2);
  });

  it("does NOT drawImage for decorations when job.decorations is null", () => {
    const { fakeCanvas, calls } = makeFakeCtx();
    paintBackJob(makeMinimalJob({ decorations: null }), () => fakeCanvas);
    const drawImages = calls.filter((c) => c.op === "drawImage");
    expect(drawImages).toHaveLength(0);
  });

  it("drawImages decorations bitmap at the inner rect with correct coords", () => {
    const { fakeCanvas, calls } = makeFakeCtx();
    const decBitmap = makeFakeBitmap();
    const job = makeMinimalJob({
      decorations: { bitmap: decBitmap, opacity: 0.4 },
    });
    paintBackJob(job, () => fakeCanvas);

    const drawImages = calls.filter(
      (c): c is Extract<CtxCall, { op: "drawImage" }> => c.op === "drawImage",
    );
    expect(drawImages.length).toBeGreaterThanOrEqual(1);

    const decDraw = drawImages.find((d) => d.img === decBitmap);
    expect(decDraw).toBeDefined();
    expect(decDraw!.x).toBe(144);
    expect(decDraw!.y).toBe(144);
    expect(decDraw!.w).toBe(1644 - 144 * 2);
    expect(decDraw!.h).toBe(2244 - 144 * 2);
  });

  it("wraps decorations drawImage in save/restore so opacity resets", () => {
    const { fakeCanvas, calls } = makeFakeCtx();
    const job = makeMinimalJob({
      decorations: { bitmap: makeFakeBitmap(), opacity: 0.5 },
    });
    paintBackJob(job, () => fakeCanvas);

    const saveIdx = calls.findIndex((c) => c.op === "save");
    const restoreIdx = calls.findIndex((c) => c.op === "restore");
    const drawIdx = calls.findIndex((c) => c.op === "drawImage");

    expect(saveIdx).toBeGreaterThanOrEqual(0);
    expect(restoreIdx).toBeGreaterThan(saveIdx);
    expect(drawIdx).toBeGreaterThan(saveIdx);
    expect(drawIdx).toBeLessThan(restoreIdx);
  });

  it("drawImages each placed bitmap at its exact placement coords", () => {
    const { fakeCanvas, calls } = makeFakeCtx();
    const bmp1 = makeFakeBitmap();
    const bmp2 = makeFakeBitmap();
    const bitmaps: PlacedBitmap[] = [
      { kind: "brand", bitmap: bmp1, placement: { x: 10, y: 20, w: 100, h: 50 } },
      { kind: "loop-label", bitmap: bmp2, placement: { x: 300, y: 400, w: 200, h: 80 } },
    ];
    paintBackJob(makeMinimalJob({ bitmaps }), () => fakeCanvas);

    const drawImages = calls.filter(
      (c): c is Extract<CtxCall, { op: "drawImage" }> => c.op === "drawImage",
    );

    const d1 = drawImages.find((d) => d.img === bmp1);
    expect(d1).toBeDefined();
    expect(d1!.x).toBe(10);
    expect(d1!.y).toBe(20);
    expect(d1!.w).toBe(100);
    expect(d1!.h).toBe(50);

    const d2 = drawImages.find((d) => d.img === bmp2);
    expect(d2).toBeDefined();
    expect(d2!.x).toBe(300);
    expect(d2!.y).toBe(400);
    expect(d2!.w).toBe(200);
    expect(d2!.h).toBe(80);
  });

  it("all placed bitmaps appear AFTER the two gradient fillRects", () => {
    const { fakeCanvas, calls } = makeFakeCtx();
    const bmp = makeFakeBitmap();
    const bitmaps: PlacedBitmap[] = [
      { kind: "brand", bitmap: bmp, placement: { x: 0, y: 0, w: 10, h: 10 } },
    ];
    paintBackJob(makeMinimalJob({ bitmaps }), () => fakeCanvas);

    const fillRects = calls
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.op === "fillRect");
    const drawImages = calls
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.op === "drawImage" && (c as { img: unknown }).img === bmp);

    expect(fillRects.length).toBeGreaterThanOrEqual(2);
    expect(drawImages.length).toBe(1);

    const lastFillRectIdx = fillRects[fillRects.length - 1]!.i;
    const bitmapDrawIdx = drawImages[0]!.i;
    expect(bitmapDrawIdx).toBeGreaterThan(lastFillRectIdx);
  });

  it("does NOT drawImage for the mandala when job.mandala is null", () => {
    const { fakeCanvas, calls } = makeFakeCtx();
    paintBackJob(makeMinimalJob({ mandala: null }), () => fakeCanvas);
    const drawImages = calls.filter((c) => c.op === "drawImage");
    expect(drawImages).toHaveLength(0);
  });

  it("drawImages the mandala bitmap at its placement box", () => {
    const { fakeCanvas, calls } = makeFakeCtx();
    const mandalaBmp = makeFakeBitmap();
    const job = makeMinimalJob({
      mandala: { bitmap: mandalaBmp, placement: { x: 120, y: 340, w: 1184, h: 1184 } },
    });
    paintBackJob(job, () => fakeCanvas);

    const drawImages = calls.filter(
      (c): c is Extract<CtxCall, { op: "drawImage" }> => c.op === "drawImage",
    );
    const mandalaDraw = drawImages.find((d) => d.img === mandalaBmp);
    expect(mandalaDraw).toBeDefined();
    expect(mandalaDraw!.x).toBe(120);
    expect(mandalaDraw!.y).toBe(340);
    expect(mandalaDraw!.w).toBe(1184);
    expect(mandalaDraw!.h).toBe(1184);
  });

  it("draws the mandala AFTER decorations and BEFORE the placed bitmaps", () => {
    const { fakeCanvas, calls } = makeFakeCtx();
    const decBmp = makeFakeBitmap();
    const mandalaBmp = makeFakeBitmap();
    const placedBmp = makeFakeBitmap();
    const job = makeMinimalJob({
      decorations: { bitmap: decBmp, opacity: 0.4 },
      mandala: { bitmap: mandalaBmp, placement: { x: 0, y: 0, w: 100, h: 100 } },
      bitmaps: [{ kind: "brand", bitmap: placedBmp, placement: { x: 0, y: 0, w: 10, h: 10 } }],
    });
    paintBackJob(job, () => fakeCanvas);

    const idxOf = (bmp: unknown) =>
      calls.findIndex((c) => c.op === "drawImage" && (c as { img: unknown }).img === bmp);

    const decIdx = idxOf(decBmp);
    const mandalaIdx = idxOf(mandalaBmp);
    const placedIdx = idxOf(placedBmp);

    expect(decIdx).toBeGreaterThanOrEqual(0);
    expect(mandalaIdx).toBeGreaterThan(decIdx);
    expect(placedIdx).toBeGreaterThan(mandalaIdx);
  });

  it("returns the canvas provided by createCanvas", () => {
    const { fakeCanvas } = makeFakeCtx();
    const result = paintBackJob(makeMinimalJob(), () => fakeCanvas);
    expect(result).toBe(fakeCanvas);
  });

  it("createLinearGradient is called twice (once per gradient fill)", () => {
    const { fakeCanvas, createdGradients } = makeFakeCtx();
    paintBackJob(makeMinimalJob(), () => fakeCanvas);
    // At minimum 2 gradients: borderGradient + bgGradient
    expect(createdGradients.length).toBeGreaterThanOrEqual(2);
  });
});

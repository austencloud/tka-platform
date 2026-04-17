import { describe, it, expect, vi } from "vitest";
import { Echo2DRenderer, type EchoTipInput } from "./Echo2DRenderer";
import type { Echo2DParams } from "../translators/canvas2d-types";

function makeCtx() {
  const ctx = {
    globalCompositeOperation: "source-over",
    globalAlpha: 1,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
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
    blendMode: "lighter",
    ...overrides,
  };
}

function makeTips(overrides: Partial<EchoTipInput> = {}): EchoTipInput {
  return {
    bluePosA: null,
    bluePosB: null,
    redPosA: null,
    redPosB: null,
    currentStep: 0,
    blueColor: "#3b82f6",
    redColor: "#ef4444",
    ...overrides,
  };
}

describe("Echo2DRenderer", () => {
  it("captures a phantom when crossing a beat boundary", () => {
    const r = new Echo2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ interval: 1 });

    // Step 0 crosses from -1 → 0; should capture.
    r.render(
      ctx,
      params,
      makeTips({
        bluePosA: { x: 10, y: 20 },
        bluePosB: { x: 30, y: 40 },
        currentStep: 0,
      }),
    );

    expect((r as any).phantomsBlue.length).toBe(1);
    expect((r as any).phantomsBlue[0].posA).toEqual({ x: 10, y: 20 });
    expect((r as any).phantomsBlue[0].posB).toEqual({ x: 30, y: 40 });
    expect((r as any).phantomsBlue[0].capturedStep).toBe(0);
  });

  it("does not capture when currentStep increments within the same beat", () => {
    const r = new Echo2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ interval: 1 });

    r.render(
      ctx,
      params,
      makeTips({
        bluePosA: { x: 10, y: 20 },
        bluePosB: { x: 30, y: 40 },
        currentStep: 0,
      }),
    );
    expect((r as any).phantomsBlue.length).toBe(1);

    // Same beat (floor(0.5 / 1) = 0, unchanged).
    r.render(
      ctx,
      params,
      makeTips({
        bluePosA: { x: 50, y: 60 },
        bluePosB: { x: 70, y: 80 },
        currentStep: 0.5,
      }),
    );
    expect((r as any).phantomsBlue.length).toBe(1);
  });

  it("captures a new phantom at the next beat boundary", () => {
    const r = new Echo2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ interval: 1 });

    r.render(ctx, params, makeTips({ bluePosA: { x: 0, y: 0 }, bluePosB: { x: 1, y: 1 }, currentStep: 0 }));
    r.render(ctx, params, makeTips({ bluePosA: { x: 0, y: 0 }, bluePosB: { x: 1, y: 1 }, currentStep: 1 }));
    expect((r as any).phantomsBlue.length).toBe(2);
  });

  it("culls phantoms whose age (in intervals) reaches decay", () => {
    const r = new Echo2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ interval: 1, decay: 2 });

    // Capture at step 0.
    r.render(ctx, params, makeTips({ bluePosA: { x: 0, y: 0 }, bluePosB: { x: 1, y: 1 }, currentStep: 0 }));
    expect((r as any).phantomsBlue.length).toBe(1);

    // Step 1: capture another (age of first = 1, still < decay=2).
    r.render(ctx, params, makeTips({ bluePosA: { x: 0, y: 0 }, bluePosB: { x: 1, y: 1 }, currentStep: 1 }));
    expect((r as any).phantomsBlue.length).toBe(2);

    // Step 2: capture another; age of first = 2 (>= decay), culled.
    r.render(ctx, params, makeTips({ bluePosA: { x: 0, y: 0 }, bluePosB: { x: 1, y: 1 }, currentStep: 2 }));
    // First phantom culled, second and third survive.
    expect((r as any).phantomsBlue.length).toBe(2);
  });

  it("renders staff lines (moveTo/lineTo/stroke) when shape='staff'", () => {
    const r = new Echo2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ shape: "staff" });

    r.render(
      ctx,
      params,
      makeTips({
        bluePosA: { x: 10, y: 20 },
        bluePosB: { x: 30, y: 40 },
        currentStep: 0,
      }),
    );

    expect((ctx.moveTo as any).mock.calls.length).toBeGreaterThan(0);
    expect((ctx.lineTo as any).mock.calls.length).toBeGreaterThan(0);
    expect((ctx.stroke as any).mock.calls.length).toBeGreaterThan(0);
    expect((ctx.arc as any).mock.calls.length).toBe(0);
  });

  it("renders tip dots (arc/fill) when shape='tips' and does not stroke lines", () => {
    const r = new Echo2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ shape: "tips" });

    r.render(
      ctx,
      params,
      makeTips({
        bluePosA: { x: 10, y: 20 },
        bluePosB: { x: 30, y: 40 },
        currentStep: 0,
      }),
    );

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

    expect((r as any).phantomsBlue.length).toBe(1);
    expect((r as any).phantomsRed.length).toBe(1);
  });

  it("dispose() empties both phantom arrays and resets lastBeatIndex", () => {
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
    expect((r as any).phantomsBlue.length).toBe(1);

    r.dispose();
    expect((r as any).phantomsBlue.length).toBe(0);
    expect((r as any).phantomsRed.length).toBe(0);
    expect((r as any).lastBeatIndex).toBe(-1);
  });
});

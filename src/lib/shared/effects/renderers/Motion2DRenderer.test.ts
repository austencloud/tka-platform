import { describe, it, expect, vi } from "vitest";
import { Motion2DRenderer, type MotionTipInput } from "./Motion2DRenderer";
import type { Motion2DParams } from "../translators/canvas2d-types";

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

function makeParams(overrides: Partial<Motion2DParams> = {}): Motion2DParams {
  return {
    blur: 0.5,
    speedLines: 0.5,
    threshold: 0.2,
    color: "#ffffff",
    colorMode: "solid",
    length: 0.5,
    count: 6,
    fadeAlpha: 0.9,
    streakLength: 24,
    ...overrides,
  };
}

function makeTips(overrides: Partial<MotionTipInput> = {}): MotionTipInput {
  return {
    bluePosA: null,
    bluePosB: null,
    redPosA: null,
    redPosB: null,
    blueColor: "#3b82f6",
    redColor: "#ef4444",
    ...overrides,
  };
}

describe("Motion2DRenderer", () => {
  it("does not draw below the velocity threshold (stationary tip)", () => {
    const r = new Motion2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ threshold: 0.5, blur: 0.8, speedLines: 0.8 });
    const tips = makeTips({ bluePosA: { x: 100, y: 100 } });

    // Seed last position then call again with same position — velocity = 0.
    r.render(ctx, params, tips, 1 / 60);
    r.render(ctx, params, tips, 1 / 60);
    r.render(ctx, params, tips, 1 / 60);

    expect((ctx.arc as any).mock.calls.length).toBe(0);
    expect((ctx.stroke as any).mock.calls.length).toBe(0);
  });

  it("draws ghost stamp arcs above threshold when blur > 0", () => {
    const r = new Motion2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ threshold: 0.0, blur: 0.8, speedLines: 0 });

    // Move tip far enough between frames to clear any threshold.
    r.render(ctx, params, makeTips({ bluePosA: { x: 0, y: 0 } }), 1 / 60);
    r.render(ctx, params, makeTips({ bluePosA: { x: 200, y: 0 } }), 1 / 60);
    r.render(ctx, params, makeTips({ bluePosA: { x: 400, y: 0 } }), 1 / 60);

    expect((ctx.arc as any).mock.calls.length).toBeGreaterThan(0);
  });

  it("emits speed lines (stroke calls) above threshold when speedLines > 0", () => {
    const r = new Motion2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({
      threshold: 0.0,
      blur: 0,
      speedLines: 0.9,
      count: 5,
    });

    r.render(ctx, params, makeTips({ bluePosA: { x: 0, y: 0 } }), 1 / 60);
    r.render(ctx, params, makeTips({ bluePosA: { x: 200, y: 0 } }), 1 / 60);

    // params.count strokes per moving tip.
    expect((ctx.stroke as any).mock.calls.length).toBeGreaterThanOrEqual(5);
  });

  it("dispose() clears per-tip state", () => {
    const r = new Motion2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ threshold: 0.0, blur: 0.5 });

    r.render(ctx, params, makeTips({ bluePosA: { x: 0, y: 0 } }), 1 / 60);
    r.render(ctx, params, makeTips({ bluePosA: { x: 100, y: 0 } }), 1 / 60);
    expect(Object.keys((r as any).tipState).length).toBeGreaterThan(0);

    r.dispose();
    expect(Object.keys((r as any).tipState).length).toBe(0);
  });
});

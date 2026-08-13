import { describe, expect, it, vi } from "vitest";
import {
  Silk2DRenderer,
  smoothSilk2DPath,
} from "$lib/shared/effects/renderers/silk-2d-renderer";
import { resolveCentripetalBezierSegment } from "$lib/shared/effects/renderers/ribbon-trace";
import type { Silk2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import type { EmitterTip } from "$lib/shared/effects/renderers/emitter-tip";

const PARAMS: Silk2DParams = {
  intensity: 0.5,
  width: 0.5,
  duration: 0.5,
  flutter: 0.3,
  tautness: 0.5,
  palette: "satin",
  customColor: "#c0c0d0",
  trackingMode: "both_ends",
  resolvedPalette: { id: "satin", body: "#c0c0d0", edge: "#ffffff" },
  baseHalfWidth: 12,
  lifetimeSeconds: 2,
  motionReferenceSpeed: 3,
  blendMode: "source-over",
};

function makeContext(): CanvasRenderingContext2D {
  const gradient = { addColorStop: vi.fn() };
  return {
    canvas: { width: 800, height: 600 },
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    createRadialGradient: vi.fn(() => gradient),
  } as unknown as CanvasRenderingContext2D;
}

function tip(x: number, y: number): EmitterTip {
  return {
    x,
    y,
    propIndex: 0,
    tipIndex: 0,
    end: "A",
    color: "#3a7fd9",
  };
}

describe("2D Silk path polish", () => {
  it("softens a one-frame corner without moving either ribbon endpoint", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 30 },
      { x: 30, y: 0 },
      { x: 40, y: 0 },
    ];

    const smoothed = smoothSilk2DPath(points);

    expect({ x: smoothed.x[0], y: smoothed.y[0] }).toEqual(points[0]);
    expect({ x: smoothed.x[4], y: smoothed.y[4] }).toEqual(points[4]);
    expect(smoothed.y[2]).toBeGreaterThan(0);
    expect(smoothed.y[2]).toBeLessThan(points[2]!.y);
    expect(smoothed.y[1]).toBeGreaterThan(0);
    expect(smoothed.y[3]).toBeGreaterThan(0);
  });

  it("shortens the handle beside a distant sample instead of hooking backward", () => {
    const segment = resolveCentripetalBezierSegment(
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0.1 },
      { x: 100, y: 100 }
    );

    expect(segment.control2.x).toBeGreaterThan(0);
    expect(segment.control2.x).toBeLessThan(3);
    expect(segment.end).toEqual({ x: 2, y: 0.1 });
  });

  it("keeps every Bezier control finite when motion samples repeat", () => {
    const segment = resolveCentripetalBezierSegment(
      { x: 4, y: 7 },
      { x: 4, y: 7 },
      { x: 4, y: 7 },
      { x: 9, y: 11 }
    );

    for (const point of [segment.control1, segment.control2, segment.end]) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
    }
  });

  it("keeps every rendered edge handle finite through a tight turn", () => {
    const renderer = new Silk2DRenderer();
    const ctx = makeContext();

    for (let frame = 0; frame < 36; frame++) {
      const angle = frame * 0.18;
      renderer.render(
        ctx,
        PARAMS,
        [tip(220 + Math.cos(angle) * 90, 220 + Math.sin(angle) * 55)],
        1 / 60
      );
    }

    expect(vi.mocked(ctx.fill).mock.calls.length).toBeGreaterThan(0);
    for (const call of vi.mocked(ctx.bezierCurveTo).mock.calls) {
      for (const coordinate of call)
        expect(Number.isFinite(coordinate)).toBe(true);
    }
  });

  it("does not draw a separate highlight stroke through the ribbon body", () => {
    const renderer = new Silk2DRenderer();
    const ctx = makeContext();

    for (let frame = 0; frame < 36; frame++) {
      renderer.render(ctx, PARAMS, [tip(120 + frame * 4, 180)], 1 / 60);
    }

    vi.mocked(ctx.stroke).mockClear();
    vi.mocked(ctx.createLinearGradient).mockClear();
    renderer.render(ctx, PARAMS, [tip(264, 180)], 1 / 60);

    // The broad underpaint and the two true boundaries are the only strokes.
    // A fourth stroke would put an independent line back inside the fabric.
    expect(ctx.stroke).toHaveBeenCalledTimes(3);
    expect(ctx.createLinearGradient).not.toHaveBeenCalled();
  });

  it("lets a missing prop fade away instead of leaving a permanent ribbon", () => {
    const renderer = new Silk2DRenderer();
    const ctx = makeContext();

    for (let frame = 0; frame < 24; frame++) {
      renderer.render(ctx, PARAMS, [tip(100 + frame * 4, 180)], 1 / 60);
    }

    vi.mocked(ctx.fill).mockClear();
    renderer.render(ctx, PARAMS, [], 0.1);
    expect(vi.mocked(ctx.fill).mock.calls.length).toBeGreaterThan(0);

    for (let frame = 0; frame < 24; frame++)
      renderer.render(ctx, PARAMS, [], 0.1);
    vi.mocked(ctx.fill).mockClear();
    renderer.render(ctx, PARAMS, [], 0.1);
    expect(vi.mocked(ctx.fill)).not.toHaveBeenCalled();
  });
});

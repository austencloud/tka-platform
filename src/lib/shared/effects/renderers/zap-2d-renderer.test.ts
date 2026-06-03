import { describe, it, expect, vi } from "vitest";
import { Zap2DRenderer } from "./zap-2d-renderer";
import type { Zap2DParams } from "../translators/canvas2d-types";

function makeCtx(): CanvasRenderingContext2D {
  return {
    globalCompositeOperation: "source-over",
    shadowBlur: 0,
    shadowColor: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
  } as unknown as CanvasRenderingContext2D;
}

function makeParams(overrides: Partial<Zap2DParams> = {}): Zap2DParams {
  return {
    intensity: 0.7,
    leftColor: "#88ccff",
    rightColor: "#88ccff",
    frequency: 12,
    mode: "arc",
    branching: 0.3,
    segments: 8,
    jitterAmount: 10,
    glowBlur: 12,
    lineWidth: 2,
    ...overrides,
  };
}

describe("Zap2DRenderer.frequency", () => {
  it("regenerates more often at high frequency than low", () => {
    const r = new Zap2DRenderer();
    const ctx = makeCtx();
    const tips = {
      bluePosA: { x: 0, y: 0 },
      bluePosB: null,
      redPosA: { x: 100, y: 0 },
      redPosB: null,
    };

    // At freq=30 → regen every 60/30=2 frames; over 10 frames = 5 regens
    const high = makeParams({ frequency: 30 });
    let highRegens = 0;
    const origGen = (r as any).generatePath.bind(r);
    (r as any).generatePath = (...a: unknown[]) => { highRegens++; return origGen(...a); };
    for (let i = 0; i < 10; i++) r.render(ctx, high, tips);

    // At freq=1 → regen every 60/1=60 frames; over 10 frames = 0 regens (after first frame)
    const r2 = new Zap2DRenderer();
    const low = makeParams({ frequency: 1 });
    let lowRegens = 0;
    const origGen2 = (r2 as any).generatePath.bind(r2);
    (r2 as any).generatePath = (...a: unknown[]) => { lowRegens++; return origGen2(...a); };
    for (let i = 0; i < 10; i++) r2.render(ctx, low, tips);

    expect(highRegens).toBeGreaterThan(lowRegens);
  });
});

describe("Zap2DRenderer - scale contract", () => {
  function mockCtx() {
    const lineWidths: number[] = [];
    let _lineWidth = 1;
    let _shadowBlur = 0;
    // Build the object without lineWidth/shadowBlur so defineProperty works cleanly.
    const ctx = Object.defineProperties(
      {
        globalCompositeOperation: "source-over",
        shadowColor: "",
        strokeStyle: "",
        globalAlpha: 1,
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      } as unknown as CanvasRenderingContext2D,
      {
        lineWidth: {
          get() { return _lineWidth; },
          set(v: number) { _lineWidth = v; lineWidths.push(v); },
          enumerable: true,
          configurable: true,
        },
        shadowBlur: {
          get() { return _shadowBlur; },
          set(v: number) { _shadowBlur = v; },
          enumerable: true,
          configurable: true,
        },
      },
    );
    return { ctx, lineWidths };
  }

  it("scale=1 produces same lineWidth as unscaled render", () => {
    const tips = { bluePosA: { x: 0, y: 0 }, bluePosB: null, redPosA: { x: 100, y: 0 }, redPosB: null };
    const params = makeParams({ frequency: 60 });

    const { ctx: ctx1, lineWidths: widths1 } = mockCtx();
    const r1 = new Zap2DRenderer();
    r1.render(ctx1, params, tips, 1);

    const { ctx: ctx2, lineWidths: widths2 } = mockCtx();
    const r2 = new Zap2DRenderer();
    r2.render(ctx2, params, tips);

    expect(widths1).toEqual(widths2);
  });

  it("scale=2 doubles lineWidth values (glow and core passes)", () => {
    const tips = { bluePosA: { x: 0, y: 0 }, bluePosB: null, redPosA: { x: 100, y: 0 }, redPosB: null };
    const params = makeParams({ frequency: 60, lineWidth: 2 });

    const { ctx: ctx1, lineWidths: widths1 } = mockCtx();
    const r1 = new Zap2DRenderer();
    r1.render(ctx1, params, tips, 1);

    const { ctx: ctx2, lineWidths: widths2 } = mockCtx();
    const r2 = new Zap2DRenderer();
    r2.render(ctx2, params, tips, 2);

    // drawArc sets lineWidth twice per arc (glow pass: lineWidth*2*scale, core pass: lineWidth*scale).
    // The finally-block restore also writes prevLineWidth=1 unconditionally - exclude it by taking
    // only the per-draw-call assignments (all but the last restore write).
    const drawn1 = widths1.slice(0, -1);
    const drawn2 = widths2.slice(0, -1);
    expect(drawn1.length).toBeGreaterThan(0);
    expect(drawn1.length).toBe(drawn2.length);
    drawn1.forEach((w, i) => {
      expect(drawn2[i]).toBeCloseTo(w * 2);
    });
  });

  it("crackle spoke length scales with scale factor", () => {
    // At scale=2 the endpoint distance should roughly double (jitter aside).
    // We verify by checking that paths in crackle mode extend further at scale=2.
    const tips = { bluePosA: { x: 200, y: 200 }, bluePosB: null, redPosA: null, redPosB: null };
    const params = makeParams({ mode: "crackle", frequency: 60, intensity: 0, jitterAmount: 0 });

    const r1 = new Zap2DRenderer();
    const ctx1 = makeCtx();
    r1.render(ctx1, params, tips, 1);
    const arcs1: Array<{ x: number; y: number }>[] = (r1 as any).cachedArcs.map((a: any) => a.path);

    const r2 = new Zap2DRenderer();
    const ctx2 = makeCtx();
    r2.render(ctx2, params, tips, 2);
    const arcs2: Array<{ x: number; y: number }>[] = (r2 as any).cachedArcs.map((a: any) => a.path);

    // Last point of each arc should be further from origin at scale=2
    const origin = { x: 200, y: 200 };
    const dist = (p: { x: number; y: number }) =>
      Math.hypot(p.x - origin.x, p.y - origin.y);

    const maxDist1 = Math.max(...arcs1.map(p => dist(p[p.length - 1]!)));
    const maxDist2 = Math.max(...arcs2.map(p => dist(p[p.length - 1]!)));
    expect(maxDist2).toBeGreaterThan(maxDist1);
  });
});

describe("Zap2DRenderer - per-hand color", () => {
  it("uses leftColor for blue-origin crackle spokes and rightColor for red-origin", () => {
    const r = new Zap2DRenderer();
    const styles: string[] = [];
    const ctx = makeCtx();
    Object.defineProperty(ctx, "strokeStyle", {
      get() { return ""; },
      set(v: string) { styles.push(v); },
    });

    const params = makeParams({
      mode: "crackle",
      leftColor: "#ff0000",
      rightColor: "#0000ff",
      frequency: 60, // regenerate every frame
    });
    const tips = {
      bluePosA: { x: 0, y: 0 },
      bluePosB: null,
      redPosA: { x: 100, y: 0 },
      redPosB: null,
    };

    r.render(ctx, params, tips);

    // Glow + core passes per spoke; we assert both hand colors appear.
    expect(styles.some(s => s === "#ff0000")).toBe(true);
    expect(styles.some(s => s === "#0000ff")).toBe(true);
  });
});

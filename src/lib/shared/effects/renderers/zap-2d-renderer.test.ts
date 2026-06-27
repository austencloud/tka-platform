import { describe, it, expect, vi } from "vitest";
import { Zap2DRenderer } from "./zap-2d-renderer";
import type { Zap2DParams } from "../translators/canvas2d-types";
import type { EmitterTip } from "./emitter-tip";

function makeCtx() {
  const calls = { stroke: 0, fill: 0, quad: 0, arc: 0, fillRect: 0, linearGrad: 0, radialGrad: 0 };
  const strokeStyles: unknown[] = [];
  const lineWidths: number[] = [];
  const quadPoints: { x: number; y: number }[] = [];
  let _stroke: unknown = "";
  let _lineWidth = 1;

  const grad = () => ({ addColorStop: vi.fn() });
  const ctx: any = {
    globalCompositeOperation: "source-over",
    shadowBlur: 0,
    shadowColor: "",
    globalAlpha: 1,
    fillStyle: "",
    lineCap: "butt",
    lineJoin: "miter",
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn((cx: number, cy: number) => { calls.quad++; quadPoints.push({ x: cx, y: cy }); }),
    arc: vi.fn(() => { calls.arc++; }),
    fill: vi.fn(() => { calls.fill++; }),
    fillRect: vi.fn(() => { calls.fillRect++; }),
    stroke: vi.fn(() => { calls.stroke++; }),
    createLinearGradient: vi.fn(() => { calls.linearGrad++; return grad(); }),
    createRadialGradient: vi.fn(() => { calls.radialGrad++; return grad(); }),
  };
  Object.defineProperties(ctx, {
    strokeStyle: {
      get() { return _stroke; },
      set(v) { _stroke = v; strokeStyles.push(v); },
      configurable: true, enumerable: true,
    },
    lineWidth: {
      get() { return _lineWidth; },
      set(v: number) { _lineWidth = v; lineWidths.push(v); },
      configurable: true, enumerable: true,
    },
  });
  return { ctx: ctx as CanvasRenderingContext2D, calls, strokeStyles, lineWidths, quadPoints };
}

function makeParams(overrides: Partial<Zap2DParams> = {}): Zap2DParams {
  return {
    intensity: 1,
    leftColor: "#88ccff",
    rightColor: "#88ccff",
    frequency: 60, // regen every frame → always in strike window (no flicker variance)
    mode: "arc",
    branching: 0,
    style: "branching",
    wobbleRate: 0.18,
    wobbleAmount: 0.5,
    glow: 0.5,
    jitter: 0.5,
    segments: 8,
    jitterAmount: 10,
    glowBlur: 12,
    lineWidth: 2,
    ...overrides,
  };
}

type Pt = { x: number; y: number };
function emit(p: Pt, propIndex: number, tipIndex: number, color = "#88ccff"): EmitterTip {
  return { ...p, propIndex, tipIndex, end: tipIndex === 0 ? "A" : "B", color };
}

/** One base circuit: blue end-A ↔ red end-A. */
const pair = (): EmitterTip[] => [
  emit({ x: 100, y: 100 }, 0, 0),
  emit({ x: 300, y: 100 }, 1, 0),
];

describe("Zap2DRenderer", () => {
  it("draws nothing when there are no emitters", () => {
    const r = new Zap2DRenderer();
    const { ctx, calls } = makeCtx();
    r.render(ctx, makeParams(), []);
    expect(calls.stroke).toBe(0);
  });

  describe("branching (storm)", () => {
    it("strokes a bolt between a present blue↔red pair", () => {
      const r = new Zap2DRenderer();
      const { ctx, calls } = makeCtx();
      r.render(ctx, makeParams({ branching: 0 }), pair());
      // One bolt = glow + core = 2 strokes (no branches at branching 0, static).
      expect(calls.stroke).toBe(2);
    });

    it("draws a bolt per tunnel layer family (propIndex >= 2)", () => {
      const r = new Zap2DRenderer();
      const { ctx, calls } = makeCtx();
      // Base pair (blue 0 ↔ red 1) + layer pair (blue 2 ↔ red 3) → 2 bolts.
      r.render(ctx, makeParams({ branching: 0 }), [
        ...pair(),
        emit({ x: 120, y: 300 }, 2, 0),
        emit({ x: 320, y: 300 }, 3, 0),
      ]);
      // 2 bolts × (glow + core) = 4 strokes.
      expect(calls.stroke).toBe(4);
    });

    it("uses a left→right gradient when the two hand colors differ", () => {
      const r = new Zap2DRenderer();
      const { ctx, calls } = makeCtx();
      r.render(ctx, makeParams({ leftColor: "#ff0000", rightColor: "#0000ff" }), pair());
      expect(calls.linearGrad).toBeGreaterThan(0);
    });

    it("reacts to motion: a moving pair draws more than a static pair (energy → strikes + forks)", () => {
      const r = new Zap2DRenderer();
      const params = makeParams({ branching: 0 });

      // Frame 1 establishes prevTip (no velocity yet).
      const f1 = makeCtx();
      r.render(f1.ctx, params, pair());

      // Frame 2: move both endpoints far → high energy.
      const f2 = makeCtx();
      r.render(f2.ctx, params, [
        emit({ x: 140, y: 100 }, 0, 0),
        emit({ x: 260, y: 100 }, 1, 0),
      ]);
      expect(f2.calls.stroke).toBeGreaterThan(f1.calls.stroke);
    });
  });

  describe("plasma", () => {
    it("draws quadratic conduits and sheds sparks", () => {
      const r = new Zap2DRenderer();
      const { ctx, calls } = makeCtx();
      r.render(ctx, makeParams({ style: "plasma" }), pair());
      expect(calls.quad).toBeGreaterThan(0); // wobbling conduits
      expect(calls.fill).toBeGreaterThan(0); // sputter sparks
    });

    it("wobble is temporally coherent: rate controls travel, no per-frame strobe", () => {
      // Total path the layer-0 conduit control point travels over N frames of a
      // STATIC pair (energy 0 → fixed amplitude; only the sine phase advances).
      // The old hardcoded per-frame random had NO rate control and teleported
      // the point every frame; a smooth oscillation must travel farther at high
      // rate than low, and stay calm at low rate.
      const travel = (wobbleRate: number) => {
        const r = new Zap2DRenderer();
        const params = makeParams({ style: "plasma", wobbleAmount: 1, jitter: 0, wobbleRate });
        const pts: { x: number; y: number }[] = [];
        for (let f = 0; f < 20; f++) {
          const { ctx, quadPoints } = makeCtx();
          r.render(ctx, params, pair()); // same positions each frame → energy 0
          pts.push(quadPoints[0]!); // first quad = layer-0 conduit control point
        }
        let total = 0;
        for (let i = 1; i < pts.length; i++) {
          total += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
        }
        return total;
      };
      const slow = travel(0.05);
      const fast = travel(1.0);
      expect(fast).toBeGreaterThan(slow * 2); // rate genuinely controls speed
    });
  });

  describe("web", () => {
    it("connects every tip pair and uses violet for cross-prop edges", () => {
      const r = new Zap2DRenderer();
      const { ctx, calls, strokeStyles } = makeCtx();
      const allTips: EmitterTip[] = [
        emit({ x: 100, y: 100 }, 0, 0),
        emit({ x: 150, y: 200 }, 0, 1),
        emit({ x: 300, y: 120 }, 1, 0),
        emit({ x: 280, y: 220 }, 1, 1),
      ];
      r.render(ctx, makeParams({ style: "web" }), allTips);
      // 4 tips → 6 edges, each glow+core = lots of strokes.
      expect(calls.stroke).toBeGreaterThanOrEqual(12);
      expect(strokeStyles).toContain("#9d7bff"); // cross-prop edge color
    });
  });

  describe("scale contract", () => {
    it("scale=2 doubles the stroke line widths", () => {
      const params = makeParams({ branching: 0 });

      const a = makeCtx();
      new Zap2DRenderer().render(a.ctx, params, pair(), 1);
      const b = makeCtx();
      new Zap2DRenderer().render(b.ctx, params, pair(), 2);

      // strokeBolt sets glow (width*2*scale) then core (width*scale) widths.
      const aw = a.lineWidths.filter((w) => w > 0);
      const bw = b.lineWidths.filter((w) => w > 0);
      expect(aw.length).toBe(bw.length);
      aw.forEach((w, i) => expect(bw[i]).toBeCloseTo(w * 2));
    });
  });

  it("dispose resets state without throwing", () => {
    const r = new Zap2DRenderer();
    const { ctx } = makeCtx();
    r.render(ctx, makeParams(), pair());
    expect(() => r.dispose()).not.toThrow();
  });
});

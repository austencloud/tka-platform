import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Bloom2DRenderer, type BloomTipInput } from "./Bloom2DRenderer";
import type { Bloom2DParams } from "../translators/canvas2d-types";

interface GradientStop {
  offset: number;
  color: string;
}

interface FakeGradient {
  stops: GradientStop[];
  addColorStop: (offset: number, color: string) => void;
}

function makeGradient(): FakeGradient {
  const stops: GradientStop[] = [];
  return {
    stops,
    addColorStop(offset: number, color: string) {
      stops.push({ offset, color });
    },
  };
}

function makeCtx() {
  const gradients: FakeGradient[] = [];
  const fillRects: Array<{ x: number; y: number; w: number; h: number; fill: unknown }> = [];
   
  const ctx: any = {
    globalCompositeOperation: "source-over",
    globalAlpha: 1,
    fillStyle: "",
    save: vi.fn(),
    restore: vi.fn(),
    clearRect: vi.fn(),
    createRadialGradient: vi.fn(() => {
      const g = makeGradient();
      gradients.push(g);
      return g;
    }),
    fillRect: vi.fn(function (this: any, x: number, y: number, w: number, h: number) {
      fillRects.push({ x, y, w, h, fill: this.fillStyle });
    }),
  };
  // fillRect's `this` isn't bound via the function; patch it to capture the
  // live ctx.fillStyle when called.
  ctx.fillRect = vi.fn((x: number, y: number, w: number, h: number) => {
    fillRects.push({ x, y, w, h, fill: ctx.fillStyle });
  });
  return { ctx: ctx as CanvasRenderingContext2D, gradients, fillRects };
}

function makeParams(overrides: Partial<Bloom2DParams> = {}): Bloom2DParams {
  return {
    intensity: 0.8,
    radius: 28,
    color: "#f472b6",
    palette: ["#f472b6", "#fbbf24", "#22d3ee"],
    colorMode: "solid",
    falloff: "smooth",
    pulse: 0,
    pulseRate: 1,
    blendMode: "lighter",
    ...overrides,
  };
}

function makeTip(overrides: Partial<BloomTipInput> = {}): BloomTipInput {
  return {
    x: 100,
    y: 150,
    propIndex: 0,
    tipIndex: 0,
    blueColor: "#3b82f6",
    redColor: "#ef4444",
    ...overrides,
  };
}

describe("Bloom2DRenderer", () => {
  let nowSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    nowSpy = vi.spyOn(performance, "now").mockReturnValue(0);
  });
  afterEach(() => {
    nowSpy.mockRestore();
  });

  it("does not draw when tips array is empty", () => {
    const r = new Bloom2DRenderer();
    const { ctx, fillRects } = makeCtx();
    r.render(ctx, makeParams(), []);
    expect(fillRects).toHaveLength(0);
  });

  it("draws one additive radial gradient per tip", () => {
    const r = new Bloom2DRenderer();
    const { ctx, gradients, fillRects } = makeCtx();
    r.render(ctx, makeParams(), [makeTip(), makeTip({ x: 50, y: 50, tipIndex: 1 })]);
    expect(gradients).toHaveLength(2);
    expect(fillRects).toHaveLength(2);
    // Square around the tip, side = 2*radius
    expect(fillRects[0]!.w).toBe(56);
    expect(fillRects[0]!.h).toBe(56);
  });

  describe("pulse math", () => {
    it("pulse=0 yields pulseFactor=1 regardless of time", () => {
      const r = new Bloom2DRenderer();
      const { ctx, gradients } = makeCtx();
      nowSpy.mockReturnValue(1234);
      r.render(ctx, makeParams({ pulse: 0, intensity: 1 }), [makeTip()]);
      // Center stop should carry full alpha=1.
      const centerStop = gradients[0]!.stops[0]!;
      expect(centerStop.offset).toBe(0);
      expect(centerStop.color).toContain("1)"); // rgba(..., 1)
    });

    it("pulse=1 at t=0 yields pulseFactor=0.5 (sin(0)=0 → 0.5+0.5*0)", () => {
      const r = new Bloom2DRenderer();
      const { ctx, gradients } = makeCtx();
      nowSpy.mockReturnValue(0);
      r.render(ctx, makeParams({ pulse: 1, intensity: 1, pulseRate: 1 }), [makeTip()]);
      const centerStop = gradients[0]!.stops[0]!;
      // pulseFactor = 1 - 1 + 1*(0.5 + 0.5*sin(0)) = 0.5
      expect(centerStop.color).toContain("0.5)");
    });

    it("pulse=1 at quarter period peaks at pulseFactor=1 (sin(π/2)=1 → 0.5+0.5 = 1)", () => {
      const r = new Bloom2DRenderer();
      const { ctx, gradients } = makeCtx();
      // t * pulseRate * 2π = π/2 → t = 0.25 / pulseRate = 0.25s @ 1Hz → 250ms
      nowSpy.mockReturnValue(250);
      r.render(ctx, makeParams({ pulse: 1, intensity: 1, pulseRate: 1 }), [makeTip()]);
      const centerStop = gradients[0]!.stops[0]!;
      expect(centerStop.color).toContain("1)");
    });
  });

  describe("falloff strategies", () => {
    it("smooth gradient has 3 stops at 0, 0.4, 1", () => {
      const r = new Bloom2DRenderer();
      const { ctx, gradients } = makeCtx();
      r.render(ctx, makeParams({ falloff: "smooth" }), [makeTip()]);
      const stops = gradients[0]!.stops;
      expect(stops.map((s) => s.offset)).toEqual([0, 0.4, 1]);
    });

    it("sharp gradient has 4 stops at 0, 0.15, 0.6, 1", () => {
      const r = new Bloom2DRenderer();
      const { ctx, gradients } = makeCtx();
      r.render(ctx, makeParams({ falloff: "sharp" }), [makeTip()]);
      const stops = gradients[0]!.stops;
      expect(stops.map((s) => s.offset)).toEqual([0, 0.15, 0.6, 1]);
    });

    it("ring gradient has 5 stops and starts transparent", () => {
      const r = new Bloom2DRenderer();
      const { ctx, gradients } = makeCtx();
      r.render(ctx, makeParams({ falloff: "ring" }), [makeTip()]);
      const stops = gradients[0]!.stops;
      expect(stops.map((s) => s.offset)).toEqual([0, 0.45, 0.7, 0.9, 1]);
      expect(stops[0]!.color).toContain("0)");
    });
  });

  describe("color modes", () => {
    it("solid uses params.color at center stop", () => {
      const r = new Bloom2DRenderer();
      const { ctx, gradients } = makeCtx();
      r.render(ctx, makeParams({ colorMode: "solid", color: "#ff0000" }), [makeTip()]);
      const center = gradients[0]!.stops[0]!;
      expect(center.color.toLowerCase()).toContain("255, 0, 0");
    });

    it("prop-matched picks blueColor for propIndex=0, redColor for propIndex=1", () => {
      const r = new Bloom2DRenderer();
      const { ctx, gradients } = makeCtx();
      r.render(ctx, makeParams({ colorMode: "prop-matched" }), [
        makeTip({ propIndex: 0, blueColor: "#0000ff", redColor: "#ff0000" }),
        makeTip({ propIndex: 1, blueColor: "#0000ff", redColor: "#ff0000", x: 50 }),
      ]);
      expect(gradients[0]!.stops[0]!.color.toLowerCase()).toContain("0, 0, 255");
      expect(gradients[1]!.stops[0]!.color.toLowerCase()).toContain("255, 0, 0");
    });

    it("palette cycles by tipIndex modulo palette length", () => {
      const r = new Bloom2DRenderer();
      const { ctx, gradients } = makeCtx();
      const palette = ["#ff0000", "#00ff00", "#0000ff"];
      r.render(ctx, makeParams({ colorMode: "palette", palette }), [
        makeTip({ tipIndex: 0 }),
        makeTip({ tipIndex: 1, x: 50 }),
        makeTip({ tipIndex: 2, x: 150 }),
        makeTip({ tipIndex: 3, x: 200 }), // wraps → palette[0]
      ]);
      expect(gradients[0]!.stops[0]!.color.toLowerCase()).toContain("255, 0, 0");
      expect(gradients[1]!.stops[0]!.color.toLowerCase()).toContain("0, 255, 0");
      expect(gradients[2]!.stops[0]!.color.toLowerCase()).toContain("0, 0, 255");
      expect(gradients[3]!.stops[0]!.color.toLowerCase()).toContain("255, 0, 0");
    });

    it("rainbow produces hsla(...) output advancing with time", () => {
      const r = new Bloom2DRenderer();
      const { ctx, gradients } = makeCtx();
      nowSpy.mockReturnValue(0);
      r.render(ctx, makeParams({ colorMode: "rainbow" }), [makeTip()]);
      expect(gradients[0]!.stops[0]!.color.toLowerCase()).toContain("hsla");
    });
  });

  it("sets globalCompositeOperation to 'lighter' by default then restores", () => {
    const r = new Bloom2DRenderer();
    const { ctx } = makeCtx();
    r.render(ctx, makeParams(), [makeTip()]);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  describe("scale parameter", () => {
    it("accepts scale argument without throwing", () => {
      const r = new Bloom2DRenderer();
      const { ctx } = makeCtx();
      expect(() => r.render(ctx, makeParams(), [makeTip()], 0.5)).not.toThrow();
    });

    it("fillRect w/h = radius*scale*2 when scale=0.5 and radius=100", () => {
      const r = new Bloom2DRenderer();
      const { ctx, fillRects } = makeCtx();
      r.render(ctx, makeParams({ radius: 100 }), [makeTip()], 0.5);
      // r = 100 * 0.5 = 50; side = r*2 = 100
      expect(fillRects[0]!.w).toBe(100);
      expect(fillRects[0]!.h).toBe(100);
    });
  });
});

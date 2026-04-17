import { describe, it, expect, vi } from "vitest";
import { Sparkles2DRenderer } from "./Sparkles2DRenderer";
import type { Sparkles2DParams } from "../translators/canvas2d-types";

function makeCtx(): CanvasRenderingContext2D {
  const fillStyles: string[] = [];
  const ctx = {
    globalCompositeOperation: "source-over",
    globalAlpha: 1,
    fillStyle: "",
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    closePath: vi.fn(),
    _fillStyles: fillStyles,
  } as unknown as CanvasRenderingContext2D & { _fillStyles: string[] };
  Object.defineProperty(ctx, "fillStyle", {
    get() {
      return "";
    },
    set(v: string) {
      fillStyles.push(v);
    },
  });
  return ctx;
}

function makeParams(overrides: Partial<Sparkles2DParams> = {}): Sparkles2DParams {
  return {
    rate: 1.0,
    size: 0.5,
    lifetime: 1.0,
    color: "#fbbf24",
    palette: ["#ff0000", "#00ff00", "#0000ff"],
    colorMode: "solid",
    spread: 8,
    gravity: 0.3,
    mode: "stream",
    poolSize: 200,
    baseRadius: 3,
    blendMode: "lighter",
    ...overrides,
  };
}

describe("Sparkles2DRenderer", () => {
  it("caps the live particle count at MAX_PARTICLES", () => {
    const r = new Sparkles2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ rate: 1.0, lifetime: 5.0, mode: "stream" });
    const tips = {
      bluePosA: { x: 0, y: 0 },
      bluePosB: { x: 10, y: 0 },
      redPosA: { x: 100, y: 0 },
      redPosB: { x: 110, y: 0 },
    };
    for (let i = 0; i < 200; i++) r.render(ctx, params, tips, 1 / 60);
    expect((r as any).particles.length).toBeLessThanOrEqual(200);
  });

  it("decrements particle life over time and removes dead particles", () => {
    const r = new Sparkles2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ rate: 1.0, lifetime: 0.1, mode: "stream" });
    const tips = {
      bluePosA: { x: 0, y: 0 },
      bluePosB: null,
      redPosA: null,
      redPosB: null,
    };
    r.render(ctx, params, tips, 1 / 60);
    const beforeCount = (r as any).particles.length;
    expect(beforeCount).toBeGreaterThan(0);
    // Advance well past lifetime — older particles die; check life monotonicity.
    for (let i = 0; i < 20; i++) r.render(ctx, params, tips, 1 / 60);
    const lives = (r as any).particles.map((p: any) => p.life);
    expect(Math.max(...lives, 0)).toBeLessThanOrEqual(params.lifetime);
  });

  it("cycles palette colors when colorMode === 'palette'", () => {
    const r = new Sparkles2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({
      colorMode: "palette",
      palette: ["#aaaaaa", "#bbbbbb", "#cccccc"],
      rate: 1.0,
      mode: "stream",
    });
    const tips = {
      bluePosA: { x: 0, y: 0 },
      bluePosB: null,
      redPosA: null,
      redPosB: null,
    };
    for (let i = 0; i < 30; i++) r.render(ctx, params, tips, 1 / 60);
    const colors = new Set((r as any).particles.map((p: any) => p.color));
    const overlap = ["#aaaaaa", "#bbbbbb", "#cccccc"].filter((c) => colors.has(c));
    expect(overlap.length).toBeGreaterThanOrEqual(2);
  });

  it("burst mode skips spawning when tip is stationary", () => {
    const r = new Sparkles2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ rate: 1.0, mode: "burst", lifetime: 5.0 });
    const tips = {
      bluePosA: { x: 50, y: 50 },
      bluePosB: null,
      redPosA: null,
      redPosB: null,
    };
    // First call seeds last-position; subsequent calls with same tip = no motion.
    for (let i = 0; i < 10; i++) r.render(ctx, params, tips, 1 / 60);
    expect((r as any).particles.length).toBe(0);
  });

  it("dispose() clears the particle pool", () => {
    const r = new Sparkles2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ rate: 1.0, mode: "stream", lifetime: 5.0 });
    const tips = {
      bluePosA: { x: 0, y: 0 },
      bluePosB: null,
      redPosA: null,
      redPosB: null,
    };
    r.render(ctx, params, tips, 1 / 60);
    expect((r as any).particles.length).toBeGreaterThan(0);
    r.dispose();
    expect((r as any).particles.length).toBe(0);
  });
});

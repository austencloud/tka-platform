import { describe, it, expect, vi } from "vitest";
import { Zap2DRenderer } from "./Zap2DRenderer";
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
    (r as any).generatePath = (...a: any[]) => { highRegens++; return origGen(...a); };
    for (let i = 0; i < 10; i++) r.render(ctx, high, tips);

    // At freq=1 → regen every 60/1=60 frames; over 10 frames = 0 regens (after first frame)
    const r2 = new Zap2DRenderer();
    const low = makeParams({ frequency: 1 });
    let lowRegens = 0;
    const origGen2 = (r2 as any).generatePath.bind(r2);
    (r2 as any).generatePath = (...a: any[]) => { lowRegens++; return origGen2(...a); };
    for (let i = 0; i < 10; i++) r2.render(ctx, low, tips);

    expect(highRegens).toBeGreaterThan(lowRegens);
  });
});

describe("Zap2DRenderer — per-hand color", () => {
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

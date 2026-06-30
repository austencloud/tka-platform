import { describe, it, expect, vi } from "vitest";
import { Ghost2DRenderer, type GhostInput, type GhostProp } from "./ghost-2d-renderer";
import type { Ghost2DParams } from "../translators/canvas2d-types";

const IMG = { complete: true } as unknown as CanvasImageSource;

function makeCtx() {
  const drawAlphas: number[] = [];
  let a = 1;
  const ctx = {
    canvas: { width: 400, height: 400 },
    get globalAlpha() { return a; },
    set globalAlpha(v: number) { a = v; },
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    // Record the alpha in effect at the moment each ghost is blitted.
    drawImage: vi.fn(() => { drawAlphas.push(a); }),
  } as unknown as CanvasRenderingContext2D & { __drawAlphas: number[] };
  (ctx as unknown as { __drawAlphas: number[] }).__drawAlphas = drawAlphas;
  return ctx;
}

function makeParams(overrides: Partial<Ghost2DParams> = {}): Ghost2DParams {
  return { intensity: 1, decay: 8, interval: 0.5, ...overrides };
}

function prop(overrides: Partial<GhostProp> = {}): GhostProp {
  return { id: 0, image: IMG, centerX: 100, centerY: 100, angle: 0, width: 40, height: 200, flipped: false, ...overrides };
}

function input(props: GhostProp[], epoch: string | number = "seq-a", currentStep = 0): GhostInput {
  return { props, currentStep, epoch };
}

const draws = (ctx: CanvasRenderingContext2D) =>
  (ctx.drawImage as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
const drawAlphasOf = (ctx: CanvasRenderingContext2D) => (ctx as unknown as { __drawAlphas: number[] }).__drawAlphas;

describe("Ghost2DRenderer — prop onion-skin", () => {
  it("ghosts the prop sprite (clears + blits)", () => {
    const r = new Ghost2DRenderer();
    const ctx = makeCtx();
    r.render(ctx, makeParams(), input([prop()]), 0.016, 1);
    expect(ctx.clearRect).toHaveBeenCalled();
    expect(draws(ctx)).toBeGreaterThan(0);
  });

  it("dedups a stationary pose but adds a distinct one", () => {
    const r = new Ghost2DRenderer();
    const ctx = makeCtx();
    r.render(ctx, makeParams(), input([prop({ centerX: 100 })]), 0.016, 1);
    (ctx.drawImage as ReturnType<typeof vi.fn>).mockClear();

    // Same pose again → still a single ghost.
    r.render(ctx, makeParams(), input([prop({ centerX: 100 })]), 0.016, 1);
    expect(draws(ctx)).toBe(1);

    // A far pose adds a second distinct ghost (both still within the tail).
    (ctx.drawImage as ReturnType<typeof vi.fn>).mockClear();
    r.render(ctx, makeParams(), input([prop({ centerX: 320 })]), 0.016, 1);
    expect(draws(ctx)).toBe(2);
  });

  it("keeps blue and red ghosts distinct (per-id keying)", () => {
    const r = new Ghost2DRenderer();
    const ctx = makeCtx();
    // Same position, different id → two ghosts, not one.
    r.render(ctx, makeParams(), input([prop({ id: 0 }), prop({ id: 1 })]), 0.016, 1);
    expect(draws(ctx)).toBe(2);
  });

  it("fades a ghost out completely once past the persistence window", () => {
    const r = new Ghost2DRenderer();
    const ctx = makeCtx();
    r.render(ctx, makeParams({ decay: 8 }), input([prop()]), 0.016, 1);
    (ctx.drawImage as ReturnType<typeof vi.fn>).mockClear();

    // Advance well past tailSec (0.2 + 8*0.18 = 1.64s) with nothing to capture.
    r.render(ctx, makeParams({ decay: 8 }), input([]), 3, 1);
    expect(draws(ctx)).toBe(0);
  });

  it("wipes the exposure when the sequence epoch changes", () => {
    const r = new Ghost2DRenderer();
    const ctx = makeCtx();
    r.render(ctx, makeParams(), input([prop({ centerX: 100 }), prop({ centerX: 320 })], "seq-a"), 0.016, 1);
    (ctx.drawImage as ReturnType<typeof vi.fn>).mockClear();

    // New epoch → old ghosts gone; only the freshly captured one draws.
    r.render(ctx, makeParams(), input([prop({ centerX: 200 })], "seq-b"), 0.016, 1);
    expect(draws(ctx)).toBe(1);
  });

  it("scales the freshest ghost's alpha by intensity", () => {
    const full = makeCtx();
    new Ghost2DRenderer().render(full, makeParams({ intensity: 1 }), input([prop()]), 0.016, 1);
    const half = makeCtx();
    new Ghost2DRenderer().render(half, makeParams({ intensity: 0.5 }), input([prop()]), 0.016, 1);

    const peakFull = Math.max(...drawAlphasOf(full));
    const peakHalf = Math.max(...drawAlphasOf(half));
    expect(peakFull).toBeCloseTo(0.85, 2); // 0.85 * intensity, fresh ghost (age ~0)
    expect(peakHalf).toBeCloseTo(0.425, 2);
  });

  it("denser Density (higher interval) yields more ghosts over a sweep", () => {
    function ghostsAfterSweep(density: number): number {
      const r = new Ghost2DRenderer();
      const ctx = makeCtx();
      // Sweep the angle across a quarter turn in small steps within the tail.
      for (let i = 0; i < 20; i++) {
        r.render(ctx, makeParams({ interval: density }), input([prop({ angle: i * 0.05 })]), 0.01, 1);
      }
      (ctx.drawImage as ReturnType<typeof vi.fn>).mockClear();
      // One more frame redraws the whole live trail; count the blits.
      r.render(ctx, makeParams({ interval: density }), input([prop({ angle: 20 * 0.05 })]), 0.01, 1);
      return draws(ctx);
    }
    expect(ghostsAfterSweep(0.9)).toBeGreaterThan(ghostsAfterSweep(0.1));
  });

  it("reset() clears all ghosts", () => {
    const r = new Ghost2DRenderer();
    const ctx = makeCtx();
    r.render(ctx, makeParams(), input([prop()]), 0.016, 1);
    r.reset();
    (ctx.drawImage as ReturnType<typeof vi.fn>).mockClear();
    r.render(ctx, makeParams(), input([]), 0.016, 1);
    expect(draws(ctx)).toBe(0);
  });
});

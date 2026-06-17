import { describe, it, expect } from "vitest";
import { Pulse2DRenderer, type PulseTipInput } from "./pulse-2d-renderer";
import { resolvePulse2D } from "../translators/canvas2d-translator";
import { DEFAULT_EFFECTS_CONFIG } from "../domain/defaults";
import type { PulseIntent } from "../domain/effects-config";
import type { Pulse2DParams } from "../translators/canvas2d-types";

/** Minimal CanvasRenderingContext2D stub that records the calls the renderer makes. */
class FakeCtx {
  points: { x: number; y: number }[] = [];
  strokeCount = 0;
  fillCount = 0;
  radialGradientCount = 0;
  shadowBlurSet = false;

  globalCompositeOperation = "source-over";
  globalAlpha = 1;
  lineWidth = 1;
  lineCap = "butt";
  strokeStyle: unknown = "#000";
  fillStyle: unknown = "#000";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set shadowBlur(_v: number) {
    this.shadowBlurSet = true;
  }

  save(): void {}
  restore(): void {}
  beginPath(): void {}
  moveTo(x: number, y: number): void {
    this.points.push({ x, y });
  }
  lineTo(x: number, y: number): void {
    this.points.push({ x, y });
  }
  arc(): void {}
  closePath(): void {}
  stroke(): void {
    this.strokeCount++;
  }
  fill(): void {
    this.fillCount++;
  }
  fillRect(): void {}
  clearRect(): void {}
  createRadialGradient() {
    this.radialGradientCount++;
    return { addColorStop() {} };
  }
  resetPath(): void {
    this.points = [];
  }
}

function params(overrides: Partial<PulseIntent> = {}): Pulse2DParams {
  const intent: PulseIntent = { ...DEFAULT_EFFECTS_CONFIG.pulse, ...overrides };
  return resolvePulse2D(intent);
}

function tip(x: number, y: number): PulseTipInput {
  return { x, y, propIndex: 0, tipIndex: 0, blueColor: "#3399ff", redColor: "#ff3366" };
}

const ctxOf = (c: FakeCtx) => c as unknown as CanvasRenderingContext2D;

/** Drive a tip from A to B over one frame, then hold so the spawned ring ages and draws. */
function spawnAndAge(
  r: Pulse2DRenderer,
  ctx: FakeCtx,
  p: Pulse2DParams,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  r.render(ctxOf(ctx), p, [tip(from.x, from.y)], 0, 0.1, 1); // establish prev position
  r.render(ctxOf(ctx), p, [tip(to.x, to.y)], 0, 0.1, 1); // motion → velocity spawn (age 0, not drawn)
  ctx.resetPath();
  r.render(ctxOf(ctx), p, [tip(to.x, to.y)], 0, 0.1, 1); // hold → ring ages and draws
}

function maxRadius(ctx: FakeCtx, origin: { x: number; y: number }): number {
  return ctx.points.reduce((m, pt) => Math.max(m, Math.hypot(pt.x - origin.x, pt.y - origin.y)), 0);
}
function radiusSpread(ctx: FakeCtx, origin: { x: number; y: number }): number {
  if (ctx.points.length === 0) return 0;
  const ds = ctx.points.map((pt) => Math.hypot(pt.x - origin.x, pt.y - origin.y));
  return Math.max(...ds) - Math.min(...ds);
}

describe("Pulse2DRenderer — pressure shockwave", () => {
  it("draws a ring once a spawned ring has aged", () => {
    const r = new Pulse2DRenderer();
    const ctx = new FakeCtx();
    const p = params({ trigger: "velocity", style: "stroke", asymmetry: 0, chromatic: 0, flash: 0, harmonics: 0 });
    spawnAndAge(r, ctx, p, { x: 100, y: 100 }, { x: 150, y: 100 });
    expect(ctx.strokeCount).toBeGreaterThan(0);
    expect(ctx.points.length).toBeGreaterThan(0);
  });

  it("never sets shadowBlur (per-segment shadow is the banned perf killer)", () => {
    const r = new Pulse2DRenderer();
    const ctx = new FakeCtx();
    const p = params({ trigger: "velocity", style: "glow", asymmetry: 0.9, chromatic: 0.6, flash: 0.9, harmonics: 0.5 });
    spawnAndAge(r, ctx, p, { x: 100, y: 100 }, { x: 160, y: 100 });
    expect(ctx.shadowBlurSet).toBe(false);
  });

  it("scales ring size with birth energy (fast swing > slow swing)", () => {
    const base = { trigger: "velocity" as const, style: "stroke" as const, asymmetry: 0, chromatic: 0, flash: 0, harmonics: 0, velocityScale: 0.6 };

    const fastCtx = new FakeCtx();
    spawnAndAge(new Pulse2DRenderer(), fastCtx, params(base), { x: 100, y: 100 }, { x: 150, y: 100 });
    const fastR = maxRadius(fastCtx, { x: 150, y: 100 });

    const slowCtx = new FakeCtx();
    spawnAndAge(new Pulse2DRenderer(), slowCtx, params(base), { x: 100, y: 100 }, { x: 103, y: 100 });
    const slowR = maxRadius(slowCtx, { x: 103, y: 100 });

    expect(fastR).toBeGreaterThan(slowR * 1.15);
  });

  it("deforms the ring directionally when asymmetry is high, stays circular at zero", () => {
    const deformCtx = new FakeCtx();
    spawnAndAge(
      new Pulse2DRenderer(),
      deformCtx,
      params({ trigger: "velocity", style: "stroke", asymmetry: 1, chromatic: 0, flash: 0, harmonics: 0 }),
      { x: 100, y: 100 },
      { x: 150, y: 100 },
    );
    const deformSpread = radiusSpread(deformCtx, { x: 150, y: 100 });

    const roundCtx = new FakeCtx();
    spawnAndAge(
      new Pulse2DRenderer(),
      roundCtx,
      params({ trigger: "velocity", style: "stroke", asymmetry: 0, chromatic: 0, flash: 0, harmonics: 0 }),
      { x: 100, y: 100 },
      { x: 150, y: 100 },
    );
    const roundSpread = radiusSpread(roundCtx, { x: 150, y: 100 });

    expect(deformSpread).toBeGreaterThan(8);
    expect(roundSpread).toBeLessThan(1);
  });

  it("emits a trailing overtone train when harmonics > 0", () => {
    const run = (harmonics: number) => {
      const r = new Pulse2DRenderer();
      const ctx = new FakeCtx();
      const p = params({ trigger: "continuous", style: "stroke", harmonics, asymmetry: 0, chromatic: 0, flash: 0 });
      // prime, then run frames so scheduled overtone rings get released + drawn
      let x = 100;
      for (let i = 0; i < 8; i++) {
        x += 12;
        r.render(ctxOf(ctx), p, [tip(x, 100)], i, 0.1, 1);
      }
      return ctx.strokeCount;
    };
    expect(run(1)).toBeGreaterThan(run(0));
  });
});

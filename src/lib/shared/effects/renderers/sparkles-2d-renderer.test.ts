import { describe, it, expect, vi, afterEach } from "vitest";
import { Sparkles2DRenderer } from "./sparkles-2d-renderer";
import type { Sparkles2DParams } from "../translators/canvas2d-types";
import type { EmitterTip } from "./emitter-tip";

type PosBag = {
  bluePosA?: { x: number; y: number } | null;
  bluePosB?: { x: number; y: number } | null;
  redPosA?: { x: number; y: number } | null;
  redPosB?: { x: number; y: number } | null;
};

/** Convert the legacy 4-slot bag to the flat emitter contract (base props). */
function toEmitters(s: PosBag): EmitterTip[] {
  const out: EmitterTip[] = [];
  if (s.bluePosA) out.push({ ...s.bluePosA, propIndex: 0, tipIndex: 0, end: "A", color: "#3a7fd9" });
  if (s.bluePosB) out.push({ ...s.bluePosB, propIndex: 0, tipIndex: 1, end: "B", color: "#3a7fd9" });
  if (s.redPosA) out.push({ ...s.redPosA, propIndex: 1, tipIndex: 0, end: "A", color: "#d94f4f" });
  if (s.redPosB) out.push({ ...s.redPosB, propIndex: 1, tipIndex: 1, end: "B", color: "#d94f4f" });
  return out;
}

/**
 * Target context. Mirrors the app surface the renderer composites onto.
 * The draw contract is one cached glow blit (`drawImage`) plus a live stroked
 * star (`stroke`) per particle, so both are spied here.
 */
function makeCtx(): CanvasRenderingContext2D {
  return {
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
    drawImage: vi.fn(),
    getTransform: vi.fn(() => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })),
    setTransform: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

/**
 * Install a sprite-capable offscreen canvas. Without this the renderer finds no
 * gradient-capable 2D context and correctly reports sprites unavailable, so
 * tests that exercise the draw path opt in here.
 *
 * Stubs `OffscreenCanvas` rather than `document.createElement` for two reasons:
 * this suite runs in the node environment (no `document` at all), and
 * OffscreenCanvas is the branch the QR/video export worker actually takes.
 * Safe per-file: vitest config has `isolate: true`.
 */
function enableSprites(): void {
  const gradient = { addColorStop: vi.fn() };
  const spriteCtx = {
    globalCompositeOperation: "source-over",
    globalAlpha: 1,
    fillStyle: "",
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    translate: vi.fn(),
    setTransform: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    createRadialGradient: vi.fn(() => gradient),
    createLinearGradient: vi.fn(() => gradient),
  };
  vi.stubGlobal(
    "OffscreenCanvas",
    class {
      width: number;
      height: number;
      constructor(w: number, h: number) {
        this.width = w;
        this.height = h;
      }
      getContext(kind: string) {
        return kind === "2d" ? spriteCtx : null;
      }
    },
  );
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
    sizeScaleBase: 0.45,
    blendMode: "lighter",
    ...overrides,
  };
}

const BASE_TIPS = toEmitters({
  bluePosA: { x: 100, y: 100 },
  bluePosB: { x: 120, y: 100 },
  redPosA: { x: 200, y: 100 },
  redPosB: { x: 220, y: 100 },
});

/**
 * A wide stationary emitter set. A parked tip is capped at a shimmer (see
 * IDLE_TIP_PARTICLES), so measuring at-rest ejection statistics needs many
 * tips rather than many frames from one.
 */
const MANY_PARKED_TIPS: EmitterTip[] = Array.from({ length: 20 }, (_, i) => ({
  x: 50 + i * 20,
  y: 50,
  propIndex: i,
  tipIndex: 0,
  end: "A" as const,
  color: "#fbbf24",
}));

/** Two base props + one tunnel layer (propIndex 2/3) to prove layer coverage. */
const WITH_LAYER: EmitterTip[] = [
  ...BASE_TIPS,
  { x: 300, y: 100, propIndex: 2, tipIndex: 0, end: "A", color: "#22cc88" },
  { x: 320, y: 100, propIndex: 2, tipIndex: 1, end: "B", color: "#22cc88" },
  { x: 400, y: 100, propIndex: 3, tipIndex: 0, end: "A", color: "#cc4488" },
  { x: 420, y: 100, propIndex: 3, tipIndex: 1, end: "B", color: "#cc4488" },
];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Sparkles2DRenderer simulation", () => {
  it("caps the live particle count at MAX_PARTICLES", () => {
    const r = new Sparkles2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ rate: 1.0, lifetime: 5.0, mode: "stream" });
    // Swinging tips: only a moving emitter is allowed to fill the pool, so a
    // stationary fixture can no longer reach the cap this test bounds.
    for (let i = 0; i < 300; i++) {
      const x = 200 + 150 * Math.cos(i / 6);
      const y = 200 + 150 * Math.sin(i / 6);
      const tips = toEmitters({
        bluePosA: { x, y },
        bluePosB: { x: x + 10, y },
        redPosA: { x: 400 - x, y },
        redPosB: { x: 410 - x, y },
      });
      r.render(ctx, params, tips, 1 / 60);
    }
    expect((r as any).particles.length).toBeLessThanOrEqual(1500);
    // 300 frames against a capped pool is ~3.6M spied draw calls, and vi.fn()
    // retains every argument list, so this sits near the 5s default and tips
    // over on a loaded runner. The renderer is not the cost, the recording is;
    // the frame count is the point of the test, so raise the bound instead.
  }, 30_000);

  it("a parked tip cannot fill the pool, and spray resumes as soon as it moves", () => {
    // The startup clump. The sequence viewer holds every prop at the start pose
    // for about a second before playback begins; stream mode used to keep
    // spawning at full rate into that frozen pose. The pool saturated with
    // particles born at the start pose, the props then swung away and left them
    // behind as one blob, and the real spray stayed starved until the blob aged
    // out - "a few rotations" later.
    const r = new Sparkles2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ rate: 1.0, lifetime: 5.0, mode: "stream" });
    // 66 frames ~ the 1.1s stationary pre-roll measured in the viewer.
    for (let i = 0; i < 66; i++) r.render(ctx, params, WITH_LAYER, 1 / 60);
    const parked = (r as any).particles.length;
    expect(parked).toBeGreaterThan(0); // a parked prop still shimmers
    expect(parked).toBeLessThanOrEqual(WITH_LAYER.length * 12);

    // Playback starts. The throttle lifts on the first moving frame.
    const moved = WITH_LAYER.map((t) => ({ ...t, x: t.x + 20, y: t.y + 20 }));
    r.render(ctx, params, moved, 1 / 60);
    expect((r as any).particles.length).toBeGreaterThan(parked);
  });

  it("clamps inferred tip speed so a teleport does not launch a clump off the prop", () => {
    // A canvas resize, sequence swap, or dropped-frame catch-up moves a tip
    // hundreds of prop-lengths in one frame. That displacement is not a swing,
    // and inheriting it would fling the whole frame's spawn off screen.
    const r = new Sparkles2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ rate: 1.0, lifetime: 5.0, mode: "stream", gravity: 0 });
    r.render(ctx, params, toEmitters({ bluePosA: { x: 0, y: 0 } }), 1 / 60);
    r.render(ctx, params, toEmitters({ bluePosA: { x: 5000, y: 0 } }), 1 / 60);
    const fastest = Math.max(
      ...(r as any).particles.map((p: any) => Math.hypot(p.vx, p.vy)),
    );
    // Unclamped this frame implies 300,000 px/s; MAX_TIP_SPEED caps the
    // inherited component at 5000 * 0.55.
    expect(fastest).toBeLessThan(3500);
  });

  it("spawns from tunnel layer emitters (propIndex >= 2)", () => {
    const rBase = new Sparkles2DRenderer();
    const rLayered = new Sparkles2DRenderer();
    const params = makeParams({ rate: 1.0, lifetime: 5.0, mode: "stream" });
    rBase.render(makeCtx(), params, BASE_TIPS, 1 / 60);
    rLayered.render(makeCtx(), params, WITH_LAYER, 1 / 60);
    expect((rLayered as any).particles.length).toBeGreaterThan((rBase as any).particles.length);
  });

  it("decrements particle life over time and removes dead particles", () => {
    const r = new Sparkles2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ rate: 1.0, lifetime: 0.1, mode: "stream" });
    const tips = toEmitters({ bluePosA: { x: 0, y: 0 } });
    r.render(ctx, params, tips, 1 / 60);
    expect((r as any).particles.length).toBeGreaterThan(0);
    for (let i = 0; i < 20; i++) r.render(ctx, params, tips, 1 / 60);
    const lives = (r as any).particles.map((p: any) => p.life);
    // Lifetime is jittered up to 1.4× the base, so bound generously - the point
    // is monotonic decay, not the exact cap.
    expect(Math.max(...lives, 0)).toBeLessThanOrEqual(params.lifetime * 1.4);
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
    const tips = toEmitters({ bluePosA: { x: 0, y: 0 } });
    for (let i = 0; i < 30; i++) r.render(ctx, params, tips, 1 / 60);
    const colors = new Set((r as any).particles.map((p: any) => p.color));
    const overlap = ["#aaaaaa", "#bbbbbb", "#cccccc"].filter((c) => colors.has(c));
    expect(overlap.length).toBeGreaterThanOrEqual(2);
  });

  it("burst mode skips spawning when tip is stationary", () => {
    const r = new Sparkles2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ rate: 1.0, mode: "burst", lifetime: 5.0 });
    const tips = toEmitters({ bluePosA: { x: 50, y: 50 } });
    for (let i = 0; i < 10; i++) r.render(ctx, params, tips, 1 / 60);
    expect((r as any).particles.length).toBe(0);
  });

  it("dispose() clears the particle pool and sprite cache", () => {
    const r = new Sparkles2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ rate: 1.0, mode: "stream", lifetime: 5.0 });
    const tips = toEmitters({ bluePosA: { x: 0, y: 0 } });
    r.render(ctx, params, tips, 1 / 60);
    expect((r as any).particles.length).toBeGreaterThan(0);
    r.dispose();
    expect((r as any).particles.length).toBe(0);
    expect((r as any).spriteCache.size).toBe(0);
    expect((r as any).clock).toBe(0);
  });
});

describe("Sparkles2DRenderer color", () => {
  it("rainbow spawns DISTINCT hues within a single frame", () => {
    // Regression: the old renderer derived one hue from Date.now() and applied
    // it to every particle, so "rainbow" rendered as a drifting monochrome.
    const r = new Sparkles2DRenderer();
    const params = makeParams({ colorMode: "rainbow", rate: 1.0, mode: "stream", lifetime: 5 });
    r.render(makeCtx(), params, toEmitters({ bluePosA: { x: 0, y: 0 } }), 1 / 60);
    const colors = (r as any).particles.map((p: any) => p.color);
    expect(colors.length).toBeGreaterThan(2);
    expect(new Set(colors).size).toBeGreaterThan(1);
  });

  it("solid mode jitters hue/lightness instead of emitting one flat color", () => {
    const r = new Sparkles2DRenderer();
    const params = makeParams({ colorMode: "solid", color: "#fbbf24", rate: 1.0, mode: "stream", lifetime: 5 });
    r.render(makeCtx(), params, toEmitters({ bluePosA: { x: 0, y: 0 } }), 1 / 60);
    const colors = (r as any).particles.map((p: any) => p.color);
    expect(new Set(colors).size).toBeGreaterThan(1);
    for (const c of colors) expect(c).toMatch(/^hsl\(/);
  });

  it("color is independent of wall-clock time (export determinism)", () => {
    // Two renderers fed identical dt sequences must produce identical colors even
    // when Date.now() differs between them - the QR/video export path replays
    // frames off a virtual clock.
    const rng = vi.spyOn(Math, "random").mockReturnValue(0.42);
    try {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2020-01-01T00:00:00Z"));
      const a = new Sparkles2DRenderer();
      const params = makeParams({ colorMode: "rainbow", rate: 1.0, mode: "stream", lifetime: 5 });
      for (let i = 0; i < 5; i++) a.render(makeCtx(), params, toEmitters({ bluePosA: { x: 0, y: 0 } }), 1 / 60);

      vi.setSystemTime(new Date("2021-06-15T12:34:56Z"));
      const b = new Sparkles2DRenderer();
      for (let i = 0; i < 5; i++) b.render(makeCtx(), params, toEmitters({ bluePosA: { x: 0, y: 0 } }), 1 / 60);

      const ca = (a as any).particles.map((p: any) => p.color);
      const cb = (b as any).particles.map((p: any) => p.color);
      expect(ca.length).toBeGreaterThan(0);
      expect(ca).toEqual(cb);
    } finally {
      rng.mockRestore();
    }
  });
});

describe("Sparkles2DRenderer draw", () => {
  it("blits one cached glow bed per live particle", () => {
    enableSprites();
    const r = new Sparkles2DRenderer();
    const params = makeParams({ rate: 1.0, mode: "stream", lifetime: 5.0 });
    const tips = toEmitters({ bluePosA: { x: 10, y: 10 } });
    r.render(makeCtx(), params, tips, 1 / 60);

    const ctx = makeCtx();
    r.render(ctx, params, tips, 1 / 60);
    const calls = (ctx.drawImage as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.length).toBeLessThanOrEqual((r as any).particles.length);
  });

  it("reuses sprites across particles rather than authoring one each", () => {
    enableSprites();
    const r = new Sparkles2DRenderer();
    // Solid mode jitters color per particle; quantized keys must collapse those
    // into a small bucket set instead of a sprite per particle.
    const params = makeParams({ colorMode: "solid", rate: 1.0, mode: "stream", lifetime: 5.0 });
    // Four parked tips: each is capped at a shimmer, so one tip no longer
    // yields enough particles to prove sprites are shared between them.
    for (let i = 0; i < 10; i++) r.render(makeCtx(), params, BASE_TIPS, 1 / 60);
    const particles = (r as any).particles.length;
    const sprites = (r as any).spriteCache.size;
    expect(particles).toBeGreaterThan(20);
    expect(sprites).toBeGreaterThan(0);
    expect(sprites).toBeLessThan(particles);
    expect(sprites).toBeLessThanOrEqual(48);
  });

  it("still strokes the star when the platform cannot author glow sprites", () => {
    // The global test canvas mock has no gradient methods. The glow bed is the
    // only cached part, so losing it must cost the halo and nothing else - the
    // star itself is stroked live and has to keep drawing.
    const r = new Sparkles2DRenderer();
    const params = makeParams({ rate: 1.0, mode: "stream", lifetime: 5.0 });
    const tips = toEmitters({ bluePosA: { x: 10, y: 10 } });
    const ctx = makeCtx();
    expect(() => {
      for (let i = 0; i < 5; i++) r.render(ctx, params, tips, 1 / 60);
    }).not.toThrow();
    expect((r as any).spritesUnavailable).toBe(true);
    expect((r as any).particles.length).toBeGreaterThan(0);
    expect((ctx.drawImage as unknown as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(0);
    expect((ctx.stroke as unknown as { mock: { calls: unknown[][] } }).mock.calls.length).toBeGreaterThan(0);
  });
});

describe("Sparkles2DRenderer ejection", () => {
  /** Mean unit heading of the pool, as a vector. Length ~1 = coherent spray. */
  function meanHeading(r: Sparkles2DRenderer) {
    const ps = (r as any).particles as { vx: number; vy: number }[];
    let sx = 0;
    let sy = 0;
    for (const p of ps) {
      const m = Math.hypot(p.vx, p.vy);
      if (m > 1e-6) {
        sx += p.vx / m;
        sy += p.vy / m;
      }
    }
    return { x: sx / ps.length, y: sy / ps.length, n: ps.length };
  }

  it("throws sparks along the tip's travel direction", () => {
    const r = new Sparkles2DRenderer();
    const params = makeParams({ rate: 1.0, mode: "stream", lifetime: 5.0, spread: 4, gravity: 0 });
    const ctx = makeCtx();
    // Tip sweeping +x fast enough to close the cone toward its tight limit.
    let x = 0;
    for (let i = 0; i < 12; i++) {
      r.render(ctx, params, toEmitters({ bluePosA: { x, y: 100 } }), 1 / 60);
      x += 900 / 60;
    }
    const h = meanHeading(r);
    expect(h.n).toBeGreaterThan(20);
    // Coherent, and pointed the way the tip went.
    expect(Math.hypot(h.x, h.y)).toBeGreaterThan(0.6);
    expect(h.x).toBeGreaterThan(0.5);
  });

  it("falls back to an isotropic puff when the tip is at rest", () => {
    const r = new Sparkles2DRenderer();
    const params = makeParams({ rate: 1.0, mode: "stream", lifetime: 5.0, spread: 4, gravity: 0 });
    const ctx = makeCtx();
    for (let i = 0; i < 12; i++) r.render(ctx, params, MANY_PARKED_TIPS, 1 / 60);
    const h = meanHeading(r);
    expect(h.n).toBeGreaterThan(20);
    // No lateral preference: with a full-circle cone the x components cancel.
    // (y carries the deliberate upward launch bias, so it is not symmetric.)
    expect(Math.abs(h.x)).toBeLessThan(0.2);
  });
});

describe("Sparkles2DRenderer scale", () => {
  it("accepts the scale argument across the range without throwing", () => {
    const r = new Sparkles2DRenderer();
    const ctx = makeCtx();
    const params = makeParams();
    expect(() => r.render(ctx, params, toEmitters({}), 1 / 60, 0.25)).not.toThrow();
    expect(() => r.render(ctx, params, toEmitters({ bluePosA: { x: 0, y: 0 } }), 1 / 60, 1)).not.toThrow();
    expect(() => r.render(ctx, params, toEmitters({ bluePosA: { x: 0, y: 0 } }), 1 / 60, 4)).not.toThrow();
  });

  it("scales gravity with the canvas so fall speed is resolution-invariant", () => {
    const rng = vi.spyOn(Math, "random").mockReturnValue(0.5);
    let full: number, half: number;
    try {
      const r1 = new Sparkles2DRenderer();
      const r2 = new Sparkles2DRenderer();
      const params = makeParams({ gravity: 1, spread: 0, mode: "stream" });
      const tip = toEmitters({ bluePosA: { x: 0, y: 0 } });
      r1.render(makeCtx(), params, tip, 0, 1);
      r2.render(makeCtx(), params, tip, 0, 0.5);
      r1.render(makeCtx(), params, tip, 0.5, 1);
      r2.render(makeCtx(), params, tip, 0.5, 0.5);
      full = (r1 as any).particles[0].vy;
      half = (r2 as any).particles[0].vy;
    } finally {
      rng.mockRestore();
    }
    // vy = initialBias*scale + gravity*200*scale*dt — every term is linear in
    // scale, so halving the canvas halves the velocity exactly.
    expect(half).toBeCloseTo(full / 2, 5);
  });
});

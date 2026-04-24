# Ink Renderer Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `Ink2DRenderer` from polyline stroke rendering to brush stamp compositing so ink reads as realistic textured ink, not MS Paint markers.

**Architecture:** Pre-render a procedural brush tip texture (4-layer: core pigment, wet-edge ring, edge bleed, fiber noise) to an offscreen canvas. Each frame, stamp that texture at every surviving path point with per-stamp rotation, scale, and opacity jitter derived from tip velocity and deterministic seed. Edge bleed pass first (larger, softer), then pigment pass.

**Tech Stack:** Canvas2D (`drawImage`, `createRadialGradient`, `getImageData`/`putImageData` for noise), Vitest

---

### Task 1: Add stamp scale fields to Ink2DParams + translator

**Files:**
- Modify: `src/lib/shared/effects/translators/canvas2d-types.ts:195-241`
- Modify: `src/lib/shared/effects/translators/canvas2d-translator.ts:200-248`

- [ ] **Step 1: Add `stampScaleMin` and `stampScaleMax` to `Ink2DParams`**

In `src/lib/shared/effects/translators/canvas2d-types.ts`, add two fields after `maxPointsPerTip`:

```ts
  /** Min stamp scale factor — reached at high tip speed (brush lifting). */
  stampScaleMin: number;
  /** Max stamp scale factor — reached at low tip speed (brush pressing). */
  stampScaleMax: number;
```

- [ ] **Step 2: Resolve stamp scales in `resolveInk2D`**

In `src/lib/shared/effects/translators/canvas2d-translator.ts`, add constants and fields inside `resolveInk2D`:

After the existing constants (around line 216), add:

```ts
  const STAMP_SCALE_MIN = 0.3;
  const STAMP_SCALE_MAX = 1.2;
```

In the `defaults` object (around line 234), add:

```ts
    stampScaleMin: STAMP_SCALE_MIN,
    stampScaleMax: STAMP_SCALE_MAX,
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors — new fields are added, existing consumers don't read them yet)

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/effects/translators/canvas2d-types.ts src/lib/shared/effects/translators/canvas2d-translator.ts
git commit -m "feat(effects/ink): add stampScaleMin/Max to Ink2DParams"
```

---

### Task 2: Rewrite Ink2DRenderer — BrushStampCache

**Files:**
- Modify: `src/lib/shared/effects/renderers/Ink2DRenderer.ts`

This task replaces the existing file content. The renderer keeps the same public API (`render`, `dispose`) and the same `InkTipInput` export so the overlay and render loop integration are untouched.

- [ ] **Step 1: Write the BrushStampCache class and noise helpers**

Replace the entire content of `src/lib/shared/effects/renderers/Ink2DRenderer.ts` with the new implementation. This step writes the stamp cache only — stamp rendering comes in Task 3.

```ts
import type { Ink2DParams } from "../translators/canvas2d-types";

export interface InkTipInput {
  bluePosA: { x: number; y: number } | null;
  bluePosB: { x: number; y: number } | null;
  redPosA: { x: number; y: number } | null;
  redPosB: { x: number; y: number } | null;
}

type TipKey = "bluePosA" | "bluePosB" | "redPosA" | "redPosB";
const TIP_KEYS: TipKey[] = ["bluePosA", "bluePosB", "redPosA", "redPosB"];

const STAMP_SIZE = 64;
const STAMP_HALF = STAMP_SIZE / 2;
const STAMP_R = STAMP_SIZE * 0.42;

// --- Hash noise for fiber texture (generated at cache time, not per frame) ---

function hashNoise(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1274126177) | 0;
  h = ((h ^ (h >> 13)) * 1103515245) | 0;
  return ((h & 0x7fffffff) / 0x7fffffff);
}

function sampleNoise(x: number, y: number, gridScale: number, seed: number): number {
  const gx = x / gridScale;
  const gy = y / gridScale;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const fx = gx - ix;
  const fy = gy - iy;
  const n00 = hashNoise(ix, iy, seed);
  const n10 = hashNoise(ix + 1, iy, seed);
  const n01 = hashNoise(ix, iy + 1, seed);
  const n11 = hashNoise(ix + 1, iy + 1, seed);
  const nx0 = n00 + (n10 - n00) * fx;
  const nx1 = n01 + (n11 - n01) * fx;
  return nx0 + (nx1 - nx0) * fy;
}

function twoOctaveNoise(px: number, py: number, seed: number): number {
  return sampleNoise(px, py, 8, seed) * 0.6 + sampleNoise(px, py, 4, seed + 7) * 0.4;
}

// --- Hex color parsing (same helper as before, kept local) ---

function parseHex(hex: string): [number, number, number] {
  const s = hex.trim().replace(/^#/, "");
  const norm = s.length === 3
    ? s.split("").map((c) => c + c).join("")
    : s.length >= 6 ? s.slice(0, 6) : "0a0a0a";
  return [
    parseInt(norm.slice(0, 2), 16),
    parseInt(norm.slice(2, 4), 16),
    parseInt(norm.slice(4, 6), 16),
  ];
}

// --- BrushStampCache ---

class BrushStampCache {
  private canvas: OffscreenCanvas | HTMLCanvasElement | null = null;
  private signature = "";
  private noiseSeed = (Math.random() * 100000) | 0;

  get(params: Ink2DParams): OffscreenCanvas | HTMLCanvasElement {
    const palette = params.resolvedPalette;
    const sig = `${palette.pigment}|${palette.edge}|${params.intensity.toFixed(2)}|${palette.watercolor ? "w" : ""}|${palette.emissive ? "e" : ""}`;
    if (sig === this.signature && this.canvas) return this.canvas;

    const canvas = typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(STAMP_SIZE, STAMP_SIZE)
      : document.createElement("canvas");
    if ("width" in canvas) {
      canvas.width = STAMP_SIZE;
      canvas.height = STAMP_SIZE;
    }
    const ctx = canvas.getContext("2d") as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D;
    if (!ctx) {
      this.canvas = canvas;
      this.signature = sig;
      return canvas;
    }

    const cx = STAMP_HALF;
    const cy = STAMP_HALF;
    const R = STAMP_R;
    const [pr, pg, pb] = parseHex(palette.pigment);
    const [er, eg, eb] = parseHex(palette.edge);

    ctx.clearRect(0, 0, STAMP_SIZE, STAMP_SIZE);

    // Layer 1: Core pigment — radial gradient, dense center → transparent edge
    const grad1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    grad1.addColorStop(0, `rgba(${pr},${pg},${pb},0.95)`);
    grad1.addColorStop(0.55, `rgba(${pr},${pg},${pb},0.7)`);
    grad1.addColorStop(1, `rgba(${pr},${pg},${pb},0)`);
    ctx.fillStyle = grad1;
    ctx.fillRect(0, 0, STAMP_SIZE, STAMP_SIZE);

    // Layer 2: Wet edge ring (skip for watercolor)
    if (!palette.watercolor) {
      const ringAlpha = palette.emissive ? 0.6 : 0.4;
      const grad2 = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R * 0.95);
      grad2.addColorStop(0, `rgba(${pr},${pg},${pb},0)`);
      grad2.addColorStop(0.35, `rgba(${pr},${pg},${pb},${ringAlpha})`);
      grad2.addColorStop(0.65, `rgba(${pr},${pg},${pb},${ringAlpha * 0.7})`);
      grad2.addColorStop(1, `rgba(${pr},${pg},${pb},0)`);
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, STAMP_SIZE, STAMP_SIZE);
    }

    // Layer 3: Edge bleed — soft feather beyond pigment boundary
    const grad3 = ctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, R * 1.1);
    grad3.addColorStop(0, `rgba(${er},${eg},${eb},0)`);
    grad3.addColorStop(1, `rgba(${er},${eg},${eb},0.2)`);
    ctx.fillStyle = grad3;
    ctx.fillRect(0, 0, STAMP_SIZE, STAMP_SIZE);

    // Layer 4: Fiber noise — per-pixel alpha modulation
    const noiseStrength = palette.watercolor ? 0.15 : palette.emissive ? 0.2 : 1.0;
    if (noiseStrength > 0.05) {
      const imgData = ctx.getImageData(0, 0, STAMP_SIZE, STAMP_SIZE);
      const data = imgData.data;
      for (let py = 0; py < STAMP_SIZE; py++) {
        for (let px = 0; px < STAMP_SIZE; px++) {
          const idx = (py * STAMP_SIZE + px) * 4;
          if (data[idx + 3]! === 0) continue;
          const n = twoOctaveNoise(px, py, this.noiseSeed);
          const factor = 0.5 + 0.5 * n;
          const blend = 1.0 - noiseStrength + noiseStrength * factor;
          data[idx + 3] = Math.round(data[idx + 3]! * blend);
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    this.canvas = canvas;
    this.signature = sig;
    return canvas;
  }

  dispose(): void {
    this.canvas = null;
    this.signature = "";
  }
}

// --- InkPoint with tangent + jitter seed ---

interface InkPoint {
  x: number;
  y: number;
  age: number;
  spawnSpeedPx: number;
  tangentAngle: number;
  jitterSeed: number;
}

interface TipState {
  points: InkPoint[];
  lastPos: { x: number; y: number } | null;
  smoothedVx: number;
  smoothedVy: number;
  emitAccumulator: number;
}

const MOTION_VELOCITY_THRESHOLD_PX = 30;
const FADE_FRACTION = 0.6;
const LIGHT_SAG_PX = 0.8;
const MAX_ROTATION_JITTER = 0.14;
const MAX_SCALE_JITTER = 0.24;
const MAX_OPACITY_JITTER = 0.15;

function jitterHash(seed: number, channel: number): number {
  let h = ((seed * 1000000) | 0) + channel * 374761393;
  h = ((h ^ (h >> 13)) * 1103515245) | 0;
  return (h & 0x7fffffff) / 0x7fffffff;
}

export class Ink2DRenderer {
  private tips: Record<TipKey, TipState | null> = {
    bluePosA: null, bluePosB: null, redPosA: null, redPosB: null,
  };
  private stampCache = new BrushStampCache();

  render(
    ctx: CanvasRenderingContext2D,
    params: Ink2DParams,
    tips: InkTipInput,
    dt: number,
    _scale: number = 1,
  ): void {
    for (const key of TIP_KEYS) {
      const pos = tips[key];
      const enabled = this.isTipEnabled(key, params);
      if (!pos || !enabled) {
        this.tips[key] = null;
        continue;
      }
      this.updateTip(key, pos, params, dt);
    }
    this.ageAndCullPoints(dt, params.lifetimeSeconds);
    this.drawStamps(ctx, params);
  }

  private updateTip(
    key: TipKey,
    pos: { x: number; y: number },
    params: Ink2DParams,
    dt: number,
  ): void {
    let state = this.tips[key];
    if (!state) {
      state = {
        points: [],
        lastPos: { x: pos.x, y: pos.y },
        smoothedVx: 0,
        smoothedVy: 0,
        emitAccumulator: 0,
      };
      this.tips[key] = state;
      return;
    }

    const last = state.lastPos;
    let vx = 0;
    let vy = 0;
    if (last && dt > 0) {
      vx = (pos.x - last.x) / dt;
      vy = (pos.y - last.y) / dt;
    }
    const alpha = 1 - Math.pow(0.6, dt * 60);
    state.smoothedVx += (vx - state.smoothedVx) * alpha;
    state.smoothedVy += (vy - state.smoothedVy) * alpha;
    const speedPx = Math.hypot(state.smoothedVx, state.smoothedVy);

    if (last && Math.hypot(pos.x - last.x, pos.y - last.y) > 300) {
      state.points = [];
    }

    const PX_PER_WORLD = 60;
    const refSpeed = params.motionReferenceSpeed * PX_PER_WORLD;
    const speedScalar = refSpeed > 0 ? Math.min(1, speedPx / refSpeed) : 0;

    const motionRate =
      speedPx >= MOTION_VELOCITY_THRESHOLD_PX
        ? params.motionEmission * speedScalar * params.motionSpawnRate
        : 0;
    const ambientRate = params.effectiveAmbient * params.ambientSpawnRate;
    const totalRate = motionRate + ambientRate;
    state.emitAccumulator += totalRate * dt;

    const tangent = Math.atan2(state.smoothedVy, state.smoothedVx);

    // Spacing gate: enforce minimum distance between consecutive stamps
    const speedT = Math.min(1, speedPx / (params.motionReferenceSpeed * PX_PER_WORLD * 2));
    const currentScale = params.stampScaleMax + (params.stampScaleMin - params.stampScaleMax) * speedT;
    const brushWidth = STAMP_SIZE * currentScale;
    const minSpacing = brushWidth * 0.22;

    while (state.emitAccumulator >= 1) {
      state.emitAccumulator -= 1;
      if (this.canEmit(state, pos.x, pos.y, minSpacing)) {
        this.pushPoint(state, pos.x, pos.y, speedPx, tangent, params);
      }
    }
    if (Math.random() < state.emitAccumulator * 0.1) {
      if (this.canEmit(state, pos.x, pos.y, minSpacing)) {
        this.pushPoint(state, pos.x, pos.y, speedPx, tangent, params);
      }
    }

    state.lastPos = { x: pos.x, y: pos.y };
  }

  private canEmit(state: TipState, x: number, y: number, minSpacing: number): boolean {
    if (state.points.length === 0) return true;
    const last = state.points[state.points.length - 1]!;
    return Math.hypot(x - last.x, y - last.y) >= minSpacing;
  }

  private pushPoint(
    state: TipState,
    x: number,
    y: number,
    speedPx: number,
    tangentAngle: number,
    params: Ink2DParams,
  ): void {
    state.points.push({
      x, y, age: 0, spawnSpeedPx: speedPx, tangentAngle,
      jitterSeed: Math.random(),
    });
    while (state.points.length > params.maxPointsPerTip) {
      state.points.shift();
    }
  }

  private ageAndCullPoints(dt: number, lifetimeSeconds: number): void {
    for (const key of TIP_KEYS) {
      const state = this.tips[key];
      if (!state) continue;
      const survivors: InkPoint[] = [];
      for (const p of state.points) {
        p.age += dt;
        // Light gravity preview: aged points drift downward
        if (p.age > lifetimeSeconds * 0.4) {
          const sagT = (p.age - lifetimeSeconds * 0.4) / (lifetimeSeconds * 0.6);
          p.y += LIGHT_SAG_PX * sagT * sagT * dt * 60;
        }
        if (p.age < lifetimeSeconds) survivors.push(p);
      }
      state.points = survivors;
    }
  }

  private drawStamps(ctx: CanvasRenderingContext2D, params: Ink2DParams): void {
    const stamp = this.stampCache.get(params);
    const palette = params.resolvedPalette;
    const prevComposite = ctx.globalCompositeOperation;
    const prevAlpha = ctx.globalAlpha;
    const composite: GlobalCompositeOperation = palette.emissive ? "lighter" : "source-over";

    try {
      ctx.globalCompositeOperation = composite;

      const peakAlpha = params.opacityMax * (0.45 + 0.55 * params.intensity);
      const watercolorCap = palette.watercolor ? 0.35 : 1.0;
      const SPEED_CEILING_PX = params.motionReferenceSpeed * 60 * 2;
      const watercolorScale = palette.watercolor ? 1.8 : 1.0;
      const bleedAlphaMultiplier = palette.watercolor ? 0.3 : 0.18;

      for (const key of TIP_KEYS) {
        const state = this.tips[key];
        if (!state || state.points.length === 0) continue;

        // Edge bleed pass: larger stamps, low alpha, edge color
        for (const p of state.points) {
          const ageT = p.age / params.lifetimeSeconds;
          const fadeOut = ageT > FADE_FRACTION
            ? Math.max(0, (1 - ageT) / (1 - FADE_FRACTION))
            : 1;
          const baseAlpha = Math.min(peakAlpha * fadeOut, watercolorCap);
          if (baseAlpha <= 0.01) continue;

          const speedT = Math.min(1, p.spawnSpeedPx / SPEED_CEILING_PX);
          const scale = (params.stampScaleMax + (params.stampScaleMin - params.stampScaleMax) * speedT) * watercolorScale;
          const scaleJitter = 1.0 + (jitterHash(p.jitterSeed, 1) - 0.5) * MAX_SCALE_JITTER;
          const rotJitter = (jitterHash(p.jitterSeed, 0) - 0.5) * MAX_ROTATION_JITTER;
          const bleedScale = scale * scaleJitter * 1.7;

          ctx.globalAlpha = baseAlpha * bleedAlphaMultiplier;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.tangentAngle + rotJitter);
          const squash = 1.0 / Math.sqrt(1.0 + speedT * 0.4);
          ctx.scale(bleedScale, bleedScale * squash);
          ctx.drawImage(stamp, -STAMP_HALF, -STAMP_HALF);
          ctx.restore();
        }

        // Pigment pass: main stamps
        for (const p of state.points) {
          const ageT = p.age / params.lifetimeSeconds;
          const fadeOut = ageT > FADE_FRACTION
            ? Math.max(0, (1 - ageT) / (1 - FADE_FRACTION))
            : 1;
          const baseAlpha = Math.min(peakAlpha * fadeOut, watercolorCap);
          if (baseAlpha <= 0.01) continue;

          const speedT = Math.min(1, p.spawnSpeedPx / SPEED_CEILING_PX);
          const scale = (params.stampScaleMax + (params.stampScaleMin - params.stampScaleMax) * speedT) * watercolorScale;
          const scaleJitter = 1.0 + (jitterHash(p.jitterSeed, 1) - 0.5) * MAX_SCALE_JITTER;
          const rotJitter = (jitterHash(p.jitterSeed, 0) - 0.5) * MAX_ROTATION_JITTER;
          const opacityJitter = 1.0 - jitterHash(p.jitterSeed, 2) * MAX_OPACITY_JITTER;

          ctx.globalAlpha = baseAlpha * opacityJitter;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.tangentAngle + rotJitter);
          const squash = 1.0 / Math.sqrt(1.0 + speedT * 0.4);
          ctx.scale(scale * scaleJitter, scale * scaleJitter * squash);
          ctx.drawImage(stamp, -STAMP_HALF, -STAMP_HALF);
          ctx.restore();
        }
      }
    } finally {
      ctx.globalCompositeOperation = prevComposite;
      ctx.globalAlpha = prevAlpha;
    }
  }

  private isTipEnabled(key: TipKey, params: Ink2DParams): boolean {
    if (params.trackingMode === "both_ends") return true;
    const isEndA = key === "bluePosA" || key === "redPosA";
    return params.trackingMode === "left_end" ? isEndA : !isEndA;
  }

  dispose(): void {
    for (const key of TIP_KEYS) {
      this.tips[key] = null;
    }
    this.stampCache.dispose();
  }
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/effects/renderers/Ink2DRenderer.ts
git commit -m "feat(effects/ink): rewrite renderer — brush stamp compositing

Replace lineTo/stroke polyline rendering with drawImage stamp compositing.
BrushStampCache generates 4-layer procedural brush tip (core pigment,
wet-edge ring, edge bleed, fiber noise). Per-stamp jitter for organic
edges. Emit-time spacing gate. Light gravity preview on aged points."
```

---

### Task 3: Rewrite tests for stamp-based renderer

**Files:**
- Modify: `src/lib/shared/effects/renderers/Ink2DRenderer.test.ts`

- [ ] **Step 1: Rewrite the test file**

Replace the entire content of `Ink2DRenderer.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { Ink2DRenderer } from "./Ink2DRenderer";
import type { Ink2DParams } from "../translators/canvas2d-types";
import { INK_PALETTES } from "$lib/shared/3d/effects/ink/InkPalettes";

function makeCtx(): CanvasRenderingContext2D {
  const makeGradient = () => ({ addColorStop: vi.fn() });
  const ctx = {
    canvas: { width: 800, height: 600 },
    globalCompositeOperation: "source-over" as GlobalCompositeOperation,
    globalAlpha: 1,
    lineWidth: 1,
    lineCap: "butt" as CanvasLineCap,
    lineJoin: "miter" as CanvasLineJoin,
    strokeStyle: "" as string,
    fillStyle: "" as string,
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    createRadialGradient: vi.fn(makeGradient),
    createLinearGradient: vi.fn(makeGradient),
  } as unknown as CanvasRenderingContext2D;
  return ctx;
}

function makeParams(overrides: Partial<Ink2DParams> = {}): Ink2DParams {
  return {
    ambientEmission: 0.2,
    motionEmission: 1.0,
    intensity: 0.6,
    palette: "india",
    customColor: "#0a0a0a",
    viscosity: 0.3,
    splatterIntensity: 0.3,
    trackingMode: "both_ends",
    resolvedPalette: INK_PALETTES.india,
    blendMode: "source-over",
    effectiveAmbient: 0.2,
    ambientSpawnRate: 2,
    motionSpawnRate: 60,
    motionReferenceSpeed: 3.0,
    strokeWidthMin: 2,
    strokeWidthMax: 18,
    opacityMax: 1.0,
    lifetimeSeconds: 3.0,
    maxPointsPerTip: 90,
    stampScaleMin: 0.3,
    stampScaleMax: 1.2,
    ...overrides,
  };
}

describe("Ink2DRenderer", () => {
  it("does not throw on empty tips", () => {
    const r = new Ink2DRenderer();
    const ctx = makeCtx();
    r.render(
      ctx,
      makeParams(),
      { bluePosA: null, bluePosB: null, redPosA: null, redPosB: null },
      1 / 60,
    );
    expect((ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it("uses drawImage (not stroke) for rendering stamps", () => {
    const r = new Ink2DRenderer();
    const ctx = makeCtx();
    for (let i = 0; i < 30; i++) {
      r.render(
        ctx,
        makeParams(),
        {
          bluePosA: { x: 100 + i * 8, y: 400 },
          bluePosB: { x: 120 + i * 8, y: 400 },
          redPosA: { x: 200 + i * 8, y: 400 },
          redPosB: { x: 220 + i * 8, y: 400 },
        },
        1 / 60,
      );
    }
    expect(
      (ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBeGreaterThan(0);
    // stroke should NEVER be called — stamps replace strokes
    expect((ctx.stroke as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it("uses source-over composite for opaque india palette", () => {
    const r = new Ink2DRenderer();
    const assignments: GlobalCompositeOperation[] = [];
    const ctx = makeCtx();
    let current: GlobalCompositeOperation = "source-over";
    Object.defineProperty(ctx, "globalCompositeOperation", {
      get() { return current; },
      set(v: GlobalCompositeOperation) { assignments.push(v); current = v; },
    });
    for (let i = 0; i < 15; i++) {
      r.render(
        ctx,
        makeParams(),
        {
          bluePosA: { x: 100 + i * 10, y: 400 },
          bluePosB: { x: 120 + i * 10, y: 400 },
          redPosA: null,
          redPosB: null,
        },
        1 / 60,
      );
    }
    expect(assignments).toContain("source-over");
    expect(assignments).not.toContain("lighter");
  });

  it("uses lighter composite for emissive neon palette", () => {
    const r = new Ink2DRenderer();
    const assignments: GlobalCompositeOperation[] = [];
    const ctx = makeCtx();
    let current: GlobalCompositeOperation = "source-over";
    Object.defineProperty(ctx, "globalCompositeOperation", {
      get() { return current; },
      set(v: GlobalCompositeOperation) { assignments.push(v); current = v; },
    });
    const neonParams = makeParams({
      palette: "neon",
      resolvedPalette: INK_PALETTES.neon,
      blendMode: "lighter",
    });
    for (let i = 0; i < 15; i++) {
      r.render(
        ctx,
        neonParams,
        {
          bluePosA: { x: 100 + i * 10, y: 400 },
          bluePosB: { x: 120 + i * 10, y: 400 },
          redPosA: null,
          redPosB: null,
        },
        1 / 60,
      );
    }
    expect(assignments).toContain("lighter");
  });

  it("respects trackingMode left_end", () => {
    const r = new Ink2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({ trackingMode: "left_end" });
    for (let i = 0; i < 20; i++) {
      r.render(
        ctx,
        params,
        {
          bluePosA: { x: 100 + i * 10, y: 400 },
          bluePosB: { x: 500 + i * 10, y: 400 },
          redPosA: { x: 200 + i * 10, y: 400 },
          redPosB: { x: 600 + i * 10, y: 400 },
        },
        1 / 60,
      );
    }
    expect(
      (ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBeGreaterThan(0);
  });

  it("caps maxPointsPerTip — stamps do not grow without bound", () => {
    const r = new Ink2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({
      motionSpawnRate: 500,
      maxPointsPerTip: 10,
      lifetimeSeconds: 60,
    });
    for (let i = 0; i < 120; i++) {
      r.render(
        ctx,
        params,
        {
          bluePosA: { x: 100 + i * 5, y: 400 },
          bluePosB: null,
          redPosA: null,
          redPosB: null,
        },
        1 / 60,
      );
    }
    // 10 points max × 2 passes (bleed + pigment) = at most 20 drawImage calls per frame
    const ctx2 = makeCtx();
    r.render(
      ctx2,
      params,
      { bluePosA: { x: 700, y: 400 }, bluePosB: null, redPosA: null, redPosB: null },
      1 / 60,
    );
    expect(
      (ctx2.drawImage as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBeLessThanOrEqual(22); // 10*2 + small margin for emit
  });

  it("ages points so the pool drains after the tip disappears", () => {
    const r = new Ink2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({
      motionSpawnRate: 200,
      lifetimeSeconds: 0.3,
      maxPointsPerTip: 40,
    });
    for (let i = 0; i < 18; i++) {
      r.render(
        ctx,
        params,
        {
          bluePosA: { x: 100 + i * 8, y: 400 },
          bluePosB: null,
          redPosA: null,
          redPosB: null,
        },
        1 / 60,
      );
    }
    for (let i = 0; i < 30; i++) {
      r.render(
        ctx,
        params,
        { bluePosA: null, bluePosB: null, redPosA: null, redPosB: null },
        1 / 60,
      );
    }
    const ctx2 = makeCtx();
    r.render(
      ctx2,
      params,
      { bluePosA: null, bluePosB: null, redPosA: null, redPosB: null },
      1 / 60,
    );
    expect((ctx2.drawImage as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it("applies light gravity sag to aged points", () => {
    const r = new Ink2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({
      motionSpawnRate: 200,
      lifetimeSeconds: 2.0,
      maxPointsPerTip: 40,
    });
    // Emit points at y=400
    for (let i = 0; i < 10; i++) {
      r.render(
        ctx,
        params,
        {
          bluePosA: { x: 100 + i * 8, y: 400 },
          bluePosB: null,
          redPosA: null,
          redPosB: null,
        },
        1 / 60,
      );
    }
    // Age them past the 40% threshold (0.4 * 2.0 = 0.8s)
    for (let i = 0; i < 60; i++) {
      r.render(
        ctx,
        params,
        { bluePosA: null, bluePosB: null, redPosA: null, redPosB: null },
        1 / 60,
      );
    }
    // Check that translate calls have y > 400 (gravity pulled them down)
    const ctx2 = makeCtx();
    r.render(
      ctx2,
      params,
      { bluePosA: null, bluePosB: null, redPosA: null, redPosB: null },
      1 / 60,
    );
    const translateCalls = (ctx2.translate as ReturnType<typeof vi.fn>).mock.calls;
    if (translateCalls.length > 0) {
      const yValues = translateCalls.map((c: number[]) => c[1]);
      const maxY = Math.max(...yValues);
      expect(maxY).toBeGreaterThan(400);
    }
  });

  it("dispose clears stamp cache and point history", () => {
    const r = new Ink2DRenderer();
    const ctx = makeCtx();
    for (let i = 0; i < 20; i++) {
      r.render(
        ctx,
        makeParams(),
        {
          bluePosA: { x: 100 + i * 5, y: 400 },
          bluePosB: { x: 120 + i * 5, y: 400 },
          redPosA: { x: 200 + i * 5, y: 400 },
          redPosB: { x: 220 + i * 5, y: 400 },
        },
        1 / 60,
      );
    }
    r.dispose();
    const ctx2 = makeCtx();
    r.render(
      ctx2,
      makeParams(),
      {
        bluePosA: { x: 100, y: 400 },
        bluePosB: { x: 120, y: 400 },
        redPosA: { x: 200, y: 400 },
        redPosB: { x: 220, y: 400 },
      },
      1 / 60,
    );
    // After dispose + one fresh frame, should have at most a few stamps
    // (initial frame seeds state, minimal emission)
    expect(
      (ctx2.drawImage as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBeLessThanOrEqual(4);
  });

  it("enforces minimum spacing between consecutive stamps", () => {
    const r = new Ink2DRenderer();
    const ctx = makeCtx();
    const params = makeParams({
      motionSpawnRate: 1000,
      maxPointsPerTip: 200,
      lifetimeSeconds: 60,
      stampScaleMax: 1.0,
    });
    // Feed the same position repeatedly — spacing gate should block most emits
    for (let i = 0; i < 60; i++) {
      r.render(
        ctx,
        params,
        {
          bluePosA: { x: 400, y: 400 },
          bluePosB: null,
          redPosA: null,
          redPosB: null,
        },
        1 / 60,
      );
    }
    // With stationary tip, stamps should be very few (ambient only, gated by spacing)
    const ctx2 = makeCtx();
    r.render(
      ctx2,
      params,
      { bluePosA: { x: 400, y: 400 }, bluePosB: null, redPosA: null, redPosB: null },
      1 / 60,
    );
    // Should be minimal — spacing gate prevents clustering at same position
    expect(
      (ctx2.drawImage as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBeLessThanOrEqual(10);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run src/lib/shared/effects/renderers/Ink2DRenderer.test.ts`
Expected: All 9 tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/effects/renderers/Ink2DRenderer.test.ts
git commit -m "test(effects/ink): rewrite tests for stamp-based renderer

Assertions check drawImage (not stroke), composite ops, tracking mode,
pool cap, aging/drain, gravity sag, dispose cleanup, spacing gate."
```

---

### Task 4: Run full test suite + typecheck

**Files:** None (verification only)

- [ ] **Step 1: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS. No regressions in other effect tests.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit (only if any fixes were needed)**

If typecheck or tests required fixes, commit them:

```bash
git add -u
git commit -m "fix(effects/ink): resolve typecheck/test issues from renderer rewrite"
```

---

### Task 5: Visual verification in browser

**Files:** None (verification only)

- [ ] **Step 1: Open the app and enable ink effect**

Navigate to the animator, open the effects panel, select the Ink chip. Play a sequence.

- [ ] **Step 2: Verify visual quality**

Check these specific things:
- Strokes have visible texture/fiber variation (not smooth uniform lines)
- Edge bleed reads as soft ink spread around the stroke
- Fast tip motion = thin stamps, slow tip motion = thick stamps (calligraphic pressure)
- Older points visibly sag downward slightly (gravity preview)
- India palette is opaque, dark, matte — NOT glowing
- Neon palette glows (lighter composite)
- Watercolor palette is translucent, wide strokes
- Ink looks fundamentally different from trails (opaque vs emissive, textured vs smooth, slight sag vs gravity-free)

- [ ] **Step 3: Test all 6 presets**

Cycle through Classic, Drip, Watercolor Wash, Neon Tag, Splatter, Toxic. Each should produce visibly distinct strokes.

- [ ] **Step 4: Document verification**

Take screenshot or describe what was observed. If issues found, fix and re-verify before marking complete.

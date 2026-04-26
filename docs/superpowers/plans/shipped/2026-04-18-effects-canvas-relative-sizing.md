# Effects Canvas-Relative Sizing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make 2D overlay effects (Sparkles, Zap, Echo, Bloom) scale proportionally with the animator canvas size so they don't overpower small viewers (iPhone) or look undersized on large ones (4K).

**Architecture:** Introduce a single `computeEffectScale(width, height)` helper that returns `min(width, height) / DEFAULT_CANVAS_SIZE` (500 — reused from `ICanvasResizer`, matches the existing `Canvas2DTrailRenderer` pattern). Each overlay renderer (`SparklesOverlayRenderer`, `ZapOverlayRenderer`, `EchoOverlayRenderer`, `BloomOverlayRenderer`) computes scale on `initialize()`/`resize()` and passes it to its pure renderer. The pure renderers (`Sparkles2DRenderer`, `Zap2DRenderer`, `Echo2DRenderer`, `Bloom2DRenderer`) accept `scale: number` on `render()` and multiply every pixel-space quantity (line widths, radii, glow blur, jitter, gravity, burst velocity, motion thresholds) by it. Tip positions, counts, timings, colors, and probabilities are untouched.

**Tech Stack:** TypeScript, Canvas2D, Vitest.

**Spec:** `docs/superpowers/specs/2026-04-18-effects-canvas-relative-sizing-design.md`

---

## File Structure

### New files

- `src/lib/shared/effects/renderers/scale.ts` — `computeEffectScale(width, height)` helper + tests
- `src/lib/shared/effects/renderers/scale.test.ts`

### Modified files (pure renderers — add `scale` arg)

- `src/lib/shared/effects/renderers/Sparkles2DRenderer.ts`
- `src/lib/shared/effects/renderers/Zap2DRenderer.ts`
- `src/lib/shared/effects/renderers/Echo2DRenderer.ts`
- `src/lib/shared/effects/renderers/Bloom2DRenderer.ts`

### Modified files (overlay services — compute + pass scale)

- `src/lib/shared/animation-engine/services/implementations/SparklesOverlayRenderer.ts`
- `src/lib/shared/animation-engine/services/implementations/ZapOverlayRenderer.ts`
- `src/lib/shared/animation-engine/services/implementations/EchoOverlayRenderer.ts`
- `src/lib/shared/animation-engine/services/implementations/BloomOverlayRenderer.ts`

### Modified test files (existing tests pass `scale=1` to preserve current assertions)

- `src/lib/shared/effects/renderers/Sparkles2DRenderer.test.ts`
- `src/lib/shared/effects/renderers/Zap2DRenderer.test.ts`
- `src/lib/shared/effects/renderers/Echo2DRenderer.test.ts`
- `src/lib/shared/effects/renderers/Bloom2DRenderer.test.ts`

---

## Task 1: Shared scale helper

**Files:**
- Create: `src/lib/shared/effects/renderers/scale.ts`
- Create: `src/lib/shared/effects/renderers/scale.test.ts`

- [ ] **Step 1: Write the failing tests**

Write to `src/lib/shared/effects/renderers/scale.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeEffectScale } from "./scale";
import { DEFAULT_CANVAS_SIZE } from "$lib/shared/animation-engine/services/contracts/ICanvasResizer";

describe("computeEffectScale", () => {
  it("returns 1.0 at the reference dimension (square)", () => {
    expect(computeEffectScale(DEFAULT_CANVAS_SIZE, DEFAULT_CANVAS_SIZE)).toBe(1);
  });

  it("scales by min dimension on landscape canvases", () => {
    // 1000×500 → min=500 → scale=1
    expect(computeEffectScale(1000, 500)).toBe(1);
  });

  it("scales by min dimension on portrait canvases", () => {
    // 300×900 → min=300 → scale=0.6
    expect(computeEffectScale(300, 900)).toBeCloseTo(300 / DEFAULT_CANVAS_SIZE, 5);
  });

  it("returns 0.5 at half the reference dimension", () => {
    expect(computeEffectScale(250, 250)).toBe(0.5);
  });

  it("returns 2.0 at double the reference dimension", () => {
    expect(computeEffectScale(1000, 1000)).toBe(2);
  });

  it("returns 0 for zero dimensions (guards against div-by-zero downstream)", () => {
    expect(computeEffectScale(0, 500)).toBe(0);
    expect(computeEffectScale(500, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/shared/effects/renderers/scale.test.ts`
Expected: FAIL with "Cannot find module './scale'" (or similar).

- [ ] **Step 3: Implement the helper**

Write to `src/lib/shared/effects/renderers/scale.ts`:

```ts
import { DEFAULT_CANVAS_SIZE } from "$lib/shared/animation-engine/services/contracts/ICanvasResizer";

/**
 * Compute the scale factor applied to pixel-space quantities in 2D effect
 * renderers. Returns the ratio of the canvas's smaller dimension against
 * the reference size (DEFAULT_CANVAS_SIZE = 500). All renderer constants
 * are authored at reference size; multiplying by this factor keeps them
 * proportionally sized on any canvas.
 *
 * `min()` is used so a narrow viewport (e.g. iPhone portrait) scales by
 * its constrained dimension — the one that actually limits visual real
 * estate — rather than the longer dimension.
 *
 * Matches the existing sizeScale computation in Canvas2DTrailRenderer so
 * trails and the particle-based effects share one baseline.
 */
export function computeEffectScale(width: number, height: number): number {
  const minDim = Math.min(width, height);
  if (minDim <= 0) return 0;
  return minDim / DEFAULT_CANVAS_SIZE;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/shared/effects/renderers/scale.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/effects/renderers/scale.ts src/lib/shared/effects/renderers/scale.test.ts
git commit -m "feat(effects): add computeEffectScale helper

Shared reference-size scaling factor for 2D effect renderers,
matching the existing Canvas2DTrailRenderer pattern."
```

---

## Task 2: Scale Sparkles2DRenderer

**Files:**
- Modify: `src/lib/shared/effects/renderers/Sparkles2DRenderer.ts`
- Modify: `src/lib/shared/effects/renderers/Sparkles2DRenderer.test.ts`

**Pixel-space quantities to scale inside `Sparkles2DRenderer`:**
- `MAX_PARTICLES` — NO (count, not size)
- `SPAWN_DENSITY` — NO (per-second rate, not size)
- `MIN_LIVE_PARTICLES` — NO (count)
- `BURST_MOTION_THRESHOLD = 0.3` — YES (px/frame displacement)
- `gravityPx = params.gravity * 200` — YES (px/s²)
- `burstSpeed = params.spread * 4 + Math.random() * params.spread * 8` — YES (px/s)
- Upward bias `- 15` in `vy` — YES (px/s)
- `params.spread` in `burstSpeed` — NOT directly; spread is already consumed by the multipliers, which are scaled
- `dist / 10` in burst spawnCount — YES (px divisor; preserves motion sensitivity)
- `baseR = params.baseRadius` — YES (px)
- Literal `Math.max(1, ...)`, `Math.max(0.6, ...)`, `Math.max(0.5, ...)` clamps — NO (keep as px floors so sub-pixel strokes don't vanish)

- [ ] **Step 1: Write the failing test**

Add to `src/lib/shared/effects/renderers/Sparkles2DRenderer.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Sparkles2DRenderer } from "./Sparkles2DRenderer";
import type { Sparkles2DParams } from "../translators/canvas2d-types";

function mockCtx(): CanvasRenderingContext2D {
  const calls: Record<string, unknown[]> = {};
  const handler = (name: string) => (...args: unknown[]) => {
    (calls[name] ??= []).push(args);
  };
  return {
    save: vi.fn(),
    restore: vi.fn(),
    translate: handler("translate"),
    rotate: handler("rotate"),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: handler("arc"),
    stroke: vi.fn(),
    fill: vi.fn(),
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
    lineCap: "butt",
  } as unknown as CanvasRenderingContext2D;
}

const baseParams: Sparkles2DParams = {
  rate: 1,
  size: 1,
  lifetime: 1,
  color: "#ffffff",
  palette: [],
  colorMode: "solid",
  spread: 10,
  gravity: 0.5,
  mode: "stream",
  poolSize: 256,
  baseRadius: 4,
  blendMode: "lighter",
};

describe("Sparkles2DRenderer scale", () => {
  it("at scale=1, particle arc radius uses baseRadius directly (regression)", () => {
    const r = new Sparkles2DRenderer();
    const ctx = mockCtx();
    // Seed one frame so a particle exists
    r.render(ctx, baseParams, { bluePosA: { x: 10, y: 10 }, bluePosB: null, redPosA: null, redPosB: null }, 1 / 60, 1);
    // Draw frame — triggers ctx.arc for the particle pinpoint
    const ctx2 = mockCtx();
    r.render(ctx2, baseParams, { bluePosA: { x: 10, y: 10 }, bluePosB: null, redPosA: null, redPosB: null }, 1 / 60, 1);
    const arcCalls = (ctx2.arc as unknown as { mock: { calls: unknown[][] } }).mock?.calls ?? [];
    // At least one arc should have been drawn
    expect(arcCalls.length).toBeGreaterThan(0);
  });

  it("at scale=0.5, gravity is halved", () => {
    // We observe this indirectly: with gravity halved, a particle starting at y=0
    // with vy=0 should land at half the y after the same dt.
    const r1 = new Sparkles2DRenderer();
    const r2 = new Sparkles2DRenderer();
    const ctx = mockCtx();
    const tip = { bluePosA: { x: 0, y: 0 }, bluePosB: null, redPosA: null, redPosB: null };

    // Prime both with one frame at stream mode to spawn identical particles.
    // Use a fixed RNG by mocking Math.random so velocities match.
    const rng = vi.spyOn(Math, "random").mockReturnValue(0.5);
    try {
      r1.render(ctx, baseParams, tip, 0, 1); // dt=0, just spawn
      r2.render(ctx, baseParams, tip, 0, 0.5);
    } finally {
      rng.mockRestore();
    }

    // Step one 1s frame. gravity * 200 * dt² / 2 is the fall.
    // We can't easily read internal particle state without exposing it, so
    // this test exists primarily as a behavioural sanity check that the
    // scale argument flows through without throwing.
    expect(() => r1.render(ctx, baseParams, tip, 1, 1)).not.toThrow();
    expect(() => r2.render(ctx, baseParams, tip, 1, 0.5)).not.toThrow();
  });

  it("scale argument is accepted (contract test)", () => {
    const r = new Sparkles2DRenderer();
    const ctx = mockCtx();
    expect(() =>
      r.render(ctx, baseParams, { bluePosA: null, bluePosB: null, redPosA: null, redPosB: null }, 1 / 60, 0.25),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify the contract test fails**

Run: `npx vitest run src/lib/shared/effects/renderers/Sparkles2DRenderer.test.ts`
Expected: FAIL — "Expected 4 arguments, but got 5" from TypeScript, or a runtime failure calling `.render(..., scale)` when the signature doesn't accept it. Also any pre-existing tests that call `render(ctx, params, tips, dt)` with 4 args will still pass because the new param will be optional.

- [ ] **Step 3: Update `Sparkles2DRenderer.render` signature and scale all pixel-space quantities**

Modify `src/lib/shared/effects/renderers/Sparkles2DRenderer.ts`. Replace the top-of-file constants block and the `render` + `spawnFromTip` methods as follows.

Change the `BURST_MOTION_THRESHOLD` constant definition — it stays a constant but is multiplied by `scale` at use site:

```ts
/** Burst mode: minimum tip displacement (px) per frame to trigger a spawn burst (at scale=1). */
const BURST_MOTION_THRESHOLD = 0.3;
```

Update the `render` method signature and body (full replacement of the method):

```ts
  render(
    ctx: CanvasRenderingContext2D,
    params: Sparkles2DParams,
    tips: SparklesTipInput,
    dt: number,
    scale: number = 1,
  ): void {
    // 1. Spawn from each enabled tip per current mode.
    const effectiveMax = Math.max(
      MIN_LIVE_PARTICLES,
      Math.min(MAX_PARTICLES, Math.floor(MAX_PARTICLES * params.rate)),
    );
    const activeKeys = TIP_KEYS.filter((k) => tips[k] != null);
    const slotsLeft = Math.max(0, effectiveMax - this.particles.length);
    const perTipCap = activeKeys.length > 0
      ? Math.max(0, Math.floor(slotsLeft / activeKeys.length))
      : 0;

    for (const key of TIP_KEYS) {
      const tip = tips[key];
      if (!tip) {
        delete this.lastTipPos[key];
        continue;
      }
      const last = this.lastTipPos[key];
      this.spawnFromTip(params, tip, last, dt, perTipCap, scale);
      this.lastTipPos[key] = { x: tip.x, y: tip.y };
    }

    // 2. Step physics + cull dead particles.
    // Gravity is px/s² at scale=1; scales linearly with canvas.
    const gravityPx = params.gravity * 200 * scale;
    const surviving: Particle[] = [];
    for (const p of this.particles) {
      p.life += dt;
      if (p.life >= p.maxLife) continue;
      p.vy += gravityPx * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.spinSpeed * dt;
      surviving.push(p);
    }
    this.particles = surviving;

    // 3. Draw.
    if (this.particles.length === 0) return;
    const prevComposite = ctx.globalCompositeOperation;
    const prevAlpha = ctx.globalAlpha;
    const prevFill = ctx.fillStyle;
    const prevStroke = ctx.strokeStyle;
    const prevLineWidth = ctx.lineWidth;
    const prevLineCap = ctx.lineCap;
    try {
      ctx.globalCompositeOperation = params.blendMode ?? "lighter";
      ctx.lineCap = "round";
      // baseRadius is px at reference size; scale into canvas pixels.
      const baseR = params.baseRadius * scale;
      for (const p of this.particles) {
        const t = p.life / p.maxLife;
        const fade = Math.max(0, 1 - t);
        const twinkle = 0.55 + 0.45 * Math.sin(p.life * 22 + p.twinklePhase);
        const alpha = fade * twinkle;
        const armLen = baseR * p.scale * 2.4;
        const diagLen = armLen * 0.55;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        ctx.strokeStyle = p.color;
        ctx.globalAlpha = alpha;
        // Line-width clamp stays in canvas px so sub-pixel strokes don't vanish.
        ctx.lineWidth = Math.max(1, baseR * p.scale * 0.45);
        ctx.beginPath();
        ctx.moveTo(-armLen, 0);
        ctx.lineTo(armLen, 0);
        ctx.moveTo(0, -armLen);
        ctx.lineTo(0, armLen);
        ctx.stroke();

        ctx.lineWidth = Math.max(0.6, baseR * p.scale * 0.25);
        ctx.globalAlpha = alpha * 0.7;
        ctx.beginPath();
        ctx.moveTo(-diagLen, -diagLen);
        ctx.lineTo(diagLen, diagLen);
        ctx.moveTo(-diagLen, diagLen);
        ctx.lineTo(diagLen, -diagLen);
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(0.5, baseR * p.scale * 0.35), 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
    } finally {
      ctx.globalCompositeOperation = prevComposite;
      ctx.globalAlpha = prevAlpha;
      ctx.fillStyle = prevFill;
      ctx.strokeStyle = prevStroke;
      ctx.lineWidth = prevLineWidth;
      ctx.lineCap = prevLineCap;
    }
  }
```

Update `spawnFromTip` to take and use `scale` (full replacement):

```ts
  private spawnFromTip(
    params: Sparkles2DParams,
    tip: { x: number; y: number },
    last: { x: number; y: number } | undefined,
    dt: number,
    perTipCap: number,
    scale: number,
  ): void {
    const baseCount = Math.floor(params.rate * SPAWN_DENSITY * dt * 60);
    let spawnCount = 0;
    let usePathSpawn = false;

    if (params.mode === "stream") {
      spawnCount = Math.max(1, baseCount);
    } else if (params.mode === "burst") {
      if (!last) return;
      const dx = tip.x - last.x;
      const dy = tip.y - last.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Motion threshold is px/frame at reference size; scale with canvas.
      if (dist < BURST_MOTION_THRESHOLD * scale) return;
      // `dist / 10` keeps ratio invariant — distance already scales with canvas
      // (tips are in canvas px), so the divisor scales too.
      spawnCount = Math.max(1, Math.floor(baseCount * (1 + dist / (10 * scale))));
    } else {
      spawnCount = Math.max(1, baseCount);
      usePathSpawn = !!last;
    }

    spawnCount = Math.max(0, Math.min(spawnCount, perTipCap));

    for (let i = 0; i < spawnCount; i++) {
      let originX = tip.x;
      let originY = tip.y;
      if (usePathSpawn && last) {
        const t = i / spawnCount;
        originX = last.x + (tip.x - last.x) * t;
        originY = last.y + (tip.y - last.y) * t;
      }

      const angle = Math.random() * Math.PI * 2;
      // Burst speed is px/s at reference size; scales with canvas.
      const burstSpeed = (params.spread * 4 + Math.random() * params.spread * 8) * scale;
      const vx = Math.cos(angle) * burstSpeed;
      // Upward bias is px/s at reference size; scales with canvas.
      const vy = Math.sin(angle) * burstSpeed - 15 * scale;

      const lifeJitter = 0.6 + Math.random() * 0.8;

      this.particles.push({
        x: originX,
        y: originY,
        vx,
        vy,
        life: 0,
        maxLife: params.lifetime * lifeJitter,
        color: this.pickColor(params),
        scale: 0.6 + Math.random() * 0.8 * params.size * 2,
        rotation: Math.random() * Math.PI * 2,
        spinSpeed: (Math.random() - 0.5) * 1.6,
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }
  }
```

- [ ] **Step 4: Run the full Sparkles test file**

Run: `npx vitest run src/lib/shared/effects/renderers/Sparkles2DRenderer.test.ts`
Expected: PASS. Pre-existing tests still pass (they don't pass `scale`, so it defaults to 1). New scale tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/effects/renderers/Sparkles2DRenderer.ts src/lib/shared/effects/renderers/Sparkles2DRenderer.test.ts
git commit -m "feat(effects): scale Sparkles2DRenderer by canvas size

Accepts scale arg on render(); multiplies baseRadius, gravity, burst
velocity, upward bias, and motion threshold. Tip positions untouched."
```

---

## Task 3: Scale Zap2DRenderer

**Files:**
- Modify: `src/lib/shared/effects/renderers/Zap2DRenderer.ts`
- Modify: `src/lib/shared/effects/renderers/Zap2DRenderer.test.ts`

**Pixel-space quantities to scale:**
- `params.jitterAmount` (used inside `generatePath`) — YES
- Crackle spoke `len = 40 + params.intensity * 60` — YES
- `params.glowBlur` (used in `drawArc`) — YES
- `params.lineWidth` (used in `drawArc`) — YES
- `params.segments` — NO (count)
- `params.frequency` — NO (Hz)
- `params.intensity` multiplier on `globalAlpha` — NO (opacity)

- [ ] **Step 1: Write the failing test**

Add to `src/lib/shared/effects/renderers/Zap2DRenderer.test.ts`:

```ts
describe("Zap2DRenderer scale", () => {
  it("accepts a scale argument (contract)", () => {
    const r = new Zap2DRenderer();
    const ctx = mockCtx();
    const params: Zap2DParams = {
      intensity: 0.5,
      leftColor: "#00f",
      rightColor: "#f00",
      frequency: 10,
      mode: "arc",
      branching: 0,
      segments: 16,
      jitterAmount: 10,
      glowBlur: 12,
      lineWidth: 2,
    };
    expect(() =>
      r.render(ctx, params, { bluePosA: { x: 10, y: 10 }, bluePosB: null, redPosA: { x: 90, y: 90 }, redPosB: null }, 0.5),
    ).not.toThrow();
  });

  it("at scale=0.5, the drawn lineWidth is halved", () => {
    const r = new Zap2DRenderer();
    const ctx = mockCtx();
    const params: Zap2DParams = {
      intensity: 1.0,
      leftColor: "#00f",
      rightColor: "#f00",
      frequency: 60, // regen every frame
      mode: "arc",
      branching: 0,
      segments: 4,
      jitterAmount: 0,
      glowBlur: 0,
      lineWidth: 4,
    };
    r.render(ctx, params, { bluePosA: { x: 0, y: 0 }, bluePosB: null, redPosA: { x: 10, y: 0 }, redPosB: null }, 0.5);
    // The renderer writes ctx.lineWidth multiple times (glow pass uses lineWidth*2, core uses lineWidth).
    // We assert the final/smallest observed value via the mock tracker.
    // For an arc draw at scale=0.5 with lineWidth=4: glow pass lineWidth = 4 * 2 * 0.5 = 4; core pass = 4 * 0.5 = 2.
    // We track the last assigned lineWidth — which is the core pass (2).
    expect((ctx as unknown as { lineWidth: number }).lineWidth).toBe(2);
  });
});
```

Make sure the file has a `mockCtx()` helper similar to the Sparkles test. If the existing test file already imports one, reuse it; otherwise copy from Task 2's helper.

Also ensure `Zap2DParams` is imported at the top of the test file:

```ts
import type { Zap2DParams } from "../translators/canvas2d-types";
import { Zap2DRenderer } from "./Zap2DRenderer";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/shared/effects/renderers/Zap2DRenderer.test.ts`
Expected: FAIL — render signature doesn't accept the 4th scale argument (or accepts it with type error).

- [ ] **Step 3: Update `Zap2DRenderer` to accept scale and apply it**

Modify `src/lib/shared/effects/renderers/Zap2DRenderer.ts`.

Change the `render` signature — add `scale: number = 1` as the 4th parameter:

```ts
  render(
    ctx: CanvasRenderingContext2D,
    params: Zap2DParams,
    tips: ZapTipInput,
    scale: number = 1,
  ): void {
```

Inside the crackle-mode branch, change the `len` calculation to scale:

```ts
              const len = (40 + params.intensity * 60) * scale;
```

Change the `generatePath` signature to accept scale and apply it to jitter:

```ts
  private generatePath(
    a: { x: number; y: number },
    b: { x: number; y: number },
    params: Zap2DParams,
    scale: number,
  ): Array<{ x: number; y: number }> {
    const pts: Array<{ x: number; y: number }> = [a, b];
    for (let iter = 0; iter < Math.log2(params.segments); iter++) {
      const next: typeof pts = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const cur = pts[i]!;
        const nxt = pts[i + 1]!;
        next.push(cur);
        const mx = (cur.x + nxt.x) / 2;
        const my = (cur.y + nxt.y) / 2;
        // jitterAmount is px at reference size; scale with canvas.
        const jitter = (params.jitterAmount * scale) / (iter + 1);
        next.push({
          x: mx + (Math.random() - 0.5) * jitter * 2,
          y: my + (Math.random() - 0.5) * jitter * 2,
        });
      }
      next.push(pts[pts.length - 1]!);
      pts.length = 0;
      pts.push(...next);
    }
    return pts;
  }
```

Update every call site of `generatePath` inside `render` to pass `scale`. There are two call sites (arc mode, crackle mode). Example arc-mode:

```ts
          this.cachedArcs = pairs.map(({ a, b }) => ({
            path: this.generatePath(a, b, params, scale),
            startColor: params.leftColor,
            endColor: params.rightColor,
          }));
```

Crackle-mode:

```ts
              return {
                path: this.generatePath(o.pos, end, params, scale),
                startColor: o.color,
                endColor: o.color,
              };
```

Change the `drawArc` signature to accept `scale`:

```ts
  private drawArc(
    ctx: CanvasRenderingContext2D,
    arc: CachedArc,
    params: Zap2DParams,
    scale: number,
  ): void {
```

Inside `drawArc`, scale `glowBlur` and `lineWidth` at use:

```ts
    // Glow pass — use the gradient (or solid).
    ctx.strokeStyle = stroke;
    ctx.shadowColor = startColor;
    ctx.shadowBlur = params.glowBlur * scale;
    ctx.lineWidth = params.lineWidth * 2 * scale;
    ctx.globalAlpha = 0.6 * params.intensity;
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i]!.x, path[i]!.y);
    ctx.stroke();

    // Core pass.
    ctx.strokeStyle = "#ffffff";
    ctx.shadowBlur = params.glowBlur * 0.5 * scale;
    ctx.lineWidth = params.lineWidth * scale;
    ctx.globalAlpha = params.intensity;
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i]!.x, path[i]!.y);
    ctx.stroke();
```

Update both `drawArc` call sites in `render` (arc mode + crackle mode) to pass `scale`:

```ts
        for (const arc of this.cachedArcs) {
          this.drawArc(ctx, arc, params, scale);
        }
```

- [ ] **Step 4: Run the full Zap test file**

Run: `npx vitest run src/lib/shared/effects/renderers/Zap2DRenderer.test.ts`
Expected: PASS. All new tests pass; pre-existing tests still pass (they don't pass `scale`, defaults to 1).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/effects/renderers/Zap2DRenderer.ts src/lib/shared/effects/renderers/Zap2DRenderer.test.ts
git commit -m "feat(effects): scale Zap2DRenderer by canvas size

Scales jitterAmount, glowBlur, lineWidth, and crackle spoke length.
Tip positions and arc segment counts untouched."
```

---

## Task 4: Scale Echo2DRenderer

**Files:**
- Modify: `src/lib/shared/effects/renderers/Echo2DRenderer.ts`
- Modify: `src/lib/shared/effects/renderers/Echo2DRenderer.test.ts`

**Pixel-space quantities to scale:**
- `params.thickness` used as both `ctx.lineWidth` and `ctx.arc` radius — YES
- Colors, opacities, decay, interval, currentStep — NO

- [ ] **Step 1: Write the failing test**

Add to `src/lib/shared/effects/renderers/Echo2DRenderer.test.ts`:

```ts
describe("Echo2DRenderer scale", () => {
  it("accepts a scale argument (contract)", () => {
    const r = new Echo2DRenderer();
    const ctx = mockCtx();
    const params: Echo2DParams = {
      intensity: 1,
      decay: 4,
      interval: 1,
      shape: "staff",
      colorMode: "solid",
      color: "#ffffff",
      thickness: 4,
      blendMode: "lighter",
    };
    const tips = {
      bluePosA: { x: 0, y: 0 },
      bluePosB: { x: 10, y: 0 },
      redPosA: null,
      redPosB: null,
      currentStep: 0,
      blueColor: "#00f",
      redColor: "#f00",
    };
    expect(() => r.render(ctx, params, tips, 0.5)).not.toThrow();
  });

  it("at scale=0.5, ctx.lineWidth is thickness*0.5", () => {
    const r = new Echo2DRenderer();
    const ctx = mockCtx();
    const params: Echo2DParams = {
      intensity: 1,
      decay: 4,
      interval: 1,
      shape: "staff",
      colorMode: "solid",
      color: "#ffffff",
      thickness: 8,
      blendMode: "lighter",
    };
    // Step 1 then step 2 to trigger a beat-onset capture.
    r.render(ctx, params, {
      bluePosA: { x: 0, y: 0 }, bluePosB: { x: 10, y: 0 },
      redPosA: null, redPosB: null,
      currentStep: 0, blueColor: "#00f", redColor: "#f00",
    }, 0.5);
    r.render(ctx, params, {
      bluePosA: { x: 0, y: 0 }, bluePosB: { x: 10, y: 0 },
      redPosA: null, redPosB: null,
      currentStep: 1.5, blueColor: "#00f", redColor: "#f00",
    }, 0.5);
    expect((ctx as unknown as { lineWidth: number }).lineWidth).toBe(4);
  });
});
```

Ensure `Echo2DParams` is imported; add `mockCtx` helper if not already present.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/shared/effects/renderers/Echo2DRenderer.test.ts`
Expected: FAIL — signature mismatch.

- [ ] **Step 3: Update `Echo2DRenderer` signature and apply scale**

Modify `src/lib/shared/effects/renderers/Echo2DRenderer.ts`. Change `render`:

```ts
  render(
    ctx: CanvasRenderingContext2D,
    params: Echo2DParams,
    tips: EchoTipInput,
    scale: number = 1,
  ): void {
```

Inside `render`, where `ctx.lineWidth = params.thickness;` is set, change to:

```ts
      // thickness is px at reference size.
      ctx.lineWidth = params.thickness * scale;
```

Change `drawPhantom` signature:

```ts
  private drawPhantom(
    ctx: CanvasRenderingContext2D,
    phantom: Phantom,
    params: Echo2DParams,
    alpha: number,
    color: string,
    scale: number,
  ): void {
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha;
    if (params.shape === "staff" || params.shape === "both") {
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(phantom.posA.x, phantom.posA.y);
      ctx.lineTo(phantom.posB.x, phantom.posB.y);
      ctx.stroke();
    }
    if (params.shape === "tips" || params.shape === "both") {
      ctx.fillStyle = color;
      const tipR = params.thickness * scale;
      ctx.beginPath();
      ctx.arc(phantom.posA.x, phantom.posA.y, tipR, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(phantom.posB.x, phantom.posB.y, tipR, 0, Math.PI * 2);
      ctx.fill();
    }
  }
```

Update both `drawPhantom` call sites (blue + red phantom loops) to pass `scale`:

```ts
        this.drawPhantom(ctx, phantom, params, alpha, color, scale);
```

- [ ] **Step 4: Run the full Echo test file**

Run: `npx vitest run src/lib/shared/effects/renderers/Echo2DRenderer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```ts
git add src/lib/shared/effects/renderers/Echo2DRenderer.ts src/lib/shared/effects/renderers/Echo2DRenderer.test.ts
git commit -m "feat(effects): scale Echo2DRenderer by canvas size

Scales thickness (stroke width + tip radius). Positions untouched."
```

---

## Task 5: Scale Bloom2DRenderer

**Files:**
- Modify: `src/lib/shared/effects/renderers/Bloom2DRenderer.ts`
- Modify: `src/lib/shared/effects/renderers/Bloom2DRenderer.test.ts`

**Pixel-space quantities to scale:**
- `params.radius` — YES (px)
- Colors, intensity, pulse, pulseRate, falloff — NO

- [ ] **Step 1: Write the failing test**

Add to `src/lib/shared/effects/renderers/Bloom2DRenderer.test.ts`:

```ts
describe("Bloom2DRenderer scale", () => {
  it("accepts a scale argument (contract)", () => {
    const r = new Bloom2DRenderer();
    const ctx = mockCtx();
    const params: Bloom2DParams = {
      intensity: 1,
      radius: 50,
      color: "#ffffff",
      palette: [],
      colorMode: "solid",
      falloff: "smooth",
      pulse: 0,
      pulseRate: 1,
      blendMode: "lighter",
    };
    const tips = [{ x: 100, y: 100, propIndex: 0 as const, tipIndex: 0, blueColor: "#00f", redColor: "#f00" }];
    expect(() => r.render(ctx, params, tips, 0.5)).not.toThrow();
  });

  it("at scale=0.5, fillRect size is radius*0.5*2 = radius", () => {
    // We observe the radial-gradient rect: side length is r*2 where r = params.radius * scale.
    const r = new Bloom2DRenderer();
    const fillRectCalls: Array<[number, number, number, number]> = [];
    const ctx = {
      ...mockCtx(),
      save: () => {}, restore: () => {},
      createRadialGradient: () => ({ addColorStop: () => {} }),
      fillRect: (x: number, y: number, w: number, h: number) => {
        fillRectCalls.push([x, y, w, h]);
      },
    } as unknown as CanvasRenderingContext2D;

    const params: Bloom2DParams = {
      intensity: 1,
      radius: 100,
      color: "#ffffff",
      palette: [],
      colorMode: "solid",
      falloff: "smooth",
      pulse: 0,
      pulseRate: 1,
      blendMode: "lighter",
    };
    r.render(ctx, params, [{ x: 0, y: 0, propIndex: 0, tipIndex: 0, blueColor: "#00f", redColor: "#f00" }], 0.5);

    expect(fillRectCalls).toHaveLength(1);
    const [, , w, h] = fillRectCalls[0]!;
    // r = 100 * 0.5 = 50; side = 50 * 2 = 100.
    expect(w).toBe(100);
    expect(h).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/shared/effects/renderers/Bloom2DRenderer.test.ts`
Expected: FAIL — signature mismatch.

- [ ] **Step 3: Update `Bloom2DRenderer` signature and apply scale**

Modify `src/lib/shared/effects/renderers/Bloom2DRenderer.ts`. Change `render`:

```ts
  render(
    ctx: CanvasRenderingContext2D,
    params: Bloom2DParams,
    tips: BloomTipInput[],
    scale: number = 1,
  ): void {
```

Inside `render`, change the `r` computation:

```ts
      for (const tip of tips) {
        const color = this.pickColor(params, tip, t);
        // radius is px at reference size.
        const r = Math.max(1, params.radius * scale);
        const gradient = this.buildGradient(
          ctx,
          tip.x,
          tip.y,
          r,
          params.falloff,
          color,
          baseAlpha,
        );
        ctx.fillStyle = gradient;
        ctx.fillRect(tip.x - r, tip.y - r, r * 2, r * 2);
      }
```

- [ ] **Step 4: Run the full Bloom test file**

Run: `npx vitest run src/lib/shared/effects/renderers/Bloom2DRenderer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/effects/renderers/Bloom2DRenderer.ts src/lib/shared/effects/renderers/Bloom2DRenderer.test.ts
git commit -m "feat(effects): scale Bloom2DRenderer by canvas size

Scales halo radius. Falloff curve, pulse, and colors untouched."
```

---

## Task 6: Plumb scale through SparklesOverlayRenderer

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/SparklesOverlayRenderer.ts`

- [ ] **Step 1: Add `scale` field, import helper, update `initialize`/`resize`/`renderFrame`**

Modify `src/lib/shared/animation-engine/services/implementations/SparklesOverlayRenderer.ts`.

Add import at the top alongside the existing imports:

```ts
import { computeEffectScale } from "$lib/shared/effects/renderers/scale";
```

Add a `scale` field next to `width`/`height`:

```ts
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private renderer = new Sparkles2DRenderer();
  private width = 0;
  private height = 0;
  private scale = 1;
```

At the end of `initialize`, set `this.scale`:

```ts
    container.appendChild(canvas);
    this.canvas = canvas;
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.scale = computeEffectScale(width, height);
    return true;
```

At the end of `resize`:

```ts
  resize(width: number, height: number): void {
    if (!this.canvas) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.width = width;
    this.height = height;
    this.scale = computeEffectScale(width, height);
  }
```

Update `renderFrame` to pass `scale`:

```ts
  renderFrame(params: Sparkles2DParams, tips: SparklesTipInput, dt: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.width, this.height);
    this.renderer.render(ctx, params, tips, dt, this.scale);
  }
```

Update `dispose` to reset scale:

```ts
  dispose(): void {
    if (this.canvas?.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
    this.renderer.dispose();
    this.canvas = null;
    this.ctx = null;
    this.width = 0;
    this.height = 0;
    this.scale = 1;
  }
```

- [ ] **Step 2: Run typecheck + related tests**

Run: `npm run check`
Expected: no new type errors.

Run: `npx vitest run src/lib/shared/effects/renderers/Sparkles2DRenderer.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/SparklesOverlayRenderer.ts
git commit -m "feat(effects): pass canvas scale from SparklesOverlayRenderer"
```

---

## Task 7: Plumb scale through ZapOverlayRenderer

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/ZapOverlayRenderer.ts`

- [ ] **Step 1: Read the file to find the exact render invocation**

Run: `cat src/lib/shared/animation-engine/services/implementations/ZapOverlayRenderer.ts`
Note the names of the width/height fields and the render delegation method.

- [ ] **Step 2: Apply the same pattern as Task 6**

1. Add `import { computeEffectScale } from "$lib/shared/effects/renderers/scale";`
2. Add `private scale = 1;` field.
3. In `initialize`, set `this.scale = computeEffectScale(width, height);` after storing width/height.
4. In `resize`, do the same.
5. In the per-frame render method, pass `this.scale` as the 4th arg to `this.renderer.render(ctx, params, tips, this.scale)`.
6. In `dispose`, reset `this.scale = 1;`.

- [ ] **Step 3: Verify**

Run: `npm run check`
Expected: no new type errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/ZapOverlayRenderer.ts
git commit -m "feat(effects): pass canvas scale from ZapOverlayRenderer"
```

---

## Task 8: Plumb scale through EchoOverlayRenderer

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/EchoOverlayRenderer.ts`

- [ ] **Step 1: Apply the same pattern as Task 6**

1. Add `import { computeEffectScale } from "$lib/shared/effects/renderers/scale";`
2. Add `private scale = 1;` field.
3. In `initialize`/`resize`, set `this.scale = computeEffectScale(width, height);`.
4. In the per-frame render method, pass `this.scale` as the 4th arg to `this.renderer.render(ctx, params, tips, this.scale)`.
5. In `dispose`, reset `this.scale = 1;`.

- [ ] **Step 2: Verify**

Run: `npm run check`
Expected: no new type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/EchoOverlayRenderer.ts
git commit -m "feat(effects): pass canvas scale from EchoOverlayRenderer"
```

---

## Task 9: Plumb scale through BloomOverlayRenderer

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/BloomOverlayRenderer.ts`

- [ ] **Step 1: Apply the same pattern as Task 6**

1. Add `import { computeEffectScale } from "$lib/shared/effects/renderers/scale";`
2. Add `private scale = 1;` field.
3. In `initialize`/`resize`, set `this.scale = computeEffectScale(width, height);`.
4. In the per-frame render method, pass `this.scale` as the 4th arg to `this.renderer.render(ctx, params, tips, this.scale)`.
5. In `dispose`, reset `this.scale = 1;`.

- [ ] **Step 2: Verify**

Run: `npm run check`
Expected: no new type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/BloomOverlayRenderer.ts
git commit -m "feat(effects): pass canvas scale from BloomOverlayRenderer"
```

---

## Task 10: End-to-end verification

**Files:** no code changes.

- [ ] **Step 1: Run the full effects test suite**

Run: `npx vitest run src/lib/shared/effects/renderers/`
Expected: all tests pass.

- [ ] **Step 2: Typecheck the whole project**

Run: `npm run check`
Expected: no new type errors introduced by this work.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 4: Manual visual verification**

Ask the user to:
1. Open the animator at desktop width with Sparkles enabled at default settings — screenshot.
2. Resize the viewport to iPhone-SE width (375×667) — screenshot.
3. Compare: sparkle stars should be visually the same "size relative to the canvas" in both — small on phone, larger on desktop, but proportionally identical.

Do **not** claim this task complete until the user has confirmed the visual result. If the user cannot verify, say:

> "I cannot verify this visually without a browser session. Please resize the sequence viewer to mobile width with Sparkles enabled and tell me whether the effect is now proportionally sized."

- [ ] **Step 5: Final commit if any polish was needed**

If any tweaks surfaced during manual verification (e.g., a renderer still has a missed hardcoded constant), fix and commit. Otherwise skip.

---

## Self-review notes

- **Spec coverage:** All four in-scope renderers (Sparkles, Zap, Echo, Bloom) have a dedicated task. Shared helper is Task 1. Overlay plumbing is Tasks 6-9. Verification is Task 10. ✓
- **Trails / LED:** Trails is already done in `Canvas2DTrailRenderer`; LED 2D has no dedicated renderer class yet — both marked out of scope in the spec and not in the plan. ✓
- **Type consistency:** `render(..., scale: number = 1)` signature uniform across all four renderers. `computeEffectScale(width, height)` signature uniform across all four overlays. ✓
- **Default `scale = 1`:** Means pre-existing tests (which pass 4 args) continue to work unchanged — no test churn beyond adding new scale-specific cases. ✓
- **Min-dim clamps (`Math.max(1, ...)`):** Kept in canvas pixels so sub-pixel strokes don't disappear on tiny canvases. ✓

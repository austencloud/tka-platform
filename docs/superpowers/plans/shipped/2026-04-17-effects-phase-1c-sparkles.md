# Effects Phase 1c — Sparkles Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Sparkles as the second fully-wired tip effect through the unified intent layer (2D renderer + 3D wiring + presets + Customize), mirroring the proven Phase 1a/1b pattern.

**Architecture:** Two groups. Group A (Tasks 1-4) extends the data model and translator layer. Group B (Tasks 5-10) builds the renderer, engine wiring, 3D mounts, presets and Customize panel. Each task commits ONLY its named files.

**Tech Stack:** Svelte 5 (runes), TypeScript strict, Threlte (3D), Canvas2D (effects layer), Vitest.

**Spec:** `docs/superpowers/specs/2026-04-17-effects-phase-1c-sparkles-design.md`
**Resumes from:** tag `phase-1b-zap-polish-complete`
**Project guardrails:** project CLAUDE.md bans worktrees and branches — work on `main`. Never run `npm run dev` (port 5173 is the user's dev server). Verification = `curl localhost:5173`, `npm run build`, or `npm run check`. Never use `--no-verify`.

---

## Reference patterns to mirror

- **Per-hand color migration template:** Phase 1b Tasks 4-5 (v2→v3 split of `zap.color`). The v3→v4 sparkles migration follows the same shape — mutate input shape before the default-merge so downstream sees the new shape.
- **2D renderer template:** `src/lib/shared/effects/renderers/Zap2DRenderer.ts` — pool/cache state, `dispose()`, prev-state across frames.
- **Customize template:** `ZapCustomize.svelte` — chip rows, slider rows, circular color pickers, all styling inline (no shared component extraction).
- **Preset template:** `zap-presets.ts` — the `applyZap(state, presetId, patch)` helper that calls `state.updateZap(patch)` then `state.applyPreset({ ... activePresets ... })` to keep the chip highlighted. **DO NOT call `getEffectsConfigContext()` inside event handlers** — the preset receives `state` as the second parameter.

---

## Scope discipline notes

- **Each task commits ONLY its named change.** If you find an unrelated bug while implementing, file it in `docs/superpowers/specs/effects-unification-deferred-items.md` and keep moving.
- **Do not** "while I'm here" refactor Trail/Fire/LED/Charcoal Customize panels.
- **Do not** wire `params.gravity` into the 3D `SparkleEmitter` (deferred — leaves its hardcoded `GRAVITY=30` alone).
- **Do not** modify `SparkleEmitter.svelte`. Mount it from `EffectsLayer.svelte` with the right props.

---

## Task 1: Extend `SparklesIntent` + bump version 3→4 + v3→v4 migration

**Files:**
- Modify: `src/lib/shared/effects/domain/EffectsConfig.ts:19, 101-112`
- Modify: `src/lib/shared/effects/domain/migrations.ts`
- Modify: `src/lib/shared/effects/domain/migrations.test.ts` (extend)

Replace the `rainbow: boolean` field with a `colorMode: "solid" | "rainbow" | "palette"` enum, and add `palette`, `spread`, `gravity`, `mode`. Bump `EFFECTS_CONFIG_VERSION` 3→4. The migration writes the new fields in-place before the default-merge so existing persisted configs upgrade without losing user selections.

- [ ] **Step 1: Write the failing migration test cases**

Append to `src/lib/shared/effects/domain/migrations.test.ts` (inside the existing `describe` block — keep the existing v1/v2/v3 zap cases):

```ts
  it("migrates v3 sparkles.rainbow=true to v4 colorMode=rainbow", () => {
    const v3 = {
      version: 3,
      sparkles: {
        rate: 0.6, size: 0.4, lifetime: 1.0,
        color: "#ff00ff", rainbow: true,
      },
    };
    const out = migrateEffectsConfig(v3);
    expect(out.version).toBe(EFFECTS_CONFIG_VERSION);
    expect(out.sparkles.colorMode).toBe("rainbow");
    expect(out.sparkles.color).toBe("#ff00ff");
    expect((out.sparkles as any).rainbow).toBeUndefined();
    // New fields receive defaults from the migration.
    expect(out.sparkles.palette).toEqual(["#fbbf24", "#f59e0b", "#fde047"]);
    expect(out.sparkles.spread).toBe(8);
    expect(out.sparkles.gravity).toBe(0.3);
    expect(out.sparkles.mode).toBe("stream");
  });

  it("migrates v3 sparkles.rainbow=false to v4 colorMode=solid", () => {
    const v3 = {
      version: 3,
      sparkles: {
        rate: 0.5, size: 0.5, lifetime: 1.2,
        color: "#fbbf24", rainbow: false,
      },
    };
    const out = migrateEffectsConfig(v3);
    expect(out.sparkles.colorMode).toBe("solid");
    expect((out.sparkles as any).rainbow).toBeUndefined();
  });

  it("leaves a current-version v4 sparkles untouched", () => {
    const v4 = {
      version: EFFECTS_CONFIG_VERSION,
      sparkles: {
        rate: 0.7, size: 0.6, lifetime: 2.0,
        color: "#67e8f9",
        palette: ["#aaa", "#bbb", "#ccc"],
        colorMode: "palette" as const,
        spread: 12, gravity: 0.8, mode: "burst" as const,
      },
    };
    const out = migrateEffectsConfig(v4);
    expect(out.sparkles.colorMode).toBe("palette");
    expect(out.sparkles.palette).toEqual(["#aaa", "#bbb", "#ccc"]);
    expect(out.sparkles.mode).toBe("burst");
  });
```

- [ ] **Step 2: Run the test — confirm it fails**

```bash
npx vitest run src/lib/shared/effects/domain/migrations.test.ts
```

Expected: FAIL — TypeScript errors on `colorMode`/`palette`/`spread`/`gravity`/`mode`, plus runtime `expect(out.sparkles.colorMode).toBe("rainbow")` failures because the migration doesn't add the field.

- [ ] **Step 3: Update `EffectsConfig.ts`**

Bump the version constant:

```ts
export const EFFECTS_CONFIG_VERSION = 4;
```

Replace the `SparklesIntent` interface (lines 101-112) with:

```ts
export interface SparklesIntent {
  /** 0-1 — particle spawn rate multiplier. */
  rate: number;
  /** 0-1 — particle scale multiplier. */
  size: number;
  /** 0.1-3.0 seconds. */
  lifetime: number;
  /** Hex string — primary tint when colorMode === "solid". */
  color: string;
  /** Multicolor palette (3-5 hex). Used when colorMode === "palette". */
  palette: string[];
  /** "solid" = use color, "rainbow" = HSL cycle, "palette" = pick random from palette. */
  colorMode: "solid" | "rainbow" | "palette";
  /** 0-30 px — radius around the tip particles spawn within. */
  spread: number;
  /** 0-1 — 0 = floaty (low gravity), 1 = fast fall (high gravity). */
  gravity: number;
  /** 'burst' = sudden bloom on motion, 'stream' = continuous, 'trail' = follows tip path. */
  mode: "burst" | "stream" | "trail";
}
```

- [ ] **Step 4: Update `defaults.ts` sparkles block**

Replace the existing sparkles defaults (lines 52-58) with:

```ts
  sparkles: {
    rate: 0.5,
    size: 0.5,
    lifetime: 1.2,
    color: "#fbbf24",
    palette: ["#fbbf24", "#f59e0b", "#fde047"],
    colorMode: "solid",
    spread: 8,
    gravity: 0.3,
    mode: "stream",
  },
```

- [ ] **Step 5: Append the v3→v4 migration to `migrations.ts`**

Insert this block immediately after the existing v2→v3 zap migration block (around line 23, before the default-merge `let out: EffectsConfig = { ... }`):

```ts
  // v3 → v4: collapse sparkles.rainbow boolean into colorMode enum and
  // add palette/spread/gravity/mode fields with sensible defaults.
  if (version < 4 && input.sparkles) {
    const s = input.sparkles as any;
    s.palette ??= ["#fbbf24", "#f59e0b", "#fde047"];
    s.colorMode ??= s.rainbow ? "rainbow" : "solid";
    s.spread ??= 8;
    s.gravity ??= 0.3;
    s.mode ??= "stream";
    delete s.rainbow;
  }
```

Also widen the `input` type alias on line 14 so `sparkles` is `any`:

```ts
const input = raw as Partial<EffectsConfig> & { version?: number; zap?: any; sparkles?: any };
```

- [ ] **Step 6: Run the migration test — confirm it passes**

```bash
npx vitest run src/lib/shared/effects/domain/migrations.test.ts
```

Expected: PASS for all cases (existing zap + new sparkles).

- [ ] **Step 7: Run typecheck to enumerate downstream breakage**

```bash
npm run check 2>&1 | grep -iE "sparkles\.(rainbow|colorMode|palette|spread|gravity|mode)" | head -30
```

Expected: a worklist of files reading `sparkles.rainbow` or constructing a `SparklesIntent` literal. Note for Tasks 7 and 9 — do NOT fix in this commit. Anything outside `EffectsConfig`/`defaults`/`migrations` is downstream.

- [ ] **Step 8: Commit**

```bash
git status
git add src/lib/shared/effects/domain/EffectsConfig.ts \
        src/lib/shared/effects/domain/defaults.ts \
        src/lib/shared/effects/domain/migrations.ts \
        src/lib/shared/effects/domain/migrations.test.ts
git commit -m "$(cat <<'EOF'
feat(effects)!: extend SparklesIntent with palette/colorMode/spread/gravity/mode

Bumps EFFECTS_CONFIG_VERSION 3→4. Replaces sparkles.rainbow boolean
with a colorMode enum ("solid" | "rainbow" | "palette") and adds
palette, spread, gravity, mode. Migration writes new fields in-place
before the default-merge so persisted configs upgrade without losing
user selections.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Update 2D translator types + resolver for new sparkles fields

**Files:**
- Modify: `src/lib/shared/effects/translators/canvas2d-types.ts:66-73` (`Sparkles2DParams`)
- Modify: `src/lib/shared/effects/translators/canvas2d-translator.ts:75-85` (`resolveSparkles2D`)
- Modify: `src/lib/shared/effects/translators/canvas2d-translator.test.ts` (extend)

`Sparkles2DParams extends SparklesIntent` — it picks up the new fields automatically. The resolver passes them through via `...intent`. Add a regression test that locks the contract.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/shared/effects/translators/canvas2d-translator.test.ts`:

```ts
import { resolveSparkles2D } from "./canvas2d-translator";
import type { SparklesIntent } from "../domain/EffectsConfig";

describe("resolveSparkles2D — extended fields", () => {
  it("preserves colorMode, palette, spread, gravity, mode in output params", () => {
    const intent: SparklesIntent = {
      rate: 0.7,
      size: 0.6,
      lifetime: 1.5,
      color: "#67e8f9",
      palette: ["#aaa", "#bbb", "#ccc"],
      colorMode: "palette",
      spread: 12,
      gravity: 0.8,
      mode: "burst",
    };
    const out = resolveSparkles2D(intent);
    expect(out.colorMode).toBe("palette");
    expect(out.palette).toEqual(["#aaa", "#bbb", "#ccc"]);
    expect(out.spread).toBe(12);
    expect(out.gravity).toBe(0.8);
    expect(out.mode).toBe("burst");
    // Resolver-derived defaults still present.
    expect(out.poolSize).toBeGreaterThan(0);
    expect(out.baseRadius).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test — confirm it fails or passes**

```bash
npx vitest run src/lib/shared/effects/translators/canvas2d-translator.test.ts
```

Expected: PASS immediately if `Sparkles2DParams extends SparklesIntent` already (it does — line 66 of canvas2d-types.ts). The test locks the contract going forward. If it fails, fix per Step 3.

- [ ] **Step 3: No type changes needed**

`Sparkles2DParams extends SparklesIntent` already inherits the new fields via Task 1's intent change. `resolveSparkles2D` already spreads `...intent` so nothing to update. If the test failed, audit the type chain.

- [ ] **Step 4: Commit**

```bash
git status
git add src/lib/shared/effects/translators/canvas2d-translator.test.ts
git commit -m "$(cat <<'EOF'
test(effects): lock resolveSparkles2D passthrough of extended fields

Sparkles2DParams inherits colorMode/palette/spread/gravity/mode from
SparklesIntent automatically. Adds a regression test on resolveSparkles2D
to lock the contract that translator output preserves all five new
fields verbatim alongside the resolver-derived poolSize/baseRadius.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Confirm 3D translator types + resolver still typecheck

**Files:**
- Modify (only if needed): `src/lib/shared/effects/translators/webgl3d-types.ts:78-85`
- Modify (only if needed): `src/lib/shared/effects/translators/webgl3d-translator.ts:88-98`

`Sparkles3DParams extends SparklesIntent` — also inherits the new fields. `resolveSparkles3D` spreads `...intent` so nothing to change.

- [ ] **Step 1: Run typecheck**

```bash
npm run check 2>&1 | grep -iE "Sparkles3D|webgl3d" | head -10
```

Expected: empty output. If a downstream call site reads `intent.rainbow`, fix it now (replace with `intent.colorMode === "rainbow"`).

- [ ] **Step 2: Run the translator test suite**

```bash
npx vitest run src/lib/shared/effects/translators/
```

Expected: PASS.

- [ ] **Step 3: NO commit** if no files changed

This task verifies the 3D resolver passthrough already works. If the typecheck surfaced edits, commit them with:

```bash
git status
git add src/lib/shared/effects/translators/webgl3d-types.ts \
        src/lib/shared/effects/translators/webgl3d-translator.ts
git commit -m "$(cat <<'EOF'
fix(effects-3d): align Sparkles3D translator with v4 intent

Replaces references to the removed sparkles.rainbow boolean with the
new colorMode enum check. Sparkles3DParams inherits the new fields
from SparklesIntent automatically.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

If no edits were needed, note "no changes; 3D translator inherits new fields cleanly" and continue to Task 4.

---

## Task 4: Implement `Sparkles2DRenderer` + unit tests

**Files:**
- Create: `src/lib/shared/effects/renderers/Sparkles2DRenderer.ts`
- Create: `src/lib/shared/effects/renderers/Sparkles2DRenderer.test.ts`

Particle pool simulation. Pool size `MAX_PARTICLES = 200`. Each particle: `{x, y, vx, vy, life, maxLife, color, scale}`. Spawn per frame from each enabled tip, scattered within `spread` radius. Color picked per spawn from `colorMode`. Velocity: random direction × small initial speed. Apply `vy += gravity * 200 * dt`. Render: filled circle with `globalCompositeOperation = "lighter"`.

Mode behavior:
- `stream` — spawn each frame.
- `burst` — spawn only when tip velocity (last → current position delta) exceeds threshold (renderer tracks last position per tip).
- `trail` — spawn at current tip and along the path between last and current.

- [ ] **Step 1: Write the failing test file**

Create `src/lib/shared/effects/renderers/Sparkles2DRenderer.test.ts`:

```ts
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
    get() { return ""; },
    set(v: string) { fillStyles.push(v); },
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
    // Advance well past lifetime — all current particles should die,
    // but stream mode also spawns new ones, so check life monotonicity instead.
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
      rate: 1.0, mode: "stream",
    });
    const tips = {
      bluePosA: { x: 0, y: 0 },
      bluePosB: null,
      redPosA: null,
      redPosB: null,
    };
    for (let i = 0; i < 30; i++) r.render(ctx, params, tips, 1 / 60);
    const colors = new Set((r as any).particles.map((p: any) => p.color));
    // With 30 frames of spawns, expect at least 2 of the 3 palette colors used.
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
```

- [ ] **Step 2: Run the test — confirm it fails**

```bash
npx vitest run src/lib/shared/effects/renderers/Sparkles2DRenderer.test.ts
```

Expected: FAIL — file does not exist.

- [ ] **Step 3: Implement `Sparkles2DRenderer.ts`**

Create `src/lib/shared/effects/renderers/Sparkles2DRenderer.ts`:

```ts
import type { Sparkles2DParams } from "../translators/canvas2d-types";

export interface SparklesTipInput {
  bluePosA: { x: number; y: number } | null;
  bluePosB: { x: number; y: number } | null;
  redPosA: { x: number; y: number } | null;
  redPosB: { x: number; y: number } | null;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  scale: number;
}

type TipKey = "bluePosA" | "bluePosB" | "redPosA" | "redPosB";
const TIP_KEYS: TipKey[] = ["bluePosA", "bluePosB", "redPosA", "redPosB"];

const MAX_PARTICLES = 200;
/** Burst mode: minimum tip displacement (px) per frame to trigger a spawn burst. */
const BURST_MOTION_THRESHOLD = 1.5;

/**
 * Particle-pool sparkle renderer for the Canvas2D backend.
 *
 * Holds particle state across frames. Caller passes tips per frame; renderer
 * manages spawn, physics, decay, and draw using ctx.globalCompositeOperation
 * = "lighter" for additive bloom.
 */
export class Sparkles2DRenderer {
  private particles: Particle[] = [];
  private lastTipPos: Partial<Record<TipKey, { x: number; y: number }>> = {};

  render(
    ctx: CanvasRenderingContext2D,
    params: Sparkles2DParams,
    tips: SparklesTipInput,
    dt: number,
  ): void {
    // 1. Spawn from each enabled tip per current mode.
    for (const key of TIP_KEYS) {
      const tip = tips[key];
      if (!tip) {
        delete this.lastTipPos[key];
        continue;
      }
      const last = this.lastTipPos[key];
      this.spawnFromTip(params, tip, last, dt);
      this.lastTipPos[key] = { x: tip.x, y: tip.y };
    }

    // 2. Step physics + cull dead particles.
    const gravityPx = params.gravity * 200; // px/s²
    const surviving: Particle[] = [];
    for (const p of this.particles) {
      p.life += dt;
      if (p.life >= p.maxLife) continue;
      p.vy += gravityPx * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      surviving.push(p);
    }
    this.particles = surviving;

    // 3. Draw.
    if (this.particles.length === 0) return;
    const prevComposite = ctx.globalCompositeOperation;
    const prevAlpha = ctx.globalAlpha;
    const prevFill = ctx.fillStyle;
    try {
      ctx.globalCompositeOperation = params.blendMode ?? "lighter";
      const baseR = params.baseRadius;
      for (const p of this.particles) {
        const t = p.life / p.maxLife;
        ctx.globalAlpha = Math.max(0, 1 - t);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, baseR * p.scale, 0, Math.PI * 2);
        ctx.fill();
      }
    } finally {
      ctx.globalCompositeOperation = prevComposite;
      ctx.globalAlpha = prevAlpha;
      ctx.fillStyle = prevFill;
    }
  }

  private spawnFromTip(
    params: Sparkles2DParams,
    tip: { x: number; y: number },
    last: { x: number; y: number } | undefined,
    dt: number,
  ): void {
    const baseCount = Math.floor(params.rate * 8 * dt * 60);
    let spawnCount = 0;
    let usePathSpawn = false;

    if (params.mode === "stream") {
      spawnCount = Math.max(1, baseCount);
    } else if (params.mode === "burst") {
      if (!last) return; // No motion data yet — wait one frame.
      const dx = tip.x - last.x;
      const dy = tip.y - last.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < BURST_MOTION_THRESHOLD) return;
      // Spawn proportional to motion.
      spawnCount = Math.max(1, Math.floor(baseCount * (1 + dist / 10)));
    } else {
      // trail mode — spawn along path between last and current.
      spawnCount = Math.max(1, baseCount);
      usePathSpawn = !!last;
    }

    for (let i = 0; i < spawnCount; i++) {
      if (this.particles.length >= MAX_PARTICLES) return;

      // Position: scattered within spread radius around tip, or along path for trail.
      let px = tip.x;
      let py = tip.y;
      if (usePathSpawn && last) {
        const t = i / spawnCount;
        px = last.x + (tip.x - last.x) * t;
        py = last.y + (tip.y - last.y) * t;
      }
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * params.spread;
      const x = px + Math.cos(angle) * r;
      const y = py + Math.sin(angle) * r;

      // Velocity: random direction × small initial speed.
      const vAngle = Math.random() * Math.PI * 2;
      const speed = 10 + Math.random() * 30;
      const vx = Math.cos(vAngle) * speed;
      const vy = Math.sin(vAngle) * speed - 20; // slight upward bias

      this.particles.push({
        x, y, vx, vy,
        life: 0,
        maxLife: params.lifetime,
        color: this.pickColor(params),
        scale: 0.6 + Math.random() * 0.8 * params.size * 2,
      });
    }
  }

  private pickColor(params: Sparkles2DParams): string {
    if (params.colorMode === "rainbow") {
      const hue = (Date.now() * 0.1) % 360;
      return `hsl(${hue}, 80%, 60%)`;
    }
    if (params.colorMode === "palette" && params.palette.length > 0) {
      const idx = Math.floor(Math.random() * params.palette.length);
      return params.palette[idx]!;
    }
    return params.color;
  }

  dispose(): void {
    this.particles = [];
    this.lastTipPos = {};
  }
}
```

- [ ] **Step 4: Run the test — confirm it passes**

```bash
npx vitest run src/lib/shared/effects/renderers/Sparkles2DRenderer.test.ts
```

Expected: PASS for all 5 cases.

- [ ] **Step 5: Commit**

```bash
git status
git add src/lib/shared/effects/renderers/Sparkles2DRenderer.ts \
        src/lib/shared/effects/renderers/Sparkles2DRenderer.test.ts
git commit -m "$(cat <<'EOF'
feat(effects): add Sparkles2DRenderer particle pool

Particle-pool simulation capped at 200 particles. Spawns from each
enabled tip per mode (stream/burst/trail), applies gravity and
per-frame decay, draws as additive-blend filled circles. Picks color
per spawn from solid/rainbow/palette modes. Tracks last tip position
for burst-mode motion detection and trail-mode path spawning.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Wire `Sparkles2DRenderer` into `AnimationEngine`

**Files:**
- Create: `src/lib/shared/animation-engine/services/contracts/ISparklesOverlayRenderer.ts`
- Create: `src/lib/shared/animation-engine/services/implementations/SparklesOverlayRenderer.ts`
- Modify: `src/lib/shared/animation-engine/services/contracts/IAnimationRenderLoop.ts` (add `sparklesRenderer` to config + `sparklesConfig` to `RenderFrameParams`)
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts` (mount + render branch)
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts` (field + intent diff cache + `syncSparklesOverlay` + render trigger)

Mirror the zap overlay end-to-end: contract interface → overlay renderer wrapping `Sparkles2DRenderer` → render loop config slot → engine field + per-intent-change cache + sync method.

- [ ] **Step 1: Create the contract**

Write `src/lib/shared/animation-engine/services/contracts/ISparklesOverlayRenderer.ts`:

```ts
/**
 * ISparklesOverlayRenderer
 *
 * Interface for the Canvas2D sparkles overlay that draws particle
 * sparkles around blue/red prop tips on top of the main animation.
 * Wraps `Sparkles2DRenderer` from `$lib/shared/effects/renderers` and
 * owns its own absolutely-positioned canvas element following the
 * trail/fire/zap overlay pattern.
 */

import type { Sparkles2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import type { SparklesTipInput } from "$lib/shared/effects/renderers/Sparkles2DRenderer";

export interface ISparklesOverlayRenderer {
  initialize(container: HTMLElement, width: number, height: number): boolean;
  resize(width: number, height: number): void;
  /** Caller passes deltaTime (seconds). Renderer manages particle pool internally. */
  renderFrame(params: Sparkles2DParams, tips: SparklesTipInput, dt: number): void;
  clear(): void;
  setVisible(visible: boolean): void;
  dispose(): void;
  isInitialized(): boolean;
  getCanvas(): HTMLCanvasElement | null;
}
```

- [ ] **Step 2: Create the implementation**

Write `src/lib/shared/animation-engine/services/implementations/SparklesOverlayRenderer.ts`:

```ts
/**
 * Sparkles Overlay Renderer
 *
 * Owns an absolutely-positioned Canvas2D element on top of the animator
 * surface and delegates per-frame drawing to `Sparkles2DRenderer`. Mirrors
 * the zap overlay pattern: position:absolute, pointer-events:none, z-index
 * sits above the trails canvas (1) but below LED.
 *
 * The overlay canvas is fully cleared each frame before drawing — Sparkles2DRenderer
 * uses additive blending, so we don't want stale particles from the previous frame
 * to fade in/out unpredictably. The renderer holds particle state across frames.
 */

import type { ISparklesOverlayRenderer } from "../contracts/ISparklesOverlayRenderer";
import type { Sparkles2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import {
  Sparkles2DRenderer,
  type SparklesTipInput,
} from "$lib/shared/effects/renderers/Sparkles2DRenderer";

export class SparklesOverlayRenderer implements ISparklesOverlayRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private renderer = new Sparkles2DRenderer();
  private width = 0;
  private height = 0;

  initialize(container: HTMLElement, width: number, height: number): boolean {
    this.dispose();

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.setAttribute("aria-hidden", "true");

    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    // Sit above the trail overlay (z-index 1) so particles render on top of trails.
    canvas.style.zIndex = "2";
    canvas.style.background = "transparent";

    const ctx = canvas.getContext("2d");
    if (!ctx) return false;

    container.appendChild(canvas);
    this.canvas = canvas;
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    return true;
  }

  resize(width: number, height: number): void {
    if (!this.canvas) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.width = width;
    this.height = height;
  }

  renderFrame(params: Sparkles2DParams, tips: SparklesTipInput, dt: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.width, this.height);
    if (!tips.bluePosA && !tips.bluePosB && !tips.redPosA && !tips.redPosB) {
      // No tips — still step physics so existing particles decay naturally.
      this.renderer.render(ctx, params, tips, dt);
      return;
    }
    this.renderer.render(ctx, params, tips, dt);
  }

  clear(): void {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  setVisible(visible: boolean): void {
    if (!this.canvas) return;
    this.canvas.style.display = visible ? "" : "none";
  }

  dispose(): void {
    if (this.canvas?.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
    this.renderer.dispose();
    this.canvas = null;
    this.ctx = null;
    this.width = 0;
    this.height = 0;
  }

  isInitialized(): boolean {
    return this.canvas !== null && this.ctx !== null;
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }
}
```

- [ ] **Step 3: Wire `sparklesRenderer` and `sparklesConfig` into the render loop contract**

In `src/lib/shared/animation-engine/services/contracts/IAnimationRenderLoop.ts`:

Add the import after line 21 (next to `IZapOverlayRenderer`):

```ts
import type { ISparklesOverlayRenderer } from "./ISparklesOverlayRenderer";
```

Add to `RenderLoopConfig` (after the `zapRenderer` line, ~52):

```ts
  /** Optional sparkles overlay renderer that draws particle sparkles around prop tips */
  sparklesRenderer?: ISparklesOverlayRenderer | null;
```

Add the type import next to the existing `Zap2DParams` import (line 23):

```ts
import type { Sparkles2DParams } from "$lib/shared/effects/translators/canvas2d-types";
```

Add to `RenderFrameParams` (after the `zapConfig` field, ~117):

```ts
  /** Sparkles overlay parameters (null or undefined = disabled) */
  sparklesConfig?: Sparkles2DParams | null;
```

- [ ] **Step 4: Wire `sparklesRenderer` through `AnimationRenderLoop`**

In `src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts`:

Add the import (next to `IZapOverlayRenderer` import, ~line 20):

```ts
import type { ISparklesOverlayRenderer } from "../contracts/ISparklesOverlayRenderer";
```

Add the field after `zapRenderer` (~line 93):

```ts
  private sparklesRenderer: ISparklesOverlayRenderer | null = null;
  private consecutiveSparklesErrors: number = 0;
  private sparklesDisabledByError: boolean = false;
```

In `initialize()` (after `this.zapRenderer = config.zapRenderer ?? null;`, ~line 180):

```ts
    this.sparklesRenderer = config.sparklesRenderer ?? null;
```

In `updateConfig()` (after the `zapRenderer` block, ~line 215):

```ts
    if (config.sparklesRenderer !== undefined)
      this.sparklesRenderer = config.sparklesRenderer ?? null;
```

In `dispose()` (after `this.zapRenderer?.dispose(); this.zapRenderer = null;`, ~line 324):

```ts
    this.sparklesRenderer?.dispose();
    this.sparklesRenderer = null;
```

In `isAnyEffectActive()` style check (~line 392, where `this.zapRenderer?.isInitialized() === true`):

Add `||` clause:

```ts
      this.zapRenderer?.isInitialized() === true ||
      this.sparklesRenderer?.isInitialized() === true;
```

In the `render()` method, add a sparkles render block immediately after the zap try/catch (~line 778). Find the pattern and append:

```ts
    // Sparkles overlay: particle sparkles around prop tips. Reads the same
    // shared tip positions as fire/charcoal/zap.
    const activeSparklesRenderer = this.sparklesRenderer?.isInitialized()
      ? this.sparklesRenderer
      : null;
    const hasSparklesOverlay =
      this.fireTipTracker && activeSparklesRenderer && params.sparklesConfig != null;

    if (
      hasSparklesOverlay &&
      !this.sparklesDisabledByError &&
      !params.suppress2DOverlays &&
      sharedTipResult
    ) {
      try {
        const tipMap = params.tipEffectMap ?? {};
        const sparklesInput: import("$lib/shared/effects/renderers/Sparkles2DRenderer").SparklesTipInput = {
          bluePosA: null,
          bluePosB: null,
          redPosA: null,
          redPosB: null,
        };
        for (const t of sharedTipResult.tips) {
          if (resolveEffect(t.propIndex, t.tipIndex, tipMap, {}) !== "sparkles") continue;
          const pos = { x: t.x, y: t.y };
          if (t.propIndex === 0) {
            if (t.tipIndex === 0) sparklesInput.bluePosA = pos;
            else if (t.tipIndex === 1) sparklesInput.bluePosB = pos;
          } else if (t.propIndex === 1) {
            if (t.tipIndex === 0) sparklesInput.redPosA = pos;
            else if (t.tipIndex === 1) sparklesInput.redPosB = pos;
          }
        }
        const dt = this.lastTrailFrameTime > 0
          ? (currentTime - this.lastTrailFrameTime) / 1000
          : 1 / 60;
        activeSparklesRenderer!.renderFrame(params.sparklesConfig!, sparklesInput, dt);
        this.consecutiveSparklesErrors = 0;
      } catch (error) {
        this.consecutiveSparklesErrors++;
        activeSparklesRenderer?.clear();
        if (this.consecutiveSparklesErrors >= AnimationRenderLoop.EFFECT_ERROR_THRESHOLD) {
          this.sparklesDisabledByError = true;
          const err = error instanceof Error ? error : new Error(String(error));
          console.error("[AnimationRenderLoop] Sparkles effect disabled after repeated failures:", err);
          if (this.onEffectError) {
            this.onEffectError("sparkles", err);
          } else {
            effectErrorSignal.trigger("sparkles", err);
          }
        } else {
          console.warn(
            `[AnimationRenderLoop] Sparkles render error (attempt ${this.consecutiveSparklesErrors}/${AnimationRenderLoop.EFFECT_ERROR_THRESHOLD}), resetting:`,
            error
          );
        }
      }
    }
```

Also in the suppression-clear block (~line 545, where zap clears on suppress):

```ts
      if (this.sparklesRenderer?.isInitialized()) {
        this.sparklesRenderer.clear();
      }
```

- [ ] **Step 5: Wire the engine's intent-diff cache and sync method**

In `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts`:

Add imports (top of file, near `resolveZap2D`):

```ts
import { resolveSparkles2D } from "$lib/shared/effects/translators/webgl3d-translator";
// (Note: imports actually live in canvas2d-translator — adjust)
```

Use the actual import path from the canvas2d translator:

```ts
import { resolveSparkles2D } from "$lib/shared/effects/translators/canvas2d-translator";
import type { Sparkles2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import { SparklesOverlayRenderer } from "./SparklesOverlayRenderer";
import type { ISparklesOverlayRenderer } from "../contracts/ISparklesOverlayRenderer";
```

Add fields next to the zap fields (~line 280):

```ts
  private sparklesRenderer: ISparklesOverlayRenderer | null = null;
  private sparklesConfig: Sparkles2DParams = resolveSparkles2D(DEFAULT_EFFECTS_CONFIG.sparkles);
  /** Reference identity cache — re-resolve only when the SparklesIntent changes. */
  private prevSparklesIntentRef: import("$lib/shared/effects/domain/EffectsConfig").SparklesIntent | null = null;
  private prevHasSparklesTips: boolean = false;
```

In `initialize()` (~line 472, near the `prevHasZapTips` line):

```ts
    this.prevHasSparklesTips = vm.hasEffect("sparkles");
```

In the effect-change detection block (~line 634, after the `hasZapTips` check):

```ts
        const hasSparklesTips = vm.hasEffect("sparkles");
        if (hasSparklesTips !== this.prevHasSparklesTips) {
          this.prevHasSparklesTips = hasSparklesTips;
          this.syncSparklesOverlay();
        }
```

In the canvas-resize block (~line 2032):

```ts
        this.sparklesRenderer?.resize(newSize, newSize);
```

In `dispose()` (~line 1402, after zap dispose):

```ts
    this.sparklesRenderer?.dispose();
    this.sparklesRenderer = null;
```

Add re-init after engine restart (~line 851, after the zap re-init):

```ts
    if (this.prevHasSparklesTips && !this.sparklesRenderer?.isInitialized()) {
      this.syncSparklesOverlay();
    }
```

Add the `syncSparklesOverlay` method right after `syncZapOverlay` (~line 1778). Mirror it exactly:

```ts
  /**
   * Initialize or destroy the sparkles overlay based on prevHasSparklesTips.
   * Mirrors syncZapOverlay — the sparkles overlay is a Canvas2D layer that
   * draws particle sparkles around prop tips on top of fire/trails.
   */
  private syncSparklesOverlay(): void {
    const enabled = this.prevHasSparklesTips;

    if (enabled) {
      if (!this.sparklesRenderer?.isInitialized()) {
        if (!this.containerElement) return;
        this.sparklesRenderer = new SparklesOverlayRenderer();
        const success = this.sparklesRenderer.initialize(
          this.containerElement,
          this.canvasSize,
          this.canvasSize
        );
        if (success) {
          this.renderLoopService?.updateConfig({
            sparklesRenderer: this.sparklesRenderer,
          });
        } else {
          this.sparklesRenderer = null;
        }
      }
    } else {
      if (this.sparklesRenderer?.isInitialized()) {
        this.sparklesRenderer.dispose();
        this.sparklesRenderer = null;
      }
      this.renderLoopService?.updateConfig({ sparklesRenderer: null });
    }

    if (this.renderLoopService && this.lastPropsRef) {
      this.renderLoopService.triggerRender(() =>
        this.getFrameParams(this.lastPropsRef ?? DEFAULT_ENGINE_PROPS)
      );
    }
  }
```

In `getFrameParams` (~line 2304, immediately after the zap intent-diff block):

```ts
    // Sparkles overlay config — re-resolve when SparklesIntent changes.
    // Reference-identity check (Phase 1b pattern) — cheaper than JSON diff and
    // safe because EffectsConfigState assigns a fresh object on every updateSparkles.
    if (this.effectsConfigState) {
      const intent = this.effectsConfigState.sparkles;
      if (intent !== this.prevSparklesIntentRef) {
        this.prevSparklesIntentRef = intent;
        this.sparklesConfig = resolveSparkles2D(intent);
      }
    }
    fp.sparklesConfig = this.prevHasSparklesTips ? this.sparklesConfig : null;
```

Add `sparklesConfig: null,` to the default-frame-params object literal (~line 394).

- [ ] **Step 6: Run typecheck**

```bash
npm run check 2>&1 | grep -iE "sparkles|Sparkles" | head -30
```

Expected: empty (or only the Customize/preset call sites Tasks 7-9 will fix). Address any AnimationEngine/AnimationRenderLoop errors before continuing.

- [ ] **Step 7: Run all effects + animation-engine tests**

```bash
npx vitest run src/lib/shared/effects/ src/lib/shared/animation-engine/
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git status
git add src/lib/shared/animation-engine/services/contracts/ISparklesOverlayRenderer.ts \
        src/lib/shared/animation-engine/services/implementations/SparklesOverlayRenderer.ts \
        src/lib/shared/animation-engine/services/contracts/IAnimationRenderLoop.ts \
        src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts \
        src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts
git commit -m "$(cat <<'EOF'
feat(effects): wire Sparkles2DRenderer through AnimationEngine

Adds ISparklesOverlayRenderer + SparklesOverlayRenderer following the
zap overlay pattern. Threads sparklesRenderer + sparklesConfig through
RenderLoopConfig and RenderFrameParams. Engine caches the resolved
Sparkles2DParams via reference identity on the live SparklesIntent and
calls syncSparklesOverlay when vm.hasEffect("sparkles") flips.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Wire 3D `SparkleEmitter` mounts in `EffectsLayer.svelte` to unified intent

**Files:**
- Modify: `src/lib/shared/3d/effects/EffectsLayer.svelte:295-331`

The current 3D sparkles block reads from the legacy `configState.sparkles` (`enabled`, `rate`, `size`). Switch to the unified `EffectsConfigState.sparkles` so the new `colorMode`/`palette`/`color`/`spread` fields drive the 3D emitters. The 3D `SparkleEmitter` already accepts `position, enabled, intensity, color, spread` — leave its hardcoded `GRAVITY=30` alone (deferred per spec).

Pass `intensity = sparkles.rate`, `spread = sparkles.spread`, and `color` derived per-emitter:
- `colorMode === "solid"`: all four emitters use `params.color`.
- `colorMode === "palette"`: emitter index `i` uses `params.palette[i % palette.length]`.
- `colorMode === "rainbow"`: pass a derived hsl string per render — for v1 just rotate hue by emitter index.

Gate visibility by `unifiedState.config.tipEffectMap["*"]?.effect === "sparkles"` (mirror the existing `zapEnabled` derivation, lines 53-55).

- [ ] **Step 1: Update the imports + add the resolver**

At the top of the script block (after the existing `resolveZap3D` import, line 18):

```ts
  import { resolveSparkles3D } from "$lib/shared/effects/translators/webgl3d-translator";
```

Add derived state next to `zap3D` (~line 52-55):

```ts
  const sparkles3D = $derived(unifiedState ? resolveSparkles3D(unifiedState.sparkles) : null);
  const sparklesEnabled = $derived(
    unifiedState ? unifiedState.config.tipEffectMap["*"]?.effect === "sparkles" : false,
  );

  function pickSparkleColor(i: number): string {
    if (!sparkles3D) return "#ffffff";
    if (sparkles3D.colorMode === "solid") return sparkles3D.color;
    if (sparkles3D.colorMode === "palette" && sparkles3D.palette.length > 0) {
      return sparkles3D.palette[i % sparkles3D.palette.length]!;
    }
    // rainbow mode — rotate hue by emitter index
    const hue = (Date.now() * 0.05 + i * 90) % 360;
    return `hsl(${hue}, 80%, 60%)`;
  }
```

- [ ] **Step 2: Replace the 3D sparkles render block (lines 295-331)**

```svelte
{#if sparklesEnabled && sparkles3D && isPlaying}
  {#if blueEnds}
    <SparkleEmitter
      position={blueEnds.positive}
      enabled={true}
      intensity={sparkles3D.rate}
      color={pickSparkleColor(0)}
      spread={sparkles3D.spread}
    />
    <SparkleEmitter
      position={blueEnds.negative}
      enabled={true}
      intensity={sparkles3D.rate * 0.7}
      color={pickSparkleColor(1)}
      spread={sparkles3D.spread * 0.75}
    />
  {/if}

  {#if redEnds}
    <SparkleEmitter
      position={redEnds.positive}
      enabled={true}
      intensity={sparkles3D.rate}
      color={pickSparkleColor(2)}
      spread={sparkles3D.spread}
    />
    <SparkleEmitter
      position={redEnds.negative}
      enabled={true}
      intensity={sparkles3D.rate * 0.7}
      color={pickSparkleColor(3)}
      spread={sparkles3D.spread * 0.75}
    />
  {/if}
{/if}
```

- [ ] **Step 3: Run typecheck**

```bash
npm run check 2>&1 | grep -iE "EffectsLayer|sparkles3D|sparklesEnabled" | head -10
```

Expected: empty.

- [ ] **Step 4: Build to confirm Svelte compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git status
git add src/lib/shared/3d/effects/EffectsLayer.svelte
git commit -m "$(cat <<'EOF'
feat(effects-3d): wire SparkleEmitter mounts to unified sparkles intent

Replaces the legacy configState.sparkles read with the unified
EffectsConfigState.sparkles + resolveSparkles3D resolver. Each of the
four tip emitters picks color via the new colorMode (solid/palette/
rainbow). Spread comes from the new spread field. Gravity stays
hardcoded in SparkleEmitter for now — wiring params.gravity is
deferred per spec.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Build the sparkles preset group

**Files:**
- Create: `src/lib/shared/animation-engine/components/effects-panel/presets/sparkles-presets.ts`
- Modify: `src/lib/shared/animation-engine/components/effects-panel/presets/index.ts` (only if it has a registry — verify first)

Mirror `zap-presets.ts` structure: an `applySparkles(state, presetId, patch)` helper that calls `state.updateSparkles(patch)` then `state.applyPreset({ ... activePresets ... })` to keep the chip highlighted. Three named presets + Custom.

- [ ] **Step 1: Audit the preset registry**

```bash
grep -rn "ZAP_PRESET_GROUP\|SPARKLES_PRESET_GROUP\|getPresetGroup" src/lib/shared/animation-engine/components/effects-panel/ | head -20
```

Note where preset groups are registered. Sparkles will need parallel registration.

- [ ] **Step 2: Create `sparkles-presets.ts`**

Write `src/lib/shared/animation-engine/components/effects-panel/presets/sparkles-presets.ts`:

```ts
import type { EffectPreset, EffectPresetGroup } from "./types";
import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import type { SparklesIntent } from "$lib/shared/effects/domain/EffectsConfig";
import type { EffectsPreset } from "$lib/shared/effects/domain/EffectsPreset";

function applySparkles(
  state: EffectsConfigState | null,
  presetId: string,
  patch: Partial<SparklesIntent>,
): void {
  if (!state) return;
  state.updateSparkles(patch);
  // updateSparkles nulls activePresets.sparkles; restore it so the chip stays highlighted.
  state.applyPreset({
    id: presetId,
    effectType: "sparkles",
    patch: { activePresets: { ...state.activePresets, sparkles: presetId } },
  } as unknown as EffectsPreset);
}

export const SPARKLES_PRESETS: EffectPreset[] = [
  {
    id: "sparkles-fairy-dust",
    name: "Fairy Dust",
    previewColor: "#fde047",
    apply: (_vm, state) => applySparkles(state, "sparkles-fairy-dust", {
      rate: 0.4, size: 0.4, lifetime: 1.8,
      color: "#fde047", colorMode: "solid",
      spread: 10, gravity: 0.1, mode: "stream",
    }),
  },
  {
    id: "sparkles-pixie",
    name: "Pixie Sparks",
    previewColor: "#67e8f9",
    apply: (_vm, state) => applySparkles(state, "sparkles-pixie", {
      rate: 0.8, size: 0.3, lifetime: 0.6,
      color: "#67e8f9", colorMode: "solid",
      spread: 6, gravity: 0.5, mode: "burst",
    }),
  },
  {
    id: "sparkles-confetti",
    name: "Confetti",
    previewColor: "#ec4899",
    apply: (_vm, state) => applySparkles(state, "sparkles-confetti", {
      rate: 0.7, size: 0.6, lifetime: 2.0,
      colorMode: "palette",
      palette: ["#ec4899", "#22d3ee", "#fbbf24", "#22c55e", "#a855f7"],
      spread: 12, gravity: 0.8, mode: "burst",
    }),
  },
  {
    id: "sparkles-custom",
    name: "Custom",
    previewColor: "custom",
    apply: () => {
      // "Custom" just opens the Customize panel — EffectsPanel routes Custom → customizeOpen.
    },
  },
];

export const SPARKLES_PRESET_GROUP: EffectPresetGroup = {
  effectType: "sparkles",
  presets: SPARKLES_PRESETS,
  getSummary: (_vm, state) => {
    if (!state) return "";
    const s = state.sparkles;
    return `${s.mode} · ${Math.round(s.rate * 100)}% · ${s.lifetime}s`;
  },
};
```

- [ ] **Step 3: Register the new group in the preset registry**

If Step 1 found a central `getPresetGroup` switch (likely in `presets/index.ts` or `EffectsPanel.svelte`), add the sparkles entry. Modify the dispatcher so `activeEffect === "sparkles"` returns `SPARKLES_PRESET_GROUP`.

- [ ] **Step 4: Run typecheck**

```bash
npm run check 2>&1 | grep -iE "sparkles-presets|SPARKLES_PRESET" | head -10
```

Expected: empty.

- [ ] **Step 5: Commit**

```bash
git status
git add src/lib/shared/animation-engine/components/effects-panel/presets/sparkles-presets.ts
# Add the registry file too if Step 3 modified it
git commit -m "$(cat <<'EOF'
feat(effects-ui): add sparkles preset group with three named presets

Fairy Dust (slow yellow stream, low gravity), Pixie Sparks (fast cyan
burst, high gravity), Confetti (rainbow palette burst). Mirrors the
zap-presets.ts pattern: applySparkles helper calls updateSparkles
then re-asserts activePresets via applyPreset so the chip stays
highlighted on click.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Build `SparklesCustomize.svelte`

**Files:**
- Create: `src/lib/shared/animation-engine/components/effects-panel/customize/SparklesCustomize.svelte`

Inline the canonical patterns from `ZapCustomize.svelte`. Layout, top-to-bottom:
- Mode chip row (Burst / Stream / Trail).
- Color mode chip row (Solid / Rainbow / Palette).
- Conditional color picker block:
  - `solid` → one circular swatch.
  - `palette` → 5 circular swatches (fixed at 5 for v1; add/remove deferred).
  - `rainbow` → no picker.
- Sliders: Rate, Size, Lifetime, Spread, Gravity.

- [ ] **Step 1: Create the file**

Write `src/lib/shared/animation-engine/components/effects-panel/customize/SparklesCustomize.svelte`. Start from `ZapCustomize.svelte` as the structural template (chip-row pattern, slider-row pattern, color-picker pattern, all styling inline in a single `<style>` block):

```svelte
<script lang="ts">
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";

  interface Props {
    onBack: () => void;
  }

  const { onBack }: Props = $props();
  const state = getEffectsConfigContext();

  // Ensure palette has exactly 5 entries for the swatch row (v1 — add/remove deferred).
  function paletteAt(i: number): string {
    if (!state) return "#ffffff";
    return state.sparkles.palette[i] ?? "#ffffff";
  }
  function setPaletteAt(i: number, value: string) {
    if (!state) return;
    const next = [...state.sparkles.palette];
    while (next.length <= i) next.push("#ffffff");
    next[i] = value;
    state.updateSparkles({ palette: next });
  }
</script>

<div class="customize-view">
  <button type="button" class="back-btn" onclick={onBack}>
    <i class="fas fa-arrow-left" aria-hidden="true"></i>
    Back to presets
  </button>

  {#if state}
    <div class="sparkles-controls">
      <!-- Mode chip row -->
      <div class="option-row">
        <span class="option-label">Mode</span>
        <div class="chip-group" role="radiogroup" aria-label="Sparkle mode">
          <button
            class="chip"
            class:active={state.sparkles.mode === "burst"}
            type="button"
            role="radio"
            aria-checked={state.sparkles.mode === "burst"}
            onclick={() => state.updateSparkles({ mode: "burst" })}
          >
            <i class="fas fa-bolt" aria-hidden="true"></i>
            Burst
          </button>
          <button
            class="chip"
            class:active={state.sparkles.mode === "stream"}
            type="button"
            role="radio"
            aria-checked={state.sparkles.mode === "stream"}
            onclick={() => state.updateSparkles({ mode: "stream" })}
          >
            <i class="fas fa-water" aria-hidden="true"></i>
            Stream
          </button>
          <button
            class="chip"
            class:active={state.sparkles.mode === "trail"}
            type="button"
            role="radio"
            aria-checked={state.sparkles.mode === "trail"}
            onclick={() => state.updateSparkles({ mode: "trail" })}
          >
            <i class="fas fa-route" aria-hidden="true"></i>
            Trail
          </button>
        </div>
      </div>

      <!-- Color mode chip row -->
      <div class="option-row">
        <span class="option-label">Color</span>
        <div class="chip-group" role="radiogroup" aria-label="Sparkle color mode">
          <button
            class="chip"
            class:active={state.sparkles.colorMode === "solid"}
            type="button"
            role="radio"
            aria-checked={state.sparkles.colorMode === "solid"}
            onclick={() => state.updateSparkles({ colorMode: "solid" })}
          >
            Solid
          </button>
          <button
            class="chip"
            class:active={state.sparkles.colorMode === "rainbow"}
            type="button"
            role="radio"
            aria-checked={state.sparkles.colorMode === "rainbow"}
            onclick={() => state.updateSparkles({ colorMode: "rainbow" })}
          >
            Rainbow
          </button>
          <button
            class="chip"
            class:active={state.sparkles.colorMode === "palette"}
            type="button"
            role="radio"
            aria-checked={state.sparkles.colorMode === "palette"}
            onclick={() => state.updateSparkles({ colorMode: "palette" })}
          >
            Palette
          </button>
        </div>
      </div>

      {#if state.sparkles.colorMode === "solid"}
        <div class="color-row">
          <span class="color-label">Tint</span>
          <div class="color-pickers">
            <label class="color-picker">
              <input
                type="color"
                value={state.sparkles.color}
                oninput={(e) => state.updateSparkles({ color: (e.currentTarget as HTMLInputElement).value })}
              />
            </label>
          </div>
        </div>
      {:else if state.sparkles.colorMode === "palette"}
        <div class="color-row">
          <span class="color-label">Palette</span>
          <div class="color-pickers">
            {#each [0, 1, 2, 3, 4] as i (i)}
              <label class="color-picker">
                <input
                  type="color"
                  value={paletteAt(i)}
                  oninput={(e) => setPaletteAt(i, (e.currentTarget as HTMLInputElement).value)}
                />
              </label>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Rate -->
      <div class="slider-row">
        <label for="sparkles-rate">Rate</label>
        <input
          id="sparkles-rate"
          type="range" min="0" max="1" step="0.05"
          value={state.sparkles.rate}
          oninput={(e) => state.updateSparkles({ rate: +(e.currentTarget as HTMLInputElement).value })}
        />
        <span class="slider-value">{Math.round(state.sparkles.rate * 100)}%</span>
      </div>

      <!-- Size -->
      <div class="slider-row">
        <label for="sparkles-size">Size</label>
        <input
          id="sparkles-size"
          type="range" min="0" max="1" step="0.05"
          value={state.sparkles.size}
          oninput={(e) => state.updateSparkles({ size: +(e.currentTarget as HTMLInputElement).value })}
        />
        <span class="slider-value">{Math.round(state.sparkles.size * 100)}%</span>
      </div>

      <!-- Lifetime -->
      <div class="slider-row">
        <label for="sparkles-lifetime">Lifetime</label>
        <input
          id="sparkles-lifetime"
          type="range" min="0.1" max="3" step="0.1"
          value={state.sparkles.lifetime}
          oninput={(e) => state.updateSparkles({ lifetime: +(e.currentTarget as HTMLInputElement).value })}
        />
        <span class="slider-value">{state.sparkles.lifetime.toFixed(1)}s</span>
      </div>

      <!-- Spread -->
      <div class="slider-row">
        <label for="sparkles-spread">Spread</label>
        <input
          id="sparkles-spread"
          type="range" min="0" max="30" step="1"
          value={state.sparkles.spread}
          oninput={(e) => state.updateSparkles({ spread: +(e.currentTarget as HTMLInputElement).value })}
        />
        <span class="slider-value">{state.sparkles.spread}px</span>
      </div>

      <!-- Gravity -->
      <div class="slider-row">
        <label for="sparkles-gravity">Gravity</label>
        <input
          id="sparkles-gravity"
          type="range" min="0" max="1" step="0.05"
          value={state.sparkles.gravity}
          oninput={(e) => state.updateSparkles({ gravity: +(e.currentTarget as HTMLInputElement).value })}
        />
        <span class="slider-value">{Math.round(state.sparkles.gravity * 100)}%</span>
      </div>
    </div>
  {:else}
    <p class="empty">Effect state unavailable.</p>
  {/if}
</div>

<style>
  .customize-view {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    min-height: 44px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: all var(--duration-fast, 100ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .back-btn:hover {
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
    color: var(--theme-text, white);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .back-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .back-btn i {
    font-size: 12px;
  }

  @media (prefers-reduced-motion: reduce) {
    .back-btn,
    .chip {
      transition: none;
    }
  }

  .sparkles-controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .option-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
  }

  .option-label {
    min-width: 70px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    flex-shrink: 0;
  }

  .chip-group {
    display: flex;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }

  .chip {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: var(--min-touch-target, 44px);
    padding: 8px 8px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast, 100ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .chip:hover {
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, white);
  }

  .chip.active {
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border-color: var(--theme-accent, #8b5cf6);
    color: var(--theme-text, white);
  }

  .chip:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .chip i {
    font-size: 14px;
  }

  .slider-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
  }

  .slider-row label {
    min-width: 70px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .slider-row input[type="range"] {
    flex: 1;
    accent-color: var(--theme-accent, #8b5cf6);
  }

  .slider-value {
    min-width: 40px;
    text-align: right;
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text, white);
  }

  .color-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
  }

  .color-label {
    min-width: 70px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .color-pickers {
    display: flex;
    gap: 8px;
    flex: 1;
    flex-wrap: wrap;
  }

  .color-picker {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  .color-picker input[type="color"] {
    -webkit-appearance: none;
    appearance: none;
    width: 32px;
    height: 32px;
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 50%;
    background: none;
    cursor: pointer;
    padding: 0;
  }

  .color-picker input[type="color"]::-webkit-color-swatch-wrapper {
    padding: 2px;
  }

  .color-picker input[type="color"]::-webkit-color-swatch {
    border: none;
    border-radius: 50%;
  }

  .color-picker input[type="color"]::-moz-color-swatch {
    border: none;
    border-radius: 50%;
  }

  .empty {
    opacity: 0.6;
    font-size: var(--font-size-min, 14px);
    padding: 4px 0;
  }
</style>
```

- [ ] **Step 2: Run typecheck**

```bash
npm run check 2>&1 | grep -iE "SparklesCustomize" | head -10
```

Expected: empty.

- [ ] **Step 3: Build to confirm Svelte compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git status
git add src/lib/shared/animation-engine/components/effects-panel/customize/SparklesCustomize.svelte
git commit -m "$(cat <<'EOF'
feat(effects-ui): add SparklesCustomize panel

Mode chip row (Burst/Stream/Trail), color mode chip row
(Solid/Rainbow/Palette), conditional color picker block (single
swatch for solid, 5-swatch row for palette, none for rainbow), and
sliders for rate/size/lifetime/spread/gravity. Inlines the canonical
ZapCustomize patterns rather than extracting a shared component.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Wire `EffectsPanel` to route `sparkles` → `SparklesCustomize`

**Files:**
- Modify: `src/lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte:14, 238-239`

Replace the `ComingSoonCustomize` branch for sparkles with the new `SparklesCustomize`.

- [ ] **Step 1: Add the import**

After the existing `ZapCustomize` import (around line 14):

```ts
  import SparklesCustomize from "./customize/SparklesCustomize.svelte";
```

- [ ] **Step 2: Update the routing branch**

Replace lines 238-239:

```svelte
      {:else if activeEffect === "sparkles"}
        <SparklesCustomize onBack={() => (customizeOpen = false)} />
```

(Remove only the sparkles ComingSoon line — keep `motion` and `bloom` ComingSoon branches intact.)

- [ ] **Step 3: Run typecheck**

```bash
npm run check 2>&1 | grep -iE "EffectsPanel|SparklesCustomize" | head -10
```

Expected: empty.

- [ ] **Step 4: Build**

```bash
npm run build 2>&1 | tail -10
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git status
git add src/lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte
git commit -m "$(cat <<'EOF'
feat(effects-ui): route sparkles Customize to SparklesCustomize

Replaces the ComingSoonCustomize placeholder. Motion and Bloom stay on
ComingSoon until their phases land.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Final test suite + typecheck + build

**Files:**
- No code changes. Final verification.

- [ ] **Step 1: Run the full effects + animation-engine test suite**

```bash
npx vitest run src/lib/shared/effects/ src/lib/shared/animation-engine/
```

Expected: all PASS.

- [ ] **Step 2: Run typecheck**

```bash
npm run check 2>&1 | tail -10
```

Expected: 0 errors. If sparkles-related errors remain, find and fix the call site (`grep -r "sparkles\.rainbow" src/`).

- [ ] **Step 3: Build**

```bash
npm run build 2>&1 | tail -5
```

Expected: build succeeds.

- [ ] **Step 4: NO commit** if everything passes

If a residual fix was needed, commit it scoped to the affected file with a `chore(effects)` message.

---

## Task 11 (skipped — parent agent runs visual verification via Chrome DevTools MCP)

Per the orchestrator instructions, do NOT execute Task 11. The parent agent will verify Lab → Sparkle → each preset visually after this plan completes.

---

## Self-Review

**Spec coverage:**
1. Extend SparklesIntent + bump version + migration — Task 1
2. Update defaults — Task 1 (bundled)
3. 2D translator types + resolver — Task 2
4. 3D translator types + resolver — Task 3
5. Sparkles2DRenderer + tests — Task 4
6. Engine wiring — Task 5
7. 3D EffectsLayer mounts — Task 6
8. Preset group — Task 7
9. SparklesCustomize — Task 8
10. EffectsPanel routing — Task 9
11. Visual verification — deferred to parent agent

**Test plan from spec:**
- migrations.test.ts v3→v4 case — Task 1
- canvas2d-translator.test.ts per-field passthrough — Task 2
- Sparkles2DRenderer.test.ts pool cap, lifetime decay, palette cycling, burst stationarity, dispose — Task 4

**Non-goals confirmed deferred:**
- params.gravity wiring into 3D SparkleEmitter (still hardcoded GRAVITY=30)
- Add/remove buttons on palette swatch row (fixed at 5 for v1)
- Velocity-aware burst mode in 3D (3D emitter always-spawns)
- Sparkles in legacy EffectsSettingsPanel (Phase 3 retires it)

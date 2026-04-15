# Effects Unification — Phase 1a: Foundation + Zap Vertical Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the unified `EffectsConfig` to carry Zap/Sparkles/Motion/Bloom intent shape, land an 8-chip 4×2 `EffectSelector` with click-to-deselect, and ship a complete Zap vertical slice (2D canvas renderer + 3D wiring via translator) that proves the pipeline. Sparkles/Motion/Bloom chips render as placeholders until their own phase plans land.

**Architecture:** Unified intent layer stays the single source of truth. Each new effect gets Intent type → translator → renderer. Zap 2D uses plain canvas with midpoint-displacement lightning. Zap 3D reuses the existing `ElectricityArc.svelte` but its props come from the `resolveZap3D` translator instead of the legacy `ElectricityConfig` state. Chip grid becomes 4×2 CSS grid; removing "None" means the active chip toggles off on second click.

**Tech Stack:** TypeScript + Svelte 5 (runes), Threlte 3D, plain Canvas 2D for Zap rendering, existing Three.js `ElectricityArc.svelte` for 3D. Vitest for translator unit tests. Chrome DevTools MCP for visual verification.

**Reference spec:** `docs/superpowers/specs/2026-04-15-effects-unification-design.md`

---

## File Structure

**New files:**

| Path | Responsibility |
|------|----------------|
| `src/lib/shared/effects/domain/migrations.ts` | v1→v2 `EffectsConfig` migration function |
| `src/lib/shared/effects/renderers/Zap2DRenderer.ts` | 2D canvas lightning renderer (midpoint displacement) |
| `src/lib/shared/animation-engine/components/effects-panel/presets/zap-presets.ts` | Zap preset group (Thunder, Tesla, Plasma, Custom) |
| `src/lib/shared/animation-engine/components/effects-panel/customize/ZapCustomize.svelte` | Advanced Zap controls (intensity, frequency, color, mode, branching) |
| `src/lib/shared/animation-engine/components/effects-panel/customize/ComingSoonCustomize.svelte` | Placeholder Customize for Sparkles/Motion/Bloom |
| `tests/unit/effects/translators/zap-translator.test.ts` | `resolveZap2D` / `resolveZap3D` unit tests |
| `tests/unit/effects/migrations.test.ts` | v1→v2 migration unit tests |

**Modified files:**

| Path | Responsibility |
|------|----------------|
| `src/lib/shared/effects/domain/EffectsConfig.ts` | Add 4 Intent types, extend `EffectType`, `EffectsConfig`, `EffectsOverrides`. Bump version to 2. |
| `src/lib/shared/effects/domain/defaults.ts` | Add default values for `zap`, `sparkles`, `motion`, `bloom`. Include new entries in `activePresets`. |
| `src/lib/shared/effects/state/effects-config-state.svelte.ts` | Add `updateZap`/`updateSparkles`/`updateMotion`/`updateBloom` methods + extend `mergeConfig`. |
| `src/lib/shared/effects/translators/canvas2d-types.ts` | Add `Zap2DParams`, `Sparkles2DParams`, `Motion2DParams`, `Bloom2DParams`. |
| `src/lib/shared/effects/translators/canvas2d-translator.ts` | Add `resolveZap2D` + stubs for the other three (throw-on-call for now). |
| `src/lib/shared/effects/translators/webgl3d-types.ts` | Add `Zap3DParams` etc. |
| `src/lib/shared/effects/translators/webgl3d-translator.ts` | Add `resolveZap3D` + stubs. |
| `src/lib/shared/animation-engine/components/effects-panel/EffectSelector.svelte` | Switch layout to 4×2 CSS grid. Drop "None" chip. Add Zap/Sparkles/Motion/Bloom entries. |
| `src/lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte` | `handleEffectSelect` toggles off if clicking active chip. Register zap preset group + ZapCustomize; register placeholders for the other three. |
| `src/lib/shared/3d/effects/EffectsLayer.svelte` | Wire `ElectricityArc` props from `resolveZap3D(configState.zap)` instead of legacy `configState.electricity`. |

---

## Task 1: Extend Intent types in `EffectsConfig.ts`

**Files:**
- Modify: `src/lib/shared/effects/domain/EffectsConfig.ts`

- [ ] **Step 1: Add new Intent interfaces after `CharcoalIntent`**

In `src/lib/shared/effects/domain/EffectsConfig.ts`, after the `CharcoalIntent` block (around line 75), add:

```ts
export interface ZapIntent {
  /** 0-1 — overall arc brightness + branch count. */
  intensity: number;
  /** Hex string, e.g. "#88ccff". */
  color: string;
  /** 1-30 strikes per second. */
  frequency: number;
  /** 'arc' = tip-to-tip arc. 'crackle' = radiate from each tip. */
  mode: "arc" | "crackle";
  /** 0-1 — probability each arc segment spawns a branch. */
  branching: number;
}

export interface SparklesIntent {
  /** 0-1 — particle spawn rate multiplier. */
  rate: number;
  /** 0-1 — particle scale multiplier. */
  size: number;
  /** 0.1-3.0 seconds. */
  lifetime: number;
  /** Hex string — primary tint. Ignored when `rainbow` is true. */
  color: string;
  /** Hue-cycle override. */
  rainbow: boolean;
}

export interface MotionIntent {
  /** 0-1 — trailing blur strength. */
  blur: number;
  /** 0-1 — velocity-based streak strength. */
  speedLines: number;
  /** 0-1 — min hand speed before effect kicks in (normalized). */
  threshold: number;
}

export interface BloomIntent {
  /** 0-1 — overall glow. */
  intensity: number;
  /** 0-1 — luminance cutoff (only pixels brighter than this bloom). */
  threshold: number;
  /** 0-1 — blur spread / kernel size. */
  radius: number;
}
```

- [ ] **Step 2: Extend `EffectType` union**

Replace:
```ts
export type EffectType = "none" | "trails" | "fire" | "led" | "charcoal";
```
with:
```ts
export type EffectType =
  | "none"
  | "trails"
  | "fire"
  | "led"
  | "charcoal"
  | "zap"
  | "sparkles"
  | "motion"
  | "bloom";
```

- [ ] **Step 3: Extend `EffectsConfig` interface**

Add the four new intent fields and extend `activePresets`:

```ts
export interface EffectsConfig {
  version: number;
  tipEffectMap: TipEffectMap;
  trails: TrailsIntent;
  fire: FireIntent;
  led: LedIntent;
  charcoal: CharcoalIntent;
  zap: ZapIntent;
  sparkles: SparklesIntent;
  motion: MotionIntent;
  bloom: BloomIntent;
  activePresets: {
    trails: string | null;
    fire: string | null;
    led: string | null;
    charcoal: string | null;
    zap: string | null;
    sparkles: string | null;
    motion: string | null;
    bloom: string | null;
  };
  overrides?: EffectsOverrides;
}
```

- [ ] **Step 4: Extend `EffectsOverrides` interface**

Add eight new override slots:

```ts
export interface EffectsOverrides {
  trails2D?: Record<string, unknown>;
  trails3D?: Record<string, unknown>;
  fire2D?: Record<string, unknown>;
  fire3D?: Record<string, unknown>;
  led2D?: Record<string, unknown>;
  led3D?: Record<string, unknown>;
  charcoal2D?: Record<string, unknown>;
  charcoal3D?: Record<string, unknown>;
  zap2D?: Record<string, unknown>;
  zap3D?: Record<string, unknown>;
  sparkles2D?: Record<string, unknown>;
  sparkles3D?: Record<string, unknown>;
  motion2D?: Record<string, unknown>;
  motion3D?: Record<string, unknown>;
  bloom2D?: Record<string, unknown>;
  bloom3D?: Record<string, unknown>;
}
```

- [ ] **Step 5: Bump version constant**

Replace `export const EFFECTS_CONFIG_VERSION = 1;` with `export const EFFECTS_CONFIG_VERSION = 2;`.

- [ ] **Step 6: Run typecheck**

Run: `npm run check`
Expected: Several errors in `defaults.ts`, `effects-config-state.svelte.ts`, `animation-settings-shim.ts`, `vm-shim.ts` — any consumer that builds an `EffectsConfig` object is now missing fields. These are fixed in later tasks.

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/effects/domain/EffectsConfig.ts
git commit -m "feat(effects): add Zap/Sparkles/Motion/Bloom intent types"
```

---

## Task 2: Extend `DEFAULT_EFFECTS_CONFIG`

**Files:**
- Modify: `src/lib/shared/effects/domain/defaults.ts`

- [ ] **Step 1: Add default Intent blocks**

In `src/lib/shared/effects/domain/defaults.ts`, after the `charcoal` block inside `DEFAULT_EFFECTS_CONFIG`, add:

```ts
  zap: {
    intensity: 0.7,
    color: "#88ccff",
    frequency: 12,
    mode: "arc",
    branching: 0.3,
  },

  sparkles: {
    rate: 0.5,
    size: 0.5,
    lifetime: 1.2,
    color: "#fbbf24",
    rainbow: false,
  },

  motion: {
    blur: 0.4,
    speedLines: 0.5,
    threshold: 0.2,
  },

  bloom: {
    intensity: 0.6,
    threshold: 0.7,
    radius: 0.5,
  },
```

- [ ] **Step 2: Extend `activePresets`**

Update the `activePresets` block to include the four new keys:

```ts
  activePresets: {
    trails: null,
    fire: null,
    led: null,
    charcoal: null,
    zap: null,
    sparkles: null,
    motion: null,
    bloom: null,
  },
```

- [ ] **Step 3: Verify typecheck passes in this file**

Run: `npm run check -- src/lib/shared/effects/domain/defaults.ts`
Expected: no errors in `defaults.ts` (other files still have errors — that's fine).

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/effects/domain/defaults.ts
git commit -m "feat(effects): default values for Zap/Sparkles/Motion/Bloom intents"
```

---

## Task 3: Config migration (v1 → v2)

**Files:**
- Create: `src/lib/shared/effects/domain/migrations.ts`
- Test: `tests/unit/effects/migrations.test.ts`

- [ ] **Step 1: Write failing migration test**

Create `tests/unit/effects/migrations.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { migrateEffectsConfig } from "../../../src/lib/shared/effects/domain/migrations";
import { DEFAULT_EFFECTS_CONFIG } from "../../../src/lib/shared/effects/domain/defaults";

describe("migrateEffectsConfig", () => {
  it("returns v2 config untouched", () => {
    const v2 = structuredClone(DEFAULT_EFFECTS_CONFIG);
    const result = migrateEffectsConfig(v2);
    expect(result).toEqual(v2);
  });

  it("adds missing zap/sparkles/motion/bloom to v1 config", () => {
    const v1: Record<string, unknown> = {
      version: 1,
      tipEffectMap: { "*": { effect: "trails" } },
      trails: DEFAULT_EFFECTS_CONFIG.trails,
      fire: DEFAULT_EFFECTS_CONFIG.fire,
      led: DEFAULT_EFFECTS_CONFIG.led,
      charcoal: DEFAULT_EFFECTS_CONFIG.charcoal,
      activePresets: { trails: null, fire: null, led: null, charcoal: null },
    };
    const result = migrateEffectsConfig(v1);
    expect(result.version).toBe(2);
    expect(result.zap).toEqual(DEFAULT_EFFECTS_CONFIG.zap);
    expect(result.sparkles).toEqual(DEFAULT_EFFECTS_CONFIG.sparkles);
    expect(result.motion).toEqual(DEFAULT_EFFECTS_CONFIG.motion);
    expect(result.bloom).toEqual(DEFAULT_EFFECTS_CONFIG.bloom);
    expect(result.activePresets.zap).toBeNull();
    expect(result.activePresets.sparkles).toBeNull();
    expect(result.activePresets.motion).toBeNull();
    expect(result.activePresets.bloom).toBeNull();
  });

  it("preserves existing v1 values for trails/fire/led/charcoal", () => {
    const v1: Record<string, unknown> = {
      version: 1,
      tipEffectMap: { "*": { effect: "fire" } },
      trails: { ...DEFAULT_EFFECTS_CONFIG.trails, thickness: 10 },
      fire: { ...DEFAULT_EFFECTS_CONFIG.fire, intensity: 0.9 },
      led: DEFAULT_EFFECTS_CONFIG.led,
      charcoal: DEFAULT_EFFECTS_CONFIG.charcoal,
      activePresets: { trails: null, fire: "fire-intense", led: null, charcoal: null },
    };
    const result = migrateEffectsConfig(v1);
    expect(result.trails.thickness).toBe(10);
    expect(result.fire.intensity).toBe(0.9);
    expect(result.activePresets.fire).toBe("fire-intense");
  });
});
```

- [ ] **Step 2: Run test — confirm failure**

Run: `npx vitest run tests/unit/effects/migrations.test.ts`
Expected: FAIL — `migrations` module not found.

- [ ] **Step 3: Write `migrateEffectsConfig`**

Create `src/lib/shared/effects/domain/migrations.ts`:

```ts
import type { EffectsConfig } from "./EffectsConfig";
import { EFFECTS_CONFIG_VERSION } from "./EffectsConfig";
import { DEFAULT_EFFECTS_CONFIG } from "./defaults";

/**
 * Migrate an arbitrary stored EffectsConfig up to the current version.
 * Safe to call on a current-version config (returns it unchanged after
 * a structural clone).
 */
export function migrateEffectsConfig(raw: unknown): EffectsConfig {
  if (!raw || typeof raw !== "object") {
    return structuredClone(DEFAULT_EFFECTS_CONFIG);
  }
  const input = raw as Partial<EffectsConfig> & { version?: number };
  const version = input.version ?? 1;

  let out: EffectsConfig = {
    ...DEFAULT_EFFECTS_CONFIG,
    ...input,
    trails: { ...DEFAULT_EFFECTS_CONFIG.trails, ...(input.trails ?? {}) },
    fire: { ...DEFAULT_EFFECTS_CONFIG.fire, ...(input.fire ?? {}) },
    led: { ...DEFAULT_EFFECTS_CONFIG.led, ...(input.led ?? {}) },
    charcoal: { ...DEFAULT_EFFECTS_CONFIG.charcoal, ...(input.charcoal ?? {}) },
    zap: { ...DEFAULT_EFFECTS_CONFIG.zap, ...(input.zap ?? {}) },
    sparkles: { ...DEFAULT_EFFECTS_CONFIG.sparkles, ...(input.sparkles ?? {}) },
    motion: { ...DEFAULT_EFFECTS_CONFIG.motion, ...(input.motion ?? {}) },
    bloom: { ...DEFAULT_EFFECTS_CONFIG.bloom, ...(input.bloom ?? {}) },
    activePresets: {
      ...DEFAULT_EFFECTS_CONFIG.activePresets,
      ...(input.activePresets ?? {}),
    },
    version: EFFECTS_CONFIG_VERSION,
  };

  if (version < 2) {
    // v1 → v2: no transformations beyond the default-merge above.
    out = { ...out, version: 2 };
  }

  return out;
}
```

- [ ] **Step 4: Run tests — confirm pass**

Run: `npx vitest run tests/unit/effects/migrations.test.ts`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/effects/domain/migrations.ts tests/unit/effects/migrations.test.ts
git commit -m "feat(effects): v1→v2 config migration"
```

---

## Task 4: Extend `EffectsConfigState` factory

**Files:**
- Modify: `src/lib/shared/effects/state/effects-config-state.svelte.ts`

- [ ] **Step 1: Extend imports**

Replace the type imports at the top of `effects-config-state.svelte.ts`:

```ts
import type {
  EffectsConfig,
  EffectsOverrides,
  TrailsIntent,
  FireIntent,
  LedIntent,
  CharcoalIntent,
  ZapIntent,
  SparklesIntent,
  MotionIntent,
  BloomIntent,
} from "../domain/EffectsConfig";
```

- [ ] **Step 2: Extend `mergeConfig`**

Replace the `mergeConfig` function body with:

```ts
function mergeConfig(base: EffectsConfig, patch: Partial<EffectsConfig>): EffectsConfig {
  return {
    ...base,
    ...patch,
    trails: patch.trails ? { ...base.trails, ...patch.trails } : base.trails,
    fire: patch.fire ? { ...base.fire, ...patch.fire } : base.fire,
    led: patch.led ? { ...base.led, ...patch.led } : base.led,
    charcoal: patch.charcoal ? { ...base.charcoal, ...patch.charcoal } : base.charcoal,
    zap: patch.zap ? { ...base.zap, ...patch.zap } : base.zap,
    sparkles: patch.sparkles ? { ...base.sparkles, ...patch.sparkles } : base.sparkles,
    motion: patch.motion ? { ...base.motion, ...patch.motion } : base.motion,
    bloom: patch.bloom ? { ...base.bloom, ...patch.bloom } : base.bloom,
    activePresets: patch.activePresets
      ? { ...base.activePresets, ...patch.activePresets }
      : base.activePresets,
    tipEffectMap: patch.tipEffectMap ?? base.tipEffectMap,
    overrides: patch.overrides ?? base.overrides,
  };
}
```

- [ ] **Step 3: Add four update methods**

After `updateCharcoal`, add:

```ts
  function updateZap(patch: Partial<ZapIntent>) {
    config.zap = { ...config.zap, ...patch };
    config.activePresets.zap = null;
  }

  function updateSparkles(patch: Partial<SparklesIntent>) {
    config.sparkles = { ...config.sparkles, ...patch };
    config.activePresets.sparkles = null;
  }

  function updateMotion(patch: Partial<MotionIntent>) {
    config.motion = { ...config.motion, ...patch };
    config.activePresets.motion = null;
  }

  function updateBloom(patch: Partial<BloomIntent>) {
    config.bloom = { ...config.bloom, ...patch };
    config.activePresets.bloom = null;
  }
```

- [ ] **Step 4: Expose via the return object**

In the `return { … }` block, add new getters and methods:

```ts
    get zap() { return config.zap; },
    get sparkles() { return config.sparkles; },
    get motion() { return config.motion; },
    get bloom() { return config.bloom; },

    updateZap,
    updateSparkles,
    updateMotion,
    updateBloom,
```

Add these near the existing `updateCharcoal` and `get charcoal()` entries.

- [ ] **Step 5: Typecheck**

Run: `npm run check -- src/lib/shared/effects/state/effects-config-state.svelte.ts`
Expected: no errors in this file.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/effects/state/effects-config-state.svelte.ts
git commit -m "feat(effects): state factory methods for Zap/Sparkles/Motion/Bloom"
```

---

## Task 5: Extend translator types (2D + 3D)

**Files:**
- Modify: `src/lib/shared/effects/translators/canvas2d-types.ts`
- Modify: `src/lib/shared/effects/translators/webgl3d-types.ts`

- [ ] **Step 1: Extend 2D type imports**

At the top of `canvas2d-types.ts`, extend the type import:

```ts
import type {
  TrailsIntent,
  FireIntent,
  LedIntent,
  CharcoalIntent,
  ZapIntent,
  SparklesIntent,
  MotionIntent,
  BloomIntent,
} from "../domain/EffectsConfig";
```

- [ ] **Step 2: Add 2D params interfaces**

Append to the end of `canvas2d-types.ts`:

```ts
export interface Zap2DParams extends ZapIntent {
  /** Segment count along each arc. Derived from intensity + distance. */
  segments: number;
  /** px — random jitter radius per segment midpoint. */
  jitterAmount: number;
  /** px — shadowBlur for the glow pass. */
  glowBlur: number;
  /** px — core line width. */
  lineWidth: number;
}

export interface Sparkles2DParams extends SparklesIntent {
  /** Max particles alive at once. */
  poolSize: number;
  /** px — base particle radius before `size` multiplier. */
  baseRadius: number;
  /** Canvas composite op. */
  blendMode?: GlobalCompositeOperation;
}

export interface Motion2DParams extends MotionIntent {
  /** 0-1 — per-frame alpha multiplier for the trailing-blur canvas (1 = no fade, 0 = instant clear). */
  fadeAlpha: number;
  /** px — speed line segment length multiplier. */
  streakLength: number;
}

export interface Bloom2DParams extends BloomIntent {
  /** px — Gaussian blur kernel radius in pixels. */
  blurRadiusPx: number;
  /** 1-4 — number of blur passes (higher = softer). */
  passes: number;
}
```

- [ ] **Step 3: Extend 3D type imports**

At the top of `webgl3d-types.ts`, extend the type import the same way:

```ts
import type {
  TrailsIntent,
  FireIntent,
  LedIntent,
  CharcoalIntent,
  ZapIntent,
  SparklesIntent,
  MotionIntent,
  BloomIntent,
} from "../domain/EffectsConfig";
```

- [ ] **Step 4: Add 3D params interfaces**

Append to the end of `webgl3d-types.ts`:

```ts
export interface Zap3DParams extends ZapIntent {
  /** Segment count along each arc. */
  segments: number;
  /** 0-1 world-space jitter displacement per segment. */
  jitterAmount: number;
  /** Point light intensity when intensity > 0.5. */
  pointLightIntensity: number;
  /** Path regeneration interval in frames. */
  regenerateEveryFrames: number;
}

export interface Sparkles3DParams extends SparklesIntent {
  /** Max particles alive at once. */
  poolSize: number;
  /** Point sprite base radius (world units). */
  baseRadius: number;
  /** Gravity applied per second (negative = rise). */
  gravity: number;
}

export interface Motion3DParams extends MotionIntent {
  /** Motion blur sample count for the blur shader. */
  blurSamples: number;
  /** Speed line max streak length (world units). */
  streakLength: number;
}

export interface Bloom3DParams extends BloomIntent {
  /** Bloom pass kernel size. */
  kernelSize: number;
  /** Mipmap levels to accumulate for the final bloom buffer. */
  mipLevels: number;
}
```

- [ ] **Step 5: Typecheck both files**

Run: `npm run check -- src/lib/shared/effects/translators/canvas2d-types.ts src/lib/shared/effects/translators/webgl3d-types.ts`
Expected: no errors in these two files.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/effects/translators/canvas2d-types.ts src/lib/shared/effects/translators/webgl3d-types.ts
git commit -m "feat(effects): 2D + 3D param types for Zap/Sparkles/Motion/Bloom"
```

---

## Task 6: Translator functions + Zap tests

**Files:**
- Modify: `src/lib/shared/effects/translators/canvas2d-translator.ts`
- Modify: `src/lib/shared/effects/translators/webgl3d-translator.ts`
- Test: `tests/unit/effects/translators/zap-translator.test.ts`

- [ ] **Step 1: Write failing translator tests**

Create `tests/unit/effects/translators/zap-translator.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  resolveZap2D,
  resolveZap3D,
} from "../../../../src/lib/shared/effects/translators/canvas2d-translator";
import { resolveZap3D as resolveZap3DFn } from "../../../../src/lib/shared/effects/translators/webgl3d-translator";
import type { ZapIntent } from "../../../../src/lib/shared/effects/domain/EffectsConfig";

const baseIntent: ZapIntent = {
  intensity: 0.7,
  color: "#88ccff",
  frequency: 12,
  mode: "arc",
  branching: 0.3,
};

describe("resolveZap2D", () => {
  it("passes intent through and derives sensible canvas params", () => {
    const out = resolveZap2D(baseIntent);
    expect(out.intensity).toBe(0.7);
    expect(out.color).toBe("#88ccff");
    expect(out.segments).toBeGreaterThanOrEqual(4);
    expect(out.jitterAmount).toBeGreaterThan(0);
    expect(out.glowBlur).toBeGreaterThan(0);
    expect(out.lineWidth).toBeGreaterThan(0);
  });

  it("honours an override", () => {
    const out = resolveZap2D(baseIntent, { segments: 20 });
    expect(out.segments).toBe(20);
  });
});

describe("resolveZap3D (webgl3d-translator)", () => {
  it("passes intent through and derives sensible 3D params", () => {
    const out = resolveZap3DFn(baseIntent);
    expect(out.intensity).toBe(0.7);
    expect(out.segments).toBeGreaterThanOrEqual(4);
    expect(out.jitterAmount).toBeGreaterThan(0);
    expect(out.pointLightIntensity).toBeGreaterThan(0);
    expect(out.regenerateEveryFrames).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run tests — confirm failure**

Run: `npx vitest run tests/unit/effects/translators/zap-translator.test.ts`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Extend canvas2d-translator.ts**

Add imports at the top:

```ts
import type {
  TrailsIntent,
  FireIntent,
  LedIntent,
  CharcoalIntent,
  ZapIntent,
  SparklesIntent,
  MotionIntent,
  BloomIntent,
} from "../domain/EffectsConfig";
import type {
  Trails2DParams,
  Fire2DParams,
  Led2DParams,
  Charcoal2DParams,
  Zap2DParams,
  Sparkles2DParams,
  Motion2DParams,
  Bloom2DParams,
} from "./canvas2d-types";
```

Append at the bottom:

```ts
export function resolveZap2D(
  intent: ZapIntent,
  override: Partial<Zap2DParams> = {},
): Zap2DParams {
  const defaults: Omit<Zap2DParams, keyof ZapIntent> = {
    segments: Math.max(4, Math.round(6 + intent.intensity * 10)),
    jitterAmount: 6 + intent.intensity * 10,
    glowBlur: 8 + intent.intensity * 12,
    lineWidth: 1.5 + intent.intensity * 1.5,
  };
  return { ...intent, ...defaults, ...override };
}

export function resolveSparkles2D(
  intent: SparklesIntent,
  override: Partial<Sparkles2DParams> = {},
): Sparkles2DParams {
  const defaults: Omit<Sparkles2DParams, keyof SparklesIntent> = {
    poolSize: 256,
    baseRadius: 3,
    blendMode: "lighter",
  };
  return { ...intent, ...defaults, ...override };
}

export function resolveMotion2D(
  intent: MotionIntent,
  override: Partial<Motion2DParams> = {},
): Motion2DParams {
  const defaults: Omit<Motion2DParams, keyof MotionIntent> = {
    fadeAlpha: 0.85 + intent.blur * 0.14,
    streakLength: 12 + intent.speedLines * 30,
  };
  return { ...intent, ...defaults, ...override };
}

export function resolveBloom2D(
  intent: BloomIntent,
  override: Partial<Bloom2DParams> = {},
): Bloom2DParams {
  const defaults: Omit<Bloom2DParams, keyof BloomIntent> = {
    blurRadiusPx: 8 + intent.radius * 32,
    passes: Math.max(1, Math.round(1 + intent.radius * 3)),
  };
  return { ...intent, ...defaults, ...override };
}
```

Add a matching `resolveZap3D` export so the import in the test works — but mark it deprecated so people use the real one:

```ts
/** @deprecated Import from webgl3d-translator instead. Re-exported here for test convenience only. */
export { resolveZap3D } from "./webgl3d-translator";
```

- [ ] **Step 4: Extend webgl3d-translator.ts**

Add imports at the top:

```ts
import type {
  TrailsIntent,
  FireIntent,
  LedIntent,
  CharcoalIntent,
  ZapIntent,
  SparklesIntent,
  MotionIntent,
  BloomIntent,
} from "../domain/EffectsConfig";
import type {
  Trails3DParams,
  Fire3DParams,
  Led3DParams,
  Charcoal3DParams,
  Zap3DParams,
  Sparkles3DParams,
  Motion3DParams,
  Bloom3DParams,
} from "./webgl3d-types";
```

Append at the bottom:

```ts
export function resolveZap3D(
  intent: ZapIntent,
  override: Partial<Zap3DParams> = {},
): Zap3DParams {
  const defaults: Omit<Zap3DParams, keyof ZapIntent> = {
    segments: Math.max(4, Math.round(5 + intent.intensity * 8)),
    jitterAmount: 0.08 + intent.intensity * 0.14,
    pointLightIntensity: intent.intensity > 0.5 ? intent.intensity * 2.0 : 0,
    regenerateEveryFrames: 3,
  };
  return { ...intent, ...defaults, ...override };
}

export function resolveSparkles3D(
  intent: SparklesIntent,
  override: Partial<Sparkles3DParams> = {},
): Sparkles3DParams {
  const defaults: Omit<Sparkles3DParams, keyof SparklesIntent> = {
    poolSize: 512,
    baseRadius: 0.03,
    gravity: -0.2,
  };
  return { ...intent, ...defaults, ...override };
}

export function resolveMotion3D(
  intent: MotionIntent,
  override: Partial<Motion3DParams> = {},
): Motion3DParams {
  const defaults: Omit<Motion3DParams, keyof MotionIntent> = {
    blurSamples: Math.max(4, Math.round(4 + intent.blur * 12)),
    streakLength: 0.3 + intent.speedLines * 1.2,
  };
  return { ...intent, ...defaults, ...override };
}

export function resolveBloom3D(
  intent: BloomIntent,
  override: Partial<Bloom3DParams> = {},
): Bloom3DParams {
  const defaults: Omit<Bloom3DParams, keyof BloomIntent> = {
    kernelSize: Math.max(3, Math.round(3 + intent.radius * 9)),
    mipLevels: Math.max(2, Math.round(2 + intent.radius * 4)),
  };
  return { ...intent, ...defaults, ...override };
}
```

- [ ] **Step 5: Run tests — confirm pass**

Run: `npx vitest run tests/unit/effects/translators/zap-translator.test.ts`
Expected: 3 passing.

- [ ] **Step 6: Typecheck**

Run: `npm run check`
Expected: the only remaining errors are in `EffectSelector.svelte` / `EffectsPanel.svelte` / the legacy shim files — handled in later tasks.

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/effects/translators/canvas2d-translator.ts src/lib/shared/effects/translators/webgl3d-translator.ts tests/unit/effects/translators/zap-translator.test.ts
git commit -m "feat(effects): translators for Zap/Sparkles/Motion/Bloom (2D+3D)"
```

---

## Task 7: Zap 2D renderer

**Files:**
- Create: `src/lib/shared/effects/renderers/Zap2DRenderer.ts`

- [ ] **Step 1: Create the renderer class**

Create `src/lib/shared/effects/renderers/Zap2DRenderer.ts`:

```ts
import type { Zap2DParams } from "../translators/canvas2d-types";

export interface ZapTipInput {
  /** Blue prop tip position (canvas px). Null = not visible. */
  bluePosA: { x: number; y: number } | null;
  bluePosB: { x: number; y: number } | null;
  redPosA: { x: number; y: number } | null;
  redPosB: { x: number; y: number } | null;
}

/**
 * Procedural lightning renderer using midpoint displacement.
 * Regenerates arc paths every `regenerateEveryFrames` to produce flicker.
 * 'arc' mode connects blue→red tip pairs.
 * 'crackle' mode radiates short arcs outward from each tip.
 */
export class Zap2DRenderer {
  private frameCount = 0;
  private cachedArcs: Array<{ x: number; y: number }[]> = [];
  private readonly regenerateEveryFrames = 3;

  /**
   * Draw one frame. Caller is responsible for clearing/composing the canvas
   * before/after. This renderer uses additive blending via ctx.shadowBlur.
   */
  render(
    ctx: CanvasRenderingContext2D,
    params: Zap2DParams,
    tips: ZapTipInput,
  ): void {
    this.frameCount++;
    const needRegen = this.frameCount % this.regenerateEveryFrames === 0;

    const prevComposite = ctx.globalCompositeOperation;
    const prevShadowBlur = ctx.shadowBlur;
    const prevShadowColor = ctx.shadowColor;
    const prevStrokeStyle = ctx.strokeStyle;
    const prevLineWidth = ctx.lineWidth;
    try {
      ctx.globalCompositeOperation = "lighter";

      if (params.mode === "arc") {
        const pairs: Array<[{ x: number; y: number }, { x: number; y: number }]> = [];
        // Match 3D: connect blueA↔redA and blueB↔redB when both tips exist.
        if (tips.bluePosA && tips.redPosA) pairs.push([tips.bluePosA, tips.redPosA]);
        if (tips.bluePosB && tips.redPosB) pairs.push([tips.bluePosB, tips.redPosB]);

        if (needRegen || this.cachedArcs.length !== pairs.length) {
          this.cachedArcs = pairs.map(([a, b]) => this.generatePath(a, b, params));
        }
        for (const path of this.cachedArcs) {
          this.drawArc(ctx, path, params);
        }
      } else {
        // crackle mode — short radiating arcs from each tip
        const origins: Array<{ x: number; y: number }> = [];
        if (tips.bluePosA) origins.push(tips.bluePosA);
        if (tips.bluePosB) origins.push(tips.bluePosB);
        if (tips.redPosA) origins.push(tips.redPosA);
        if (tips.redPosB) origins.push(tips.redPosB);

        if (needRegen || this.cachedArcs.length === 0) {
          this.cachedArcs = origins.flatMap((o) => {
            const spokes = 3;
            return Array.from({ length: spokes }).map(() => {
              const angle = Math.random() * Math.PI * 2;
              const len = 40 + params.intensity * 60;
              const end = {
                x: o.x + Math.cos(angle) * len,
                y: o.y + Math.sin(angle) * len,
              };
              return this.generatePath(o, end, params);
            });
          });
        }
        for (const path of this.cachedArcs) {
          this.drawArc(ctx, path, params);
        }
      }
    } finally {
      ctx.globalCompositeOperation = prevComposite;
      ctx.shadowBlur = prevShadowBlur;
      ctx.shadowColor = prevShadowColor;
      ctx.strokeStyle = prevStrokeStyle;
      ctx.lineWidth = prevLineWidth;
    }
  }

  private generatePath(
    a: { x: number; y: number },
    b: { x: number; y: number },
    params: Zap2DParams,
  ): Array<{ x: number; y: number }> {
    const pts: Array<{ x: number; y: number }> = [a, b];
    for (let iter = 0; iter < Math.log2(params.segments); iter++) {
      const next: typeof pts = [];
      for (let i = 0; i < pts.length - 1; i++) {
        next.push(pts[i]);
        const mx = (pts[i].x + pts[i + 1].x) / 2;
        const my = (pts[i].y + pts[i + 1].y) / 2;
        const jitter = params.jitterAmount / (iter + 1);
        next.push({
          x: mx + (Math.random() - 0.5) * jitter * 2,
          y: my + (Math.random() - 0.5) * jitter * 2,
        });
      }
      next.push(pts[pts.length - 1]);
      pts.length = 0;
      pts.push(...next);
    }
    return pts;
  }

  private drawArc(
    ctx: CanvasRenderingContext2D,
    path: Array<{ x: number; y: number }>,
    params: Zap2DParams,
  ): void {
    // Glow pass
    ctx.strokeStyle = params.color;
    ctx.shadowColor = params.color;
    ctx.shadowBlur = params.glowBlur;
    ctx.lineWidth = params.lineWidth * 2;
    ctx.globalAlpha = 0.6 * params.intensity;
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
    ctx.stroke();

    // Core pass
    ctx.strokeStyle = "#ffffff";
    ctx.shadowBlur = params.glowBlur * 0.5;
    ctx.lineWidth = params.lineWidth;
    ctx.globalAlpha = params.intensity;
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
    ctx.stroke();

    ctx.globalAlpha = 1.0;
  }

  dispose(): void {
    this.cachedArcs = [];
    this.frameCount = 0;
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run check -- src/lib/shared/effects/renderers/Zap2DRenderer.ts`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/effects/renderers/Zap2DRenderer.ts
git commit -m "feat(effects): Zap 2D canvas renderer (midpoint displacement)"
```

---

## Task 8: Chip grid restructure (4×2, drop "None")

**Files:**
- Modify: `src/lib/shared/animation-engine/components/effects-panel/EffectSelector.svelte`

- [ ] **Step 1: Replace effect list + layout**

Open `EffectSelector.svelte` and replace the `EFFECTS` constant and the template + style blocks:

```svelte
<script lang="ts">
  const EFFECTS = [
    { id: "trails", label: "Trails", icon: "fa-route", color: "#60a5fa" },
    { id: "fire", label: "Fire", icon: "fa-fire", color: "#f97316" },
    { id: "led", label: "LED", icon: "fa-lightbulb", color: "#22c55e" },
    { id: "charcoal", label: "Coal", icon: "fa-diamond", color: "#a855f7" },
    { id: "zap", label: "Zap", icon: "fa-bolt", color: "#38bdf8" },
    { id: "sparkles", label: "Sparkle", icon: "fa-star", color: "#fbbf24" },
    { id: "motion", label: "Motion", icon: "fa-wind", color: "#22d3ee" },
    { id: "bloom", label: "Bloom", icon: "fa-sun", color: "#f472b6" },
  ] as const;

  interface Props {
    activeEffect: string;
    onSelect: (effect: string) => void;
  }

  const { activeEffect, onSelect }: Props = $props();

  function getButtonStyle(effect: (typeof EFFECTS)[number]): string {
    const isActive = activeEffect === effect.id;
    if (!isActive) return "";
    return [
      `border-color: ${effect.color}`,
      `background: color-mix(in srgb, ${effect.color} 14%, transparent)`,
      `color: ${effect.color}`,
    ].join("; ");
  }
</script>

<div
  class="effect-selector"
  role="radiogroup"
  aria-label="Select effect"
>
  {#each EFFECTS as effect (effect.id)}
    {@const isActive = activeEffect === effect.id}
    <button
      type="button"
      class="effect-btn"
      class:active={isActive}
      role="radio"
      aria-checked={isActive}
      aria-label={effect.label}
      title={isActive ? `Click to disable ${effect.label}` : effect.label}
      style={getButtonStyle(effect)}
      onclick={() => onSelect(effect.id)}
    >
      <i class="fas {effect.icon}" aria-hidden="true"></i>
      <span class="effect-label">{effect.label}</span>
    </button>
  {/each}
</div>

<style>
  .effect-selector {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .effect-btn {
    min-height: 48px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 8px 4px;
    border-radius: 10px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    font-size: inherit;
    -webkit-tap-highlight-color: transparent;
    transition:
      background var(--duration-fast, 100ms) ease,
      border-color var(--duration-fast, 100ms) ease,
      color var(--duration-fast, 100ms) ease;
  }

  @media (prefers-reduced-motion: reduce) {
    .effect-btn {
      transition: none;
    }
  }

  .effect-btn:hover:not(.active) {
    background: color-mix(
      in srgb,
      var(--theme-text, white) 6%,
      var(--theme-card-bg, rgba(255, 255, 255, 0.04))
    );
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .effect-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .effect-btn i {
    font-size: 14px;
    pointer-events: none;
  }

  .effect-label {
    font-size: 11px;
    line-height: 1;
    pointer-events: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/animation-engine/components/effects-panel/EffectSelector.svelte
git commit -m "feat(effects): 4×2 chip grid with Zap/Sparkles/Motion/Bloom"
```

---

## Task 9: Click-active-to-deselect in `EffectsPanel.svelte`

**Files:**
- Modify: `src/lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte`

- [ ] **Step 1: Update `handleEffectSelect`**

Find `handleEffectSelect` in `EffectsPanel.svelte` (around line 125) and replace its body:

```ts
function handleEffectSelect(effectId: string): void {
  customizeOpen = false;
  // Click the active chip to disable — round-trip to "none"
  if (effectId === activeEffect) {
    vm.setActiveEffect("none" as EffectType);
    activeEffect = "none";
    activePresetId = null;
    return;
  }
  vm.setActiveEffect(effectId as EffectType);
  activeEffect = effectId;
  activePresetId = null;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run check -- src/lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte
git commit -m "feat(effects): click active chip to deselect"
```

---

## Task 10: Zap preset group

**Files:**
- Create: `src/lib/shared/animation-engine/components/effects-panel/presets/zap-presets.ts`

- [ ] **Step 1: Create preset file**

```ts
import type { EffectPreset, EffectPresetGroup } from "./types";
import type { AnimationVisibilityStateManager } from "../../../state/animation-visibility-state.svelte";
import { getEffectsConfigState } from "$lib/shared/effects/state/effects-config-context";

function apply(presetId: string, patch: Partial<import("$lib/shared/effects/domain/EffectsConfig").ZapIntent>): void {
  const state = getEffectsConfigState();
  if (!state) return;
  state.updateZap(patch);
  // Mark preset as active (updateZap nulls it first — restore it here).
  state.applyPreset({
    id: presetId,
    effectType: "zap",
    patch: { activePresets: { ...state.activePresets, zap: presetId } },
  } as unknown as import("$lib/shared/effects/domain/EffectsPreset").EffectsPreset);
}

export const ZAP_PRESETS: EffectPreset[] = [
  {
    id: "zap-thunder",
    name: "Thunder",
    previewColor: "#88ccff",
    apply: (_vm) => apply("zap-thunder", {
      intensity: 0.9, color: "#88ccff", frequency: 8, mode: "arc", branching: 0.4,
    }),
  },
  {
    id: "zap-tesla",
    name: "Tesla",
    previewColor: "#a855f7",
    apply: (_vm) => apply("zap-tesla", {
      intensity: 1.0, color: "#a855f7", frequency: 20, mode: "arc", branching: 0.6,
    }),
  },
  {
    id: "zap-plasma",
    name: "Plasma",
    previewColor: "#ec4899",
    apply: (_vm) => apply("zap-plasma", {
      intensity: 0.7, color: "#ec4899", frequency: 16, mode: "crackle", branching: 0.2,
    }),
  },
  {
    id: "zap-custom",
    name: "Custom",
    previewColor: "custom",
    apply: (_vm) => {
      // "Custom" just opens the Customize panel — no-op here; the EffectsPanel
      // routes Custom → customizeOpen.
    },
  },
];

export const ZAP_PRESET_GROUP: EffectPresetGroup = {
  effectType: "zap",
  presets: ZAP_PRESETS,
  getSummary: (_vm: AnimationVisibilityStateManager): string => {
    const state = getEffectsConfigState();
    if (!state) return "";
    const z = state.zap;
    return `${z.mode} · freq ${z.frequency}/s · ${Math.round(z.intensity * 100)}%`;
  },
};
```

- [ ] **Step 2: Typecheck**

Run: `npm run check -- src/lib/shared/animation-engine/components/effects-panel/presets/zap-presets.ts`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/animation-engine/components/effects-panel/presets/zap-presets.ts
git commit -m "feat(effects): Zap preset group (Thunder/Tesla/Plasma/Custom)"
```

---

## Task 11: `ZapCustomize` + `ComingSoonCustomize` components

**Files:**
- Create: `src/lib/shared/animation-engine/components/effects-panel/customize/ZapCustomize.svelte`
- Create: `src/lib/shared/animation-engine/components/effects-panel/customize/ComingSoonCustomize.svelte`

- [ ] **Step 1: Create `ZapCustomize.svelte`**

```svelte
<script lang="ts">
  import { getEffectsConfigState } from "$lib/shared/effects/state/effects-config-context";

  interface Props {
    onBack: () => void;
  }

  const { onBack }: Props = $props();
  const state = getEffectsConfigState();
</script>

<div class="customize-panel">
  <header class="customize-header">
    <button type="button" class="back-btn" onclick={onBack} aria-label="Back to presets">
      <i class="fas fa-chevron-left" aria-hidden="true"></i>
    </button>
    <span class="customize-title">Zap</span>
  </header>

  {#if state}
    <label class="row">
      <span>Intensity</span>
      <input
        type="range" min="0" max="1" step="0.05"
        value={state.zap.intensity}
        oninput={(e) => state.updateZap({ intensity: +(e.currentTarget as HTMLInputElement).value })}
      />
      <span class="val">{Math.round(state.zap.intensity * 100)}%</span>
    </label>

    <label class="row">
      <span>Frequency</span>
      <input
        type="range" min="1" max="30" step="1"
        value={state.zap.frequency}
        oninput={(e) => state.updateZap({ frequency: +(e.currentTarget as HTMLInputElement).value })}
      />
      <span class="val">{state.zap.frequency}/s</span>
    </label>

    <label class="row">
      <span>Color</span>
      <input
        type="color"
        value={state.zap.color}
        oninput={(e) => state.updateZap({ color: (e.currentTarget as HTMLInputElement).value })}
      />
    </label>

    <label class="row">
      <span>Branching</span>
      <input
        type="range" min="0" max="1" step="0.05"
        value={state.zap.branching}
        oninput={(e) => state.updateZap({ branching: +(e.currentTarget as HTMLInputElement).value })}
      />
      <span class="val">{Math.round(state.zap.branching * 100)}%</span>
    </label>

    <label class="row">
      <span>Mode</span>
      <select
        value={state.zap.mode}
        onchange={(e) => state.updateZap({ mode: (e.currentTarget as HTMLSelectElement).value as "arc" | "crackle" })}
      >
        <option value="arc">Arc (tip-to-tip)</option>
        <option value="crackle">Crackle (radiate)</option>
      </select>
    </label>
  {/if}
</div>

<style>
  .customize-panel { display: flex; flex-direction: column; gap: 10px; padding: 0; }
  .customize-header {
    display: flex; align-items: center; gap: 8px;
    margin-bottom: 4px;
  }
  .back-btn {
    width: 28px; height: 28px; border-radius: 6px;
    border: 1px solid var(--theme-stroke, rgba(255,255,255,0.1));
    background: transparent; color: inherit; cursor: pointer;
  }
  .customize-title { font-weight: 600; }
  .row { display: flex; align-items: center; gap: 8px; font-size: 12px; }
  .row span:first-child { min-width: 72px; opacity: 0.7; }
  .row input[type=range] { flex: 1; min-width: 0; }
  .row .val { min-width: 40px; text-align: right; font-variant-numeric: tabular-nums; opacity: 0.7; }
  .row select { flex: 1; }
</style>
```

- [ ] **Step 2: Create `ComingSoonCustomize.svelte`**

```svelte
<script lang="ts">
  interface Props {
    effectLabel: string;
    onBack: () => void;
  }
  const { effectLabel, onBack }: Props = $props();
</script>

<div class="coming-soon">
  <header>
    <button type="button" class="back-btn" onclick={onBack} aria-label="Back">
      <i class="fas fa-chevron-left" aria-hidden="true"></i>
    </button>
    <span>{effectLabel}</span>
  </header>
  <p>Controls for {effectLabel} land in a follow-up phase. The effect is visible here so you can see where it'll live.</p>
</div>

<style>
  .coming-soon { padding: 8px 4px; font-size: 12px; opacity: 0.8; }
  .coming-soon header {
    display: flex; align-items: center; gap: 8px; font-weight: 600; margin-bottom: 8px;
  }
  .back-btn {
    width: 28px; height: 28px; border-radius: 6px;
    border: 1px solid var(--theme-stroke, rgba(255,255,255,0.1));
    background: transparent; color: inherit; cursor: pointer;
  }
  .coming-soon p { line-height: 1.5; }
</style>
```

- [ ] **Step 3: Typecheck**

Run: `npm run check -- src/lib/shared/animation-engine/components/effects-panel/customize/`
Expected: no errors in these two files.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/animation-engine/components/effects-panel/customize/ZapCustomize.svelte src/lib/shared/animation-engine/components/effects-panel/customize/ComingSoonCustomize.svelte
git commit -m "feat(effects): ZapCustomize + ComingSoonCustomize placeholder"
```

---

## Task 12: Wire new presets + customize into `EffectsPanel`

**Files:**
- Modify: `src/lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte`

- [ ] **Step 1: Extend imports**

In `EffectsPanel.svelte`, add to the import block:

```ts
import ZapCustomize from "./customize/ZapCustomize.svelte";
import ComingSoonCustomize from "./customize/ComingSoonCustomize.svelte";
import { ZAP_PRESET_GROUP } from "./presets/zap-presets";
```

- [ ] **Step 2: Extend `EFFECT_COLORS` and `EFFECT_LABELS` maps**

Replace the two maps with:

```ts
const EFFECT_COLORS: Record<string, string> = {
  fire: "#f97316",
  led: "#22c55e",
  trails: "#60a5fa",
  charcoal: "#a855f7",
  zap: "#38bdf8",
  sparkles: "#fbbf24",
  motion: "#22d3ee",
  bloom: "#f472b6",
};

const EFFECT_LABELS: Record<string, string> = {
  fire: "Fire",
  led: "LED",
  trails: "Trails",
  charcoal: "Charcoal",
  zap: "Zap",
  sparkles: "Sparkle",
  motion: "Motion",
  bloom: "Bloom",
};
```

- [ ] **Step 3: Extend `getPresetGroup`**

Replace with:

```ts
function getPresetGroup(effect: string): EffectPresetGroup | null {
  switch (effect) {
    case "led": return LED_PRESET_GROUP;
    case "fire": return FIRE_PRESET_GROUP;
    case "trails": return TRAIL_PRESET_GROUP;
    case "charcoal": return CHARCOAL_PRESET_GROUP;
    case "zap": return ZAP_PRESET_GROUP;
    default: return null;
  }
}
```

- [ ] **Step 4: Extend the Customize switch block**

Inside the `{#if customizeOpen}` block of the template, replace the inner content with:

```svelte
{#if customizeOpen}
  <div class="sb-section">
    {#if activeEffect === "led"}
      <LedCustomize onBack={() => (customizeOpen = false)} />
    {:else if activeEffect === "fire"}
      <FireCustomize onBack={() => (customizeOpen = false)} />
    {:else if activeEffect === "trails"}
      <TrailCustomize onBack={() => (customizeOpen = false)} />
    {:else if activeEffect === "charcoal"}
      <CharcoalCustomize onBack={() => (customizeOpen = false)} />
    {:else if activeEffect === "zap"}
      <ZapCustomize onBack={() => (customizeOpen = false)} />
    {:else if activeEffect === "sparkles"}
      <ComingSoonCustomize effectLabel="Sparkles" onBack={() => (customizeOpen = false)} />
    {:else if activeEffect === "motion"}
      <ComingSoonCustomize effectLabel="Motion" onBack={() => (customizeOpen = false)} />
    {:else if activeEffect === "bloom"}
      <ComingSoonCustomize effectLabel="Bloom" onBack={() => (customizeOpen = false)} />
    {/if}
  </div>
{/if}
```

- [ ] **Step 5: Typecheck**

Run: `npm run check -- src/lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte
git commit -m "feat(effects): wire Zap preset group + Customize, add placeholders for the rest"
```

---

## Task 13: Wire 3D `ElectricityArc` via `resolveZap3D`

**Files:**
- Modify: `src/lib/shared/3d/effects/EffectsLayer.svelte`

- [ ] **Step 1: Locate the existing Zap/electricity block**

Open `src/lib/shared/3d/effects/EffectsLayer.svelte` and find the block that mounts `ElectricityArc` (around lines 300-400). It currently reads `configState.electricity` from the **legacy** 3D-only state.

- [ ] **Step 2: Import the unified state + translator**

At the top of the `<script>` block, add:

```ts
import { getEffectsConfigState as getUnifiedEffectsState } from "$lib/shared/effects/state/effects-config-context";
import { resolveZap3D } from "$lib/shared/effects/translators/webgl3d-translator";
```

- [ ] **Step 3: Switch the Zap props source**

Inside the `<script>` block, add near the other state reads:

```ts
const unifiedState = getUnifiedEffectsState();
const zap3D = $derived(unifiedState ? resolveZap3D(unifiedState.zap) : null);
const zapEnabled = $derived(
  unifiedState ? unifiedState.config.tipEffectMap["*"]?.effect === "zap" : false,
);
```

In the template, replace the existing `{#if configState.electricity.enabled && isPlaying}` block with:

```svelte
{#if zapEnabled && zap3D && isPlaying}
  {#if bluePropState && redPropState}
    <ElectricityArc
      start={bluePropEnds.positive}
      end={redPropEnds.positive}
      enabled={true}
      intensity={zap3D.intensity}
      color={zap3D.color}
      mode={zap3D.mode}
    />
    <ElectricityArc
      start={bluePropEnds.negative}
      end={redPropEnds.negative}
      enabled={true}
      intensity={zap3D.intensity}
      color={zap3D.color}
      mode={zap3D.mode}
    />
  {/if}
{/if}
```

Note: keep `ElectricityArc`'s component API untouched — this task only swaps where its props come from.

- [ ] **Step 4: Typecheck**

Run: `npm run check -- src/lib/shared/3d/effects/EffectsLayer.svelte`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/effects/EffectsLayer.svelte
git commit -m "feat(effects): 3D ElectricityArc reads from unified Zap intent via translator"
```

---

## Task 14: Hook `Zap2DRenderer` into the 2D animator

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts` (or the corresponding render orchestrator — verify by grepping for where `TrailOverlayCanvas` draws)

- [ ] **Step 1: Locate the 2D overlay composition point**

Run: `grep -n "TrailOverlayCanvas\|renderCharcoal\|fireOverlay" src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts`
Read the surrounding context — find the per-frame method that composes overlay renderers after the base animation draws. This is where Zap 2D hooks in.

- [ ] **Step 2: Instantiate the Zap renderer**

Near other renderer fields inside the render loop class, add:

```ts
import { Zap2DRenderer } from "$lib/shared/effects/renderers/Zap2DRenderer";
import { resolveZap2D } from "$lib/shared/effects/translators/canvas2d-translator";
// …
private zapRenderer = new Zap2DRenderer();
```

- [ ] **Step 3: Render Zap when it's the active effect**

In the per-frame overlay composition block, after existing effect renderers, add:

```ts
const activeEffect = this.effectsState?.config.tipEffectMap["*"]?.effect;
if (activeEffect === "zap" && this.effectsState) {
  const params = resolveZap2D(this.effectsState.zap);
  const tips = {
    bluePosA: this.currentTipPositions.bluePosA ?? null,
    bluePosB: this.currentTipPositions.bluePosB ?? null,
    redPosA: this.currentTipPositions.redPosA ?? null,
    redPosB: this.currentTipPositions.redPosB ?? null,
  };
  this.zapRenderer.render(this.overlayCtx, params, tips);
}
```

If the render loop does not currently track tip positions per frame, wire them from `FireTipTracker` / `LedTipTracker` — they already feed the fire/LED overlays with exactly this data. Mirror their usage.

- [ ] **Step 4: Dispose on teardown**

In the dispose/destroy method of the render loop:

```ts
this.zapRenderer.dispose();
```

- [ ] **Step 5: Typecheck**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts
git commit -m "feat(effects): 2D animator renders Zap overlay when active"
```

---

## Task 15: End-to-end verification

**Files:**
- No code changes — verification only.

- [ ] **Step 1: Start dev server (in your own port, not 5173)**

Run: `vite --port 5174 &`
Wait ~5s for startup.

- [ ] **Step 2: Open Effects Lab**

Navigate the user's Chrome (already running on port 9222 with DevTools MCP):

```
Use mcp__chrome-devtools__navigate_page to http://localhost:5174/lab/effects
```

- [ ] **Step 3: Screenshot the 8-chip grid**

```
Use mcp__chrome-devtools__take_screenshot (save to a tmp path)
```

Verify visually: 4×2 grid of chips in the order Trails, Fire, LED, Coal / Zap, Sparkle, Motion, Bloom. No "None" chip present.

- [ ] **Step 4: Click Zap + screenshot**

```
Use mcp__chrome-devtools__click on the Zap chip (identify uid via snapshot).
Wait 500ms. Screenshot.
```

Verify visually: Zap chip shows active state (blue border + bg tint). Lightning visible between blue and red prop tips in the animator canvas.

- [ ] **Step 5: Open Customize**

Click "Customize Zap Settings" button. Screenshot. Verify: intensity/frequency/color/branching/mode controls render and update the effect live.

- [ ] **Step 6: Click Zap again to disable**

```
Use mcp__chrome-devtools__click on Zap chip.
```

Verify: Zap chip inactive. No lightning in animator.

- [ ] **Step 7: Check other 3 chips render "Coming soon"**

Click Sparkle → click "Customize Sparkle Settings" → verify ComingSoonCustomize message. Repeat for Motion, Bloom.

- [ ] **Step 8: Open a 3D viewer with a sequence + toggle Zap**

Navigate to a 3D sequence viewer route. Toggle Zap via EffectsSettingsPanel (legacy panel is still mounted in 3D sidebar — Phase 3 retires it). Verify lightning still renders in 3D. The 3D path now flows through the unified translator.

**Note:** The legacy `EffectsSettingsPanel` still writes to `configState.electricity` in the legacy 3D state. After Task 13, `EffectsLayer.svelte` reads from the unified state instead, so toggling via the legacy panel **will not** turn Zap on — this is expected. The unified panel (Effects Lab) is now the only way to enable Zap in 3D. Phase 3 will retire the legacy panel entirely.

- [ ] **Step 9: Typecheck + full build**

Run: `npm run check && npm run build`
Expected: both pass.

- [ ] **Step 10: Run all effects tests**

Run: `npx vitest run tests/unit/effects/`
Expected: all passing.

- [ ] **Step 11: Final commit (verification artifacts)**

```bash
git add -A
git commit --allow-empty -m "chore(effects): phase 1a verification complete"
```

---

## Self-Review Checklist (already run)

**Spec coverage:**
- ✅ 1.1 Intent types + defaults — Tasks 1, 2
- ✅ Version bump + migration — Task 3
- ✅ State factory update — Task 4
- ✅ 1.2 Translators — Tasks 5, 6
- ✅ 1.3 2D renderer (Zap only; other 3 deferred) — Task 7
- ✅ 1.4 Panel surface — Tasks 8, 9, 10, 11, 12
- ✅ 3D wiring via translator — Task 13
- ✅ 1.5 Wire into 2D animator — Task 14
- ✅ 1.6 Exit criteria verification — Task 15

**Placeholder scan:** No TBDs. Task 14 flags a grep-and-wire step inside the render loop rather than a precise line number — acceptable because the animator's internal structure needs to be read at the time of implementation to pick the right hook point. The existing `FireTipTracker`/`LedTipTracker` give a concrete pattern to mirror.

**Type consistency:** `ZapIntent.mode = "arc" | "crackle"` is used identically in renderer, customize, preset, and translator. Method names match (`updateZap`, `resolveZap2D`, `resolveZap3D`). Preset id prefix `zap-*` consistent.

**Deferred scope:** Sparkles/Motion/Bloom are explicitly placeholders in this plan. Their presets and 2D renderers are out of scope — Phase 1b/1c/1d.

# 3D Effect Parameter Parity — Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 2D effect sliders (fire, trails, LED, charcoal) drive the 3D viewer's rendered output. Ship-first milestone of the effect parameter parity design.

**Architecture:** Introduce a canonical `EffectsConfig` schema owned by neither 2D nor 3D. Both backends read from it via pure-function translators (`resolveTrails2D`, `resolveTrails3D`, etc.). Existing 2D panels keep writing to their current state stores; a write-shim mirrors those writes into the canonical state. The 3D renderer reads the canonical state via Svelte context and translates it at render time. No UI changes in this phase.

**Tech Stack:** TypeScript, Svelte 5 runes, Vitest, ITI (existing DI), Threlte (existing 3D).

**Scope:** This plan covers Phase A ONLY. Phases B/C/D (state store slicing, save-with-sequence, Firestore sync) each get their own plan after Phase A lands and is verified.

**Spec reference:** `docs/superpowers/specs/2026-04-11-3d-effect-parameter-parity-design.md`

---

## File structure

### New files

Domain (pure types and data):
- `src/lib/shared/effects/domain/EffectsConfig.ts` — canonical schema types
- `src/lib/shared/effects/domain/EffectsPreset.ts` — preset interface
- `src/lib/shared/effects/domain/defaults.ts` — `DEFAULT_EFFECTS_CONFIG`
- `src/lib/shared/effects/domain/presets/built-in-trail-presets.ts`
- `src/lib/shared/effects/domain/presets/built-in-fire-presets.ts`
- `src/lib/shared/effects/domain/presets/built-in-led-presets.ts`
- `src/lib/shared/effects/domain/presets/built-in-charcoal-presets.ts`

Translators (pure functions):
- `src/lib/shared/effects/translators/canvas2d-types.ts` — per-effect 2D param interfaces
- `src/lib/shared/effects/translators/webgl3d-types.ts` — per-effect 3D param interfaces
- `src/lib/shared/effects/translators/canvas2d-translator.ts` — `resolveTrails2D`, `resolveFire2D`, `resolveLed2D`, `resolveCharcoal2D`
- `src/lib/shared/effects/translators/webgl3d-translator.ts` — `resolveTrails3D`, `resolveFire3D`, `resolveLed3D`, `resolveCharcoal3D`

State (Svelte 5 runes):
- `src/lib/shared/effects/state/effects-config-state.svelte.ts` — `createEffectsConfigState` factory
- `src/lib/shared/effects/state/effects-config-context.ts` — `setEffectsConfigContext`, `getEffectsConfigContext`

Compat shim (Phase A only — deleted in Phase B):
- `src/lib/shared/effects/compat/vm-shim.ts` — bridges `AnimationVisibilityStateManager` setters into canonical state
- `src/lib/shared/effects/compat/animation-settings-shim.ts` — bridges `animationSettings.setTrailAppearance` into canonical state

### Test files

- `tests/unit/effects/domain/default-config.test.ts`
- `tests/unit/effects/domain/preset-patches.test.ts`
- `tests/unit/effects/translators/webgl3d-translator.test.ts`
- `tests/unit/effects/translators/canvas2d-translator.test.ts`
- `tests/unit/effects/state/effects-config-state.test.ts`
- `tests/unit/effects/compat/vm-shim.test.ts`

### Modified files

- `src/lib/shared/3d/effects/EffectOrchestrator3D.svelte` — reads canonical config via context; uses `webgl3d-translator`; hardcoded `LED_BLUE_COLOR`/`LED_RED_COLOR` constants deleted; default trail color reads from config
- `src/lib/shared/animation-engine/state/animation-visibility-state.svelte.ts` — shim hook on effect setters
- `src/lib/shared/animation-engine/state/animation-settings-state.svelte.ts` — shim hook on `setTrailAppearance`
- `src/lib/shared/sequence-viewer/components/SequenceViewer.svelte` — sets `EffectsConfigContext`
- `src/lib/shared/3d/components/Viewer3DFullscreen.svelte` — sets `EffectsConfigContext`

---

## Task 1: Canonical schema types

**Files:**
- Create: `src/lib/shared/effects/domain/EffectsConfig.ts`

- [ ] **Step 1: Create the schema file**

Create `src/lib/shared/effects/domain/EffectsConfig.ts`:

```ts
/**
 * Canonical effect parameter schema.
 *
 * Owned by neither 2D nor 3D — both backends translate from it via
 * pure functions in src/lib/shared/effects/translators/.
 *
 * The intent layer describes what the user meant (fire intensity,
 * trail brightness, LED color) independent of any backend. Per-backend
 * overrides live in the optional `overrides` field and let 2D/3D
 * grow independently where their physics genuinely diverge.
 */

import type { TipEffectMap } from "$lib/shared/animation-engine/domain/types/TipEffectTypes";
import type {
  FireColorCurve,
  PropFlameColor,
} from "$lib/shared/animation-engine/domain/types/FireTypes";

export const EFFECTS_CONFIG_VERSION = 1;

export type EffectType = "none" | "trails" | "fire" | "led" | "charcoal";

export interface TrailsIntent {
  /** Which staff end(s) the trail tracks. */
  trackingMode: "left_end" | "right_end" | "both_ends";
  /** Abstract thickness, 1-12. Each backend interprets in native units. */
  thickness: number;
  /** 0.3-1.0. Drives opacity in 2D, emissive + alpha in 3D. */
  brightness: number;
  /** Hex string. Ignored when `rainbow` is true. */
  blueColor: string;
  /** Hex string. Ignored when `rainbow` is true. */
  redColor: string;
  /** Hue-cycling mode. Overrides blueColor/redColor. */
  rainbow: boolean;
}

export interface FireIntent {
  /** 0.45-1.0. Overall fire strength. */
  intensity: number;
  /** 0-1. 0 = natural fire color, 1 = fully prop-colored tint. */
  colorBlend: number;
  /** 0-1. Idle flicker / chaos. */
  turbulence: number;
  /** 4-stop temperature→color gradient. Null = use default curve. */
  colorCurve: FireColorCurve | null;
  /** Per-hand flame color override. Null = default blue/red. */
  propColors: [PropFlameColor, PropFlameColor] | null;
  /** Hex pair for the "Custom" preset. Null = preset not in custom mode. */
  customColors: { left: string; right: string } | null;
}

export interface LedIntent {
  /** 1-5 discrete. */
  brightness: number;
  /** Pattern registry id. */
  patternId: string;
  /** 0.1-5.0. Pattern animation rate multiplier. */
  patternSpeed: number;
  /** Hex string. */
  primaryColor: string;
  /** Hex string. */
  secondaryColor: string;
  /** How colors map to the two props. */
  colorMode: "unified" | "per-hand" | "prop-matched";
}

export interface CharcoalIntent {
  /** 0-1. Semantic intensity (RGB params derived on demand). */
  intensity: number;
  /** 0-1. Semantic spread. */
  spread: number;
  /** 0-1. Semantic glow. */
  glow: number;
}

/**
 * Backend-specific override storage. Populated only when the user
 * has explicitly edited a backend-only parameter via an Advanced
 * panel (Phase D). Intentionally untyped here — concrete shapes
 * live with the translators.
 */
export interface EffectsOverrides {
  trails2D?: Record<string, unknown>;
  trails3D?: Record<string, unknown>;
  fire2D?: Record<string, unknown>;
  fire3D?: Record<string, unknown>;
  led2D?: Record<string, unknown>;
  led3D?: Record<string, unknown>;
  charcoal2D?: Record<string, unknown>;
  charcoal3D?: Record<string, unknown>;
}

export interface EffectsConfig {
  version: number;
  tipEffectMap: TipEffectMap;
  trails: TrailsIntent;
  fire: FireIntent;
  led: LedIntent;
  charcoal: CharcoalIntent;
  activePresets: {
    trails: string | null;
    fire: string | null;
    led: string | null;
    charcoal: string | null;
  };
  overrides?: EffectsOverrides;
}
```

- [ ] **Step 2: Type-check**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep -E "effects/domain/EffectsConfig" || echo "clean"`
Expected: `clean` (file has no errors of its own)

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/effects/domain/EffectsConfig.ts
git commit -m "feat(effects): canonical EffectsConfig schema"
```

---

## Task 2: Preset interface

**Files:**
- Create: `src/lib/shared/effects/domain/EffectsPreset.ts`

- [ ] **Step 1: Create the preset interface**

Create `src/lib/shared/effects/domain/EffectsPreset.ts`:

```ts
import type { EffectsConfig, EffectType } from "./EffectsConfig";

/**
 * Deep partial — every field optional, recursively.
 * Used for preset patches so a preset can touch only the fields
 * it cares about without declaring the full config shape.
 */
export type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

/**
 * A named, described effect preset.
 *
 * Presets are pure data — applying a preset is
 * `config = deepMerge(config, preset.patch)`, not an imperative
 * side-effect chain. This lets presets be serialized, composed,
 * previewed, and synced to Firestore.
 */
export interface EffectsPreset {
  id: string;
  name: string;
  description: string;
  /** Which effect picker this preset belongs to. */
  effectType: Exclude<EffectType, "none">;
  /** Pure data patch applied over current config. */
  patch: DeepPartial<EffectsConfig>;
  builtIn: boolean;
  /** Firestore uid — absent for built-in presets. */
  createdBy?: string;
  /** epoch ms — absent for built-in presets. */
  createdAt?: number;
  /** Optional thumbnail colors for the picker swatch. */
  previewColors?: [string, string];
}
```

- [ ] **Step 2: Type-check**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep -E "effects/domain/EffectsPreset" || echo "clean"`
Expected: `clean`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/effects/domain/EffectsPreset.ts
git commit -m "feat(effects): EffectsPreset interface for pure-data presets"
```

---

## Task 3: Default config + round-trip test

**Files:**
- Create: `src/lib/shared/effects/domain/defaults.ts`
- Test: `tests/unit/effects/domain/default-config.test.ts`

- [ ] **Step 1: Write the failing test first**

Create `tests/unit/effects/domain/default-config.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";
import { EFFECTS_CONFIG_VERSION } from "$lib/shared/effects/domain/EffectsConfig";

describe("DEFAULT_EFFECTS_CONFIG", () => {
  it("has the current schema version", () => {
    expect(DEFAULT_EFFECTS_CONFIG.version).toBe(EFFECTS_CONFIG_VERSION);
  });

  it("has a tipEffectMap with trails as the global default", () => {
    expect(DEFAULT_EFFECTS_CONFIG.tipEffectMap).toEqual({ "*": { effect: "trails" } });
  });

  it("has valid trails intent", () => {
    const t = DEFAULT_EFFECTS_CONFIG.trails;
    expect(t.trackingMode).toBe("both_ends");
    expect(t.thickness).toBeGreaterThanOrEqual(1);
    expect(t.thickness).toBeLessThanOrEqual(12);
    expect(t.brightness).toBeGreaterThanOrEqual(0.3);
    expect(t.brightness).toBeLessThanOrEqual(1.0);
    expect(t.blueColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(t.redColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(t.rainbow).toBe(false);
  });

  it("has valid fire intent", () => {
    const f = DEFAULT_EFFECTS_CONFIG.fire;
    expect(f.intensity).toBeGreaterThanOrEqual(0.45);
    expect(f.intensity).toBeLessThanOrEqual(1.0);
    expect(f.colorBlend).toBeGreaterThanOrEqual(0);
    expect(f.colorBlend).toBeLessThanOrEqual(1);
    expect(f.turbulence).toBeGreaterThanOrEqual(0);
    expect(f.turbulence).toBeLessThanOrEqual(1);
    expect(f.colorCurve).toBeNull();
    expect(f.propColors).toBeNull();
    expect(f.customColors).toBeNull();
  });

  it("has valid led intent", () => {
    const l = DEFAULT_EFFECTS_CONFIG.led;
    expect(l.brightness).toBeGreaterThanOrEqual(1);
    expect(l.brightness).toBeLessThanOrEqual(5);
    expect(Number.isInteger(l.brightness)).toBe(true);
    expect(l.patternId).toBeTypeOf("string");
    expect(l.patternSpeed).toBeGreaterThanOrEqual(0.1);
    expect(l.patternSpeed).toBeLessThanOrEqual(5.0);
    expect(l.primaryColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(l.colorMode).toMatch(/^(unified|per-hand|prop-matched)$/);
  });

  it("has valid charcoal intent", () => {
    const c = DEFAULT_EFFECTS_CONFIG.charcoal;
    for (const k of ["intensity", "spread", "glow"] as const) {
      expect(c[k]).toBeGreaterThanOrEqual(0);
      expect(c[k]).toBeLessThanOrEqual(1);
    }
  });

  it("has activePresets all null", () => {
    expect(DEFAULT_EFFECTS_CONFIG.activePresets).toEqual({
      trails: null, fire: null, led: null, charcoal: null,
    });
  });

  it("has no overrides by default", () => {
    expect(DEFAULT_EFFECTS_CONFIG.overrides).toBeUndefined();
  });

  it("round-trips through JSON.stringify / JSON.parse", () => {
    const serialized = JSON.stringify(DEFAULT_EFFECTS_CONFIG);
    const parsed = JSON.parse(serialized);
    expect(parsed).toEqual(DEFAULT_EFFECTS_CONFIG);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- tests/unit/effects/domain/default-config.test.ts --run 2>&1 | tail -20`
Expected: FAIL with "Cannot find module ... defaults"

- [ ] **Step 3: Create the defaults module**

Create `src/lib/shared/effects/domain/defaults.ts`:

```ts
import type { EffectsConfig } from "./EffectsConfig";
import { EFFECTS_CONFIG_VERSION } from "./EffectsConfig";

export const DEFAULT_EFFECTS_CONFIG: EffectsConfig = {
  version: EFFECTS_CONFIG_VERSION,

  // Trails on as the global default — new users see motion paths.
  tipEffectMap: { "*": { effect: "trails" } },

  trails: {
    trackingMode: "both_ends",
    thickness: 5,
    brightness: 1.0,
    blueColor: "#3D44B8",
    redColor: "#DC2626",
    rainbow: false,
  },

  fire: {
    intensity: 0.7,
    colorBlend: 0.5,
    turbulence: 0.5,
    colorCurve: null,
    propColors: null,
    customColors: null,
  },

  led: {
    brightness: 5,
    patternId: "solid",
    patternSpeed: 1.0,
    primaryColor: "#00ff88",
    secondaryColor: "#ffffff",
    colorMode: "unified",
  },

  charcoal: {
    intensity: 0.5,
    spread: 0.5,
    glow: 0.6,
  },

  activePresets: {
    trails: null,
    fire: null,
    led: null,
    charcoal: null,
  },
};
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm test -- tests/unit/effects/domain/default-config.test.ts --run 2>&1 | tail -20`
Expected: PASS, 8 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/effects/domain/defaults.ts tests/unit/effects/domain/default-config.test.ts
git commit -m "feat(effects): DEFAULT_EFFECTS_CONFIG with round-trip test"
```

---

## Task 4: Built-in trail presets + test

**Files:**
- Create: `src/lib/shared/effects/domain/presets/built-in-trail-presets.ts`
- Test: `tests/unit/effects/domain/preset-patches.test.ts` (new file; later tasks append to it)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/effects/domain/preset-patches.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { BUILT_IN_TRAIL_PRESETS } from "$lib/shared/effects/domain/presets/built-in-trail-presets";

describe("BUILT_IN_TRAIL_PRESETS", () => {
  it("contains default, neon, ember presets", () => {
    const ids = BUILT_IN_TRAIL_PRESETS.map((p) => p.id);
    expect(ids).toContain("trail-default");
    expect(ids).toContain("trail-neon");
    expect(ids).toContain("trail-ember");
  });

  it("every preset has name, description, effectType trails, builtIn true", () => {
    for (const p of BUILT_IN_TRAIL_PRESETS) {
      expect(p.name).toBeTypeOf("string");
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.description).toBeTypeOf("string");
      expect(p.effectType).toBe("trails");
      expect(p.builtIn).toBe(true);
    }
  });

  it("every preset patch only touches the trails field and activePresets", () => {
    for (const p of BUILT_IN_TRAIL_PRESETS) {
      const keys = Object.keys(p.patch);
      for (const k of keys) {
        expect(["trails", "activePresets"]).toContain(k);
      }
    }
  });

  it("trail-neon sets rainbow false and neon hex colors", () => {
    const neon = BUILT_IN_TRAIL_PRESETS.find((p) => p.id === "trail-neon")!;
    expect(neon.patch.trails?.blueColor).toBe("#00ffcc");
    expect(neon.patch.trails?.redColor).toBe("#ff00ff");
    expect(neon.patch.trails?.rainbow).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `npm test -- tests/unit/effects/domain/preset-patches.test.ts --run 2>&1 | tail -20`
Expected: FAIL, "Cannot find module ... built-in-trail-presets"

- [ ] **Step 3: Create the preset file**

Create `src/lib/shared/effects/domain/presets/built-in-trail-presets.ts`:

```ts
import type { EffectsPreset } from "../EffectsPreset";

export const BUILT_IN_TRAIL_PRESETS: EffectsPreset[] = [
  {
    id: "trail-default",
    name: "Default",
    description: "Standard trail with canonical blue and red colors.",
    effectType: "trails",
    builtIn: true,
    previewColors: ["#3D44B8", "#DC2626"],
    patch: {
      trails: {
        thickness: 5,
        brightness: 1.0,
        blueColor: "#3D44B8",
        redColor: "#DC2626",
        rainbow: false,
      },
    },
  },
  {
    id: "trail-neon",
    name: "Neon",
    description: "Bright cyan and magenta with a strong glow.",
    effectType: "trails",
    builtIn: true,
    previewColors: ["#00ffcc", "#ff00ff"],
    patch: {
      trails: {
        thickness: 4,
        brightness: 1.0,
        blueColor: "#00ffcc",
        redColor: "#ff00ff",
        rainbow: false,
      },
    },
  },
  {
    id: "trail-ember",
    name: "Ember",
    description: "Warm orange and amber, gently faded.",
    effectType: "trails",
    builtIn: true,
    previewColors: ["#f97316", "#fbbf24"],
    patch: {
      trails: {
        thickness: 6,
        brightness: 0.9,
        blueColor: "#f97316",
        redColor: "#fbbf24",
        rainbow: false,
      },
    },
  },
];
```

- [ ] **Step 4: Run test, verify pass**

Run: `npm test -- tests/unit/effects/domain/preset-patches.test.ts --run 2>&1 | tail -20`
Expected: PASS, 4 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/effects/domain/presets/built-in-trail-presets.ts tests/unit/effects/domain/preset-patches.test.ts
git commit -m "feat(effects): built-in trail presets as pure data"
```

---

## Task 5: Built-in fire presets + test

**Files:**
- Create: `src/lib/shared/effects/domain/presets/built-in-fire-presets.ts`
- Modify: `tests/unit/effects/domain/preset-patches.test.ts`

- [ ] **Step 1: Append failing fire test to preset-patches.test.ts**

Append to `tests/unit/effects/domain/preset-patches.test.ts`:

```ts
import { BUILT_IN_FIRE_PRESETS } from "$lib/shared/effects/domain/presets/built-in-fire-presets";

describe("BUILT_IN_FIRE_PRESETS", () => {
  it("contains classic, blue-flame, spirit presets", () => {
    const ids = BUILT_IN_FIRE_PRESETS.map((p) => p.id);
    expect(ids).toContain("fire-classic");
    expect(ids).toContain("fire-blue-flame");
    expect(ids).toContain("fire-spirit");
  });

  it("every preset has effectType fire and builtIn true", () => {
    for (const p of BUILT_IN_FIRE_PRESETS) {
      expect(p.effectType).toBe("fire");
      expect(p.builtIn).toBe(true);
      expect(p.name).toBeTypeOf("string");
      expect(p.description).toBeTypeOf("string");
    }
  });

  it("fire-classic sets a 4-stop color curve", () => {
    const classic = BUILT_IN_FIRE_PRESETS.find((p) => p.id === "fire-classic")!;
    const curve = classic.patch.fire?.colorCurve;
    expect(curve).toBeDefined();
    expect(curve?.coldColor).toHaveLength(3);
    expect(curve?.midColor).toHaveLength(3);
    expect(curve?.hotColor).toHaveLength(3);
    expect(curve?.coreColor).toHaveLength(3);
  });

  it("fire presets do NOT touch intensity or turbulence (color-only)", () => {
    for (const p of BUILT_IN_FIRE_PRESETS) {
      expect(p.patch.fire?.intensity).toBeUndefined();
      expect(p.patch.fire?.turbulence).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `npm test -- tests/unit/effects/domain/preset-patches.test.ts --run 2>&1 | tail -20`
Expected: FAIL, "Cannot find module ... built-in-fire-presets"

- [ ] **Step 3: Create the fire preset file**

Create `src/lib/shared/effects/domain/presets/built-in-fire-presets.ts`:

```ts
import type { EffectsPreset } from "../EffectsPreset";
import type { FireColorCurve } from "$lib/shared/animation-engine/domain/types/FireTypes";

const CLASSIC_CURVE: FireColorCurve = {
  coldColor: [0.2, 0.02, 0.0],
  midColor: [0.9, 0.15, 0.0],
  hotColor: [1.0, 0.55, 0.05],
  coreColor: [1.0, 0.9, 0.35],
};

const BLUE_CURVE: FireColorCurve = {
  coldColor: [0.0, 0.02, 0.2],
  midColor: [0.0, 0.15, 0.9],
  hotColor: [0.1, 0.5, 1.0],
  coreColor: [0.6, 0.85, 1.0],
};

const SPIRIT_CURVE: FireColorCurve = {
  coldColor: [0.15, 0.0, 0.2],
  midColor: [0.5, 0.0, 0.8],
  hotColor: [0.8, 0.2, 1.0],
  coreColor: [1.0, 0.7, 1.0],
};

export const BUILT_IN_FIRE_PRESETS: EffectsPreset[] = [
  {
    id: "fire-classic",
    name: "Classic",
    description: "Orange temperature gradient from cold ember to hot core.",
    effectType: "fire",
    builtIn: true,
    previewColors: ["#f97316", "#fbbf24"],
    patch: {
      fire: {
        colorCurve: CLASSIC_CURVE,
        propColors: null,
      },
    },
  },
  {
    id: "fire-blue-flame",
    name: "Blue Flame",
    description: "Cold-to-hot blue gradient, like a gas torch.",
    effectType: "fire",
    builtIn: true,
    previewColors: ["#60a5fa", "#bfdbfe"],
    patch: {
      fire: {
        colorCurve: BLUE_CURVE,
        propColors: null,
      },
    },
  },
  {
    id: "fire-spirit",
    name: "Spirit",
    description: "Violet and magenta ghost flame.",
    effectType: "fire",
    builtIn: true,
    previewColors: ["#a855f7", "#e9d5ff"],
    patch: {
      fire: {
        colorCurve: SPIRIT_CURVE,
        propColors: null,
      },
    },
  },
];
```

- [ ] **Step 4: Run test, verify pass**

Run: `npm test -- tests/unit/effects/domain/preset-patches.test.ts --run 2>&1 | tail -20`
Expected: PASS, 8 tests total passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/effects/domain/presets/built-in-fire-presets.ts tests/unit/effects/domain/preset-patches.test.ts
git commit -m "feat(effects): built-in fire presets as pure data"
```

---

## Task 6: Built-in LED presets + test

**Files:**
- Create: `src/lib/shared/effects/domain/presets/built-in-led-presets.ts`
- Modify: `tests/unit/effects/domain/preset-patches.test.ts`

- [ ] **Step 1: Append failing LED test**

Append to `tests/unit/effects/domain/preset-patches.test.ts`:

```ts
import { BUILT_IN_LED_PRESETS } from "$lib/shared/effects/domain/presets/built-in-led-presets";

describe("BUILT_IN_LED_PRESETS", () => {
  it("contains at least 4 built-in presets", () => {
    expect(BUILT_IN_LED_PRESETS.length).toBeGreaterThanOrEqual(4);
  });

  it("every preset has effectType led and a primaryColor", () => {
    for (const p of BUILT_IN_LED_PRESETS) {
      expect(p.effectType).toBe("led");
      expect(p.builtIn).toBe(true);
      expect(p.patch.led?.primaryColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("led-rainbow sets patternId rainbow", () => {
    const rainbow = BUILT_IN_LED_PRESETS.find((p) => p.id === "led-rainbow");
    expect(rainbow?.patch.led?.patternId).toBe("rainbow");
  });

  it("led-prop-colors uses prop-matched color mode", () => {
    const propMatch = BUILT_IN_LED_PRESETS.find((p) => p.id === "led-prop-colors");
    expect(propMatch?.patch.led?.colorMode).toBe("prop-matched");
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `npm test -- tests/unit/effects/domain/preset-patches.test.ts --run 2>&1 | tail -20`
Expected: FAIL, "Cannot find module ... built-in-led-presets"

- [ ] **Step 3: Create the LED preset file**

Create `src/lib/shared/effects/domain/presets/built-in-led-presets.ts`:

```ts
import type { EffectsPreset } from "../EffectsPreset";

export const BUILT_IN_LED_PRESETS: EffectsPreset[] = [
  {
    id: "led-green-glow",
    name: "Green Glow",
    description: "Solid green at high brightness — the classic pixel poi look.",
    effectType: "led",
    builtIn: true,
    previewColors: ["#00ff88", "#00ff88"],
    patch: {
      led: {
        brightness: 4,
        patternId: "solid",
        patternSpeed: 1.0,
        primaryColor: "#00ff88",
        secondaryColor: "#00ff88",
        colorMode: "unified",
      },
    },
  },
  {
    id: "led-ice-blue",
    name: "Ice Blue",
    description: "Cool solid blue.",
    effectType: "led",
    builtIn: true,
    previewColors: ["#4488ff", "#4488ff"],
    patch: {
      led: {
        brightness: 4,
        patternId: "solid",
        patternSpeed: 1.0,
        primaryColor: "#4488ff",
        secondaryColor: "#4488ff",
        colorMode: "unified",
      },
    },
  },
  {
    id: "led-rainbow",
    name: "Rainbow",
    description: "Full hue cycle at max brightness.",
    effectType: "led",
    builtIn: true,
    previewColors: ["#ff0000", "#00ff00"],
    patch: {
      led: {
        brightness: 5,
        patternId: "rainbow",
        patternSpeed: 1.0,
        primaryColor: "#ff0000",
        secondaryColor: "#00ff00",
        colorMode: "unified",
      },
    },
  },
  {
    id: "led-prop-colors",
    name: "Prop Colors",
    description: "Each prop's LED takes its own blue/red identity.",
    effectType: "led",
    builtIn: true,
    previewColors: ["#3D44B8", "#DC2626"],
    patch: {
      led: {
        brightness: 4,
        patternId: "solid",
        patternSpeed: 1.0,
        primaryColor: "#3D44B8",
        secondaryColor: "#DC2626",
        colorMode: "prop-matched",
      },
    },
  },
];
```

- [ ] **Step 4: Run test, verify pass**

Run: `npm test -- tests/unit/effects/domain/preset-patches.test.ts --run 2>&1 | tail -20`
Expected: PASS, 12 tests total passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/effects/domain/presets/built-in-led-presets.ts tests/unit/effects/domain/preset-patches.test.ts
git commit -m "feat(effects): built-in LED presets as pure data"
```

---

## Task 7: Built-in charcoal presets + test

**Files:**
- Create: `src/lib/shared/effects/domain/presets/built-in-charcoal-presets.ts`
- Modify: `tests/unit/effects/domain/preset-patches.test.ts`

- [ ] **Step 1: Append failing charcoal test**

Append to `tests/unit/effects/domain/preset-patches.test.ts`:

```ts
import { BUILT_IN_CHARCOAL_PRESETS } from "$lib/shared/effects/domain/presets/built-in-charcoal-presets";

describe("BUILT_IN_CHARCOAL_PRESETS", () => {
  it("contains at least 4 presets", () => {
    expect(BUILT_IN_CHARCOAL_PRESETS.length).toBeGreaterThanOrEqual(4);
  });

  it("every preset has effectType charcoal and semantic fields in 0-1", () => {
    for (const p of BUILT_IN_CHARCOAL_PRESETS) {
      expect(p.effectType).toBe("charcoal");
      expect(p.builtIn).toBe(true);
      const c = p.patch.charcoal!;
      for (const k of ["intensity", "spread", "glow"] as const) {
        expect(c[k]).toBeGreaterThanOrEqual(0);
        expect(c[k]).toBeLessThanOrEqual(1);
      }
    }
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `npm test -- tests/unit/effects/domain/preset-patches.test.ts --run 2>&1 | tail -20`
Expected: FAIL, "Cannot find module ... built-in-charcoal-presets"

- [ ] **Step 3: Create the charcoal preset file**

Create `src/lib/shared/effects/domain/presets/built-in-charcoal-presets.ts`:

```ts
import type { EffectsPreset } from "../EffectsPreset";

export const BUILT_IN_CHARCOAL_PRESETS: EffectsPreset[] = [
  {
    id: "charcoal-violet-ember",
    name: "Violet Ember",
    description: "Soft lavender embers with mid glow.",
    effectType: "charcoal",
    builtIn: true,
    previewColors: ["#a78bfa", "#c4b5fd"],
    patch: {
      charcoal: { intensity: 0.5, spread: 0.5, glow: 0.6 },
    },
  },
  {
    id: "charcoal-hot-coal",
    name: "Hot Coal",
    description: "Intense white-hot core, tight spread, heavy glow.",
    effectType: "charcoal",
    builtIn: true,
    previewColors: ["#ffffff", "#ef4444"],
    patch: {
      charcoal: { intensity: 0.8, spread: 0.4, glow: 0.8 },
    },
  },
  {
    id: "charcoal-jade-dust",
    name: "Jade Dust",
    description: "Cool mint sparks, wide spread, gentle glow.",
    effectType: "charcoal",
    builtIn: true,
    previewColors: ["#6ee7b7", "#10b981"],
    patch: {
      charcoal: { intensity: 0.4, spread: 0.7, glow: 0.5 },
    },
  },
  {
    id: "charcoal-ash",
    name: "Ash",
    description: "Muted gray sparks for a subtle falloff look.",
    effectType: "charcoal",
    builtIn: true,
    previewColors: ["#9ca3af", "#4b5563"],
    patch: {
      charcoal: { intensity: 0.3, spread: 0.3, glow: 0.2 },
    },
  },
];
```

- [ ] **Step 4: Run test, verify pass**

Run: `npm test -- tests/unit/effects/domain/preset-patches.test.ts --run 2>&1 | tail -20`
Expected: PASS, 14 tests total passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/effects/domain/presets/built-in-charcoal-presets.ts tests/unit/effects/domain/preset-patches.test.ts
git commit -m "feat(effects): built-in charcoal presets as pure data"
```

---

## Task 8: Canvas2D param types

**Files:**
- Create: `src/lib/shared/effects/translators/canvas2d-types.ts`

No tests here — these are pure type declarations. They're exercised by the canvas2d-translator tests in Task 10.

- [ ] **Step 1: Create the types file**

Create `src/lib/shared/effects/translators/canvas2d-types.ts`:

```ts
/**
 * Canvas 2D backend parameter interfaces.
 *
 * Each extends the intent layer with 2D-specific extras that have
 * no clean 3D analog (shadow blur, canvas blend modes, etc.). These
 * extras populate `EffectsConfig.overrides.*2D` when the user has
 * opened an Advanced panel (Phase D). Core users never see them.
 */

import type {
  TrailsIntent,
  FireIntent,
  LedIntent,
  CharcoalIntent,
} from "../domain/EffectsConfig";

export interface Trails2DParams extends TrailsIntent {
  /** px value for ctx.lineWidth. Derived from thickness. */
  lineWidth: number;
  /** 0-1. Derived from brightness. */
  maxOpacity: number;
  /** 0-1. Derived as brightness * 0.3. */
  minOpacity: number;
  /** px value for ctx.shadowBlur. Default 3; overridable via 2D advanced. */
  glowBlur: number;
  /** Canvas composite op. Default 'source-over'. */
  blendMode?: GlobalCompositeOperation;
}

export interface Fire2DParams extends FireIntent {
  /** Hz — optional override for idle flame pulse rate. */
  flickerRate?: number;
  /** Canvas composite op. */
  canvasBlendMode?: GlobalCompositeOperation;
  /** px — optional halo blur. */
  shadowBlur?: number;
}

export interface Led2DParams extends LedIntent {
  /** px — LED dot radius when rendered to 2D canvas. */
  dotRadius?: number;
}

export interface Charcoal2DParams extends CharcoalIntent {
  /** Max particle count in the 2D particle pool. */
  particleCount?: number;
  /** Canvas composite op. */
  canvasBlendMode?: GlobalCompositeOperation;
}
```

- [ ] **Step 2: Type-check**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep -E "effects/translators/canvas2d-types" || echo "clean"`
Expected: `clean`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/effects/translators/canvas2d-types.ts
git commit -m "feat(effects): canvas2d backend param types"
```

---

## Task 9: WebGL3D param types

**Files:**
- Create: `src/lib/shared/effects/translators/webgl3d-types.ts`

- [ ] **Step 1: Create the types file**

Create `src/lib/shared/effects/translators/webgl3d-types.ts`:

```ts
/**
 * WebGL 3D backend parameter interfaces.
 *
 * Each extends the intent layer with 3D-specific extras that have
 * no 2D analog (volumetric density, bloom contribution, tube radius,
 * etc.). These populate `EffectsConfig.overrides.*3D` when the user
 * has opened a 3D Advanced panel. Core users never see them.
 */

import type {
  TrailsIntent,
  FireIntent,
  LedIntent,
  CharcoalIntent,
} from "../domain/EffectsConfig";

export interface Trails3DParams extends TrailsIntent {
  /** World-space tube radius, meters. Derived from thickness. */
  tubeRadius: number;
  /** Ring buffer length. Renderer-internal; user never sees this. */
  maxPoints: number;
  /** HDR emissive multiplier. Derived from brightness. */
  emissive: number;
  /** 0-1. Weight into the bloom post-process. */
  bloomWeight: number;
  /** "exponential" | "linear" — fade shape along the ring. */
  taperCurve: "exponential" | "linear";
}

export interface Fire3DParams extends FireIntent {
  /** 0-1. Alpha accumulation along raymarched fire volume. */
  volumetricDensity: number;
  /** Particles/second emitted. */
  emissionRate: number;
  /** Upward force on particles. */
  buoyancy: number;
  /** 0-1. Drag coefficient. */
  dragCoefficient: number;
  /** 0-5. Curl-noise vortex strength. */
  vortexStrength: number;
  /** Whether fire casts light on the environment. */
  shadowCasting: boolean;
  /** 0-1. Bloom post-process contribution. */
  bloomContribution: number;
}

export interface Led3DParams extends LedIntent {
  /** Number of virtual LED segments along the staff. */
  segmentCount: number;
  /** POV persistence duration in seconds. */
  povPersistenceDuration: number;
}

export interface Charcoal3DParams extends CharcoalIntent {
  /** Particle lifetime in seconds. */
  particleLifetime: number;
  /** Gravity strength on particles (world units/s²). */
  gravity: number;
  /** 0-1. Spark size randomization. */
  sparkSizeJitter: number;
}
```

- [ ] **Step 2: Type-check**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep -E "effects/translators/webgl3d-types" || echo "clean"`
Expected: `clean`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/effects/translators/webgl3d-types.ts
git commit -m "feat(effects): webgl3d backend param types"
```

---

## Task 10: Canvas2D translator + tests

**Files:**
- Create: `src/lib/shared/effects/translators/canvas2d-translator.ts`
- Test: `tests/unit/effects/translators/canvas2d-translator.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/effects/translators/canvas2d-translator.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  resolveTrails2D,
  resolveFire2D,
  resolveLed2D,
  resolveCharcoal2D,
} from "$lib/shared/effects/translators/canvas2d-translator";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";

describe("resolveTrails2D", () => {
  const intent = DEFAULT_EFFECTS_CONFIG.trails;

  it("maps thickness directly to lineWidth", () => {
    expect(resolveTrails2D({ ...intent, thickness: 6 }).lineWidth).toBe(6);
  });

  it("maps brightness to maxOpacity 1:1", () => {
    expect(resolveTrails2D({ ...intent, brightness: 0.8 }).maxOpacity).toBe(0.8);
  });

  it("derives minOpacity as brightness * 0.3", () => {
    const out = resolveTrails2D({ ...intent, brightness: 1.0 });
    expect(out.minOpacity).toBeCloseTo(0.3, 5);
  });

  it("defaults glowBlur to 3 when no override", () => {
    expect(resolveTrails2D(intent).glowBlur).toBe(3);
  });

  it("override glowBlur wins", () => {
    expect(resolveTrails2D(intent, { glowBlur: 10 }).glowBlur).toBe(10);
  });

  it("preserves color fields from intent", () => {
    const out = resolveTrails2D({ ...intent, blueColor: "#abc123", redColor: "#def456" });
    expect(out.blueColor).toBe("#abc123");
    expect(out.redColor).toBe("#def456");
  });
});

describe("resolveFire2D", () => {
  const intent = DEFAULT_EFFECTS_CONFIG.fire;

  it("preserves intent fields", () => {
    const out = resolveFire2D({ ...intent, intensity: 0.85, turbulence: 0.3 });
    expect(out.intensity).toBe(0.85);
    expect(out.turbulence).toBe(0.3);
  });

  it("override flickerRate wins", () => {
    expect(resolveFire2D(intent, { flickerRate: 12 }).flickerRate).toBe(12);
  });
});

describe("resolveLed2D", () => {
  const intent = DEFAULT_EFFECTS_CONFIG.led;

  it("preserves intent fields", () => {
    const out = resolveLed2D({ ...intent, brightness: 3, primaryColor: "#abcdef" });
    expect(out.brightness).toBe(3);
    expect(out.primaryColor).toBe("#abcdef");
  });

  it("defaults dotRadius to 2", () => {
    expect(resolveLed2D(intent).dotRadius).toBe(2);
  });
});

describe("resolveCharcoal2D", () => {
  const intent = DEFAULT_EFFECTS_CONFIG.charcoal;

  it("preserves semantic fields", () => {
    const out = resolveCharcoal2D({ ...intent, intensity: 0.9 });
    expect(out.intensity).toBe(0.9);
  });

  it("defaults particleCount to 200", () => {
    expect(resolveCharcoal2D(intent).particleCount).toBe(200);
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `npm test -- tests/unit/effects/translators/canvas2d-translator.test.ts --run 2>&1 | tail -20`
Expected: FAIL, "Cannot find module ... canvas2d-translator"

- [ ] **Step 3: Create the translator**

Create `src/lib/shared/effects/translators/canvas2d-translator.ts`:

```ts
import type {
  TrailsIntent,
  FireIntent,
  LedIntent,
  CharcoalIntent,
} from "../domain/EffectsConfig";
import type {
  Trails2DParams,
  Fire2DParams,
  Led2DParams,
  Charcoal2DParams,
} from "./canvas2d-types";

export function resolveTrails2D(
  intent: TrailsIntent,
  override: Partial<Trails2DParams> = {},
): Trails2DParams {
  const defaults: Omit<Trails2DParams, keyof TrailsIntent> = {
    lineWidth: intent.thickness,
    maxOpacity: intent.brightness,
    minOpacity: intent.brightness * 0.3,
    glowBlur: 3,
  };
  return { ...intent, ...defaults, ...override };
}

export function resolveFire2D(
  intent: FireIntent,
  override: Partial<Fire2DParams> = {},
): Fire2DParams {
  return { ...intent, ...override };
}

export function resolveLed2D(
  intent: LedIntent,
  override: Partial<Led2DParams> = {},
): Led2DParams {
  const defaults: Omit<Led2DParams, keyof LedIntent> = {
    dotRadius: 2,
  };
  return { ...intent, ...defaults, ...override };
}

export function resolveCharcoal2D(
  intent: CharcoalIntent,
  override: Partial<Charcoal2DParams> = {},
): Charcoal2DParams {
  const defaults: Omit<Charcoal2DParams, keyof CharcoalIntent> = {
    particleCount: 200,
  };
  return { ...intent, ...defaults, ...override };
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npm test -- tests/unit/effects/translators/canvas2d-translator.test.ts --run 2>&1 | tail -20`
Expected: PASS, 12 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/effects/translators/canvas2d-translator.ts tests/unit/effects/translators/canvas2d-translator.test.ts
git commit -m "feat(effects): canvas2d translator with pure resolve functions"
```

---

## Task 11: WebGL3D translator + tests

**Files:**
- Create: `src/lib/shared/effects/translators/webgl3d-translator.ts`
- Test: `tests/unit/effects/translators/webgl3d-translator.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/effects/translators/webgl3d-translator.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  resolveTrails3D,
  resolveFire3D,
  resolveLed3D,
  resolveCharcoal3D,
} from "$lib/shared/effects/translators/webgl3d-translator";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";

describe("resolveTrails3D", () => {
  const intent = DEFAULT_EFFECTS_CONFIG.trails;

  it("derives tubeRadius from thickness", () => {
    const out = resolveTrails3D({ ...intent, thickness: 6 });
    expect(out.tubeRadius).toBeCloseTo(0.048, 5); // 6 * 0.008
  });

  it("derives emissive from brightness", () => {
    const out = resolveTrails3D({ ...intent, brightness: 1.0 });
    expect(out.emissive).toBeCloseTo(2.0, 5);
  });

  it("derives bloomWeight from brightness", () => {
    const out = resolveTrails3D({ ...intent, brightness: 0.75 });
    expect(out.bloomWeight).toBeCloseTo(0.3, 5);
  });

  it("defaults taperCurve to exponential", () => {
    expect(resolveTrails3D(intent).taperCurve).toBe("exponential");
  });

  it("override taperCurve wins", () => {
    expect(resolveTrails3D(intent, { taperCurve: "linear" }).taperCurve).toBe("linear");
  });

  it("defaults maxPoints to 256", () => {
    expect(resolveTrails3D(intent).maxPoints).toBe(256);
  });
});

describe("resolveFire3D", () => {
  const intent = DEFAULT_EFFECTS_CONFIG.fire;

  it("volumetricDensity scales with intensity: 0.3 + i*0.7", () => {
    expect(resolveFire3D({ ...intent, intensity: 0.5 }).volumetricDensity).toBeCloseTo(0.65, 5);
    expect(resolveFire3D({ ...intent, intensity: 1.0 }).volumetricDensity).toBeCloseTo(1.0, 5);
  });

  it("emissionRate scales with intensity: 200 + i*800", () => {
    expect(resolveFire3D({ ...intent, intensity: 0.5 }).emissionRate).toBe(600);
    expect(resolveFire3D({ ...intent, intensity: 1.0 }).emissionRate).toBe(1000);
  });

  it("vortexStrength scales with turbulence: t*3", () => {
    expect(resolveFire3D({ ...intent, turbulence: 0.5 }).vortexStrength).toBeCloseTo(1.5, 5);
  });

  it("bloomContribution scales with intensity: i*0.6", () => {
    expect(resolveFire3D({ ...intent, intensity: 1.0 }).bloomContribution).toBeCloseTo(0.6, 5);
  });

  it("shadowCasting defaults to false", () => {
    expect(resolveFire3D(intent).shadowCasting).toBe(false);
  });

  it("override volumetricDensity wins", () => {
    expect(resolveFire3D(intent, { volumetricDensity: 0.9 }).volumetricDensity).toBe(0.9);
  });
});

describe("resolveLed3D", () => {
  const intent = DEFAULT_EFFECTS_CONFIG.led;

  it("defaults segmentCount to 200 (full strip)", () => {
    expect(resolveLed3D(intent).segmentCount).toBe(200);
  });

  it("defaults povPersistenceDuration to 0.12", () => {
    expect(resolveLed3D(intent).povPersistenceDuration).toBeCloseTo(0.12, 5);
  });

  it("preserves primaryColor from intent", () => {
    expect(resolveLed3D({ ...intent, primaryColor: "#123456" }).primaryColor).toBe("#123456");
  });
});

describe("resolveCharcoal3D", () => {
  const intent = DEFAULT_EFFECTS_CONFIG.charcoal;

  it("particleLifetime scales with glow: 0.5 + g*1.5", () => {
    expect(resolveCharcoal3D({ ...intent, glow: 0 }).particleLifetime).toBeCloseTo(0.5, 5);
    expect(resolveCharcoal3D({ ...intent, glow: 1 }).particleLifetime).toBeCloseTo(2.0, 5);
  });

  it("defaults gravity to -2.0 (upward drift)", () => {
    expect(resolveCharcoal3D(intent).gravity).toBeCloseTo(-2.0, 5);
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `npm test -- tests/unit/effects/translators/webgl3d-translator.test.ts --run 2>&1 | tail -20`
Expected: FAIL, "Cannot find module ... webgl3d-translator"

- [ ] **Step 3: Create the translator**

Create `src/lib/shared/effects/translators/webgl3d-translator.ts`:

```ts
import type {
  TrailsIntent,
  FireIntent,
  LedIntent,
  CharcoalIntent,
} from "../domain/EffectsConfig";
import type {
  Trails3DParams,
  Fire3DParams,
  Led3DParams,
  Charcoal3DParams,
} from "./webgl3d-types";

export function resolveTrails3D(
  intent: TrailsIntent,
  override: Partial<Trails3DParams> = {},
): Trails3DParams {
  const defaults: Omit<Trails3DParams, keyof TrailsIntent> = {
    tubeRadius: intent.thickness * 0.008,       // 0.008-0.096 world units
    maxPoints: 256,
    emissive: intent.brightness * 2.0,          // HDR > 1.0
    bloomWeight: intent.brightness * 0.4,
    taperCurve: "exponential",
  };
  return { ...intent, ...defaults, ...override };
}

export function resolveFire3D(
  intent: FireIntent,
  override: Partial<Fire3DParams> = {},
): Fire3DParams {
  const defaults: Omit<Fire3DParams, keyof FireIntent> = {
    volumetricDensity: 0.3 + intent.intensity * 0.7,
    emissionRate: 200 + intent.intensity * 800,
    buoyancy: 1.2 + intent.intensity * 0.8,
    dragCoefficient: 0.15,
    vortexStrength: intent.turbulence * 3.0,
    shadowCasting: false,
    bloomContribution: intent.intensity * 0.6,
  };
  return { ...intent, ...defaults, ...override };
}

export function resolveLed3D(
  intent: LedIntent,
  override: Partial<Led3DParams> = {},
): Led3DParams {
  const defaults: Omit<Led3DParams, keyof LedIntent> = {
    segmentCount: 200,
    povPersistenceDuration: 0.12,
  };
  return { ...intent, ...defaults, ...override };
}

export function resolveCharcoal3D(
  intent: CharcoalIntent,
  override: Partial<Charcoal3DParams> = {},
): Charcoal3DParams {
  const defaults: Omit<Charcoal3DParams, keyof CharcoalIntent> = {
    particleLifetime: 0.5 + intent.glow * 1.5,
    gravity: -2.0,                              // upward drift for charcoal sparks
    sparkSizeJitter: 0.4,
  };
  return { ...intent, ...defaults, ...override };
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npm test -- tests/unit/effects/translators/webgl3d-translator.test.ts --run 2>&1 | tail -20`
Expected: PASS, 14 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/effects/translators/webgl3d-translator.ts tests/unit/effects/translators/webgl3d-translator.test.ts
git commit -m "feat(effects): webgl3d translator with pure resolve functions"
```

---

## Task 12: Effects config state factory + tests

**Files:**
- Create: `src/lib/shared/effects/state/effects-config-state.svelte.ts`
- Test: `tests/unit/effects/state/effects-config-state.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/effects/state/effects-config-state.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";
import { BUILT_IN_TRAIL_PRESETS } from "$lib/shared/effects/domain/presets/built-in-trail-presets";
import { BUILT_IN_FIRE_PRESETS } from "$lib/shared/effects/domain/presets/built-in-fire-presets";

describe("createEffectsConfigState", () => {
  it("starts with default config when no initial supplied", () => {
    const s = createEffectsConfigState();
    expect(s.config.version).toBe(DEFAULT_EFFECTS_CONFIG.version);
    expect(s.config.trails.thickness).toBe(DEFAULT_EFFECTS_CONFIG.trails.thickness);
  });

  it("updateTrails merges partial patches", () => {
    const s = createEffectsConfigState();
    s.updateTrails({ thickness: 8 });
    expect(s.config.trails.thickness).toBe(8);
    // other fields preserved
    expect(s.config.trails.brightness).toBe(DEFAULT_EFFECTS_CONFIG.trails.brightness);
  });

  it("updateTrails clears activePresets.trails (user dragged a slider)", () => {
    const s = createEffectsConfigState({
      ...DEFAULT_EFFECTS_CONFIG,
      activePresets: { ...DEFAULT_EFFECTS_CONFIG.activePresets, trails: "trail-neon" },
    });
    s.updateTrails({ thickness: 8 });
    expect(s.config.activePresets.trails).toBeNull();
  });

  it("updateFire merges and clears activePresets.fire", () => {
    const s = createEffectsConfigState({
      ...DEFAULT_EFFECTS_CONFIG,
      activePresets: { ...DEFAULT_EFFECTS_CONFIG.activePresets, fire: "fire-classic" },
    });
    s.updateFire({ intensity: 0.95 });
    expect(s.config.fire.intensity).toBe(0.95);
    expect(s.config.activePresets.fire).toBeNull();
  });

  it("applyPreset deep-merges preset patch and sets activePresets reference", () => {
    const s = createEffectsConfigState();
    s.applyPreset(BUILT_IN_TRAIL_PRESETS.find((p) => p.id === "trail-neon")!);
    expect(s.config.trails.blueColor).toBe("#00ffcc");
    expect(s.config.trails.redColor).toBe("#ff00ff");
    expect(s.config.activePresets.trails).toBe("trail-neon");
  });

  it("applyPreset preserves fields not touched by patch", () => {
    const s = createEffectsConfigState();
    const originalFire = s.config.fire.intensity;
    s.applyPreset(BUILT_IN_FIRE_PRESETS.find((p) => p.id === "fire-classic")!);
    // Fire preset only touches colorCurve and propColors — intensity survives
    expect(s.config.fire.intensity).toBe(originalFire);
    expect(s.config.fire.colorCurve).not.toBeNull();
  });

  it("setTipEffectMap replaces the map", () => {
    const s = createEffectsConfigState();
    s.setTipEffectMap({ "*": { effect: "fire" } });
    expect(s.config.tipEffectMap).toEqual({ "*": { effect: "fire" } });
  });

  it("replace swaps the entire config atomically", () => {
    const s = createEffectsConfigState();
    const next = {
      ...DEFAULT_EFFECTS_CONFIG,
      trails: { ...DEFAULT_EFFECTS_CONFIG.trails, thickness: 11 },
    };
    s.replace(next);
    expect(s.config.trails.thickness).toBe(11);
  });

  it("updateOverride creates the overrides object lazily", () => {
    const s = createEffectsConfigState();
    expect(s.config.overrides).toBeUndefined();
    s.updateOverride("fire3D", { volumetricDensity: 0.9 });
    expect(s.config.overrides?.fire3D).toEqual({ volumetricDensity: 0.9 });
  });

  it("updateOverride merges subsequent patches", () => {
    const s = createEffectsConfigState();
    s.updateOverride("fire3D", { volumetricDensity: 0.9 });
    s.updateOverride("fire3D", { shadowCasting: true });
    expect(s.config.overrides?.fire3D).toEqual({
      volumetricDensity: 0.9,
      shadowCasting: true,
    });
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `npm test -- tests/unit/effects/state/effects-config-state.test.ts --run 2>&1 | tail -20`
Expected: FAIL, "Cannot find module ... effects-config-state"

- [ ] **Step 3: Create the state factory**

Create `src/lib/shared/effects/state/effects-config-state.svelte.ts`:

```ts
/**
 * Canonical effects config state (Svelte 5 runes).
 *
 * This is the factory — consumers create an instance per context
 * (sequence viewer, export panel, etc.) and distribute via
 * effects-config-context.ts. See the state-management rule for why
 * we use factories + context rather than module-level singletons.
 */

import type {
  EffectsConfig,
  EffectsOverrides,
  TrailsIntent,
  FireIntent,
  LedIntent,
  CharcoalIntent,
} from "../domain/EffectsConfig";
import type { EffectsPreset } from "../domain/EffectsPreset";
import type { TipEffectMap } from "$lib/shared/animation-engine/domain/types/TipEffectTypes";
import { DEFAULT_EFFECTS_CONFIG } from "../domain/defaults";

/** Shallow-in-depth deep merge used for preset application. */
function mergeConfig(base: EffectsConfig, patch: Partial<EffectsConfig>): EffectsConfig {
  return {
    ...base,
    ...patch,
    trails: patch.trails ? { ...base.trails, ...patch.trails } : base.trails,
    fire: patch.fire ? { ...base.fire, ...patch.fire } : base.fire,
    led: patch.led ? { ...base.led, ...patch.led } : base.led,
    charcoal: patch.charcoal ? { ...base.charcoal, ...patch.charcoal } : base.charcoal,
    activePresets: patch.activePresets
      ? { ...base.activePresets, ...patch.activePresets }
      : base.activePresets,
    tipEffectMap: patch.tipEffectMap ?? base.tipEffectMap,
  };
}

export function createEffectsConfigState(initial: EffectsConfig = DEFAULT_EFFECTS_CONFIG) {
  let config = $state<EffectsConfig>(structuredClone(initial));

  function updateTrails(patch: Partial<TrailsIntent>) {
    config.trails = { ...config.trails, ...patch };
    config.activePresets.trails = null;
  }

  function updateFire(patch: Partial<FireIntent>) {
    config.fire = { ...config.fire, ...patch };
    config.activePresets.fire = null;
  }

  function updateLed(patch: Partial<LedIntent>) {
    config.led = { ...config.led, ...patch };
    config.activePresets.led = null;
  }

  function updateCharcoal(patch: Partial<CharcoalIntent>) {
    config.charcoal = { ...config.charcoal, ...patch };
    config.activePresets.charcoal = null;
  }

  function setTipEffectMap(map: TipEffectMap) {
    config.tipEffectMap = map;
  }

  function applyPreset(preset: EffectsPreset) {
    config = mergeConfig(config, preset.patch as Partial<EffectsConfig>);
    config.activePresets[preset.effectType] = preset.id;
  }

  function updateOverride<K extends keyof EffectsOverrides>(
    key: K,
    patch: NonNullable<EffectsOverrides[K]>,
  ) {
    const next: EffectsOverrides = { ...(config.overrides ?? {}) };
    next[key] = { ...(next[key] ?? {}), ...patch };
    config.overrides = next;
  }

  function replace(next: EffectsConfig) {
    config = structuredClone(next);
  }

  return {
    get config() { return config; },
    get tipEffectMap() { return config.tipEffectMap; },
    get trails() { return config.trails; },
    get fire() { return config.fire; },
    get led() { return config.led; },
    get charcoal() { return config.charcoal; },
    get overrides() { return config.overrides; },
    get activePresets() { return config.activePresets; },

    updateTrails,
    updateFire,
    updateLed,
    updateCharcoal,
    setTipEffectMap,
    applyPreset,
    updateOverride,
    replace,
  };
}

export type EffectsConfigState = ReturnType<typeof createEffectsConfigState>;
```

- [ ] **Step 4: Run test, verify pass**

Run: `npm test -- tests/unit/effects/state/effects-config-state.test.ts --run 2>&1 | tail -20`
Expected: PASS, 10 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/effects/state/effects-config-state.svelte.ts tests/unit/effects/state/effects-config-state.test.ts
git commit -m "feat(effects): EffectsConfigState factory with preset application"
```

---

## Task 13: Context helpers

**Files:**
- Create: `src/lib/shared/effects/state/effects-config-context.ts`

No unit test needed — Svelte's `setContext`/`getContext` are trusted framework primitives. Context plumbing failures are loud (thrown error), not silent.

- [ ] **Step 1: Create the context module**

Create `src/lib/shared/effects/state/effects-config-context.ts`:

```ts
import { getContext, setContext } from "svelte";
import type { EffectsConfigState } from "./effects-config-state.svelte";

const EFFECTS_CONFIG_CONTEXT_KEY = Symbol("effects-config-state");

export function setEffectsConfigContext(state: EffectsConfigState): EffectsConfigState {
  setContext(EFFECTS_CONFIG_CONTEXT_KEY, state);
  return state;
}

/**
 * Returns the effects config state from context.
 * Returns null if no ancestor has called setEffectsConfigContext —
 * callers decide whether to fall through to a default or throw.
 */
export function getEffectsConfigContext(): EffectsConfigState | null {
  return getContext<EffectsConfigState | null>(EFFECTS_CONFIG_CONTEXT_KEY) ?? null;
}
```

- [ ] **Step 2: Type-check**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep -E "effects/state/effects-config-context" || echo "clean"`
Expected: `clean`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/effects/state/effects-config-context.ts
git commit -m "feat(effects): Svelte context helpers for effects config"
```

---

## Task 14: Vm shim (read-side: seed from AnimationVisibilityStateManager)

**Files:**
- Create: `src/lib/shared/effects/compat/vm-shim.ts`
- Test: `tests/unit/effects/compat/vm-shim.test.ts`

**Context:** The shim bridges the existing `AnimationVisibilityStateManager` (`vm`) into the canonical state. Phase A keeps the old panels (`FireCategory`, `LedSection`, etc.) writing to `vm`, and the shim projects those writes into an `EffectsConfigState` on every change. This is the read side: given an existing `vm`, return an `EffectsConfig` snapshot. The listener side is Task 15.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/effects/compat/vm-shim.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { AnimationVisibilityStateManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import { snapshotConfigFromVm } from "$lib/shared/effects/compat/vm-shim";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";

describe("snapshotConfigFromVm", () => {
  it("returns a full EffectsConfig from a fresh vm", () => {
    const vm = new AnimationVisibilityStateManager({ ephemeral: true });
    const config = snapshotConfigFromVm(vm);
    expect(config.version).toBe(DEFAULT_EFFECTS_CONFIG.version);
    expect(config.fire.intensity).toBeGreaterThanOrEqual(0.45);
    expect(config.led.patternId).toBeTypeOf("string");
    expect(config.charcoal.intensity).toBeGreaterThanOrEqual(0);
    expect(config.tipEffectMap).toBeTypeOf("object");
  });

  it("reflects fire intensity changes on vm", () => {
    const vm = new AnimationVisibilityStateManager({ ephemeral: true });
    vm.setFireIntensity(0.9);
    const config = snapshotConfigFromVm(vm);
    expect(config.fire.intensity).toBe(0.9);
  });

  it("reflects LED primary color changes on vm", () => {
    const vm = new AnimationVisibilityStateManager({ ephemeral: true });
    vm.setLedPrimaryColor("#abcdef");
    const config = snapshotConfigFromVm(vm);
    expect(config.led.primaryColor).toBe("#abcdef");
  });

  it("reflects tipEffectMap changes on vm", () => {
    const vm = new AnimationVisibilityStateManager({ ephemeral: true });
    vm.setActiveEffect("fire");
    const config = snapshotConfigFromVm(vm);
    expect(config.tipEffectMap["*"]?.effect).toBe("fire");
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `npm test -- tests/unit/effects/compat/vm-shim.test.ts --run 2>&1 | tail -20`
Expected: FAIL, "Cannot find module ... vm-shim"

- [ ] **Step 3: Create the shim**

Create `src/lib/shared/effects/compat/vm-shim.ts`:

```ts
/**
 * Compatibility shim bridging AnimationVisibilityStateManager (vm) → canonical EffectsConfig.
 *
 * PHASE A ONLY. Deleted in Phase B when the 2D panels migrate to read
 * directly from canonical state.
 *
 * Read side: `snapshotConfigFromVm(vm)` produces a full EffectsConfig
 * from the current vm state. Used to seed a new EffectsConfigState when
 * a viewer component mounts.
 *
 * Live sync: `bindVmToEffectsConfig(vm, state)` registers a vm observer
 * that re-snapshots and writes back whenever any vm effect field changes.
 * Returns a disposer.
 */

import type { AnimationVisibilityStateManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import type { EffectsConfig } from "../domain/EffectsConfig";
import type { EffectsConfigState } from "../state/effects-config-state.svelte";
import { EFFECTS_CONFIG_VERSION } from "../domain/EffectsConfig";
import { DEFAULT_EFFECTS_CONFIG } from "../domain/defaults";

export function snapshotConfigFromVm(vm: AnimationVisibilityStateManager): EffectsConfig {
  return {
    version: EFFECTS_CONFIG_VERSION,

    tipEffectMap: vm.getTipEffectMap() ?? DEFAULT_EFFECTS_CONFIG.tipEffectMap,

    trails: {
      // Trails live in animationSettings, not vm. This snapshot returns
      // the schema defaults for trails — the animation-settings shim
      // (Task 16) provides the real values at the state factory level.
      ...DEFAULT_EFFECTS_CONFIG.trails,
    },

    fire: {
      intensity: vm.getFireIntensity(),
      colorBlend: vm.getFireColorBlend(),
      turbulence: vm.getFireTurbulence(),
      colorCurve: vm.getFireColorCurve(),
      propColors: vm.getFirePropColors(),
      customColors: null,
    },

    led: {
      brightness: vm.getLedBrightness(),
      patternId: vm.getLedPatternId(),
      patternSpeed: vm.getLedPatternSpeed(),
      primaryColor: vm.getLedPrimaryColor(),
      secondaryColor: vm.getLedSecondaryColor(),
      colorMode: vm.getLedColorMode(),
    },

    charcoal: {
      // semantic projection — the real params on vm are RGB; we read
      // the semantic slider values if exposed, else fall through to defaults.
      intensity: (vm as any).getCharcoalIntensitySemantic?.() ?? DEFAULT_EFFECTS_CONFIG.charcoal.intensity,
      spread: (vm as any).getCharcoalSpreadSemantic?.() ?? DEFAULT_EFFECTS_CONFIG.charcoal.spread,
      glow: (vm as any).getCharcoalGlowSemantic?.() ?? DEFAULT_EFFECTS_CONFIG.charcoal.glow,
    },

    activePresets: {
      trails: null,
      fire: null,
      led: vm.getActivePresetId(),
      charcoal: null,
    },
  };
}

export function bindVmToEffectsConfig(
  vm: AnimationVisibilityStateManager,
  state: EffectsConfigState,
): () => void {
  const onChange = () => {
    // Re-snapshot every vm change. Cheap — it's plain object construction,
    // not a Svelte reactivity chain.
    const snap = snapshotConfigFromVm(vm);
    state.replace(snap);
  };
  vm.registerObserver(onChange);
  return () => vm.unregisterObserver(onChange);
}
```

Note on `getCharcoalIntensitySemantic`: during Phase A, the semantic getters may not exist on vm yet. The `(vm as any).getCharcoalIntensitySemantic?.()` pattern means the shim uses defaults when the getter is absent. Task 17 (vm hook) adds the getters to vm if they're missing.

- [ ] **Step 4: Run test, verify pass**

Run: `npm test -- tests/unit/effects/compat/vm-shim.test.ts --run 2>&1 | tail -20`
Expected: PASS, 4 tests passed

If the test fails on `getLedColorMode` or similar missing getter, check `src/lib/shared/animation-engine/state/animation-visibility-state.svelte.ts` for the actual method name (the state was only partially read during spec time). If the method is named differently, update the shim call to match and re-run. Do NOT invent methods on vm.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/effects/compat/vm-shim.ts tests/unit/effects/compat/vm-shim.test.ts
git commit -m "feat(effects): compat shim snapshotting vm into canonical config"
```

---

## Task 15: Animation-settings shim (trails projection)

**Files:**
- Create: `src/lib/shared/effects/compat/animation-settings-shim.ts`

Trail appearance lives in `animation-settings-state.svelte.ts`, not on vm. This shim projects it into the canonical state.

No dedicated unit test — it's a trivial projection function whose correctness is validated by Phase A visual verification.

- [ ] **Step 1: Read the current animation-settings-state to confirm the trail shape**

Run: `grep -n "setTrailAppearance\|trail.*:" src/lib/shared/animation-engine/state/animation-settings-state.svelte.ts | head -30`
Expected: Shows field names for lineWidth, maxOpacity, minOpacity, glowBlur, blueColor, redColor, trackingMode.

Note the exact accessor names (e.g. `animationSettings.trail.lineWidth`).

- [ ] **Step 2: Create the shim**

Create `src/lib/shared/effects/compat/animation-settings-shim.ts`:

```ts
/**
 * Compatibility shim: animation-settings-state (trail appearance)
 * → canonical EffectsConfig trails intent.
 *
 * PHASE A ONLY. Deleted in Phase B.
 *
 * The existing animation-settings store holds trail thickness/brightness/
 * color/tracking. This shim projects those values into the canonical
 * schema's TrailsIntent shape and applies them to an EffectsConfigState.
 */

import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
import type { EffectsConfigState } from "../state/effects-config-state.svelte";
import type { TrailsIntent } from "../domain/EffectsConfig";

function snapshotTrailsFromAnimationSettings(): TrailsIntent {
  const t = animationSettings.trail;
  return {
    trackingMode: (t.trackingMode ?? "both_ends") as TrailsIntent["trackingMode"],
    thickness: t.lineWidth ?? 5,
    brightness: t.maxOpacity ?? 1.0,
    blueColor: t.blueColor ?? "#3D44B8",
    redColor: t.redColor ?? "#DC2626",
    rainbow: false,
  };
}

/**
 * Seed a fresh EffectsConfigState's trails field from animationSettings.
 * Call once after creating the state, before mounting the 3D viewer.
 */
export function seedTrailsFromAnimationSettings(state: EffectsConfigState): void {
  state.updateTrails(snapshotTrailsFromAnimationSettings());
  // updateTrails clears activePresets.trails; that's desired here
  // since we're reflecting raw state, not a preset selection.
}

/**
 * Bind a live listener so animationSettings changes propagate into the
 * canonical state. Returns a disposer.
 *
 * animation-settings-state uses Svelte 5 runes, so the caller must wrap
 * this in an `$effect` where it can be torn down:
 *
 *   $effect(() => {
 *     const dispose = bindAnimationSettingsToEffectsConfig(state);
 *     return dispose;
 *   });
 */
export function bindAnimationSettingsToEffectsConfig(state: EffectsConfigState): () => void {
  // We use a manual polling strategy via a $effect in the consumer
  // because animation-settings-state doesn't expose an observer API.
  // The consumer's $effect re-runs whenever animationSettings.trail.*
  // changes (Svelte's rune tracking), and calls seedTrailsFromAnimationSettings.
  seedTrailsFromAnimationSettings(state);
  // No observer to unregister — consumer's $effect cleanup handles it.
  return () => { /* noop */ };
}
```

- [ ] **Step 3: Type-check**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep -E "effects/compat/animation-settings-shim" || echo "clean"`
Expected: `clean`

If the check reports missing `animationSettings.trail.trackingMode` or similar field, read the actual shape of `animationSettings.trail` and adjust the accessor to match. Do not invent fields.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/effects/compat/animation-settings-shim.ts
git commit -m "feat(effects): compat shim for animation-settings trail projection"
```

---

## Task 16: Wire EffectOrchestrator3D to canonical state via translator

**Files:**
- Modify: `src/lib/shared/3d/effects/EffectOrchestrator3D.svelte`

This is the payoff task. The 3D renderer starts reading effect values from canonical state, the hardcoded LED constants disappear, and default trail colors come from config instead of hardcoded strings.

- [ ] **Step 1: Delete the hardcoded LED color constants**

In `src/lib/shared/3d/effects/EffectOrchestrator3D.svelte`, delete lines 44-46 (the `LED_BLUE_COLOR` and `LED_RED_COLOR` constants):

```ts
// DELETE these three lines:
// Default LED colors per prop (blue/red) — used when no pattern engine config
const LED_BLUE_COLOR = { r: 0.23, g: 0.51, b: 0.96 }; // #3b82f6
const LED_RED_COLOR = { r: 0.94, g: 0.27, b: 0.27 }; // #ef4444
```

- [ ] **Step 2: Add context import and resolve the effects config**

Add to the import block near the top of `<script>`:

```ts
import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import {
  resolveTrails3D,
  resolveFire3D,
  resolveLed3D,
  resolveCharcoal3D,
} from "$lib/shared/effects/translators/webgl3d-translator";
```

After the `useThrelte` + detector lines, add:

```ts
// Canonical effect config — read from context, or create a default-seeded
// local state as a fallback so this component still works when mounted
// outside a viewer that sets the context explicitly.
const effectsState = getEffectsConfigContext() ?? createEffectsConfigState();
```

- [ ] **Step 3: Wire LED tip colors to canonical state**

Replace every use of `LED_BLUE_COLOR.r/g/b` and `LED_RED_COLOR.r/g/b` with a derived `resolvedLed` value.

Add near the top of the `useTask` callback (before the `blueLedTips.length = 0` line), inside the task closure:

```ts
const resolvedLed = resolveLed3D(effectsState.led, effectsState.overrides?.led3D);
const blueLedRgb = hexToRgb(
  resolvedLed.colorMode === "prop-matched"
    ? resolvedLed.primaryColor
    : resolvedLed.primaryColor
);
const redLedRgb = hexToRgb(
  resolvedLed.colorMode === "prop-matched"
    ? resolvedLed.secondaryColor
    : resolvedLed.primaryColor
);
```

Add a small utility above the Props interface:

```ts
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  return {
    r: ((bigint >> 16) & 255) / 255,
    g: ((bigint >> 8) & 255) / 255,
    b: (bigint & 255) / 255,
  };
}
```

Then in the blue LED tip push (around line 210), replace:

```ts
r: LED_BLUE_COLOR.r,
g: LED_BLUE_COLOR.g,
b: LED_BLUE_COLOR.b,
```

with:

```ts
r: blueLedRgb.r,
g: blueLedRgb.g,
b: blueLedRgb.b,
```

And in the red LED tip push (around line 262), replace:

```ts
r: LED_RED_COLOR.r,
g: LED_RED_COLOR.g,
b: LED_RED_COLOR.b,
```

with:

```ts
r: redLedRgb.r,
g: redLedRgb.g,
b: redLedRgb.b,
```

- [ ] **Step 4: Wire trail color/opacity/width to canonical state**

At the bottom of the file, replace the two `<Trail3D>` blocks (both the blue and red `{#each}` loops) with versions that read from `resolveTrails3D`:

```svelte
{#each blueTrailTips as tip, i (i)}
  {@const resolvedTrails = resolveTrails3D(effectsState.trails, effectsState.overrides?.trails3D)}
  <Trail3D
    tipPosition={tip.position}
    color={resolvedTrails.rainbow ? "rainbow" : resolvedTrails.blueColor}
    propId="blue"
    width={resolvedTrails.tubeRadius}
    opacity={resolvedTrails.brightness}
    maxPoints={resolvedTrails.maxPoints}
    rainbow={resolvedTrails.rainbow}
    enabled={isPlaying}
    qualityTier={qualityTierDetector.currentTier}
    {lightManager}
  />
{/each}

{#each redTrailTips as tip, i (i)}
  {@const resolvedTrails = resolveTrails3D(effectsState.trails, effectsState.overrides?.trails3D)}
  <Trail3D
    tipPosition={tip.position}
    color={resolvedTrails.rainbow ? "rainbow" : resolvedTrails.redColor}
    propId="red"
    width={resolvedTrails.tubeRadius}
    opacity={resolvedTrails.brightness}
    maxPoints={resolvedTrails.maxPoints}
    rainbow={resolvedTrails.rainbow}
    enabled={isPlaying}
    qualityTier={qualityTierDetector.currentTier}
    {lightManager}
  />
{/each}
```

Delete the `trailConfig` prop from the `Props` interface — it's no longer the source of truth. Parents that previously passed it will be updated in Task 18.

- [ ] **Step 5: Type-check the whole file**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep "EffectOrchestrator3D" | tail -30`
Expected: no new errors originating from `EffectOrchestrator3D.svelte`. Pre-existing errors in unrelated files are fine.

If you see errors about `color` type on `Trail3D`, check `Trail3D.svelte`'s props. If `color` is typed as `string` and we're passing `"rainbow"`, that's already the pattern used by the old hardcoded defaults — no change needed. If the type rejects "rainbow", update the Trail3D `color` prop type to `string | "rainbow"` as a minimal follow-up in the same task.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/effects/EffectOrchestrator3D.svelte
git commit -m "feat(effects): EffectOrchestrator3D reads canonical config via translator"
```

---

## Task 17: Shim `AnimationVisibilityStateManager` setters to mirror canonical state

**Files:**
- Modify: `src/lib/shared/animation-engine/state/animation-visibility-state.svelte.ts`

**Why:** When a user drags the Fire Intensity slider, `FireCategory.svelte` calls `vm.setFireIntensity(x)`. For the 3D side to respond, that change must propagate into the canonical state. The vm-shim from Task 14 already offers `bindVmToEffectsConfig` which uses vm's observer API — we just need to make sure every effect setter triggers `notify()`. Verify and patch if missing.

- [ ] **Step 1: Audit effect setters on vm for notify() calls**

Run: `grep -n "setFireIntensity\|setFireColorBlend\|setFireTurbulence\|setLedBrightness\|setLedPrimaryColor\|setLedPatternId\|setLedPatternSpeed\|setActivePreset\|setCharcoalParams\|setActiveEffect\|notify" src/lib/shared/animation-engine/state/animation-visibility-state.svelte.ts | head -60`

Verify each setter ends with a call to `this.notify()` (or the equivalent notifier). List any that don't.

- [ ] **Step 2: For any setter missing notify(), add it**

Example fix pattern (only apply to setters that lack it):

```ts
setFireIntensity(value: number): void {
  this.settings.fireIntensity = value;
  this.saveToStorage();
  this.notify();  // ← add this if missing
}
```

- [ ] **Step 3: Verify with a test**

Append to `tests/unit/effects/compat/vm-shim.test.ts`:

```ts
import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import { bindVmToEffectsConfig } from "$lib/shared/effects/compat/vm-shim";

describe("bindVmToEffectsConfig", () => {
  it("propagates vm.setFireIntensity into canonical state", () => {
    const vm = new AnimationVisibilityStateManager({ ephemeral: true });
    const state = createEffectsConfigState();
    const dispose = bindVmToEffectsConfig(vm, state);

    vm.setFireIntensity(0.92);

    expect(state.config.fire.intensity).toBe(0.92);
    dispose();
  });

  it("propagates vm.setLedPrimaryColor into canonical state", () => {
    const vm = new AnimationVisibilityStateManager({ ephemeral: true });
    const state = createEffectsConfigState();
    const dispose = bindVmToEffectsConfig(vm, state);

    vm.setLedPrimaryColor("#123456");

    expect(state.config.led.primaryColor).toBe("#123456");
    dispose();
  });

  it("propagates vm.setActiveEffect into canonical tipEffectMap", () => {
    const vm = new AnimationVisibilityStateManager({ ephemeral: true });
    const state = createEffectsConfigState();
    const dispose = bindVmToEffectsConfig(vm, state);

    vm.setActiveEffect("fire");

    expect(state.config.tipEffectMap["*"]?.effect).toBe("fire");
    dispose();
  });

  it("dispose stops propagation", () => {
    const vm = new AnimationVisibilityStateManager({ ephemeral: true });
    const state = createEffectsConfigState();
    const dispose = bindVmToEffectsConfig(vm, state);
    dispose();

    vm.setFireIntensity(0.99);

    expect(state.config.fire.intensity).not.toBe(0.99);
  });
});
```

Run: `npm test -- tests/unit/effects/compat/vm-shim.test.ts --run 2>&1 | tail -20`
Expected: PASS, all 8 tests (4 snapshot + 4 bind)

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/animation-engine/state/animation-visibility-state.svelte.ts tests/unit/effects/compat/vm-shim.test.ts
git commit -m "feat(effects): vm setters notify observers so shim propagates"
```

---

## Task 18: Wire `ViewerSplitPane.svelte` to set effects context

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte`

- [ ] **Step 1: Read the current file to find the right spot**

Run: `grep -n "script\|onMount\|Viewer3DCanvas" src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte | head -20`

Identify where the component's `<script>` block initializes state so we can add context creation alongside.

- [ ] **Step 2: Add imports and context setup**

At the top of the `<script lang="ts">` block, add:

```ts
import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import { setEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
import { snapshotConfigFromVm, bindVmToEffectsConfig } from "$lib/shared/effects/compat/vm-shim";
import { seedTrailsFromAnimationSettings } from "$lib/shared/effects/compat/animation-settings-shim";
import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
```

After the existing state declarations, add:

```ts
// Canonical effects config — single source of truth for both 2D canvas
// and 3D viewer effect parameters. Seeded from existing state (vm +
// animationSettings) and kept in sync via a compat shim while Phase A
// is in flight. Shim deleted in Phase B.
const vm = getAnimationVisibilityManager();
const effectsConfigState = createEffectsConfigState(snapshotConfigFromVm(vm));
seedTrailsFromAnimationSettings(effectsConfigState);
setEffectsConfigContext(effectsConfigState);

$effect(() => {
  const dispose = bindVmToEffectsConfig(vm, effectsConfigState);
  return dispose;
});

// Re-seed trails when animationSettings changes (runes track deps).
$effect(() => {
  // Touch the fields Svelte needs to track for the $effect to re-run.
  animationSettings.trail.lineWidth;
  animationSettings.trail.maxOpacity;
  animationSettings.trail.blueColor;
  animationSettings.trail.redColor;
  animationSettings.trail.trackingMode;
  seedTrailsFromAnimationSettings(effectsConfigState);
});
```

- [ ] **Step 3: Type-check**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep "ViewerSplitPane" | tail -20`
Expected: no new errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte
git commit -m "feat(effects): ViewerSplitPane sets canonical effects context"
```

---

## Task 19: Wire `Viewer3DFullscreen.svelte` to set effects context

**Files:**
- Modify: `src/lib/shared/3d/components/Viewer3DFullscreen.svelte`

- [ ] **Step 1: Apply the same setup as Task 18**

In `Viewer3DFullscreen.svelte`, add the same six imports and context setup block as Task 18 Step 2 to the `<script>` block. The setup is identical — it's the same canonical state pattern for a different mount point.

If the component is a leaf that's mounted as a dialog from a parent that already set context, this step is a no-op. Check by running:

`grep -n "setEffectsConfigContext" src/lib/shared/3d/components/Viewer3DFullscreen.svelte`

If already set by a parent, skip to Step 3. Otherwise, add the setup.

- [ ] **Step 2: Type-check**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep "Viewer3DFullscreen" | tail -20`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/components/Viewer3DFullscreen.svelte
git commit -m "feat(effects): Viewer3DFullscreen sets canonical effects context"
```

---

## Task 20: Full test suite + svelte-check regression pass

**Files:** none (verification step)

- [ ] **Step 1: Run the full effects test suite**

Run: `npm test -- tests/unit/effects --run 2>&1 | tail -20`
Expected: all effects tests pass (approximately 50 tests across default-config, preset-patches, translator, state, shim files)

- [ ] **Step 2: Run svelte-check for regressions in touched files**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -40`

Expected: the existing 47 pre-existing errors noted in spec §2 may still be present, but NO new errors should appear in:
- `src/lib/shared/effects/**`
- `src/lib/shared/3d/effects/EffectOrchestrator3D.svelte`
- `src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte`
- `src/lib/shared/3d/components/Viewer3DFullscreen.svelte`
- `src/lib/shared/animation-engine/state/animation-visibility-state.svelte.ts`

If any new errors appear, fix them inline before proceeding to Task 21.

- [ ] **Step 3: Run the full existing test suite to catch regressions**

Run: `npm test --run 2>&1 | tail -20`
Expected: all previously-passing tests still pass.

- [ ] **Step 4: Commit any fixup changes**

If steps 2 or 3 required fixes:

```bash
git add -u
git commit -m "fix(effects): resolve type-check regressions from canonical-state wiring"
```

---

## Task 21: Visual verification (REQUIRED, human-in-loop)

**Files:** none — this is a manual smoke test per `.claude/rules/verification-protocol.md`

This is the ship gate. Everything before this is code — this confirms the user-visible behavior the user originally asked for.

- [ ] **Step 1: Build**

Run: `npm run build 2>&1 | tail -10`
Expected: build succeeds.

- [ ] **Step 2: Ask Austen to verify in a running session**

Message Austen with this exact verification request:

> "Phase A is implemented and the tests pass. I need you to verify the user-facing behavior in the running dev server (5173).
>
> 1. Open a sequence in the viewer with the 3D view active.
> 2. Open the animation export panel's effects panel.
> 3. Drag the **Fire Intensity** slider. The 3D fire should visibly respond.
> 4. Drag the **Trail Brightness** or **Thickness** slider. The 3D trail should visibly respond.
> 5. Change the **LED color** via the color swatches or custom picker. The 3D LED should take the new color.
> 6. Change the **Charcoal Intensity** slider. The 3D charcoal sparks should respond.
>
> Tell me which of those work and which don't. If any fail, I'll diagnose the specific wiring and fix it before Phase A is considered shipped."

- [ ] **Step 3: Wait for verification response**

Do NOT claim Phase A is done until Austen has confirmed visually or requested specific fixes.

- [ ] **Step 4: If all four work, commit the final marker**

```bash
git commit --allow-empty -m "chore(effects): Phase A verified — 2D sliders drive 3D"
```

---

## Self-review notes

**Spec coverage check:** Every Phase A bullet from §13 of the design spec is covered by a task above:
- New `effects/domain/` module → Tasks 1, 2, 3
- New `effects/translators/` module → Tasks 8, 9, 10, 11
- New `effects/state/` module → Tasks 12, 13
- New `effects/domain/presets/` → Tasks 4, 5, 6, 7
- `EffectOrchestrator3D` reads canonical via context + translator → Task 16
- Compat shim → Tasks 14, 15, 17
- Hardcoded LED/trail constants deleted → Task 16 (Steps 1, 3, 4)
- Ship-first milestone verification → Task 21

**Placeholder scan:** No TBD/TODO/"fill in" patterns. Every step contains the code the engineer will type or the exact command with expected output.

**Type consistency check:**
- `EffectsConfigState` is the factory return type; used consistently in `effects-config-context.ts`, vm-shim, animation-settings-shim, and the two viewer components.
- `resolveTrails3D(state.trails, state.overrides?.trails3D)` — override shape is `Record<string, unknown>` in the schema but `Partial<Trails3DParams>` in the translator signature. There's a mild type widening at the call site. The spec accepts this: `EffectsOverrides` uses `Record<string, unknown>` for the override storage because the schema doesn't import backend types (to avoid circular dependency), and the translator narrows on use. If strict mode complains, add an `as Partial<Trails3DParams>` cast at the call site in Task 16; it's a deliberate, localized widening.
- `DeepPartial<EffectsConfig>` (used by `EffectsPreset.patch`) is cast to `Partial<EffectsConfig>` inside `mergeConfig` in Task 12. The cast is safe because `mergeConfig` only reads known top-level keys and shallow-merges sub-objects — fields beyond one level deep are treated as whole replacements, which matches the semantics the preset tests rely on.
- `tipEffectMap` type imported from `$lib/shared/animation-engine/domain/types/TipEffectTypes` consistently across schema, state factory, and shim.

**Self-review ends here. Plan ready for execution.**

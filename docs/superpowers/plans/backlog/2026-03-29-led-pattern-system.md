# LED Pattern System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 2-pattern LED system with a 22-pattern library across 6 categories, with color presets and a new expandable picker UI.

**Architecture:** Extend the existing pattern engine from a switch statement to a registry of pure evaluator functions. Each category is one file. A `TipEvaluationContext` carries spatial data so TKA-aware patterns can use tip relationships. Color presets live in the state manager alongside existing LED settings.

**Tech Stack:** Svelte 5, TypeScript strict, existing AnimationVisibilityStateManager, WebGL LED renderer (unchanged), Vitest

**Spec:** `docs/superpowers/specs/2026-03-29-led-pattern-system-design.md`

---

## File Structure

```
src/lib/shared/animation-engine/
├── domain/
│   ├── patterns/                          # NEW directory
│   │   ├── context.ts                     # TipEvaluationContext type + builder
│   │   ├── evaluator.ts                   # Registry + evaluatePattern()
│   │   ├── registry.ts                    # LedPatternDescriptor catalog
│   │   ├── noise.ts                       # Simplex noise utility
│   │   ├── solid.ts                       # Solid, Split, Quad
│   │   ├── breathe.ts                     # Breathe, Pulse, Heartbeat, Color Morph
│   │   ├── chase.ts                       # Chase, Comet, Wave, Cascade
│   │   ├── spectrum.ts                    # Rainbow, Warm Shift, Cool Shift, Neon
│   │   ├── texture.ts                     # Sparkle, Flicker, Aurora
│   │   └── tka-aware.ts                   # Proximity, Velocity, Mirror Sync, Beat Pulse
│   └── types/
│       ├── LedTypes.ts                    # MODIFY: add secondaryColor to LedOverlayConfig
│       ├── LedColorPresets.ts             # NEW: preset types + built-in presets
│       └── LedPatterns.ts                 # MODIFY: backward-compat wrapper
├── components/animation-settings-modal/
│   ├── categories/
│   │   └── LedCategory.svelte             # DELETE (replaced)
│   ├── LedSection.svelte                  # NEW: expandable LED settings
│   ├── LedColorPresetRow.svelte           # NEW: color swatch row
│   └── LedPatternGrid.svelte             # NEW: categorized pattern grid
├── services/implementations/
│   └── LedTipTracker.ts                   # MODIFY: build TipEvaluationContext
├── state/
│   └── animation-visibility-state.svelte.ts  # MODIFY: new LED fields + methods

tests/unit/animation-engine/
├── pattern-evaluators.test.ts             # NEW: all 22 pattern evaluators
├── pattern-registry.test.ts              # NEW: registry lookup + fallback
├── noise.test.ts                          # NEW: simplex determinism
└── color-presets.test.ts                  # NEW: preset CRUD
```

---

## Task 1: TipEvaluationContext Type + Builder

**Files:**
- Create: `src/lib/shared/animation-engine/domain/patterns/context.ts`
- Test: `tests/unit/animation-engine/pattern-evaluators.test.ts`

- [ ] **Step 1: Create context type and builder**

```typescript
// src/lib/shared/animation-engine/domain/patterns/context.ts
import type { LedColor } from "../types/LedPatterns";

export interface TipRelationData {
  readonly x: number;
  readonly y: number;
  readonly propIndex: number;
  readonly tipIndex: number;
}

export interface TipEvaluationContext {
  time: number;
  ledIndex: number;
  totalLeds: number;
  speed: number;
  primaryColor: LedColor;
  secondaryColor: LedColor;
  propIndex: 0 | 1;
  tipIndex: number;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  speedMagnitude: number;
  prevFrameTips: ReadonlyArray<TipRelationData>;
  beatIndex: number;
  totalBeats: number;
}

const WHITE: LedColor = { r: 1, g: 1, b: 1 };
const EMPTY_TIPS: ReadonlyArray<TipRelationData> = [];

/**
 * Pre-allocated context object reused every frame to avoid GC pressure.
 * Call resetContext() then mutate fields before passing to evaluatePattern().
 */
export function createReusableContext(): TipEvaluationContext {
  return {
    time: 0,
    ledIndex: 0,
    totalLeds: 0,
    speed: 1,
    primaryColor: { r: 0, g: 1, b: 0.53 },
    secondaryColor: { ...WHITE },
    propIndex: 0,
    tipIndex: 0,
    x: 0,
    y: 0,
    velocityX: 0,
    velocityY: 0,
    speedMagnitude: 0,
    prevFrameTips: EMPTY_TIPS,
    beatIndex: -1,
    totalBeats: 0,
  };
}
```

- [ ] **Step 2: Write test for context builder**

```typescript
// tests/unit/animation-engine/pattern-evaluators.test.ts
import { describe, it, expect } from "vitest";
import { createReusableContext } from "$lib/shared/animation-engine/domain/patterns/context";

describe("TipEvaluationContext", () => {
  it("creates a context with sensible defaults", () => {
    const ctx = createReusableContext();
    expect(ctx.time).toBe(0);
    expect(ctx.beatIndex).toBe(-1);
    expect(ctx.totalBeats).toBe(0);
    expect(ctx.prevFrameTips).toHaveLength(0);
    expect(ctx.secondaryColor).toEqual({ r: 1, g: 1, b: 1 });
  });

  it("context is mutable for reuse", () => {
    const ctx = createReusableContext();
    ctx.time = 1.5;
    ctx.propIndex = 1;
    expect(ctx.time).toBe(1.5);
    expect(ctx.propIndex).toBe(1);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/unit/animation-engine/pattern-evaluators.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/animation-engine/domain/patterns/context.ts tests/unit/animation-engine/pattern-evaluators.test.ts
git commit -m "feat(led): add TipEvaluationContext type and reusable builder"
```

---

## Task 2: Pattern Registry + Evaluator Core

**Files:**
- Create: `src/lib/shared/animation-engine/domain/patterns/registry.ts`
- Create: `src/lib/shared/animation-engine/domain/patterns/evaluator.ts`
- Test: `tests/unit/animation-engine/pattern-registry.test.ts`

- [ ] **Step 1: Create pattern descriptor registry**

```typescript
// src/lib/shared/animation-engine/domain/patterns/registry.ts
export type PatternCategory =
  | "solid"
  | "breathe"
  | "chase"
  | "spectrum"
  | "texture"
  | "tka-aware";

export interface LedPatternDescriptor {
  id: string;
  name: string;
  category: PatternCategory;
  requiresTipContext: boolean;
  usesSecondaryColor: boolean;
  sortOrder: number;
}

export const PATTERN_DESCRIPTORS: readonly LedPatternDescriptor[] = [
  // Solid & Static
  { id: "solid", name: "Solid", category: "solid", requiresTipContext: false, usesSecondaryColor: false, sortOrder: 0 },
  { id: "split", name: "Split", category: "solid", requiresTipContext: false, usesSecondaryColor: true, sortOrder: 1 },
  { id: "quad", name: "Quad", category: "solid", requiresTipContext: false, usesSecondaryColor: true, sortOrder: 2 },
  // Breathing & Fades
  { id: "breathe", name: "Breathe", category: "breathe", requiresTipContext: false, usesSecondaryColor: false, sortOrder: 0 },
  { id: "pulse", name: "Pulse", category: "breathe", requiresTipContext: false, usesSecondaryColor: false, sortOrder: 1 },
  { id: "heartbeat", name: "Heartbeat", category: "breathe", requiresTipContext: false, usesSecondaryColor: false, sortOrder: 2 },
  { id: "color-morph", name: "Color Morph", category: "breathe", requiresTipContext: false, usesSecondaryColor: true, sortOrder: 3 },
  // Motion & Chase
  { id: "chase", name: "Chase", category: "chase", requiresTipContext: false, usesSecondaryColor: false, sortOrder: 0 },
  { id: "comet", name: "Comet", category: "chase", requiresTipContext: false, usesSecondaryColor: false, sortOrder: 1 },
  { id: "wave", name: "Wave", category: "chase", requiresTipContext: false, usesSecondaryColor: false, sortOrder: 2 },
  { id: "cascade", name: "Cascade", category: "chase", requiresTipContext: false, usesSecondaryColor: false, sortOrder: 3 },
  // Spectrum & Color
  { id: "rainbow", name: "Rainbow", category: "spectrum", requiresTipContext: false, usesSecondaryColor: false, sortOrder: 0 },
  { id: "warm-shift", name: "Warm Shift", category: "spectrum", requiresTipContext: false, usesSecondaryColor: false, sortOrder: 1 },
  { id: "cool-shift", name: "Cool Shift", category: "spectrum", requiresTipContext: false, usesSecondaryColor: false, sortOrder: 2 },
  { id: "neon", name: "Neon", category: "spectrum", requiresTipContext: false, usesSecondaryColor: false, sortOrder: 3 },
  // Texture & Organic
  { id: "sparkle", name: "Sparkle", category: "texture", requiresTipContext: false, usesSecondaryColor: false, sortOrder: 0 },
  { id: "flicker", name: "Flicker", category: "texture", requiresTipContext: false, usesSecondaryColor: false, sortOrder: 1 },
  { id: "aurora", name: "Aurora", category: "texture", requiresTipContext: false, usesSecondaryColor: false, sortOrder: 2 },
  // TKA-Aware
  { id: "proximity", name: "Proximity", category: "tka-aware", requiresTipContext: true, usesSecondaryColor: false, sortOrder: 0 },
  { id: "velocity", name: "Velocity", category: "tka-aware", requiresTipContext: true, usesSecondaryColor: false, sortOrder: 1 },
  { id: "mirror-sync", name: "Mirror Sync", category: "tka-aware", requiresTipContext: true, usesSecondaryColor: false, sortOrder: 2 },
  { id: "beat-pulse", name: "Beat Pulse", category: "tka-aware", requiresTipContext: true, usesSecondaryColor: false, sortOrder: 3 },
];

export const CATEGORY_LABELS: Record<PatternCategory, string> = {
  solid: "Solid & Static",
  breathe: "Breathing & Fades",
  chase: "Motion & Chase",
  spectrum: "Spectrum & Color",
  texture: "Texture & Organic",
  "tka-aware": "TKA-Aware",
};

export function getPatternDescriptor(id: string): LedPatternDescriptor | undefined {
  return PATTERN_DESCRIPTORS.find((p) => p.id === id);
}

export function getPatternsByCategory(category: PatternCategory): LedPatternDescriptor[] {
  return PATTERN_DESCRIPTORS.filter((p) => p.category === category);
}
```

- [ ] **Step 2: Create evaluator with placeholder (solid-only initially)**

```typescript
// src/lib/shared/animation-engine/domain/patterns/evaluator.ts
import type { LedColor } from "../types/LedPatterns";
import type { TipEvaluationContext } from "./context";

export type PatternEvaluatorFn = (ctx: TipEvaluationContext) => LedColor;

// Initially created with just the type export + evaluatePattern shell.
// The registry is populated in Task 12 (after all category files exist)
// by importing every evaluator directly. No side-effect registration.
// Category files do NOT import from evaluator.ts — they just export
// pure functions. evaluator.ts imports from them. No circular deps.

// Placeholder until Task 12 wires in all evaluators:
let EVALUATOR_REGISTRY: ReadonlyMap<string, PatternEvaluatorFn> = new Map();

/**
 * Called once from LedPatterns.ts (backward-compat) or LedTipTracker
 * to initialize the registry with all evaluator imports.
 * This avoids circular deps: category files export pure fns,
 * the initialization site imports both evaluator.ts and category files.
 */
export function initializeRegistry(entries: ReadonlyArray<[string, PatternEvaluatorFn]>): void {
  EVALUATOR_REGISTRY = new Map(entries);
}

export function evaluatePattern(id: string, ctx: TipEvaluationContext): LedColor {
  const evaluator = EVALUATOR_REGISTRY.get(id);
  if (!evaluator) {
    return { r: ctx.primaryColor.r, g: ctx.primaryColor.g, b: ctx.primaryColor.b };
  }
  return evaluator(ctx);
}

export function hasPattern(id: string): boolean {
  return EVALUATOR_REGISTRY.has(id);
}
```

**Important:** Category files (solid.ts, breathe.ts, etc.) do NOT call any registration function. They only export pure functions. The registry is assembled explicitly in Task 12 when all category files exist, matching the spec's const-registry design. No import-order fragility.

- [ ] **Step 3: Write registry tests**

```typescript
// tests/unit/animation-engine/pattern-registry.test.ts
import { describe, it, expect } from "vitest";
import {
  PATTERN_DESCRIPTORS,
  getPatternDescriptor,
  getPatternsByCategory,
  CATEGORY_LABELS,
} from "$lib/shared/animation-engine/domain/patterns/registry";
import { evaluatePattern, hasPattern } from "$lib/shared/animation-engine/domain/patterns/evaluator";
import { createReusableContext } from "$lib/shared/animation-engine/domain/patterns/context";

describe("Pattern Registry", () => {
  it("has 22 pattern descriptors", () => {
    expect(PATTERN_DESCRIPTORS).toHaveLength(22);
  });

  it("all pattern IDs are unique", () => {
    const ids = PATTERN_DESCRIPTORS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all 6 categories have at least one pattern", () => {
    for (const category of Object.keys(CATEGORY_LABELS)) {
      const patterns = getPatternsByCategory(category as any);
      expect(patterns.length).toBeGreaterThan(0);
    }
  });

  it("getPatternDescriptor finds known pattern", () => {
    const solid = getPatternDescriptor("solid");
    expect(solid).toBeDefined();
    expect(solid!.name).toBe("Solid");
    expect(solid!.category).toBe("solid");
  });

  it("getPatternDescriptor returns undefined for unknown", () => {
    expect(getPatternDescriptor("nonexistent")).toBeUndefined();
  });
});

describe("Pattern Evaluator", () => {
  it("unknown pattern falls back to primary color", () => {
    const ctx = createReusableContext();
    ctx.primaryColor = { r: 0.5, g: 0.3, b: 0.1 };
    const color = evaluatePattern("nonexistent-pattern", ctx);
    expect(color).toEqual({ r: 0.5, g: 0.3, b: 0.1 });
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/animation-engine/pattern-registry.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/animation-engine/domain/patterns/registry.ts src/lib/shared/animation-engine/domain/patterns/evaluator.ts tests/unit/animation-engine/pattern-registry.test.ts
git commit -m "feat(led): add pattern descriptor registry and evaluator core"
```

---

## Task 3: Simplex Noise Utility

**Files:**
- Create: `src/lib/shared/animation-engine/domain/patterns/noise.ts`
- Test: `tests/unit/animation-engine/noise.test.ts`

- [ ] **Step 1: Write noise determinism test**

```typescript
// tests/unit/animation-engine/noise.test.ts
import { describe, it, expect } from "vitest";
import { simplex2d } from "$lib/shared/animation-engine/domain/patterns/noise";

describe("simplex2d", () => {
  it("returns values in [-1, 1]", () => {
    for (let x = -10; x <= 10; x += 0.7) {
      for (let y = -10; y <= 10; y += 0.7) {
        const v = simplex2d(x, y);
        expect(v).toBeGreaterThanOrEqual(-1);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it("is deterministic (same input = same output)", () => {
    const a = simplex2d(3.14, 2.71);
    const b = simplex2d(3.14, 2.71);
    expect(a).toBe(b);
  });

  it("varies with input (not constant)", () => {
    const values = new Set<number>();
    for (let i = 0; i < 10; i++) {
      values.add(simplex2d(i * 0.5, i * 0.3));
    }
    expect(values.size).toBeGreaterThan(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/animation-engine/noise.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement simplex noise**

Implement a standard 2D simplex noise function in `src/lib/shared/animation-engine/domain/patterns/noise.ts`. Use the well-known permutation table approach (~60-80 lines). No external dependencies. All math is deterministic.

Reference implementation: Stefan Gustavson's simplex noise (public domain), adapted to TypeScript with pre-allocated gradient table.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/animation-engine/noise.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/animation-engine/domain/patterns/noise.ts tests/unit/animation-engine/noise.test.ts
git commit -m "feat(led): add deterministic simplex noise utility for texture patterns"
```

---

## Task 4: Solid & Static Pattern Evaluators

**Files:**
- Create: `src/lib/shared/animation-engine/domain/patterns/solid.ts`
- Test: append to `tests/unit/animation-engine/pattern-evaluators.test.ts`

- [ ] **Step 1: Write tests for solid patterns**

Append to `tests/unit/animation-engine/pattern-evaluators.test.ts`:

```typescript
import { evaluatePattern, initializeRegistry } from "$lib/shared/animation-engine/domain/patterns/evaluator";
import { evaluateSolid, evaluateSplit, evaluateQuad } from "$lib/shared/animation-engine/domain/patterns/solid";

// Initialize registry with the patterns under test
initializeRegistry([
  ["solid", evaluateSolid],
  ["split", evaluateSplit],
  ["quad", evaluateQuad],
]);

describe("Solid patterns", () => {
  it("solid returns primary color unchanged", () => {
    const ctx = createReusableContext();
    ctx.primaryColor = { r: 0.2, g: 0.8, b: 0.5 };
    const color = evaluatePattern("solid", ctx);
    expect(color.r).toBeCloseTo(0.2);
    expect(color.g).toBeCloseTo(0.8);
    expect(color.b).toBeCloseTo(0.5);
  });

  it("split returns primary for propIndex 0, secondary for propIndex 1", () => {
    const ctx = createReusableContext();
    ctx.primaryColor = { r: 1, g: 0, b: 0 };
    ctx.secondaryColor = { r: 0, g: 0, b: 1 };
    ctx.propIndex = 0;
    const left = evaluatePattern("split", ctx);
    expect(left.r).toBeCloseTo(1);

    ctx.propIndex = 1;
    const right = evaluatePattern("split", ctx);
    expect(right.b).toBeCloseTo(1);
  });

  it("quad assigns distinct colors to all 4 tip positions", () => {
    const ctx = createReusableContext();
    ctx.primaryColor = { r: 1, g: 0, b: 0 };
    ctx.secondaryColor = { r: 0, g: 1, b: 0 };

    const tips: Array<[0|1, number]> = [[0,0],[0,1],[1,0],[1,1]];
    const colors = tips.map(([prop, tip]) => {
      ctx.propIndex = prop;
      ctx.tipIndex = tip;
      return evaluatePattern("quad", ctx);
    });

    // All 4 colors should be distinct
    const keys = colors.map((c) => `${c.r.toFixed(3)},${c.g.toFixed(3)},${c.b.toFixed(3)}`);
    expect(new Set(keys).size).toBe(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/animation-engine/pattern-evaluators.test.ts`
Expected: FAIL (solid evaluators not registered)

- [ ] **Step 3: Implement solid evaluators**

```typescript
// src/lib/shared/animation-engine/domain/patterns/solid.ts
import type { LedColor } from "../types/LedPatterns";
import type { TipEvaluationContext } from "./context";

// Pure function exports only. No registration call.
// The evaluator registry imports these in Task 12.

export function evaluateSolid(ctx: TipEvaluationContext): LedColor {
  return { r: ctx.primaryColor.r, g: ctx.primaryColor.g, b: ctx.primaryColor.b };
}

export function evaluateSplit(ctx: TipEvaluationContext): LedColor {
  const c = ctx.propIndex === 0 ? ctx.primaryColor : ctx.secondaryColor;
  return { r: c.r, g: c.g, b: c.b };
}

export function evaluateQuad(ctx: TipEvaluationContext): LedColor {
  // 4-color palette: primary, secondary, and two derived blends
  // propIndex 0 tip 0 = primary, propIndex 0 tip 1 = secondary
  // propIndex 1 tip 0 = blend toward blue, propIndex 1 tip 1 = blend toward red
  const palette: LedColor[] = [
    ctx.primaryColor,
    ctx.secondaryColor,
    { r: ctx.primaryColor.r * 0.3, g: ctx.primaryColor.g * 0.5, b: Math.min(1, ctx.primaryColor.b + 0.5) },
    { r: Math.min(1, ctx.primaryColor.r + 0.5), g: ctx.primaryColor.g * 0.3, b: ctx.primaryColor.b * 0.5 },
  ];
  const index = ctx.propIndex * 2 + Math.min(ctx.tipIndex, 1);
  return palette[index] ?? palette[0]!;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/animation-engine/pattern-evaluators.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/animation-engine/domain/patterns/solid.ts tests/unit/animation-engine/pattern-evaluators.test.ts
git commit -m "feat(led): add solid, split, quad pattern evaluators"
```

---

## Task 5: Breathing & Fade Pattern Evaluators

**Files:**
- Create: `src/lib/shared/animation-engine/domain/patterns/breathe.ts`
- Test: append to `tests/unit/animation-engine/pattern-evaluators.test.ts`

- [ ] **Step 1: Write tests**

Append tests for breathe, pulse, heartbeat, color-morph. Key assertions:
- `breathe`: at time=0 output should be dim (sine trough), at time=period/4 should be bright (sine peak)
- `pulse`: output brightness decays over time within one cycle
- `heartbeat`: two brightness peaks per cycle
- `color-morph`: at time=0 returns primaryColor, at time=half-cycle returns secondaryColor

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/animation-engine/pattern-evaluators.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement breathing evaluators**

Each evaluator is a pure function using `Math.sin`, `Math.pow`, and linear interpolation. No allocations. All timing driven by `ctx.time * ctx.speed`.

Key formulas:
- **Breathe**: `brightness = 0.5 + 0.5 * Math.sin(t * 2π)`
- **Pulse**: `brightness = Math.pow(Math.max(0, 1 - frac * 2), 3)` where frac is fractional cycle position
- **Heartbeat**: two `Math.pow` peaks at 0.0 and 0.15 within each cycle
- **Color Morph**: `lerp(primary, secondary, 0.5 + 0.5 * Math.sin(t * 2π))`

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/animation-engine/domain/patterns/breathe.ts tests/unit/animation-engine/pattern-evaluators.test.ts
git commit -m "feat(led): add breathe, pulse, heartbeat, color-morph evaluators"
```

---

## Task 6: Motion & Chase Pattern Evaluators

**Files:**
- Create: `src/lib/shared/animation-engine/domain/patterns/chase.ts`
- Test: append to `tests/unit/animation-engine/pattern-evaluators.test.ts`

- [ ] **Step 1: Write tests**

Key assertions:
- `chase`: at a given time, only one tip index should be fully bright (the "head" position)
- `comet`: brightness decreases for tips further from the head
- `wave`: different ledIndex values produce different brightness at the same time
- `cascade`: same ledIndex at staggered times produces the same brightness pattern

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement chase evaluators**

Key formulas:
- **Chase**: head position cycles through `totalLeds` over time. Each tip's brightness = gaussian falloff from head.
- **Comet**: same as chase but asymmetric falloff (sharp leading edge, exponential trailing tail).
- **Wave**: `brightness = 0.5 + 0.5 * Math.sin(t * 2π - ledIndex / totalLeds * 2π)`
- **Cascade**: same animation for all tips, but each tip's time is offset by `ledIndex * stagger`.

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/animation-engine/domain/patterns/chase.ts tests/unit/animation-engine/pattern-evaluators.test.ts
git commit -m "feat(led): add chase, comet, wave, cascade evaluators"
```

---

## Task 7: Spectrum & Color Pattern Evaluators

**Files:**
- Create: `src/lib/shared/animation-engine/domain/patterns/spectrum.ts`
- Test: append to `tests/unit/animation-engine/pattern-evaluators.test.ts`

- [ ] **Step 1: Write tests**

Key assertions:
- `rainbow`: output hue shifts over time; different ledIndex values produce different hues at same time
- `warm-shift`: output stays within warm hue range (red/orange/yellow, roughly hue 0-60°)
- `cool-shift`: output stays within cool hue range (blue/cyan/teal, roughly hue 180-240°)
- `neon`: output stays within neon hue range (magenta/violet/blue/cyan, roughly hue 240-330°)

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement spectrum evaluators**

Import `hslToRgb` from the existing `LedPatterns.ts`. Each spectrum pattern cycles through a constrained hue range using the same `hslToRgb` function the rainbow pattern already uses.

Key formulas:
- **Rainbow**: `hue = (t * 0.15 + ledIndex / totalLeds) % 1.0` (matches existing implementation)
- **Warm Shift**: `hue = lerp(0/360, 60/360, 0.5 + 0.5 * sin(t))` with ledIndex offset
- **Cool Shift**: `hue = lerp(180/360, 240/360, 0.5 + 0.5 * sin(t))` with ledIndex offset
- **Neon**: `hue = lerp(270/360, 330/360, 0.5 + 0.5 * sin(t))` with ledIndex offset

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/animation-engine/domain/patterns/spectrum.ts tests/unit/animation-engine/pattern-evaluators.test.ts
git commit -m "feat(led): add rainbow, warm-shift, cool-shift, neon evaluators"
```

---

## Task 8: Texture & Organic Pattern Evaluators

**Files:**
- Create: `src/lib/shared/animation-engine/domain/patterns/texture.ts`
- Test: append to `tests/unit/animation-engine/pattern-evaluators.test.ts`

- [ ] **Step 1: Write tests**

Key assertions:
- `sparkle`: output varies between calls with different time values (not constant)
- `flicker`: output is always > 0 (never fully off, candle-like), varies with time
- `aurora`: returns valid RGB in [0,1] range, varies with time and ledIndex

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement texture evaluators**

Uses `simplex2d` from `noise.ts`.

Key formulas:
- **Sparkle**: `brightness = max(0, simplex2d(ledIndex * 10, t * speed * 5) - 0.6) * 2.5` — spiky peaks
- **Flicker**: `brightness = 0.6 + 0.4 * simplex2d(ledIndex * 3, t * speed)` — gentle variation, never dark
- **Aurora**: multi-octave noise driving hue and brightness. `hue = simplex2d(t * 0.1, ledIndex) * 0.3 + 0.45` (blue-green range), `brightness = 0.5 + 0.5 * simplex2d(t * 0.15 + 100, ledIndex * 2)`

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/animation-engine/domain/patterns/texture.ts tests/unit/animation-engine/pattern-evaluators.test.ts
git commit -m "feat(led): add sparkle, flicker, aurora evaluators"
```

---

## Task 9: TKA-Aware Pattern Evaluators

**Files:**
- Create: `src/lib/shared/animation-engine/domain/patterns/tka-aware.ts`
- Test: append to `tests/unit/animation-engine/pattern-evaluators.test.ts`

- [ ] **Step 1: Write tests**

Key assertions:
- `proximity`: when prevFrameTips has a tip very close (distance < 50), brightness increases. When far (distance > 400), brightness is low.
- `velocity`: with speedMagnitude=0 output is dim. With speedMagnitude=3000 output is bright.
- `mirror-sync`: propIndex 0 and propIndex 1 at the same time produce colors that are phase-offset (not identical).
- `beat-pulse`: with speed=2 (120 BPM), at time=0.0 brightness is high, at time=0.25 brightness is low.

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement TKA-aware evaluators**

Key formulas:
- **Proximity**: find minimum distance from this tip to any tip in `prevFrameTips`. `brightness = 1 - clamp(minDist / 400, 0, 1)`. Uses Euclidean distance in viewbox coords (950x950).
- **Velocity**: `brightness = clamp(speedMagnitude / 3000, 0.1, 1.0)`. Never fully off.
- **Mirror Sync**: applies `breathe` formula but with `time` offset by `π` for propIndex 1. Left and right props pulse in opposition.
- **Beat Pulse**: `bpm = speed * 60`. `beatPhase = (time * bpm / 60) % 1`. `brightness = pow(max(0, 1 - beatPhase * 4), 2)`. Sharp flash at beat start, quick fade.

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/animation-engine/domain/patterns/tka-aware.ts tests/unit/animation-engine/pattern-evaluators.test.ts
git commit -m "feat(led): add proximity, velocity, mirror-sync, beat-pulse evaluators"
```

---

## Task 10: Color Presets Type + CRUD

**Files:**
- Create: `src/lib/shared/animation-engine/domain/types/LedColorPresets.ts`
- Test: `tests/unit/animation-engine/color-presets.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// tests/unit/animation-engine/color-presets.test.ts
import { describe, it, expect } from "vitest";
import {
  BUILT_IN_COLOR_PRESETS,
  findPreset,
  validatePreset,
  type LedColorPreset,
} from "$lib/shared/animation-engine/domain/types/LedColorPresets";

describe("Color Presets", () => {
  it("has 8 built-in presets", () => {
    expect(BUILT_IN_COLOR_PRESETS).toHaveLength(8);
  });

  it("all built-in presets have builtIn: true", () => {
    for (const p of BUILT_IN_COLOR_PRESETS) {
      expect(p.builtIn).toBe(true);
    }
  });

  it("all preset IDs are unique", () => {
    const ids = BUILT_IN_COLOR_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("findPreset locates by ID across built-in and user presets", () => {
    const userPresets: LedColorPreset[] = [
      { id: "custom-1", name: "My Color", primaryColor: "#ff0000", builtIn: false },
    ];
    expect(findPreset("green-glow", userPresets)).toBeDefined();
    expect(findPreset("custom-1", userPresets)).toBeDefined();
    expect(findPreset("nonexistent", userPresets)).toBeUndefined();
  });

  it("validatePreset rejects malformed presets", () => {
    expect(validatePreset({ id: "x", name: "X", primaryColor: "#fff000", builtIn: false })).toBe(true);
    expect(validatePreset({ id: "", name: "X", primaryColor: "#fff000", builtIn: false })).toBe(false);
    expect(validatePreset({ name: "X", primaryColor: "#fff000", builtIn: false } as any)).toBe(false);
    expect(validatePreset(null as any)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement color presets**

```typescript
// src/lib/shared/animation-engine/domain/types/LedColorPresets.ts
export interface LedColorPreset {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor?: string;
  builtIn: boolean;
}

export const BUILT_IN_COLOR_PRESETS: readonly LedColorPreset[] = [
  { id: "green-glow", name: "Green Glow", primaryColor: "#00ff88", builtIn: true },
  { id: "fire-red", name: "Fire Red", primaryColor: "#ff4444", builtIn: true },
  { id: "ice-blue", name: "Ice Blue", primaryColor: "#4488ff", builtIn: true },
  { id: "hot-pink", name: "Hot Pink", primaryColor: "#ff00ff", builtIn: true },
  { id: "amber", name: "Amber", primaryColor: "#ffaa00", builtIn: true },
  { id: "ultraviolet", name: "Ultraviolet", primaryColor: "#8800ff", builtIn: true },
  { id: "white", name: "White", primaryColor: "#ffffff", builtIn: true },
  { id: "cyan", name: "Cyan", primaryColor: "#00ffff", builtIn: true },
];

export function findPreset(id: string, userPresets: LedColorPreset[]): LedColorPreset | undefined {
  return BUILT_IN_COLOR_PRESETS.find((p) => p.id === id) ?? userPresets.find((p) => p.id === id);
}

export function validatePreset(p: unknown): p is LedColorPreset {
  if (!p || typeof p !== "object") return false;
  const obj = p as Record<string, unknown>;
  return (
    typeof obj.id === "string" && obj.id.length > 0 &&
    typeof obj.name === "string" &&
    typeof obj.primaryColor === "string" &&
    typeof obj.builtIn === "boolean"
  );
}
```

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/animation-engine/domain/types/LedColorPresets.ts tests/unit/animation-engine/color-presets.test.ts
git commit -m "feat(led): add color preset types, built-in presets, and validation"
```

---

## Task 11: Extend LedOverlayConfig + AnimationVisibilitySettings

**Files:**
- Modify: `src/lib/shared/animation-engine/domain/types/LedTypes.ts` (line ~84-123 for LedOverlayConfig, line ~130-142 for DEFAULT_LED_CONFIG)
- Modify: `src/lib/shared/animation-engine/state/animation-visibility-state.svelte.ts` (lines 30-73 for settings interface, lines 128-171 for defaults, lines 767-840 for LED methods)
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts` (lines 677-688 for ledDiff assembly)

- [ ] **Step 1: Add `secondaryColor` to LedOverlayConfig and DEFAULT_LED_CONFIG**

In `LedTypes.ts`:
- Add `secondaryColor: string;` to the `LedOverlayConfig` interface (after `primaryColor`)
- Add `secondaryColor: "#ffffff"` to `DEFAULT_LED_CONFIG`

- [ ] **Step 2: Add new fields to AnimationVisibilitySettings**

In `animation-visibility-state.svelte.ts`:
- Add to the settings interface: `ledSecondaryColor: string`, `ledActivePresetId: string | null`, `ledUserPresets: LedColorPreset[]`
- Add to `getDefaultSettings()`: `ledSecondaryColor: "#ffffff"`, `ledActivePresetId: null`, `ledUserPresets: []`
- Add import for `LedColorPreset` and `validatePreset` from `LedColorPresets.ts`

- [ ] **Step 3: Add new state manager methods**

Add to `AnimationVisibilityStateManager`:

```typescript
getLedSecondaryColor(): string {
  return this.settings.ledSecondaryColor;
}

setLedSecondaryColor(color: string): void {
  if (this.settings.ledSecondaryColor === color) return;
  this.settings.ledSecondaryColor = color;
  this.saveToStorage();
  this.notifyObservers();
}

getActivePresetId(): string | null {
  return this.settings.ledActivePresetId;
}

setActivePreset(presetId: string): void {
  const preset = findPreset(presetId, this.settings.ledUserPresets);
  if (!preset) return;
  this.settings.ledActivePresetId = presetId;
  this.settings.ledPrimaryColor = preset.primaryColor;
  if (preset.secondaryColor) {
    this.settings.ledSecondaryColor = preset.secondaryColor;
  }
  this.saveToStorage();
  this.notifyObservers();
}

getUserPresets(): LedColorPreset[] {
  return this.settings.ledUserPresets;
}

addUserPreset(name: string, primaryColor: string): void {
  const id = `user-${Date.now()}`;
  this.settings.ledUserPresets = [
    ...this.settings.ledUserPresets,
    { id, name, primaryColor, builtIn: false },
  ];
  this.saveToStorage();
  this.notifyObservers();
}

removeUserPreset(presetId: string): void {
  this.settings.ledUserPresets = this.settings.ledUserPresets.filter((p) => p.id !== presetId);
  if (this.settings.ledActivePresetId === presetId) {
    this.settings.ledActivePresetId = null;
  }
  this.saveToStorage();
  this.notifyObservers();
}
```

- [ ] **Step 4: Add userPresets validation in loadFromStorage**

In the `loadFromStorage` method, after deserializing, validate `ledUserPresets`:
```typescript
if (Array.isArray(parsed.ledUserPresets)) {
  parsed.ledUserPresets = parsed.ledUserPresets.filter(validatePreset);
}
```

- [ ] **Step 5: Extend ledDiff assembly in AnimationEngine.svelte.ts**

At `AnimationEngine.svelte.ts` line ~677-688, add `secondaryColor` to the diff:
```typescript
const secondaryColor = vm.getLedSecondaryColor();
if (secondaryColor !== this.ledConfig.secondaryColor) {
  ledDiff.secondaryColor = secondaryColor;
}
```

- [ ] **Step 6: Run typecheck**

Run: `npm run check`
Expected: no new errors

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/animation-engine/domain/types/LedTypes.ts src/lib/shared/animation-engine/state/animation-visibility-state.svelte.ts src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts
git commit -m "feat(led): extend config with secondaryColor, presets, and state manager methods"
```

---

## Task 12: Wire LedTipTracker to New Evaluator

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/LedTipTracker.ts`
- Modify: `src/lib/shared/animation-engine/domain/types/LedPatterns.ts` (backward-compat wrapper)

- [ ] **Step 1: Add prevFrameSnapshot to LedTipTracker**

Add a field to store the previous frame's complete tip data:
```typescript
private prevFrameSnapshot: TipRelationData[] = [];
```

At the END of the `update()` method (after all tips emitted), snapshot current output:
```typescript
this.prevFrameSnapshot = this.outputTips.map((t) => ({
  x: t.x,
  y: t.y,
  propIndex: t.propIndex,
  tipIndex: t.tipIndex,
}));
```

- [ ] **Step 2: Replace evaluatePattern call with new context-based evaluator**

In `emitPropTips()`, change the `LedTipTracker` to accept `secondaryColor` (from `LedOverlayConfig.secondaryColor`), build a `TipEvaluationContext`, and call the new `evaluatePattern(patternId, ctx)`.

The `update()` method signature already receives `ledConfig: LedOverlayConfig` which now has `secondaryColor`.

Import the new evaluator:
```typescript
import { evaluatePattern as evaluatePatternNew } from "../../domain/patterns/evaluator";
import { createReusableContext, type TipEvaluationContext } from "../../domain/patterns/context";
```

Add a reusable context field:
```typescript
private evalCtx: TipEvaluationContext = createReusableContext();
```

In the loop inside `emitPropTips()`, populate the context and call the new evaluator:
```typescript
const ctx = this.evalCtx;
ctx.time = timeSeconds;
ctx.ledIndex = ledGlobalIndex;
ctx.totalLeds = totalLedCount;
ctx.speed = patternSpeed;
ctx.primaryColor = baseColor;
ctx.secondaryColor = secondaryBaseColor;
ctx.propIndex = propIndex;
ctx.tipIndex = i;
ctx.x = worldX;
ctx.y = worldY;
ctx.prevFrameTips = this.prevFrameSnapshot;
ctx.beatIndex = -1;
ctx.totalBeats = 0;
const color = evaluatePatternNew(ledConfig.patternId, ctx);
```

**Velocity computation order:** Currently velocity is computed inside `emitTip()` which runs after pattern evaluation. Reorder so that velocity is computed FIRST (from prevTips, same finite-differencing that already exists), then populate `ctx.velocityX`, `ctx.velocityY`, `ctx.speedMagnitude` before calling `evaluatePatternNew`. Extract the velocity calc from `emitTip()` into a separate helper or compute inline in the loop before the evaluator call. This ensures the `velocity` pattern works correctly without frame latency.

- [ ] **Step 3: Add backward-compat wrapper to LedPatterns.ts and initialize registry**

In `LedPatterns.ts`, this is where the full registry gets assembled. Import all evaluators and call `initializeRegistry`. Also modify the existing `evaluatePattern` to delegate to the new evaluator:

```typescript
import { evaluatePattern as newEvaluatePattern, initializeRegistry } from "../patterns/evaluator";
import { createReusableContext } from "../patterns/context";
// Direct imports of all evaluators
import { evaluateSolid, evaluateSplit, evaluateQuad } from "../patterns/solid";
import { evaluateBreathe, evaluatePulse, evaluateHeartbeat, evaluateColorMorph } from "../patterns/breathe";
import { evaluateChase, evaluateComet, evaluateWave, evaluateCascade } from "../patterns/chase";
import { evaluateRainbow, evaluateWarmShift, evaluateCoolShift, evaluateNeon } from "../patterns/spectrum";
import { evaluateSparkle, evaluateFlicker, evaluateAurora } from "../patterns/texture";
import { evaluateProximity, evaluateVelocity, evaluateMirrorSync, evaluateBeatPulse } from "../patterns/tka-aware";

// Assemble the full registry once. Explicit, no import-order fragility.
initializeRegistry([
  ["solid", evaluateSolid], ["split", evaluateSplit], ["quad", evaluateQuad],
  ["breathe", evaluateBreathe], ["pulse", evaluatePulse], ["heartbeat", evaluateHeartbeat], ["color-morph", evaluateColorMorph],
  ["chase", evaluateChase], ["comet", evaluateComet], ["wave", evaluateWave], ["cascade", evaluateCascade],
  ["rainbow", evaluateRainbow], ["warm-shift", evaluateWarmShift], ["cool-shift", evaluateCoolShift], ["neon", evaluateNeon],
  ["sparkle", evaluateSparkle], ["flicker", evaluateFlicker], ["aurora", evaluateAurora],
  ["proximity", evaluateProximity], ["velocity", evaluateVelocity], ["mirror-sync", evaluateMirrorSync], ["beat-pulse", evaluateBeatPulse],
]);

const _compatCtx = createReusableContext();

// Backward-compat: delegates to new evaluator.
// Note: pattern.id and pattern.type happen to have the same values
// ("solid", "rainbow") for the 2 existing patterns. We use pattern.id
// which matches the new registry's keys.
export function evaluatePattern(
  pattern: LedPattern,
  time: number,
  ledIndex: number,
  totalLeds: number,
  speed: number,
  primaryColor: LedColor
): LedColor {
  _compatCtx.time = time;
  _compatCtx.ledIndex = ledIndex;
  _compatCtx.totalLeds = totalLeds;
  _compatCtx.speed = speed;
  _compatCtx.primaryColor = primaryColor;
  return newEvaluatePattern(pattern.id, _compatCtx);
}
```

- [ ] **Step 3b: Add backward-compat test**

Append to `tests/unit/animation-engine/pattern-evaluators.test.ts`:

```typescript
import { evaluatePattern as oldEvaluatePattern, getLedPattern } from "$lib/shared/animation-engine/domain/types/LedPatterns";

describe("Backward compatibility", () => {
  it("old evaluatePattern(solid) matches new evaluator", () => {
    const pattern = getLedPattern("solid");
    const primaryColor = { r: 0.5, g: 0.8, b: 0.2 };
    const old = oldEvaluatePattern(pattern, 1.0, 0, 4, 1.0, primaryColor);
    expect(old.r).toBeCloseTo(0.5);
    expect(old.g).toBeCloseTo(0.8);
    expect(old.b).toBeCloseTo(0.2);
  });

  it("old evaluatePattern(rainbow) produces valid color", () => {
    const pattern = getLedPattern("rainbow");
    const primaryColor = { r: 1, g: 1, b: 1 };
    const result = oldEvaluatePattern(pattern, 2.5, 1, 4, 1.0, primaryColor);
    expect(result.r).toBeGreaterThanOrEqual(0);
    expect(result.r).toBeLessThanOrEqual(1);
    expect(result.g).toBeGreaterThanOrEqual(0);
    expect(result.b).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 4: Resolve secondary color in LedTipTracker.update()**

The `update()` method already resolves per-hand base colors via `resolveHandColor`. Add the same for secondary color:
```typescript
const blueSecondaryColor = hexToLedColor(ledConfig.secondaryColor);
const redSecondaryColor = hexToLedColor(ledConfig.secondaryColor);
```
Pass these into `emitPropTips()`.

- [ ] **Step 5: Run typecheck + existing tests**

Run: `npm run check && npx vitest run tests/unit/animation-engine/`
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/LedTipTracker.ts src/lib/shared/animation-engine/domain/types/LedPatterns.ts
git commit -m "feat(led): wire LedTipTracker to new pattern evaluator with TipEvaluationContext"
```

---

## Task 13: LedColorPresetRow Component

**Files:**
- Create: `src/lib/shared/animation-engine/components/animation-settings-modal/LedColorPresetRow.svelte`

- [ ] **Step 1: Create the color preset swatch row component**

This component renders circular color swatches for built-in and user presets, plus a "+" button to add custom colors. It reads from and writes to `AnimationVisibilityStateManager`.

Props: none (reads from global state manager via container)

Structure:
- Row of 30px circular swatches
- Active preset has white border + box-shadow glow
- Built-in presets first, then user presets, then "+" button
- "+" opens a hidden `<input type="color">` via `.click()`
- Long-press on user preset shows a delete confirmation (or simple right-click → delete)
- Tapping a swatch calls `vm.setActivePreset(id)` which sets the primary color

Styling: follows existing button patterns from `LedCategory.svelte` (44px touch targets, `var(--theme-*)` variables, 1.5px borders).

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/animation-engine/components/animation-settings-modal/LedColorPresetRow.svelte
git commit -m "feat(led): add LedColorPresetRow component with swatch grid and custom color picker"
```

---

## Task 14: LedPatternGrid Component

**Files:**
- Create: `src/lib/shared/animation-engine/components/animation-settings-modal/LedPatternGrid.svelte`

- [ ] **Step 1: Create the categorized pattern selection grid**

This component renders all 22 patterns grouped by category with collapsible sections.

Reads from: `PATTERN_DESCRIPTORS`, `CATEGORY_LABELS` (registry), current `patternId` from state manager.
Writes to: `vm.setLedPatternId(id)`

Structure:
- Loop over each `PatternCategory` from `CATEGORY_LABELS`
- Category label (11px, uppercase, dimmed — `ctrl-label` style from existing UI)
- Row of pattern chips (same style as brightness buttons: flex, 44px min-height, rounded 8px, 1.5px border)
- Active pattern chip has accent-colored border (`var(--theme-accent)`)
- Categories are all expanded (simplest for Phase 1 — collapsible adds complexity without value yet)

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/animation-engine/components/animation-settings-modal/LedPatternGrid.svelte
git commit -m "feat(led): add LedPatternGrid component with categorized pattern selection"
```

---

## Task 15: LedSection Component + Wire Into Modal

**Files:**
- Create: `src/lib/shared/animation-engine/components/animation-settings-modal/LedSection.svelte`
- Modify: `src/lib/shared/animation-engine/components/animation-settings-modal/AnimationSettingsModal.svelte` (line 26 import, lines 231-234 usage)
- Modify: `src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte` (line 22 import)
- Delete: `src/lib/shared/animation-engine/components/animation-settings-modal/categories/LedCategory.svelte`

- [ ] **Step 1: Create LedSection component**

Composes `LedColorPresetRow`, `LedPatternGrid`, speed slider, and brightness buttons into the expandable LED settings section.

Structure (matches spec wireframe):
```
┌─ LED Settings (green border) ─────┐
│ LedColorPresetRow                  │
│ LedPatternGrid                     │
│ SPEED slider (0.1x - 5.0x)        │
│ BRIGHTNESS buttons [1][2][3][4][5] │
└────────────────────────────────────┘
```

- Green-tinted border: `border: 1px solid rgba(34, 197, 94, 0.15)`
- Green-tinted background: `background: rgba(34, 197, 94, 0.04)`
- Speed slider: native `<input type="range">` bound to `vm.setLedPatternSpeed()` / existing patternSpeed field
- Brightness buttons: same pattern as existing `LedCategory.svelte` (lines 23-36), just moved here

- [ ] **Step 2: Replace LedCategory with LedSection in AnimationSettingsModal**

In `AnimationSettingsModal.svelte`:
- Change import from `LedCategory` to `LedSection` (line 26)
- Replace `<LedCategory />` with `<LedSection />` (line 233)

- [ ] **Step 3: Replace LedCategory with LedSection in ExportVideoDrawer**

In `ExportVideoDrawer.svelte`:
- Change import from `LedCategory` to `LedSection` (line 22)
- Replace ALL usages of `<LedCategory />` (check lines 22, ~357, ~570 — grep for `LedCategory` to find all occurrences)

- [ ] **Step 4: Delete LedCategory.svelte**

Remove `src/lib/shared/animation-engine/components/animation-settings-modal/categories/LedCategory.svelte`

- [ ] **Step 5: Run typecheck**

Run: `npm run check`
Expected: no errors (no other files import LedCategory — verify with grep first)

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`
Expected: all pass

- [ ] **Step 7: Commit**

```bash
git add -A src/lib/shared/animation-engine/components/animation-settings-modal/ src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte
git commit -m "feat(led): replace LedCategory with new LedSection, wire into modal and export drawer"
```

---

## Task 16: Final Integration Verification

**Files:** none (verification only)

- [ ] **Step 1: Run full typecheck**

Run: `npm run check`
Expected: 0 errors

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: all tests pass, including all new pattern evaluator tests

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 4: Verify pattern count**

Run: `npx vitest run tests/unit/animation-engine/pattern-registry.test.ts`
Verify: "has 22 pattern descriptors" passes

- [ ] **Step 5: Commit any fixes if needed, then tag completion**

If all green, no commit needed. If fixes were required, commit them:
```bash
git commit -m "fix(led): resolve integration issues from final verification"
```

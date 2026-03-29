# LED Pattern System Design

**Date:** 2026-03-29
**Status:** Draft
**Scope:** Phase 1 implementation + architecture for Phases 2-4

---

## Problem

The current LED overlay has exactly 2 patterns (Solid and Rainbow) and a single native `<input type="color">` picker. Real LED props (Flowtoys flowOS, Pyroterra FT2, EmazingLights) ship with 10-48+ patterns. TKA has a unique advantage over physical props: we know the exact position, velocity, and relationships of all 4 tip points at every frame. The LED system should reflect that.

## Vision (4 Phases)

| Phase | What Ships | User Experience |
|-------|-----------|----------------|
| **1** (this spec) | Pattern library, color presets, new picker UI | Pick from ~20 patterns across 6 categories. Adjust color and speed. Global application. |
| **2** | Tweakable parameters per pattern | Each pattern exposes 2-3 sliders (speed, spread, intensity). Save custom variations. |
| **3** | LED choreography tab / pattern composer | Per-beat pattern assignment. Layer effects. Timeline editor. |
| **4** | POV / pixel rendering | Map images onto tip trajectories frame-by-frame. |

Phase 1 builds the architecture that all phases extend. No throwaway code.

---

## Phase 1 Scope

### What We Build

1. **Pattern engine** -- extensible `evaluatePattern()` that supports ~20 patterns across 6 categories
2. **Pattern registry** -- typed catalog of all built-in patterns with metadata (category, name, parameters)
3. **Color preset system** -- built-in color presets + user-saved custom colors
4. **Expandable LED section UI** -- replaces current LedCategory with presets, pattern grid, and color picker
5. **Tip-aware evaluation context** -- pass tip relationship data into the pattern engine so TKA-aware patterns work from day one

### What We Don't Build (Yet)

- Per-beat pattern assignment (Phase 3)
- User-created custom patterns / pattern composer (Phase 3)
- POV image rendering (Phase 4)
- Tweakable per-pattern parameters beyond speed (Phase 2)
- Hover-preview on pattern selection

---

## Pattern Categories & Library

### Category 1: Solid & Static

| Pattern | Behavior | Params (Phase 1) |
|---------|----------|-------------------|
| **Solid** | All tips emit primary color at full intensity | color |
| **Split** | Left prop = primary color, right prop = secondary color | color, secondaryColor |
| **Quad** | Each tip uses a color from a 4-color palette. Phase 1: hardcoded to primary, secondary, blue-hand, red-hand colors from the config. Phase 2: per-tip color picker UI. | color, secondaryColor |

### Category 2: Breathing & Fades

| Pattern | Behavior | Params (Phase 1) |
|---------|----------|-------------------|
| **Breathe** | All tips fade in/out together on a sine curve | color, speed |
| **Pulse** | Sharp flash to full brightness, slow exponential fade out | color, speed |
| **Heartbeat** | Double-pulse (two quick flashes, pause, repeat) | color, speed |
| **Color Morph** | Smooth linear interpolation between two colors over time | color, secondaryColor, speed |

### Category 3: Motion & Chase

| Pattern | Behavior | Params (Phase 1) |
|---------|----------|-------------------|
| **Chase** | A bright region travels across tips in order (0-0 → 0-1 → 1-0 → 1-1) | color, speed |
| **Comet** | Bright head on one tip with fading trail across others | color, speed |
| **Wave** | Sinusoidal brightness offset across tips, creating a rolling wave | color, speed |
| **Cascade** | Each tip starts the same animation at staggered intervals | color, speed |

### Category 4: Spectrum & Color

| Pattern | Behavior | Params (Phase 1) |
|---------|----------|-------------------|
| **Rainbow** | Full hue rotation, tips offset around the spectrum | speed |
| **Warm Shift** | Cycle through fire tones (red → orange → yellow) | speed |
| **Cool Shift** | Cycle through ocean tones (blue → cyan → teal) | speed |
| **Neon** | Cycle through vivid palette (magenta → violet → blue → cyan) | speed |

### Category 5: Texture & Organic

| Pattern | Behavior | Params (Phase 1) |
|---------|----------|-------------------|
| **Sparkle** | Random brief brightness spikes on individual tips, Perlin-noise driven | color, speed |
| **Flicker** | Candle-like random brightness variation (low-frequency noise) | color, speed |
| **Aurora** | Slow-drifting color blobs using multi-octave simplex noise | speed |

### Category 6: TKA-Aware

These patterns receive the full `TipEvaluationContext` and use spatial/temporal relationships.

| Pattern | Behavior | Params (Phase 1) |
|---------|----------|-------------------|
| **Proximity** | Tips glow brighter when they're closer to each other | color, speed |
| **Velocity** | Brightness scales with tip movement speed | color |
| **Mirror Sync** | Left prop's pattern mirrors right prop's (phase-offset by 180 degrees) | color, speed |
| **Beat Pulse** | Flash on a rhythmic interval. Phase 1: uses `speed` as BPM (e.g. speed=2 → 120 BPM). Phase 3: syncs to actual sequence beat boundaries via `beatIndex`. | color, speed |

**Total: 22 patterns.**

---

## Architecture

### Pattern Type System

The current `LedPattern.type` is a union of `"solid" | "rainbow"`. This becomes an extensible category + pattern ID system.

```typescript
// LedPatternTypes.ts (new file)

/** The 6 pattern families */
export type PatternCategory =
  | "solid"
  | "breathe"
  | "chase"
  | "spectrum"
  | "texture"
  | "tka-aware";

/** Metadata for a registered pattern */
export interface LedPatternDescriptor {
  /** Unique key used in LedOverlayConfig.patternId */
  id: string;
  /** Human-readable name for the UI */
  name: string;
  /** Which category this belongs to */
  category: PatternCategory;
  /** Whether this pattern needs tip relationship data */
  requiresTipContext: boolean;
  /** Whether this pattern uses a secondary color */
  usesSecondaryColor: boolean;
  /** Display order within its category */
  sortOrder: number;
}
```

### Tip Evaluation Context

The pattern engine currently receives `(time, ledIndex, totalLeds, speed, primaryColor)`. To support TKA-aware patterns and future phases, we extend this with a context object:

```typescript
// LedEvaluationContext.ts (new file)

/**
 * Full evaluation context passed to the pattern engine each frame.
 * Simple patterns ignore most fields. TKA-aware patterns use tip
 * relationships. Phase 3 will add beat/step index for per-beat assignment.
 */
export interface TipEvaluationContext {
  /** Elapsed time in seconds */
  time: number;
  /** This tip's index within the full LED array (0-based) */
  ledIndex: number;
  /** Total LED count across both props */
  totalLeds: number;
  /** Pattern speed multiplier from config */
  speed: number;
  /** Primary color (already resolved per-hand) */
  primaryColor: LedColor;
  /** Secondary color for dual-color patterns (defaults to white) */
  secondaryColor: LedColor;

  // ─── Tip identity ──────────────────────────────────────────
  /** 0 = blue prop, 1 = red prop */
  propIndex: 0 | 1;
  /** Index of this tip within its prop */
  tipIndex: number;

  // ─── Spatial data (TKA-aware patterns) ─────────────────────
  /** This tip's position in viewbox coordinates */
  x: number;
  y: number;
  /** This tip's velocity */
  velocityX: number;
  velocityY: number;
  speedMagnitude: number;

  // ─── Tip relationships (TKA-aware patterns) ────────────────
  /**
   * All tip positions from the PREVIOUS frame (complete, all 4 tips).
   * Uses previous frame to avoid partial/order-dependent data within
   * the current frame. One frame of latency at 60fps is imperceptible.
   * Shared reference -- not a copy. Do not mutate.
   */
  prevFrameTips: ReadonlyArray<{ x: number; y: number; propIndex: number; tipIndex: number }>;

  // ─── Beat context (Phase 3 extension point) ────────────────
  /** Current beat/step index within the sequence. -1 if unknown. */
  beatIndex: number;
  /** Total beats in the sequence. 0 if unknown. */
  totalBeats: number;
}
```

### Pattern Evaluator Refactor

Replace the current switch-based `evaluatePattern()` with an explicit const registry of evaluator functions:

```typescript
// evaluator.ts (new file)

/**
 * A pattern evaluator is a pure function: context in, color out.
 * No side effects. No state. Can run on main thread or WebWorker.
 */
export type PatternEvaluatorFn = (ctx: TipEvaluationContext) => LedColor;

/**
 * Explicit const registry. Each evaluator is imported directly --
 * no side-effect registration, no import-order dependencies,
 * fully tree-shakeable.
 */
import { evaluateSolid, evaluateSplit, evaluateQuad } from "./solid";
import { evaluateBreathe, evaluatePulse, evaluateHeartbeat, evaluateColorMorph } from "./breathe";
import { evaluateChase, evaluateComet, evaluateWave, evaluateCascade } from "./chase";
import { evaluateRainbow, evaluateWarmShift, evaluateCoolShift, evaluateNeon } from "./spectrum";
import { evaluateSparkle, evaluateFlicker, evaluateAurora } from "./texture";
import { evaluateProximity, evaluateVelocity, evaluateMirrorSync, evaluateBeatPulse } from "./tka-aware";

const EVALUATOR_REGISTRY: ReadonlyMap<string, PatternEvaluatorFn> = new Map([
  ["solid", evaluateSolid],
  ["split", evaluateSplit],
  ["quad", evaluateQuad],
  ["breathe", evaluateBreathe],
  ["pulse", evaluatePulse],
  ["heartbeat", evaluateHeartbeat],
  ["color-morph", evaluateColorMorph],
  ["chase", evaluateChase],
  ["comet", evaluateComet],
  ["wave", evaluateWave],
  ["cascade", evaluateCascade],
  ["rainbow", evaluateRainbow],
  ["warm-shift", evaluateWarmShift],
  ["cool-shift", evaluateCoolShift],
  ["neon", evaluateNeon],
  ["sparkle", evaluateSparkle],
  ["flicker", evaluateFlicker],
  ["aurora", evaluateAurora],
  ["proximity", evaluateProximity],
  ["velocity", evaluateVelocity],
  ["mirror-sync", evaluateMirrorSync],
  ["beat-pulse", evaluateBeatPulse],
]);

export function evaluatePattern(id: string, ctx: TipEvaluationContext): LedColor {
  const evaluator = EVALUATOR_REGISTRY.get(id);
  if (!evaluator) {
    // Fallback: return primary color (same as current solid behavior)
    return { r: ctx.primaryColor.r, g: ctx.primaryColor.g, b: ctx.primaryColor.b };
  }
  return evaluator(ctx);
}
```

### Pattern File Organization

Each pattern is a single file that exports its evaluator and registers itself:

```
src/lib/shared/animation-engine/domain/patterns/
├── solid.ts           # Solid, Split, Quad
├── breathe.ts         # Breathe, Pulse, Heartbeat, Color Morph
├── chase.ts           # Chase, Comet, Wave, Cascade
├── spectrum.ts        # Rainbow, Warm Shift, Cool Shift, Neon
├── texture.ts         # Sparkle, Flicker, Aurora
├── tka-aware.ts       # Proximity, Velocity, Mirror Sync, Beat Pulse
├── registry.ts        # Pattern descriptor registry + category metadata
├── evaluator.ts       # Core evaluator + registration mechanism
├── context.ts         # TipEvaluationContext type + builder
└── noise.ts           # Simplex/Perlin noise utilities for texture patterns
```

One file per category keeps related patterns together. Each file is small (one pure function per pattern).

### Noise Utilities

Texture patterns (Sparkle, Flicker, Aurora) need deterministic noise. Rather than a dependency, we include a minimal simplex noise implementation:

```typescript
// noise.ts
// ~60 lines. 2D simplex noise, deterministic, no allocations.
// Used by: Sparkle (high-frequency), Flicker (low-frequency), Aurora (multi-octave)
export function simplex2d(x: number, y: number): number { ... }
```

### Color Preset System

```typescript
// LedColorPresets.ts (new file)

export interface LedColorPreset {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Primary hex color */
  primaryColor: string;
  /** Optional secondary color for dual-color patterns */
  secondaryColor?: string;
  /** Whether this is a built-in preset (can't be deleted) */
  builtIn: boolean;
}

export const BUILT_IN_COLOR_PRESETS: LedColorPreset[] = [
  { id: "green-glow",  name: "Green Glow",  primaryColor: "#00ff88", builtIn: true },
  { id: "fire-red",    name: "Fire Red",     primaryColor: "#ff4444", builtIn: true },
  { id: "ice-blue",    name: "Ice Blue",     primaryColor: "#4488ff", builtIn: true },
  { id: "hot-pink",    name: "Hot Pink",     primaryColor: "#ff00ff", builtIn: true },
  { id: "amber",       name: "Amber",        primaryColor: "#ffaa00", builtIn: true },
  { id: "ultraviolet", name: "Ultraviolet",  primaryColor: "#8800ff", builtIn: true },
  { id: "white",       name: "White",        primaryColor: "#ffffff", builtIn: true },
  { id: "cyan",        name: "Cyan",         primaryColor: "#00ffff", builtIn: true },
];
```

User-saved presets persist to localStorage alongside the existing LED config.

### LedOverlayConfig Extension

The runtime config (passed to the tracker every frame) gains only what it needs:

```typescript
// Changes to LedOverlayConfig (in LedTypes.ts)

export interface LedOverlayConfig {
  // ... existing fields unchanged ...

  /** Secondary color for dual-color patterns (e.g. Color Morph) */
  secondaryColor: string;
}
```

`userPresets` and `activePresetId` are **not** on `LedOverlayConfig` -- they're user-data concerns, not frame-level rendering data. They live in the state manager only.

The existing `patternId` field already supports arbitrary string IDs, so no breaking change there. New patterns just register new IDs.

### AnimationVisibilitySettings Extension

The persisted settings object (flat fields in localStorage) gains:

```typescript
// Changes to AnimationVisibilitySettings (in animation-visibility-state.svelte.ts)

// New fields alongside existing ledBrightness, ledPatternId, ledPrimaryColor:
ledSecondaryColor: string;       // defaults to "#ffffff"
ledActivePresetId: string | null; // defaults to null (custom color)
ledUserPresets: LedColorPreset[]; // defaults to []
```

These are read by the state manager and surfaced via methods. The `LedOverlayConfig` assembly in `AnimationEngine.svelte.ts` maps `ledSecondaryColor` → `config.secondaryColor`.

### Integration with LedTipTracker

The LedTipTracker already computes positions and velocities for every tip. It currently calls `evaluatePattern(pattern, timeSeconds, ledGlobalIndex, totalLedCount, patternSpeed, baseColor)`.

The change: instead of passing individual args, build a `TipEvaluationContext` and pass it to the new `evaluatePattern(patternId, ctx)`. The context includes the spatial data the tracker already computes, plus a reference to all other tips for relationship patterns.

```typescript
// In LedTipTracker.emitPropTips(), replace:
const color = evaluatePattern(pattern, timeSeconds, ledGlobalIndex, totalLedCount, patternSpeed, baseColor);

// With:
const ctx: TipEvaluationContext = {
  time: timeSeconds,
  ledIndex: ledGlobalIndex,
  totalLeds: totalLedCount,
  speed: patternSpeed,
  primaryColor: baseColor,
  secondaryColor: secondaryBaseColor,
  propIndex,
  tipIndex: i,
  x: worldX,
  y: worldY,
  velocityX: 0,  // filled after velocity calc
  velocityY: 0,
  speedMagnitude: 0,
  prevFrameTips: this.prevFrameSnapshot,  // complete tip data from previous frame
  beatIndex: -1,   // Phase 3 extension point
  totalBeats: 0,
};
const color = evaluatePattern(ledConfig.patternId, ctx);
```

This is a non-breaking refactor. The old `evaluatePattern` signature is replaced, but all callers are internal.

---

## UI Design

### Expandable LED Section

When the user selects "LED" in the EffectPicker, an expandable section appears below the effect row. Bordered in LED green (`#22c55e`), it contains:

```
┌─ LED Settings ──────────────────── ▲ ─┐
│                                        │
│ PRESETS                                │
│ ● Green Glow  ● Fire Red  ● Ice Blue  │
│ ● Hot Pink    ● Amber     ● UV        │
│ ● White       ● Cyan      [+]         │
│                                        │
│ PATTERN                                │
│ ┌─ Solid ──────────────────────────┐   │
│ │ Solid  Split  Quad               │   │
│ ├─ Breathing ──────────────────────┤   │
│ │ Breathe  Pulse  Heartbeat  Morph │   │
│ ├─ Motion ─────────────────────────┤   │
│ │ Chase  Comet  Wave  Cascade      │   │
│ ├─ Spectrum ───────────────────────┤   │
│ │ Rainbow  Warm  Cool  Neon        │   │
│ ├─ Texture ────────────────────────┤   │
│ │ Sparkle  Flicker  Aurora         │   │
│ ├─ TKA-Aware ─────────────────────┤   │
│ │ Proximity  Velocity  Mirror  Beat│   │
│ └──────────────────────────────────┘   │
│                                        │
│ SPEED                                  │
│ ──────────●────── (0.1x - 5.0x)       │
│                                        │
│ BRIGHTNESS                             │
│ [1] [2] [3] [4] [5]                   │
│                                        │
└────────────────────────────────────────┘
```

### Color Presets Row

- Circular swatches (30px, same style as existing effect buttons)
- Active preset has white border + subtle glow
- "+" swatch opens a native color picker to add a custom preset
- Long-press (or right-click) on a user preset to delete it
- Built-in presets cannot be deleted

### Pattern Grid

- Grouped by category with subtle category labels
- Each pattern is a tappable chip/button (same style as brightness buttons)
- Active pattern has accent-colored border
- Categories are collapsible (collapsed by default except the active pattern's category)

### Where This UI Appears

The expandable LED section is a **shared component** used in:

1. **AnimationSettingsModal** (primary location) -- appears below the EffectPicker when LED is selected
2. **ExportVideoDrawer** -- same component, same state

Both locations bind to the same `AnimationVisibilityStateManager` state, so changes in one are reflected everywhere.

---

## State Management

### No New State Layer

LED settings already live in `AnimationVisibilityStateManager` and persist to localStorage. We extend the existing config shape, not create a new state layer.

### New Methods on AnimationVisibilityStateManager

```typescript
// Pattern
setLedPatternId(patternId: string): void     // already exists
getLedPatternId(): string                     // already exists

// Secondary color (new)
getLedSecondaryColor(): string
setLedSecondaryColor(color: string): void

// Color presets (new)
getActivePresetId(): string | null
setActivePreset(presetId: string): void       // sets primaryColor from preset
getUserPresets(): LedColorPreset[]
addUserPreset(name: string, color: string): void
removeUserPreset(presetId: string): void
```

### localStorage Migration

The existing `animation-visibility-settings` key gains two new fields (`secondaryColor`, `activePresetId`, `userPresets`). Missing fields default gracefully:

- `secondaryColor` defaults to `"#ffffff"`
- `activePresetId` defaults to `null`
- `userPresets` defaults to `[]`

No migration script needed. The deserialization code already handles missing fields via spread with defaults.

---

## Testing Strategy

Following the "tests that catch what eyes can't" philosophy:

### What Gets Tests

| Test | Why |
|------|-----|
| Every pattern evaluator against known inputs | Math is stable, bugs are subtle. A broken sine curve won't be visible until export. |
| Noise functions (simplex2d) determinism | Same input must always produce same output, or patterns drift between sessions. |
| Color preset CRUD (add, remove, persistence) | Data loss is silent. |
| TipEvaluationContext builder | Wrong spatial data fed to patterns would produce subtle visual bugs. |
| Pattern registry (register + lookup + fallback) | Missing pattern should fallback to solid, not crash. |

### What Doesn't Get Tests

| Skip | Why |
|------|-----|
| UI component rendering | You'll see if the buttons are broken. |
| WebGL shader integration | Visual. Requires eyes. |
| Pattern "looks good" | Subjective. Evaluate on spinning props. |

---

## File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `domain/patterns/evaluator.ts` | Core evaluator + registration mechanism |
| `domain/patterns/context.ts` | TipEvaluationContext type + builder function |
| `domain/patterns/registry.ts` | Pattern descriptor catalog + category metadata |
| `domain/patterns/noise.ts` | Simplex noise for texture patterns |
| `domain/patterns/solid.ts` | Solid, Split, Quad evaluators |
| `domain/patterns/breathe.ts` | Breathe, Pulse, Heartbeat, Color Morph evaluators |
| `domain/patterns/chase.ts` | Chase, Comet, Wave, Cascade evaluators |
| `domain/patterns/spectrum.ts` | Rainbow, Warm Shift, Cool Shift, Neon evaluators |
| `domain/patterns/texture.ts` | Sparkle, Flicker, Aurora evaluators |
| `domain/patterns/tka-aware.ts` | Proximity, Velocity, Mirror Sync, Beat Pulse evaluators |
| `domain/types/LedColorPresets.ts` | Color preset types + built-in presets |
| `components/.../LedSection.svelte` | New expandable LED settings section |
| `components/.../LedColorPresetRow.svelte` | Color preset swatch row |
| `components/.../LedPatternGrid.svelte` | Categorized pattern selection grid |

### Modified Files

| File | Change |
|------|--------|
| `domain/types/LedTypes.ts` | Add `secondaryColor` to `LedOverlayConfig` (NOT `activePresetId` or `userPresets` -- those are state manager only) |
| `domain/types/LedPatterns.ts` | Deprecate old `evaluatePattern`, re-export from new evaluator for backward compat |
| `services/implementations/LedTipTracker.ts` | Build `TipEvaluationContext`, call new evaluator |
| `state/animation-visibility-state.svelte.ts` | Add secondary color, preset methods |
| `components/.../AnimationSettingsModal.svelte` | Replace LedCategory with LedSection |
| `AnimationEngine.svelte.ts` | Extend `ledDiff` assembly to include `secondaryColor` from state manager |
| `components/.../LedCategory.svelte` | Remove (replaced by LedSection) |

### Deleted Files

| File | Reason |
|------|--------|
| `components/.../LedCategory.svelte` | Replaced by the new LedSection component |

---

## Migration & Backward Compatibility

- Existing `patternId: "solid"` and `patternId: "rainbow"` continue to work. The new registry includes these IDs.
- Existing localStorage data deserializes without error. New fields get defaults.
- The old `evaluatePattern()` export from `LedPatterns.ts` is preserved as a thin wrapper that builds a minimal `TipEvaluationContext` and delegates to the new evaluator. This avoids breaking any code that imports the old function during the transition.

---

## Phase 2-4 Extension Points

The architecture is designed so future phases are additive, not rewrite:

| Future Need | How the Architecture Supports It |
|-------------|----------------------------------|
| Per-pattern sliders (Phase 2) | `LedPatternDescriptor` gains a `parameters` array. UI reads it to render sliders. Evaluator receives params via context. |
| Per-beat assignment (Phase 3) | `TipEvaluationContext.beatIndex` is already in the type. A `LedPatternTimeline` maps beat ranges to pattern IDs. LedTipTracker resolves the active pattern per beat. |
| Pattern composer (Phase 3) | Evaluators are composable functions. A "composed" pattern calls multiple evaluators and blends their outputs. |
| POV rendering (Phase 4) | The context includes exact tip positions. A POV evaluator samples a source image at the tip's position along its trajectory arc. |

---

## Performance Notes

- **`prevFrameTips` is a shared reference**, not a copy. The LedTipTracker snapshots the previous frame's output array once per frame and passes the same reference to every `TipEvaluationContext`. No per-tip allocations.
- **`TipEvaluationContext` objects should be pre-allocated** and reused (mutated in place) to avoid GC pressure. The tracker already uses this pattern for `LedTipData`.
- **`userPresets` validation on load**: when deserializing from localStorage, validate each preset has `id`, `name`, `primaryColor`, and `builtIn` fields. Silently drop malformed entries rather than crashing.

## Known Tech Debt

- **LedTipTracker is not in the DI container.** It's instantiated directly via `new LedTipTracker()` in `AnimationEngine.svelte.ts`. For Phase 1 this is fine (it imports the evaluator directly). For Phase 2, when configurable parameters need injection, consider registering it in the animator container.

---

## Constraints & Decisions

- **No strobe patterns.** Rapid full-on/full-off flashing is excluded from the library.
- **All tips full brightness.** Thumb and pinky ends are treated identically. No brightness difference.
- **Global application only (Phase 1).** Pattern applies to the entire sequence. Per-beat comes in Phase 3.
- **No per-pattern parameter UI (Phase 1).** Only speed (shared) and color are adjustable. Phase 2 adds per-pattern sliders.
- **Patterns are pure functions.** No state, no side effects, no allocations. This keeps the door open for WebWorker offloading.

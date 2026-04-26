# Effects Phase 1m: Pulse/Wave Effect Design

**Status:** Spec (2026-04-25). Queued as Phase **1m** — runs after 1l Silk.

**Goal:** Add pulse as the 16th unified effect (chip row → 17 including `none`), completing the 4×4 effects grid. Expanding wave rings emitted from prop tips, detaching at birth and radiating outward through space.

## Slot Justification

**Unique observable:** wave propagation — how far kinetic energy radiates from each movement.

Every other effect either stays at the tip (Bloom, LED), follows the tip's path (Trails, Silk, Ink), or falls away from the tip under gravity/buoyancy (Petals, Water, Sparkles, Smoke, Bubbles). Pulse is the only effect where rings **depart from the tip and travel outward through space in all directions**, marking the reach and rhythm of movement.

**Confusion tests:**
- "Pulse is a tweak to Bloom" — No. Bloom is a static halation field that moves with the tip. Pulse rings detach from their birth point and expand outward. Bloom glows in place; Pulse radiates away.
- "Pulse is a tweak to Echo" — No. Echo captures frozen staff snapshots at beat onsets (stroboscopic phantoms). Pulse emits expanding rings. Echo shows discrete positions; Pulse shows expanding wavefronts from those positions.

## Intent Shape

```ts
export interface PulseIntent {
  /** 0-1. Ring peak alpha + brightness. */
  intensity: number;
  /** 0-1. Max ring expansion radius. Maps to 20-200px. */
  reach: number;
  /** 0.2-3.0 seconds. Ring lifetime from birth to full fade. */
  lifetime: number;
  /** "beat" = on beat onsets, "velocity" = on acceleration threshold, "continuous" = steady emission amplified by beats. */
  trigger: "beat" | "velocity" | "continuous";
  /** "stroke" = thin expanding outlines, "glow" = gradient-filled halos with bright leading edge. */
  style: "stroke" | "glow";
  /** 1-8. Beat interval for beat trigger. 1 = every beat, 2 = every other. Ignored by velocity/continuous. */
  beatInterval: number;
  /** 0-1. Velocity threshold for velocity trigger. 0 = any movement, 1 = only fast flicks. Ignored by beat/continuous. */
  velocityThreshold: number;
  /** 0-1. Ring stroke width (stroke style) or gradient band thickness (glow style). */
  thickness: number;
  /** Named palette. "custom" uses customColor. */
  palette: "sonar" | "ripple" | "aurora" | "neon" | "ember" | "void" | "custom";
  /** Hex string. Used only when palette === "custom". */
  customColor: string;
  /** "solid" | "prop-matched" | "rainbow" | "palette" */
  colorMode: "solid" | "prop-matched" | "rainbow" | "palette";
  /** Hex — when colorMode === "solid". */
  color: string;
  /** Multicolor palette (3-5 hex) — when colorMode === "palette". */
  colorPalette: string[];
  /** Which staff end(s) emit rings. */
  trackingMode: "left_end" | "right_end" | "both_ends";
}
```

Extend `EffectType`, `EffectsConfig`, `EffectsConfig.activePresets`, and `EffectsOverrides` to include `pulse`. Bump `EFFECTS_CONFIG_VERSION` 14→15.

## Palette Definitions

```ts
export interface PulsePalette {
  readonly id: PulseIntent["palette"];
  /** Primary ring color. */
  readonly ring: string;
  /** Trailing fade color (inner edge for glow style). */
  readonly fade: string;
  /** Whether to use `lighter` blend mode. */
  readonly emissive?: boolean;
  /** Aurora palette: shifts hue per-ring-age. */
  readonly hueShift?: boolean;
}
```

| id | ring | fade | flags | notes |
|----|------|------|-------|-------|
| sonar | `#38bdf8` | `#0c4a6e` | — | clean tech blue radar |
| ripple | `#93c5fd` | `#bfdbfe` | — | soft water-like blue |
| aurora | `#a855f7` | `#22d3ee` | `hueShift: true` | purple→cyan shift over ring lifetime |
| neon | `#f0abfc` | `#fb923c` | `emissive: true` | hot pink-orange, additive blend |
| ember | `#ff6000` | `#ffcc00` | `emissive: true` | fire shockwave, additive blend |
| void | `#404060` | `#101020` | — | dark space pulse |
| custom | from `customColor` | hsl-shift: -20%L from ring | — | user-picked hex |

## Renderer Architecture

**Ring-buffer pool. 64 rings per tip (256 total for 4 tips). Fixed allocation, no GC pressure.**

### Data structure

```ts
interface PulseRing {
  x: number;          // birth position (screen coords)
  y: number;
  birthTime: number;  // seconds (cumulative dt clock)
  color: string;      // resolved at birth from colorMode
  active: boolean;
}
```

### Trigger logic

**Beat mode:** tracks `currentStep` from the animation. Fires a ring when `floor(currentStep / beatInterval)` increments. Same beat-detection pattern as Echo.

**Velocity mode:** per-tip velocity computed from position delta / dt. When `speed > threshold × refSpeed` AND a cooldown timer has elapsed (0.1s min between rings), fires a ring. Cooldown prevents machine-gunning.

**Continuous mode:** fires rings at a steady rate (3/sec base), with rate multiplied by `1 + velocityFactor` when tips move fast. Creates a persistent aura that intensifies during motion.

### Per-frame render algorithm

1. Check trigger condition → if fired, grab next inactive ring from pool, set `(x, y, birthTime, color, active=true)`
2. For each active ring:
   - `age = now - birthTime`
   - `progress = age / lifetime` (0→1)
   - If `progress >= 1`: deactivate ring, continue
   - `radius = progress × maxRadius` (maxRadius = 20 + reach × 180)
   - `alpha = intensity × (1 - progress)²` (quadratic ease-out — fast initial brightness, long gentle fade)
   - **Stroke style:** `ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.stroke()` with `lineWidth = 1 + thickness × 4`
   - **Glow style:** radial gradient from `(x, y, radius - bandWidth)` to `(x, y, radius + bandWidth)` where `bandWidth = 3 + thickness × 12`. Gradient: transparent → fade color → ring color (bright leading edge) → transparent.
3. All rings render with `globalCompositeOperation = "lighter"` for additive overlap

### Visual quality details

- **Rings stay at birth point:** once spawned, a ring never moves. The viewer sees wavefronts radiating from where the prop *was*, not where it *is*. This IS the unique observable.
- **Quadratic alpha decay:** natural wave energy falloff. Initial flash, then a long gentle tail.
- **Additive blend:** overlapping rings from both hands create bright interference patterns at intersection points.
- **Aurora hue shift:** ring color drifts from palette.ring toward palette.fade over its lifetime.
- **Glow gradient band:** the leading edge of the expanding ring is the brightest part, mimicking a real pressure wavefront.

### Estimated complexity

~250 lines for the renderer. Pool management adds ~30 lines over Bloom but less than Sparkles (which has gravity, spawn modes, and lifetime variance). Same tier as Frost.

## Presets

| id | name | trigger | style | palette | intensity | reach | lifetime | thickness | beatInterval | velocityThreshold |
|----|------|---------|-------|---------|-----------|-------|----------|-----------|--------------|-------------------|
| pulse-sonar | Sonar | beat | stroke | sonar | 0.7 | 0.7 | 1.0 | 0.3 | 1 | 0.3 |
| pulse-shockwave | Shockwave | velocity | glow | ember | 0.9 | 0.8 | 0.5 | 0.6 | 1 | 0.6 |
| pulse-heartbeat | Heartbeat | continuous | glow | neon | 0.6 | 0.5 | 0.8 | 0.4 | 1 | 0.3 |
| pulse-radar | Radar | beat | stroke | aurora | 0.5 | 0.9 | 1.5 | 0.2 | 2 | 0.3 |
| pulse-ripple | Ripple | continuous | glow | ripple | 0.5 | 0.6 | 1.2 | 0.5 | 1 | 0.3 |
| pulse-void | Void | velocity | stroke | void | 0.8 | 0.7 | 0.7 | 0.4 | 1 | 0.4 |

## Defaults

```ts
pulse: {
  intensity: 0.7,
  reach: 0.6,
  lifetime: 1.0,
  trigger: "beat",
  style: "stroke",
  beatInterval: 1,
  velocityThreshold: 0.3,
  thickness: 0.3,
  palette: "sonar",
  customColor: "#38bdf8",
  colorMode: "solid",
  color: "#38bdf8",
  colorPalette: ["#38bdf8", "#a855f7", "#22d3ee", "#f472b6", "#fbbf24"],
  trackingMode: "both_ends",
}
```

## UI

### PulseCustomize.svelte

- Trigger chip row (Beat / Velocity / Continuous)
- Style chip row (Stroke / Glow)
- Palette chip row (7 palettes, swatch-chip pattern from frost)
- Color mode chip row (Solid / Prop-matched / Rainbow / Palette)
- Custom color picker (shown when palette === "custom" or colorMode === "solid")
- Tracking mode chip row (Left / Right / Both)
- Conditional sliders:
  - Beat trigger: Beat Interval (1-8)
  - Velocity trigger: Velocity Threshold (0-1)
  - Always: Intensity, Reach, Lifetime, Thickness

### Preset group

Standard pattern: 6 named presets + Custom. `getSummary` returns trigger + style + palette.

## Wiring

Identical insertion-point pattern to silk (Phase 1l):

- **EffectsConfig.ts:** add `PulseIntent`, extend `EffectType`, `EffectsConfig`, `activePresets`, `EffectsOverrides`
- **defaults.ts:** add `pulse` defaults + `pulse: null` in `activePresets`
- **canvas2d-types.ts:** add `Pulse2DParams`
- **canvas2d-translator.ts:** add `resolvePulse2D()`
- **PulsePalettes.ts:** palette registry (new file)
- **effects-config-state.svelte.ts:** add `updatePulse()`, pulse getter, `mergeConfig` line
- **AnimationRenderLoop.ts:** ~10 insertion points (field, config, updateConfig, dispose, isActive, hasActiveWork, clear, tip update, render dispatch, error handling)
- **AnimationEngine.svelte.ts:** ~12 insertion points (imports, fields, defaults, initialize, sync overlay, visibility diff, dispose, z-index, resize, syncPulseOverlay, getFrameParams)
- **EffectRendererManager.ts:** add pulse overlay lifecycle (sync, dispose, resize, z-index)
- **FrameParameterBuilder.ts:** add pulse config resolution + intent diff
- **IPulseOverlayRenderer.ts:** contract interface (new file)
- **PulseOverlayRenderer.ts:** canvas wrapper (new file)
- **IAnimationRenderLoop.ts:** add `pulseConfig` to `RenderFrameParams` + `RenderLoopConfig`
- **TipEffectTypes.ts:** add `"pulse"` to `EffectType` union
- **effect-registry.ts:** add pulse entry to `EFFECTS` array
- **EffectsPanel.svelte:** import PulseCustomize + routing
- **EffectsLabPlaybackHost.svelte:** add `"pulse"` to `vmActiveMode` union
- **Version migration:** 14→15, add pulse defaults non-destructively

## Tip Input

Pulse needs per-tip positions plus the current step (for beat detection) and dt (for velocity computation):

```ts
export interface PulseTipInput {
  x: number;
  y: number;
  propIndex: 0 | 1;
  tipIndex: number;
  blueColor: string;
  redColor: string;
}
```

The renderer tracks previous tip positions internally for velocity computation. Render method signature:

```ts
renderFrame(params: Pulse2DParams, tips: PulseTipInput[], currentStep: number, dt: number): void
```

`currentStep` drives beat detection (same field Echo uses from `RenderFrameParams`). `dt` drives velocity computation and ring aging. The `IPulseOverlayRenderer` contract mirrors `ISilkOverlayRenderer` but with the expanded signature.

## Deferred

- 3D ring renderer (Three.js torus billboard geometry per ring)
- Wire pulse into EffectsLayer.svelte (3D orchestrator)
- Ring-to-ring interference brightening (explicit additive at intersection points)
- Doppler effect (ring expansion speed varies with tip velocity direction toward/away from camera)
- Ring shape variants (circle, hexagon, square) as future chip row

# Effects Phase 1l: Silk/Ribbon Effect Design

**Status:** Spec (2026-04-25). Queued as Phase **1l** — runs after 1k Frost.

**Goal:** Add silk as the 15th unified effect (chip row → 16 including `none`). Continuous deformable ribbon trailing from prop tips. No particles, no spawn/death lifecycle — filled polygon reshaped each frame from a timestamped trail buffer.

## Slot Justification

**Unique observable:** surface dynamics / flow quality.

Trails shows WHERE props went (thin constant-width line). Silk shows HOW props moved (wide ribbon with velocity-driven width and time-based visible length). Fast flick = long taut narrow streak. Slow arc = short wide flowing drape. Velocity is encoded in TWO dimensions (width AND visible length).

**Confusion test:** "Silk is a tweak to trails" — No. Trails renders line strokes from a ring buffer. Silk renders a filled polygon with perpendicular width, cross-ribbon gradient, and edge flutter. Different renderer, different visual language, different information.

## Intent Shape

```ts
export interface SilkIntent {
  /** 0-1. Overall opacity + width multiplier. */
  intensity: number;
  /** 0-1. Base ribbon half-width before velocity scaling. Maps to 5-30px. */
  width: number;
  /** 0-1. Sample lifetime. Maps to 0.5-4.0 seconds. */
  duration: number;
  /** 0-1. Sine-wave edge displacement amplitude. 0 = smooth, 1 = chaotic flutter. */
  flutter: number;
  /** 0-1. How much velocity narrows the ribbon. 0 = constant width, 1 = dramatic speed contrast. */
  tautness: number;
  /** Named palette. "custom" uses customColor. */
  palette: "satin" | "velvet" | "ethereal" | "shadow" | "gold_leaf" | "ember" | "custom";
  /** Hex string. Used only when palette === "custom". */
  customColor: string;
  /** Which staff end(s) the ribbon tracks. */
  trackingMode: "left_end" | "right_end" | "both_ends";
}
```

Extend `EffectType`, `EffectsConfig`, `EffectsConfig.activePresets`, and `EffectsOverrides` to include `silk`. Bump `EFFECTS_CONFIG_VERSION` 13→14.

## Palette Definitions

```ts
export interface SilkPalette {
  readonly id: SilkIntent["palette"];
  /** Ribbon body fill — center of cross-gradient. */
  readonly body: string;
  /** Ribbon edge highlight — top/bottom of cross-gradient. */
  readonly edge: string;
  /** Whether to use `lighter` blend mode (ember only). */
  readonly emissive?: boolean;
  /** Ethereal palette: shifts hue along ribbon length. */
  readonly hueShift?: boolean;
  /** Secondary hue for ethereal shift end. */
  readonly edgeAlt?: string;
}
```

| id | body | edge | flags | notes |
|----|------|------|-------|-------|
| satin | `#c0c0d0` | `#ffffff` | — | glossy white-silver |
| velvet | `#600018` | `#ff2040` | — | deep crimson-burgundy |
| ethereal | `#c080ff` | `#80d0ff` | `hueShift: true`, `edgeAlt: "#ff80c0"` | iridescent cyan→violet→pink |
| shadow | `#101020` | `#404060` | — | dark translucent indigo-black |
| gold_leaf | `#a07000` | `#ffd700` | — | metallic gold |
| ember | `#ff6000` | `#ffcc00` | `emissive: true` | hot gradient, additive blend |
| custom | derived from `customColor` | hsl-shift: edge = +30%L | — | user-picked hex |

## Renderer Architecture

**No particle pool. No spawn/death. Just a filled polygon reshaped each frame.**

### Data structure

Per-tip timestamped trail buffer (reuses frost's `TrailSample` pattern but adds timestamp + velocity):

```ts
interface RibbonSample {
  x: number;
  y: number;
  t: number;       // timestamp (seconds, from cumulative dt)
  vx: number;      // velocity at this sample
  vy: number;
}
```

Max buffer size: 300 samples per tip (at 60fps, ~5 seconds of history).

### Per-frame algorithm

1. Push new tip position with timestamp and velocity
2. Expire samples where `(now - sample.t) > duration`
3. For each remaining sample, compute:
   - `speed = hypot(vx, vy)`
   - `halfWidth = baseWidth × intensity × (1 - speed/refSpeed × tautness)`
   - `tangent = normalize(next - prev)` (or use velocity direction)
   - `perp = (-tangent.y, tangent.x)`
   - `flutter1 = sin(i × 0.3 + time × 4.0) × flutterAmp`
   - `flutter2 = sin(i × 0.17 + time × 2.3) × flutterAmp × 0.6`
   - `leftEdge[i] = sample + perp × (halfWidth + flutter1 + flutter2)`
   - `rightEdge[i] = sample - perp × (halfWidth + flutter1 + flutter2)`
4. Age-based alpha: `alpha = 1 - (age / duration)` with smooth ease-out
5. Build path: forward through leftEdge, backward through rightEdge, closePath
6. Fill with cross-ribbon gradient (edge→body→edge)
7. Stroke top edge with highlight at low alpha

### Visual quality details

- **Cross-ribbon gradient:** light edges + dark center = 3D depth illusion from a single fill
- **Dual-frequency flutter:** two sine waves at 0.3 and 0.17 frequency = organic, not mechanical
- **Highlight stroke:** thin bright line on top edge = glossy fabric sheen
- **Age-based alpha fade:** tail fades smoothly via globalAlpha per-segment, not hard cutoff
- **Ember uses `lighter` blend:** additive glow for hot ribbon
- **Ethereal hue shift:** edge color interpolates from `edge` to `edgeAlt` along ribbon length

### Estimated complexity

~150-200 lines. Simplest renderer in the effects system. No particle pool management, no spawn rates, no collision detection, no procedural shape drawing.

## Presets

| id | name | palette | intensity | width | duration | flutter | tautness |
|----|------|---------|-----------|-------|----------|---------|----------|
| silk-classic | Classic | satin | 0.7 | 0.5 | 0.5 | 0.3 | 0.5 |
| silk-streamer | Streamer | ethereal | 0.6 | 0.7 | 0.8 | 0.7 | 0.3 |
| silk-whip | Whip | shadow | 0.8 | 0.4 | 0.3 | 0.1 | 0.9 |
| silk-royal | Royal | gold_leaf | 0.8 | 0.7 | 0.6 | 0.2 | 0.4 |
| silk-inferno | Inferno | ember | 0.9 | 0.5 | 0.5 | 0.4 | 0.7 |
| silk-phantom | Phantom | shadow | 0.3 | 0.6 | 0.9 | 0.5 | 0.2 |

## Defaults

```ts
silk: {
  intensity: 0.7,
  width: 0.5,
  duration: 0.5,
  flutter: 0.3,
  tautness: 0.5,
  palette: "satin",
  customColor: "#c0c0d0",
  trackingMode: "both_ends",
}
```

## UI

### SilkCustomize.svelte

- Palette chip row (7 palettes, swatch-chip pattern from frost)
- Custom color picker (shown when palette === "custom")
- Tracking mode chip row (Left / Right / Both)
- 5 sliders: Intensity, Width, Duration, Flutter, Tautness

### Preset group

Standard pattern: 6 named presets + Custom. `getSummary` returns palette + width + tautness.

## Wiring

Identical insertion-point pattern to frost (Phase 1k):

- **EffectsConfig.ts:** add `SilkIntent`, extend `EffectType`, `EffectsConfig`, `activePresets`, `EffectsOverrides`
- **defaults.ts:** add `silk` defaults + `silk: null` in `activePresets`
- **canvas2d-types.ts:** add `Silk2DParams`
- **canvas2d-translator.ts:** add `resolveSilk2D()`
- **SilkPalettes.ts:** palette registry
- **effects-config-state.svelte.ts:** add `updateSilk()`, frost getter, `mergeConfig` line
- **vm-shim.ts:** add silk defaults + activePresets entry
- **AnimationRenderLoop.ts:** ~10 insertion points (field, config, updateConfig, dispose, isActive, hasActiveWork, clear, tip update, render dispatch, error handling)
- **AnimationEngine.svelte.ts:** ~12 insertion points (imports, fields, defaults, initialize, sync overlay, visibility diff, dispose, z-index, resize, syncSilkOverlay, getFrameParams)
- **EffectsPanel routing:** add silk to chip row + customize routing
- **EffectsLabPlaybackHost.svelte:** add "silk" to vmActiveMode union
- **Version migration:** 13→14, add silk defaults non-destructively

## Deferred

- 3D ribbon renderer (Three.js ribbon geometry / `MeshLine`)
- Wire silk into EffectsLayer.svelte (3D orchestrator)
- Velocity-reactive flutter frequency (faster = tighter flutter)
- Wind direction parameter (global force on flutter)

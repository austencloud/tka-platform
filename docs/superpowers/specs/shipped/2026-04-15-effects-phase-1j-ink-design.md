# Effects Phase 1j: Ink/Paint Effect Design

**Status:** Spec (2026-04-15). Queued as Phase **1j** — runs after 1i Smoke. Do not start before 1i lands.

**Goal:** Add ink/paint as the 13th unified effect (chip row → 14 including `none`). Four sub-phases. The only stroke-based effect in the system — differentiates from trails through gravity-affected sag, strand breakup into droplets, velocity-spike splatter bursts, and ground pooling. Opaque flat-shaded pigment, not emissive translucent light.

## Context

Requested 2026-04-15. Another AI suggested ink as 2D-only (no 3D surface to bleed onto). Rejected — 2D-only breaks the pattern (every effect works in both backends). 3D ink earns its slot through five differentiating features that trails structurally can't do: gravity sag, strand breakup, splatter bursts, ground pooling, and opaque pigment material. If during 1j.i the 3D stroke doesn't read as distinct from trails, bail and kill the 3D side rather than shipping "thick trails" under a different name.

## Five differentiators from trails

These are NOT optional refinements — they are the architectural reason ink exists as a separate effect:

1. **Gravity-affected strands.** Trails are gravity-free ribbons. Ink strands sag and drip downward after emission.
2. **Strand breakup.** When stretch between consecutive points exceeds a viscosity threshold, the ribbon breaks into discrete droplets that fall. Trails are always continuous.
3. **Velocity-spike splatter.** Sudden acceleration flings radial burst particles. Trails never splatter.
4. **Ground pooling.** Droplets that reach the floor pool as decals. Trails never touch the ground.
5. **Opaque pigment material.** Flat-shaded, saturated, non-emissive. Trails are emissive and translucent.

## Intent shape

```ts
// src/lib/shared/effects/domain/EffectsConfig.ts

export interface InkIntent {
  /** 0-1. Ambient drip rate (hard-capped at 0.3 in renderer — ink is motion-dominant). */
  ambientEmission: number;
  /** 0-1. Velocity-reactive stroke emission. The star of the effect. */
  motionEmission: number;
  /** 0-1. Stroke width + opacity. */
  intensity: number;
  /** Named palette. "custom" uses customColor. */
  palette: "india" | "sumi" | "watercolor" | "neon" | "blood" | "acid" | "custom";
  /** Hex string. Used only when palette === "custom". */
  customColor: string;
  /** 0-1. How easily strands break into droplets under stretch. 0 = continuous ribbon, 1 = shatters into drops. */
  viscosity: number;
  /** 0-1. Splatter burst intensity on velocity spikes. 0 = clean strokes, 1 = Jackson Pollock. */
  splatterIntensity: number;
  /** Explicit tracking. */
  trackingMode: "left_end" | "right_end" | "both_ends";
}
```

Extend `EffectType`, `EffectsConfig`, `EffectsConfig.activePresets`, and `EffectsOverrides` to include `ink`. Bump `EFFECTS_CONFIG_VERSION`.

**Motion-dominant emission:** the renderer hard-caps effective ambient: `effectiveAmbient = min(ambientEmission, 0.3) * AMBIENT_BASE_RATE`. User can still dial ambient up, but even at max it stays subtle. This is ink, not rain.

`viscosity` and `splatterIntensity` are ink-specific knobs. Viscosity controls the strand breakup threshold; splatter controls the burst response to velocity spikes.

## Palette definitions

```ts
// src/lib/shared/3d/effects/ink/InkPalettes.ts (mirror in 2D renderer folder)

export interface InkPalette {
  readonly id: InkIntent["palette"];
  readonly pigment: string;       // hex — stroke core color
  readonly edge: string;          // hex — stroke edge / feathering
  readonly splatterTint: string;  // hex — burst particle color
  readonly poolTint: string;      // hex — ground decal color
  readonly emissive?: boolean;    // neon palette only — glow instead of flat shade
  readonly watercolor?: boolean;  // watercolor palette — low opacity, wide bleed, no pooling
}
```

Palette registry:

| id | pigment | edge | splatter | pool | flags | notes |
|----|---------|------|----------|------|-------|-------|
| india | `#0a0a0a` | `#1a1a1a` | `#0a0a0a` | `#050505` | — | matte black, default |
| sumi | `#404040` | `#606060` | `#303030` | `#282828` | — | gray wash, softer than india |
| watercolor | `#4080c0` | `#80b0e0` | `#6098d0` | — | `watercolor: true` | translucent wash, no pooling |
| neon | `#ff2080` | `#ff60a0` | `#ff2080` | `#c01060` | `emissive: true` | only ink palette that glows |
| blood | `#8a1818` | `#d93838` | `#b82828` | `#4a0808` | — | cross-palette match with water blood |
| acid | `#7fd94a` | `#b8ff6f` | `#98e860` | `#4a8a2a` | — | cross-palette match with water/bubbles acid |
| custom | derived from `customColor` | | | | — | hsl-shift: pigment=base, edge=+15%L, splatter=base, pool=-30%L |

**Watercolor palette special behavior:** when `watercolor: true`:
- Stroke opacity capped at 40% (translucent wash, not opaque pigment)
- Stroke width multiplied by 2× (bleeds wider)
- Ground pooling suppressed (watercolor evaporates)
- This is palette-carried behavior like smoke's lifetime — the palette IS watercolor, not just "light ink"

**Neon palette special behavior:** when `emissive: true`:
- Flat-shade material replaced with emissive/additive blend
- This is the ONLY ink palette that glows — visually distinguishes from trails (which are all emissive)
- One palette having emissive reinforces that the default ink read is opaque/flat

## Presets

Six presets in `src/lib/shared/effects/domain/presets/built-in-ink-presets.ts`:

| id | palette | ambient | motion | intensity | viscosity | splatter | notes |
|----|---------|---------|--------|-----------|-----------|----------|-------|
| classic | india | 0.2 | 0.8 | 0.6 | 0.3 | 0.3 | clean calligraphy strokes |
| drip | india | 0.3 | 0.5 | 0.8 | 0.7 | 0.5 | loaded brush, sags and drips |
| watercolor_wash | watercolor | 0.1 | 0.7 | 0.5 | 0.1 | 0.1 | light translucent strokes |
| neon_tag | neon | 0.1 | 1.0 | 0.9 | 0.2 | 0.4 | graffiti — fast saturated strokes |
| splatter | blood | 0.1 | 0.6 | 0.7 | 0.8 | 1.0 | Jackson Pollock mode |
| toxic | acid | 0.2 | 0.7 | 0.6 | 0.5 | 0.6 | pairs with acid water/bubbles |

All presets ship with `trackingMode: "both_ends"`.

## Sub-phase delivery

Four sub-phases, each with a bail point.

### 1j.i — Stroke MVP

Ships the base ink stroke. Must read as ink, not trails.

- **Ribbon mesh** reuses trails ribbon infrastructure (`CatmullRomRibbon` in 3D, Canvas2D stroke path in 2D), but with critical material difference: **opaque flat-shaded** (not emissive). This is the #1 differentiator at launch.
- Emission: `effectiveAmbient = min(ambientEmission, 0.3) * AMBIENT_BASE_RATE + motionEmission * speedScalar * MOTION_BASE_RATE`. Tuning constants: `AMBIENT_BASE_RATE ≈ 2` (barely any), `MOTION_BASE_RATE ≈ 15` (moderate — ink is a stroke medium, not a particle emitter), `MOTION_REFERENCE_SPEED ≈ 3.0` units/sec.
- **2D stroke rendering:** `CanvasRenderingContext2D` path with variable `lineWidth` based on velocity — slow motion = thick (loaded brush pressing), fast motion = thin (brush lifting). Calligraphic pressure sensitivity. Line cap = `round`. Composite operation = `source-over` (opaque layer).
- **3D stroke rendering:** thick ribbon mesh, flat-shaded material (MeshBasicMaterial or equivalent), no glow, no emission. Width varies with velocity (same pressure model as 2D).
- Stroke lifetime: 3-6s, alpha fade over last 40%.
- Palette color applied as flat tint, not gradient.

**Bail point:** Does the stroke read as ink, not trails? If the material/shading distinction isn't enough, sag (1j.ii) is the next differentiator. If sag + material together still feels like trails, kill the effect.

### 1j.ii — Sag + strand breakup

The gravity-and-viscosity sub-phase. Differentiator #1 (gravity) and #2 (breakup) activate.

- **Gravity sag:** each ribbon point accumulates downward velocity over time: `point.velocity.y -= GRAVITY * dt`. 3D: world-space -Y. 2D: canvas-down. Ribbon deforms visually as older points sag more than newer ones.
- **Strand breakup:** when the distance between consecutive ribbon points exceeds `breakThreshold = (1 - viscosity) * MAX_STRETCH`, the ribbon splits. The trailing segment converts into discrete droplets (particles) that fall independently.
- Droplets reuse water's particle physics (gravity + small horizontal drift).
- Droplet pool: 256 particles (low), 512 (medium), 1024 (high). Separate from the ribbon — breakup generates them.
- Droplet death: timeout-based fade (1-2s), or ground hit (→ 1j.iv pooling).

**Bail point:** Does sag + breakup differentiate from trails? If yes, ink earns its slot definitively.

### 1j.iii — Splatter bursts

Velocity-spike response.

- Each frame, compute `tipAcceleration = length(tipVelocity - prevTipVelocity) / dt`.
- When `tipAcceleration > SPLATTER_THRESHOLD * (1 - splatterIntensity)`, emit a radial burst of 8-20 tiny opaque droplets.
- Burst cone direction = opposite of acceleration vector (flung outward from the direction change).
- **2D splatters:** small opaque filled circles drawn via `arc()`. Size jitter ±50%.
- **3D splatters:** billboard sprites, gravity-affected, poolable (→ 1j.iv).
- Splatter lifetime: 0.5-1.5s (fast die if they don't hit the ground).
- Tuning constant: `SPLATTER_THRESHOLD ≈ 10.0` units/sec² (fast change needed to trigger).

**Bail point:** Do splatters earn their spawn-burst cost?

### 1j.iv — Ground pooling

Fallen droplets (from breakup + splatter) leave ground decals.

- **3D:** reuses `GroundDecalManager` from water 1f.iv. Pool decals are opaque (not translucent like water puddles). Decal tint from palette `poolTint`. Decay over 4-8s.
- **2D:** ink pools accumulate in lower ~15% of canvas as decaying opaque ellipses (same spatial approach as water 2D puddles, but opaque/pigmented instead of translucent). Ellipses grow slightly on repeated hits within the same area.
- Watercolor palette **suppresses pooling** (palette flag `watercolor: true` → evaporates, no ground pools).
- Quality-gated: skipped on low tier.

**Bail point:** Do pools add grounding or distract from strokes?

## Architecture per backend

### 2D

- `src/lib/shared/effects/renderers/Ink2DRenderer.ts` — stroke path builder (Canvas2D), droplet pool, splatter burst sub-pool, ground pool layer
- Stroke: `CanvasRenderingContext2D.stroke()` with variable `lineWidth` from velocity (calligraphic pressure)
- Reuses: trails ribbon infrastructure for path building (not rendering — rendering is flat, not emissive)

### 3D

- `src/lib/shared/3d/effects/ink/InkRenderer3D.ts` — ribbon mesh + droplet pool + splatter burst pool + decal wiring
- `src/lib/shared/3d/effects/ink/InkRibbonMesh.ts` — opaque flat-shaded ribbon, gravity-deformable (point velocity accumulates per frame)
- `src/lib/shared/3d/effects/ink/InkDropletPool.ts` — particles from strand breakup, gravity-affected
- `src/lib/shared/3d/effects/ink/InkSplatterBurst.ts` — radial burst sub-pool
- `src/lib/shared/3d/effects/ink/InkPalettes.ts` — shared 2D/3D palette + behavior flags

## Quality tiers

| Tier | 1j.i strokes | 1j.ii sag + breakup | 1j.iii splatter | 1j.iv pooling |
|------|--------------|---------------------|-----------------|---------------|
| low | on | on, 256 droplet pool | on, 8 burst max | **off** |
| medium | on | on, 512 droplet pool | on, 14 burst max | on, reduced max |
| high | on | on, 1024 droplet pool | on, 20 burst max | on, full budget |

All tiers get strokes, sag, and splatter — they ARE the effect's identity.

## Files

### Modified

- `src/lib/shared/effects/domain/EffectsConfig.ts` — add `InkIntent`, extend `EffectType`, `EffectsConfig`, `activePresets`, `EffectsOverrides`; bump version
- `src/lib/shared/effects/domain/defaults.ts` — add ink defaults (classic preset values)
- `src/lib/shared/effects/domain/migrations.ts` — add version bump migration
- `src/lib/shared/effects/translators/canvas2d-types.ts` — add `Ink2DParams`
- `src/lib/shared/effects/translators/canvas2d-translator.ts` — add `resolveInk2D(intent, palette) → Ink2DParams`
- `src/lib/shared/effects/translators/webgl3d-types.ts` — add `Ink3DParams`
- `src/lib/shared/effects/translators/webgl3d-translator.ts` — add `resolveInk3D(intent, palette) → Ink3DParams`
- `src/lib/shared/animation-engine/components/effects-panel/EffectSelector.svelte` — extend chip row (14 chips including `none`)
- `src/lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte` — route ink to InkCustomize

### New

- `src/lib/shared/effects/domain/presets/built-in-ink-presets.ts` — 6 presets
- `src/lib/shared/effects/renderers/Ink2DRenderer.ts` — 2D renderer
- `src/lib/shared/3d/effects/ink/InkPalettes.ts` — palette registry
- `src/lib/shared/3d/effects/ink/InkRenderer3D.ts` + sub-components (see Architecture)
- `src/lib/shared/animation-engine/components/effects-panel/customize/InkCustomize.svelte` — intent editor
- `src/lib/shared/animation-engine/components/effects-panel/presets/InkPresets.svelte` — preset grid

## Cross-palette ecosystem

Ink introduces `blood` and `acid` cross-palette names, matching water and bubbles. The full cross-palette family after ink ships:

| Palette name | Water | Bubbles | Petals | Smoke | Ink |
|-------------|-------|---------|--------|-------|-----|
| acid | ✓ | ✓ | — | — | ✓ |
| blood | ✓ | — | — | — | ✓ |
| spirit | ✓ | ✓ | — | ✓ | — |

The shared names signal to users that these palettes pair well when stacking eventually ships.

## Testing

- Unit: motion-dominant emission formula (ambient hard-capped at 0.3), pressure-sensitivity width calculation, breakup threshold math
- Unit: palette behavior flags (watercolor suppresses pooling, neon enables emissive)
- Unit: splatter acceleration threshold
- Integration: ink toggles on/off via chip row, presets apply visibly, material read is opaque-not-emissive (except neon)
- Verification per sub-phase: Austen confirms "yes that reads as ink, not trails" / "yes sag differentiates" / "yes splatter earns its cost" / "yes pools ground it"

## Known risks

- **"Just looks like thick trails" risk.** This is the critical risk. Material difference (opaque vs emissive) alone may not be enough at a glance. Sag (1j.ii) is the backup differentiator. If after 1j.ii the effect still feels like trails to Austen, kill ink rather than shipping a duplicate. Spec accepts this possibility.
- **Ribbon gravity deformation.** Applying per-point gravity to an existing ribbon mesh may produce visual artifacts (stretching, tearing at sharp corners). May need per-frame re-tessellation of the ribbon near gravity-deformed segments. Test during 1j.ii.
- **Acceleration-based splatter is noisy.** `tipAcceleration` from frame-to-frame position diff is jittery. May need a small sliding-window average (3-5 frames) to smooth spikes. If smoothing kills responsiveness, switch to velocity-threshold instead of acceleration-threshold.
- **Ground decal manager dependency.** 1j.iv assumes water's `GroundDecalManager` exists. If water 1f.iv deferred, ink builds or defers 1j.iv.
- **Canvas2D variable-width strokes.** `lineWidth` changes mid-path don't interpolate smoothly in all browsers — may need to break the path into per-segment strokes with interpolated width. Test during 1j.i.

## Out of scope

- Ink drying / texture change (wet ink glistens, dry ink is matte) — fun but per-particle state machine adds complexity.
- Paper texture interaction (ink bleeding into paper fibers) — no paper surface in TKA's rendering context.
- Ink mixing (two palette inks combining to produce new colors) — separate spec.
- Audio (brush strokes, splatter sounds) — separate feature.
- Stacking with other effects — tracked separately.

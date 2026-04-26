# Effects Phase 1f: Water Effect Design

**Status:** Spec (2026-04-15). Queued as Phase **1f** — runs after 1b Zap polish → 1c Sparkles → 1d Motion → 1e Bloom. Do not start before 1e lands; the translator + renderer patterns used here depend on 1c-1e having hardened them.

**Goal:** Add water as the 9th unified effect (chip row grows to 10 including `none`). Water ships iteratively as five sub-phases so each increment is independently valuable and independently bail-able.

## Context

Water was requested 2026-04-15 after four 3D effects shipped (trails, fire, LED, charcoal) and Phase 1 began unifying the remaining three (zap, sparkles, motion, bloom) into the shared intent layer. Austen wanted a full-pipeline water effect that works in both 2D and 3D — droplets, motion-reactive stream, surface-tension merging, ground puddles, and refraction. This spec plans all five layers as sub-phases with clear bail points so the effect can stop at any step if the current look is already good enough.

## The drift this spec resolves (partially)

Investigation during brainstorming surfaced three cross-cutting inconsistencies in existing `*Intent` shapes:

- **Color treatment differs 5 ways.** Trails uses `blueColor/redColor + rainbow`. Fire uses `propColors + customColors + colorCurve`. LED uses `primaryColor/secondaryColor + colorMode` enum. Zap uses single `color`. Sparkles uses `color + rainbow`.
- **Intensity scales differ.** Fire is `0.45-1.0`, Bloom/Zap/Charcoal are `0-1`, LED brightness is `1-5` discrete. Trails uses `thickness + brightness` instead of `intensity`.
- **Per-hand tracking is trails-only.** Only `TrailsIntent` has explicit `trackingMode`. All others silently assume both hands.

Water will **adopt the clean pattern** (0-1 intensity, palette enum + custom hex, explicit `trackingMode`) and a follow-up item will be added to `docs/superpowers/specs/effects-unification-deferred-items.md` to migrate the other effects toward the same shape.

## Intent shape

```ts
// src/lib/shared/effects/domain/EffectsConfig.ts

export interface WaterIntent {
  /** 0-1. Continuous drip rate when props are at rest. */
  ambientEmission: number;
  /** 0-1. Velocity-reactive emission multiplier. */
  motionEmission: number;
  /** 0-1. Overall droplet scale + brightness. */
  intensity: number;
  /** Named color palette. "custom" uses customColor instead. */
  palette: "classic" | "mercury" | "acid" | "blood" | "spirit" | "custom";
  /** Hex string. Used only when palette === "custom". */
  customColor: string;
  /** 0-1. 0 = milky/opaque, 1 = crystal clear. Drives 3D refraction + 2D highlight. */
  clarity: number;
  /** 0-1. Metaball merge strength. 0 = independent drops, 1 = fully goopy. Inactive until 1f.iii. */
  surfaceTension: number;
  /** Explicit tracking — adopts the clean trails pattern. */
  trackingMode: "left_end" | "right_end" | "both_ends";
}
```

Extend `EffectType`, `EffectsConfig`, `EffectsConfig.activePresets`, and `EffectsOverrides` to include `water` alongside the existing 8 effects. Bump `EFFECTS_CONFIG_VERSION` (whatever the current value is when 1f begins).

## Palette definitions

Each palette is a 3-stop gradient (core → edge → highlight) plus a `splashTint` and a `puddleTint`. Palettes live in a new file:

```ts
// src/lib/shared/3d/effects/water/WaterPalettes.ts (mirror structure in 2D renderer folder)

export interface WaterPalette {
  readonly id: WaterIntent["palette"];
  readonly core: string;      // hex — dense droplet core
  readonly edge: string;      // hex — droplet rim
  readonly highlight: string; // hex — specular / wet sheen
  readonly splashTint: string;
  readonly puddleTint: string;
}
```

Palette registry:

| id | core | edge | highlight | splash | puddle | notes |
|----|------|------|-----------|--------|--------|-------|
| classic | `#3a7fd9` | `#6fb3ff` | `#e8f4ff` | `#b8dcff` | `#2a5a9a` | default blue-white water |
| mercury | `#9a9fa8` | `#d4d8df` | `#ffffff` | `#c0c4cb` | `#6a6e75` | silver, high surface tension |
| acid | `#7fd94a` | `#b8ff6f` | `#e8ffc0` | `#98e860` | `#4a8a2a` | green — pairs with smoking puddle in 1f.iv |
| blood | `#8a1818` | `#d93838` | `#ff8080` | `#b82828` | `#4a0808` | slow thick drip |
| spirit | `#80ffe8` | `#c0fff4` | `#ffffff` | `#a0f8e0` | `#40c8a8` | cyan ghost — ethereal, no puddles |
| custom | derived from `customColor` | | | | | see derivation rule below |

**Custom derivation rule:** when `palette === "custom"`, derive the five palette slots from `customColor` (hsl-shift: `core` = base, `edge` = +15% L, `highlight` = +35% L / -50% S, `splashTint` = -5% L, `puddleTint` = -35% L).

## Presets

Seven presets in `src/lib/shared/effects/domain/presets/built-in-water-presets.ts`:

| id | palette | ambient | motion | intensity | clarity | surfaceTension | notes |
|----|---------|---------|--------|-----------|---------|----------------|-------|
| classic | classic | 0.4 | 0.6 | 0.6 | 0.7 | 0.3 | balanced drip + motion |
| fountain | classic | 0.9 | 0.2 | 0.7 | 0.7 | 0.3 | constant flow, light fling |
| whip | classic | 0.0 | 1.0 | 0.8 | 0.8 | 0.2 | motion-only — the "water whip" |
| mercury | mercury | 0.3 | 0.5 | 0.7 | 0.2 | 1.0 | goopy silver |
| acid | acid | 0.6 | 0.6 | 0.8 | 0.6 | 0.5 | corrosive drip, smoking puddles (1f.iv) |
| blood_ritual | blood | 0.2 | 0.3 | 0.9 | 0.4 | 0.8 | slow thick drip, dark puddles |
| spirit_mist | spirit | 0.7 | 0.3 | 0.5 | 0.9 | 0.0 | ethereal — puddles suppressed |

All presets ship with `trackingMode: "both_ends"`.

## Sub-phase delivery

Each sub-phase works in both 2D and 3D (except 1f.v — 3D-only polish). Each has a bail point: if the effect already reads as water and nothing past that phase earns its token cost, stop.

### 1f.i — Droplet MVP

Ships the base effect. Proves water reads as water in this rendering style.

- Pre-allocated particle pool per backend. Size: 512 particles (low), 1024 (medium), 2048 (high).
- Per-tip emitter samples tip position + velocity each frame. Spawn rate = `ambientEmission * AMBIENT_BASE_RATE + motionEmission * speedScalar * MOTION_BASE_RATE` where `speedScalar = clamp(tipSpeed / MOTION_REFERENCE_SPEED, 0, 1)`. Three tuning constants (defaults suggested, final values during implementation): `AMBIENT_BASE_RATE ≈ 8` droplets/sec at `ambientEmission=1`; `MOTION_BASE_RATE ≈ 40` droplets/sec at full velocity; `MOTION_REFERENCE_SPEED ≈ 3.0` units/sec (tuned against a medium-vigor spin). These live in the renderer, not the intent.
- Droplet lifetime: 0.8-1.6s with per-droplet jitter. Scale varies with `intensity`.
- 2D gravity direction: `-tipVelocity.normalize()` — droplets trail behind motion rather than fall screen-down. Resolved during brainstorming (the animator canvas is front-view, not side-view, so screen-down gravity breaks illusion).
- 3D gravity: real world-space `-y`.
- Droplet shader (2D): soft circle, alpha falls off with `clarity` (low clarity = milky opaque, high clarity = translucent with rim lighting).
- Droplet shader (3D): billboard sprite with normal-ramp fresnel for wet-sphere read.
- Colors sourced from the active `WaterPalette` (core at spawn → edge at mid-life → transparent at death).

**Bail point:** Does it read as water?

### 1f.ii — Velocity-triggered stream (ribbon)

Adds the "whip of water" behavior.

- When `tipSpeed > streamThreshold` (internal constant tuned against `motionEmission`), emit a ribbon segment between last frame's tip position and current.
- Ribbon uses the existing trails ribbon infrastructure (`CatmullRomRibbon` in 3D, WebGL2 ribbon mesh in 2D). Shared code, not forked.
- Ribbon fades over 300-500ms and breaks into droplets at its tail when `tipSpeed` drops below threshold.
- No new intent params — stream behavior derived from `motionEmission`.

**Bail point:** Is the whip convincing enough to justify metaballs?

### 1f.iii — Metaball post pass

Droplets merge visually when close. Activates `surfaceTension` param.

- WebGL2 post pass (2D and 3D): render droplets to an offscreen alpha buffer, apply Gaussian blur with radius ∝ `surfaceTension`, threshold alpha, recolor from palette.
- Classic cheap metaballs — no true surface extraction.
- Integrates with the render graph (the WebGPU→WebGL2→Canvas2D pipeline currently in-flight — check state of `project_unified_gpu_render_pipeline.md` when 1f.iii starts).
- Quality tier: **skipped on low**, reduced-res pass on medium, full-res on high.

**Bail point:** Does goopy mode earn its fullscreen-pass cost?

### 1f.iv — Ground puddles + splash

Droplets leave decaying puddles; hits spawn burst particles.

- **2D puddles:** painted as decaying ellipses on a persistent layer near the canvas bottom (2D has no true ground — ellipses accumulate in the lower ~20% of the canvas). Decay rate ∝ `intensity` (higher intensity = puddles persist longer).
- **3D puddles:** ground-projected decals on the floor plane. Radius grows with each hit within the decal's lifetime. Use existing decal system if the museum has one; otherwise new `GroundDecalManager` in `src/lib/shared/3d/effects/water/`.
- **Splash:** droplet hits (ground plane in 3D, canvas bottom in 2D) spawn 4-12 small burst particles with upward-facing velocity cones. Burst color uses `splashTint` from palette.
- Spirit palette **suppresses puddles** (ethereal — it's stated as a palette property, not a separate intent param). Acid palette adds a subtle yellow fade on puddle edges (smoking effect — cheap shader variation).

**Bail point:** Do puddles add grounding or distract from motion?

### 1f.v — 3D refraction (3D-only polish)

Activates `clarity` meaningfully in 3D.

- Scene rendered to a texture, sampled by droplet + stream shaders with normal-based distortion.
- Refraction strength ∝ `clarity` (higher clarity = stronger, more-visible refraction; lower clarity diffuses it into a highlight instead).
- Skipped on low tier, reduced-res scene texture on medium, full-res on high.
- 2D equivalent: `clarity` drives highlight strength on droplet/stream shaders (already active from 1f.i — no 2D work in this sub-phase).

**Bail point:** Polish-only sub-phase. If tokens are tight, defer indefinitely.

## Architecture per backend

### 2D (canvas/WebGL2)

- `src/lib/shared/effects/renderers/Water2DRenderer.ts` — owns the droplet pool, emitter state, ribbon mesh, metaball pass orchestration
- Reuses: trails ribbon infrastructure, charcoal particle-pool pattern
- 2D gravity applied per-frame as `velocity += gravityDir * dt` where `gravityDir` is recomputed each frame from the tip's current velocity

### 3D (Three.js)

- `src/lib/shared/3d/effects/water/WaterRenderer3D.ts` — owns the Three.js scene objects, instanced particle mesh, ribbon mesh, metaball post pass, decal manager
- `src/lib/shared/3d/effects/water/WaterParticleMesh.ts` — instanced billboard/sphere pool
- `src/lib/shared/3d/effects/water/WaterRibbonMesh.ts` — stream layer (thin wrapper around shared trails ribbon)
- `src/lib/shared/3d/effects/water/WaterMetaballPass.ts` — 1f.iii only
- `src/lib/shared/3d/effects/water/GroundDecalManager.ts` — 1f.iv only (or reuse existing if museum has one)
- `src/lib/shared/3d/effects/water/WaterRefractionPass.ts` — 1f.v only

## Quality tiers

| Tier | 1f.i droplets | 1f.ii stream | 1f.iii metaballs | 1f.iv puddles | 1f.v refraction |
|------|---------------|--------------|------------------|---------------|-----------------|
| low | 512 particles | on | **off** | simple ellipses / small decals | **off** |
| medium | 1024 particles | on | reduced-res pass | on | reduced-res scene texture |
| high | 2048 particles | on | full-res pass | on | full-res scene texture |

## Files

### Modified

- `src/lib/shared/effects/domain/EffectsConfig.ts` — add `WaterIntent`, extend `EffectType`, `EffectsConfig`, `activePresets`, `EffectsOverrides`; bump version
- `src/lib/shared/effects/domain/defaults.ts` — add water defaults (classic preset values)
- `src/lib/shared/effects/domain/migrations.ts` — add version bump migration (no-op: water absent → water default)
- `src/lib/shared/effects/translators/canvas2d-types.ts` — add `Water2DParams`
- `src/lib/shared/effects/translators/canvas2d-translator.ts` — add `resolveWater2D(intent, palette) → Water2DParams`
- `src/lib/shared/effects/translators/webgl3d-types.ts` — add `Water3DParams`
- `src/lib/shared/effects/translators/webgl3d-translator.ts` — add `resolveWater3D(intent, palette) → Water3DParams`
- `src/lib/shared/animation-engine/components/effects-panel/EffectSelector.svelte` — extend chip row (10 chips including `none`)
- `src/lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte` — route water to WaterCustomize
- `docs/superpowers/specs/effects-unification-deferred-items.md` — add deferred item: "Migrate trails/fire/led/zap/sparkles intents toward water's color + intensity pattern"

### New

- `src/lib/shared/effects/domain/presets/built-in-water-presets.ts` — 7 presets
- `src/lib/shared/effects/renderers/Water2DRenderer.ts` — 2D renderer
- `src/lib/shared/3d/effects/water/WaterPalettes.ts` — palette registry (shared 2D/3D)
- `src/lib/shared/3d/effects/water/WaterRenderer3D.ts` + sub-components (see Architecture)
- `src/lib/shared/animation-engine/components/effects-panel/customize/WaterCustomize.svelte` — intent editor
- `src/lib/shared/animation-engine/components/effects-panel/presets/WaterPresets.svelte` — preset grid

## Testing

- Unit: palette derivation for `custom` palette (hsl-shift math), preset application (intent state matches preset values after click), translator resolution (water intent → correct 2D/3D params per palette)
- Integration: water effect toggles on/off via chip row, presets apply visibly, per-sub-phase visual verification via Chrome DevTools MCP screenshots
- Verification per sub-phase: Austen confirms "yes that reads as water" / "yes the whip is convincing" / "yes the goopy mode earns its cost" before advancing

## Known risks

- **Pattern rot.** This spec assumes the 2D/3D translator patterns hardened by 1c-1e still look the way they do on 2026-04-15. If Phase 1c-1e change the translator API significantly, this spec needs a quick review before 1f.i starts.
- **Render graph dependency.** 1f.iii metaballs depend on the unified GPU render pipeline (`project_unified_gpu_render_pipeline.md`). If that pipeline isn't ready when 1f.iii begins, either defer 1f.iii until it is, or implement metaballs in the legacy path with a TODO to migrate.
- **Ground decal system.** If the museum already has a decal manager, reuse it. If not, `GroundDecalManager` is net-new work inside 1f.iv scope.
- **2D gravity may not read correctly.** The anti-parallel-to-velocity gravity decision is stylized and unverified. If 1f.i ships and it looks wrong, fall back to screen-down gravity (charcoal pattern) and flag a deferred polish item.

## Out of scope

- Migrating existing effects to water's intent pattern (deferred).
- Audio (water splash sounds) — separate feature.
- Collision between water and other effects (e.g., water extinguishing fire visually) — fun idea, separate spec.
- Physics-accurate water simulation (SPH, FLIP, etc.) — explicitly not this.

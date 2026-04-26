# Effects Phase 1k: Frost/Ice Effect Design

**Status:** Spec (2026-04-15). Queued as Phase **1k** — runs after 1j Ink. Do not start before 1j lands. Last effect in the Phase 1 queue.

**Goal:** Add frost/ice as the 14th unified effect (chip row → 15 including `none`). Four sub-phases. The most architecturally novel effect: introduces geometric crystal growth alongside standard particles. No mesh shattering (explicitly rejected as a research problem). Crystal "shatter" is dissolve-into-sparkling-dust, not physics-based fracture.

## Context

Requested 2026-04-15. Another AI suggested "mesh shattering" — rejected because real-time mesh fracture with correct Voronoi decomposition is a research problem in production contexts, and the visual payoff in a 2D canvas + Three.js scene is low compared to cost. Scoped to: crystalline growth along trail path (novel geometric structure), cold particle aura (standard particle), sparkling-dust dissolve (standard particle death), and frost ground decals.

## Design decisions (made by Claude per Austen's delegation)

- **Palette-driven** (C) — consistent with all other effects. Six palettes with behavioral splits.
- **Crystal growth is particle-based with geometric sprites, not procedural mesh.** Angular hexagonal/faceted billboard sprites arranged in branching patterns simulate crystal growth without the complexity of actual procedural geometry. Reads as crystalline at the scale TKA effects render at. If it doesn't read correctly, bail at 1k.ii and keep frost as aura-only.
- **Emission: tip-only** (consistent with water/bubbles). No backend-split — frost reads naturally from the point of contact.
- **Death: sparkling-dust dissolve.** Crystal particles break into 4-8 tiny bright sparkle particles that fade quickly. Not mesh fracture — particle spawn on particle death.

## Intent shape

```ts
// src/lib/shared/effects/domain/EffectsConfig.ts

export interface FrostIntent {
  /** 0-1. Continuous cold emission at rest. */
  ambientEmission: number;
  /** 0-1. Velocity-reactive crystal/particle emission. */
  motionEmission: number;
  /** 0-1. Crystal size + frost density. */
  intensity: number;
  /** Named palette. "custom" uses customColor. */
  palette: "glacial" | "breath" | "black_ice" | "aurora" | "diamond" | "cursed" | "custom";
  /** Hex string. Used only when palette === "custom". */
  customColor: string;
  /** 0-1. Crystal angular complexity. 0 = simple hexagons, 1 = branching dendrites. */
  crystallinity: number;
  /** 0-1. How quickly frost spreads along the trail path. 0 = stays near tip, 1 = rapid coverage. */
  spreadRate: number;
  /** Explicit tracking. */
  trackingMode: "left_end" | "right_end" | "both_ends";
}
```

Extend `EffectType`, `EffectsConfig`, `EffectsConfig.activePresets`, and `EffectsOverrides` to include `frost`. Bump `EFFECTS_CONFIG_VERSION`.

`crystallinity` and `spreadRate` are frost-specific. `crystallinity` controls sprite complexity selection (simple hexagons vs branching dendrites). `spreadRate` controls how far from the tip crystals grow along the recent path.

## Palette definitions

Frost palettes carry a behavioral flag: `auraOnly` — breath palette skips crystal growth entirely, stays as cold particle haze.

```ts
// src/lib/shared/3d/effects/frost/FrostPalettes.ts (mirror in 2D renderer folder)

export interface FrostPalette {
  readonly id: FrostIntent["palette"];
  readonly crystal: string;     // hex — crystal body color
  readonly rim: string;         // hex — crystal edge highlight
  readonly sparkle: string;     // hex — dissolve sparkle color
  readonly aura: string;        // hex — cold haze particles
  readonly groundFrost: string; // hex — ground decal tint
  readonly auraOnly?: boolean;  // breath palette — no crystal growth
  readonly emissive?: boolean;  // aurora palette — crystals glow
}
```

Palette registry:

| id | crystal | rim | sparkle | aura | ground | flags | notes |
|----|---------|-----|---------|------|--------|-------|-------|
| glacial | `#a0d8ff` | `#e0f4ff` | `#ffffff` | `#c0e8ff80` | `#80c0e0` | — | classic blue-white ice |
| breath | `#d0e8f0` | `#f0f8ff` | `#ffffff` | `#e0f0f880` | `#b0d0e0` | `auraOnly: true` | cold haze, no crystals |
| black_ice | `#202830` | `#405060` | `#80a0b0` | `#30404880` | `#182028` | — | dark, nearly invisible |
| aurora | `#60ff80` → `#ff60c0` shift | `#ffffff` | `#c0ffd0` | `#80ffa060` | `#40c080` | `emissive: true` | northern lights iridescence |
| diamond | `#e8e8f0` | `#ffffff` | `#ffffff` | `#f0f0f880` | `#d0d0e0` | — | clear, high sparkle |
| cursed | `#4020a0` | `#8060d0` | `#c0a0ff` | `#604080a0` | `#301880` | — | purple dark ice, cross-palette family |
| custom | derived from `customColor` | | | | | — | hsl-shift: crystal=base, rim=+30%L, sparkle=+50%L/-50%S, aura=base@50%A, ground=-20%L |

**Aurora palette iridescence:** crystal body color shifts from green → magenta → cyan over lifetime. Reuses bubbles 1g.iii / smoke genie hue-shift code path (now a proven shared utility across 3 effects).

## Presets

Six presets in `src/lib/shared/effects/domain/presets/built-in-frost-presets.ts`:

| id | palette | ambient | motion | intensity | crystallinity | spreadRate | notes |
|----|---------|---------|--------|-----------|---------------|------------|-------|
| classic | glacial | 0.4 | 0.5 | 0.6 | 0.5 | 0.5 | balanced crystal + aura |
| breath | breath | 0.7 | 0.3 | 0.4 | 0.0 | 0.0 | cold haze only, no crystals |
| flash_freeze | glacial | 0.2 | 0.9 | 0.8 | 0.7 | 1.0 | fast crystal spread on motion |
| black_ice | black_ice | 0.3 | 0.6 | 0.5 | 0.4 | 0.6 | subtle dark frost |
| aurora | aurora | 0.5 | 0.4 | 0.7 | 0.6 | 0.5 | glowing iridescent crystals |
| cursed | cursed | 0.3 | 0.5 | 0.7 | 0.8 | 0.4 | dark purple dendrites |

All presets ship with `trackingMode: "both_ends"`.

## Sub-phase delivery

Four sub-phases.

### 1k.i — Cold aura MVP

Ships the particle layer. Proves frost reads as frost.

- Pre-allocated particle pool per backend. Size: 512 particles (low), 1024 (medium), 2048 (high).
- Tip emission with standard hybrid formula. Tuning constants: `AMBIENT_BASE_RATE ≈ 6` particles/sec, `MOTION_BASE_RATE ≈ 25` particles/sec, `MOTION_REFERENCE_SPEED ≈ 3.0` units/sec.
- Particle motion: slow outward drift from tip (radial from emission point, not directional). Small random velocity. No gravity — frost doesn't fall, it spreads.
- Particle lifetime: 1.5-3.0s with jitter.
- **2D shader:** small angular shapes (4-6 sided polygons with sharp edges, not circles). Color from palette `aura`. Alpha fades over lifetime.
- **3D shader:** billboard sprites with angular shape, palette `aura` tint, soft depth fade.
- Death: alpha fade, no burst (burst comes in 1k.iii dissolve).

**Bail point:** Does the cold aura read as frost/cold?

### 1k.ii — Crystal growth along trail

The novel sub-phase. Geometric crystal sprites grow outward from the prop's recent trail path.

- Track the tip's recent path (last N positions, reuse ribbon point buffer from trails infrastructure).
- Along the path, spawn crystal sprites at intervals. Crystals spawn small and grow over 0.5-1.0s to full size.
- Crystal sprite selection based on `crystallinity`: low = simple hexagons, high = branching dendrite shapes (6-armed snowflake silhouettes).
- Crystals orient perpendicular to the trail path (growing outward from the stroke, not along it).
- Crystal lifetime: 2-4s. Crystal growth → hold → dissolve (dissolve behavior lands in 1k.iii).
- `spreadRate` controls how far back along the trail path crystals spawn (low = only near tip, high = crystals grow along the full recent trail).
- `breath` palette (`auraOnly: true`) skips this sub-phase entirely.
- Sprite atlas: 8 crystal shapes ranging from simple hexagon to complex dendrite. Single atlas shared 2D/3D.
- Quality-tier effect: low = max 128 crystals, medium = 256, high = 512.

**Bail point:** Do geometric crystals read correctly, or do they look like random angular sprites? If they don't read as ice, revert to aura-only and drop crystal growth.

### 1k.iii — Sparkling-dust dissolve

Crystal death animation. Crystals don't just fade — they shatter into sparkle.

- When a crystal reaches end-of-life, instead of alpha fade, spawn 4-8 tiny bright sparkle particles.
- Sparkles use palette `sparkle` color, are very small (1-3px in 2D), have high initial outward velocity that decays quickly, and fade over 200-400ms.
- Sparkle sub-pool: 512 particles (shared across all crystals). When pool is full, oldest sparkles die.
- Aura particles (from 1k.i) also gain sparkle-on-death, but fewer (2-4 per aura particle).
- Visual effect: frost constantly glitters as crystals cycle through grow → hold → shatter → sparkle.

**Bail point:** Does the sparkle dissolve add magic, or is it visual noise?

### 1k.iv — Ground frost decals

Frost accumulates on the floor plane (3D) and lower canvas (2D).

- **3D:** ground-projected frost decals. Geometric frost pattern texture (crystalline web). Reuses `GroundDecalManager` from water 1f.iv. Decals grow slowly (frost spreading) and fade over 6-10s (slow melt).
- **2D:** frost patterns accumulate in lower ~15% of canvas (same region as water puddles, ink pools, petal accumulation). Small angular crystalline shapes that grow and fade.
- Diamond palette produces the most visible ground frost (high sparkle). Black_ice palette produces barely visible ground frost (dark, subtle).
- Quality-gated: skipped on low tier.

**Bail point:** Does ground frost add atmosphere or clutter the floor?

## Architecture per backend

### 2D

- `src/lib/shared/effects/renderers/Frost2DRenderer.ts` — aura pool, crystal pool, sparkle sub-pool, ground frost layer
- Crystal rendering: textured quads with angular crystal sprites, scaled up during growth phase
- Reuses: particle-pool pattern from water/bubbles/petals/smoke

### 3D

- `src/lib/shared/3d/effects/frost/FrostRenderer3D.ts` — Three.js scene objects, manages all sub-pools
- `src/lib/shared/3d/effects/frost/FrostAuraEmitter.ts` — cold haze particle emitter
- `src/lib/shared/3d/effects/frost/FrostCrystalMesh.ts` — instanced billboard mesh for trail-path crystals, handles grow/hold/dissolve lifecycle
- `src/lib/shared/3d/effects/frost/FrostSparkleBurst.ts` — sparkle sub-pool for dissolve
- `src/lib/shared/3d/effects/frost/FrostGroundDecals.ts` — 1k.iv; prefers sharing `GroundDecalManager`
- `src/lib/shared/3d/effects/frost/FrostPalettes.ts` — shared 2D/3D palette registry
- `src/lib/shared/3d/effects/frost/FrostSprites.ts` — crystal sprite atlas loader

## Quality tiers

| Tier | 1k.i aura | 1k.ii crystals | 1k.iii sparkle | 1k.iv ground frost |
|------|-----------|----------------|----------------|--------------------|
| low | 512 particles | 128 max crystals | 256 sparkle pool | **off** |
| medium | 1024 particles | 256 max crystals | 512 sparkle pool | on, reduced |
| high | 2048 particles | 512 max crystals | 512 sparkle pool | on, full |

## Cross-palette ecosystem update

| Palette name | Water | Bubbles | Petals | Smoke | Ink | Frost |
|-------------|-------|---------|--------|-------|-----|-------|
| acid | ✓ | ✓ | — | — | ✓ | — |
| blood | ✓ | — | — | — | ✓ | — |
| spirit | ✓ | ✓ | — | ✓ | — | — |
| cursed | — | — | — | ✓ | — | ✓ |

Frost adds `cursed` to the cross-palette family (shared with smoke's `cursed` palette).

## Files

### Modified

- `src/lib/shared/effects/domain/EffectsConfig.ts` — add `FrostIntent`, extend `EffectType`, `EffectsConfig`, `activePresets`, `EffectsOverrides`; bump version
- `src/lib/shared/effects/domain/defaults.ts` — add frost defaults (classic preset values)
- `src/lib/shared/effects/domain/migrations.ts` — add version bump migration
- `src/lib/shared/effects/translators/canvas2d-types.ts` — add `Frost2DParams`
- `src/lib/shared/effects/translators/canvas2d-translator.ts` — add `resolveFrost2D(intent, palette) → Frost2DParams`
- `src/lib/shared/effects/translators/webgl3d-types.ts` — add `Frost3DParams`
- `src/lib/shared/effects/translators/webgl3d-translator.ts` — add `resolveFrost3D(intent, palette) → Frost3DParams`
- `src/lib/shared/animation-engine/components/effects-panel/EffectSelector.svelte` — extend chip row (15 chips including `none`)
- `src/lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte` — route frost to FrostCustomize

### New

- `src/lib/shared/effects/domain/presets/built-in-frost-presets.ts` — 6 presets
- `src/lib/shared/effects/renderers/Frost2DRenderer.ts` — 2D renderer
- `src/lib/shared/3d/effects/frost/FrostPalettes.ts` — palette registry
- `src/lib/shared/3d/effects/frost/FrostSprites.ts` — crystal + dendrite atlas
- `src/lib/shared/3d/effects/frost/sprites/` — crystal atlas PNGs
- `src/lib/shared/3d/effects/frost/FrostRenderer3D.ts` + sub-components (see Architecture)
- `src/lib/shared/animation-engine/components/effects-panel/customize/FrostCustomize.svelte` — intent editor
- `src/lib/shared/animation-engine/components/effects-panel/presets/FrostPresets.svelte` — preset grid

## Testing

- Unit: crystal sprite selection based on `crystallinity`, crystal growth math, sparkle burst count per crystal
- Unit: palette behavior flags (`auraOnly` skips crystal growth, `emissive` enables glow)
- Unit: `spreadRate` controls crystal spawn distance along trail path
- Integration: frost toggles on/off via chip row, presets apply visibly, breath palette stays aura-only
- Verification per sub-phase: Austen confirms "yes cold aura reads" / "yes crystals read as ice" / "yes sparkle adds magic" / "yes ground frost is atmospheric"

## Known risks

- **Crystal growth is architecturally novel.** No other effect spawns geometric structures along a trail path. May need a new data structure (trail-path sampler) that's distinct from both the particle pool and the ribbon mesh. If the path sampler is too complex, fall back to spawning crystals only at the tip (like water droplets but angular), losing the "frosting along the trail" read. Still distinct from other effects, just less novel.
- **Sprite atlas dependency.** Like petals, frost needs drawn silhouettes (hexagons, dendrites). Ship with procedural shapes (Canvas2D polygon drawing) if atlas art isn't ready — hexagons are trivially procedural.
- **Aurora hue-shift is the third effect using this pattern.** If the shared hue-shift utility from bubbles 1g.iii doesn't generalize cleanly by 1k, refactor it here. Three consumers (bubbles oil, smoke genie, frost aurora) justifies a proper shared utility.
- **Ground frost + water puddles + ink pools + petal decals.** By Phase 1k, four effects use ground decals. `GroundDecalManager` needs a per-effect layer or budget to prevent them from competing for the same visual space. Should be handled by water 1f.iv's design, but verify.
- **Crystal-to-sparkle particle spawn.** 512 crystals × 8 sparkles = 4096 potential sparkle particles, but capped at 512 pool. Pool recycling is fine (sparkles are so short-lived they naturally recycle), but verify under sustained high-intensity crystal spawn that the pool doesn't visually stutter.

## Out of scope

- Mesh shattering / Voronoi fracture — explicitly rejected as a research problem.
- Ice physics simulation (freezing fluid dynamics) — not this.
- Freezing other effects (frost interacting with water to create ice) — fun, separate spec.
- Audio (cracking ice, crystalline chimes) — separate feature.
- Stacking with other effects — tracked separately.
- Procedural crystal geometry (actual 3D hexagonal prisms) — billboard sprites are enough at this scale.

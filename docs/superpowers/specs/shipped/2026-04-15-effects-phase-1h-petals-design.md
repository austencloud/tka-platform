# Effects Phase 1h: Petals/Leaves Effect Design

**Status:** Spec (2026-04-15). Queued as Phase **1h** — runs after 1g Bubbles. Do not start before 1g lands.

**Goal:** Add petals/leaves as the 11th unified effect (chip row → 12 including `none`). Three sub-phases. Visually distinct from water, bubbles, and all prior effects through silhouette — sprite-based particles instead of pure-math shaders, sinusoidal flutter motion, and backend-split emission behavior.

## Context

Requested 2026-04-15 as part of the five-effect batch (bubbles, petals, smoke, ink, frost). Petals earned third spec position after water and bubbles because they're the cheapest win aesthetically (billboard sprites + simple physics) and the first effect to establish the **backend-split behavior** pattern: 2D behaves one way, 3D behaves another, driven by spatial geometry differences (2D is front-view, 3D has real above/below).

## Intent shape

```ts
// src/lib/shared/effects/domain/EffectsConfig.ts

export interface PetalsIntent {
  /** 0-1. Continuous emission. 2D: from tip. 3D: from above scene ceiling. */
  ambientEmission: number;
  /** 0-1. Velocity-reactive burst from tip (both backends). Spin rate drives this via tip speed. */
  motionEmission: number;
  /** 0-1. Overall petal size + brightness. */
  intensity: number;
  /** Named palette. "custom" uses customColor. */
  palette: "blossom" | "autumn" | "jungle" | "ash" | "gold" | "custom";
  /** Hex string. Used only when palette === "custom". */
  customColor: string;
  /** 0-1. Sinusoidal sway amplitude. 0 = straight fall, 1 = wide flutter. */
  swayAmplitude: number;
  /** 0-1. Downward velocity scalar. */
  fallSpeed: number;
  /** Explicit tracking — adopts the clean trails/water/bubbles pattern. */
  trackingMode: "left_end" | "right_end" | "both_ends";
}
```

Extend `EffectType`, `EffectsConfig`, `EffectsConfig.activePresets`, and `EffectsOverrides` to include `petals`. Bump `EFFECTS_CONFIG_VERSION`.

## Palette definitions

Petals are silhouette-driven, so each palette carries both a **tint range** and a **sprite variant list** (3-5 silhouette shapes). Renderer picks a sprite per spawn from the palette's list, applies a tint sampled from the palette's tint range.

```ts
// src/lib/shared/3d/effects/petals/PetalPalettes.ts (mirror in 2D renderer folder)

export interface PetalPalette {
  readonly id: PetalsIntent["palette"];
  readonly sprites: readonly string[];  // atlas keys — 3-5 silhouettes
  readonly tints: readonly string[];    // hex array — renderer picks per spawn
  readonly emberEdge?: { chance: number; color: string }; // ash palette only
}
```

Palette registry:

| id | sprites | tint range | ember flag | notes |
|----|---------|------------|------------|-------|
| blossom | 3 small round petal shapes | `#ffd0e0`, `#ffc0d8`, `#ffb0c8` | — | pink cherry blossom |
| autumn | 5 maple/oak/elm leaf shapes | `#d84820`, `#c86828`, `#c88020`, `#a85820`, `#884818` | — | red/orange/brown mix |
| jungle | 4 elongated leaf shapes | `#408840`, `#509848`, `#60a050`, `#588838` | — | green, heavier silhouettes |
| ash | 5 burnt-edged leaf shapes | `#606060`, `#484848`, `#303030` | 20% chance, `#ff6020` edge | pairs with fire |
| gold | 3 stylized leaf shapes | `#ffd060`, `#ddc050`, `#c89020` | — | metallic, rare, slow fall |
| custom | reuses blossom silhouettes | derived from `customColor` (3 tints: base, +10% L, -10% L) | — | |

**Sprite atlas storage:** `src/lib/shared/3d/effects/petals/sprites/` — one PNG atlas per palette. 2D and 3D share the atlases (loaded once per palette, referenced by both renderers).

## Presets

Six presets in `src/lib/shared/effects/domain/presets/built-in-petals-presets.ts`:

| id | palette | ambient | motion | intensity | swayAmplitude | fallSpeed | notes |
|----|---------|---------|--------|-----------|---------------|-----------|-------|
| classic | blossom | 0.5 | 0.4 | 0.6 | 0.6 | 0.4 | balanced cherry blossom |
| storm | autumn | 0.8 | 0.6 | 0.7 | 0.8 | 0.7 | chaotic autumn fall |
| jungle_drift | jungle | 0.4 | 0.3 | 0.7 | 0.5 | 0.5 | green heavy drift |
| ember_ash | ash | 0.3 | 0.7 | 0.5 | 0.7 | 0.5 | motion-heavy, embers flicker |
| gilded | gold | 0.2 | 0.4 | 0.9 | 0.4 | 0.2 | rare slow metallic |
| tornado | autumn | 0.4 | 1.0 | 0.6 | 1.0 | 0.8 | extreme sway — spin-chaos |

All presets ship with `trackingMode: "both_ends"`.

## Sub-phase delivery

Three sub-phases. No metaballs, no refraction, no iridescence — petals don't need them.

### 1h.i — Petal MVP

Ships the base effect with backend-split emission.

- Pre-allocated particle pool per backend. Size: 512 particles (low), 1024 (medium), 2048 (high).
- **2D emission:** tip-only. Spawn rate = `ambientEmission * AMBIENT_BASE_RATE + motionEmission * speedScalar * MOTION_BASE_RATE`. Same formula family as water/bubbles. Tuning constants (defaults suggested): `AMBIENT_BASE_RATE ≈ 5` petals/sec, `MOTION_BASE_RATE ≈ 25` petals/sec at full velocity, `MOTION_REFERENCE_SPEED ≈ 3.0` units/sec.
- **3D emission:** dual-source.
  - Ambient spawn zone: horizontal rectangle above scene (`y = sceneHeight * 1.2`, span = `sceneWidth * 1.5`). Uniform-random spawn position within zone at rate `ambientEmission * AMBIENT_ABOVE_RATE ≈ 10` petals/sec.
  - Motion burst: from tip, same formula as 2D but with only the `motionEmission` term active (no ambient-from-tip).
- **Motion physics (both backends):**
  - Downward velocity: `v.y = -FALL_BASE * fallSpeed`
  - Sinusoidal sway: `v.x += sin(petal.phase + t * SWAY_FREQ) * swayAmplitude * SWAY_BASE`, where `petal.phase` is a per-petal random phase offset so they don't flutter in sync.
  - 2D rotation: around sprite center, angular velocity proportional to instantaneous `v.x`.
  - 3D tumble: small angular velocities on all 3 axes, per-petal random direction.
- **Sprite/tint selection:** on spawn, pick one sprite uniform-random from the palette's sprite list, pick one tint uniform-random from the tint range. For ash palette, roll the ember flag (20% chance) but the ember rim only lights up in 1h.iii.
- **Death:** timeout-based, alpha fades over last 500ms. Both backends behave the same this sub-phase (ground accumulation is 1h.ii).

**Bail point:** Do they read as falling petals/leaves?

### 1h.ii — Ground accumulation (3D only)

Activates when 3D petals reach the floor plane.

- On floor contact, convert the billboard particle to a flat ground decal.
- Reuses water's `GroundDecalManager` if water 1f.iv shipped. Otherwise new manager at `src/lib/shared/3d/effects/petals/PetalGroundDecals.ts` (same API surface, so swap later).
- Decals use the same sprite + tint as the airborne particle they came from. Flat-oriented (normal = world up).
- Decals fade over 2-4s (per-decal jitter).
- Quality-gated: **skipped on low tier** — low-tier petals fade in air instead.
- 2D does nothing this sub-phase (canvas has no floor; stays on 1h.i's mid-air fade).

**Bail point:** Does ground accumulation earn its cost?

### 1h.iii — Ash ember glow

Activates for ash palette only.

- Particles with the `ember` flag (rolled at spawn, 20% chance for ash palette) get a small glowing orange rim that fades faster than the rest of the petal (ember dies over first 400ms; petal continues its normal lifetime).
- Shader branch gated on ember flag. Other palettes skip the branch entirely.
- Cheap: one extra uniform comparison per particle, one extra additive pass on embers only.

**Bail point:** Is the ember detail worth the shader branch?

## Architecture per backend

### 2D

- `src/lib/shared/effects/renderers/Petals2DRenderer.ts` — owns pool, emitter (tip-only), draw calls (textured quads rotated around sprite center)
- Uses Canvas2D transform stack for per-sprite rotation — no WebGL2 required
- Reuses: particle-pool pattern from water/bubbles

### 3D

- `src/lib/shared/3d/effects/petals/PetalsRenderer3D.ts` — owns Three.js scene objects, instanced textured-billboard mesh
- `src/lib/shared/3d/effects/petals/PetalEmitter.ts` — dual-source emitter logic (ambient above zone + motion tip bursts)
- `src/lib/shared/3d/effects/petals/PetalParticleMesh.ts` — instanced billboard mesh with per-instance sprite/tint/rotation
- `src/lib/shared/3d/effects/petals/PetalSprites.ts` — atlas loader, palette → sprite list mapping, shared 2D/3D
- `src/lib/shared/3d/effects/petals/PetalGroundDecals.ts` — 1h.ii only; prefers sharing `GroundDecalManager` from water

## Quality tiers

| Tier | 1h.i particles | 1h.ii ground decals | 1h.iii embers |
|------|----------------|---------------------|---------------|
| low | 512 | **off** (petals fade in air) | on |
| medium | 1024 | on, reduced max decals (~200) | on |
| high | 2048 | on, full decal budget (~500) | on |

Embers stay on at low tier — one uniform comparison + additive blend is free.

## Files

### Modified

- `src/lib/shared/effects/domain/EffectsConfig.ts` — add `PetalsIntent`, extend `EffectType`, `EffectsConfig`, `activePresets`, `EffectsOverrides`; bump version
- `src/lib/shared/effects/domain/defaults.ts` — add petals defaults (classic preset values)
- `src/lib/shared/effects/domain/migrations.ts` — add version bump migration (no-op: petals absent → petals default)
- `src/lib/shared/effects/translators/canvas2d-types.ts` — add `Petals2DParams`
- `src/lib/shared/effects/translators/canvas2d-translator.ts` — add `resolvePetals2D(intent, palette) → Petals2DParams`
- `src/lib/shared/effects/translators/webgl3d-types.ts` — add `Petals3DParams`
- `src/lib/shared/effects/translators/webgl3d-translator.ts` — add `resolvePetals3D(intent, palette) → Petals3DParams`
- `src/lib/shared/animation-engine/components/effects-panel/EffectSelector.svelte` — extend chip row (12 chips including `none`)
- `src/lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte` — route petals to PetalsCustomize

### New

- `src/lib/shared/effects/domain/presets/built-in-petals-presets.ts` — 6 presets
- `src/lib/shared/effects/renderers/Petals2DRenderer.ts` — 2D renderer
- `src/lib/shared/3d/effects/petals/PetalPalettes.ts` — palette registry (shared 2D/3D)
- `src/lib/shared/3d/effects/petals/PetalSprites.ts` — atlas loader
- `src/lib/shared/3d/effects/petals/sprites/` — atlas PNG files per palette (6 atlases)
- `src/lib/shared/3d/effects/petals/PetalsRenderer3D.ts` + sub-components (see Architecture)
- `src/lib/shared/animation-engine/components/effects-panel/customize/PetalsCustomize.svelte` — intent editor
- `src/lib/shared/animation-engine/components/effects-panel/presets/PetalsPresets.svelte` — preset grid

## Sprite asset pipeline

- 6 palettes × 3-5 sprites = ~24 total silhouettes. Source art lives in `docs/assets/petal-silhouettes/` (SVG) and gets converted to PNG atlases at build time OR pre-baked and committed directly.
- Recommended: pre-bake and commit the PNG atlases to avoid a build-time dependency on SVG-to-PNG tooling. Source SVGs stay in the docs folder for future regeneration.
- Target atlas dimensions: 512×512 per palette, 4×4 or 5×4 grid of silhouettes.

## Testing

- Unit: palette resolution (spawn returns a sprite + tint from the palette's lists), preset application, translator resolution
- Unit: sway math — given `phase`, `swayAmplitude`, `t`, verify horizontal velocity is bounded
- Integration: petals toggle on/off via chip row, presets apply visibly, per-sub-phase visual verification via Chrome DevTools MCP screenshots
- Verification per sub-phase: Austen confirms "yes that reads as petals" / "yes ground accumulation is worth it" / "yes embers add something" before advancing

## Known risks

- **Sprite art is net-new work.** Unlike water and bubbles (pure shader), petals need actual drawn silhouettes. If no art is ready when 1h.i starts, ship with placeholder rectangles and backfill art later (blocks only aesthetic verification, not architecture).
- **Backend-split emission is a new pattern.** First effect to fork behavior (not just visual style) by backend. If the translator layer can't cleanly express "2D uses formula A, 3D uses formula B" today, introducing the fork may ripple into translator refactoring. Verify the translator shape at 1h.i start; if it resists, back off to single-source (A: tip only in both) and flag as deferred polish.
- **Ground decal manager coupling.** 1h.ii assumes water's `GroundDecalManager` exists. If water deferred 1f.iv, petals build a net-new manager. Prefer reuse when possible.
- **Atlas loading in 2D.** Canvas2D can draw `HTMLImageElement`, so atlas loading is trivial. But if the effects panel lets the user switch palettes mid-playback, the new atlas must load before the first spawn uses it. Handle with async atlas preload on palette change; fall back to previous atlas if load is pending.

## Out of scope

- Physically-accurate petal aerodynamics (lift, drag, rotation-induced sway) — the sinusoidal model is stylized and enough.
- Per-petal collision with other scene geometry (other than the floor plane) — petals phase through props, avatars, etc.
- Audio (rustling leaves) — separate feature.
- Petal accumulation piling up (leaves on leaves creating drifts) — ground decals are flat, non-stacking.
- Stacking with other effects — tracked separately.
- Wind field / global direction shift — the per-petal sway model is deliberately decoupled from global state.

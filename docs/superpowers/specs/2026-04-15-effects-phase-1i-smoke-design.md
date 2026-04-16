# Effects Phase 1i: Smoke/Incense Effect Design

**Status:** Spec (2026-04-15). Queued as Phase **1i** — runs after 1h Petals. Do not start before 1h lands.

**Goal:** Add smoke/incense as the 12th unified effect (chip row → 13 including `none`). Three sub-phases. Distinct from all prior effects: first one where palette carries behavioral DNA (lifetime, curl bias, rise bias) in addition to color, and first one that uses curl-noise motion for authentic swirling.

## Context

Requested 2026-04-15 as part of the five-effect batch. Smoke earned fourth spec position after water, bubbles, and petals. Volumetric ray-marched smoke was explicitly considered and rejected — it's tractable in 2026 (Three.js has demos, WebGPU compute makes it less painful to write) but has fundamental GPU costs that don't go away (fixed fullscreen ray-march, no 2D equivalent, couples to render graph still in flight). Sprite puffs + half-res blur pass gives 90% of the volumetric read at 5% of the cost and works in both backends.

## Intent shape

```ts
// src/lib/shared/effects/domain/EffectsConfig.ts

export interface SmokeIntent {
  /** 0-1. Continuous emission at rest. */
  ambientEmission: number;
  /** 0-1. Velocity-reactive multiplier. Spin rate drives this via tip speed. */
  motionEmission: number;
  /** 0-1. Overall puff size + opacity. */
  intensity: number;
  /** Named palette. "custom" uses customColor. Personality-laden — palette sets lifetime, curl, rise speed defaults. */
  palette: "incense" | "fog" | "genie" | "cursed" | "spirit" | "campfire" | "custom";
  /** Hex string. Used only when palette === "custom". */
  customColor: string;
  /** 0-1. Curl noise magnitude. 0 = straight rise, 1 = chaotic swirl. Multiplied by palette.curlBias. */
  curlStrength: number;
  /** 0-1. Upward rise speed scalar. Multiplied by palette.riseBias. */
  riseSpeed: number;
  /** Explicit tracking. */
  trackingMode: "left_end" | "right_end" | "both_ends";
}
```

Extend `EffectType`, `EffectsConfig`, `EffectsConfig.activePresets`, and `EffectsOverrides` to include `smoke`. Bump `EFFECTS_CONFIG_VERSION`.

**No `lifetimeScale` exposed.** Lifetime is part of palette identity — incense is slow, genie is fast, that's what makes them those things. User adjusts feel via palette choice, not a slider. Reduces knob count; matches how fire palette already carries temperature.

## Palette definitions

First effect where palette carries **behavioral multipliers** (lifetime, curl bias, rise bias) in addition to color slots.

```ts
// src/lib/shared/3d/effects/smoke/SmokePalettes.ts (mirror in 2D renderer folder)

export interface SmokePalette {
  readonly id: SmokeIntent["palette"];
  readonly core: string;      // hex — dense puff interior
  readonly edge: string;      // hex — puff rim / fade color
  readonly lifetime: number;  // seconds
  readonly curlBias: number;  // 0-2 — multiplier on user's curlStrength
  readonly riseBias: number;  // 0-2 — multiplier on user's riseSpeed
  readonly hueShift?: boolean; // genie palette — animates rim through hue gradient over lifetime
}
```

Palette registry:

| id | core | edge | lifetime (s) | curlBias | riseBias | hueShift | notes |
|----|------|------|--------------|----------|----------|----------|-------|
| incense | `#d8d8d8` | `#f0f0f0` | 8.0 | 0.3 | 0.4 | — | thin wispy, gentle curls |
| fog | `#c0c0c8` | `#e0e0e8` | 12.0 | 0.5 | 0.2 | — | dense, slow, lingers |
| genie | `#a060ff` (shifts) | `#ffe0ff` | 2.0 | 1.0 | 0.9 | yes | colored fast swirl |
| cursed | `#202020` | `#404040` | 10.0 | 0.8 | 0.3 | — | black sinister heavy curl |
| spirit | `#80c8ff` | `#ffffff` | 6.0 | 0.4 | 0.5 | — | translucent blue ethereal |
| campfire | `#805040` | `#b08060` | 7.0 | 0.6 | 0.6 | — | gray-brown, pairs with fire |
| custom | derived from `customColor` | derived (+15% L) | 7.0 | 0.5 | 0.5 | — | neutral defaults |

**Genie hue shift:** rim color animates through `#a060ff` → `#60c0ff` → `#ff60c0` → `#ffc060` over lifetime. Reuses bubbles 1g.iii iridescence code path.

**Custom derivation rule:** when `palette === "custom"`, derive `core` = base, `edge` = +15% L. Other fields use defaults from the table.

## Presets

Six presets in `src/lib/shared/effects/domain/presets/built-in-smoke-presets.ts`:

| id | palette | ambient | motion | intensity | curlStrength | riseSpeed | notes |
|----|---------|---------|--------|-----------|--------------|-----------|-------|
| classic | incense | 0.5 | 0.4 | 0.5 | 0.5 | 0.5 | default balanced incense |
| fog_wall | fog | 0.9 | 0.2 | 0.8 | 0.4 | 0.3 | constant dense haze |
| genie_burst | genie | 0.2 | 1.0 | 0.7 | 0.9 | 0.8 | motion-only magical swirl |
| cursed | cursed | 0.4 | 0.5 | 0.7 | 0.8 | 0.4 | heavy chaotic black |
| spirit_veil | spirit | 0.6 | 0.3 | 0.4 | 0.5 | 0.5 | ethereal translucent |
| campfire | campfire | 0.5 | 0.5 | 0.6 | 0.6 | 0.6 | pairs with fire effect |

All presets ship with `trackingMode: "both_ends"`.

## Sub-phase delivery

Three sub-phases. Each has a bail point.

### 1i.i — Puff MVP

Ships the base effect with curl-noise motion.

- Pre-allocated particle pool per backend. Size: 512 particles (low), 1024 (medium), 2048 (high).
- Tip emission. Spawn rate = `ambientEmission * AMBIENT_BASE_RATE + motionEmission * speedScalar * MOTION_BASE_RATE` where `speedScalar = clamp(tipSpeed / MOTION_REFERENCE_SPEED, 0, 1)`. Tuning constants (defaults): `AMBIENT_BASE_RATE ≈ 4` puffs/sec, `MOTION_BASE_RATE ≈ 20` puffs/sec at full velocity, `MOTION_REFERENCE_SPEED ≈ 3.0` units/sec.
- Puff lifetime = `palette.lifetime` with ±20% per-particle jitter.
- **Motion (curl noise):** each frame, `v = curlNoise(position * NOISE_SCALE, time) * curlStrength * palette.curlBias + up * riseSpeed * palette.riseBias * RISE_BASE`. Curl noise is 3D simplex-derived; sampled on CPU in JS for 2D, on GPU uniform for 3D (or CPU if instanced mesh pushes per-instance data). Tuning constants: `NOISE_SCALE ≈ 0.5` (field wavelength), `RISE_BASE ≈ 1.5` units/sec.
- Sprite: single shared soft noisy puff (one PNG, re-tinted per palette via `core` + `edge` gradient in shader). No atlas — smoke doesn't need silhouette variety.
- **2D shader:** radial alpha falloff from `core` center to `edge` then transparent. Rotation not needed (smoke is rotationally symmetric).
- **3D shader:** billboard sprite with same radial tint. Soft depth fade (alpha ramps down near geometry to avoid hard edges).
- Death: alpha fade over last 30% of lifetime.

**Bail point:** Does it read as smoke puffs?

### 1i.ii — Blur pass for continuity

Makes dense palettes (especially fog) read as continuous medium instead of stacked sprites.

- Render puffs to half-res offscreen buffer, apply Gaussian blur (radius derived from `intensity` — higher intensity = stronger blur), composite back at full res.
- **2D:** Canvas2D `filter: blur(Npx)` on an offscreen canvas, then `drawImage` to main canvas with current composite mode.
- **3D:** reuses water 1f.iii metaball infrastructure (half-res render target + gaussian blur pass + composite). If water 1f.iii deferred, smoke 1i.ii builds the shared pass and flags it for water's future use.
- Quality-tier gated: skipped on low (fog palette looks sprite-y at low tier, acceptable).

**Bail point:** Is the continuous read worth the fullscreen pass cost?

### 1i.iii — Genie palette hue shift

Genie palette only: rim color animates through a hue gradient over lifetime.

- Palette flag `hueShift: true` branches the shader to sample a 4-stop gradient at `age / lifetime` instead of using static `edge` color.
- Same code path as bubbles 1g.iii iridescence — share the gradient-sampling utility.
- Cheap: one extra lerp per particle per frame, gated on palette flag.

**Bail point:** Does genie's magical read earn the branch?

## Architecture per backend

### 2D

- `src/lib/shared/effects/renderers/Smoke2DRenderer.ts` — owns pool, emitter, per-frame curl noise sampling, offscreen blur composite
- Curl noise: JS-side simplex via shared utility (pull from existing noise lib if present, else inline small simplex impl)
- Reuses: particle-pool pattern from water/bubbles/petals

### 3D

- `src/lib/shared/3d/effects/smoke/SmokeRenderer3D.ts` — Three.js scene objects, instanced billboard mesh
- `src/lib/shared/3d/effects/smoke/SmokeCurlField.ts` — noise sampling utility (shared with future effects that want curl motion)
- `src/lib/shared/3d/effects/smoke/SmokeBlurPass.ts` — 1i.ii only; prefers reuse of water's `WaterMetaballPass`
- `src/lib/shared/3d/effects/smoke/SmokePalettes.ts` — shared 2D/3D palette registry with behavior multipliers

## Quality tiers

| Tier | 1i.i particles | 1i.ii blur | 1i.iii genie hue |
|------|----------------|------------|------------------|
| low | 512 | **off** (fog palette looks sprite-y, acceptable) | on |
| medium | 1024 | reduced-res pass (half-res target, 1-tap blur) | on |
| high | 2048 | full-res pass (quarter-res target, 2-tap separable gaussian) | on |

Genie hue shift stays on at low — one lerp per particle is free.

## Files

### Modified

- `src/lib/shared/effects/domain/EffectsConfig.ts` — add `SmokeIntent`, extend `EffectType`, `EffectsConfig`, `activePresets`, `EffectsOverrides`; bump version
- `src/lib/shared/effects/domain/defaults.ts` — add smoke defaults (classic preset values)
- `src/lib/shared/effects/domain/migrations.ts` — add version bump migration (no-op: smoke absent → smoke default)
- `src/lib/shared/effects/translators/canvas2d-types.ts` — add `Smoke2DParams`
- `src/lib/shared/effects/translators/canvas2d-translator.ts` — add `resolveSmoke2D(intent, palette) → Smoke2DParams` (applies palette.curlBias, palette.riseBias, palette.lifetime to produce resolved params)
- `src/lib/shared/effects/translators/webgl3d-types.ts` — add `Smoke3DParams`
- `src/lib/shared/effects/translators/webgl3d-translator.ts` — add `resolveSmoke3D(intent, palette) → Smoke3DParams`
- `src/lib/shared/animation-engine/components/effects-panel/EffectSelector.svelte` — extend chip row (13 chips including `none`)
- `src/lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte` — route smoke to SmokeCustomize

### New

- `src/lib/shared/effects/domain/presets/built-in-smoke-presets.ts` — 6 presets
- `src/lib/shared/effects/renderers/Smoke2DRenderer.ts` — 2D renderer
- `src/lib/shared/3d/effects/smoke/SmokePalettes.ts` — palette registry with behavior multipliers
- `src/lib/shared/3d/effects/smoke/SmokeCurlField.ts` — noise utility
- `src/lib/shared/3d/effects/smoke/SmokeRenderer3D.ts` + sub-components (see Architecture)
- `src/lib/shared/3d/effects/smoke/sprites/smoke-puff.png` — single shared soft-puff sprite
- `src/lib/shared/animation-engine/components/effects-panel/customize/SmokeCustomize.svelte` — intent editor (no lifetime slider)
- `src/lib/shared/animation-engine/components/effects-panel/presets/SmokePresets.svelte` — preset grid

## Pattern established: palette carries behavior

This is the first effect where palette is more than color — it carries lifetime, curl bias, rise bias. Rationale: smoke palettes read as different effects entirely (incense is a thread of mist; fog is a wall; genie is a flash). Exposing lifetime/curl as separate user sliders would force the user to rebuild "genie" themselves on top of the default curl value; baking it into the palette lets the user pick a feeling.

**Deferred item proposed** (add to `docs/superpowers/specs/effects-unification-deferred-items.md`): consider back-porting behavior-in-palette to water (lifetime per palette), bubbles (rise speed per palette), petals (fall speed per palette). Keep user-facing sliders as _multipliers_ of palette defaults, not absolute values. This would meaningfully tighten the palette-as-personality story across all effects.

## Testing

- Unit: palette resolution (translator correctly applies palette.curlBias, palette.riseBias, palette.lifetime on top of intent values)
- Unit: curl noise determinism (same position + time produces same velocity)
- Integration: smoke toggles on/off via chip row, presets apply visibly, per-sub-phase visual verification via Chrome DevTools MCP screenshots
- Verification per sub-phase: Austen confirms "yes that reads as smoke" / "yes the blur makes fog work" / "yes genie is magical" before advancing

## Known risks

- **Pattern rot.** Assumes translator patterns hardened by 1c-1h still look the way they do on 2026-04-15. Quick review before 1i.i starts.
- **Blur pass reuses water infrastructure.** If water 1f.iii deferred, smoke 1i.ii either builds the shared pass (accepting the infrastructure work as part of smoke scope) or skips 1i.ii and flags it to re-visit when water ships metaballs.
- **Long lifetimes saturate the pool.** Fog palette's 12s lifetime at max spawn rate will fill the 2048-particle pool. Renderer must fail gracefully — when pool is full, skip new spawns, do NOT recycle alive particles (causes visual popping). User experiences a density cap, not artifacts.
- **Curl noise cost in JS (2D).** 2048 particles × simplex noise per frame × 60fps = 122k samples/sec in JS. Simplex is ~200ns per call in V8, so ~25ms/frame if not careful. Acceptable at low (512) and medium (1024), tight at high (2048). Measure during 1i.i implementation; if JS-side noise is too slow, switch to a pre-baked noise texture lookup (still JS but just array indexing).
- **2D Canvas2D `filter: blur` performance.** Widely supported but slow on some GPUs. If blur pass tanks FPS in 2D, fall back to a manual 3-tap box blur (cheaper but blockier).
- **Sprite hard-edges at depth.** 3D billboards intersecting scene geometry create hard edges. Soft depth fade shader technique is standard — sample the scene depth buffer, fade alpha as puff approaches geometry. Render graph dependency: needs depth access. If render graph not ready, skip soft depth (accept hard edges) and flag as deferred.

## Out of scope

- Physically-accurate smoke dynamics (Navier-Stokes, SPH) — curl noise is stylized and enough.
- Volumetric ray-marched smoke — explicitly rejected this session (see Context).
- Interaction with other effects (e.g., smoke blown away by water stream) — fun idea, separate spec.
- Audio (crackling fire / hiss) — separate feature.
- Stacking with other effects — tracked separately.
- User-adjustable lifetime slider — deliberately not exposed; palette owns lifetime.

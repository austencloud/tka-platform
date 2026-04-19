# Phase 2a — Effects Engine Unification Inventory

Audit date: 2026-04-19. Baseline for the migration described in `docs/superpowers/specs/2026-04-19-effects-engine-unification-design.md`.

## Legacy consumers of `3d/effects/state/effects-config-state.svelte.ts`

Full grep (`getEffectsConfigState` + import path):

- `src/lib/shared/3d/effects/EffectsLayer.svelte` — reads `configState.trails.*`, `configState.fire.*`, `configState.motion.*`.
- `src/lib/shared/3d/components/controls/EffectsSettingsPanel.svelte` — reads every branch of legacy config for the effect chip grid.

LED + Charcoal renderers (`EffectOrchestrator3D.svelte`) already read the unified state via `getEffectsConfigContext()` and resolve through `resolveLed3D` / `resolveCharcoal3D`. Bloom, Sparkles, Zap, Echo, Water, Bubbles, Petals in `EffectsLayer.svelte` are also unified.

## Per-performer scope (out of Phase 2)

`src/lib/shared/3d/state/performer-settings-types.ts` defines `EffectId`:

    "trails" | "fire" | "charcoal" | "led" | "electricity" | "sparkles" | "motion" | "bloom"

This diverges from canonical `EffectType` in `src/lib/shared/effects/domain/EffectsConfig.ts`:

- `electricity` needs to become `zap` (rename).
- `motion` drops out (Phase 2b moves it to `Scene3DRenderConfig`).
- Missing: `echo`, `water`, `bubbles`, `petals` (additions).

Aligning requires a localStorage migration for saved per-performer effect sets. Flag as **Phase 2.5**: do it after 2e lands, in its own branch, so the migration can be reverted cleanly if it breaks saved performer data.

## Legacy type deletions (Phase 2e)

In `src/lib/shared/3d/effects/types.ts` the following types are only referenced by the legacy state file — safe to delete in 2e:

- `TrailConfig`, `DEFAULT_TRAIL_CONFIG`
- `FireConfig`, `DEFAULT_FIRE_CONFIG`
- `SparkleConfig`, `DEFAULT_SPARKLE_CONFIG`
- `ElectricityConfig`, `DEFAULT_ELECTRICITY_CONFIG`
- `GlowConfig`, `DEFAULT_GLOW_CONFIG`
- `BloomConfig`, `MotionEffectsConfig` (defined in the legacy state file directly, disappear with it)

`effects-lab` and `video-trails` reference the string `TrailConfig` only as a method/variable name; the actual type is a local `TrailPointConfig`. No consumer impact.

Keep in `types.ts` (used by 2D + 3D):

- `TrackingMode`, `TrailStyle`, `TrailPoint`, `PropPositionHistory`
- `EffectConfig`, `ParticleConfig`, `AllEffectConfigs`, `DEFAULT_PARTICLE_CONFIG`
- `QualityTier`, `QualityTierConfig`, `TIER_CONFIGS`
- `PropId`, `TipPositionData3D`, `PropTipPositions3D`

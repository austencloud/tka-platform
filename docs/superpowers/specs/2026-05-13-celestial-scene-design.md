# Celestial Scene Design

**Date:** 2026-05-13
**Status:** Implemented

## Concept

Heaven counterpart to Ember (hell). Where Ember is fire, darkness, below — Celestial is light, clouds, above. Warm golden sunlight through volumetric clouds.

## Components

| Component | File | Purpose |
|-----------|------|---------|
| CelestialScene | `scenes/CelestialScene.svelte` | Main assembler |
| CloudDome | `scenes/celestial/CloudDome.svelte` | FBM noise cloud hemisphere (hero element) |
| GodRays | `scenes/celestial/GodRays.svelte` | Volumetric light shafts |
| CloudPlatform | `scenes/celestial/CloudPlatform.svelte` | Cloud-textured ground disc |
| CloudIslands | `scenes/celestial/CloudIslands.svelte` | Floating cloud blobs |
| CelestialPillars | `scenes/celestial/CelestialPillars.svelte` | Luminous translucent columns |

All components are in `src/lib/shared/3d/environments/`.

## Color Palette

| Element | Hex |
|---------|-----|
| Sky top | `#0a1a4a` |
| Sky mid | `#b89050` |
| Sky bottom | `#e8dcc8` |
| Cloud lit | `#ffffff` |
| Cloud shadow | `#8090c0` |
| God rays | `#ffcc66` |
| Platform glow | `#d4a050` |
| Motes | `#ffd080` |
| Fog | `#c8bca8` |

## BackgroundType Integration

`BackgroundType.CELESTIAL` does not yet exist in `@austencloud/backgrounds` (v0.2.0). Temporary workaround: string literal `"celestial"` cast to `BackgroundType` in Environment3D switch and ANIMATED_BACKGROUNDS list. Will be added to the package in 0.3.0.

## Config

`CelestialSceneConfig` and `createDefaultCelestialConfig()` in `scene-configs.ts`. All sub-configs are Scene Lab-compatible (reactive uniforms via `$effect`).

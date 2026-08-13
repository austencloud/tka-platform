# Bloom 3D: Kinetic Optics

**Date:** 2026-08-11  
**Status:** Approved, optical-archetype revision in implementation  
**Surface:** 3D sequence viewer, coven stages, museum stations, effect-grid and effect-tuner harnesses

## Decision

Replace the four per-tip radial sprites with one scene-batched optical renderer.
Bloom must read as captured light under motion, not as colored circles attached
to prop tips.

The 2026-08-12 revision separates the live source from scattered light. The
hot center is a stable, single-frame source controlled by `coreStrength`.
Afterglow stores only the colored halo and motion streak. It never stores the
white core, diffraction spikes, or chromatic fringe. This prevents slow turns,
crossings, and repeated poses from stacking into a white flash.

The four presets are optical archetypes, not nearby parameter samples:

| Preset      | Dominant image                                         |
| ----------- | ------------------------------------------------------ |
| `Supernova` | White-hot sharp source with a violent diffraction star |
| `Comet`     | Warm velocity blade with the longest exposure trail    |
| `Prism`     | Tight white source with a short spectral motion trail  |
| `Halo`      | Broad, quiet aura with almost no visible white center  |

The existing effect intent remains authoritative. Version 34 adds
`coreStrength`, seeds it into old saves, and maps legacy Ring to Smooth. Every
current field must produce a visible 3D response:

| Intent                          | 3D response                                     |
| ------------------------------- | ----------------------------------------------- |
| `intensity`                     | HDR core energy and local-light strength        |
| `coreStrength`                  | White source energy, independent of halo spread |
| `radius`                        | Halo radius and optical footprint               |
| `colorMode`, `color`, `palette` | Source and spectral tint                        |
| `falloff`                       | Smooth or sharp halo shaping                    |
| `pulse`, `pulseRate`            | Time-based exposure modulation                  |
| `streak`                        | Camera-space velocity stretch                   |
| `spikes`                        | Diffraction-star energy                         |
| `chromatic`                     | Red and blue separation along motion            |
| `afterglow`                     | Bounded halo and streak history along the path  |

## Why this effect owns the work

Searches for `afterglow`, `streak`, `diffraction`, `chromatic`, `history`, and
`velocity` found reusable infrastructure but no existing 3D optical renderer:

- `TipPositionBridge3D` owns canonical tip position and velocity.
- `BoundedSourcePath3D` owns allocation-free source history.
- `SceneEffectsManager3D` owns scene-batched effect renderers.
- `DynamicLightManager` owns quality-capped effect lighting.
- `ScenePostProcessing` owns the one scene composer and its mipmapped bloom.

This change extends the scene-effects manager and composes those owners. The new
Bloom renderer owns only the optical response math, instance data, and shader.
It does not create another composer, trail system, or light pool abstraction.

## The image

A stationary tip carries a configurable source inside a shaped halo. Motion
pulls the colored light into an anamorphic blade aligned to projected velocity.
Diffraction rays flare around the live source. Afterglow leaves a fading record
of the colored halo and blade in space. The source itself is never accumulated.

Prism makes movement easier to read. A compact white source marks the current
prop tip. Motion pulls a short, narrow red-to-violet exposure behind the tip,
aligned to its real velocity. The bands keep a fixed order and fade before they
can cover the letter paths. A paused tip has no spectral projection at all.

The trail stays close to the prop and softens toward its tail. It must not read
as a beam, fan, cluster of RGB bulbs, or blurred billboard. Increasing prop
density reduces both exposure and trail footprint so formations remain legible
instead of becoming rainbow confetti.

Depth testing remains enabled, so the effect respects bodies, props, and scene
geometry. HDR source energy feeds the existing scene bloom pass on capable
tiers. The shader still carries the identity when post-processing is disabled.

The decomposition follows current glare research, which separates optical glare
into glow, starburst, shimmer, and streak components:

- https://openaccess.thecvf.com/content/ICCV2025/html/Zhu_PBFG_A_New_Physically-Based_Dataset_and_Removal_of_Lens_Flares_ICCV_2025_paper.html
- https://pmndrs.github.io/postprocessing/public/docs/class/src/effects/BloomEffect.js~BloomEffect.html
- https://pmndrs.github.io/postprocessing/public/docs/class/src/passes/MipmapBlurPass.js~MipmapBlurPass.html

Current renderer guidance adds three constraints:

- Unreal's convolution bloom treats kernel shape as the optical response and
  warns that excessive source emission can overwhelm the image. Bloom strength
  remains controllable independently from emissive power.
  https://dev.epicgames.com/documentation/unreal-engine/bloom-in-unreal-engine
- Three.js `UnrealBloomPass` separates strength, radius, and luminance threshold,
  then combines a mip chain under tone mapping. Radius and brightness are not
  one control.
  https://threejs.org/docs/pages/UnrealBloomPass.html
- Unity HDRP describes its Bloom as energy conserving and notes that threshold
  choices can break that property. Accumulation must therefore deposit bounded
  scatter energy instead of repeatedly adding the full live source.
  https://docs.unity3d.com/cn/Packages/com.unity.render-pipelines.high-definition%407.4/api/UnityEngine.Rendering.HighDefinition.Bloom.html

## Rendering contract

`BloomRenderer3D` receives stable `BloomTipSource3D` packets from every rig. One
instanced quad pool draws live sources and exposure-history samples across the
scene. Source count changes instance count, not draw-call count.

The vertex shader projects tip velocity through the active camera and rotates
the quad in view space. The fragment shader composes the halo, hot core,
velocity blade, diffraction rays, and source-anchored spectral trail.
Historical instances use the same material with zero core, zero spikes, and
zero dispersion.

Brightness is divided by the square root of active prop-pair count. This keeps a
single performer vivid without allowing mirrored tunnels or multi-performer
scenes to clip into a white sheet.

The renderer keeps one bounded path per stable source ID. It clears histories
on source removal, sequence reset, and discontinuous movement. Pausing freezes
position while pulse time continues, matching the current Bloom behavior.

## Quality tiers

| Tier   | Live optics                    | History     | Lighting                     | Scene bloom          |
| ------ | ------------------------------ | ----------- | ---------------------------- | -------------------- |
| High   | Full                           | Long, dense | Two pooled prop lights       | Existing mip bloom   |
| Medium | Full                           | Shorter     | Two lower-energy prop lights | Existing mip bloom   |
| Low    | Full identity, reduced samples | Short       | Off                          | Shader fallback only |

Quality changes may reduce retained samples and light work. They must not remove
streaks, spikes, dispersion, or the selected falloff.

## Scope

Create:

- `src/lib/shared/3d/effects/bloom/bloom-optics-3d.ts`
- `src/lib/shared/3d/effects/bloom/bloom-material-3d.ts`
- `src/lib/shared/3d/effects/bloom/bloom-renderer-3d.ts`
- `tests/unit/3d-effects/bloom-optics-3d.test.ts`

Extend:

- `scene-effect-source-3d.ts`
- `scene-effects-manager-3d.ts`
- `EffectOrchestrator3D.svelte`
- `EffectsLayer.svelte`
- `webgl3d-types.ts`
- `webgl3d-translator.ts`
- focused scene-effects tests

Retire:

- `post-processing/BloomBillboard3D.svelte`

## Proof gates

Automated proof covers optical response math, color resolution, source-count
normalization, history bounds, discontinuity clearing, quality budgets, and all
intent fields reaching the 3D renderer.

Runtime proof uses focused Bloom in `/test/effect-grid` at the one, two, and six
overlay density gates. The 3D harness is authoritative here; the effect tuner is
a Canvas2D surface. Frames are checked at 1920x1080, 2560x1440, 3840x2160,
1440x900, 820x1180, 960x412, and 375x667. The pass also records console errors.
Automated proof compares the complete optical signatures of Supernova, Comet,
Prism, and Halo and enforces the single-batch draw contract.

Acceptance requires:

- Supernova, Comet, Prism, and Halo remain visibly distinct in 3D.
- Every advanced Bloom slider causes an observable change.
- Fast motion reads as optical exposure instead of a trail tube.
- The source remains legible without post-processing on the low tier.
- Brightness survives one, two, and six overlaid rigs without clipping.
- Bloom contributes one batched draw call regardless of rig count.
- A stationary or reversing tip does not brighten because it revisits the same
  pixel or world position.
- Each preset has one dominant optical dimension that no other preset matches.
- Prism has one visible white origin and one short red-to-violet trail per
  moving tip.
- Prism has no stationary spectrum, beam, fan, dark sprite seam, isolated RGB
  blobs, hue cycling, or pulse.
- Prism follows tip velocity and leaves the notation unobscured when paused.
- Prism remains readable at one, two, six, and eight-performer densities.

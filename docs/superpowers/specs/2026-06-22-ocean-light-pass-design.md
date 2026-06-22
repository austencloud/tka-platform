# Ocean Scene Light Pass — Design

**Date:** 2026-06-22
**Goal:** Flip the flat-lit 3D ocean scene to a cinematic "moody mid-depth" underwater look by re-introducing "light through water" — without the full-screen fog/blur that got the old volumetric god rays and post-process refraction caustics cut.

## Context

A 4-dimension audit (lighting, water optics, fauna, perf) found the scene's hard parts already strong (GPGPU boids with panic-cascade, verlet jellyfish, Gerstner surface + Snell window) but let down by **light** and **density**. The two main underwater light cues had just been removed for reading as haze. This spec covers **light only**; density/life/perf-governor are separate specs.

Two prior removals — do NOT re-add as-was:
- Volumetric god rays (`three-good-godrays` GodraysPass) — read as full-screen fog.
- Post-process refraction caustics (`RefractionCausticsEffect`) — read as blur. Files deleted.

## Design decisions (locked)

- **Mood:** moody mid-depth (~15-25m). Deep blue-teal grade, soft caustics, one coherent angled sun, gentle shafts, fog dissolving distance into blue.
- **Shafts:** world-anchored billboard geometry (upgrade existing `GodRayShafts.svelte`), NOT a screen-space pass. Discrete world columns physically cannot become a screen haze.
- **No-fog guardrail (acceptance bar):** every light cue either lands on world geometry or IS discrete world geometry. Zero full-screen low-frequency passes. Caustics depth-fade out of mid-water.

## One coherent sun

All cues agree on a single sun vector — the existing directional light at `[10, 30, -20]` (`OceanRuntimeSystems.svelte:57`) — and one warm-white sun color `#ffffdd` (already the Snell-window disc color). Define both once and thread them to every unit below.

## Units

### Unit 1 — IBL / ambient shape (`runtime/OceanRuntimeSystems.svelte`)
- Replace the flat `AmbientLight` (intensity 0.15) with a `HemisphereLight`: sky `#3a6b7a` (teal) / ground `#0a1a14` (dark), low intensity, for top-down gradient fill that gives form to the seabed/flora.
- Assign `scene.environment` to a cheap procedural dark-teal environment (three `PMREMGenerator` from a `RoomEnvironment`, or `@threlte/extras` `<Environment>`). This activates `mat.envMapIntensity = 0.3` already set on every material (`FloraInstances.svelte:185`) — currently a no-op because `scene.environment` is null — giving real fresnel / spec breakup ("wet" coral).
- Keep the dim directional (sun aim) and the two warm torches.

### Unit 2 — Seabed caustics (NEW `runtime/atmosphere/seabed-caustics.ts`) — headline cue
- `patchCausticsMaterial(mat, uniforms)` helper mirroring `patchSwayMaterial` (`FloraInstances.svelte:84-150`): `onBeforeCompile` injects the existing `voronoi-caustic.frag` voronoi function into the fragment shader.
- Modulate diffuse + a touch of emissive by **world-XZ projected along the sun direction** + animated time, so caustics drift with the sun, not the camera (avoids the screen-space "swim" tell).
- **Soft** intensity (moody target). **Depth-fade by world-Y**: strongest at the seabed, gone by mid-water — guarantees it never becomes a screen-wide wash.
- Shared uniforms: `uTime` (driven from a single clock), `uSunDir`, `uCausticStrength`, `uGroundY`, `uCausticScale`, `uCausticColor`.
- Applied by traversing BOTH the seabed GLB (in `OceanScene.svelte`, the `$environmentGlb.scene`) and flora/structures (`FloraInstances.enhanceMaterials`). Light lands on everything near the floor, not just the sand.
- Fulfills the comment that has been lying since the old flat caustics plane was cut (`AtmosphereSystem.svelte:16-17`).
- **Reuse:** `voronoi-caustic.frag` (currently orphaned), the `onBeforeCompile` patch pattern from `patchSwayMaterial`.

### Unit 3 — Blue depth grade (`OceanScene.svelte` + `effects/post-processing/ScenePostProcessing.svelte`)
- Fog: `#0d0d10` → deep blue-teal `#0a2438` (`OceanScene.svelte:87`) so distance dissolves into water, not black void. Keep `FogExp2` density ~0.012, tune live.
- Absorption: raise coeffs off their near-zero bug values `0.02/0.005/0.001` to visible Beer-Lambert `~0.14/0.05/0.025` (`ScenePostProcessing.svelte:96-99`) so red attenuates with depth. R ≫ G ≫ B. Tune live.

### Unit 4 — World-anchored shafts (`runtime/atmosphere/GodRayShafts.svelte`)
- Tilt the billboard shaft instances to the shared sun direction (currently vertical + random).
- Anchor shaft tops to the water plane Y (`groundY + 12`, matching `WaterSurface.svelte:16`).
- Tint to the shared sun color `#ffffdd` (currently `#b8d8e8`).
- Gentle intensity (moody). Keep the existing instanced-billboard primitive + tier gating (`enableGodRays`); only change transform + uniforms.

### Unit 5 — Sun coherence (`shaders/water/snell-window.frag` / `WaterSurface.svelte`)
- The visible sun disc already exists in the Snell window (`snell-window.frag:74-77`). Align its screen position + color to the shared sun vector so disc + shafts + directional fill + caustic drift all point at one sun.

## Dev A/B toggles
Extend `quality/ocean-debug-toggles.svelte.ts` + `components/controls/DevToolsPopover.svelte` (Ocean FX row) with a toggle per new cue: `caustics`, `godRayShafts`, `ibl`. Same in-memory `$state` pattern as the current `sway` / `underwaterDistortion` toggles, so any one cue can be isolated live to confirm it's the source of an observed change (the workflow that diagnosed the sway/fog issues).

## Cleanup bundled
- Remove or fulfill the false `seabed-caustics.ts` comment (`AtmosphereSystem.svelte:16-17`) — now fulfilled.
- `godraysLightStore` (`godrays-light-store.svelte.ts`) is write-only orphaned (written `OceanRuntimeSystems.svelte:45`, read by nobody since the volumetric pass was cut). Delete the write + the store, OR leave a note; not load-bearing for this spec — delete to keep the tree clean.

## Out of scope (separate specs)
- Fish density / `maxFishCount` wiring (audit #6)
- Floor-dwellers + megafauna (audit #7, #8)
- FPS governor / adaptive quality (audit #10)
- `UnderwaterDistortion` — verdict KILL from ship path (fakes depth off screen-Y); leave the dev toggle, never default-on.

## Acceptance
1. `npm run check` green.
2. Visual (user-confirmed on 5173): seabed shows soft moving caustics that fade out by mid-water; coral reads "wet" (fresnel) not flat; distance dissolves to blue not black; light shafts angle toward one sun aligned with the surface sun disc; NO full-screen haze.
3. Each new cue isolatable via its Ocean FX dev toggle.

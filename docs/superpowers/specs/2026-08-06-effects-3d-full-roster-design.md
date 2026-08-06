# Full 3D Effect Roster Design

**Date:** 2026-08-06  
**Status:** Approved for implementation  
**Scope:** Sequence Viewer 3D effect selection and native render parity

## Problem

The shared effect registry defines sixteen selectable effects, but the 3D
settings panel filters that registry through a stale four-effect allowlist.
Twelve effects already have live 3D render paths. Ink, Silk, Animal, and Pulse
have canonical intent, presets, palettes, and 2D renderers, but no 3D renderer.
Exposing all sixteen without implementing those four would leave selectable
no-ops, so surface parity and render parity must ship together.

## Outcome

- The 3D picker renders the canonical `EFFECTS` registry in its stable order.
- Motion remains available as a separate scene modifier and is not counted as
  one of the sixteen effects.
- Ink, Silk, Animal, and Pulse render in every scene root that installs the
  scene-effects coordinator.
- The four new renderers honor the shared intent, palette, tracking, and
  advanced fields used by 2D.
- The scene-level batching model remains intact: particles and repeated
  primitives use instancing; changing trails use fixed dynamic GPU buffers or
  bounded histories rather than per-frame geometry replacement.

## Architecture

`EffectOrchestrator3D` resolves the four intents through the WebGL translator,
publishes stable world-space tip sources, and includes the current animation
step for Pulse beat triggers. `SceneEffectsManager3D` partitions those sources
and advances one renderer of each type per scene.

### Ink

Ink stores a bounded stroke history per source. Instanced oriented segments
render the pigment core and feathered edge. Stroke radius decreases with tip
speed to preserve the brush-lift behavior. A bounded instanced droplet pool
uses viscosity and splatter intensity for breakup and velocity spikes.

### Silk

Silk stores a bounded lifetime-based path per source. Instanced thin ribbon
segments and edge rails render one continuous strip. Width responds to speed
through tautness, while a deterministic travelling displacement applies
flutter without allocating replacement geometry.

### Animal

Animal stores a spatial path per source and samples it at fixed arc-length.
Rotation-minimizing frames orient overlapping ellipsoids along that spine, so
eyes, scales, feet, crest, and wings remain attached through straight runs and
inflections. A bright offset ridge preserves the silhouette in dark scenes.
The head stays attached to the tracked prop tip, the body length is stable, and
two-axis slither grows from head to tail. Snake has paired scales and a timed
forked tongue. Dragon adds horns, whiskers, a dorsal crest, and winglets.
Caterpillar uses a heavier bead profile with antennae and animated walking
legs. Looping or scrubbing backward clears the old history before sampling the
new pose. All anatomy stays inside four fixed-capacity instanced pools.

### Pulse

Pulse uses a fixed ring pool rendered by instanced billboard geometry. Beat,
velocity, and continuous triggers share the 2D timing semantics. Style,
palette, color mode, reach, lifetime, thickness, velocity response,
asymmetry, chromatic fringe, flash, and harmonics all affect the 3D result.

## Performance Contract

- No Svelte component per particle, ring, ribbon segment, or animal segment.
- No new `BufferGeometry` or material inside an update loop.
- Every pool has a fixed capacity and deterministic overwrite behavior.
- Source histories are bounded and removed after their visible lifetime.
- Empty pools have a draw count of zero.

This follows current Three.js guidance: repeated geometry uses `InstancedMesh`,
and frequently changing geometry uses stable `BufferAttribute` storage marked
for dynamic drawing with an explicit draw range.

## Files

- Canonical picker and control contract:
  - `src/lib/shared/3d/components/controls/EffectsSettingsPanel.svelte`
  - `src/lib/shared/effects/domain/effect-control-manifest.ts`
  - `src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts`
- Renderer contracts and orchestration:
  - `src/lib/shared/effects/translators/webgl3d-types.ts`
  - `src/lib/shared/effects/translators/webgl3d-translator.ts`
  - `src/lib/shared/3d/effects/EffectOrchestrator3D.svelte`
  - `src/lib/shared/3d/effects/scene-effects/scene-effect-source-3d.ts`
  - `src/lib/shared/3d/effects/scene-effects/scene-effects-manager-3d.ts`
- New scene renderers under `src/lib/shared/3d/effects/{ink,silk,animal,pulse}/`.
- Focused unit and batching-contract tests under `tests/unit/3d-effects/` and
  `tests/unit/effects/`.

## Risks

- Transparent geometry can create overdraw. Capacities stay bounded, materials
  disable depth writes, and ornamental layers remain few.
- Long-lived paths can leak state when an effect changes. Renderers age absent
  sources and prune histories after their last visible sample.
- Beat triggers can duplicate across tips or frames. State is keyed by stable
  source ID and beat interval index.
- A canonical picker can drift again if another allowlist appears. Tests assert
  the 3D panel maps `EFFECTS` directly and that all sixteen have control rows.

## Verification

1. Focused translator, renderer, manager, registry, and panel contract tests.
2. Project TypeScript and Svelte validation with no new diagnostics.
3. Runtime effect-grid inspection proving all sixteen cells render, with the
   four new effects visibly distinct.
4. Sequence Viewer inspection proving the 3D picker shows the same sixteen
   effects in the same order and that Motion is separate.
5. Runtime WebGL profile proving stable geometry/texture counts and acceptable
   frame rate after all effects have been active.

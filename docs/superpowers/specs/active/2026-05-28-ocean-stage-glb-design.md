# Ocean Performer Stage via GLB — Design

**Date:** 2026-05-28
**Status:** Approved (brainstorm), ready for implementation
**Scope:** Restore the performer stage under the ocean scene as an optimized GLB, loaded through a new reusable `GltfAsset` primitive. The swappable whole-environment registry is explicitly **deferred** to a follow-on spec.

## Problem

The ocean scene renders the performer on bare seabed. Two stages were authored in `blender/ocean_scene.blend` as `Stage_*`-prefixed objects (a mossy sunken ship and a green glowing cracked dais), but **every** export script skips the `Stage_` prefix:

- `scripts/blender-export-ocean-full.py:27`
- `scripts/blender-export-flora-scene.py:25`
- `scripts/blender-export-flora-scene-lean.py:29`
- `scripts/blender-export-placements.py:61`

So the stages never left Blender. The chosen asset for the ocean is the **green glowing cracked dais**.

This is the first asset built end-to-end under the Blender-first policy
(`.claude/rules/blender-first-3d-scenes.md`). It also creates the minimal,
reusable GLB-loading primitive the future environment registry will sit on,
avoiding a second loader rewrite.

## Non-goals

- The data-driven swappable-environment registry (separate spec).
- Migrating other procedural scenes (Forest/Autumn/etc.) to GLB.
- The mossy ship stage (may be exported later for swap; not wired now).

## Architecture

Three units, each one job:

1. **Parameterized Blender exporter** — produce the stage GLB from the existing `.blend`.
2. **`GltfAsset.svelte`** — a reusable component that loads one optimized GLB, reports load progress, and disposes cleanly. The minimal loader.
3. **`OceanStage.svelte`** — ocean-specific placement: consumes `GltfAsset`, grounds the dais under the performer.

### 1. Export pipeline

**`scripts/blender-export-glb.py`** (new, parameterized — supersedes clone-per-scene):
- Reads args after `--`: `--include <prefix>` (whitelist: select only objects whose name starts with the prefix), `--output <path>`, and `--list` (print every mesh object name and exit, no export).
- Without `--include`, falls back to the existing SKIP_PREFIXES behavior (so it can also do the ocean full export).
- Export settings mirror `blender-export-ocean-full.py`: `export_yup=True`, textures, normals, Draco level 6.

Steps:
1. `blender --background blender/ocean_scene.blend --python scripts/blender-export-glb.py -- --list`
   → identify the green dais's exact `Stage_*` object name(s).
2. `blender --background blender/ocean_scene.blend --python scripts/blender-export-glb.py -- --include <Stage_GreenDais name> --output static/models/ocean/stage_raw.glb`
3. **`scripts/optimize-stage-glb.mjs`** (clone of `optimize-ocean-glb.mjs`, new INPUT/OUTPUT): `gltf-transform optimize` → `static/models/ocean/stage.glb`.

Blender 5.0 is installed at `C:/Program Files/Blender Foundation/Blender 5.0/blender.exe`, so the export runs headless in-session for verification.

### 2. `GltfAsset.svelte`

Path: `src/lib/shared/3d/environments/primitives/GltfAsset.svelte` (dir exists).
Generalized from the proven `FloraInstances.svelte` loader (reuse, not hand-roll).

Props:
- `url: string`
- `meshopt = true` — attach `MeshoptDecoder`
- `draco = false` — attach `DRACOLoader` with `setDecoderPath("/draco/")` (decoders confirmed present in `static/draco/`)
- `position?`, `rotation?`, `scale?` — applied to a wrapping `<T.Group>`
- `progressFeatureKey?: string` — when set, reports to the scene-feature context
- `onReady?: (scene: Group) => void`, `onProgress?: (fraction: number) => void`

Behavior:
- Builds a `GLTFLoader`, attaches decoders per flags, loads `url` with the `onProgress` callback reporting real `loaded/total`.
- Renders `<T is={gltf.scene} />` inside the transform group.
- On `progressFeatureKey`: calls `reportProgress(key, fraction)` during load and `reportReady(key)` on completion (monotonic guard already in `scene-feature-state.svelte.ts`).
- On unmount: traverse + dispose geometries, materials, and textures; cancel in-flight load.

### 3. `OceanStage.svelte`

Path: `src/lib/shared/3d/environments/scenes/ocean/runtime/OceanStage.svelte`.
Rendered inside `OceanRuntimeSystems.svelte`.

- Renders `<GltfAsset url="/models/ocean/stage.glb" draco progressFeatureKey="stage" onReady={ground} />`.
- **Grounding:** on `onReady`, compute the loaded scene's `Box3`; offset the group's `y` so the dais **top** sits at `userProportionsState.groundY` (the performer foot plane). Dais body sinks into the sand; performer stands on the deck. No performer reposition.
- Horizontal: centered at origin; `stageZOffset` honored if passed (matches other scenes' convention).

### Scene-feature registration

Add a `stage` feature key to `scene-feature-registry.ts`: `requiresAsyncLoad: true`, `defaultEnabled: true`. The loading curtain's `readyProgress` then averages `environment` + `stage`, so the curtain waits for the dais and the bar reflects it. (A user-facing show/hide toggle is optional and out of scope.)

## Data flow

```
ocean_scene.blend (Stage_ green dais)
  → blender-export-glb.py --include Stage_…  → stage_raw.glb
  → optimize-stage-glb.mjs                   → static/models/ocean/stage.glb
  → (runtime) OceanRuntimeSystems
      → OceanStage
          → GltfAsset (GLTFLoader + meshopt + draco)
              → reportProgress/reportReady("stage")  → SceneLoadingCurtain
              → onReady → Box3 ground offset → <T is={gltf.scene}>
```

## Error handling

- **Load failure is soft:** `GltfAsset` catches the loader error, logs it, calls `reportReady(key)` (curtain never hangs), and renders nothing. The ocean scene remains fully usable without the stage.
- **Glow imports dark** (if the green glow was a Blender light, not an emissive material): augment at load — boost the dais material emissive and lean on the existing bloom/halation. No new effect slot (per `effects-earn-their-slot.md`).
- **Draco path:** decoders already at `static/draco/`; no new asset needed.

## Testing / verification

- `npm run check` green (full pass before claiming done).
- Blender export run headless in-session; assert `stage.glb` exists and is a sane size; `gltf-transform inspect` for tri/texture budget.
- Runtime (needs a browser session the user owns): dais renders under the performer, glows, sits at foot level, and the loading bar counts the `stage` feature without bouncing.

## Open items resolved during implementation

- Exact `Stage_*` object name → resolved by the `--list` pass.
- Glow mechanism (emissive vs light) → inspected in the exported GLB; augment only if dark.

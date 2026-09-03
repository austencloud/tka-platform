# Blender-First 3D Scenes — ENFORCED

## The Problem This Solves

TKA's 3D environments were historically hand-authored as Threlte/Three.js
primitive meshes (e.g. `src/lib/shared/3d/components/Stage3D.svelte` builds a
whole stage out of `BoxGeometry`/`CylinderGeometry`). That approach does not
scale, fights the "never hand-roll" rule, and can't reach the visual bar the
ocean scene now sets. The ocean scene proved the alternative: author in
Blender, export an optimized GLB, load it through Threlte.

Austen's directive (2026-05-28): **the way we construct 3D scenes going forward
is in Blender.** New environments are modeled/composed in a `.blend`, exported
to GLB, optimized, and loaded — not assembled from procedural primitives in
Svelte.

## The Rule

Before building or speccing ANY new 3D environment, stage, prop set, or scene
geometry:

1. **Author it in Blender.** The deliverable is a `.blend` → optimized `.glb`,
   not a `*.svelte` full of `<T.Mesh>` + `BoxGeometry`.
2. **Run the established pipeline** (below). Do not invent a new export path.
3. **Procedural Threlte meshes are reserved for** dynamic/parametric things that
   genuinely can't be baked: GPGPU fauna, shader-driven water, particle systems,
   runtime-sized layout helpers. Static set dressing (terrain, structures,
   stages, foliage, rocks) is Blender → GLB.

Existing procedural scenes (`Stage3D.svelte`, Forest/Autumn/Cosmic/etc.) are
legacy. Don't extend them with more hand-built geometry; when one needs real
work, migrate it to a GLB.

## The Pipeline (canonical, ocean is the reference impl)

**Export** (`scripts/`):
1. `blender --background <scene>.blend --python scripts/blender-export-ocean-full.py`
   — selects MESH objects (SKIP_PREFIXES for runtime-owned objects like
   `Water`/`Torch`/`Light`), applies Z-up→Y-up, writes `*_raw.glb`. Clone +
   reparameterize `output_path`/SKIP_PREFIXES per scene.
2. `node scripts/optimize-ocean-glb.mjs` — `gltf-transform optimize`: resize
   textures→1024, WebP, dedup, GPU-instance, weld, simplify 0.65, Draco, prune.
   Clone with new INPUT/OUTPUT per scene.

**Place:** drop the optimized GLB under `static/models/<scene>/` (SvelteKit
serves `static/` at `/`, so it loads from `/models/<scene>/`). Keep
`static/` canonical; don't hand-maintain a `public/` copy.

**Load:** `useGltf("/models/<scene>/<scene>.glb", { meshoptDecoder: MeshoptDecoder })`
(see `scenes/ocean/OceanScene.svelte`). Draco-compressed GLBs additionally need
the decoder at `static/draco/` (see `FloraInstances.svelte`). Report load via
the scene-feature context (`reportProgress`/`reportReady`, feature key in
`scene-features/domain/scene-feature-registry.ts`, `requiresAsyncLoad: true`).

**Register:** add the scene to the selection seam in
`environments/components/Environment3D.svelte`. (Today that is a hardcoded
`switch(BackgroundType)`; `BackgroundType` is an enum in the external
`@austencloud/backgrounds` package. A data-driven GLB-environment registry is
the known next step — see Gaps.)

## Gaps (known, flag before relying on them)

- **No generic GLB-environment loader.** Each scene still requires editing the
  `Environment3D.svelte` switch and the external `@austencloud/backgrounds`
  enum. A registry-driven drop-in loader is the highest-leverage unlock for
  "integrate any open-source scene" — propose it before hand-wiring a 3rd GLB
  scene.
- **Export scripts are ocean-named** with hardcoded paths/prefixes — clone and
  parameterize; don't assume they're generic yet.
- **`blender-to-placements.cjs` / `placements.ts` is a dead path** (transforms
  are baked into the GLB world transform). Don't wire it for new scenes.

## Sourcing external scenes

CC0 is the only ship-clean license (Poly Haven HDRIs + scenes, Quaternius,
Kenney are CC0 and GLB-ready). CC-BY needs attribution; CC-BY-NC/ND are off
limits for the commercial app. Any non-low-poly external asset still owes a
Blender pass (decimate, bake, KTX2, re-origin) before it meets the mobile
WebGL budget — route it through the pipeline above. That budget is VRAM and poly
count. KTX2 is **not** a load-time fix: texture decode plus upload measured 179 ms
of a 7,700 ms scene boot (`docs/architecture/scene-boot-cost.md`).

## Related

- `never-hand-roll.md` — don't rebuild what exists / what a tool provides
- `research-before-building.md` — check the framework/ecosystem first
- `effects-earn-their-slot.md` — runtime visual effects (the procedural exception)

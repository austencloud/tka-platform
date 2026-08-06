# Autumn Living Forest Floor

## Outcome

Make the Autumn environment read at performer scale instead of like an empty
arena. The performer remains at the canonical body scale. Human-scale ground
detail, a closer ecological edge, and a framed sky provide the missing visual
reference.

## Approved scope

Austen approved this pass on 2026-08-06 after reviewing the rebuilt Autumn
scene. The pass includes:

- a new generated forest-floor material;
- a protected performance footprint surrounded by a closer comfort ring;
- fixed leaf strata, sticks, moss, shrubs, saplings, and mushroom fairy rings;
- multi-blade grass with deterministic GPU wind and quality tiers;
- the existing moon, starfield, and firefly systems adapted to Autumn;
- one Meshy-authored perched owl with restrained idle motion;
- full export, optimization, collision checks, performance evidence, and visual
  verification.

Worms, beetles, and animated tree roots are excluded from this pass. Their
screen contribution is too small or too noisy for the current camera distance.

## Reuse decision

- **Extending**
  `src/lib/shared/3d/environments/scenes/ocean/authored/FloraInstances.svelte`:
  it already proves rooted, two-octave material sway. Autumn needs UV-based
  blade weights and quality-selected Blender meshes, so the ocean component
  cannot be imported directly.
- **Reusing**
  `src/lib/shared/3d/environments/primitives/MoonBillboard.svelte` and
  `Starfield.svelte`.
- **Reusing**
  `src/lib/shared/3d/environments/primitives/FallingParticles.svelte` through
  `AutumnParticles.svelte` for leaves and fireflies.
- **Extending** `scripts/build-autumn-environment.py`, the existing Blender
  source-of-truth pipeline. Static set dressing remains in Blender.
- **Creating** an Autumn wind controller because the existing ocean controller
  is coupled to ocean GLB loading, AABB plant classification, caustics, and
  ocean quality state.

The external implementation references are Three.js `InstancedMesh` and
`InstancedBufferAttribute`, Blender Geometry Nodes point distribution, and the
Meshy PBR retexture API. The runtime implementation will prefer the existing
project shader pattern over a new dependency.

## Art direction

The floor should read as a layered, damp autumn woodland at dusk:

- packed earth remains legible inside the six-meter performance footprint;
- leaf duff becomes denser toward roots, logs, and the outer ecology;
- dark damp soil and moss gather near the pond;
- grass appears in coherent colonies, not uniform random dots;
- mushroom rings feel intentional and remain outside the performance area;
- one low moon is framed by the rear opening rather than centered like a logo;
- the owl is a quiet silhouette, not a mascot.

## Static authoring plan

`scripts/build-autumn-environment.py` remains the only scene-authoring source.
It will add:

1. A generated Autumn floor albedo and aligned material maps under
   `static/textures/autumn-floor/`.
2. Three grass density objects: `Autumn_Grass_Base`,
   `Autumn_Grass_Medium`, and `Autumn_Grass_High`. Each clump contains several
   blade ribbons with root-to-tip UVs for runtime bending.
3. Leaf carpets and twig drifts with at least two vertical strata so the floor
   does not read as a decal.
4. Two asymmetric mushroom fairy rings built from the existing CC0 mushroom
   models.
5. Small shrubs and saplings between the protected clearing and the hero-tree
   ring.
6. A named owl perch locator. The Meshy owl is imported only after its scale,
   origin, topology, and material pass inspection.

All placement functions use the existing pond, tree, rock, log, and performance
masks. The validator will fail the build for any forbidden placement.

## Runtime plan

- Add an Autumn wind component that receives the loaded environment scene,
  reveals the appropriate grass tiers, patches only the named grass material,
  and updates one time uniform per frame.
- Use UV height for rooted bending and world XZ position for deterministic
  phase. No per-blade CPU updates and no runtime physics simulation.
- Add explicit Autumn moon and starfield configurations by reusing the existing
  primitives.
- Reshape firefly distribution around the pond, mushroom rings, and outer
  comfort ring rather than one large rectangular volume.
- Mount the owl as authored scenery. Any idle motion must remain a small,
  deterministic transform with reduced-motion support.

## Performance budget

- One draw call per visible grass tier after optimization, subject to exporter
  behavior confirmed by GLB inspection.
- Target grass densities: roughly 500 clumps on low, 1,100 on medium, and 2,000
  on high.
- Keep the optimized environment within a 12 MiB target. If the owl or new
  texture pushes past that, split the owl into an independently loaded GLB and
  resize texture maps before reducing visual density.
- No new shadow-casting grass, leaf-litter, particle, or insect geometry.
- No new JavaScript loop proportional to the blade count.

## Verification

1. Run the Blender ecology validator and record counts plus zero-collision
   output.
2. Render hero, floor close-up, pond, and reverse QA views from Blender.
3. Inspect the raw and optimized GLBs for size, draw calls, texture dimensions,
   extensions, and vertex counts.
4. Run focused tests with `tests/config/vitest.config.ts` for deterministic
   placement masks, quality counts, and tier visibility.
5. Run one permitted project check after the resource gates pass and filter its
   output for Autumn-owned files.
6. Verify the real runtime at 1920x1080, 2560x1440, 3840x2160, 1440x900,
   820x1180, 960x412, and 375x667 through one task-owned background tab.
7. Record fresh console output and frame statistics. The pass is not complete
   while one required viewport is still showing the loading veil.

## Handoff

The running handoff is
`docs/superpowers/specs/2026-08-06-autumn-living-forest-floor-handoff.md`.

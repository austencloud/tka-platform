# Autumn Asset Cohesion Plan

Date: 2026-08-09

## Objective

Lift Autumn's asset cohesion without replacing the scene or spending Meshy
credits indiscriminately. Preserve the authored composition, interaction
systems, environmental motion, and performance budgets.

## Baseline diagnosis

- Eight foreground hero trees reuse two detailed source meshes. Scale,
  rotation, and mirroring vary, but the largest branch and root silhouettes
  still repeat.
- Imported assets arrive from separate PBR pipelines. Hero trees, secondary
  trees, ferns, logs, the shack, owl, and Poly Haven rocks do not currently
  share one color and surface-response pass.
- Several generated organic assets still export emissive textures. They remain
  visible through fog and shadow differently from the procedural vegetation.
- The stage is the correct shared interaction surface, but the clearing rejects
  all leaf litter around it. That leaves a visibly clean boundary between the
  canonical stage and the forest floor.

## Approved implementation

1. Extend the Autumn builder's existing material-tuning owner across every
   imported organic and rock source. Rename materials by ecological role,
   remove unintended emission, set physically valid organic metalness, and
   establish roughness floors for untextured inputs.
2. Reuse the glTF factor-grading pattern already shipped by Ocean. Apply
   deterministic Autumn color factors and normal strengths after geometry
   optimization and before KTX2 compression. Do not bake replacement texture
   sets.
3. Add controlled anisotropic scale and small trunk lean to selected hero-tree
   placements. Keep shared mesh data and GPU instancing intact.
4. Reallocate part of the existing 1,800-leaf budget into irregular banks at
   the stage perimeter. Do not place litter on the performance surface or
   increase particle, material, or draw-call budgets.
5. Retain the current far-tree geometry. Fog-softened silhouettes do not need
   foreground mesh density.

## Acceptance gates

- Matched hero, depth, and settlement screenshots use the existing fixed camera
  presets before and after the change.
- Hero trees retain bark and canopy variation without self-lighting in shadow.
- Birch, larch, willow, fern, log, cabin, owl, and rocks occupy the same dusk
  value range without collapsing into one hue.
- The stage reads as placed within the clearing, while its directional colors
  and performer-safe top remain unchanged.
- The final GLB retains meshopt, KTX2, and GPU instancing. No PNG fallback is
  allowed.
- Builder collision checks remain at zero. Focused Autumn tests and project
  diagnostics remain green.
- Any asset-size or vertex-upload increase must be explained and accepted by a
  visible gain. Transform-only hero variation should add no unique tree mesh.

## Evidence locations

- Before frames:
  `C:\Users\Austen\AppData\Local\Temp\tka-autumn-cohesion\before-hero.png`,
  `before-depth.png`, and `before-settlement.png`.
- After frames use the same directory and camera names with the `after-`
  prefix. The matched settlement frame and the hero frame were captured. The
  in-app browser blocked the final depth screenshot under its URL security
  policy after a runtime reset, so no alternate-browser or raw-protocol bypass
  was attempted.

## Completion result

- Thirteen imported asset families now share one deterministic Autumn material
  grade. Their authored textures remain intact and no Meshy credits were spent.
- Hero-tree silhouette variation uses instance transforms only. The optimized
  scene retains GPU instancing and reports 563,936 uploaded vertices.
- The 96 stage-edge leaves were reallocated inside the existing 1,800-leaf
  budget. Builder collision checks remain at zero.
- The final runtime GLB is 17,736,324 bytes, 28,984 bytes smaller than the
  baseline. It retains meshopt and KTX2, with 46 KTX2 textures and no PNG
  fallback.
- All 18 focused Autumn tests, Python compilation, Node syntax checking, GLB
  inspection, the HTTPS route probe, and scoped whitespace validation passed.

## Open correction: cabin-lane continuity

The settlement view still shows the terrain treatment cutting across the cabin
lane. The route geometry reaches the shack, but several dark floor patches make
it read as disconnected slabs instead of one maintained path.

Evidence:
`C:\Users\Austen\AppData\Local\Temp\codex-clipboard-7de56384-5ac1-4cca-95c8-6d2f63127183.png`.

The correction must keep the lane continuously readable from the stage clearing
to the shack door in both the settlement and hero cameras. Path edges should
remain irregular and grounded; the fix must not turn the route into a bright,
uniform strip or raise it enough to cause visible intersections.

## Root-contact correction

`HeroTreeA_01`, the large stage-left tree in the reported close view, floated
above the shallow terrain roll after the silhouette lean was added. Its root
plate now sits 1.30m deeper without changing the shared mesh or the other hero
placements. The original 0.68m correction was rejected after a vertex-to-terrain
audit found the median low-root vertex still 11.5cm above grade. The revised
placement moves that median 48.8cm below grade and visibly seats the full root
collar. Visual evidence:
`C:\Users\Austen\AppData\Local\Temp\tka-autumn-evidence\autumn-tree-root-contact-1.30m-blender.png`.
The fixed review URL is `?view=rootContact&perf=1`. The HTTPS route returns 200;
the in-app browser rejected a fresh localhost tab under its client security
policy, so final visual proof came from the authored Blender source at the same
camera coordinates.

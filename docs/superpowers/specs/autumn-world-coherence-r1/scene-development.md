# Autumn World Coherence R1 production contract

**Status:** Implementation verified; final visual acceptance remains with Austen

**Scene ID:** `autumn-world-coherence-r1`

**Gate manifest:** `./scene-gates.json`

**Creative provenance:** Museum tracker session `zrcMZZ2cTirzQKeK2m21`, proposal
`7sEuyJVa9ufvYpcpdbi1`, and Austen's 2026-09-01 approval: "I'll take your
recommendation."

## Outcome

Autumn remains an enchanted, sculptural forest rather than becoming a generic
botanical demo. The authored Meshy hero grove keeps its twisted silhouettes,
expressive roots, pond, cabin, path, and dusk atmosphere. Normal exploration no
longer exposes an underground void. Inspectable tree tiers share one believable
forest language, hero roots meet the terrain through authored contact instead
of worst-case burial, and settlement props meet the visual quality of the grove.

## Authority ledger

| Concern              | Canonical owner                                              | Evidence path                                                                                                               | Current conflict                                                                               |
| -------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Approved direction   | Austen's current conversation and tracker proposal           | `7sEuyJVa9ufvYpcpdbi1`                                                                                                      | Supersedes the 2026-08-10 "do not change the authored image" delivery constraint for this pass |
| Spatial composition  | Deterministic Autumn builder                                 | `scripts/build-autumn-environment.py`                                                                                       | Layout is preserved except where an asset-tier collision must be removed                       |
| Tree source families | Autumn builder plus Forest botanical source contracts        | `scripts/build-autumn-environment.py`, `scripts/forest-tree-layout.json`, `scripts/forest-plantcatalog-bridge.json`         | Autumn's handmade far silhouettes do not match its hero and middle trees                       |
| Camera behavior      | Shared `OrbitControls` wrapper and environment review camera | `src/lib/shared/3d/components/OrbitControls.svelte`, `src/lib/shared/3d/environments/review/EnvironmentReviewCamera.svelte` | Review orbit has no terrain collision or recovery from a below-surface URL pose                |
| Runtime environment  | Autumn scene orchestrator                                    | `src/lib/shared/3d/environments/scenes/AutumnScene.svelte`                                                                  | None; keep its loading, quality, stage, and runtime-effect ownership                           |
| Delivery format      | Autumn optimizer and verifier                                | `scripts/optimize-autumn-environment.mjs`, `scripts/verify-autumn-environment-performance.mjs`                              | New visuals may not discard KTX2, meshopt, instancing, or the 20 MiB ceiling                   |

## Capability ownership

- **Orbit collision: extend.** `OrbitControls.svelte` already owns the
  `camera-controls` adapter. Expose the library's existing `colliderMeshes`
  capability there; do not create another orbit implementation.
- **Environment collision selection: create locally, then compose.** A pure
  scene-graph selector identifies authored camera-collision meshes by metadata.
  The review camera composes it with the shared controls. A second production
  consumer is required before promoting any scanning lifecycle into a service.
- **Terrain and ecology: extend.** `build-autumn-environment.py` remains the only
  owner of Autumn geometry, placement, grounding, materials, and Blender QA.
- **Botanical sources: reuse.** Reuse the conditioned PlantCatalog/Forest assets
  and their provenance. Do not invent a second tree generator.
- **Performance: reuse.** Keep the adaptive-quality, geometry-tier, shadow-role,
  environment transport, and standalone verifier owners unchanged.

## Baseline evidence

The approved source GLB before R1 is 18,189,772 bytes with 1,977,667 rendered
source triangles, 48 KTX2 textures, GPU instancing, and meshopt compression.
The four exported `HeroTreeA` placements carry grounding depths from 1.036 m to
1.430 m. Every one records exactly -0.140 m maximum root-envelope clearance,
proving the old algorithm optimized only against floating and had no over-burial
limit.

The visible quality-tier leaks are literal builder inputs:

- `FarLarch` is three stacked cones.
- `FarRed`, `FarGold`, `FarLarch`, and `FarSnag` are flat-shaded handmade sources
  reused across 53 placements, including an inspectable 35-45 m reverse grove.
- `Autumn_Rough_Bench_Seat` and its legs are boxes.
- Each stump seat is an 11-sided cone.

## Approved visual strategy

### Hero band: 0-35 m

Keep the Meshy hero trees and their supernatural silhouette. Replace the global
worst-case root-envelope sink with a bounded, central contact contract. A hero
may show lifted distal roots, but its trunk plate may not float. The measured
0.76 m automatic cap replaces the speculative 0.35 m design target: the central
plates of the approved source meshes need more depth to reach the uneven
authored terrain, while the exported 0.703 m maximum still cuts the pre-R1
maximum burial in half.

### Middle band: 25-100 m

Keep Autumn's textured birch, willow, larch, and snag where they remain
coherent. Introduce only botanical candidates that survive an Autumn-lighting
comparison and the delivery budget. Their material grade must join the existing
Autumn bark/canopy owner rather than carrying an isolated green daytime look.

### Far band: 80 m onward

Replace the cone/lobe silhouettes with aggressively reduced descendants of
approved textured or botanical source trees. The far tier may be cheap, but its
trunk proportions, crown breakup, and material values must descend from the
same families visible in the middle band.

### Roots and props

Expressive root plates remain on hero trees. Middle and far families use compact
trunk flares. The bench and stump seats become one hewn woodland furniture
family using Autumn wood/cut-face materials and irregular silhouettes.

## Implementation order

1. Mark the real Autumn terrain and apron as camera colliders.
2. Extend the shared controls wrapper with its library-owned collision input.
3. Recover below-surface review URL poses and prevent normal orbit from crossing
   collision geometry.
4. Replace worst-case root burial with bounded central contact and prove the
   resulting surface silhouette in Blender QA.
5. Build the tree comparison directly inside the deterministic Autumn builder.
6. Replace the rejected far families and settlement placeholders only after the
   comparison survives hero, reverse, human-height, world, and depth views.
7. Export, optimize, and run the standalone asset verifier.
8. Verify the scene both empty and with the production performer/effects graph.

## Implementation evidence

The final optimized GLB is 18,340,028 bytes (17.49 MiB), expands to 2,063,055
source triangles, and retains GPU instancing, meshopt compression, and 48/48
KTX2 textures. The far tree belt now shares four aggressively reduced textured
botanical descendants: Hero A at 2,647 triangles per source, Willow at 1,235,
Larch at 1,361, and Snag at 1,162. The old cone/lobe generator was removed.

The grounding verifier covers 103 tree placements and 909 central-root samples.
The seven Hero A/B placements now sink between 0.000 m and 0.703 m, compared
with 1.036-1.430 m for the four pre-R1 Hero A placements. The owl tree records
75% central contact at 0.355 m depth. The GLB also carries collision metadata
for both the living floor and rolling horizon, plus explicit split-log bench and
root-flared stump contracts.

Runtime review covered the default clearing, the reported high aerial failure,
the reported underground URL, settlement close-up, reverse/depth views, a
960x412 landscape viewport, and the production graph with three performers
using trail, fire, and LED effects. The restored underground camera was lifted
to 0.35 m above its local surface. The aerial view retains a visible rolling
ground signal beneath the distant tree belt and returns to complete fog before
the 1,024 m apron edge.

The production graph renders 2.497 million triangles in 303 draw calls. In the
shared debug Chrome, GPU P95 measured 7.36 ms at 1920x1080 and 8.10 ms at
3840x2160. The browser's debug RAF cadence was 30 Hz, so GPU timing is the
authoritative saturation signal; screenshot capture stalls were excluded from
these figures. A 960x412 production pass measured 4.04 ms GPU P95. The missing
pond-normal fetch was removed entirely and replaced with two deterministic,
seamless physical ripple normals generated in memory.

## Acceptance

- A standard review URL or orbit cannot leave the camera below the local Autumn
  terrain. An explicit debug/free-fly mode remains the only way to inspect the
  underside.
- No stacked-cone or flat-lobe tree is visible from the supported hero, walk,
  reverse, settlement, pond, world, or production cameras.
- No incompatible tree tiers physically intersect in the registered camera set.
- Hero trunk plates contact the ground, automatic sink never exceeds 0.76 m,
  the exported maximum stays at or below 0.703 m, and expressive roots remain
  visible above grade.
- The bench and stump seats no longer read as boxes or primitive cones at human
  height.
- The scene remains below 20 MiB, contains only KTX2 textures, retains meshopt
  and GPU instancing, and passes the standalone Autumn verifier.
- The production graph with performers/effects shows no console errors and no
  material frame-time regression against the captured baseline.
- Final evidence includes hero, walk, reverse, depth, settlement, pond, world,
  root-contact, and production-graph frames. The visual verdict is based on the
  frames, not on successful compilation.

## Known risks

- Raw PlantCatalog trees can make the grove botanically correct but visually
  generic. The comparison gate may reject them from the hero and middle bands.
- Alpha foliage can increase draw calls and overdraw faster than triangle count
  suggests. Runtime timing and draw calls decide, not asset-file size alone.
- A collider list containing every scene mesh would be expensive. Only authored
  ground surfaces may participate.
- Bounded root seating can reveal floating distal roots on steep local terrain.
  The correct response is a local contact treatment, not returning to unbounded
  whole-tree burial.

# Ember Broken Rift production contract

**Status:** Gate 4 Volcanic World R5 slice ready for review; approval unset

**Scene ID:** `ember-broken-rift`

**Gate manifest:** `./scene-gates.json`

**Creative provenance:** Museum trackers `C2tvT3lr69ss7EqvYknm`,
`OJGpjNddvANRvXMYt7sQ`, `inUhpQPs18g1o6HoKnDd`,
`j8jSJVcW6KGSbIur83Q8`, `MqaUVXWmMvvViGEOTCKX`,
`ZkW4K6AvovG7s4uXHFj3`, `wqUAKQMa79rTYDYa0N5m`,
`rn25Qau62kXyyOJpgm7Z`, `QRHbwRQLhM7Zn9LyYHOd`,
`gME4uHJawz9dtTlirRl8`, `kqMUPC5UpCHjj7ts9atQ`,
`5otAzYdNg5Wp5E27mgfo`, and `nu73zqvPJRxio4T2sWz7`.

## Outcome

Ember should stop reading as a ring of low-poly props around an orange stage.
The orbiting viewer should read a broad volcanic basin first, a banked and
crusted lava river moving through it second, and an asymmetrical Columnar
Furnace plus active vent in the far field. The performer remains the brightest
cool silhouette and has an unobstructed 4.5 m action radius.

Gate 5 extends the approved production slice into the complete visual
environment: a full asymmetric caldera perimeter, broken columnar-basalt
fields, buried gate talus, foreground obsidian parallax, and a restrained glow
basin. The performer still owns an unobstructed 4.5 m action radius, but the
viewer now finds authored geology in every orbit sector instead of an empty
front half.

The first production slice failed review because an existing Ocean Meshy model
defined the hero silhouette. Revision 2 keeps the approved shelf relationship
but gives the landmark an original, scene-authored silhouette. Three
Ember-specific Meshy candidates were auditioned. The blade and shard cluster
were rejected; the buttress survives only as buried surface support behind four
authored fault-crown plates. Gate 5 R4 removes that generated buttress entirely;
no generated candidate remains in the integrated runtime asset.

## Current regression boundary

Austen reopened the scene at Gate 3 on 2026-08-27 after the adversarial review.
Museum tracker item `rn25Qau62kXyyOJpgm7Z` supersedes the former Gate 6
acceptance recorded in `wqUAKQMa79rTYDYa0N5m`.

The regression preserves Gates 1 and 2: measured topology, the ten-camera
family, performer orientation, responsive stage behavior, and the unobstructed
4.5 m action radius remain authoritative. It invalidates the former registered
visual target, production slice, integrated room, and final acceptance. Austen
selected Columnar Furnace from the three registered Blender targets in museum
tracker item `QRHbwRQLhM7Zn9LyYHOd`. Gate 3 is approved. Austen authorized the
bounded production slice in tracker item `gME4uHJawz9dtTlirRl8`, corrected the
front-stage performer heading in `kqMUPC5UpCHjj7ts9atQ`, and authorized the
adversarial art revision in `5otAzYdNg5Wp5E27mgfo`. The volcanic-world
direction in `nu73zqvPJRxio4T2sWz7` expands that slice into a continuous basin
and open lava channel. Revision 5 is the current Gate 4 boundary. Gate 4 is
implemented and `ready-for-review`; Gate 5 remains pending.

## Authority ledger

| Concern                    | Canonical owner                  | Evidence path                                             | Current conflict                                                              |
| -------------------------- | -------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Creative direction         | Museum tracker                   | `C2tvT3lr69ss7EqvYknm`                                    | None                                                                          |
| Story canon                | Museum story bible               | `docs/museum/story-bible.md`                              | No Ember-specific story claim is introduced                                   |
| Room shell and transitions | Ember environment runtime        | `src/lib/shared/3d/environments/scenes/EmberScene.svelte` | This is an orbit environment, not a navigable museum room                     |
| Performer roster           | Viewer3D runtime                 | `src/routes/test/viewer-3d/Viewer3DWorkbench.svelte`      | No performer identity is changed                                              |
| TKA motion                 | Not applicable                   | `domainProofRequired: false` in `scene-gates.json`        | No letter, position, motion, or sequence fact is asserted                     |
| Selected sequence variants | Not applicable                   | `domainProofRequired: false` in `scene-gates.json`        | No sequence is selected                                                       |
| Spatial geometry           | Ember spatial direction contract | `scene-development.md`                                    | Direction E topology is authoritative; graybox meshes remain replaceable      |
| Blender output             | Ember Gate 4 production build    | `scripts/build-ember-production-slice.py`                 | None; the selected Columnar Furnace is built directly with no hero import     |
| Runtime behavior           | Existing Ember scene owner       | `src/lib/shared/3d/environments/scenes/EmberScene.svelte` | The selected slice composes with the existing loader, stage, and effects path |

## Claim ledger

| ID    | Class     | Statement                                                                                                                                   | Evidence or proposal source                        | Status   |
| ----- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | -------- |
| C-001 | literal   | Viewer3D gives Ember a 25 m maximum orbit distance.                                                                                         | `src/lib/shared/3d/camera/Viewer3DCamera.svelte`   | verified |
| C-002 | invention | A fractured gate anchors one sector while an asymmetric caldera perimeter visually encloses the full orbit outside the clear action radius. | `scene-development.md`, Gate 5 R4 review decisions | approved |
| C-003 | invention | Blue-black basalt and rough obsidian dominate; orange is confined to fissures and the banked, crusted river, with restrained mineral ochre. | `look-development.md`, Blackglass Mineral Rift     | approved |
| C-004 | invention | The production slice owns a clear 4.5 m action radius around the world origin.                                                              | `scene-development.md` shared comparison contract  | approved |

## Experience sentence

> The viewer orbits a performer on a cooled blackglass shelf, follows the
> diagonal live fault because localized heat and shelf edges pull the eye,
> witnesses the fractured basalt gate catch cold light against the ash-dark
> horizon, and can continue the orbit without a ring of props swallowing the
> silhouette.

## Gate 0: Evidence preflight

### Sources and conflicts

- Runtime shell: `EmberScene.svelte` and `ember-scene-config.ts`.
- Camera contract: the real Viewer3D orbit, with Ember capped at 25 m.
- Stage frame: playable surface at native local Y 0.5 before environment
  grounding offset.
- Creative authority: Direction E plus Blackglass Mineral Rift.
- Canon conflicts: none. No story or TKA-domain behavior is changed.

### Live motion proof

Not required. This slice changes environment geometry and materials only.

## Gate 1: Measured plan

### Player route

This is an orbit environment rather than a walkable room. The spatial sequence
is visual: performer at origin, diagonal cooled shelf, sparse fault, then the
far-field gate.

| Stop | Viewer position and action                   | First focus                     | Environment response                         | Next cue                  |
| ---- | -------------------------------------------- | ------------------------------- | -------------------------------------------- | ------------------------- |
| 1    | Default camera, orbit begins from runtime -Z | Performer silhouette            | Cool key separates the figure from the shelf | Diagonal live fissure     |
| 2    | Front-quarter orbit                          | Fissure and broken shelf edge   | Orange heat remains narrow and local         | Fractured gate silhouette |
| 3    | Side and rear-quarter orbit                  | Gate overlap and negative space | Landmark separates into unequal masses       | Return to performer       |

### Spatial artifacts

- Annotated floor plan: `evidence/r1/ember-spatial-directions-r1-plan-board.png`
- Vertical composition proof: `evidence/r1/ember-spatial-directions-r1-e-camera-board.png`
- Sightline study: `evidence/r1/e-broken-rift-gate-oblique.png`
- Plan contract: `scene-development.md`
- Automated report: `evidence/r1/ember-spatial-directions-r1-report.json`

## Gate 2: Playable graybox

- Blender source: `blender/ember-spatial-directions-r1.blend`
- Coordinate and camera manifest:
  `evidence/r1/ember-spatial-directions-r1-report.json`
- Review contact sheet:
  `evidence/r1/ember-spatial-directions-r1-e-camera-board.png`
- Environment-specific exemptions are recorded in `scene-gates.json`; the
  review object is an orbit backdrop, so room navigation, route timing, and
  sequence parity are not applicable.

## Gate 3: Registered visual target

- Locked camera set:
  `evidence/lookdev-r3/ember-lookdev-r3-report.json`
- Visual target board:
  `evidence/lookdev-r3/ember-lookdev-r3-comparison-board.png`
- Material and lighting brief: `look-development.md`
- Eight-sector proofs:
  `evidence/lookdev-r3/ember-lookdev-r3-riven-lava-tube-orbit-board.png`,
  `evidence/lookdev-r3/ember-lookdev-r3-columnar-furnace-orbit-board.png`, and
  `evidence/lookdev-r3/ember-lookdev-r3-obsidian-shear-orbit-board.png`
- Editable source: `blender/ember-broken-rift-lookdev-r3.blend`

The three targets share the approved stage relationship and camera set while
testing distinct hero geometries: fractured lava tube, asymmetric columnar
furnace, and low obsidian shear. Austen selected Columnar Furnace in museum
tracker item `QRHbwRQLhM7Zn9LyYHOd`. The selected target freezes the hero
relationship, material hierarchy, and anti-repetition guardrails while leaving
production topology and optimization to Gate 4.

## Gate 4: Production slice

### Volcanic World Revision 5 production result

The authorized Gate 4 implementation remains governed by
`gate-4-columnar-furnace-production-slice-plan.md`, with the volcanic-world
amendment recorded in museum tracker `nu73zqvPJRxio4T2sWz7`. Revision 5 retains
the Columnar Furnace landmark and its complete-orbit supporting geology, then
places them inside one continuous 230 m volcanic basin with layered caldera
depth, a distant active vent, an open lava channel, and authored levees.

The static world contains 192 scene-authored mesh objects and 40,316 triangles.
The runtime river follows ten shared control points through a 1,792-triangle
indexed spline surface with downhill motion, warped molten leads, rafted dark
crust, fog, and three sampled lights. Blender, runtime configuration, and the
contract tests consume the same JSON spatial owner. The build imports no Meshy,
web, Ocean, generated, or pre-existing model.

### Historical Revision 1 rejection

The R1 runtime proof remains in `evidence/gate-4/` as failure evidence. Its
technical checks passed, but its creative dependency did not: the pre-existing
`basalt_pinnacle.glb` supplied the landmark's entire identity. Austen rejected
that approach on 2026-08-26 and authorized a full redesign.

Historical Revision 2 used an Ember-specific Meshy buttress as buried support.
That artifact remains failure evidence only. The selected Columnar Furnace
slice uses none of it.

Gate 4 Columnar revisions 1 through 3 remain adversarial rejection evidence.
R1 read as a basalt pipe organ with a neon zipper. R2 retained a flat black
fault ribbon with glowing stitches. R3 improved mass but exposed procedural
horizontal texture bands and orange emissive lozenges that read as interface
decoration. Museum tracker item `5otAzYdNg5Wp5E27mgfo` authorizes R4 to replace
those tells with asymmetric geological mass, negative space, mostly hidden
heat, and coordinated secondary geology across the entire orbit. Revision 4 is
the immediate visual baseline for R5; it passed technically but remained too
contained to satisfy the volcanic-world direction.

### Scope

- Preserve the protected 4.5 m action radius and front-stage performer heading.
- Extend the authored geology into a continuous exterior-scale volcanic basin.
- Establish a distant vent and layered terrain silhouettes without a circular
  enclosure or theatrical backdrop.
- Route one open lava river around the action area and out of the front frame.
- Preserve the existing Ember loader and lava-effect ownership rather than
  creating a second environment renderer.

### Acceptance tests

- The world reads as a continuous volcanic landscape, not a manufactured stage
  inside a decorated room.
- Near, middle, and far terrain establish convincing depth from front, side,
  and rear-quarter orbit positions without becoming a uniform enclosing wall.
- The performer has 4.5 m of unobstructed action clearance.
- The open lava river follows a downhill channel, skirts the action area, and
  combines dark rafted crust with visibly moving molten leads and local light.
- The optimized asset loads through Meshopt/KTX2-capable runtime
  infrastructure with no console error.
- The real `/test/viewer-3d?scene=ember` route is captured at the repository's
  required desktop, tablet, and mobile viewports.
- Focused asset and runtime contract tests pass.

### Review evidence

- Editable source: `blender/ember-volcanic-world-production-slice-r5.blend`
- Build and geometry report:
  `evidence/gate-4-volcanic-r5/ember-volcanic-world-production-slice-r5-report.json`
- Eight-sector orbit board:
  `evidence/gate-4-volcanic-r5/ember-volcanic-world-production-slice-r5-orbit-board.png`
- Runtime and performance report:
  `evidence/gate-4-volcanic-r5/ember-volcanic-world-production-slice-r5-runtime-report.json`
- Immediate before baseline:
  `evidence/gate-4-columnar-r4/ember-columnar-runtime-front-stage-1920x1080.webp`
- Responsive four-performer proof:
  `evidence/gate-4-columnar-r4/ember-columnar-runtime-four-performers-front-stage-1920x1080.webp`
- Seven-viewport board:
  `evidence/gate-4-columnar-r4/ember-columnar-runtime-front-stage-viewport-sweep.webp`
- Optimized runtime asset: `static/models/ember/ember-production-slice.glb`
- Reversible optimized asset: `static/models/ember/ember-production-slice-r5.glb`
- Geometry result: 192 mesh objects, 40,316 triangles, a 6,912-triangle largest
  mesh, one continuous volcanic basin, one distant vent assembly, two channel
  levees, 6.156 m minimum structural clearance, and no imported sources.
- Contract result: 27 focused geometry, asset, stage-bound, and camera tests
  pass across four files; `svelte-check` returns zero errors and zero warnings.
- Visual result: eight Blender orbit sectors plus live front, river-side,
  opposite-quarter, and rear-orbit review at 1920×1080, followed by 2560×1440,
  3840×2160, 1440×900, 820×1180, 960×412, and 375×667 runtime
  proofs after renderer settle. The performer faces front stage in every view.
- Runtime result: zero slice-owned console errors and warnings after scene
  readiness; the warm asset request returned 304.
- Performance result: the optimized asset is 2,581,844 bytes with nine KTX2
  textures, Meshopt compression, and quantized geometry.
- Responsive result: the existing shared owner grew the stage through one,
  two, three, and four performers while keeping all bodies inside the platform.
  The Viewer3D formation adapter preserves front-stage facing through those
  count changes and leaves explicit back-to-back/circle headings intact.
- Art verdict: the room-to-world problem is solved and the river-side shot is
  the scene's new benchmark. The full orbit is approximately 9.1/10 rather than
  final top-tier: smooth distant slopes, the generic vent crown, and weaker rear
  compositions remain visible limitations.
- Gate result: `ready-for-review`, approval unset. Gate 5 remains pending.

### Volcanic World Revision 6 continuity result

Museum tracker `ATURN84Ov2hmjWUndebl` authorizes the correction from a rear-only
basin to one continuous world around the camera. R6 preserves the R5 hero,
materials, stage behavior, performer heading, and action clearance while
expanding the terrain contract to 380 by 335 m and the river to seventeen shared
control points ending beyond the audience camera.

- Editable source: `blender/ember-volcanic-world-production-slice-r6.blend`
- Build report:
  `evidence/gate-4-volcanic-r6/ember-volcanic-world-production-slice-r6-report.json`
- Eight-sector orbit board:
  `evidence/gate-4-volcanic-r6/ember-volcanic-world-production-slice-r6-orbit-board.png`
- Optimized runtime asset: `static/models/ember/ember-production-slice.glb`
- Reversible optimized asset: `static/models/ember/ember-production-slice-r6.glb`
- Geometry result: 192 authored mesh objects, 49,532 triangles, a
  16,128-triangle terrain mesh, one surrounding terrain owner, three travel
  saddles, one distant vent assembly, two channel levees, and no imported
  source.
- Delivery result: the 2.52 MiB asset uses nine KTX2 textures, Meshopt, and mesh
  quantization.
- Focused verification: eight R6 production-slice contract tests pass, the
  absent historical integrated-room fixture remains an explicit todo, and
  `svelte-check` reports zero errors and zero warnings.
- Runtime boundary: live front-stage capture is pending because both the
  primary and isolated dev routes currently fail before scene evaluation with
  the checkout's SvelteKit virtual-CSS HTTP 500. The committed lockfile also
  disagrees with `patchedDependencies`, so a frozen dependency repair cannot
  proceed inside this scoped scene task.
- Gate result: `in-progress`, approval unset. The implementation is complete;
  runtime capture is the remaining verification item.

### Volcanic World Revision 7 Meshy geology result

Museum tracker `ZSnkB98pb0wz6PO17XKp` authorizes a bounded Gate 4 geology
correction after R6 still read as a graybox. R7 keeps the R6 spatial chassis and
changes the visual ownership of the focal formations.

- Editable source: `blender/ember-volcanic-world-production-slice-r7.blend`
- Build report:
  `evidence/gate-4-meshy-r1/ember-volcanic-world-production-slice-r7-report.json`
- Eight-sector orbit board:
  `evidence/gate-4-meshy-r1/ember-volcanic-world-production-slice-r7-orbit-board.png`
- Optimized runtime asset: `static/models/ember/ember-production-slice.glb`
- Reversible optimized asset: `static/models/ember/ember-production-slice-r7.glb`
- Source result: four unique Meshy 7 multiview winners, each retextured,
  officially remeshed, embedded once, and buried into authored terrain.
- Geometry result: 79 mesh objects, 196,906 triangles, 49,345 triangles in the
  largest mesh, and 6.156 m minimum structural clearance against the protected
  4.5 m action radius.
- Delivery result: the 6.33 MiB asset uses 18 KTX2 textures, Meshopt, and mesh
  quantization.
- Credit result: 200 of the authorized 240 credits spent; 40 remain unused.
- Runtime result:
  `evidence/gate-4-meshy-r1/ember-r7-runtime-hero-1920x1080.png` records the
  decisive front-stage view with the breached caldera, crusted river, scaled
  escarpment, and separated blackglass stage. The browser console reached the
  environment-ready state with no errors or warnings.
- Focused verification: 15 R7 production and paid-request checks pass, the
  absent historical integrated-room fixture remains an explicit todo, and
  `svelte-check` reports zero errors and zero warnings.
- Gate result: implementation and verification complete; approval remains unset
  pending Austen's review.

## Gate 5: Integrated room

### Implemented visual integration

- R1 established the integrated geology but remained too dark and retained the
  generated buttress as hidden support.
- R2 and R3 expanded the locked orbit proof and visibility treatment. Their
  geometry still left one half of the orbit visually open, and the live rear
  camera exposed the support as a wet, Ocean-like backdrop.
- R4 deletes `Ember_Generated_Buttress_01` from the integrated build. Three
  textured authored basalt backplates now give the gate a deliberate reverse
  side rather than disguising an imported or generated survivor.
- R4 extends the approved production slice to 14 irregular caldera ridges, 68
  columnar-basalt columns, 34 pieces of gate talus, five obsidian shards, and
  three gate backplates.
- The perimeter now visually encloses all eight orbit sectors while every
  element remains outside the unobstructed 4.5 m performer action radius.
- The Ember review performer uses the shared Viewer3D front-stage adapter at
  `Math.PI`, which presents the avatar's visible front to the default negative-Z
  audience camera while the gate remains behind the performance. The adapter
  also survives performer-count and same-direction formation changes.
- Orange remains localized to shelf faults and the buried basin. Cool side
  lights, lighter fog, and stronger sky and hemisphere fill keep basalt faces
  readable without flattening the scene into an orange hellscape.

### Runtime evidence

- Integrated runtime asset: `static/models/ember/ember-integrated-room.glb`
- Runtime and performance report:
  `evidence/gate-5-r4/ember-integrated-room-r4-runtime-report.json`
- Build and camera report:
  `evidence/gate-5-r4/ember-integrated-room-r4-report.json`
- Eight-sector contact sheet:
  `evidence/gate-5-r4/ember-integrated-room-r4-orbit-board.png`
- Authored renders:
  `evidence/gate-5-r4/ember-integrated-room-r4-hero.png`,
  `evidence/gate-5-r4/ember-integrated-room-r4-oblique.png`,
  `evidence/gate-5-r4/ember-integrated-room-r4-reverse.png`,
  `evidence/gate-5-r4/ember-integrated-room-r4-gate-detail.png`,
  `evidence/gate-5-r4/ember-integrated-room-r4-side-depth.png`, and
  `evidence/gate-5-r4/ember-integrated-room-r4-plan.png`
- Asset result: 1,661,988 bytes, 156 mesh objects, 56,140 triangles, seven
  materials, three shared KTX2 textures, Meshopt compression, and quantized
  geometry.
- Runtime result: zero console errors and zero warnings. An uncached proof
  request returned 200 with all 1,661,988 bytes; the warm runtime path returned 304.
- Viewport result: 1920×1080, 2560×1440, 3840×2160, 1440×900, 820×1180,
  960×412, and 375×667 passed after renderer settle.
- Orbit result: front, front-right, right, rear-right, rear, rear-left, left,
  and front-left passed. Austen's exact reported camera at
  `-3.320,1.597,28.409` also passed after the generated survivor was removed.
- Focused result: 16 tests passed across the Meshy generator and Ember asset
  contracts.

### Historical Gate 5 boundary

Gate 5 was approved under the former art direction. Its evidence remains valid
as a historical technical record, but the 2026-08-27 Gate 3 regression
invalidates that approval for the next Ember release.

## Gate 6: Final acceptance

Gate 6 was approved under the former art direction. The final acceptance walk
passed performer-count stage growth and contraction, responsive composition,
Ember to Autumn to Ember re-entry, eight-sector orbit coherence, runtime
console, focused regression, and frame pacing. That record remains useful
engineering evidence, but museum tracker item `rn25Qau62kXyyOJpgm7Z`
supersedes its creative acceptance. Gate 6 is pending until the selected Gate 3
direction completes production and integration again.

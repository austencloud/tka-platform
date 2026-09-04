# Ember Spatial Directions

Status: Breached Rift Bench Gate 2 graybox ready for review; prior Gate 4 is historical

Date: 2026-09-04

Historical final acceptance: museum tracker `wqUAKQMa79rTYDYa0N5m`

Current regression authority: museum trackers `rn25Qau62kXyyOJpgm7Z`,
`QRHbwRQLhM7Zn9LyYHOd`, `gME4uHJawz9dtTlirRl8`,
`kqMUPC5UpCHjj7ts9atQ`, `5otAzYdNg5Wp5E27mgfo`,
`nu73zqvPJRxio4T2sWz7`, `ATURN84Ov2hmjWUndebl`,
`ZSnkB98pb0wz6PO17XKp`, `sDKmB6cUEXLfHgz4DGd4`,
`s3cxnp6hOLBVQR5dDF42`, `uXmi4z9lL7zCiNq5ULCp`, and
`ahPuPwh34G3FeqvUEHsB`; geology-first restart authority:
`hMO9hB97M2y1ZVGrxCt3`, `gqImqDqgfctdYi1kr6pH`,
`ZgRNLK66C9Hz2wMPbOXc`, and Gate 2 evidence reference
`anf4rcwDOr4j1LuyOX3l`

## Why this exists

The first Basalt Caldera image is a useful mood and composition hypothesis. It
is not a target to reproduce. Ember needs several alternatives built as actual
3D spaces before one direction earns production investment.

This pass compares topology, silhouette, depth, performer legibility, and
camera behavior. It deliberately does not decide final geology, textures,
particles, or asset sources.

## Shared comparison contract

Every direction uses the same:

- world origin for the performer;
- 1.75 m performer proxy;
- unobstructed 4.5 m action radius around the performer;
- hero camera position, lens, target, resolution, world lighting, and exposure;
- plan camera and scene bounds;
- dark basalt, obsidian, ash, and lava graybox material families.

Perspective cameras stay inside Viewer3D's real 25 m orbit cap.

The common camera makes the hero renders comparable. The plan renders expose
the spatial logic that a flattering hero angle can hide.

## Directions

### A. Basalt Arch Caldera

An open caldera framed by one monumental collapsed lava-tube arch. A molten
fault leads from the foreground to a broad natural performance shelf.

Strength to test: immediate icon, open sky, strong foreground-to-background
depth.

Failure mode: the scene becomes one expensive arch with an ordinary circular
stage beneath it.

The generated concept is retained only as a reference for this direction:
`references/direction-a-basalt-arch-concept.png`.

### B. Oculus Lava Tube

An enclosed lava-tube chamber with a broken roof opening above and behind the
performer. The floor is a cooled crust shelf surrounded by lower molten seams.

Strength to test: intimate atmosphere, unusual overhead silhouette, controlled
contrast around the performer.

Failure mode: the roof blocks orbit cameras and the chamber feels cramped.

### C. Faultline Causeway

A long obsidian shelf crosses a deep molten rift and widens naturally around
the performer. The composition is diagonal rather than radial.

Strength to test: strongest directional movement, dramatic negative space,
clear foreground route.

Failure mode: the widened shelf still reads as a manufactured stage or leaves
bad camera angles over empty lava.

### D. Basalt Organ Canyon

Unequal walls of columnar basalt form a canyon mouth around the performer. A
distant molten fall and ash plume terminate the view through the slot.

Strength to test: vertical scale, layered silhouettes, and a distinctive world
without relying on one arch.

Failure mode: repeated columns look architectural or revive Ember's current
ring-of-crystals problem at a larger scale.

### E. Broken Rift Gate

This direction was not selected in advance. It was earned by the first camera
comparison: Direction C kept the performer readable from every tested angle
but lacked a memorable horizon, while Direction A supplied a strong icon but
wrapped it around the stage. The synthesis keeps C's directional causeway and
moves a fractured basalt gate into the far field.

Strength to test: resilient playable topology with a recognizable destination
and no giant structure surrounding the performer.

Failure mode: the distant gate becomes decorative set dressing rather than a
spatial destination, or the causeway still reads as a runway.

## Selection rubric

Each direction will be judged from both hero and plan renders.

| Criterion              | Weight | Question                                                                        |
| ---------------------- | -----: | ------------------------------------------------------------------------------- |
| Performer readability  |    25% | Does the body and prop envelope remain legible against the environment?         |
| Spatial identity       |    20% | Is the scene recognizable from silhouette alone?                                |
| Depth and framing      |    20% | Are foreground, midground, and background doing distinct jobs?                  |
| Non-radial composition |    15% | Does the world feel authored rather than distributed around the origin?         |
| Camera resilience      |    10% | Can an orbiting viewer find several good angles without clipping or emptiness?  |
| Runtime plausibility   |    10% | Can this topology become a performant authored GLB plus existing Ember effects? |

No direction advances because it most closely resembles the generated image.
The selected direction must win the spatial comparison.

## Deliverables for this pass

- `blender/ember-spatial-directions-r1.blend`: editable geometry for all five
  directions, isolated in named collections.
- `evidence/r1/*-hero.png`: fixed-camera comparison renders.
- `evidence/r1/*-plan.png`: fixed-scale plan renders.
- `evidence/r1/ember-spatial-directions-r1-report.json`: object counts, bounds,
  camera contract, and output paths.

## Explicitly deferred

- No production Ember GLB.
- No changes to `EmberScene.svelte` or its configuration.
- No final material or asset-source decision.
- No deletion of the current procedural environment.
- No commitment to the Basalt Arch direction.

## R1 outcome

Direction E, **Broken Rift Gate**, is the strongest spatial chassis from this
comparison. This does not freeze its present graybox silhouette, materials, or
individual rock placements.

| Rank | Direction              | Spatial result                                                                                                                 |
| ---: | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
|    1 | E. Broken Rift Gate    | Keeps the directional fault shelf readable from the tested views and adds a far-field landmark without wrapping the performer. |
|    2 | C. Faultline Causeway  | Best pure topology and camera freedom, but the horizon has no identity.                                                        |
|    3 | A. Basalt Arch Caldera | Strongest single icon, but the icon recenters the scene around a broad stage.                                                  |
|    4 | D. Basalt Organ Canyon | Excellent front depth; side and rear-quarter cameras are consumed by its column walls.                                         |
|    5 | B. Oculus Lava Tube    | Atmospheric enclosure, but repeated tube ribs dominate or fully block orbit views.                                             |

The result should be read as: **develop E's topology next while continuing to
search its visual language**. It should not be read as: reproduce the generated
concept image, preserve the graybox arch, or begin final-detail production.

The next gate is a small look-development matrix inside Direction E's space:

- natural fractured basalt gate versus a collapsed lava-tube remnant;
- exposed caldera versus ash-storm horizon;
- narrow live fault versus broad cooling lava field;
- glassy obsidian shelf versus porous rope-lava shelf.

Those alternatives can change the appearance substantially without discarding
the spatial lesson earned here.

## Current Gate 4 boundary

The former Gate 6 acceptance is historical. Austen reopened the art direction
in museum tracker `rn25Qau62kXyyOJpgm7Z`, selected Columnar Furnace at Gate 3 in
`QRHbwRQLhM7Zn9LyYHOd`, and authorized its production slice in
`gME4uHJawz9dtTlirRl8`. The shared front-stage heading correction is recorded
in `kqMUPC5UpCHjj7ts9atQ`.

After an adversarial runtime and Blender review, tracker
`5otAzYdNg5Wp5E27mgfo` authorized Revision 4 of that same Gate 4 owner. R4
removed the organ-pipe wall, neon-zipper fissure, procedural texture bands, and
emissive lozenges, but Austen's next review correctly found that the scene
still read as a contained hell room rather than a volcanic world.

Tracker `nu73zqvPJRxio4T2sWz7` authorizes Revision 5. R5 preserves the Direction
E action radius, performer relationship, asymmetrical Columnar Furnace, and
camera family, then opens them into one continuous 230 m volcanic basin. The
basin owns layered near, middle, and far caldera mass; a distant active vent;
an open channel with authored levees; and a ten-point lava river that continues
past the front frame rather than terminating beside the performer. Static
Blender geometry owns the geological silhouette. The existing Ember runtime
lava owner supplies animated downhill flow, rafted dark crust, bright molten
leads, fog integration, and sampled light interaction from the same shared
world contract.

The current evidence is `evidence/gate-4-volcanic-r5/`. The production slice is
`ready-for-review` with approval unset. Gate 5 and final acceptance remain
pending. The river-side composition reaches the strongest bar in the scene,
but the complete orbit is not recorded as a final 10/10: distant terrain form,
the vent crown, and the rear compositions remain the next art targets.

## R6 continuity correction

Museum tracker `ATURN84Ov2hmjWUndebl` corrects the remaining R5 set-edge read.
The terrain contract now spans runtime X `[-190, 190]` and runtime Z
`[-145, 190]`, so the audience camera, performance shelf, complete orbit, and
distant vent all occupy one continuous heightfield. The central 23 m remains a
low action floor. Eight offset terrain provinces create overlapping depth around
that floor, and three subtracted saddles preserve visible travel corridors.

The river expands from ten to seventeen shared control points and continues to
runtime Z `-122`, beyond the front camera. R6 keeps the same 6.156 m computed
minimum structural clearance around the protected 4.5 m action radius. Its
registered source, report, and orbit evidence live in
`evidence/gate-4-volcanic-r6/`; live runtime verification remains pending on the
checkout's unrelated SvelteKit HTTP 500.

## R7 Meshy geology correction

Museum tracker `ZSnkB98pb0wz6PO17XKp` reopens Gate 4 because R6 solved spatial
continuity but still exposed procedural, graybox-like geology. R7 preserves the
380 by 335 m volcanic country, seventeen-point river, performer relationship,
front-stage heading, and protected 4.5 m action radius. It replaces the focal
geology with four unique modules generated from registered Ember multiview
references: a fractured columnar escarpment, a collapsed lava bank, and an
obsidian fumarole talus, plus a low breached caldera that replaces the
procedural distant vent after runtime review exposed its pyramid silhouette.

Two geometry candidates per family were audited at matched triangle budgets.
Only the B winner in each family advanced to retexture and official Meshy
remesh. The four sources are embedded once each and buried into deterministic
terrain; authored rubble remains transition tissue instead of duplicating hero
silhouettes. The orbit evidence and audit ledger live under
`evidence/gate-4-meshy-r1/`. Final spend was 200 of 240 credits, leaving 40
credits unused.

## R8 cinematic atmosphere audition

Museum tracker `sDKmB6cUEXLfHgz4DGd4` authorizes a runtime-only look pass over
the locked R7 geometry. Blackglass Inferno, Furnace Storm, and Sulfur Caldera
were captured from the same hero camera. Blackglass was selected because its
red cloud horizon, dark geology, local lava bounce, and cool opposing rim keep
the broad terrain readable without washing the performer and world into one
color.

The selected look also owns a restrained quality-aware shadow key, three heat
fields along the river and vent, three depth-registered fumarole plumes, and
material-name-aware response for the playable blackglass, Meshy formations,
mineral seams, and surrounding authored terrain. The initial glittering stage
and orange shelf trim were rejected during the proof loop and removed before
the final capture.

The comparison, complete orbit, viewport sweep, and runtime frame-time report
live under `evidence/gate-4-atmosphere-r1/`. The geometry asset and remaining 40
Meshy credits were untouched.

## Geological World R8 terrain track

Museum tracker `s3cxnp6hOLBVQR5dDF42` reopens Gate 3 around the latest spatial
critique: the environment was continuous in metres but still read as one broad,
uniform basin around a contained stage. The R8 terrain track therefore compares
three registered topologies in the actual R7 scene instead of treating one
concept image as an immutable target.

Breached Caldera Terraces wins over Collapsed Lava Delta and Basalt Badlands.
Its offset rim and collapsed benches create a stronger near/middle/far hierarchy,
while the missing arc and river-cut saddle imply travel beyond the focal area.
The former 23 m flat moat contracts to the 10.8 m required by the responsive
stage envelope. Eight fractured crust plates make that shelf part of the same
geological event, and erosion bowls let the four R7 Meshy landmarks emerge from
rather than intersect the terrain.

Gate 3 comparison evidence lives in `evidence/gate-3-terrain-r8/`. The selected
production source, ten registered renders, complete orbit board, runtime hero,
four-performer growth proof, and frame report live in
`evidence/gate-4-terrain-r8/`. The R7 geology, Blackglass Inferno atmosphere,
seventeen-point runtime river, front-stage heading, 4.5 m action clearance, and
remaining 40 Meshy credits are preserved.

## R9 volcanic surface ecology track

Museum tracker `uXmi4z9lL7zCiNq5ULCp` reopens Gate 3 around the remaining
material failure. R8 solved the world-scale terrain silhouette, but the same
`weathered-basalt` color, roughness, and normal maps still skin the columnar
hero and all three depth bands. The result reads as one rippled procedural
material even when the underlying geometry is strong.

R9 holds the entire R8 spatial and lighting contract fixed and compares three
independent material ecosystems from the same four cameras:

- **Fresh Flow Field:** roped pahoehoe, a'a clinker, fractured basalt, and
  sheltered windborne ash.
- **Ash-Choked Caldera:** compacted ash, lapilli fall, exposed basalt scarps,
  and lava-baked contact crust.
- **Hydrothermal Rift:** wet obsidian, iron oxide drainage, localized sulfur
  sinter, and steam-bleached basalt.

The director synthesis, **Fresh Rift**, combines Fresh Flow's coherent young
lava base with Hydrothermal Rift's iron response only at the river and contact
zones. It rejects broad sulfur fields and the Ash direction's full-scene gray
blanket. The terrain proof uses a smooth per-vertex four-family mask rather
than visible material islands. Cooled shelf fissures receive geological crust
instead of an unlit black surface.

Sixteen registered renders, the four-direction board, editable Blender target,
and deterministic build report live in `evidence/gate-3-surface-r9/`. The
adversarial ledger recommends Fresh Rift. Austen approved that registered
target on 2026-08-28 and explicitly authorized Blender work in tracker
`ahPuPwh34G3FeqvUEHsB`. Gate 4 now carries the selected ecology into the
editable production source, the existing shared world-space detail owner, and
the live Ember environment while preserving the R8 spatial contract.

The authored Gate 4 slice is now built. Its editable R9 Blender source retains
the R8 terrain and four Meshy landmarks, while the shipping 4.28 MiB GLB uses
five Fresh Rift materials and twelve KTX2 maps. A 1,024-square world mask maps
young lava, river-contact iron, fractured scarps, and sheltered ash across the
full 380 by 335 m country. The runtime scene composes the existing shared
masked-ground-detail shader and assigns atmospheric treatment by semantic
geology role. Automated verification is green; live Viewer3D visual,
interaction, console, and frame-time evidence remains the boundary before Gate
4 can become ready for review.

## R10 Living Caldera production correction

Austen's 2026-08-28 review rejected R9 as a final top-tier result because its
audience-side orbit still read as a graybox apron and the lava river lacked the
continuous molten hierarchy visible in real active channels. R10 keeps the
approved Fresh Rift materials, unique Meshy landmarks, responsive performer
clearance, front-stage heading, and shared river contract. It changes the
production slice rather than adding another environment owner.

The terrain is now a four-sided, offset caldera. North and south walls carry
separate foreground, midground, and crown masses; the river cuts deliberate
breaches through both horizons so the composition remains directional rather
than becoming a closed arena. A registered `audience` camera reproduces the low
positive-runtime-Z view that exposed the R9 failure. That angle is part of the
build report and orbit proof, so future passes cannot hide the southern sector
behind elevated review cameras.

Runtime surface ecology replaces every flattened box plate with one shared
jagged basalt mesh. The existing lava owner now carries broader incandescent
leads, thinner moving crust seams, stronger bank bounce, and a restrained set of
sampled lights across the complete 278 m channel. Fog density drops while cold
sky separation rises; the haze shader confines warm particulate strata to the
lower atmosphere so the new caldera silhouette remains readable.

The deterministic builder is `scripts/build-ember-production-slice.py
--r10-production`. The editable source is
`blender/ember-volcanic-world-production-slice-r10.blend`; the reversible asset
is `static/models/ember/ember-production-slice-r10.glb`; and Gate 4 evidence
lives in `evidence/gate-4-living-caldera-r10/`. The shipping GLB remains the
stable `ember-production-slice.glb` capability owner.

## Geology-first restart R1

Austen's 2026-09-03 review rejected the accumulated scene as insufficiently
realistic and asked to restart from bird's-eye composition before any further
production iteration. The later lava correction also rejects two unrelated
sources and requires one visibly moving, gravity-legible drainage from a high
source through the environment to a pool or continuation.

The restart reopens Gate 1. It preserves the runtime environment owner,
performer/action contract, Fresh Rift surface research, Blackglass atmospheric
systems, and any Meshy asset that can be embedded credibly. It invalidates the
current macro terrain, radial/basin composition, stage-to-world transition,
landmark arrangement, and spline ribbon as owner of the lava footprint.

The governing research is
`geology-lava-composition-research.md`, with provenance in
`geology-research-source-ledger.md`. Three measured 380 by 335 m plans compare
Breached Rift Bench, Perched Channel Terraces, and Inflated Rift Apron from plan,
longitudinal section, and eight orbit sightlines. Austen approved Breached Rift
Bench for Gate 2 on 2026-09-04 in tracker `ZgRNLK66C9Hz2wMPbOXc`.

Two independent open-source emplacement solvers were run on that candidate's
authored 1 m DEM. Flowy and MrLavaLoba2 produced 78.0% footprint
intersection-over-union with similar active area and thickness. This supports
terrain-driven flow planning while remaining explicitly short of geological
validation.

## Breached Rift Bench Gate 2

The isolated Gate 2 builder is `scripts/build-ember-geology-graybox.py`. It
derives a hash-locked coordinate manifest from the approved Gate 1 heightfield,
imports the registered Flowy footprint as a diagnostic guide, and creates one
editable Blender graybox plus one review GLB. The full lava body remains a
flat-material source-to-continuation mass derived from the approved path and
widths; it is not the final Gate 4 lava surface.

The registered review set captures the default audience view, eight 45-degree
orbit positions, the bird's-eye simulator overlay, and a four-times-exaggerated
longitudinal section. Automated verification confirms one visible terrain
collider, a 314.1 m downhill path with 22.6 m net descent, 4.444 m simulator
clearance beyond the protected action envelope, coordinate-source digests, and
the required review GLB nodes.

Gate 2 is `ready-for-review` with approval unset. The production Ember asset,
runtime scene, final materials, atmosphere, and remaining 40 Meshy credits are
unchanged. Gate 3 and all later work remain blocked until Austen reviews the
graybox relationship and explicitly approves this gate.

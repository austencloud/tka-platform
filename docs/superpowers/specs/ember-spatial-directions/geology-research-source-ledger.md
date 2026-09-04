# Ember geology restart source ledger

Status: research evidence, not approved art direction

Date: 2026-09-03

Museum research authorization: `gqImqDqgfctdYi1kr6pH`

This ledger separates measured evidence, scientific interpretation, production
reference, open-source tooling, and Ember-specific invention. It prevents a
beautiful reference image or a plausible procedural output from silently
becoming geological fact.

## Evidence classes

| Class | Meaning | Allowed use in Ember |
| --- | --- | --- |
| Measured | Surveyed or instrument-derived real-world data | Scale, footprint, thickness rhythm, terrain/flow relationships |
| Scientific | Peer-reviewed or agency interpretation | Formation logic, thermal hierarchy, flow morphology |
| Production reference | Published film/game/VFX breakdown | Composition, abstraction, shading, workflow patterns only |
| Tool implementation | Open-source software and documentation | Offline preproduction according to its license |
| Ember invention | Authored response to the project constraints | Candidate plan, silhouette, pacing, and fantasy emphasis, clearly labelled |

## Measured terrain and eruption data

| Source | What it supports | Rights / handling |
| --- | --- | --- |
| [USGS Mauna Loa 2022 final DEM and thickness maps](https://www.usgs.gov/data/mauna-loa-2022-lava-flow-digital-elevation-models-and-thickness-maps), DOI `10.5066/P1NBKNMC` | A real basaltic eruption footprint, terrain-following branching, ponded thickness, and mapped scale. Published horizontal resolution is 3.053 m; metadata reports agreement within one pixel and 1.09 m one-sigma vertical variation over unchanged terrain after a roughly 2.5 m shift correction. | USGS public-domain/CC0 data. Raw GeoTIFFs remain outside Git at `E:/tka-platform-ember-geology-sources/usgs-mauna-loa-2022/`. Compact derived evidence is tracked. |
| [USGS geospatial database of the 2022 Mauna Loa summit and Northeast Rift Zone eruption](https://www.usgs.gov/data/geospatial-database-2022-summit-and-northeast-rift-zone-eruption-mauna-loa-volcano-hawaii), DOI `10.5066/P1KES7F4` | Mapped fissures, vents, flow boundaries, cracks, and eruptive features; useful for testing whether proposed terrain features belong to one event or several dated units. | USGS public-domain data. Reference only in this pass. |
| [USGS thermal maps of Kīlauea's 2018 Lower East Rift Zone eruption](https://www.usgs.gov/data/thermal-maps-2018-lower-east-rift-zone-eruption-kilauea-volcano-island-hawaii) | Real thermal structure is patchy and tied to active margins, breakouts, cracks, and channels rather than uniform full-width emission. | USGS public-domain data. Reference only in this pass. |

The tracked Mauna Loa evidence board is
`evidence/gate-1-geology-restart-r1/usgs-mauna-loa-2022-reference-board.png`.
Its JSON report records dataset identity, raster geometry, published accuracy,
and a downsampled diagnostic thickness distribution. The sampled distribution
is deliberately not presented as a scientific volume estimate.

## Geology and lava morphology

| Source | Claim supported |
| --- | --- |
| [USGS: Pāhoehoe and ʻaʻā lava flows](https://www.usgs.gov/news/volcano-watch-pahoehoe-and-aa-lava-flows) | Basaltic lava surface form responds to viscosity, shear, cooling, and effusion conditions; pāhoehoe can change downstream into ʻaʻā. |
| [USGS: How does pāhoehoe flow?](https://www.usgs.gov/news/volcano-watch-how-does-pahoehoe-flow) | Pāhoehoe advances through toes and lobes, inflation, breakouts, and crustal recycling rather than as one exposed liquid ribbon. |
| [USGS observations of basaltic lava streams and tubes at Kīlauea](https://www.usgs.gov/publications/observations-basaltic-lava-streams-tubes-kilauea-volcano-island-hawaii) | Channels, levees, crust formation, and tubes are connected transport states, not independent decorations. |
| [National Park Service: lava-flow surface features](https://www.nps.gov/articles/000/lava-flow-surface-features.htm) | Pressure ridges, tumuli, squeeze-ups, and lava-rise features belong to inflation and emplacement processes. |
| [National Park Service: lava-flow forms](https://home.nps.gov/articles/000/lava-flow-forms.htm) | Agency overview of pāhoehoe, ʻaʻā, block lava, and pillow lava morphology. |
| [National Park Service: cinder cones](https://www.nps.gov/articles/000/cinder-cones.htm) | Scoria cones are localized accumulations around vents and should not be distributed as generic jagged mountains. |
| [USGS: getting in the rift zone](https://www.usgs.gov/news/volcano-watch-getting-rift-zone-why-and-how-they-erupt) | Rift zones organize fissures and magma pathways into directional volcanic structure. |
| [USGS: how Hawaiian volcanoes grow](https://pubs.usgs.gov/gip/hawaii/page43.html) | Shield volcanoes are broad accumulations of fluid basaltic flows; steep drama is localized in scarps, cones, and collapse structures. |
| [USGS geologic map of Kīlauea's summit region](https://www.usgs.gov/maps/geologic-map-summit-region-kilauea-volcano-hawaii) | A credible volcanic landscape is a history of mapped units and structures, not a simultaneous collection of every volcanic feature. |
| [USGS: columnar jointing and lava-flow cooling history](https://www.usgs.gov/observatories/hvo/news/volcano-watch-columnar-jointing-provides-clues-cooling-history-lava-flows) | Columns belong to sufficiently thick cooled lava and reveal cooling direction/history. Ember may expose them in an older eroded or collapsed unit, not as trim around fresh lava. |
| [USGS: lava rocks come in many colors](https://www.usgs.gov/news/volcano-watch-lava-rocks-come-many-colors) | Basalt color reflects oxidation, weathering, glass, vesicularity, and alteration; uniform neutral gray is not a complete surface ecology. |

## Thermal and emissive structure

| Source | Claim supported |
| --- | --- |
| [Davies et al., thermal remote sensing of Erta Ale](https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2008GC002164) | Active cracks can expose roughly 700–1070 °C material while surface plates remain hundreds of degrees cooler, creating high-contrast, low-area emission. |
| [Kīlauea lava-flow surface temperatures](https://www.sciencedirect.com/science/article/abs/pii/S0377027301002578) | Representative hierarchy used in this study: incandescent core above roughly 1050 °C, hot skin around 750–900 °C, crust below roughly 750 °C, and much cooler margins. Exact values vary with observation and flow state. |
| [Experimental basaltic crust formation](https://openresearch-repository.anu.edu.au/items/23cb9b71-6cb0-43a6-b119-4391b88a3ba0) | Crust formation, deformation, and foundering should drive the animation language; exposed molten area is a consequence of mechanical disruption. |

The temperature ranges above are rendering anchors, not a promise of
radiometric simulation. Ember should express the ordering and spatial contrast,
not map degrees Celsius directly to arbitrary RGB values.

## Production and composition references

| Reference | Transferable lesson | Explicit non-transfer |
| --- | --- | --- |
| [Quixel Rebirth breakdown](https://www.unrealengine.com/blog/watch-quixel-and-sidefx-explain-how-they-developed-the-photorealistic-real-time-cinematic-rebirth?lang=en-US) and [production article](https://medium.com/quixel-ab/rebirth-the-future-of-virtual-production-2825fff07ff9) | Scan-scale assets, procedural scatter, lighting, and atmospherics work because they reinforce a large terrain composition and measured material response. | Do not copy its Icelandic formations or cinematic camera; Ember remains an orbitable performance environment. |
| [God of War: Muspelheim concept work by Norris Lin](https://www.artstation.com/artwork/d0vKxX) | One dominant mass, controlled negative space, and a readable hot/cold value path outperform evenly distributed spectacle. | Visual reference only; no model, texture, layout, or silhouette extraction. |
| [Nick Vigna: lava environment study](https://nickvigna.artstation.com/projects/klArPl?album_id=1308438) | Surface breakup needs scale separation: terrain mass, flow field, crust plate, crack, and particulate detail. | Visual reference only. |
| [Nick Rudolph: lava VFX](https://nirudo.artstation.com/projects/eJGrEZ) | Emission, distortion, smoke, and reflected bounce need coordinated timing and localized intensity. | Visual reference only. |
| [Disney Animation: the foundation of a lava monster](https://media.disneyanimation.com/uploads/production/publication_asset/166/asset/Moana_Foundation_of_a_Lava_Monster.pdf) | Layered crust and molten deformation can be art-directed while retaining a material cause-and-effect model. | Character-deformation techniques are not a direct terrain solution. |
| [SideFX Project GROT procedural lava terrains](https://www.sidefx.com/tutorials/project-grot-procedural-lava-terrains/?collection=85) | Height-field erosion, masks, terrain layers, and procedural scattering can produce an editable geological authoring stack. | Workflow reference; no SideFX project content is vendored by this study. |
| [SideFX MPM Lava](https://www.sidefx.com/contentlibrary/mpm-lava/) | High-end viscous flow can provide close-up motion reference and baked hero events. | Not appropriate as a live browser simulation. |

## Open-source implementation audit

All repositories were cloned to
`E:/tka-platform-ember-geology-sources/` and pinned during this study. No source
from these repositories is copied into the TKA application.

| Repository | Pinned revision | License | Verified role | Boundary |
| --- | --- | --- | --- | --- |
| [Flowy](https://github.com/flowy-code/flowy) | `4ce1036d1073d581085c74c569b1d0e95a4ae0bd` | GPL-3.0 | Built successfully in a dedicated micromamba/WSL environment. Ran 2,000 lobes on Ember's shared DEM; solver reported 0.007 s and measured wall time was 0.694 s. | Fast offline topology cross-check only. Do not link, copy, or vendor GPL implementation into the app. |
| [MrLavaLoba2](https://github.com/demichie/MrLavaLoba2) | `cf2cbc8aaabc399c9ae545286b1c710e3c6ffbb9` | Apache-2.0 | Ran the same 2,000-lobe test with NumPy seed 6301. Solver reported 8.5 s; cold wall time including Numba compilation/export was 27.136 s. Produces thickness and masked ASCII rasters. | Preferred reproducible baseline. Output still requires artistic interpretation; it is not a render mesh. |
| [BlenderGIS](https://github.com/domlysz/BlenderGIS) | `2add45ffec547f419cc77563a7fe976fd6c8f0c4` | GPL-3.0 | Imports georeferenced DEM and vector sources into Blender. | Manual DCC bridge only. Do not make it a runtime or vendored app dependency. |
| [Infinigen](https://github.com/princeton-vl/infinigen) | `3f58bb886bb1bda681d41240344fe3126ac0e9bd` | BSD-3-Clause | Broad procedural-nature system with useful terrain/material/scatter patterns. | Research laboratory, not Ember's core scene pipeline; integration cost is disproportionate to this one environment. |
| [TerraForge3D](https://github.com/Jaysmito101/TerraForge3D) | `c70fe693083fa48cdc937cf6b6aa3f89b71b1b3f` on `gen3` | MIT | Active terrain authoring codebase and erosion/procedural reference. | Optional experiment only. The latest tagged stable release observed in the audit predates the active branch by several years. |

The benchmark inputs are reproducibly generated by
`scripts/prepare-ember-lava-simulator-benchmark.py`. The raw DEM and solver
outputs stay in the external source cache. The tracked board and report are
`evidence/gate-1-geology-restart-r1/lava-simulator-comparison-board.png` and
`lava-simulator-comparison-report.json`.

## Meshy 7 boundary

[Meshy's multi-image-to-3D documentation](https://docs.meshy.ai/en/api/multi-image-to-3d)
accepts one to four views. [Meshy's credit schedule](https://help.meshy.ai/en/articles/10000507-how-many-credits-does-each-generation-task-cost)
lists 25 credits for the model stage and 10 for texturing in the audited
workflow. With 40 credits remaining, Ember can fund one complete 35-credit
landmark attempt, not an exploratory asset family.

The reserved target is a terrain-embedded collapsed scarp or breached levee
only after the plan and graybox are approved. Multi-view inputs must agree on
geology, scale, contact plane, and silhouette. Existing Meshy formations remain
salvage candidates; this pass spends no credits.

## Ember-authored hypotheses

The following are inventions awaiting review, not facts derived from the
sources:

- the exact 380 × 335 m world bounds and central performer bench;
- the source coordinate `(-72, 137)` for Direction A;
- the Breached Rift Bench, Perched Channel Terraces, and Inflated Rift Apron
  plans;
- the 22.6 m longitudinal descent and 314.1 m authored route in Direction A;
- the use of one older western collapse scarp as the dominant mass and an open
  east/southeast horizon;
- any eventual landmark generated through Meshy.

Each is testable because it is encoded in a measured board and report rather
than hidden inside a flattering perspective image.

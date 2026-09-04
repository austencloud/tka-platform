# Ember geology, lava, and composition research

Status: complete research package; Mid-Flank Fire Pilgrimage Gate 1.1 R5 ready for review; Gate 2 pending

Date: 2026-09-03

Research authorization: museum tracker `gqImqDqgfctdYi1kr6pH`

Prior lava correction: museum tracker `hMO9hB97M2y1ZVGrxCt3`

## Recommended outcome

Rebuild Ember's spatial backbone, but do not discard the whole scene.

The active correction candidate is **Mid-Flank Fire Pilgrimage R5**: a
continuously inclined volcanic flank in which only a 12 by 11 m irregular patch
locally eases the performer footing. The surrounding old-flow contact retains a
6-10 degree grade, then steepens gradually into the upper edifice and lower
country. One high fissure-fed system descends from `(-34, 132)`, passes west of
the performer, and continues beyond the south review boundary.

Austen's accepted tracker decision `Vwm6XTLdDbDfxuoVE7z9` retains R4's
mountain-above / country-below direction but rejects its broad near-level ledge.
The measured R5 artifact is ready for Gate 1.1 review in reference
`Iur86OmZX40nTqdwgxDq`; approval is unset. R4 Gate 1/2 evidence remains
historical and no R5 Blender graybox exists yet.

The restart should preserve Ember's useful infrastructure, surface work, and
atmosphere while replacing two failed owners:

1. the production terrain's macro topology and landmark composition;
2. the Catmull-Rom lava ribbon as the owner of the flow footprint.

No production scene, shipping GLB, or Meshy credit was changed or spent in this
research pass.

## Why the previous iterations stayed unreal

The problem was not a missing texture or another round of rock placement. The
scene's large forms and lava logic were authored in the wrong order.

### 1. Perspective came before plan

Hero views repeatedly hid weaknesses that became obvious from the audience,
rear quarter, or plan view. A volcanic environment is primarily a terrain and
drainage problem. Its first contract must be a bird's-eye plan with elevations,
not a cinematic frame.

### 2. The world was assembled as simultaneous motifs

Caldera wall, column field, distant vent, lava river, broken shelves, and Meshy
formations appeared together without a legible age or causal sequence. Real
volcanic landscapes can contain all of those things, but each must belong to a
dated unit or event. Without that sequence, they read as set dressing.

### 3. The stage was a separate object

A flat central patch plus a surrounding terrain wall creates an arena even if
the patch has a good basalt material. The performer area needs to be a locally
quiet part of a larger old flow surface, with its slope, fractures, and contacts
continuing beyond the action envelope.

### 4. The lava was a spline with effects

`lava-river-geometry.ts` builds a Catmull-Rom ribbon. Width modulation, dark
rafts, bloom, and animated shader noise can improve that ribbon, but they do
not give it an emplaced footprint. Real basaltic flow records branching,
ponding, levee construction, breakout lobes, thickness, and topographic control.
Those are two-dimensional and volumetric decisions, not centerline decoration.

### 5. Emission was too continuous

Broad full-width orange makes lava readable at a glance but removes the cooling
story. The strongest real references are mostly dark surface area interrupted
by small, intense cracks, shear margins, foundering plates, skylights, and
breakouts. In an open ʻaʻā channel, a dark rafted center can coexist with hotter
marginal shear zones. “Hot center, dark edges” is not a universal rule.

### 6. Every direction tried to be a hero angle

An orbitable scene still needs hierarchy. One dominant mass and one open
horizon give the viewer orientation. When cliffs, arches, columns, plumes, and
lava compete around the full circle, the result is an exhibit ring rather than
a place.

## The governing model: the environment is a history

Ember should be designed as a stack of events. A coherent candidate history is:

| Relative age | Event | Visible evidence |
| ---: | --- | --- |
| 1, oldest | Broad shield-building basalt flows accumulate | Long gentle regional slopes and large continuous benches |
| 2 | Summit/rift extension and collapse | Offset scarp, breached wall, tilted blocks, talus, exposed thick flow interiors |
| 3 | Older surface cools and weathers | Performer bench, oxidized contacts, ash in lows, subdued fractures |
| 4 | New fissure opens along the rift | Local spatter/rampart and a clear high source, not a generic volcano cone |
| 5 | Active flow follows the available drainage | Channel, levees, overflows, ponding at slope breaks, downstream lobes |
| 6, current | Crust forms while transport continues | Rafted plates, marginal shear, sparse breakouts, steam/heat interaction |

This time sequence answers common placement questions automatically:

- Columnar basalt may appear where an old thick flow is exposed by the collapse
  scarp. It should not form a decorative fence around the fresh channel.
- Talus sits below the older scarp and partly buries its contact. It does not
  repeat uniformly around the stage.
- The new flow crosses or skirts older surfaces according to elevation. It does
  not climb toward a more attractive frame.
- Ash and fine material collect in sheltered lows. Fresh hot surfaces and steep
  exposed scarps remain comparatively clean.
- Hydrothermal or iron-rich alteration stays near plausible fractures and
  contacts instead of becoming a whole-world color treatment.

## Bird's-eye design grammar

The plan is the primary design artifact. Perspective becomes a test of the plan.

### Fixed world and performer contract

| Property | Contract |
| --- | ---: |
| Runtime X extent | `-190 m` to `190 m` |
| Runtime Z extent | `-145 m` to `190 m` |
| Planning grid | 381 × 336 cells at 1 m |
| Protected performer action radius | 4.5 m |
| Viewer interactive orbit cap | 25 m |
| Default audience camera XZ | `(0, -21.5)` |

The world is large in metres but visually compact because the camera stays
inside a 25 m orbit. Near, middle, and far depth therefore need strong angular
separation and occlusion, not merely large coordinate differences.

### Plan hierarchy

| Scale | Typical span | Owner | Ember use |
| --- | ---: | --- | --- |
| Macro | 50–300 m | shield slope, rift direction, collapse scarp, open horizon, main drainage | Establish the place and gravity before assets exist |
| Meso | 5–50 m | lava lobes, levees, benches, talus fans, eroded contacts, local vent rampart | Explain how the macro forms were made and guide camera depth |
| Micro | 2 cm–5 m | ropes, clinker, vesicles, plate cracks, oxidation, ash, glassy skins | Supply material identity only after macro and meso forms pass |

The common failure is asking micro detail to rescue weak macro design. It
cannot. A photoreal texture on a circular basin remains a circular basin.

### Slope grammar

A basaltic shield is broad and comparatively gentle. Drama should be
concentrated in localized scarps, cone/rampart remnants, lava banks, and
collapsed blocks. The longitudinal drainage must remain downhill at its
decisive scale, but small local rises may be overtopped or buried if the
thickness story explains them.

Direction A's authored source-to-terminus profile is 314.1 m long, descends
22.6 m, and averages 7.2%. Its modeled channel bed is strictly descending. The
larger terrain rises sharply only in the older western/northwestern scarp.

### Negative-space grammar

The quiet zones are functional:

- the 4.5 m action envelope protects choreography;
- the open east/southeast horizon keeps the scene from becoming a room;
- a low visual corridor links audience, performer, bench-side flow, and distant
  source;
- the dominant western mass provides scale and identity without wrapping the
  viewer;
- the lava footprint carries the eye through the environment and out of frame.

## Lava formation from source to terminus

One lava system should have a readable sequence of reaches.

### Reach 1: source fissure and proximal rampart

The source is a linear or segmented fissure associated with the rift, not a
symmetrical mountain centered in the background. Spatter, agglutinate, and a
low rampart may accumulate locally. The first visible lava is narrow and highly
active because transport is concentrated.

### Reach 2: confined proximal channel

Topography and self-built levees constrain the flow. Banks are irregular and
locally overtopped. The surface may carry dark rafts even while hot material is
visible along shear margins and at gaps. Parallel, equally high, continuous
banks would read as civil engineering and must be rejected.

### Reach 3: bench-side deflection

The flow encounters the older performance surface and follows the lower route
around it. This is where Ember's stage relationship becomes believable: the
lava does not form a moat, and the bench does not interrupt gravity merely to
frame the performer. Direction A's hand-plan conservative edge clearance is
4.95 m beyond the protected action envelope.

### Reach 4: slope break, ponding, and overflow

Where gradient decreases, the footprint widens and thickens. Local ponded zones
feed breaches or overflows. This is a valuable spectacle point because it
creates exposed heat for a physical reason rather than adding a random bright
patch.

### Reach 5: distributary lobes and terminal toes

The downstream field becomes overlapping units with distinct advance histories.
A pāhoehoe-dominant version expresses inflated sheets, ropes, toes, tumuli, and
breakouts. A more disrupted or cooled reach may transition into ʻaʻā clinker.
The reverse transition should not be used casually; the normal downstream
progression is from smoother to more disrupted morphology as cooling and shear
increase.

### Geometry consequences

The final runtime geometry needs multiple owners composed into one system:

1. a terrain-conforming **footprint/thickness field**;
2. a static or slowly deforming **crust body** with banks and lobes;
3. sparse dynamic **molten exposure surfaces** at margins, gaps, skylights, and
   breakouts;
4. **crust plates or clinker** that translate/rotate according to local flow;
5. contact effects such as bounce light, haze, smoke, and steam tied to the
   same footprint.

The solver output should drive items 1 and 2. It should never ship directly as
the render mesh, and a new centerline ribbon should not regain ownership of the
footprint.

## Thermal and shading grammar

Real active lava is thermally heterogeneous. Research anchors support this
ordering:

| Thermal state | Approximate reference range | Visual job |
| --- | ---: | --- |
| Exposed incandescent interior | above ~1050 °C | near-white/yellow micro-area at tears, gaps, and new breakouts |
| Hot deforming skin | ~750–900 °C | orange/red transitional zones near active exposure |
| Coherent cooling crust | below ~750 °C | dominant dark red-brown to black surface |
| Cooled margins / old substrate | can fall below ~175 °C | non-emissive basalt carrying reflected light and oxidation |

Erta Ale observations also report active cracks around 700–1070 °C while plates
may sit around 300–500 °C. These values are reference ranges, not a direct
shader calibration.

### Render rules

- Emissive area stays subordinate to dark crust area.
- Intensity peaks are small, sharp, and mechanically located.
- Broad illumination comes from bounced color, haze, and exposure response,
  not a uniformly white river.
- Flow velocity and UV motion follow local downhill direction or solver-derived
  vectors. A single longitudinal scroll will expose the old ribbon abstraction.
- Crust motion is slower than the exposed liquid beneath it. Plates raft,
  collide, tear, rotate, and sometimes founder.
- Levee faces and old banks receive heat from nearby active material but are not
  themselves uniformly emissive.
- Bloom and heat distortion are finishing effects. They cannot define the
  footprint or hide its shape.
- Local lights are sparse samples of the hottest regions, bounded by quality
  tier and chosen for performer/terrain interaction rather than even spacing.

### Runtime layering proposal

| Layer | Suggested representation | Update rate |
| --- | --- | --- |
| Old terrain and cooled flow field | optimized GLB, world-space material masks | static |
| Active crust body | footprint-derived mesh with thickness and lobe silhouette | static or very slow vertex deformation |
| Molten exposures | narrow indexed meshes or decals tied to fracture/shear masks | shader time |
| Rafted plates / clinker | instanced geometry with bounded motion families | low-frequency CPU/GPU update |
| Heat haze, smoke, embers | depth-registered quality-aware effects | quality-tier dependent |
| Sampled bounce lights | a few lights at source, bench-side breach, and slope-break event | throttled / static positions |

## Measured reference: Mauna Loa 2022

The USGS final DEM and thickness dataset provides a useful reality check because
it shows a complete basaltic eruption footprint over real terrain at 3.053 m
horizontal resolution. The tracked diagnostic board samples the published
rasters without committing the large files to Git.

At the study's `>0.5 m` diagnostic threshold, the downsampled positive sample
has a median thickness of 4.447 m and a 90th percentile of 11.396 m. Those
values do not become Ember's literal thickness budget. They establish that an
active flow field is a substantial topographic body with internal thickness
variation, not a thin emissive decal.

The reference transfer is qualitative and structural:

- follow drainage at macro scale;
- allow branching and reconnection;
- thicken where movement slows or units stack;
- show discrete flow units at the margins;
- keep surface form different from a perfectly smoothed channel;
- do not copy the measured footprint into Ember.

See [the source ledger](geology-research-source-ledger.md) and
`evidence/gate-1-geology-restart-r1/usgs-mauna-loa-2022-reference-board.png`.

## Open-source simulator result

Flowy and MrLavaLoba2 were built or installed and run against the exact same
Direction A terrain. The shared benchmark used:

- 381 × 336 cells at 1 m;
- source `(-72, 137)`;
- 8 independent flows × 250 lobes;
- 20 m² lobe area;
- 8,000 m³ total volume;
- NumPy/random seed 6301 where the implementations expose or inherit it;
- identical high-level thickness, slope, inertia, and lobe parameters.

| Result | Flowy | MrLavaLoba2 |
| --- | ---: | ---: |
| Active footprint above 0.05 m | 5,089 m² | 4,865 m² |
| Volume above threshold | 7,995 m³ | 7,952 m³ |
| Mean active thickness | 1.57 m | 1.63 m |
| Median active thickness | 1.38 m | 1.47 m |
| Maximum thickness | 5.00 m | 6.17 m |
| Maximum planar distance from source | 165.7 m | 160.3 m |
| Clearance beyond 4.5 m action envelope | 4.4 m | 6.3 m |
| Reported solver time | 0.007 s | 8.5 s |
| Measured wall time | 0.694 s | 27.136 s cold run |

The footprints have **78.0% intersection-over-union**, with a thickness
correlation of **0.757** across their combined active area. Whole-grid mean
absolute thickness difference is **0.029 m**. The timing comparison is
directional because Flowy ran as a compiled WSL executable while the
MrLavaLoba2 cold run included Numba compilation and export.

This result does not validate the invented terrain as real geology. It does
show that two independent emplacement implementations respond to it with a
similar gravity-led footprint. That is enough to graduate lava planning beyond
a hand-drawn spline.

### Tool decision

Use **MrLavaLoba2** as the reproducible baseline because Apache-2.0 is the clean
permissive license among the tested solvers. Keep **Flowy** as the much faster
offline iteration and cross-check tool without incorporating its GPL-3.0 code
into the app. Use **BlenderGIS** only as a manual geodata bridge. Treat
**Infinigen** and **TerraForge3D** as pattern/reference laboratories, not new
core dependencies.

The benchmark board is
`evidence/gate-1-geology-restart-r1/lava-simulator-comparison-board.png`.

## The three plan directions

All candidates share the world, performer, and orbit contract. Scores are
directional research estimates on a 1–5 scale and require a real graybox.

| Candidate | Geologic thesis | Measured result | Strength | Chief risk |
| --- | --- | --- | --- | --- |
| **A. Breached Rift Bench** | New fissure flow escapes a breach beside an older western collapse scarp, skirts the bench, and widens after a southern slope break. | 314.1 m route, 22.6 m descent, 7.2% average grade, 8/8 clear sightline samples, 4.95 m hand-plan edge clearance. | Best causality, hierarchy, exposed lava, and remaining-credit efficiency. | The breach can become a decorative arch unless bedding, talus, and flow contacts all agree. |
| **B. Perched Channel Terraces** | Three benches create acceleration, ponding, overtopping, and renewed channelization. | 326.9 m route, 28.0 m descent, 8.6% grade, only 4/8 sightline samples clear, 4.51 m edge clearance. | Strongest visible lava sequence and repeated slope-break events. | It easily becomes stairs, canals, or a designed aqueduct; west/rear orbit is already compromised. |
| **C. Inflated Rift Apron** | Most transport is concealed in an insulated tube; skylights, tumuli, pressure cracks, and terminal breakouts expose heat. | 304.4 m route, 16.0 m descent, 5.3% grade, 8/8 sightline samples clear, only 1.70 m edge clearance. | Most natural pāhoehoe story and best camera resilience. | Sparse exposed heat may undersell Ember, and the flow approaches the protected envelope too closely. |

Direction A leads because it gives Ember fire spectacle for physical reasons
without giving up the open-world read. Direction B is valuable as an adversarial
test for levees and slope breaks. Direction C should influence A's downstream
lobe field and crust behavior even if its mostly concealed-tube composition is
not selected.

The full measured comparison is
`evidence/gate-1-geology-restart-r1/ember-geology-gate1-directions.png`.

## Composition contract for Direction A

### Dominant mass

One older collapse scarp occupies the west/northwest. Its asymmetry does three
jobs: establishes geological history, gives the world a recognizable
silhouette, and creates a high source-side frame without surrounding the stage.

### Open horizon

The east and southeast remain comparatively low and open. Atmosphere and far
shield slopes may layer this horizon, but a second giant wall or symmetrical
mountain must not close it.

### Lava path

The source begins against the older scarp, crosses the failed crown, and enters
a main drainage that skirts the protected performer area. A secondary breakout
lobe may die where the slope loses energy; it must not be described as a
reconnection unless the simulator proves one. The main deposit settles in a
shallow inboard southern low behind a containing lip rather than disappearing
through the DEM boundary. The eye therefore travels source → breach → channel
→ performer relationship → breakout/main drainage → terminal low.

### Camera behavior

The default audience view must make the source, breach, initial drainage, and
performer relationship clear without labels. The north-up plan, measured
section, and whole-scene director view own the complete route to the inboard
terminal low. Side
views discover different contacts and depth layers. Rear views may be quieter,
but the performer must remain legible and the terrain must remain continuous.
The target is not eight equally poster-like views; it is one intentional hero,
several strong discoveries, and no broken orbit sector.

### Performer integration

The bench is an old, cooled unit with locally reduced slope. Its material
continues outward. Edge fractures, ash, and small relief may approach the action
zone, but no hot surface or structural obstruction enters the 4.5 m envelope.
The surface must not acquire a circular border, radial cracks, or a different
shader solely to announce “stage.”

## What survives and what changes

| Disposition | Existing work |
| --- | --- |
| Preserve | `Environment3D.svelte` lazy-loading boundary; `EmberScene.svelte` as scene-composition owner; loading/readiness/error behavior; front-stage performer heading; responsive stage clearance contract; R9/R11 ground material and texture research; Blackglass atmosphere, haze, plume, particle, and lighting systems where they remain compatible. |
| Reuse selectively | The four existing Meshy geology modules, only where their bedding, burial, scale, and age fit the new plan. They are assets, not mandatory landmarks. |
| Refactor | Scene config from a fixed 17-point river into a terrain/flow manifest containing footprint, reach masks, thickness ranges, source events, and thermal zones. |
| Replace | Current production GLB's macro terrain; circular/basin composition; stage-to-terrain transition; old landmark placement; `lava-river-geometry.ts` as footprint owner. |
| Retire | Any arbitrary hot stripe, duplicate source, decorative channel branch, symmetric wall, terrain-hiding fog, or feature whose only defense is a single camera angle. |

This is a controlled restart. It preserves hard-won runtime systems while
refusing to let sunk-cost geometry dictate the new landscape.

## Meshy 7 strategy

The 40 remaining credits support one normal multi-image model-plus-texture job
at the audited 25 + 10 credit schedule, leaving only a small margin. They should
not be spent on generic rocks.

The best candidate is the **older collapsed scarp / breached levee landmark**
after the plan and graybox are locked. It is both visually dominant and hard to
fake with repeated primitives. The generation package should include:

- one plan/contact diagram defining the terrain plane and burial line;
- front, three-quarter, and side views with identical silhouette;
- a scale bar and target bounds;
- visible old-flow bedding or column orientation only where geologically
  justified;
- talus/contact notes that explain how the model embeds into terrain;
- negative prompts against arches, castles, crystal spikes, symmetrical gates,
  freestanding plinths, and isolated boulders.

The model must be judged untextured first for silhouette and contact. A strong
surface on an unusable arch is still unusable. No credits are committed until
the graybox proves where this asset belongs.

## Production plan after spatial approval

### Gate 1: approve one measured plan

Review the three bird's-eye boards, vertical sections, action clearances, and
orbit sightlines. Approve, reject, or hybridize the spatial direction. Direction
A is the current recommendation.

### Gate 2: build the real graybox

Create one terrain height field and massing model from the approved plan. Use
the selected simulator thickness raster as the visible deposit owner. Use flat
diagnostic materials. Capture the default audience, 45° increments around the
orbit, north-up plan, longitudinal section, and director overview. Do not build
final lava materials or spend Meshy credits.

Gate 2 passes when:

- the performer stands on an attached old-flow peninsula, not a radial island;
- one dominant mass and one open horizon remain legible;
- the drainage is downhill and avoids the action envelope;
- any flow bifurcation is described exactly as the simulator proves it;
- an actual inboard terminal low and containing lip are visible in plan and
  whole-scene evidence, and the deposit does not touch the south world edge;
- no view exposes a world edge, artificial ring, or empty set back;
- the audience view communicates source-to-breach-to-initial-drainage without
  labels; plan, section, and director evidence communicate the full route.

### Gate 3: register the visual target

Develop crust/ash/scarp materials and a physically ordered thermal look on the
approved geometry. Compare at least one more-real and one more-mythic heat
interpretation from the same cameras. Lock a target only after silhouette,
value hierarchy, and surface scale all agree.

### Gate 4: author the production slice

Build the optimized terrain and footprint-derived lava body. Convert solver
thickness into art-directed lobes, levees, plates, and exposed zones. Generate
the single Meshy landmark only if the approved plan still needs it. Preserve
one capability owner per behavior.

### Gate 5: integrate and verify runtime

Replace the production asset/config through the existing Ember scene owner.
Measure load size, triangle counts, texture budget, frame time, shader cost,
console state, and complete orbit behavior at required viewports and quality
tiers. Check motion at normal playback and during camera orbit.

### Gate 6: final visual acceptance

Acceptance requires side-by-side registered target/runtime captures, the full
orbit, performer scale checks, and direct confirmation that the environment
reads as a volcanic place rather than a decorated stage.

## Acceptance tests that matter

### Geology

- A reviewer can point to the old unit, collapse event, new fissure, transport
  path, ponding/breach, and downstream field without inventing missing causes.
- Column orientation, bedding, talus, oxidation, ash, and lava contacts agree
  with relative age and gravity.
- Large forms remain readable in untextured clay and plan view.

### Lava

- One source feeds one continuous downhill drainage.
- The footprint is not constant-width and does not terminate as a rounded
  ribbon cap.
- Banks, overflows, pools, and toes occur because slope or confinement changes.
- Most of the surface is crust; hottest pixels occupy mechanically active zones.
- Motion is visible but materially differentiated: liquid, skin, plate, clinker,
  smoke, and light do not move as one layer.

### Composition

- Default audience view has a clear dominant mass, performer, lava route, and
  open horizon.
- Eight orbit samples preserve performer visibility and world continuity.
- Rear views may be quieter but cannot reveal a backdrop seam or isolated
  diorama island.
- The 4.5 m action envelope remains structurally and thermally clear.

### Runtime

- Environment load and error states remain owned by existing shared systems.
- Static geology is batched/optimized; repeated rubble and clinker use
  instancing where appropriate.
- Dynamic molten geometry and lights are bounded by quality tier.
- Frame-time evidence is captured during visible lava motion, not on a paused
  frame.
- Reduced visual quality changes density, not the geological story or main
  footprint.

## Risks and honest uncertainties

- Direction A's breach can regress into another giant arch. The graybox must
  show a broken scarp with asymmetric bedding, talus, and a credible missing
  volume, not a freestanding portal.
- Historical R1 and R2 risk: earlier simulator evidence either stopped short or
  used false continuation semantics. Gate 1.1 R3 resolves that contradiction
  with a five-run morphology sweep; the selected footprint reaches the named
  inboard terminal basin, keeps its nearest visible cell support 9.618 m from
  performer center, preserves 5.118 m beyond the action envelope, and contains
  39 observable branched rows. The nearest active cell center is 10.198 m away;
  that center-sample value is not used as the clearance claim.
- Simulator agreement is encouraging but not geological validation. Both models
  inherit related elliptical-lobe assumptions and the same invented DEM.
- A 1 m planning grid cannot own sub-meter crust form. It is a macro/meso guide.
- Realism and Ember's fire identity can conflict if crust coverage becomes too
  visually quiet. The answer is decisive local exposure and light interaction,
  not turning the whole footprint neon.
- Existing Meshy assets may fail the new age/contact logic. Preserving them is
  optional; preserving the runtime asset pipeline is not.
- Browser constraints may force selective abstraction. Geological causality and
  silhouette survive; micro-detail density is the first thing to scale down.

## Non-goals of this research pass

- no production GLB or Blender scene replacement;
- no runtime code or shader edits;
- no claim that Direction A has been approved;
- no hazard prediction or reconstruction of a named eruption;
- no direct import of USGS terrain into Ember;
- no open-source simulator code added to the application;
- no Meshy generation or credit spend.

## Evidence package

- `evidence/gate-1-geology-restart-r1/ember-geology-gate1-directions.png`
- `evidence/gate-1-geology-restart-r1/a-breached-rift-bench-measured-board.png`
- `evidence/gate-1-geology-restart-r1/b-perched-channel-terraces-measured-board.png`
- `evidence/gate-1-geology-restart-r1/c-inflated-rift-apron-measured-board.png`
- `evidence/gate-1-geology-restart-r1/ember-geology-gate1-report.json`
- `evidence/gate-1-geology-restart-r1/usgs-mauna-loa-2022-reference-board.png`
- `evidence/gate-1-geology-restart-r1/usgs-mauna-loa-2022-reference-report.json`
- `evidence/gate-1-geology-restart-r1/lava-simulator-comparison-board.png`
- `evidence/gate-1-geology-restart-r1/lava-simulator-comparison-report.json`

Reproduction scripts:

- `scripts/build-ember-geology-study.py`
- `scripts/analyze-ember-lava-reference.py`
- `scripts/prepare-ember-lava-simulator-benchmark.py`
- `scripts/render-ember-lava-simulator-comparison.py`

The [source ledger](geology-research-source-ledger.md) records all measured,
scientific, production, repository, licensing, and Meshy references used by the
study.

## Historical Gate 1.1 R3 correction evidence

The R1 and R2 adversarial audits and corrective authorizations are recorded in
museum tracker items `xSjtvI2XVvvMdn8pHqwP`, `WS9FU4nn2fCSbOn68IeB`,
`torsiCoIaMMrkMklUMSq`, and `lIPwVa2kGFcoQsgICkWI`. The current north-up plan,
sections, sightlines, simulator sweep, contact sheet, canonical report, and
selected float32 footprint live in
`evidence/gate-1-1-geology-amendment-r3/`. Reproduce them with:

- `py -3 scripts/prepare-ember-lava-simulator-benchmark.py all-r3`
- `py -3 scripts/build-ember-geology-amendment.py build`
- `py -3 scripts/build-ember-geology-amendment.py verify`

Direction A remains the accepted creative direction. Gate 1.1 R3 is
`ready-for-review` with approval unset; Gate 2 remains pending. Gate 3 has not
started.
The R3 correction changes no production runtime, final material, atmosphere,
or Meshy asset and spends no Meshy credits.

## Historical Gate 1.1 / Gate 2 R4 evidence

Austen's tracker decision `BvN1DiylOnfdbrofcwaM` rejects the R3 broad-basin
spatial target. The current R4 plan, 1:1 vertical section, opposite-side runtime
orbit proof, sightline study, simulator sweep, contact sheet, canonical report,
and selected float32 footprint live in
`evidence/gate-1-1-geology-amendment-r4/`. Reproduce them with:

- `py -3 scripts/prepare-ember-lava-simulator-benchmark.py all-r4`
- `py -3 scripts/build-ember-geology-amendment.py build`
- `py -3 scripts/build-ember-geology-amendment.py verify`

Gate 1.1 R4 was approved, then invalidated at Gate 1 by Austen's slope-
continuity correction `Vwm6XTLdDbDfxuoVE7z9`. Gate 2 R4 evidence lives in
`evidence/gate-2-geology-graybox-r4/` and remains historical under tracker
`lXhTllDFV2Ne1E7foCkS`. The R4 pass changed no production runtime, final
material, atmosphere, Meshy asset, or Meshy credit.

## Gate 1.1 R5 slanted-flank correction evidence

R5 answers Austen's accepted broad-ledge rejection
`Vwm6XTLdDbDfxuoVE7z9` while preserving the colossal vertical-world direction.
The north-up plan, true-scale compound section, opposite-side runtime orbit
proof, eight-point sightline study, fresh Flowy sweep, contact sheet, canonical
report, and selected float32 footprint live in
`evidence/gate-1-1-geology-amendment-r5/`. Reproduce them with:

- `py -3 scripts/prepare-ember-lava-simulator-benchmark.py all-r5`
- `py -3 scripts/build-ember-geology-amendment.py build`
- `py -3 scripts/build-ember-geology-amendment.py verify`

The 4.5 m action envelope has 0.205 m relief and a 1.286 degree median slope.
The surrounding 8-25 m annulus has a 9.188 degree median slope, the old-flow
contact has an 8.209 degree median slope, and only 92 m² within 35 m is below
two degrees. Fresh Flowy calibration `r5f-c03-braided-20m2` keeps 7.097 m of
clearance beyond the action envelope and exits the south boundary continuously.

Gate 1.1 R5 is `ready-for-review` with approval unset. Gate 2 is pending. The
R4 Gate 1 approval and Gate 2 graybox are historical because the terrain and
sightlines changed. No production runtime, final material, atmosphere, Meshy
asset, or Meshy credit changed.

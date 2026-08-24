# Blossom R2.1: Moonlit Hanami Amphitheater

Status: **rejected on visual review, 2026-08-23**  
Production changes: **blocked — no new authoring on this plan**  
Governing contract: `blossom-masterplan-r2.json`

## Why R2.1 is rejected

The built result passed every geometric check in this contract and still failed
visual review. Austen's verdict on the 2026-08-23 overview screenshot
(`docs/superpowers/specs/handoff-assets/2026-08-23-blossom-scene-rebuild/current-overview.png`,
preserved in commit `03eafb1997e7`): the enlarged site solved edge exposure but
destroyed intimacy, hierarchy, and the moonlit hanami atmosphere. The stage is a
tiny marker in an oversized graybox, the terrain is an undifferentiated brown
field, the river reads as a flat extruded trench, the paths sprawl without an
arrival sequence, the lanterns read as debug dots, the torii stayed primitive,
and the absent grove leaves no canopy or enclosure.

The lesson this document must carry forward: the validator below measures
declared geometry, connectivity, safety, and containment. It cannot measure
composition, intimacy, material quality, or beauty, and its green result was
wrongly treated as design approval. The existing build renders only for
comparison until a replacement composition — with canopy masses present from the
first spatial review — earns Austen's explicit visual approval.

## Why R1 and the first R2 draft are rejected

R1 capped Blossom at two trees, supplied no audience area, omitted most circulation, placed a narrow flat river behind the stage, and left the terrain edge inside the usable camera range. Fixing isolated collisions inside that layout cannot produce a coherent place.

The first R2 draft established a substantially better composition, but its validator trusted labels more than geometry. An adversarial review proved that the free camera could leave the terrain, audience access was not physically connected, lantern pads occupied walking surfaces, the stage lacked flow-arts safety requirements, and koi habitat circles extended beyond the river.

R2.1 keeps the strong south-to-north composition and replaces those assumptions with measurable geometry.

## Spatial thesis

Blossom is a moonlit hanami amphitheater inside an established cherry grove. The scene reads in four layers from south to north:

1. Physically connected arrival paths and a 136-person audience crescent.
2. A twelve-by-eight-metre performance stage with spin, toss, backstage, prop-storage, technical, and emergency clearances.
3. A broad living river with two widened koi pools and a clear west-side bridge.
4. A reachable shrine walk and detailed torii enclosed by sixteen hero trees, 36 midground trees, and 72 horizon trees.

The clearing is not a circular patch, and the river is not a decorative stripe. Terrain, circulation, performance operations, vegetation, water, architecture, atmosphere, and camera controls all belong to one site plan.

## The measured R2.1 plan

| System      | R2.1 contract                                                                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Terrain     | 256 × 264 m authored terrain; 80 × 84 m playable clearing; 32 m wooded transition and a PlantFactory-derived horizon shell    |
| Camera      | 4.5–82 m orbit range; complete legal envelope `x -121.6…121.6`, `y -115.6…135.6`; 12 m frustum-ground margin                  |
| Stage       | 12 × 8 m deck; 18 × 16.5 m protected clearance; 6.5 m overhead toss volume                                                    |
| Operations  | 12-performer spin and 8-performer toss modes; east backstage route; prop storage; technical position; two emergency corridors |
| Audience    | Four area-derived zones; 136 total capacity; four wheelchair bays with four companion positions                               |
| Circulation | Twelve public paths joining thirteen physical nodes; XYZ elevations; ≤5% running slope and ≤2% cross slope                    |
| Service     | Two restricted routes; backstage and technical access kept out of public circulation                                          |
| River       | 5.4 m base width; 1.4 m bank transition; two contained widened pools; visible bed and 1.1–1.2 m habitat depth                 |
| Bridge      | 10 × 2.8 m; dedicated clear landing on each bank; measured canopy and furniture clearances                                    |
| Grove       | Sixteen hero anchors with eleven controlled variant slots; 108 additional PlantFactory midground and horizon instances        |
| Torii       | 11.5 × 6.2 m detailed timber threshold reached by the shrine walk                                                             |
| Life        | Two contained koi habitats; localized petal sources; petals over the stage capped at 14%                                      |
| Atmosphere  | Peak spring bloom at 20:30; full moon; warm path lanterns; wooded horizon                                                     |

## Adversarial corrections

### Complete camera coverage

The terrain now covers the pan-target corners plus the horizontal component of an 82 m orbit at the maximum polar angle, followed by a 12 m ground-frustum margin. Validation derives this envelope from the controls rather than trusting the declared bounds or five preset cameras.

### Physical circulation and accessibility

Every path has a `from` node, `to` node, XYZ centerline, width, and cross slope. Endpoints must coincide with their nodes, audience access nodes must fall inside their audience polygons, and all thirteen public nodes must be connected through public paths. The central lawn now has a firm access spur.

The accessible overlook is 25.6 m² and contains four explicit wheelchair bays, four companion positions, a 1.8 m turning circle, and a 1.8 m clear aisle. Its capacity is eight, not the unsupported ten in the first draft.

### Lantern furnishing bands

Lantern coordinates are derived from their path segment, side, path width, pad radius, and edge clearance. Pads cannot occupy walking surfaces. Bridge lanterns additionally clear the landing rectangles.

### Flow-arts stage operations

The stage contract now defines:

- a twelve-performer ensemble-spin mode;
- an eight-performer ensemble-toss mode;
- prop reach radii and a 6.5 m overhead safety volume;
- a 6.5 m minimum audience setback from the deck;
- a restricted east-side backstage service path;
- backstage staging and prop-storage rectangles;
- a separate technical position and access route; and
- east and west emergency corridors.

The public shrine route remains west of the stage and no longer doubles as backstage access.

### Living water and koi containment

Each koi habitat belongs to an authored river widening. Validation checks the full habitat radius, edge clearance, minimum depth, and distance from the bridge. Checking the habitat center alone is no longer sufficient.

### Sightlines and capacity

Audience capacity is derived from polygon area after circulation reserve and area-per-person rules. Wheelchair capacity comes from explicit bays and companion positions.

Nineteen representative audience viewpoints are tested against nine targets distributed across the stage width, depth, performer height, and overhead action area. The resulting 171 three-dimensional rays test PlantFactory trunks, canopy volumes, and lantern bodies. The seated lawn additionally validates rear-row sightlines over forward audience heads.

### Established grove instead of a sparse ring

The sixteen foreground anchors are the hero layer, not the entire forest. Thirty-six midground trees and seventy-two horizon trees close the wider landscape. Eleven hero variant slots are assigned across the sixteen anchors, with no hero variant used more than twice.

Only `open-crown-s19` and `open-crown-s71` currently pass the PlantFactory integration gate. The remaining nine named slots require approval across:

- two broad mature variants;
- two asymmetric middle-aged variants;
- three airy young variants; and
- two waterside weeping variants.

Meshy trees and procedural blossom blobs remain prohibited.

## Ground and ecology rules

The ground is divided by use, not by visible geometric patches:

- The stage and access apron use timber and stone with no vegetation intersections.
- Audience polygons use short resilient turf, not tall grass clumps.
- Public paths use compacted stone fines with 0.35 m grass-free shoulders.
- River banks transition through stone, moss, and reeds outside the water surface.
- Tree root zones use leaf duff, moss, and low forbs.
- Wind-reactive mixed grass is allowed only outside water, paths, audience zones, stage clearance, lantern pads, bridge landings, and trunk flare zones.

## Runtime migration ownership

R2.1 will not become another coordinate-heavy monolithic GLB builder. One scene entry point remains, while five pure domain modules own the plan:

| Owner                         | Responsibility                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| `blossom-site.ts`             | Terrain, grades, audience landform, circulation masks, and destination geometry    |
| `blossom-stage-operations.ts` | Performance modes, safety volumes, service access, storage, and technical position |
| `blossom-water.ts`            | River, pools, bed, banks, bridge, and fish habitat bounds                          |
| `blossom-grove.ts`            | Variant assignments, hero anchors, background layers, LODs, and budgets            |
| `blossom-atmosphere.ts`       | Moon, lantern lighting, canopy-local petals, wind, and fireflies                   |

The migration order is:

1. Add pure R2.1 geometry modules and parity tests without switching the runtime.
2. Teach `build-blossom-environment.py` to consume those modules instead of the R1 JSON contracts.
3. Switch `BlossomScene.svelte` to the R2.1 asset and runtime masks.
4. Remove R1 adapters only after multi-angle parity proof.

The builder may orchestrate exports, but it may not own duplicate coordinates or geometry rules.

## Delivery order

1. **Spatial contract**: approve this corrected floor plan.
2. **Terrain and water graybox**: build landform, audience grading, physical paths, river volume, widened pools, bridge, service routes, and camera envelope without decorative planting.
3. **Architecture and access**: finish bridge landings, accessible surfaces, lantern pads, operational zones, and the replacement torii.
4. **PlantFactory grove**: approve nine new variants, then place hero, midground, and horizon layers within the draw-call and triangle budgets.
5. **Life and atmosphere**: add water motion, koi, canopy-local petals, moonlight, lantern light, and restrained fireflies.
6. **Multi-angle acceptance**: approve the audience, west circulation, east context, north threshold, and top-down views, followed by phone through native 4K layout checks.

Nothing from a later phase may hide a failure in an earlier one.

## Current proof

The generated board is `evidence/blossom-masterplan-r2.png`. The machine-readable audit is `evidence/blossom-masterplan-validation.json`.

The validator currently confirms:

- 136 area-derived audience positions and four wheelchair bays;
- thirteen physical public nodes connected by twelve public routes;
- two restricted service routes separated from public stage access;
- accessible running and cross slopes;
- spin, toss, prop-reach, overhead, storage, technical, and emergency volumes;
- all sixteen hero-tree anchors clear of paths, stage, bridge, and landings;
- eleven controlled hero-tree variants and 108 background instances;
- eight lantern pads outside walking surfaces;
- two full koi footprints inside widened water;
- 171 unobstructed three-dimensional sightline rays;
- the complete legal camera orbit inside authored terrain; and
- production still locked behind this approval gate.

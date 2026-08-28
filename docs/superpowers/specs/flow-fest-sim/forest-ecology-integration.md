# Flow Fest Sim forest ecology integration

Status: implementation complete, acceptance revision ready for review
User direction: `The forest scene has all the trees and grass and systems we need for this.`
Museum tracker decision: `y42EDiLshaxxwhYWqAc1`

## Ownership contract

Flow Fest reuses the accepted Forest Scene ecology stack around the checked
Earth site. It does not reuse the Forest Scene's fictional 180 metre clearing
layout or recenter the geospatial world.

| Concern | Owner | Flow Fest adaptation |
| --- | --- | --- |
| Terrain height and axes | Flow Fest Gate 2 DTM | Unchanged one-metre checked terrain, x east, y up, z south |
| Tree coordinates | Flow Fest LiDAR canopy evidence | 427 deterministic local canopy peaks, route and clearing exclusions retained |
| Tree geometry | Forest Scene and PlantFactory bridge | Twelve production families are instanced at Flow Fest coordinates; high-detail PlantFactory families remain sparse accents |
| Grass geometry | Forest Scene ground ecosystem | Forest summer-sward and woodland-grass prototypes are extracted from `forest-near-frame.glb` and instanced on measured terrain |
| Grass motion | `ForestClearingWind` | Rooted wind patches run on all six Flow Fest grass tier/species batches |
| Ground habitat | Forest Scene ground-life catalog | Damp sedge and hazel assets are deterministically placed under LiDAR canopy evidence |
| Lighting | `ForestLighting` | The shared rig follows the active player/review-camera anchor with a 92 metre site-scale key-light distance |
| Sky and atmosphere | Forest Scene sky and palette contracts | Existing Flow Fest clock drives the shared sky and Forest-derived material response |

## Source classification

- Terrain coordinates and elevations are measured.
- Tree centers are LiDAR-derived interpretations. They are not surveyed trunks,
  species records, or final arborist truth.
- Tree species assignment, grass, sedge, and hazel placement are authored visual
  ecology constrained by measured terrain, LiDAR, registered clearings, and all
  canonical travel corridors.
- Festival tents, vehicles, people, fire circle, and LED circle remain authored
  festival fiction.
- The unresolved bridge and permanent structures remain absent.

## Asset provenance

- Four natural tree families and the Forest ground-life assets retain the
  Forest Scene's Poly Haven CC0 provenance.
- Seven PlantFactory families use the existing PlantCatalog embedded-use
  production bridge: horse chestnut, urban oak, colonised oak, willow, two red
  buckeye forms, and a standing-dead habitat snag. They ship only as in-scene
  runtime assets, not as standalone redistribution products.
- The `flowFestBiomeR2` qualification set contains nine deterministic
  PlantFactory exports. The new red buckeye pair and habitat snag passed source
  hashing, semantic material checks, fixed-view rendering, triangle budgets,
  and runtime GLB proof.
- `forest-grass-prototypes.glb` is a deterministic two-mesh extraction from the
  accepted Forest near-frame asset. The extraction script records the exact
  source names and produces a 6,032-byte Draco/WebP runtime artifact.

## Acceptance facts

- 427 measured-canopy tree instances across twelve families.
- 34 high-detail PlantFactory accents. The remaining 393 placements use the
  cheaper Forest runtime families.
- 20,798 Forest grass instances across two species and three quality tiers.
- 19 Forest ground-life instances.
- Zero tree, grass, or ground-life intrusions into registered travel corridors.
- Five registered 65 degree review cameras remain coordinate-locked.
- Seven retained desktop, tablet, landscape, and phone captures are nonblank
  and preserve the night-heart composition.
- The stable 4K browser sample retained 60 Hz pacing at 16.8 ms p95 and 33.3 ms
  p99. The tree layer accounts for 107 batches and 13.63 million instanced
  triangles. The full festival scene reports 672 draw calls and 40.76 million
  rendered triangles, including its animated avatars and props.

## EUC steep-terrain correction

The original Flow Fest character controller hard-coded the on-foot 25 degree
slope limit even while mounted. Mounted traversal now uses a separate 42 degree
climb envelope, a 48 degree slide threshold, 0.42 metre autostep, and 0.55 metre
ground snap. The 42 degree target sits inside current manufacturer claims for
high-torque wheels, including Inmotion's 45 to 50 degree model range and V14's
published 50 degree maximum slope.

Collision reconciliation also counts grounded vertical travel. Rapier converts
part of forward velocity into elevation on a slope; treating only horizontal
velocity as successful travel repeatedly erased torque and created the trapped
downhill behavior. Airborne falls remain excluded by a grade-plausibility guard.

The browser regression starts on checked DTM terrain at world `(-193, -100)`
with a 37.06 degree uphill sample. In 2.5 seconds the mounted EUC traveled 13.30
metres, gained 1.22 metres of ground elevation, reached 13.49 m/s, and finished
without collision limiting.

Manufacturer references checked 2026-08-27:

- Inmotion EUC model comparison: <https://eu.inmotionworld.com/pages/eunicycle>
- Inmotion V14 Adventure specification: <https://inmotionworld.com/collections/e-unicycle-e-scooter-no-p6/products/inmotionadventure>
- Begode model specification collection: <https://www.begode.com/pages/theme-lab>

## Known boundary

This is a production ecology owner integration, not a claim that every tree,
path edge, bridge, or campsite prop now matches the real campground. Austen's
future traced placements, field footage, and festival-day observations remain
the authority for those spatial refinements.

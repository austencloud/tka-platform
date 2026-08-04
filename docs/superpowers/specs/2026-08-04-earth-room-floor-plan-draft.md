---
status: draft
value: 3
effort: M
remaining: 'DRAFT floor plan for the Earth room, recommended variant only. Codex review pass pending, then Austen gate, then a real design doc and a graybox plan.'
depends_on: 'docs/superpowers/specs/2026-08-04-vulcan-cave-all-rooms-concepts.md'
plan_path: ''
tags: [museum, vulcan-cave, earth-room, floor-plan, draft]
last_triaged: 2026-08-04
---
# The Earth Room — Floor Plan DRAFT

**DRAFT. Not approved, not executor-ready.** A Codex review pass follows, then
Austen's gate. Concept sheet with all three variants:
`static/sketches/2026-08-04-earth-room-floor-plans.html`.

Direction approved by Austen 2026-08-04: keep "The Weight" mechanism (the only
room viewed from above, barrier is a vertical drop, no way down) and re-skin it
as lush nature — a grass-and-wildflower gully the visitor wades through, opening
onto a canyon overlook whose terraced levels recede past the performers into
haze.

Recommended variant: **Plan B (The Balcony and the Open North), with Plan A's
rim circuit closed across the parapet.**

## One paragraph

The visitor leaves the First Fire and wades east down a grass gully, stems at
hip height, one bend that kills Fire's light. The ground opens on the left and
they are standing on a ledge with three figures six metres below and slightly
behind them. Walking the rim rotates the trio into three-quarter view, brings
the aven's dust column into frame, and lands at a fallen slab cantilevered three
metres into the void. Its first metre is the protected viewing apron; the
fractured outer two metres are a blocked scenic nose. From that line, the three
figures hit one downbeat, hands converging
to a point each, and beyond them the canyon dropping away shelf after shelf into
haze. There is no stair. The rim goes all the way round and never offers one.
Exit south-east to Air.

## Performers

GGGG, HHHH, IIII — Tog-Same, beta-to-beta. Three stations on the lower floor,
read simultaneously from above. Step data transcribes the catalog's
`tnd-tog-same-*` entries from `static/data/hero/tnd-base-words.json`; per
`reference_tnd_catalog_variation_authority`, the catalog is the variation
authority, not the generator default. Transcription is a later phase, not this
document.

## Station table (recommended variant)

Bay ≈ 34 m east–west × 24 m north–south: a 10 m gully strip plus a 24 × 24 m
chamber. Museum datum = 0. Enter west (`fireToEarth`, door at datum 0, matching
Fire's `DOOR_Y`), exit south (`earthToAir`, `alignment: "end"` — the notch sits
at the east end of the south wall).

| # | Station | Dims | Floor Y | Walkable |
|---|---|---|---|---|
| 1 | Gully mouth from Fire | 4 m wide, 6 m run | 0 → −0.7 (`ramp-x`) | yes |
| 2 | Gully bend and lower run | 4 m wide, 5 m run | −0.7 → −1.4 (`ramp-z` then `ramp-x`) | yes |
| 3 | North ledge (arrival) | 2.6 m wide, ~20 m long | −1.4 | yes |
| 4 | Boulder parapet, north | 0.90 m high, ~24 m long | — | blocked |
| 5 | West / south / east rim | 3.2 m wide | −1.4 | yes |
| 6 | Slab overlook, south rim | 4 × 3 m overall; inner 1 m viewing apron, outer 2 m blocked nose; 0.45 m lip at the viewing line | −1.1 (0.3 m ramp up from the rim) | apron only |
| 7 | Void | ⌀ 14 m | — | blocked |
| 8 | Performer floor disc | ⌀ 14 m | −7.4 | blocked |
| 9 | Bosses G / H / I | ⌀ 2.5 m each, 4.0 m apart, line 2.0 m south of the void centre | −7.25 | blocked |
| 10 | Canyon shelves, north | 4 bands beyond the parapet, receding | −10.5 / −14.5 / −19.0 / −25.0 | blocked |
| 11 | Exit ramp to Air | 4 m wide, 6 m east–west run along the south rim | −1.4 → 0 (`ramp-x`) | yes |

Rim circuit ≈ 46 m, continuous. The parapet replaces the north wall; the ledge
runs along its inside face so the circuit never breaks. Each boss carries a
shallow carved concentric ring so the beta-to-beta convergence lands on a
visible target from above.

## Section profile

```
   0.0   gully mouth / Fire door
  −0.7   gully mid shelf
  −1.1   slab overlook            eye +0.50
  −1.4   rim ring, north ledge    eye +0.20
   0.0   exit threshold / Air door
  −7.25  boss tops   ┐
  −7.4   floor disc  ┘  drop 6.0 m below the rim
 −10.5   canyon shelf 1   ┐
 −14.5   canyon shelf 2   │ blocked, visual only,
 −19.0   canyon shelf 3   │ north of the parapet
 −25.0   canyon shelf 4   ┘  then haze
```

Ceiling: cave roof at about +5 over the rim, opening to an aven above the void
whose shaft lands on the three bosses. Gully ceiling stays low and green-lit,
about +2.6, matching Fire's `CORRIDOR_CEILING_Y`.

## Sightline math

Eye height is floor + 1.60 m (`STANDING_Y` 0.85 + camera 0.75, per the First
Fire design doc). A barrier of height *h*, standing about 0.35 m in front of the
eye, occludes everything steeper than `atan((1.60 − h) / 0.35)`. That is the
whole constraint.

**From the slab viewing line** (floor −1.1, eye +0.50):

- Performers' feet at −7.4 are **7.90 m** below the eye.
- The lip is 1.0 m inside the south edge of the ⌀14 m void. With the eye
  0.35 m behind it and H 2.0 m south of centre, H is **4.35 m** out
  horizontally → required depression `atan(7.90 / 4.35)` = **61.2°**.
- G and I are 4.0 m to either side, so each is
  `sqrt(4.35² + 4.00²)` = **5.91 m** out → **53.2°**.
- Max lip height that still clears 61.2°:
  `1.60 − 0.35·tan(61.2°)` = **0.96 m**.
- Drawn lip: **0.45 m**. Grazing angle `atan(1.15 / 0.35)` = 73.1°, so about
  **12° of margin**. The void's near wall is visible too, which is what makes
  the drop read as a drop.

**From the standard rim** (floor −1.4, eye +0.20):

- Feet are **7.60 m** below the eye. At the south rim, the eye is 0.35 m behind
  the void edge and H is 5.0 m beyond that edge, so H is **5.35 m** out →
  **54.9°**.
- Max parapet height: `1.60 − 0.35·tan(54.9°)` = **1.10 m** before
  rounding; keep **1.07 m** as the build cap to cover avatar and collision
  tolerance.
- Drawn parapet: **0.90 m**. Grazing `atan(0.70 / 0.35)` = 63.4°, about
  **8.5° of angular margin**.

The reflex choice — a 1.1 m guard rail — consumes the unrounded clearance and
leaves no tolerance, so the build cap remains 1.07 m.
This is exactly risk (1) from the concept doc, and it is the number the graybox
gate exists to confirm at eye level.

**Distance legibility.** Slant range from the slab viewing line to a
performer's chest (−7.25 + 1.35 = −5.9, i.e. 6.4 m below the eye): H at
`sqrt(4.35² + 6.4²)` = **7.7 m**, G and I at
`sqrt(5.91² + 6.4²)` = **8.7 m**.
Comparable to Fire's fissure reads. A centred ⌀16 m void with the concept's
4.5 m spacing would have put the far figures past 13 m, which is the second risk
the concept flagged; pulling the station line 2.0 m south of the void centre and
tightening the void to ⌀14 m is what buys it back.

## Reuse map (inventory verified 2026-08-04)

| Need | Source |
|---|---|
| Canyon walls, boulders, parapet | `static/models/vegetation/rock/` — 131 GLBs, incl. `cliff_blockCave_rock/stone`, `cliff_blockSlopeWalls_*`, `cliff_blockDiagonal_*` |
| Gully grass | `static/models/vegetation/grass/` — 8 GLBs, incl. `grass_leafsLarge`, `plant_flatTall` |
| Wildflowers | `static/models/vegetation/flower/` — 9 GLBs (purple / red / yellow, A–C) |
| Damp gully floor | `static/models/vegetation/mushroom/` — 6 GLBs, plus `log/` and `bush/` |
| Kit-scatter pattern | `src/lib/shared/3d/environments/scenes/autumn/authored/AutumnFlora.svelte` |
| Daylight shaft | `scenes/ocean/runtime/atmosphere/GodRayShafts.svelte` or the autumn twin — both hardcode their scene's sun, so re-derive |
| Dust in the shaft | `src/lib/shared/3d/environments/primitives/FallingParticles.svelte` |
| Fireflies | `scenes/autumn/runtime/atmosphere/AutumnParticles.svelte`; ocean GPGPU fauna for drift behaviour |
| Layout + terrain module | New `earth-canyon-layout.ts`, in the exact pattern of `src/lib/features/museum/data/first-fire-layout.ts` (`ramp-x` / `ramp-z` / `flat` floor rects, one geometry source, `elevationAt` throws in dev on uncovered in-bay points) |
| Graybox meshes | Primitive geometry only, per `FirstFireGraybox.svelte`. GLB dressing is Phase 2. |
| Stations | `MuseumPerformerStation3D.svelte`; anchors derived through `interiorOffsetFraction` in `vulcan-cave-floor-plan.ts`, sharing one expression with the layout module |
| Post-processing, audio | `MuseumPostProcessing.svelte`; `shared/3d/audio/ocean-audio-engine.ts` for the sub-bass downbeat bed |

## Data changes this implies

- `cave-earth` in `vulcan-cave-floor-plan.ts` grows from `minInteriorWidth: 11 /
  minInteriorHeight: 11` to `45 / 32`, which compiles at the current 0.75 m per
  minimum-interior unit to about 33.75 × 24 m, and its
  description stops describing the deleted tactile stone grid.
- `CAVE_MODE_ROOMS`' `cave-earth` entry migrates from a single
  `cave-earth-automaton` / `cave-earth-seq` to three-element
  `performerIds` / `sequenceIds` arrays, as Water and Fire already did.
- `composeCaveTerrain` gains a third bay entry for the Earth layout.

## Risks

1. **Sightline margin is thin on the standard rim.** 8.5° at a 0.90 m parapet,
   while a 1.1 m rail leaves no tolerance. If the graybox walk reads badly, the
   fix is the slab's 0.45 m lip everywhere plus a wider rim, not a taller rail.
2. **The canyon is visually open, but the compiled bay still needs its north
   wall.** Keep the normal north wall and suppress its tile geometry with the
   room's authored presentation, as Fire already does. Author the boulder
   parapet as a blocked rect just inside that boundary. The shelves stay outside
   the terrain bay as visual-only geometry, unreachable behind the compiled
   wall collision. No wall-stamper change is needed.
3. **Circular blocking and rendering need one new shared primitive.** The void,
   floor disc and bosses cannot be represented exactly by the existing rect
   lists. Add a `Disc` record (`center`, `radius`) and `inDisc` helper to the new
   Earth layout module; `blockedAt` and the graybox must consume those same disc
   records. Do not maintain a rect collision approximation beside circular
   rendered geometry.
4. **The Air threshold is at datum 0.** The exit must use the specified 6 m
   `ramp-x` from −1.4 to 0. Ending at −1.2 would leave a 1.2 m discontinuity
   when `composeCaveTerrain` hands the player to Air's default floor.
5. **The felt downbeat may not survive the re-skin.** A thud through bare rock
   and a thud through a grass rim are different animals. Ship it as a capped,
   toggleable camera micro-shake and judge it at the gate; cutting it is an
   acceptable outcome.
6. **"Endless" is a set-dressing claim.** Four blocked shelves plus haze either
   read as depth or as flats. Fewer, hazier shelves probably read deeper. This
   is a look-at-it question, not an argue-about-it question.
7. **Vegetation density versus the museum's frame budget.** The gully wants
   hundreds of instanced GLBs. That is Phase 2, and it needs the same
   instancing discipline the ocean flora got.

## Open questions for the walk

1. Parapet at 0.90 m, or the slab's 0.45 m lip along the whole rim? The 1.07 m
   build cap applies either way.
2. Four backdrop shelves or three?
3. Grass on the rim as well, or does the rim stay bare rock so the gully keeps
   its contrast?
4. Fireflies in a daylit room, or only in the gully's shaded stretch?
5. Keep the felt downbeat?

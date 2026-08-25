# Flow Fest Sim Earth production contract

**Status:** Gate 1 approved; Gate 2 playable-graybox production in progress

**Scene ID:** `flow-fest-sim-earth`

**Gate manifest:** `./scene-gates.json`

**Creative provenance:** Austen's Flow Fest Sim request, his first-person site corrections on 2026-08-25, and the active design specification

## Outcome

The first playable arrival begins at the lower gate and branches by camping
choice. Lower-tent and upper-tent campers drive to their selected site, unload,
return through the lower gate, drive uphill to the west upper parking field,
and walk back to camp. Lower car campers settle in the open middle of the lower
level and keep the vehicle at the campsite. No branch camps in Middle Earth.

After camp is established, every branch becomes pedestrian festival life.
Upper camping connects directly to Middle Earth through a tree-line path. Lower
camping connects to Middle Earth by the clear, easy path Austen remembers. The
registered upper trace is 47.1 percent under lidar returns at least two metres
high; the registered lower trace is 34.0 percent covered. Those measurements
describe canopy occlusion over the exact orthophoto drawing Austen supplied;
they do not mean either remembered connector is blocked. The player joins the
shared activity tier, helps once, watches familiar ground change after dusk,
and chooses what happens next.

## Authority ledger

| Concern                      | Canonical owner                                                                    | Evidence path                                                              | Current boundary                                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Creative direction           | Austen's request plus active design spec                                           | `../active/2026-08-24-flow-fest-sim-design.md`                             | None                                                                                                                          |
| Arrival operations           | Austen's first-person corrections                                                  | `./flow-fest-site-plan.json` → `sourceAuthority.operationalTopology`       | Topology is authoritative; physical conditions remain field-unverified                                                        |
| Hidden connector centerlines | Austen's orthophoto traces                                                         | `./austen-traced-connectors.json`                                          | Source-locked user drawing; not a centimetre-accurate field survey                                                            |
| Public event corroboration   | Kinetic Fire public information                                                    | `https://kineticfire.org/general-info/` and `https://kineticfire.org/art/` | Corroborates check-in, unload/parking separation, and the activity-tier concept; it does not override Austen's site knowledge |
| Earth coordinate frame       | Terrain manifest                                                                   | `../../../../static/data/flow-fest-sim/terrain.manifest.json`              | None                                                                                                                          |
| Source selection             | Geospatial source lock                                                             | `../../../../scripts/geospatial/flow-fest-source-lock.json`                | None                                                                                                                          |
| Spatial geometry             | Gate 1 plan contract                                                               | `./flow-fest-site-plan.json`                                               | Traced connectors require comprehension approval; other exact placements remain proposals                                     |
| Review drawings              | Deterministic Gate 1 builder                                                       | `../../../../scripts/geospatial/build_flow_fest_gate1_plan.py`             | Image byte comparison is toolchain-bound; semantic analysis is portable                                                       |
| Blender output               | Derived Gate 2 contract                                                            | `./evidence/gate-2/gate2-coordinate-manifest.json`                         | Built only from approved, source-locked terrain and route inputs                                                              |
| Runtime behavior             | Dedicated Flow Fest Sim Gate 2 review route on the shared camera and Rapier owners | Gate 2 in progress                                                         | Must remain a bare, collision-truthful review until Austen approves it                                                        |

The validator retains a `museumTrackerItems` compatibility field because the
gate framework began as a museum workflow. This non-museum scene uses that slot
only to identify Austen's direction record.

## Evidence and claim vocabulary

| Evidence source      | Gate-claim class                     | Meaning at Gate 1                                                                           |
| -------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------- |
| measured             | literal                              | Computed from the pinned terrain, lidar surface, or orthophoto registration                 |
| public documentation | literal                              | Publicly stated check-in, unload, parking, or tier use                                      |
| Austen-observed      | literal for topology                 | First-person operational knowledge about camping, traffic, parking, and connector existence |
| Austen-traced        | literal for the recorded image trace | Source-locked connector vertices drawn over the registered orthophoto; not a field survey   |
| interpreted          | invention until field verified       | A public-image clue assigned a possible centerline, boundary, or permanent use              |
| authored             | invention                            | Gameplay placement, interaction, night state, or exact composition                          |

No Gate 1 claim uses the `metaphor` class.

## Claim ledger

| ID    | Class     | Statement                                                                                                                                                                                                    | Evidence or proposal source                       | Status                    |
| ----- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- | ------------------------- |
| C-001 | literal   | The checked Earth footprint is 1,024 by 1,024 metres at one-metre terrain spacing.                                                                                                                           | Terrain manifest and geospatial validation report | verified                  |
| C-002 | literal   | Route elevations, open-ground regions, and sightline occlusions are computed from the checked DTM, lidar surface, and orthophoto registration. Lidar surface is not used as a walkability mask.              | Gate 1 report and builder                         | verified                  |
| C-003 | literal   | Public event guidance places check-in at the gate, lets arrivals drive to a selected site to unload or settle a car-camping site, and requires tent campers to move vehicles to designated parking.          | Kinetic Fire General Info                         | corroborated              |
| C-004 | literal   | Lower and upper tent campers return through the lower gate, park in the west upper field, and walk back; lower car campers keep the car at camp; Middle Earth is not camping.                                | Austen's first-person correction                  | accepted source authority |
| C-005 | literal   | Austen traced a direct upper-to-middle connector and a clear middle-to-lower connector over the registered orthophoto. Gate 1 source-locks those vertices and composes them with short open-tier approaches. | `./austen-traced-connectors.json`                 | accepted source authority |
| C-006 | invention | Exact Gate 1 stops, road centerlines, campsite examples, and other non-traced placements are registered proposals over measured terrain, not centimetre-accurate field survey.                               | Gate 1 plan contract                              | proposed                  |
| C-007 | invention | The useful task, night transformation, final choice, and route presentation are gameplay proposals.                                                                                                          | Gate 1 plan contract                              | proposed                  |
| C-008 | invention | The eight-metre night-heart mast is art direction only; no Gate 1 sightline result depends on its height.                                                                                                    | Gate 1 plan and sightline report                  | proposed                  |

## Experience sentence

> The player checks in at the lower gate, chooses lower tent, upper tent, or
> lower car camping, completes the correct vehicle ritual for that branch,
> walks home, then uses the tree-line connectors to enter Middle Earth and
> begin the festival proper.

## Gate 0: Evidence preflight

- Earth shell: checked 1,025 by 1,025 DTM samples, lidar surface layer, and
  registered NAIP orthophoto covering a 1,024 metre square.
- Entry and traffic hinge: lower gate.
- Exit from the onboarding slice: first-night choice with a camp-bound return.
- Permanent structures: interpreted only; no field-verified footprint owner.
- Festival identity and layout: fictional and separate from an official event
  map.
- Domain proof: no selected flow sequence drives this spatial gate. TKA proof
  begins only when a later production slice selects performer sequences.

## Gate 1: Measured plan

### Arrival branch logic

| Step | All players                                          | Lower or upper tent branch                                                                                  | Lower car-camp branch             |
| ---- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 1    | Check in at the lower gate and receive orientation   | Same                                                                                                        | Same                              |
| 2    | Choose a camping type and drive to the selected site | Lower perimeter or upper tier                                                                               | Open middle of the lower level    |
| 3    | Establish camp                                       | Unload tent and gear                                                                                        | Settle with the vehicle at camp   |
| 4    | Resolve the car                                      | Return in the car through the lower gate                                                                    | Car stays; relocation is skipped  |
| 5    | Resolve parking                                      | Drive uphill and park in the west upper field                                                               | Already complete                  |
| 6    | Become a pedestrian                                  | Walk from parking back to the selected camp                                                                 | Already at camp                   |
| 7    | Enter Middle Earth as a participant                  | Use the upper connector, or retrace the lower connector after crossing Middle Earth during the parking walk | Use the middle-to-lower connector |
| 8    | Begin festival life                                  | Useful task, dusk transformation, free choice, and route back to the selected camp                          | Same                              |

### Spatial proof

- The plan registers one complete lower-tent route plus explicit upper-tent and
  lower-car-camp alternatives. Each segment has fixed terrain coordinates and
  measured DTM elevation.
- All three pedestrian branches remain below a 35 percent ten-metre gameplay
  grade cap; the measured maximum is 24.9 percent. This is a graybox movement
  check, not an accessibility claim.
- All vehicle branches remain below a separate 30 percent ten-metre gameplay
  cap; the measured maximum is 24.7 percent. The real road grade remains
  field-unverified.
- Gate 2 must reserve 0.8 metre person, 3.0 metre vehicle, and 3.0 metre
  accessible-design widths. Physical width, drainage, legal access, and ADA
  compliance remain field-unverified.
- Lidar returns at least 2.0 metres above the DTM form the amber visibility
  layer. They test whether one standing point can see another. They never block
  the registered walking centerlines.
- Measured surface coverage along the Austen-traced connector compositions is
  47.1 percent upper-to-middle, 34.0 percent lower-tent-to-middle, and 29.6
  percent car-camp-to-middle. The 13 upper vertices and 14 lower vertices are
  source-locked without drift in every affected arrival and return branch.
- The Middle Earth candidate envelope is 99.3 percent measured open and the
  authored car-camping open-middle envelope is 100.0 percent measured open. The lower
  gate circle is 69.7 percent open and the lower-tent perimeter example circle
  is 82.6 percent open, so neither is misrepresented as a wholly clear pad. The
  lower-tent and car-camping examples are separate because Austen placed them
  that way; no measured terrain, canopy, or built feature is claimed as a
  physical divider between the two authored zones.
- Eight sightline expectations match. The upper connector view is blocked by
  tier relief before surface height is added. The lower connector's DTM-only
  ray is marginal at 0.31 metre below clear, while the measured surface creates
  a much stronger occlusion. Canopy is therefore additive in both cases, but it
  dominates the lower result. The night composition is clear from all 49
  points in its three-metre review neighbourhood.
- Lower tent, upper tent, and car-camp examples are all outside Middle Earth.
  The representative lower-tent point is outside the connected car-camping
  open-middle region.
- The lower-tent parking walk crosses Middle Earth on the way home, then
  retraces 202.4 metres to return as a participant. The repetition is intentional
  route learning, not 690 metres of distinct ground.
- Every branch has a checked first-night return to its own campsite: 247.4
  metres lower tent, 224.0 metres upper tent, and 278.4 metres car camp.

### Spatial artifacts

- Annotated plan: `./evidence/gate-1/gate1-measured-plan.png`
- Lower-tent vertical section: `./evidence/gate-1/gate1-vertical-section.png`
- Arrival branch storyboard: `./evidence/gate-1/gate1-route-storyboard.png`
- Canopy and sightline study: `./evidence/gate-1/gate1-sightline-study.png`
- Review board: `./evidence/gate-1/gate1-review-board.png`
- North-up hillshade: `./evidence/geospatial/terrain-hillshade.png`
- Aerial/terrain registration: `./evidence/geospatial/terrain-registration-contact-sheet.png`
- Lidar/imagery registration: `./evidence/geospatial/lidar-surface-registration-contact-sheet.png`
- West-to-east terrain section: `./evidence/geospatial/terrain-section-west-east.png`
- North-to-south terrain section: `./evidence/geospatial/terrain-section-north-south.png`
- Geospatial validation report: `./evidence/geospatial/geospatial-validation.json`
- Plan contract: `./flow-fest-site-plan.json`
- Austen's source-locked connector trace: `./austen-traced-connectors.json`
- Automated report: `./evidence/gate-1/gate1-validation.json`

### Approval record

Approved by Austen Cloud on 2026-08-25 with the exact response `approved` after
he corrected the two tree-line connectors, drew their centerlines over the
registered terrain, saved both traces, and reviewed the regenerated Gate 1
package. The approval and comprehension basis are recorded in
`./scene-gates.json` and museum tracker item `0RowNe7w8F1g3dGTu1KW`.

## Gate 2 and later gates

Gate 2 playable-graybox production is authorized and in progress. It remains
unapproved until Austen walks or views all three branches, identifies where
each vehicle ends, recognizes both connectors from first person, and confirms
terrain scale and collision. Gate 3 registered visual target, Gate 4 production
slice, Gate 5 integrated world, and Gate 6 final acceptance remain pending.

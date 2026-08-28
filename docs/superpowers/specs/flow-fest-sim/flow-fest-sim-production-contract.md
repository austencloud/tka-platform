# Flow Fest Sim Earth production contract

**Status:** Systems recovery verified; geographic acceptance reopened under Reality Lock

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

| Concern                      | Canonical owner                                                                                   | Evidence path                                                              | Current boundary                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Creative direction           | Austen's request plus active design spec                                                          | `../active/2026-08-24-flow-fest-sim-design.md`                             | None                                                                                                                          |
| Arrival operations           | Austen's first-person corrections                                                                 | `./flow-fest-site-plan.json` → `sourceAuthority.operationalTopology`       | Topology is authoritative; physical conditions remain field-unverified                                                        |
| Hidden connector centerlines | Austen's orthophoto traces                                                                        | `./austen-traced-connectors.json`                                          | Source-locked user drawing; not a centimetre-accurate field survey                                                            |
| Public event corroboration   | Kinetic Fire public information                                                                   | `https://kineticfire.org/general-info/` and `https://kineticfire.org/art/` | Corroborates check-in, unload/parking separation, and the activity-tier concept; it does not override Austen's site knowledge |
| Earth coordinate frame       | Terrain manifest                                                                                  | `../../../../static/data/flow-fest-sim/terrain.manifest.json`              | None                                                                                                                          |
| Source selection             | Geospatial source lock                                                                            | `../../../../scripts/geospatial/flow-fest-source-lock.json`                | None                                                                                                                          |
| Spatial geometry             | Gate 1 plan contract                                                                              | `./flow-fest-site-plan.json`                                               | Traced connectors require comprehension approval; other exact placements remain proposals                                     |
| Review drawings              | Deterministic Gate 1 builder                                                                      | `../../../../scripts/geospatial/build_flow_fest_gate1_plan.py`             | Image byte comparison is toolchain-bound; semantic analysis is portable                                                       |
| Blender output               | Derived Gate 2 contract                                                                           | `./evidence/gate-2/gate2-coordinate-manifest.json`                         | Built only from approved, source-locked terrain and route inputs                                                              |
| Runtime behavior             | Shared Flow Fest Sim terrain, camera, Rapier, mobility, interaction, and field-positioning owners | `/test/flow-fest-graybox` and `/test/flow-fest-sim?gate6=1`                | Gate 2 retains the survey runtime; Gate 6 integrates the approved journey and opt-in GPS at the existing player seam          |

Gate 6's systems evidence remains useful, but its visual acceptance is
withdrawn. Austen's review found that entrance and landmark placement did not
correspond closely enough to the real campground. The Reality Lock contract
now governs geographic promotion and supersedes any older `ready-for-review`
language for the full scene.

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

| ID    | Class     | Statement                                                                                                                                                                                                                                                                                                                                                                                        | Evidence or proposal source                       | Status                    |
| ----- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- | ------------------------- |
| C-001 | literal   | The checked Earth footprint is 1,024 by 1,024 metres at one-metre terrain spacing.                                                                                                                                                                                                                                                                                                               | Terrain manifest and geospatial validation report | verified                  |
| C-002 | literal   | Route elevations, open-ground regions, and sightline occlusions are computed from the checked DTM, lidar surface, and orthophoto registration. Lidar surface is not used as a walkability mask.                                                                                                                                                                                                  | Gate 1 report and builder                         | verified                  |
| C-003 | literal   | Public event guidance places check-in at the gate, lets arrivals drive to a selected site to unload or settle a car-camping site, and requires tent campers to move vehicles to designated parking.                                                                                                                                                                                              | Kinetic Fire General Info                         | corroborated              |
| C-004 | literal   | Lower and upper tent campers return through the lower gate, park in the west upper field, and walk back; lower car campers keep the car at camp; Middle Earth is not camping.                                                                                                                                                                                                                    | Austen's first-person correction                  | accepted source authority |
| C-005 | literal   | Austen traced a direct upper-to-middle connector and a clear middle-to-lower connector over the registered orthophoto. Gate 1 source-locks those vertices and composes them with short open-tier approaches.                                                                                                                                                                                     | `./austen-traced-connectors.json`                 | accepted source authority |
| C-006 | invention | Exact Gate 1 stops, road centerlines, campsite examples, and other non-traced placements are registered proposals over measured terrain, not centimetre-accurate field survey.                                                                                                                                                                                                                   | Gate 1 plan contract                              | proposed                  |
| C-007 | invention | The useful task, night transformation, final choice, and route presentation are gameplay proposals.                                                                                                                                                                                                                                                                                              | Gate 1 plan contract                              | proposed                  |
| C-008 | invention | The Gate 1 night-heart mast was an art-direction proposal only and is superseded in Gate 3 by a low fire-jam focal plane plus a separate LED circle; Gate 1 sightlines depend on neither treatment.                                                                                                                                                                                              | Gate 1 plan, Gate 3 brief, and sightline report   | superseded                |
| C-009 | literal   | The playable browser uses the full one-metre DTM for visible terrain and collision. The four-metre GLB terrain is an offline review surface, not runtime collision authority.                                                                                                                                                                                                                    | Gate 2 contract and verification report           | verified                  |
| C-010 | invention | The visible canopy screen contains 95,459 one-metre cells: checked lidar occupancy at least four metres above the DTM plus an explicit 18 metre conservative gameplay dilation. Dilation-only cells are removed from all seven registered clearings, and the approved person and vehicle corridors are carved with audited physical clearance. It does not assert individual trees or buildings. | Gate 2 contract and browser implementation        | approved                  |
| C-011 | literal   | Gate 3 retains the Gate 2 coordinate fingerprint and locks the same five camera positions, targets, and 65 degree horizontal fields of view across day, dusk, and night.                                                                                                                                                                                                                         | Gate 3 camera lock and capture proofs             | approved                  |
| C-012 | invention | Gate 3 groups 427 checked lidar canopy peaks into deterministic low-poly silhouettes while excluding registered clearings and routes. The clusters are not surveyed trunks or species.                                                                                                                                                                                                           | Gate 3 geometry owner and verification report     | approved visual target    |
| C-013 | invention | The temporary camps, 16-person fire-circle perimeter, eight active artists, fire treatment, and separate LED circle are fictional festival dressing.                                                                                                                                                                                                                                             | Gate 3 visual target and material brief           | approved visual target    |
| C-014 | invention | Gate 4 makes one night-heart slice interactive: park the EUC, enter on foot, join the responsive fire jam, complete the turn, and restore the completed state and parked collider after reload.                                                                                                                                                                                                  | Gate 4 state audit, capture, and build report     | approved                  |
| C-015 | invention | Gate 5 integrates gate, selected camp, west parking, Middle Earth, festival exit and re-entry, and the final selected-camp return in one persisted journey.                                                                                                                                                                                                                                      | Gate 5 persistence and integration reports        | approved                  |
| C-016 | literal   | Gate 6 converts opt-in WGS84 device fixes through EPSG:26916 into the existing world. Nominal registered-route fixes may stage the player; poor-accuracy and stale fixes are held without moving it.                                                                                                                                                                                             | Gate 6 GNSS rehearsal and regression reports      | ready for review          |

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

## Gate 2: Playable graybox

Gate 2 was approved by Austen on 2026-08-26 after he walked the production
candidate, identified locomotion and false-blocking defects, reviewed their
revision, and explicitly directed the project into the next phase. The review
route remains available at `/test/flow-fest-graybox`; the production rehearsal
at `/test/flow-fest-sim` uses the same full one-metre DTM, Rapier player,
registered camera contract, and selected collision host. Gameplay locomotion is
4.2 m/s with Shift sprint at 1.8 times that pace, Ctrl crouch, and Space jump.
The 1.2 m/s value remains the authored walking-speed owner for route-duration
evidence, not the live gameplay controller.

The runtime comparison selected one full-resolution terrain render batch with a
32 metre collision host. In isolated foreground measurements it reached a
collision-ready player in 4.23 seconds, compared with 6.44 seconds for the
bounded collider, and recorded a 17.0 millisecond p95 frame time against the
33.33 millisecond installation target. Both hosts passed all 144 registered
person-route ground probes with zero misses and 0.008399 metre maximum DTM
error. The selected host also passed 258 probes placed five centimetres before,
on, and after 86 route/chunk seam crossings plus 264 route-leg endpoint probes.
It exercised 107 collider-window transitions, kept 25 to 30 terrain bodies
active, and never advanced a physics frame without the containing chunk.

The canopy screen is one merged visible/collider-identical mesh. It starts from
the full one-metre lidar occupancy mask wherever the checked surface return is
at least four metres above the DTM, then applies an explicitly invented 18
metre conservative dilation to close false shortcuts. The dilation cannot fill
the seven registered clearings. Person corridors carve 1.12 metres from their
centerlines; staged vehicle corridors carve 2.9 metres, including a one-metre
vehicle half-width. The audit keeps the lower-gate spawn, all 132 person legs,
all 54 vehicle legs, and every clearing open. A same-metric in-corridor versus
off-corridor search found no shorter challenger, and continuous 0.05 metre
line-of-sight smoothing held the upper and lower connector deviations to 1.20
and 2.12 metres within the 2.5 metre limit. Gate 2 does not yet implement a
vehicle controller or claim vehicle timing; those interactions remain staged.

The evidence package includes the editable Blend, source-locked coordinate
manifest, GLB, six fixed views, contact sheet, 30 second continuous route
video, offline verifier, and browser host comparison. Austen's later production
walk supplied the required first-person comprehension evidence and exposed the
locomotion and collision defects that were corrected before approval.

### Approval record

Approved by Austen Cloud on 2026-08-26 with the exact direction `Okay what's
next bring it to the next level my friend start the next phase`. The tracker
record and comprehension basis are pinned in `./scene-gates.json` under museum
item `kKPZRyz05roZKL2Dj33s`.

## Gate 3: Registered visual target

Gate 3 was approved by Austen on 2026-08-26 with the exact direction `Send it
to the next phase`. The runtime retains the Gate 2
coordinate fingerprint, all five approved camera poses and targets, and an
aspect-reactive 65 degree horizontal field of view. Fifteen registered frames
lock those cameras across Thursday afternoon, Thursday dusk, and first night.
The visual system introduces a measured-land-first hierarchy, deterministic
LiDAR-derived canopy silhouettes, player-bounded key shadows, graded terrain
and foliage materials, and a fictional fire-jam community that is only active
at night: a broad open fire floor, a 16-person spectator perimeter, three fire
artists, two field jugglers, three LED artists, and a separate open-sided LED
circle.

Gate 3 does not invent the unresolved bridge or permanent-structure
footprints. Its 427 canopy clusters are interpreted from LiDAR peaks and do not
claim surveyed trunks or species. Temporary tents, cars, people, fire-jam
placement, and LED circle remain clearly classified festival fiction.

### Visual artifacts

- Locked camera set: `./evidence/gate-3/gate3-locked-camera-set.json`
- Registered day/dusk/night board:
  `./evidence/gate-3/gate3-visual-target-board.png`
- Material, lighting, and sound boundary:
  `./evidence/gate-3/gate3-material-lighting-sound-brief.md`
- Runtime capture proofs:
  `./evidence/gate-3/gate3-runtime-capture-proofs.json`
- Automated report: `./evidence/gate-3/gate3-verification.json`

### Approval record

Approved by Austen Cloud after he reviewed the live production rehearsal,
directed the EUC and fire-circle revisions, and explicitly advanced the work.
The tracker record and comprehension basis are pinned in `./scene-gates.json`
under museum item `wszyPNGWMYTbTeVqSrnl`.

## Gate 4: Production slice

Gate 4 was approved by Austen after he walked the runtime, directed the EUC,
third-person camera, avatar-fit, and fire-circle revisions, and explicitly
advanced the work. The retained slice at `/test/flow-fest-sim?gate4=1` keeps
the Gate 2 terrain, route, clearing, camera, and collider authority intact and
uses the Gate 3 first-night visual target. The representative lower-tent slice
starts 12.5 metres from the night-heart fire on the electric unicycle. The
player must park, leaving a visible physical wheel behind, then walk into the
9.6 metre interaction boundary. Joining the jam drives one state owner shared
by the fire, LED rings, eight active artists, sixteen-person spectator
perimeter, and a deterministic procedural Web Audio mix. Finishing the turn
persists the interaction, player pose, wheel pose, and parked collider across
reload; audio correctly requires another user gesture.

The final browser audit captured the complete mounted-to-on-foot interaction
as H.264, retained 24 ready production avatars, and recorded zero runtime
errors. A 600-frame foreground sample measured 16.8 milliseconds p95, 16.8
milliseconds p99, 16.9 milliseconds maximum, 78 draw calls, and 2.82 million
rendered triangles. Desktop, 4K, laptop, tablet, short landscape, and phone
layouts were visually inspected and retained in a contact sheet.

### Production-slice artifacts

- Build and source lock:
  `./evidence/gate-4/gate4-production-slice-build.json`
- Interaction capture: `./evidence/gate-4/gate4-interaction-capture.mp4`
- State and reload audit:
  `./evidence/gate-4/gate4-state-transition-audit.json`
- Performance report: `./evidence/gate-4/gate4-performance-report.json`
- Active and completed frames:
  `./evidence/gate-4/gate4-fire-jam-active-1920x1080.png` and
  `./evidence/gate-4/gate4-fire-jam-completed-1920x1080.png`
- Responsive-layout proof:
  `./evidence/gate-4/gate4-viewport-contact-sheet.png`

This gate is one coherent night interaction, not the integrated multi-day
festival. The unresolved bridge and permanent structures remain absent.

## Gate 5: Integrated world

Gate 5 was approved by Austen with the exact direction `Okay continue to the
next phase. Essentially I'm doing an experiment where I don't really check the
gates and I have you build this whole f****** thing in full.` The persisted
lower-tent run integrates the lower gate, selected camp, west parking, Middle
Earth fire circle, festival exit and re-entry, and final camp return. The
landmark-staging evidence is explicitly separated from Gate 2's continuous
terrain and collider replay. The audio owner retains one graph and three
long-lived sources across exit, re-entry, and return.

### Integrated-world artifacts

- Integrated walk: `./evidence/gate-5/gate5-integrated-walk.mp4`
- Transition capture: `./evidence/gate-5/gate5-transition-captures.mp4`
- Persistence report:
  `./evidence/gate-5/gate5-state-persistence-report.json`
- Audio review: `./evidence/gate-5/gate5-audio-review.md`
- Automated report: `./evidence/gate-5/gate5-verification.json`

## Gate 6: Final acceptance

Gate 6 is ready for review at `/test/flow-fest-sim?gate6=1`. The default route
now uses this acceptance presentation. It preserves every approved spatial and
gameplay owner and adds same-origin, user-gesture field positioning through the
existing player-stage seam. The exact lower-tent arrival and return route
produces an 86-fix deterministic GNSS rehearsal. WGS84 to EPSG:26916 to world
round trips stay within 0.000057 metres. Nominal fixes advance the player;
45-metre and 30-second-old fixes remain visibly held without changing accepted
revision or position.

The current acceptance state reloads at the exact selected-camp coordinate
with the fire jam completed, backtracking and re-entry retained, and zero
position drift. Seven exact viewport captures, an H.264 acceptance composite,
focused regression tests, project typecheck, console audit, and source digests
are pinned by `./flow-fest-gate6-acceptance.md` and
`./evidence/gate-6/gate6-verification.json`.

This gate does not claim a real festival-day GPS recording or final backpack
hardware proof. The unresolved bridge and permanent structures remain absent.

## Forest ecology acceptance revision

Austen directed the acceptance candidate to reuse the existing Forest Scene's
trees, grass, and supporting systems. The revision keeps the checked DTM,
LiDAR evidence, registered paths, clearings, and world frame intact while
replacing the local tree-crown and grass substitutes with five accepted Forest
tree families, the Forest summer-sward and woodland-grass prototypes,
`ForestClearingWind`, Forest ground-life assets, and the shared
`ForestLighting` rig.

The current deterministic site contains 427 LiDAR-centered tree instances,
20,798 grass instances, and 19 ground-life instances with zero registered-route
intrusions. Tree family and ground-cover identity remain authored visual
ecology, not surveyed species truth. The Forest Scene's fictional clearing
layout is not imported. Full source, provenance, performance, and responsive
capture details are pinned in `./forest-ecology-integration.md` and
`./evidence/forest-ecology-r1/forest-ecology-verification.json`.

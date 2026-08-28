# Flow Fest Sim Overnight Production Rehearsal

Status: implementation rehearsal, not a numbered scene-gate artifact.

Authorization: Austen's 2026-08-26 full-send decision is recorded in the museum tracker as `PW3IurUeD2ziVyqV4yQO`. It authorizes autonomous implementation across the next phases while he sleeps. It does not pre-approve unseen visual targets or advance the formal gate manifest.

## Purpose

Turn the verified Gate 2 Earth site into a playable Thursday-arrival experience without changing the measured foundation or laundering rehearsal work through Gates 3–6.

Playable route: `/test/flow-fest-sim`

Survey route: `/test/flow-fest-graybox`

Formal state remains:

- Gate 2: `ready-for-review`, approval unset.
- Gates 3–6: `pending`.

## Spatial authority

The rehearsal consumes these Gate 2 owners without rewriting their coordinates:

- `gate2-runtime-contract.json` for branches, zones, anchors, cameras, and source fingerprints.
- `terrain-height.f32` for the full-resolution one-metre DTM.
- `surface-offset.u16` for measured high-return evidence.
- `flow-fest-terrain-host.ts` for render and collision terrain.
- `flow-fest-review-geometry.ts` for the survey route's visible/collider-identical topology screen.
- `FlowFestGrayboxWalkScene.svelte` for Rapier, chunk reconciliation, the player body, and first-person movement.
- `flow-fest-production-geometry.ts` for one collision mesh derived from the same visible tree-trunk, tent, vehicle, mast, and fire-ring transforms used by production dressing.

The production route composes the proven scene rather than copying movement, collision, or terrain code.

## Truth classes

### Measured

- Ground elevation and relief.
- World frame and geospatial transform.
- Austen-traced upper-to-middle and middle-to-lower connectors.
- DTM and surface-evidence source hashes.

### Interpreted from measured evidence

- Woodland placement. Trees are generated only where the checked lidar surface layer reports a return at least four metres above the DTM. A generated tree is not a species or literal trunk claim.
- The Gate 2 survey route's visible four-metre topology screen. Its conservative dilation is declared gameplay invention and remains the survey collision mesh.

### Authored festival fiction

- Tents, cars, lanterns, people, light sculpture, fire circle, and time-of-day presentation.
- The night heart and all event dressing.
- Thursday objective copy and progression.

No rehearsal landmark is presented as a current permanent structure or as a direct representation of a named event.

## Play loop

The deterministic Thursday slice contains:

1. Check in at the lower gate.
2. Choose lower tent, upper tent, or open-field car camping.
3. Stage the real arrival/parking ritual through registered review views without claiming route traversal, vehicle speed, or duration.
4. Walk from the appropriate parking view to the chosen campsite on measured collision.
5. Make camp.
6. Follow the traced terrain route to Middle Earth.
7. Let night fall at the authored festival heart.
8. Free-roam the lit field, then choose when to head home.
9. Follow the correct branch home.
10. Wake Friday morning.

The current rehearsal deliberately stages vehicle legs. It does not claim a drivable-car controller or recorded travel time. A Truck-Simulator-like vehicle system remains a separate new capability.

## Determinism and persistence

- Master seed: `flow-fest-thursday-01`, owned once by the simulation contract and consumed by both progress and spatial dressing.
- Spatial decoration uses stable keyed random streams; adding one cluster does not reshuffle unrelated placements.
- The saved session stores the Gate 2 coordinate fingerprint and is rejected when that fingerprint changes.
- Restored phase, branch, moment, and completed-step tuples must match a reachable reducer state or fail closed.
- Resume restores a guarded checkpoint and registered camera, not an exact mid-stride player pose.

## Locomotion pace

- The measured Gate 2 survey stays locked to 1.2 m/s so its route-duration evidence remains meaningful.
- The production festival uses 4.2 m/s. The square-kilometre site remains large, but ordinary exploration no longer inherits the survey pace.
- Shift sprints at 1.8× walking speed, Control or C physically crouches the Rapier capsule, and Space uses the existing five-unit jump force.
- Noclip remains disabled because it bypasses measured terrain and production object collision.

## Acceptance for the overnight handoff

- The production route opens on the same measured terrain as Gate 2, without the survey route's 18-metre topology dilation.
- Gate 2 validators still pass unchanged.
- All three arrival branches reach morning through guarded state transitions.
- Tree, camp, crowd, and route-light placements are deterministic.
- The default production view contains no survey ribbons or anchor rings.
- Production collision is derived from visible solid objects: 647 interpreted tree trunks, 38 tents, nine vehicles, the mast, and the fire ring. The player tent becomes collidable only when it becomes visible.
- Afternoon, golden-hour, night, and dawn are materially distinct.
- Desktop, tablet, narrow landscape, and phone captures retain readable objectives and usable touch targets.
- Runtime console contains no new errors.

Evidence belongs under `docs/superpowers/specs/flow-fest-sim/evidence/overnight-rehearsal/`. It must not be registered as Gate 3–6 evidence until predecessor approvals exist.

## Rehearsal limits

- Vehicle travel is button-and-camera staging over registered views. No drivable vehicle or interpolated route traversal is claimed.
- Visible tree trunks, tents, vehicles, mast, and fire ring are the production collision authority alongside measured terrain. Crowd silhouettes and route lanterns remain non-colliding so free-roam does not turn into a static slalom.
- The collision uses the rehearsal's authored visible transforms. It remains internal rehearsal geometry, not a permanent-structure survey claim.
- Volumetric-fire and sky texture provenance requires a release audit before this slice can ship outside the internal rehearsal.
- Responsive captures prove interface layout only on tablet and phone; touch locomotion and backpack-device thermal performance are not claimed.

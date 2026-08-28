# Flow Fest Sim Reality Lock

**Status:** Active production gate

## Outcome

Build one continuous arrival slice that Austen can recognize without labels:
Camden College Corner Road, the west-side camp entrance, gatehouse and fence,
check-in approach, lower level, car-camp area, and their relationship to the
cornfield and the routes toward the upper tiers.

## Coordinate authority

`createFlowFestCampPlan()` is the only runtime coordinate owner. The minimap,
3D roads, driveway apron, terrain grading, vegetation exclusions, navigation,
landmarks, and authoring view must consume that plan. A location may not be
copied into a component as an independent coordinate.

Every feature carries one evidence class:

- official road inventory;
- registered public orthophoto;
- exact Street View camera metadata plus registered orthophoto;
- Austen-traced or Austen-annotated;
- festival gameplay placement.

Diagnostic overlays, unlabeled image interpretation, and generated scenery are
never geographic evidence.

## Production order

1. Preserve the recovered simulator and shared camera dependencies on a branch
   based on current `main`.
2. Expose the shared camp plan in a north-up authoring page over the registered
   NAIP raster. Corrections save as proposals with coordinate fingerprint,
   source class, timestamp, and the original value retained.
3. Lock the entrance junction and arrival bearing from exact panorama metadata
   plus the registered NAIP junction.
4. Rebuild the road-to-lower-level slice from the plan. One surface owns each
   junction. Rendering and collision consume the same locally graded terrain.
5. Shape vegetation from broad orthophoto woodland regions and explicit route,
   road, building, and sightline exclusions. Individual procedural trees never
   claim real-tree accuracy.
6. Tune walking, EUC traversal, and the chase camera against the finished
   corridor. The dedicated pedal-contact rig remains a separate fidelity gate.

## Acceptance

- Austen identifies the public road, entrance, gatehouse, check-in direction,
  lower level, car-camp area, and cornfield relationship from both the overhead
  plan and rider view without HUD labels.
- The entrance appears on the west side of the official road in plan and 3D.
- The plan-to-3D horizontal residual is under 0.25 metres for promoted anchors.
- The Street View panorama-to-ODOT centerline residual remains under 1 metre.
- The driveway, public road, and private drive have one visible surface owner
  at each junction, with no z-fighting, wedges, or invented mound.
- Ground-level captures show no unsupported entrance undulation; broad measured
  road grade remains intact.
- Roads and clearings remain readable through the vegetation system.
- Locked direct, road-left, road-right, gatehouse, overhead, and rider cameras
  pass at desktop and compact landscape sizes with no console errors.
- A continuous ride from the public road to the lower level completes without
  collision traps or location discontinuities.

Gate 6 may return to `ready-for-review` only after these checks pass.

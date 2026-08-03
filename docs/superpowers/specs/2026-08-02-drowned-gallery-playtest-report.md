---
status: active
value: 3
effort: S
remaining: 'Data-level traversal bug fixed and regression-tested; art/geometry follow-ups flagged below are for the next session, not this pass.'
depends_on: 'docs/superpowers/specs/backlog/2026-08-02-vulcan-cave-water-room-drowned-gallery-design.md'
plan_path: ''
tags: [museum, playtest, drowned-gallery]
last_triaged: 2026-08-02
---
# Drowned Gallery Playtest Report — Traversal Defect Found and Fixed

**Date:** 2026-08-02
**Method:** headless playtest — drove the real stack
(`buildVulcanCaveFloorPlan()` + `MuseumPhysicsProvider`) with repeated
`movePlayer` calls from the cave-squeeze north door through approach → sump →
grotto → to the cave-fire west door, sampling `terrain.elevationAt` at every
step. New test:
[`tests/unit/museum/drowned-gallery-traversal.test.ts`](file:///E:/tka-platform/tests/unit/museum/drowned-gallery-traversal.test.ts).

## Verdict

**Yes — a player can now walk spawn → Fire door without getting stuck,** per
the harness. All 7 traversal assertions pass, and the full museum suite
(21 files / 204 tests) is green. See test output below.

## Root cause

The Drowned Gallery's terrain zones (`drowned-gallery-terrain.ts`) model the
sump↔grotto corridor as a rectangle anchored to the **sump's own x-span**
(`sump.minX - 1` to `sump.maxX + 1`, world x ≈ 12.0–16.5). The actual corridor,
carved by `corridor-router.ts`'s `routeLShaped`, connects the sump's north
door (world x ≈ 13.0–14.0, aligned to the sump's own bounds) to the grotto's
south door (world x ≈ 2.0–3.0) — **the two rooms are not x-aligned**. The
graph-layout engine centers each room on the *previous* room in the main
path, not on the door itself, and the two doors use different wall
`alignment`s ("start" vs "start" but on walls of very different width), so
the corridor jogs roughly 11 m west between the sump and the grotto.

Confirmed by dumping the real tile grid (`grid.tiles`) between the two rooms:
the carved `corridor`/`door` tiles span world x **2.0 to 14.0**, while the old
zone rect covered only **12.0 to 16.5** — missing over 80% of the corridor's
actual width. Any point in the walked path with world x < 12.0 (i.e., most of
the corridor, since the grotto-side door sits at x ≈ 2–3) fell through every
`elevationAt` zone to the museum datum fallback of **0**, popping the player
up ~2.2 m instantly. Since `MuseumPhysicsProvider.movePlayer` clamps `position.y`
to `floorYAt(...) + STANDING_Y`, this is exactly "the game did not want him to
go underwater" / "walking on top of the water": the player is clamped onto
the phantom datum floor sitting *above* the actual (correct) sump-depth water
surface, mid-corridor, before ever reaching the grotto.

A second instance of the same root cause sat in the "grotto surfacing steps"
zone (the ramp from `CORRIDOR_SURFACING_Y` up to `CAUSEWAY_Y` just inside the
grotto's south wall): its code comment claimed the door "lands mid-south-wall
at the sump's x position" and anchored the zone to `sump.minX`/`sump.maxX` —
factually wrong per the real grid; the grotto's south door is at the grotto's
own west-biased x-span, not the sump's.

Note: `git log` shows a prior commit (`2dbb22a75e`, "anchor the surfacing
steps to the sump door's x-span") already tried to fix this same symptom but
anchored to the wrong room's door — it fixed the *comment* accuracy problem
but not the actual coordinate mismatch, because it never diffed the anchor
against the real tile grid.

## Defects found (with world coordinates)

1. **Sump↔grotto corridor zone too narrow (the primary bug).**
   `elevationAt(11.95, 26.0)` returned `0.00` (datum) one step after
   `elevationAt(12.00, 26.0)` returned `-2.20` (correct corridor depth) — a
   2.2 m instantaneous pop-up, exactly at the old zone's `minX` boundary.
   Real corridor tile bbox: world x `2.0`–`14.0`. Old zone: `12.0`–`16.5`.

2. **Grotto surfacing-steps zone anchored to the wrong room's door.**
   Same class of bug, one room over: after widening zone (1) to the correct
   union span, the surfacing-steps ramp (anchored to the same wrong sump
   x-span) produced a second cliff: `elevationAt(14.49, 23.0) = -1.88`
   (mid-ramp) → `elevationAt(14.54, 23.0) = -0.30` (flat causeway), a 1.58 m
   jump 0.05 m outside the intended strip. Fixed by anchoring this zone to
   the grotto's own south-door x-span instead (`doorXSpan(grid,
   "cave-water", "south")`), which is where the ramp physically needs to be.

3. **Squeeze↔approach corridor (checked, no data bug found).** This corridor
   also jogs (squeeze's north door and approach's south door differ by 2
   tiles in x, `routeLShaped` inserts an elbow) but there is no elevation
   zone at all for this stretch — correctly so, since it's above the
   waterline and both rooms sit at the museum datum (0) on either side. The
   walked path crosses it with zero elevation change. No fix needed.

4. **Approach↔sump corridor zone (checked, no data bug found).** Its x-span
   (`sump.minX - 1` to `sump.maxX + 1` = 12.0–16.5) does fully cover the real
   corridor's measured bbox (13.0–15.0) in this case — the approach and sump
   rooms happen to be close enough in x that the old margin was sufficient
   here. No fix needed.

5. **Grotto east exit ramp toward cave-fire (checked, no data bug found).**
   `grottoEastDoor` world position (26.5, ~21–22.5) sits correctly inside the
   ramp zone (`grotto.maxX - 2` to `grotto.maxX`, `grotto.maxZ - 6` to
   `grotto.maxZ`), and the walked path through it shows no cliffs. Exit
   elevation at the door is ≈ 0, matching cave-fire's flat datum floor.

## Fixes applied (data-level only, `drowned-gallery-terrain.ts`)

Both fixes are in
[`src/lib/features/museum/data/drowned-gallery-terrain.ts`](file:///E:/tka-platform/src/lib/features/museum/data/drowned-gallery-terrain.ts),
committed at **`<SHA_PLACEHOLDER>`**:

1. Added `doorXSpan(grid, roomId, wall)` — scans the real door tiles on a
   room's wall (mirrors `findDoorCenter` in `vulcan-cave-floor-plan.ts`, but
   returns world meters, not the 2D floor-plan's tile+0.5 convention) and
   returns that door's actual world x-extent.
2. The sump↔grotto corridor zone's x-span is now
   `min(sumpNorthDoor.minX, grottoSouthDoor.minX) - TILE` to
   `max(sumpNorthDoor.maxX, grottoSouthDoor.maxX) + TILE` — the union of
   both real doors' spans, not an assumption anchored to one side.
3. The grotto surfacing-steps zone's x-span is now anchored to the grotto's
   own south-door span (`grottoSouthDoor.minX/maxX ± TILE`) instead of the
   sump's — matching where that ramp is physically carved.

No changes to `museum-physics-provider.ts` or the controller — the walk
proved the defect was entirely in the terrain zone data, not the clamping
logic (which correctly consumes whatever `elevationAt` returns).

## A coordinate-convention pitfall found while writing the harness (test-only, no production fix needed)

My first draft of the traversal test converted tile indices to world
coordinates using `(tileIndex + 0.5) * TILE` — the convention
`vulcan-cave-floor-plan.ts`'s `findDoorCenter` uses for its 2D floor-plan
minimap overlay. That is **not** the convention the actual 3D/physics world
uses. `Museum3DScene.svelte`, `museum-player-controller.ts`,
`museum-physics-provider.ts`, and `drowned-gallery-terrain.ts`'s own
`interiorWorldRect` all use `worldCoord = tileIndex * TILE` (no half-tile
offset). Using the wrong convention made the test's own waypoints sit exactly
on a floating-point rounding boundary in `isWalkableAt`'s
`Math.round(worldX / tileSize)` lookup, producing a false "stuck" report
against a real door tile. This was a test-authoring bug, not a game bug — the
fix stayed entirely inside the new test file. Flagging it because the two
conventions living side by side in this codebase (2D floor-plan vs 3D world)
is a footgun worth knowing about for anyone building more tooling on top of
`vulcan-cave-floor-plan.ts`.

## Test harness notes

The route walker uses a "line-hugging" greedy pathfinder (advance whichever
axis — x or z — has the larger remaining distance, wall-slide to the other
axis on a block, full BFS only as a last-resort detour) rather than raw BFS.
Plain 4-directional BFS is free to return a degenerate shortest path that
sweeps one axis fully before the other; that produced a false-positive
"cliff" during debugging (a path that swept sideways at a fixed z, crossing a
zone boundary a real player's direct route would never touch). The
line-hugging walker matches how `movePlayer`'s own wall-slide logic actually
moves a player, and how the task asked the route to be walked ("door center
to door center... allow wall-slide").

The grotto leg deliberately routes door → "top of steps" (same x as the door,
just past the ramp's z-range) → `causewayProbe` → east door, rather than
straight from the door to the causeway probe — mirroring how a player
climbing a narrow staircase would go straight up before turning, rather than
cutting diagonally across the ramp's edge.

## Test output (final, all green)

```
$ npx vitest run tests/unit/museum/drowned-gallery-traversal.test.ts tests/unit/museum/drowned-gallery-terrain.test.ts

 ✓ tests/unit/museum/drowned-gallery-terrain.test.ts (7 tests) 3ms
 ✓ tests/unit/museum/drowned-gallery-traversal.test.ts (7 tests) 24ms

 Test Files  2 passed (2)
      Tests  14 passed (14)

$ npx vitest run tests/unit/museum/

 Test Files  21 passed (21)
      Tests  204 passed (204)
```

Traversal test breakdown (all 7 pass):
- finds a walkable tile path spawn → fire door (no severed corridor)
- arrives at the cave-fire west door
- is genuinely underwater in the sump's flat middle (not floating at datum)
- never pops the floor more than 0.6 m between successive steps
- reaches the exit at museum datum elevation (~0)
- keeps the pool blocked from the causeway (barrier is by design)
- keeps all three overlooks reachable from the grotto entry

## What I could NOT fix at the data level (none — nothing outstanding)

Every traversal check passes and the fix is confined to the two zone rects in
`drowned-gallery-terrain.ts` described above. There is no ramp-steepness or
UCC-gravity issue blocking descent — the sump's own south/north ramp zones
(anchored to the sump's own bounds, not a cross-room assumption) were correct
from the start and needed no change.

## Design note — NOT fixed, flagging per instructions

**The far shore (alcove side, across the pool) is intentionally
unreachable.** The pool is the barrier by design — confirmed both by the
"keeps the pool blocked from the causeway" test (passes: stepping toward the
pool center from the causeway never crosses into a walkable tile) and by the
design spec's own station list ("(6) mirror pool ... under a glowworm dome;
(7) three habitat alcoves in procession at the far waterline"). If Austen's
"reach the other end" meant the exit (cave-fire), this report covers it and
it now works. If he meant the far shore itself, that's a design decision (add
a second causeway loop, a bridge, or leave it view-only per the current
"public interpretation apron" / "recessed habitat" spatial-layer split in the
spec) for a future session — not something to silently change here.

# The Earth Room (Canyon Overlook) — Graybox Executor Plan (2026-08-04)

Design: `docs/superpowers/specs/2026-08-04-earth-room-floor-plan-draft.md`
(read it first — station table, section profile, sightline math are authority).
Codex review notes: `docs/superpowers/specs/2026-08-04-earth-room-codex-review.md`.
Reference implementation for every pattern: the Fire build —
`src/lib/features/museum/data/first-fire-layout.ts`,
`src/lib/features/museum/components/game/FirstFireGraybox.svelte`,
`tests/unit/museum/first-fire-traversal.test.ts` and
`first-fire-terrain.test.ts` — which itself mirrors Water
(`drowned-gallery-terrain.ts`, `DrownedGalleryGraybox.svelte`). When in doubt,
copy Fire's structure and rename; do not invent new architecture. Re-read this
plan at the start of each phase.

## Non-negotiable gotchas (each one bit the Water or Fire executor)

1. **Rect cell math:** layout rects cover tile-CENTERED cells. The physics
   provider looks tiles up with `Math.round(world / 0.5)`. Copy the Water/Fire
   layout cell math exactly; rects built as `[tileRef, tileRef+0.5]` wedge
   the walk on blocked edges.
2. **Lights use `decay={2}`:** an intensity that must read at r metres needs
   ≈ target·r². Values 2–4 are invisible beyond ~2 m. And the inverse bite:
   what reads at 17 m blinds at 3 m. A light BELOW a walkway is occluded by it.
3. **Door gaps derive from real door tiles** (doorXSpan family). No `DOOR_GAP`
   constants.
4. **One geometry source:** every rect/ramp/disc/anchor rendered comes off the
   new `EarthCanyonLayout`; performers read the SAME anchors.
5. **`suppressedSpans`** (`museum-geometry-builder.ts` ~line 465) uses bounding
   boxes of every PAIR of suppressed wings. `cave-earth` gets
   `suppressTileGeometry: true`; add a regression test that no walkable tile
   OUTSIDE the suppressed wings loses its rendered floor. With THREE suppressed
   wings the pair count grows — verify the existing pair logic still holds.
6. **Eye math:** eye = floor + 1.60. Any sightline/visibility assertion uses it.
7. **Commits:** explicit pathspec only (`git add <paths>` then
   `git commit -m "..." -- <paths>`). The index is shared with parallel
   sessions; never stage or commit files you did not create/modify for THIS
   plan. Do not delegate work to subagents; finish it yourself.

## Earth-specific non-negotiables (from the Codex review)

8. **Discs are a new shared primitive.** The void, performer floor disc, and
   three bosses are circles. Add `Disc` records (`center`, `radius`) and an
   `inDisc` helper to the Earth layout module; `blockedAt`/terrain AND the
   graybox consume the SAME disc records. Do NOT keep a rect collision
   approximation beside circular rendered geometry.
9. **The compiled north wall stays.** The canyon is visually open north, but
   the bay keeps its normal compiled north-wall collision; the graybox
   suppresses/omits that wall's visual and renders the boulder parapet as a
   blocked band just inside it. Canyon shelves live OUTSIDE the terrain bay as
   unreachable visual-only geometry. No wall-stamper change.
10. **Exit ramp ends at datum 0.** The `earthToAir` exit is a 6 m east–west
    `ramp-x` from −1.4 to 0 at the door. Ending at −1.2 leaves a 1.2 m
    discontinuity into Air's default floor.
11. **Parapet heights are load-bearing.** North parapet 0.90 m (build cap
    1.07 m). Slab overlook: inner 1 m viewing apron walkable at −1.1 with a
    0.45 m lip; outer 2 m of the slab is blocked scenic nose. These numbers
    come from sightline math the gate exists to confirm — do not "safety up"
    the parapet to 1.1 m.
12. **Sequence data comes from the catalog, not the MCP generator.** Transcribe
    `tnd-tog-same-gggg`, `tnd-tog-same-hhhh`, `tnd-tog-same-iiii` VERBATIM from
    `static/data/hero/tnd-base-words.json` (verified present, 4 steps each).
    The generator's variation-0 default is the wrong timing family; this
    shipped wrong once in Fire (memory:
    `reference_tnd_catalog_variation_authority`).

## Phase 1 — Layout + floor plan + terrain + tests

- New `src/lib/features/museum/data/earth-canyon-layout.ts` mirroring
  `first-fire-layout.ts` (import the shared rect helpers exported from
  `drowned-gallery-terrain.ts`; add the `Disc`/`inDisc` primitive here).
  Stations per the design table: gully mouth ramp (4 m wide, 6 m, 0→−0.7,
  `ramp-x`), gully bend + lower run (4 m wide, 5 m, −0.7→−1.4, `ramp-z` then
  `ramp-x`, one bend that kills Fire's light), north ledge (2.6 m, −1.4),
  boulder parapet band (blocked, along the inside of the north boundary),
  west/south/east rim (3.2 m, −1.4), slab overlook (4 × 3 m; inner 1 m apron
  walkable at −1.1 via a 0.3 m ramp, outer 2 m blocked), void (⌀14 m blocked
  disc), performer floor disc (⌀14 m at −7.4, blocked, visual), three bosses
  (⌀2.5 m at −7.25, 4.0 m apart, line 2.0 m south of void centre, each with a
  concentric-ring anchor), canyon shelves (4 visual bands north of the bay:
  −10.5/−14.5/−19.0/−25.0), exit ramp (4 m wide, 6 m east–west along the south
  rim, −1.4→0) to the `earthToAir` door (`alignment: "end"`). Derive
  everything from wing bounds + real door tiles.
- `vulcan-cave-floor-plan.ts`: resize `cave-earth` to
  `minInteriorWidth: 45 / minInteriorHeight: 32` (≈ 33.75 × 24 m), west door =
  `fireToEarth` (Fire's east door), south door = `earthToAir`
  (`alignment: "end"`), `roomPresentation: { suppressTileGeometry: true }`,
  layout-driven performer anchors (Fire's pattern), description updated (the
  old tactile-stone-grid description is dead).
- Terrain: third bay entry in `composeCaveTerrain` in the exact pattern of the
  fire bay; `elevationAt` throws in dev on uncovered in-bay points; disc
  blocking via the shared `Disc` records (gotcha 8).
- Tests (new `tests/unit/museum/earth-canyon-traversal.test.ts` +
  `earth-canyon-terrain.test.ts`, mirroring Fire's): floor coverage, door
  coverage (both doors, Air door lands at elevation 0), neighbor elevation
  sweep ≤ 0.6 m, route walkability (gully → full rim circuit both ways →
  slab apron → exit ramp), blocked probes at 0.25 m along the parapet, void
  edge, slab nose, and canyon side, disc-blocking probes (inside void blocked,
  rim cells beside it walkable), performer anchor == layout anchor (±0.05),
  suppressedSpans regression with three suppressed wings (gotcha 5).
- Prove: `npx vitest run tests/unit/museum/` output in the report.

## Phase 2 — Graybox component + lighting

- New `src/lib/features/museum/components/game/EarthCanyonGraybox.svelte`
  rendering from `EarthCanyonLayout` only, primitives only (no GLBs — Phase 2
  art comes later). Mount in `Museum3DScene.svelte` beside `FirstFireGraybox`
  (same `currentRoomId`/`visible` streaming props, seeded RNG if randomness is
  used). Meshes: rock shell (roof +5 over the rim, aven opening above the
  void), low green-lit gully (ceiling ~+2.6), gully grass as clustered short
  emissive-tinted cones/crossed planes (graybox stand-ins, hip height ~0.7 m,
  green palette — this room must NOT read as Fire's basalt), wildflower color
  flecks in the gully (small emissive dots, purple/red/yellow), boulder parapet
  (0.90 m irregular box run), slab overlook with visible fracture line at the
  1 m apron boundary, void walls, performer floor disc with three bosses and
  carved concentric target rings, four canyon shelves receding north with
  distance haze (fog or layered translucent planes — cheapest thing that
  reads), exit ramp.
- Lighting: this is the wing's first DAYLIT room. One dominant cool-white
  daylight shaft from the aven onto the bosses (the money shot), bright enough
  to read the floor disc; soft green fill in the gully; rim stays dimmer than
  the floor so the eye is pulled down; canyon shelves lit progressively
  fainter with distance. Falling dust motes in the shaft if cheap
  (`FallingParticles.svelte` — check its import cost; skip if it drags in
  scene-specific deps). Nothing 100% black; look-back toward Fire's door must
  stay legible.
- Trail placeholders per boss: two emissive torus rings (radius ≈ 0.9 m, chest
  height ≈ anchor + 1.2, tilted ±25°) as in Fire.
- Felt downbeat: SKIP for graybox (design risk 5 says judge at the gate;
  camera-shake infra is new tech and not worth blocking the walk on). Note it
  in the ledger as deferred.

## Phase 3 — Performers + data

- `museum-exhibit-sequences.ts`: add `cave-earth-seq-g`, `cave-earth-seq-h`,
  `cave-earth-seq-i` in the exact format of `cave-fire-seq-dj/-ek/-fl`
  (leading α static step then 4 steps), transcribed VERBATIM from the catalog
  entries per gotcha 12. Remove any old single `cave-earth-seq` entry.
- Three performer stations (`MuseumPerformerStation3D` pattern), ids
  `cave-earth-automaton-g/-h/-i`, anchored from the layout bosses, facing
  up-and-out toward the south rim/slab, autoplaying.
- `CAVE_MODE_ROOMS` earth entry: migrate to `performerIds`/`sequenceIds`
  arrays (Water and Fire show the shape).

## Phase 4 — Green + ledger

- `npx vitest run tests/unit/museum/` all green (include the output).
- One full `npm run check` piped to a log; grep for errors; fix yours.
  (Resource rule: check no other svelte-check is running machine-wide first;
  free RAM ≥ 4 GB.)
- Update the ledger below in THIS file (mark [x]/[~] with notes) and commit it
  with your final commit.

## Ledger

- [x] P1 layout + floor plan + terrain + tests green —
  `src/lib/features/museum/data/earth-canyon-layout.ts`,
  `earth-canyon-terrain.test.ts` (18), `earth-canyon-traversal.test.ts` (10).
- [x] P2 graybox component + lighting registered and rendering —
  `EarthCanyonGraybox.svelte`, mounted in `Museum3DScene.svelte` behind
  `hasEarthCanyon`.
- [x] P3 performers + sequences + CAVE_MODE_ROOMS migration — landed with P1
  (see deviation 2).
- [x] P4 museum test suite green (25 files / 268 tests) + `npm run check`
  reports 0 errors and 0 warnings.
- [x] Deviations recorded here

### Deviations

1. **Gully is 12.5 m of east–west run, not ~10 m** (6 m mouth + a 4 m-thick
   north-running bend leg + 2.5 m lower run). The bend has to be a real leg
   rather than a pad for it to kill Fire's light, and the chamber still clears
   the ⌀14 m void plus a 3.2 m rim (21.5 m of the 34 m interior). The west door
   moved to `alignment: "center"` so the bend has something to bend through.
2. **P3 landed inside the P1 commit.** `vulcan-cave-floor-plan.test.ts` asserts
   `CAVE_MODE_ROOMS.performerIds` against the compiled performers, so the
   three-station migration could not be deferred past the layout change —
   exactly Fire's deviation 2. `d462b23c06` carries P1 + P3.
3. **The exit ramp gained a kerb and a landing** the plan did not name. A ramp
   climbing to datum 0 beside a rim at −1.4 leaves a 1.4 m cliff across a
   walkable seam. `exitKerb` (blocked, 0.5 m, starting 2 m east of the ramp's
   mouth) separates the deck from the rim, and `exitLanding` (flat, datum 0)
   holds the corner east of the door. The ramp itself is still a 6 m `ramp-x`
   from −1.4 to 0 at the door.
4. **Arrival reads to the RIGHT, not the left.** The design's "the ground opens
   on the left" assumed a different approach; the gully turns north and delivers
   east onto the north ledge, so the void opens to the south — the visitor's
   right. Everything else about the arrival (ledge, drop, figures below and
   behind) holds. Judge it at the gate.
5. **Felt downbeat deferred**, per the plan: camera-shake infrastructure is new
   tech and not worth blocking the walk on. Design risk 5 stays open.
6. **Existing test updated, not loosened.** `vulcan-cave-floor-plan.test.ts`'s
   `BAY_ROOM_IDS` now names three authored bays, and the "largest solo chamber"
   assertion points at `cave-air` since Earth is no longer a solo.
7. **Canyon-shelf distances are authored**, not derived — the shelves sit
   3/9/17/29 m north of the bay at the design's four elevations. They are
   outside the terrain bay and unreachable behind the compiled north wall.

### Browser-walk findings (2026-08-04, first-person verification pass)

Four causes found behind "the pit does not read from the rim". Three fixed and
locked with tests; one still OPEN.

1. **FIXED — rock fill across the slab approach.** `subtractTiles` only carves a
   tile whose whole cell sits inside one hole rect, and the slab and exit rects
   come off metre offsets that miss tile-cell boundaries. Three blocks survived
   at `x[103.75,108.25] z[18.25,18.75]` and either side, rendered from y −8.4 to
   +3.6 — a 12 m wall straight across the viewing line. Rock is now the
   tile-centre complement of the floor (`rasterise`), and the chamber must
   contain zero rock fill (new test).
2. **FIXED — the daylight shaft stood 0.4 m from the eye.** Widening the column
   to "contain the bosses" (r = 6) put its translucent DoubleSide wall inside the
   apron, which sits 6.45 m from the void centre. A pitch sweep showed
   `daylight-shaft` as the first hit at EVERY pitch across the frame. The radius
   is now derived in the layout with 1.5 m apron clearance, and the material is
   BackSide so a near wall can never paint over the pit. New test asserts the
   clearance.
3. **FIXED — the slab nose was a level 2 m tongue.** The eye→boss line crosses
   apron height ~0.5 m out, i.e. mid-nose, so a flat nose hid the performance
   from the one viewpoint the room is composed for. It now falls away to
   `SLAB_NOSE_OUTER_Y` (−4.5), which is also what "fractured" means. The
   sightline test walks eye→boss in 0.1 m steps against rock, walls, parapet,
   lip and the tilted nose.
4. **RESOLVED (verifier, 2026-08-04) — there was no rendering bug.** The
   "black pit" was the harness: `window.__gameBridge.bindings.camera.setPitch`
   is INVERTED relative to intuition — negative pitch looks UP. Every
   "look-down" frame in this investigation was actually photographing the
   ceiling AVEN, whose circular cut against the unlit roof reads exactly like
   a black pit and sits in the same part of the frame. `camera.getWorldDirection`
   at pitch −0.85 returned `(0, +0.75, −0.66)` — pointing up. At pitch
   **+0.85** from the slab apron (106, 17.9, yaw π) the acceptance frame is
   met: three lit automatons mid-swing on their bosses, trail rings, and the
   daylight pool on the floor disc, verified by screenshot. The `0,0,0`
   framebuffer samples were a second artifact: `readPixels` on a
   non-preserved drawing buffer returns zeros regardless of content. Fixes
   1–3 above were real defects and remain valid.

**Harness note for the next session.** The teleport recipe cannot reproduce real
first-person rendering: `camera.setMode('first_person')` on the bridge does not
set `Museum3DScene`'s own `fpsActive`, so the top-down player marker
(`Museum3DScene.svelte` ~1319, gated on `!fpsActive`) stays mounted and its
12 cm heading cone sits 0.35 m in front of the eye, first-hitting every ray in
the lower half of the frame. Suppress it by scaling that group to ~0 (setting
`visible` is overwritten every frame by the reactive binding) or teach the bridge
to drive `fpsActive`. Some of the original "dome" report is this cone. Also:
**setPitch sign is inverted (negative = up)** and **canvas `readPixels` returns
`0,0,0` everywhere** (drawing buffer not preserved) — screenshot, never sample.

### Open for the gate (from the design's own question list)

Parapet at 0.90 m everywhere vs the slab's 0.45 m lip; four backdrop shelves or
three; grass on the rim or bare rock; fireflies in a daylit room; the felt
downbeat. All five are look-at-it questions and none of them are answered here.

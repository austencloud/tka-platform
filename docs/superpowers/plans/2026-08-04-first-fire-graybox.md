# The First Fire — Graybox Executor Plan (2026-08-04)

Design: `docs/superpowers/specs/2026-08-04-first-fire-design.md` (read it first).
Reference implementation for every pattern: the Water build —
`src/lib/features/museum/data/vulcan-cave-floor-plan.ts` (DrownedGalleryLayout
section), `src/lib/features/museum/data/drowned-gallery-terrain.ts`,
`src/lib/features/museum/components/game/DrownedGalleryGraybox.svelte`,
`tests/unit/museum/drowned-gallery-traversal.test.ts` and
`drowned-gallery-terrain.test.ts`. When in doubt, copy Water's structure and
rename; do not invent new architecture. Re-read this plan at the start of each
phase.

## Non-negotiable gotchas (each one bit the Water executor)

1. **Rect cell math:** layout rects cover tile-CENTERED cells. The physics
   provider looks tiles up with `Math.round(world / 0.5)`. Copy the Water
   layout's cell math exactly; rects built as `[tileRef, tileRef+0.5]` wedge
   the walk on blocked edges.
2. **Lights use `decay={2}`:** an intensity that must read at r metres needs
   ≈ target·r². Values 2–4 are invisible beyond ~2 m.
3. **Door gaps derive from real door tiles** (doorXSpan family). No `DOOR_GAP`
   constants.
4. **One geometry source:** every rect/stair/anchor rendered comes off the new
   `FirstFireLayout`; performers read the SAME anchors.
5. **`suppressedSpans`** (`museum-geometry-builder.ts` ~line 465) uses bounding
   boxes of every PAIR of suppressed wings. `cave-fire` gets
   `suppressTileGeometry: true`; add a regression test that no walkable tile
   OUTSIDE the suppressed wings loses its rendered floor.
6. **Eye math:** eye = floor + 1.60. Any sightline/visibility assertion uses it.
7. **Commits:** explicit pathspec only (`git add <paths>` then
   `git commit -m "..." -- <paths>`). The index is shared with parallel
   sessions; never stage or commit files you did not create/modify for THIS
   plan. Do not delegate work to subagents; finish it yourself.

## Phase 1 — Layout + floor plan + terrain + tests

- New `src/lib/features/museum/data/first-fire-layout.ts` (name/structure
  mirroring DrownedGalleryLayout; if Water's layout lives inside another file,
  mirror THAT placement instead): bands per the design table — ember bridge
  (3 m wide, ~8 m, −0.3, lava stream blocked both sides), darkening crack
  (~2.5 m, one bend, ramp −0.3→−0.8), three bench terraces (−0.8/−1.3/−1.8
  arcs facing north with aisle steps), ash circle (blocked disc on the −0.8
  terrace, south-center), lava fissure (4 m east–west band, blocked), performer
  shore (−1.3, blocked, three station anchors at thirds), exit stair
  (−0.8→0, east) to the `fireToEarth` door. Derive everything from wing
  bounds + real door tiles.
- `vulcan-cave-floor-plan.ts`: resize `cave-fire` (minInterior ≈ 26 × 20 plus
  approach; follow how the gallery/grotto wings declare size), keep west door =
  `waterToFire` (grotto east door, z 21–23 axis), east door = `fireToEarth`,
  `roomPresentation: { suppressTileGeometry: true }`, replace the old inline
  `performers` entry with layout-driven anchors (Water's grottoPerformers
  pattern).
- Terrain: extend the museum elevation system for the fire bay exactly the way
  `drowned-gallery-terrain.ts` plugs in (zones from the layout; `elevationAt`
  throws in dev on uncovered in-bay points).
- Tests (new `tests/unit/museum/first-fire-traversal.test.ts` + terrain test,
  mirroring Water's): floor coverage, door coverage, neighbor elevation sweep
  ≤ 0.6 m, route walkability (bridge → crack → every terrace → exit stair),
  blocked probes along fissure/lava/shore/ash-circle edges at 0.25 m,
  performer anchor == layout anchor (±0.05), suppressedSpans regression
  (gotcha 5).
- Prove: `npx vitest run tests/unit/museum/` output in the report.

## Phase 2 — Graybox component + lighting

- New `src/lib/features/museum/components/game/FirstFireGraybox.svelte`
  rendering from `FirstFireLayout` only: rock shell/fill, bridge, crack walls,
  terraces + risers, ash circle (dark ring + 2–3 charred-stave cylinders),
  fissure + lava stream as emissive planes (lava orange, no textures), shore,
  exit stair. Register in `VulcanCaveScenicLayer.svelte` beside
  DrownedGalleryGraybox (same `currentRoomId`/`visible` streaming props, seeded
  RNG if randomness is used).
- Lights (gotcha 2, nothing 100% black): three fire-pit warm point lights
  (primary, slow sine pulse ~0.15 Hz amplitude ±30%; if the pulse fights the
  frame budget, ship static), bridge under-glow, one cool cue in the crack,
  faint amphitheater fill, warm bench-edge rim. Looking back from the front
  bench toward the entry must read (dim, but legible).
- Trail placeholders: per performer station, two emissive torus rings (radius
  ≈ 0.9 m, chest height ≈ anchor + 1.2, tilted ±25°, colors #fff3d6 / #ffb35c,
  no lighting dependence).

## Phase 3 — Performers + data

- `museum-exhibit-sequences.ts`: add `cave-fire-seq-dj`, `cave-fire-seq-ek`,
  `cave-fire-seq-fl` in the exact format of `cave-water-seq-a/b/c` (leading α
  static step, then 4 steps). Transcribe VERBATIM from the MCP data below
  (constraint score 1.00 each, fetched 2026-08-04). Remove the old
  `cave-fire-seq` entry (and the orphaned `cave-water-seq` movement data —
  handoff loose end — if it is still present).
- Three performer stations (`MuseumPerformerStation3D` pattern from Water)
  anchored from the layout, ids `cave-fire-automaton-dj/-ek/-fl`, facing south
  (toward the benches), autoplaying their sequences.
- `CAVE_MODE_ROOMS` fire entry: migrate `performerId`/`sequenceId` to
  `performerIds`/`sequenceIds` arrays (the Water entry shows the migrated
  shape).

### MCP step data (transcribe verbatim; JSON field names map to the existing entry format)

JDJD (alpha3 → alpha3): steps 1–4 =
J alpha3→beta5 blue w→s pro ccw in/in · red e→s pro cw in/in;
D beta5→alpha7 blue s→e pro ccw in/in · red s→w pro cw in/in;
J alpha7→beta1 blue e→n pro ccw in/in · red w→n pro cw in/in;
D beta1→alpha3 blue n→w pro ccw in/in · red n→e pro cw in/in.

KEKE (alpha3 → alpha3): steps 1–4 =
K alpha3→beta5 blue w→s anti cw in/out · red e→s anti ccw in/out;
E beta5→alpha7 blue s→e anti cw out/in · red s→w anti ccw out/in;
K alpha7→beta1 blue e→n anti cw in/out · red w→n anti ccw in/out;
E beta1→alpha3 blue n→w anti cw out/in · red n→e anti ccw out/in.

LFLF (alpha3 → alpha3): steps 1–4 =
L alpha3→beta5 blue w→s anti cw in/out · red e→s pro cw in/in;
F beta5→alpha7 blue s→e anti cw out/in · red s→w pro cw in/in;
L alpha7→beta1 blue e→n anti cw in/out · red w→n pro cw in/in;
F beta1→alpha3 blue n→w anti cw out/in · red n→e pro cw in/in.

Every word's step 0 is the α static step copied from `cave-water-seq-a` step 0.
The leading α step and all four steps use the same startOrientation →
endOrientation values listed (in/in means start in, end in; in/out means start
in, end out).

## Phase 4 — Green + ledger

- `npx vitest run tests/unit/museum/` all green (include the output).
- One full `npm run check` piped to a log; grep for errors; fix yours.
  (Resource rule: check no other svelte-check is running machine-wide first;
  free RAM ≥ 4 GB.)
- Update the ledger below in THIS file (mark [x]/[~] with notes) and commit it
  with your final commit.

## Ledger

- [x] P1 layout + floor plan + terrain + tests green — `first-fire-layout.ts`
      (bands, crack, terraces, ash, fissure, shore, exit stair, stations),
      `cave-fire` resized to 62 × 27 minInterior (≈ 46.5 × 20.5 m) with
      `suppressTileGeometry` and layout-driven performers, cave terrain now
      composed per bay; `first-fire-terrain.test.ts` (15) +
      `first-fire-traversal.test.ts` (9). Commit `8a3bf8e1`.
- [x] P2 graybox component + lighting registered and rendering —
      `FirstFireGraybox.svelte`, mounted in `Museum3DScene.svelte` beside
      `DrownedGalleryGraybox`. Commit `d97bec31`.
- [x] P3 performers + sequences + CAVE_MODE_ROOMS migration — landed inside the
      P1 commit (see deviation 2). `cave-fire-seq-dj/-ek/-fl` transcribed from
      the MCP data above; old `cave-fire-seq` and the orphaned `cave-water-seq`
      removed; room content stages the three stations with autoplay.
- [x] P4 museum test suite green + full check clean — `npx vitest run
      tests/unit/museum/` 23 files / 242 tests passed; `npm run check` exit 0,
      "svelte-check found 0 errors and 0 warnings".
- [x] Deviations recorded here:
  1. Water's private rect helpers (`interiorWorldRect`, `doorSpan`,
     `widenSpan`, `bandRects`, `subtractTiles`, `spansExcluding`, `unionRect`)
     are now exported from `drowned-gallery-terrain.ts` and imported by the
     fire layout, rather than copy-pasted. One vocabulary, one source.
  2. P3's data changes (sequences, room content, `CAVE_MODE_ROOMS`) shipped in
     the P1 commit: `vulcan-cave-floor-plan.test.ts` asserts every declared
     performer resolves to authored movement data, so the phases could not be
     green apart.
  3. Terrace transitions are full-width ramped risers (rendered as steps)
     instead of discrete aisle steps — guarantees the ≤ 0.6 m neighbour sweep
     and keeps the exit stair reachable from every bench, which the gate asks
     for. Aisle-only steps can return with the art pass.
  4. The graybox mounts in `Museum3DScene.svelte` (where
     `DrownedGalleryGraybox` actually lives), not inside
     `VulcanCaveScenicLayer.svelte` as the plan's wording suggested. Same
     `currentRoomId`/`visible` streaming props.
  5. The shore and the fissure span only the amphitheatre half of the room;
     west of it the crossing runs through rock. A full-width fissure would
     have overlapped the lava stream flanking the bridge.
  6. Two existing assertions in `vulcan-cave-floor-plan.test.ts` encoded
     "Water is the only bay" (solo-chamber rule, largest-room rule). Both now
     read from a two-bay set; Earth is still the largest solo chamber.
  7. Not yet done, and outside this plan: the design's open item — swapping
     JDJD/KEKE/LFLF to the split-timing variations. The shipped data is the
     variation-0 run the plan transcribed (motion correct, `timing: "tog"`).
  8. No first-person screenshot pass: the eye-level gate is Austen's walk, and
     the museum scene is not a route a headless viewport can stand in.

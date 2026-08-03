# Plan — Drowned Gallery Ring graybox (v2 flow)

Executes `docs/superpowers/specs/2026-08-03-drowned-gallery-ring-flow-design.md`.
Plan sheet: `static/sketches/2026-08-03-drowned-gallery-ring-plan.html`.
Read the design spec FIRST and re-read it at the start of every phase — the
spec is the authority, not your memory of it.

Context you must load before Phase 1:
- `src/lib/features/museum/data/vulcan-cave-floor-plan.ts` (room graph)
- `src/lib/features/museum/data/drowned-gallery-terrain.ts` (current layout/zones)
- `src/lib/features/museum/components/game/DrownedGalleryGraybox.svelte`
- `src/lib/features/museum/services/museum-physics-provider.ts` (consumption)
- `src/lib/features/museum/services/museum-grid-builder.ts` (performer placement)
- `tests/unit/museum/drowned-gallery-traversal.test.ts` + `drowned-gallery-terrain.test.ts`
- The engineering-invariants section of the design spec (they are requirements)

Ground rules: commit per phase with EXPLICIT pathspec
(`git commit -m "..." -- <files>`), never `git add -A`; do not touch files
outside your task; do not create branches; do not amend; do not push. Do not
delegate any of this. Never run `npm run dev` or kill port 5173; do not
start a vite server. Derive all geometry from room bounds/door tiles — a
grep for hardcoded world coordinates in the graybox must come back empty.

## Ledger

- [x] P1 room graph: gallery wing replaces sump
- [x] P2 layout + terrain program v2
- [x] P3 graybox geometry v2
- [x] P4 lights + life stand-ins
- [x] P5 tests (traversal ring + coupling invariants)
- [x] P6 full check + fixups

Landed 2026-08-03 as `df52cef9bf` (P1–P5, one green commit — the phases are not
separable without committing a broken graybox) and `1e7ea136d3` (P6 fixups).
`npm run check`: 0 errors, 0 warnings. `tests/unit/museum/` 218 pass (from 204).
Longest contiguous submerged walk: 28.85 m.

Deviations, with reasons:

1. **`LANDING_Y` is −3.1, not −2.3.** The plan's own acceptance test asks for a
   landing whose eye height sits on the waterline, and the eye is always
   `floor + 1.6` (physics STANDING_Y 0.85 + UCC 0.75). At −2.3 the eye is 0.8 m
   ABOVE the surface, so the break would happen on the ramp below the landing.
   `LANDING_Y` is now derived as `WATERLINE_Y − EYE_ABOVE_FLOOR`, which makes
   the spec's sentence literally true: you stand on the landing with your eyes
   exactly at the surface.
2. **Gallery interior is 13.5 × 24 m, not ≈12 × 20.5.** At the spec's size the
   contiguous submerged span comes out ≈21 m, short of the ≥24 m engineering
   invariant. `minInteriorWidth 18` / `minInteriorHeight 32` yields 28.85 m with
   margin. The grotto is unchanged at 25 × 22.
3. **Surfacing stair run is 8.0 m, not ≈7.** With a 1.4 m landing, 7 m leaves
   both flights at ~36°; 8 m brings them to ~32.5°, a normal steep stair.
4. **The rock roof stops where it would hit the walker's head.** "Roof over
   EVERY gallery path tile" is impossible at the two stair mouths: at −1.9 the
   roof needs the floor at −3.9 or deeper. Both stairs therefore pass through an
   open shaft above that depth — which is also where the two water planes the
   plan asks for (descent mouth, landing cut) become visible.
5. **Rect geometry moved onto tile-centred cells.** The inherited convention
   (`[tileRef, tileRef + 0.5]`) is offset half a tile from the physics
   provider's `Math.round` lookup, which put walkable tile centres exactly on
   blocked rects' edges. The ring walk wedged there. Every rect now covers the
   cells centred on tile positions.
6. **No balustrade on the channel's north edge.** That edge is the alcove
   shore's rock face, not a walkway; a rail there would stand against rock.
7. **The orphaned `cave-water-seq` sequence data is kept.** The stale
   CAVE_MODE_ROOMS fields are gone (the entry now carries `performerIds` /
   `sequenceIds` arrays), but the authored ABAB movement data itself was left in
   place rather than deleted as part of a graybox change.

## Phase 1 — Room graph

In `vulcan-cave-floor-plan.ts`:
1. Remove the `cave-water-sump` wing. New wing `cave-water-gallery`
   ("The Flooded Gallery", theme cave, `suppressTileGeometry`), interior
   ≈ 12 × 20.5 m (mind ROOM_SCALE 1.5: minInteriorWidth 16, minInteriorHeight 28
   — VERIFY the compiled interior lands ≈ 24 × 41 tiles and note actuals).
   South wall: door to approach (3 tiles, as approach's north door is today).
   North wall: door to grotto, **center**, 6 tiles (3 m).
2. Grotto south wall door: `doorWall(EDGE_IDS..., "center", 6)`.
3. Update `CAVE_SPACE_ORDER`, `EDGE_IDS` (approach→gallery, gallery→grotto),
   and fix the stale `CAVE_MODE_ROOMS` `cave-water` entry (three performers
   `cave-water-a/b/c`; drop the dead `cave-water-automaton`/`cave-water-seq`).
4. Performer stations: alcove anchors must come from ONE expression shared
   with the layout (grotto-fraction x = 0.22/0.5/0.78 → x 7/14/21, z ≈ 3.1,
   elevation `SHELF_Y` imported, not the literal −1.0). If the station format
   can't import from the terrain module (dependency direction), define the
   anchor fractions in ONE exported constant the terrain module also uses.
Verify: temp probe (delete after) printing gallery/grotto bounds + door tile
spans; museum tests will be red until P5 — that's expected; do NOT commit
broken tests, so P1+P2+P3 may land as one commit if needed, or gate each
commit on the suite by adjusting tests minimally per phase. Prefer fewer,
green commits over many red ones.

## Phase 2 — Layout + terrain v2 (`drowned-gallery-terrain.ts`)

Rewrite `DrownedGalleryLayout` for the Ring. Everything below derives from
wing bounds + door tiles; export every rect the graybox will render.

Datums: `WATERLINE_Y −1.5`, `GALLERY_FLOOR_Y −4.5`, `GALLERY_ROOF_Y −1.9`,
`LANDING_Y −2.3`, `CAUSEWAY_Y −0.3`, `SHELF_Y −1.0`, `CHANNEL_BED_Y −2.7`,
`POOL_BOTTOM_Y −5.0`, `DOME_APEX_Y 9.5`.

Grotto bands (z fractions of interior depth, matching the spec's meter
values on today's 22 m interior): shore 1.5–5.0 (blocked), channel 5.0–9.0
(water, blocked), procession walkway 9.0–11.5, pool 11.5–19.0 (blocked),
apron 19.0–23.5. Channel + pool x 4–23. West walkway x 1.5–4 (z 5–19), east
walkway x 23–26.5 (z 9–23.5). Threshold rect on the east walkway z ≈ 15.5–16.5.
Waterfall rect at channel west end (x 4–5.5). Alcoves x-fractions
0.22/0.5/0.78, z shore.minZ + 1.6.

Gallery: an S-path ≈ 2.5–3 m wide derived from the gallery bounds + its two
door spans — descent stair rect at the south door (−1.5 → −4.5, run ≥ 5 m),
west run (x ≈ gallery.minX + 1.5..4.5), north run, east bend into the
surfacing stair rect at the north door span (−4.5 → LANDING_Y → −0.3; flat
landing ≥ 1.2 m deep; total run ≈ 7 m). `bloomAnchor` at the north run's
midpoint. Everything in the gallery that is not path or stair: `rockFill`
rects (blocked + rendered).

Elevation zones: approach ramp (keep) · descent stair two segments · gallery
floor flat −4.5 over the path · surfacing stair two ramps + flat landing ·
apron/walkways/procession flat −0.3 · grotto catch-all −0.3. `blockedAt`:
shore, channel, pool, rockFill, threshold posts. `elevationAt` THROWS in dev
(import.meta.env.DEV) when nothing matches inside the water-bay bbox.
Missing wing/door → throw (no null path for the gallery).

Water planes: channel, pool, gallery path segments (at −1.5, they render as
the roofed water's body via volumes; plane only where a surface could be
seen: descent stair mouth + landing cut), keep abutment (no overlaps).

## Phase 3 — Graybox v2 (`DrownedGalleryGraybox.svelte`)

Rebuild from the new layout. Requirements:
- Floors/ramps/stairs for every walkable rect; stair rendered as riser boxes
  (0.18–0.20 m risers) over the ramp physics; landing slab distinct.
- Rock roof over EVERY gallery path tile at −1.9; walls from rockFill edges;
  the gallery reads enclosed on all four sides everywhere inside.
- Door gaps: derived from door tiles only. No `DOOR_GAP` constant anywhere.
- Alcove shore: rock mass with three cut niches (opening ≈ 3.5 m wide,
  3 m high), shelf, glyph disc (emissiveIntensity ≤ 0.25, warm ochre
  `#c8884a`), firelight per niche.
- Balustrade: full pool + channel perimeter minus nothing (procession has
  water on both sides — rails both edges), plus apron pool-edge.
- Carved threshold: two jambs + lintel + ≥10 gold bars over the east walkway
  (clear gaps ≤ 0.2 m) with a walk-through opening ≥ 2.2 m wide — it frames,
  it does not block (blockedAt only under the jambs).
- Waterfall: single column at the channel west end, `emissiveIntensity ≤ 0.25`.
- Water: planes + BackSide volumes per layout; volumes over the whole
  gallery path (floor→−1.5) and channel/pool.
- Component props: `currentRoomId`, `visible` (mount pattern of
  `VulcanCaveScenicLayer`); zero per-frame work; `$derived` off `grid`;
  dispose geometries/materials on destroy; all RNG seeded (mulberry32 or
  similar, fixed seed).

## Phase 4 — Lights + life stand-ins

Lights (seeded positions, count ≤ 12, all in the graybox): approach
waterline glow (keep) · one cool glow per gallery bend (2) · bloom glow ·
warm spill light at the surfacing stair top (visible through water from the
last bend) · two apron/south fills · three alcove firelights · one waterfall
accent. NOTHING renders 100% black looking back south from the procession.
Life stand-ins (graybox only, Phase 3 brings real GLB fauna): 8–12 emissive
plant cones clustered at `bloomAnchor` + ~6 singles along the path; ~8 small
fish-marker primitives (static, seeded) in the bloom. Cave-native palette
(`#7fe8c8` glow accents, pale bodies), nothing tropical.

## Phase 5 — Tests

Rewrite `drowned-gallery-traversal.test.ts` + `drowned-gallery-terrain.test.ts`
for the Ring; add the coupling invariants (design spec section — all six).
Required assertions:
1. Route: squeeze north door → approach → gallery S-path → stair → apron →
   west walkway → procession (through A/B/C x positions) → east walkway →
   Fire west door, via real `MuseumPhysicsProvider.movePlayer`.
2. Ring: apron → west → procession → east → back to apron (closed circuit).
3. Submersion by trigger math: contiguous span with `y + 0.75 < −1.5` is
   ≥ 24 m along the gallery walk; procession/apron samples all ≥ −1.5+0.05.
4. Landing: exists a stair sample with elevation ≈ −2.3 (±0.05) whose
   `y + 0.75` is within ±0.25 of −1.5 (the surface break happens ON it).
5. Neighbor elevation sweep: every walkable water-bay tile vs 4 neighbors
   ≤ 0.6 m.
6. Floor coverage: every walkable water-bay tile center inside ≥1 rendered
   floor/ramp/stair rect (export the rect list for the test).
7. Door coverage: no rendered wall rect overlaps any door tile's world
   extent; each door's full span is inside a gap.
8. Blocked edges: pool, channel, shore probed at 0.25 m intervals along
   their walkway-facing edges → blocked; walkway side → not blocked.
9. Performer anchors == layout alcove anchors (±0.05) for all three.
10. Dev-throw: `elevationAt` on an uncovered in-bay point throws (DEV).

## Phase 6 — Full check + fixups

`npx vitest run tests/unit/museum/` green; then ONE full `npm run check`
(capture to a log, grep errors — check the machine-wide svelte-check gate in
`.claude/rules/resource-budget.md` first) and fix everything it reports.
Also run `npx vitest run tests/unit/internal-route-release-guards.test.ts`
and any test that greps the floor plan (search for `cave-water-sump`
references repo-wide and update: docs stay, code must not reference the
removed wing). Final commit; summarize per-phase commits.

## Report back

Final message: per-phase commit SHAs, test counts, the compiled gallery/
grotto bounds + door spans (actual numbers), any deviation from the spec
with its reason, and anything you could not complete. No screenshots — the
orchestrator does the visual pass.

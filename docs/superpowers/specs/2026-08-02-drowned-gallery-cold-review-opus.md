---
status: active
value: 3
effort: M
remaining: 'Cold review of the Phase-1 graybox. Findings and a ranked, measurable aesthetic push; nothing implemented.'
depends_on: 'docs/superpowers/specs/backlog/2026-08-02-vulcan-cave-water-room-drowned-gallery-design.md'
plan_path: ''
tags: [museum, drowned-gallery, review, graybox]
last_triaged: 2026-08-02
---
# The Drowned Gallery — Cold Review (Phase 1 graybox)

I reviewed this with no prior context on the project. I read the design spec, the
graybox handoff + addendum, and the playtest report, then read
`vulcan-cave-floor-plan.ts`, `drowned-gallery-terrain.ts`,
`DrownedGalleryGraybox.svelte`, `museum-physics-provider.ts`,
`museum-grid-builder.ts` (performer placement), `wall-segment-types.ts` (room
sizing), `museum-geometry-builder.ts` (tile suppression),
`museum-room-light-pool.ts`, and
`tests/unit/museum/drowned-gallery-traversal.test.ts`.

I then walked the room myself in Chrome DevTools MCP at 1920×1080, teleporting
via the `museum-cave-3d-state-v1` sessionStorage trick (using `navigate_page`'s
`initScript` — a plain `setItem` + `location.reload()` loses the race against the
app's own persist-on-unload and silently keeps the old position; worth knowing
for the next session). Frames read at seven stations: approach top (14.25, 50),
approach waterline (14.25, 41), sump middle (14.25, 34), corridor west run
(12, 25.75, yaw −π/2), top-of-steps reveal (2.75, 20, yaw π), causeway
(14, 21, yaw π), causeway looking back (10, 21, yaw 0), overlook B (14, 18.4),
and gate view (25, 7.6, yaw −2.415). I also dumped the real compiled grid in-page
to get door tile spans, wing bounds, and the layout rects rather than trusting
the docs. Console was clean (two Vite HMR debug lines, nothing else).

Every dimension below is measured off the compiled grid or the source, not the
spec sheet. Grotto interior is **25.0 × 22.0 m** (x 1.5–26.5, z 1.5–23.5);
approach x 13–15.5, z 44–56; sump x 13–15.5, z 28.5–39.

## Findings

### Spatial / compositional

- station (10, 21, yaw 0) | **BLOCKER** | Turn around anywhere on the causeway and the frame is 100% black — not one readable pixel. The entire southern half of the grotto (a 25 × 4.5 m walkway, the 22 m south wall, the door you just came through, the steps you just climbed) has zero light on it. Every light in the room points north or sits over the pool. A room you cannot look back into does not read as a room.
- station (2.75, 20, yaw π) | **BLOCKER** | The reveal frame does not contain the reveal. Looking north from the top of the surfacing steps, the frame is: 45% black wall on the left, the waterfall column dead centre, and the three performers strung along the **right edge** with alcove C clipped by the frame boundary. The pedagogy (A, B, C) is the one thing pushed out of the money shot. The arrival is at x 2.75 — 0.5 m off the west wall of a 25 m room, i.e. the extreme corner — so the room opens sideways, not ahead.
- `drowned-gallery-terrain.ts:369-394` + eye math | **major** | The "fully submerged" sequence is **6.6 m long, ≈2.2 s at the 3 m/s walk speed**. Eye = floor + 0.85 (`museum-physics-provider.ts:36`) + 0.75 (`Museum3DScene.svelte:647`) = floor + 1.60, so submersion starts when the floor drops below −3.10. On the 4 m south ramp that is z = 36.54; on the 3 m north ramp it ends at z = 29.92. The design spec asked for "~10 m fully submerged"; the sump is 10.5 m long but 7 m of it is ramp. The single most load-bearing beat in the room is over before it registers.
- `drowned-gallery-terrain.ts:26` + eye math | **major** | The 15.5 m sump↔grotto corridor is not a flooded corridor. Floor −2.2, waterline −1.5 → **0.7 m of water**, and the eye sits 0.9 m above the surface. That is a mid-thigh wade in a rock slot, not "the visitor came through the water." The handoff's claim that "in the corridor the head is just above the −1.5 waterline" is off by 0.9 m.
- station (12, 25.75, yaw −π/2) | **major** | 15.5 m of 1.5 m-wide corridor with no ceiling, no light, no landmark and no goal in frame. The whole frame is black except a blue floor triangle. Combined with the 12 m approach, the 5 m link, the 10.5 m sump and the 3 m steps, that is **≈46 m / ≈15 s of unbroken darkness** to reach the grotto, of which only 2.2 s is the payload (submersion). This is monotony, not compression.
- `DrownedGalleryGraybox.svelte:427-430` | **major** | Only two ceiling slabs exist (`sumpFlat`, `grotto`). The 12 m approach, the 5 m approach↔sump link, the sump's 7 m of ramps, the 15.5 m corridor and the 3 m surfacing steps have **no roof at all** — 32.5 of the 46 m approach sequence is open to the void. A cave whose premise is constriction is roofless for 70% of its constricted length.
- `drowned-gallery-terrain.ts:19` vs `:17` | **major** | `SUMP_CEILING_Y = −1.9` is **0.4 m below** `WATERLINE_Y = −1.5`. In the sump's flat middle the water surface is physically above the rock ceiling, so the visitor can never see the surface they are under, and the surfacing moment cannot be foreshadowed. The sump water plane rendered at −1.5 is buried 0.1 m above the ceiling slab's top face (−1.6) — dead geometry.
- `drowned-gallery-terrain.ts:256-261` | **major** | The surfacing steps are a 1.9 m rise over a 3.0 m run = **32.3°** — the same gradient the team explicitly softened the sump entry ramp away from ("a 2 m run was ~52°, it read as a chute", `:369-373`; 4 m brought it to 33.0°). The reveal is delivered by climbing a chute of the exact steepness that was already rejected. It is also only **2.0 m wide** and hugs the west wall.
- stations (14, 21) / (14, 18.4) | **major** | There is no progressive reveal. From the first causeway step you can already see all three performers, the waterfall, the pool, the reflections and the gold gate simultaneously. The three overlooks and the 14 m gate leg therefore add walking distance without adding information — the "one close view at ~5 m" (which genuinely is the best frame in the build) is pre-spent from 15 m away.
- alcove/overlook geometry | **minor** | Viewing distance overlook → performer is **15.15 m** (z 18.25 → 3.10). A 1.8 m figure subtends 6.8°, ≈130 px of an 1080 px frame. Measured in the overlook frame the figures are ~110 px including their plinth. They read, barely; letters A/B/C are not distinguishable at that size without the glyph discs doing the work.
- `drowned-gallery-terrain.ts:199-212` | **minor** | Pool is 20 × 14 = 280 m² of a 550 m² footprint = **50.9%**. The blocked north shore is another 87.5 m² (15.9%) of which only 36 m² (three 4 × 3 shelves) is used for anything. Walkable area ≈ 178 m² = 32%. Two thirds of the biggest room in the wing is scenery, and half the scenery is empty ledge.
- `DrownedGalleryGraybox.svelte:500-521` | **minor** | The gate is 6 bars of 0.08 m over a 3.0 m span → **0.42 m clear gaps**, 1.6 m tall from −0.3 so the top rail is at 1.3 m — below a 1.60 m eye. At the gate station it reads as a low garden fence you would step over, not a museum barrier. It is also redundant: `blockedAt` already blocks the whole `shore` rect at z < 5, so the gate strip (z 6.0–6.6) bars a 1 m sliver of walkway whose only continuation is already blocked.
- `DrownedGalleryGraybox.svelte:546-558` | **minor** | The balustrade covers only the pool's **south** edge (x 3.5–23.5 minus the three overlooks ≈ 11 m of rail). The 15.5 m west ledge and the 14 m east walkway run alongside the same 1.2 m drop to water / 4.7 m drop to basin with no rail and no visual edge. In the reveal frame the west ledge just ends in blackness.
- `DrownedGalleryGraybox.svelte:523-535` | **minor** | The waterfall is a 1.6 × 11 × 0.5 m emissive white box at `#dff2ff`, opacity 0.8. In every grotto frame it is the brightest object by a wide margin and reads as a marble monolith or a lit doorway. It out-competes the three performers for attention at exactly the moment the performers are the subject.
- `DrownedGalleryGraybox.svelte:560-568` | **minor** | 250 glowworm points, `size 0.07`, uniformly random over the full 25 × 22 m × 1.4 m band = 0.45 points/m², against an unlit black ceiling. In frame they read as a **sparse night sky**, not a glowworm dome — the room looks roofless. Seeded with `Math.random()`, so the field is different on every mount and screenshots are not reproducible frame-to-frame.
- `DrownedGalleryGraybox.svelte:429` + all grotto frames | **minor** | The "dome" is a flat slab at y 9.5 over a 25 × 22 m room (9.8 m clear above the causeway). It appeared in **none** of the six eye-level frames — at every station it sits above the top of the FOV, and where it is in frame it is unlit `#2b2620` and indistinguishable from void. ~10 m of authored vertical is currently invisible.
- `DrownedGalleryGraybox.svelte:460-497` | **minor** | The alcove shelves, 3.2 m back walls and 0.9 m rock fins are effectively invisible: each niche light is a point light at the performer's own height inside the niche, so it lights the performer and nothing behind or beside them. The three figures read as floating on a black ledge; the "rock fins so each reads solo" separation does nothing at 15 m.
- station (25, 7.6) | **minor** | At the gate close view the performer stands on a black cylindrical plinth (the `MuseumPerformerStation3D` platform) sitting on top of the graybox's tan stone shelf — two stacked stages under one figure. Reads as an unfinished prop, not an alcove.
- corridor jog | **nit** | The ~11 m westward jog between the sump and grotto doors — originally a bug source — is actually the best pacing device in the build: it kills the straight sightline so nothing of the grotto leaks into the corridor. Worth keeping deliberately rather than tolerating.
- pool reflections, stations (14, 21) / (14, 18.4) | **nit** | The pool doubling works. Three warm streaks under the alcove lights plus two cool streaks under the waterfall lights are the only thing in the room that currently looks designed. Keep this exact mechanism.

### Implementation

- `DrownedGalleryGraybox.svelte:51,364-389` vs compiled grid | **BLOCKER** | Both graybox door gaps are wrong, and this is the same failure class Austen already reported twice. `DOOR_GAP = 3` is a fixed 3 m hole regardless of the real door width. Measured on the compiled grid: the grotto **south** door tiles span world x 2.0–3.5 (1.5 m, centre 2.75); the rendered gap is centred on `cx(surfacing)` = 2.5 → 1.0–4.0. So the visible opening is **2× the walkable one and 0.25 m off-centre** — aim at the left half and you hit an invisible wall. The grotto **east** (Fire) door spans world z 21.0–23.0 (2.0 m, centre 22.0); the rendered gap is centred on `cz(exitRamp)` = 20.5 → 19.0–22.0. **Only 1.0 m of the 2.0 m exit is visibly open, 1.0 m of the real door is behind rendered wall, and 2.0 m of the visible opening is solid.** Fix: derive both gaps from `doorXSpan`-style scans of the real door tiles (the function already exists in `drowned-gallery-terrain.ts:111`), export them on the layout, and size the gap to the door.
- `wall-segment-types.ts:115-121` | **BLOCKER (latent)** | Room size is `ceil(minInterior × ROOM_SCALE) + 2` with a global `ROOM_SCALE = 1.5` shared by every museum room and explicitly documented as a tunable ("1.0 = original, 2.0 = double"). `cave-water` authors `minInteriorWidth: 33, minInteriorHeight: 29` (`vulcan-cave-floor-plan.ts:221-222`) = 16.5 × 14.5 m of intent, and ships 25 × 22 m. Every fixture constant in `drowned-gallery-terrain.ts` is an absolute metre value (shore 3.5, pool insets 2/3, gate 0.6, overlook 3 × 1.5, exit ramp 2, surfacing 3, sump ramps 4/3, alcove z 1.6). If anyone tunes `ROOM_SCALE` for any other room, the grotto rescales and none of the fixtures follow — pool insets, shore depth and gate all end up in different relative positions. Nothing in the code or docs records this dependency.
- `vulcan-cave-floor-plan.ts:232-256` + `museum-grid-builder.ts:270-276` | **major** | The alcoves are placed by **two independent systems**, breaking the file's own "everything derives from `buildDrownedGalleryLayout`" contract. The graybox shelves, niche lights and glyph discs use `grotto.minX + gw × {0.22, 0.5, 0.78}` = x 7.0 / 14.0 / 21.0, z 3.1. The performers use center-relative offsets quantised to tiles: `centerX + floor(offsetX × interiorW)` → x **6.5** / 14.0 / 21.0, z **3.0**. Performer A therefore stands 0.5 m left of its own shelf centre, glyph disc and niche light — **visible in the causeway and overlook frames** as a figure offset from its disc. Fix: have the floor plan read the alcove anchors from the layout, or convert `alcoveXs` to the same tile-quantised expression.
- `drowned-gallery-terrain.ts:358-368` | **major** | The approach↔sump corridor elevation zone still uses the assumption `sump.minX − 1 … sump.maxX + 1` — the *exact* pattern that produced the shipped walking-on-water bug on the other corridor, which the playtest report fixed only for the sump↔grotto pair by introducing `doorXSpan`. It happens to work today because the approach and sump both land on x 13–15.5, but that alignment is an output of the layout engine, not a constraint. One layout change and the bug returns. The same rect is duplicated verbatim in `DrownedGalleryGraybox.svelte:199-204`.
- `museum-physics-provider.ts:232-235` | **major** | `teleport()` clamps y to `floorYAt(...) + STANDING_Y` but never consults `terrain.blockedAt`. The grotto interior is 2200 tiles and **all 2200 are walkable at the tile level** (verified in-page) — the pool and shore exist only as `blockedAt` rects. So any teleport into the pool (portal, void recovery, the editor, the sessionStorage restore path, a future bridge) puts the player standing at −0.3 + 1.6 on top of the water: the original bug, still reachable, just through a different door. Either make `teleport` reject/resolve blocked destinations or stamp the pool as non-walkable tiles.
- `DrownedGalleryGraybox.svelte:574-636` + `museum-room-light-pool.ts:18` | **major** | The graybox mounts **12 unconditional `T.PointLight`s** and bypasses the museum's own light budget entirely — `MAX_ROOM_LIGHTS = 16` with a 15 m proximity cull, which exists precisely to stop this. Those 12 lights are in the same scene as every other museum material, so every `MeshStandardMaterial` in the museum recompiles and shades against them from anywhere in the building, including the Egypt wing.
- `Museum3DScene.svelte:1662-1664` | **major** | The graybox mounts unconditionally on `hasDrownedGallery` with no `visible` prop and no room-streaming gate, unlike its sibling `VulcanCaveScenicLayer` (`:1654-1659`), which takes `currentRoomId` and `visible`. Static census: ~62 structural meshes + 8 water surfaces + 7 water volumes + 7 gate bars + 1 waterfall + 3 discs + 1 Points ≈ **89 always-resident meshes** plus the 12 lights, regardless of where the player is. (Credit where due: the component does zero per-frame work — no `useTask`, no reactive recompute.)
- `museum-geometry-builder.ts:607-610` + `vulcan-cave-floor-plan.ts:227` | **major** | `suppressTileGeometry` deliberately keeps "fixtures + the room light … so the authored shell keeps its ambience." The grotto declares `north: torchWall("center")`, which stamps exactly one torch tile at (27,2) → world (13.5, 1.0), at museum datum y ≈ 0. The graybox's north wall occupies z 0.9–1.5, so that torch and its light are **buried inside the rock directly behind performer B**, 0.3 m above the causeway datum the graybox has moved to −0.3. Either drop the torch wall from `cave-water` or let the graybox own it.
- `tests/unit/museum/drowned-gallery-traversal.test.ts:83-89, 237-268` | **major** | The harness builds its waypoints from the same `grid.tiles` + `terrain.blockedAt` it then asserts against, so it is structurally incapable of catching the *second* half of the bug this room already shipped twice: **visible floor ≠ walkable floor**. Nothing tests that `corridorSegments`, `surfacingSteps`, the causeway pieces or the wall door-gaps cover the walkable set — which is exactly why the two door-gap defects above are live with 204 green tests.
- `tests/unit/museum/drowned-gallery-traversal.test.ts:295-306` | **major** | The 0.6 m cliff assertion runs along **one greedy path**. A cliff 1 m off that path is invisible to it. A full sweep — for every walkable tile, compare `elevationAt` at the tile centre against its four neighbours — is a few thousand cheap calls and would have caught both of the historical zone defects without any pathfinding at all.
- `tests/unit/museum/drowned-gallery-traversal.test.ts:281-293` | **minor** | "is genuinely underwater in the sump's flat middle" asserts on `s.y` (the physics body at floor + 0.85), not on the value the submersion trigger actually uses (`position.y + 0.75`, `Museum3DScene.svelte:647`). The test can pass while the blue overlay never fires. Assert `s.y + 0.75 < terrain.waterlineY` instead, and add the inverse assertion for the corridor (must NOT be submerged).
- `drowned-gallery-terrain.ts:400-405` vs `DrownedGalleryGraybox.svelte:237-239` | **minor** | The file's header claims physics and visuals share one source of truth, but the corridor deliberately uses two different shapes: the elevation zone uses the **bbox** `corridorSG` (13 × 5 = 65 m²) while the floor renders the **carved segments** (~24 m²). That is defensible today (only walkable tiles query elevation) but it means 41 m² of rock is silently at −2.2, so any future walkable tile carved into that band inherits a wrong height with no test to notice. Say so at the zone, not just at the layout field.
- `drowned-gallery-terrain.ts:428` + `:22` | **minor** | `POOL_BOTTOM_Y = −5.0` is a **visual-only** constant. The terrain's "grotto everywhere else" catch-all returns `CAUSEWAY_Y = −0.3` inside the pool rect, so the pool has no floor in physics at all. Combined with the `teleport` hole above, the pool is a walking-on-water surface waiting for a caller that skips `blockedAt`.
- `vulcan-cave-floor-plan.ts:239,247,255` | **minor** | Performer `elevation: -1.0` is written as three literals that duplicate the exported `SHELF_Y = -1.0`. Change `SHELF_Y` and the three cavemen sink into or float above their shelves with nothing failing.
- `DrownedGalleryGraybox.svelte:199-219` | **minor** | Three geometry definitions are duplicated between the graybox and the terrain program rather than shared through the layout: `corridorAS` (`:199-204` vs terrain `:359-367`), the sump ramp lengths 4 and 3 (`:207-208` vs terrain `:369-394`), and `exitRamp` (`:214-219` vs terrain `:415-425`). Each is a future divergence of exactly the kind that has already bitten this room twice. Move them onto `DrownedGalleryLayout`.
- `drowned-gallery-terrain.ts:446` | **minor** | `elevationAt` falls through to `return 0` — the silent museum datum — for anything uncovered. That single line is the root of both historical bugs. In dev it should be loud (throw, or return a sentinel a test can assert on) rather than silently placing the player on a phantom floor.
- `drowned-gallery-terrain.ts:186-192` | **minor** | `buildDrownedGalleryLayout` returns `null` if any wing is missing, and `DrownedGalleryGraybox` renders nothing (`{#if layout}`), while `createDrownedGalleryTerrain` returns null → no terrain → `elevationAt` never runs → elevation 0 everywhere. The failure mode of a renamed wing id is "the whole water bay silently becomes a flat, invisible, walk-on-water room." Contrast the loud `throw` at `:242-246` for missing door tiles — be consistent and throw here too.
- `DrownedGalleryGraybox.svelte:177-186` | **minor** | `new BufferGeometry()` / `new PointsMaterial()` are constructed at component scope and never disposed on destroy. With HMR on this route (which the visual loop leans on heavily) that leaks a geometry + material per hot update.
- `DrownedGalleryGraybox.svelte:36,639` | **minor** | `layout` and `structural` are plain `const`s, not `$derived`. The component silently ignores a changed `grid` prop. Fine for today's mount-once usage, wrong as a Svelte 5 pattern and a trap for whoever wires room streaming.
- `DrownedGalleryGraybox.svelte:645` | **nit** | All ~62 structural meshes carry `castShadow receiveShadow`, but all 12 lights are `castShadow={false}`. The flags are dead weight and misleading about the intended lighting model.
- `vulcan-cave-floor-plan.ts:32-33` | **nit** | `CAVE_MODE_ROOMS` still declares `performerId: "cave-water-automaton"` / `sequenceId: "cave-water-seq"` for `cave-water`; neither resolves any more (the grotto has three performers, `cave-water-a/b/c`). Handoff loose end #5, still open.
- `museum-geometry-builder.ts:465-481` | **nit** | `suppressedSpans` is built from the bounding box of **every pair** of suppressed wings. With three suppressed wings the (approach, grotto) pair alone covers tiles x 2–54, y 2–113 — roughly 27 × 56 m, most of the cave. Any future room or corridor placed inside that box silently loses its tile floor. Coarse heuristic worth a comment or a tighter rule before a fourth suppressed room lands.
- `museum-physics-provider.ts:183-188` | **nit** | `movePlayer` clamps y only at the minimum — there is no maximum step-up. Any elevation discontinuity is climbable instantly, which means the elevation system silently *hides* geometry defects (you teleport up a cliff rather than being stopped by it). The 0.6 m test assertion is currently the only thing standing in for a step-height rule.
- submersion overlay, station (14.25, 34) | **nit** | The underwater blue overlay is composited over the **whole page**, not just the canvas: in the sump the "The Sump" room pill and the bottom control hints go washed-out and near-illegible. Scope the tint to the canvas layer.
- `drowned-gallery-terrain.ts:304-331` | **nit** | The sump water plane spans x 12–16.5, z 28.5–44, so 3.5 m of it (z 31.5–35) is rendered *inside* the sump ceiling slab, and its top face sits 0.1 m from the slab's — a candidate for z-fighting at grazing angles. Trim the plane to the un-roofed span or move the ceiling.
- `DrownedGalleryGraybox.svelte:142-157` | **nit** | `spansExcluding` sorts holes but never merges overlapping ones; overlapping holes would emit a negative-width span (currently saved by the `b - a > 0.01` filter). Harmless today, fragile if overlook rects ever touch.

### Visual direction

- `DrownedGalleryGraybox.svelte:623-635` | **major** | Both "underwater half-light through the sump" point lights are at **y = −1.2** — 0.3 m *above* the waterline (−1.5) and above the sump ceiling slab's top face (−1.6). They cannot light the submerged sump at all; what they actually do is put two hard specular highlights on the water surface, which is what you see as two floating white blobs from the approach. Move them to y ≈ −3.0 (between the floor at −4.1 and the ceiling at −1.9).
- `DrownedGalleryGraybox.svelte:722-732` | **minor** | The pictograph placeholders are 0.6 m emissive `#9fe8ff` circles at `emissiveIntensity 0.9` with no tone mapping headroom — at the gate station the disc is fully blown out and reads as a lamp, brighter than the performer standing in front of it. As a stand-in for painted mineral pigment on rock, it is inverted: cave art should be the darker, lit thing, not the light source.
- `DrownedGalleryGraybox.svelte:38-44` | **minor** | The palette is defensible and worth keeping into Phase 2: `ROCK #2b2620` / `FLOOR_WET #4a3d2d` / `STONE_WALK #7c6647` gives a real warm-rock vs cool-water split, and `FIRELIGHT #ffb35c` against `WATER #0d3a52` is the doubling concept's whole engine. The problem is not the hues, it is that only four surfaces in the room ever receive enough light to show them.
- `DrownedGalleryGraybox.svelte:667-675` | **minor** | Water is `MeshStandardMaterial` with `emissive` at 0.85 and `opacity 0.55`, `roughness 0.15`. Emissive water is a reasonable graybox cheat (it keeps the pool readable in the dark) but it is also why the pool reads as a flat backlit sheet with a hard horizon and no depth: an emissive surface cannot darken with viewing angle, so there is no Fresnel, no falloff toward the far shore, and no sense that anything is *under* it. This is the single biggest thing the Phase-2 `WaterSurface` shader must take over.
- water volumes, `DrownedGalleryGraybox.svelte:680-691` | **nit** | The `BackSide`, `depthWrite: false`, opacity 0.3 volume boxes are a clean, cheap trick for the submerged tint and should survive into Phase 2 as the fallback when postprocessing is unavailable.
- what boxes cannot deliver (for the Phase-2 shell) | **note** | Four things, in priority order: (1) a **ceiling with silhouette** — the flat 9.5 m slab is why the room reads as roofless; a domed/irregular Blender shell with the glowworm field mapped to its actual curvature is the whole "monumental grotto" claim. (2) **A waterfall that reads as water** — motion, mist, a plunge basin; the emissive box currently reads as architecture. (3) **Alcove niches with depth** — recessed, edge-lit rock so the three figures sit *inside* something; boxes give you a ledge, not a niche. (4) **Wet-rock material response** — caustics on the walls above the waterline and a specular sheen on the causeway are what make the difference between "dark room" and "cave with water in it," and neither is expressible with `roughness: 1` boxes.

## Ranked aesthetic push

Impact-first, cost-adjusted. Every acceptance criterion is checkable from a named
station or a number.

**1. Fix both graybox door gaps to match the real doors.** (graybox-now, **S**)
Why: it is the same defect Austen reported twice, it is live, and it is the one
thing that makes a walkable space feel hostile. Acceptance: derive the wall gaps
from the real door tile spans (extend `doorXSpan` to return east/west spans, put
both on `DrownedGalleryLayout`). Grotto south gap must equal world x 2.0–3.5
(±0.05 m). Grotto east gap must equal world z 21.0–23.0 (±0.05 m). Add a test:
for every door tile of every water-bay wing, the graybox's wall spans must
contain no wall covering that tile's world extent.

**2. Light the half of the room you can turn around in.** (graybox-now, **S**)
Why: the frame at (10, 21, yaw 0) is 100% black; that alone fails an eye-level
gate. Acceptance: add at least two warm point lights on the south causeway — one
at (8, 1.2, 21.5) and one at (19, 1.2, 21.5), intensity ≥ 2.0, distance ≥ 18 —
and at station **(10, 21, yaw 0)** the south wall, the causeway floor and the
grotto's south doorway must all be visible, with the frame's mean luminance
≥ 12% of the causeway-north frame's.

**3. Move the sump lights below the waterline and roof the passage.**
(graybox-now, **S**) Why: two lights are currently doing the opposite of their
name, and 32.5 of 46 m of "cave" has no ceiling. Acceptance: `sump-light-south`
and `sump-light-north` at y = −3.0 (between floor −4.1 and ceiling −1.9). Add
ceiling slabs over the approach (top y = 2.4), the approach↔sump link, the sump
ramps (extend `sump-ceiling` to the full sump rect), the sump↔grotto corridor
segments (top y = −0.4, i.e. 0.2 m of headroom over a 1.60 m eye at floor −2.2 →
raise to y = 0.2 for 1.8 m clear), and the surfacing steps. At station
**(14.25, 34)** the frame must show a lit rock ceiling occupying the top third,
and at **(12, 25.75, yaw −π/2)** the corridor must read as an enclosed tube on
all four sides.

**4. Re-aim the reveal so the alcove procession is the subject.** (graybox-now,
**M**) Why: the money shot currently frames a white box and clips performer C.
Two options, pick one and measure it. (a) Move the grotto's south door to the
room's centre-south (change the wall `alignment` from `"start"` to `"center"` so
the door lands at x ≈ 13–14.5) and let the surfacing steps follow it; or (b)
keep the SW arrival and turn the top of the steps to face north-east. Acceptance
at station **(top of steps, yaw toward alcove B)**: all three glyph discs are
fully inside the frame with ≥ 8% horizontal margin from each edge; alcove B's
disc centre is within 10% of frame centre-x; the waterfall occupies < 15% of
frame width.

**5. Make the submersion last.** (graybox-now, **M**) Why: 2.2 s is not an
experience; it is a transition. Acceptance: with eye = floor + 1.60 and waterline
−1.5, the contiguous span where `elevationAt < −3.10` along the walked centre
line must be **≥ 14 m** (≈4.7 s at 3 m/s). Cheapest route: raise
`minInteriorHeight` on `cave-water-sump` from 14 to 20 tiles (→ 10.5 m → 15 m of
sump at ROOM_SCALE 1.5) and keep the 4 m / 3 m ramps, which yields ≈11 m flat +
≈4 m of sub-threshold ramp. Assert it in the traversal test.

**6. Deepen the corridor so it is a wade, not a puddle.** (graybox-now, **S**)
Why: 0.7 m of water under a head 0.9 m clear of it does not sell "you came
through the water." Acceptance: drop `CORRIDOR_SURFACING_Y` from −2.2 to −2.9 →
water depth 1.4 m, eye 0.20 m above the surface at (12, 25.75). Verify the
surfacing-steps ramp is re-derived from the new datum (item 7), and that the
sump north ramp (`from: CORRIDOR_SURFACING_Y`) still lands smoothly — the 0.6 m
cliff test must stay green.

**7. Soften and widen the surfacing steps.** (graybox-now, **S**) Why: 32.3° is
the gradient already rejected as "a chute," delivered on the room's best beat, in
a 2.0 m slot. Acceptance: rise/run ≤ 0.36 (≤ 20°) — with `CAUSEWAY_Y = −0.3` and
a −2.9 corridor floor that is a **7.5 m** run — and width ≥ 3.0 m
(`grottoSouthDoor ± 0.75 m` instead of `± TILE`). Both the terrain zone and the
graybox ramp derive from one layout field.

**8. Give the dome a surface and get it into the frame.** (graybox-now for the
read, Phase-2 shell for the form, **M**) Why: ~10 m of authored vertical appears
in zero eye-level frames and the room reads as roofless. Acceptance
(graybox-now): raise the `dome-fill` light to y = 8.5 with intensity ≥ 4 and
distance 40, and add a second at (7, 8.0, 8) — at station **(14, 18.4, yaw π)**
the ceiling plane must be visibly distinguishable from the background (≥ 20
luminance levels above black) across the top 15% of the frame. Acceptance
(Phase-2): the authored shell's ceiling is a curved vault whose apex is over the
pool centre (14, 12), not a plane, and at the reveal station its silhouette
occupies the top third of the frame.

**9. Re-key the glowworms to read as a dome, not a starfield.** (graybox-now,
**S**) Why: uniform 0.45 points/m² over a black plane is a night sky.
Acceptance: cluster density by radial distance from the pool centre (14, 12) —
≥ 3× the point density inside a 7 m radius than outside 12 m — raise the count to
≥ 900, and vary point size 0.04–0.12. Seed the RNG with a fixed constant so
frames are reproducible across mounts. At **(14, 18.4)** the field must read as a
concentrated mass above the pool, with a visible falloff toward the walls.

**10. Alcove placement: one source of truth, and give the niches depth.**
(graybox-now, **S**) Why: performer A is visibly 0.5 m off its own disc and
light, and the niches do not read at 15 m. Acceptance: performer world x must
equal the layout's `alcoves[i].x` to within **0.05 m** for all three (assert it
in a unit test), and performer z must equal `alcoves[i].z`. Add a second light
per alcove *behind* the figure — at `(a.x, SHELF_Y + 2.6, shore.minZ + 0.35)`,
intensity ≥ 2 — so the rock fins cast a visible edge; at **(14, 18.4)** each of
the three niches must show a distinguishable back wall and at least one lit fin
edge between adjacent alcoves.

**11. Cut the waterfall down to size.** (graybox-now, **S**; Phase-2 replaces it)
Why: an 11 m emissive white box currently wins the composition against the
subject. Acceptance: reduce `emissiveIntensity` from 0.6 to 0.2 and opacity from
0.8 to 0.5, and split the column so the top 6 m is dimmer than the bottom 5 m by
a factor ≥ 2 (a plunge-lit read). At **(14, 21, yaw π)** the waterfall's peak
pixel luminance must be **below** each performer's glyph disc's.

**12. Give the gate the weight of a barrier.** (graybox-now, **S**) Why: 0.42 m
gaps and a 1.3 m top rail read as garden fencing. Acceptance: ≥ 10 bars over the
3.0 m span (clear gaps ≤ 0.20 m), bar height 2.4 m from `CAUSEWAY_Y` (top at
2.1 m — above a 1.60 m eye), plus a lintel and two jamb posts full-height. At
**(25, 7.6, yaw −2.415)** the bars must visibly cross the whole frame height that
contains alcove C.

**13. Rail the whole pool edge, or none of it.** (graybox-now, **S**) Why: 11 m
of rail on the south edge and none on 29.5 m of west + east ledge reads as
unfinished. Acceptance: balustrade runs the full walkable pool perimeter
(south 20 m, west 15.5 m, east 14 m) minus the three overlook mouths; total rail
length ≥ 40 m. Verify at **(2.75, 20, yaw π)** that the west ledge has a visible
edge for its full length.

**14. Reclaim the dead shore, or shrink it.** (graybox-now, **M**) Why: 87.5 m²
of blocked north shore holds 36 m² of shelves and 51.5 m² of nothing; the pool is
51% of the room. Acceptance: either narrow `shore` from 3.5 m to 2.2 m and push
`pool.minZ` north accordingly (raising pool:room to ~55% and shortening the
overlook→performer sightline from 15.15 m to ~13.9 m), **or** fill the gaps
between alcoves with rock mass so the shore reads as a wall with three cut
niches. Acceptance either way: at **(14, 18.4)** no more than 25% of the horizon
band between z = 1.5 and z = 5.0 is empty flat ledge.

**15. Break the 46 m of darkness with three timed events.** (graybox-now, **M**)
Why: 15 s of featureless tube is the pacing risk, and the fix does not need art.
Acceptance: place one visible light target roughly every 12 m along the route —
(a) a cool glow at the approach's waterline (already exists, keep), (b) a warm
sconce mid-sump at the flat's centre, visible from ≥ 8 m before it, (c) a glow at
the corridor's west elbow (x ≈ 3, z ≈ 25.5) visible from the corridor's east end
12 m away. Test: from **(12, 25.75, yaw −π/2)** at least one non-black light
source must be in frame; the same at **(14.25, 34, yaw π)**.

**16. Sightline discipline: hold something back for the overlooks.**
(graybox-now, **M**) Why: everything is visible from the first causeway step, so
the walk to the overlooks and the gate buys nothing. Acceptance: add rock mass
that occludes at least one alcove from the reveal station — e.g. a 3 m-wide,
4 m-tall pillar at (10.5, 12) rising from the pool — such that at **(2.75, 20,
yaw π)** exactly two of the three glyph discs are visible, and all three become
visible only from x ≥ 12 on the causeway.

**17. Test the coupling, not just the walk.** (graybox-now, **M**) Why: 204 green
tests coexist with two live door-gap defects, because nothing compares what is
rendered against what is walkable. Acceptance, three new tests: (a) full-grid
elevation sweep — for every walkable tile in the water bay, `|elevationAt(tile) −
elevationAt(neighbour)| ≤ 0.6` for all four neighbours; (b) floor coverage —
every walkable tile's centre lies inside at least one graybox floor/ramp rect;
(c) door coverage — no graybox wall rect overlaps the world extent of any door
tile, and every door's full width is inside a gap. All three must fail against
today's `main` and pass after items 1 and 7.

**18. Retire the duplicated constants and the silent datum.** (graybox-now, **S**)
Why: three geometry definitions live in two files and `elevationAt` fails by
silently returning 0. Acceptance: `corridorAS`, the sump ramp lengths, `exitRamp`
and the door gaps all live on `DrownedGalleryLayout` and are consumed by both the
terrain program and the graybox — `grep -c "sump.minX - 1" DrownedGalleryGraybox.svelte`
returns 0. `elevationAt` throws in dev when no zone matches inside the water
bay's bounding box, and a test asserts that.

**19. Route the graybox through the museum's light budget and streaming.**
(graybox-now, **M**) Why: 12 raw lights + 89 always-resident meshes bypass
`MAX_ROOM_LIGHTS = 16` / the 15 m proximity cull and the room-streaming gate that
the sibling scenic layer already honours. Acceptance: the graybox accepts
`currentRoomId` and `visible` like `VulcanCaveScenicLayer`, and its point-light
contribution is ≤ 6 simultaneous lights at any player position (nearest-first,
matching `recomputeNearbyRoomLights`).

**20. Record the `ROOM_SCALE` dependency before it bites.** (graybox-now, **S**)
Why: the grotto's 25 × 22 m is `33 × 29 tiles × 1.5`, and none of the metre
constants in `drowned-gallery-terrain.ts` scale with it. Acceptance: either
express the fixture constants as fractions of `grotto` extents (as `alcoveXs`
already is), or add a test asserting `grotto.maxX − grotto.minX === 25 &&
grotto.maxZ − grotto.minZ === 22` so a `ROOM_SCALE` change fails loudly instead
of quietly rescaling the Water room.

**21. Tone the pictograph placeholders down.** (graybox-now, **S**; Phase-3
replaces them) Why: a blown-out white disc is brighter than the performer in
front of it and inverts what cave art is. Acceptance: `emissiveIntensity` ≤ 0.25
and colour shifted warm (mineral ochre, e.g. `#c8884a`); at **(25, 7.6)** the
performer's lit surface must be brighter than the disc.

**22. Scope the underwater overlay to the canvas.** (graybox-now, **S**) Why: in
the sump the room-name pill and the control hints are washed out and near
illegible. Acceptance: at **(14.25, 34)** the HUD text renders at the same
contrast as at (14, 21).

**23. Housekeeping.** (graybox-now, **S**) Dispose the glowworm geometry +
material on destroy; drop `castShadow receiveShadow` from the structural meshes
while every light is `castShadow={false}`; clear the stale
`performerId`/`sequenceId` on the `cave-water` entry of `CAVE_MODE_ROOMS`; make
`layout`/`structural` `$derived`; trim the sump water plane out of the roofed
span. Acceptance: `npm run check` stays 0/0 and `npx vitest run
tests/unit/museum/` stays green.

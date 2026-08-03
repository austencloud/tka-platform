---
status: active
value: 3
effort: S
remaining: 'Cold-review data gathered; synthesize with the Opus report into the aesthetic-push plan.'
depends_on: 'docs/superpowers/specs/backlog/2026-08-02-vulcan-cave-water-room-drowned-gallery-design.md'
tags: [museum, review, drowned-gallery]
last_triaged: 2026-08-02
---
# Drowned Gallery Cold Review — Codex (gpt-5.6-sol), 2026-08-02

Cold review per the shared brief (floor plan, implementation, visual
direction, measurable aesthetic push). Codex had no browser; spatial findings
are computed from geometry (viewing distances, subtended angles, ratios).

## Findings

src/lib/features/museum/data/drowned-gallery-terrain.ts:205 | MAJOR | The implemented pool is 20 × 14 m, not the design’s approximate 19 × 12 m. Its 280 m² footprint occupies 50.9% of the 25 × 22 m grotto and leaves only 4.5 m between the pool and south wall. This makes the room read primarily as basin, with limited dry foreground for the reveal composition.

top of steps reveal (2.75, 20, yaw π) | MAJOR | The alcoves are strongly asymmetric from the reveal: A/B/C are 17.43/20.30/24.87 m away. Assuming a 1.6 m figure, they subtend only 5.26°/4.51°/3.68° vertically; the 1.2 m pictograph discs subtend 3.94°/3.39°/2.76°. C is a landmark, not a legible teaching demonstration, until the visitor crosses much of the causeway.

causeway (10, 21) | MAJOR | All three figures remain distant at 18.15/18.34/21.01 m. Their estimated 4.36°–5.05° vertical size is adequate for silhouettes but too small for confidently comparing hand path and prop rotation, the room’s stated teaching objective.

overlook B (14, 18.4) | MINOR | B is still 15.3 m away and subtends about 6° at 1.6 m tall. The overlook improves symmetry, not instructional proximity. The current 1.5 m projection into the pool saves only about 1.5 m versus the south causeway.

gate view (25, 7.6, yaw −2.415) | MINOR | The gate provides the only genuinely close reading: C is 6.02 m away and subtends about 15.1°, while B and A remain 11.88 m and 18.55 m away. This supports a strong C payoff but leaves A and B without equivalent close views.

src/lib/features/museum/data/drowned-gallery-terrain.ts:215 | MAJOR | Alcoves are distributed at x = 7, 14, and 21 across a 25 m room, while the reveal arrives at x ≈ 2.75. Equal spacing on the room axis produces unequal visual weight from the actual arrival station; C is 43% farther away than A.

src/lib/features/museum/data/drowned-gallery-terrain.ts:198 | MINOR | The 3.5 m shore band is blocked across the full 25 m width. With only three 4 m shelves, approximately 13 m of the far shore has no programmed exhibit function beyond fins and rock backing. Phase 2 needs deliberate negative-space composition to keep this from becoming a long empty strip.

src/lib/features/museum/components/game/DrownedGalleryGraybox.svelte:457 | MAJOR | Alcove backs stop at y = 2.2 while the dome datum is y = 9.5, leaving 7.3 m of unarticulated north-wall height above the teaching layer. The authored shell must connect niches to the dome through ribs, fins, overhangs, or darkness; a vertical wall with three boxes will strand the performers along its bottom edge.

src/lib/features/museum/data/drowned-gallery-terrain.ts:193 | MINOR | The approach is 12 m long and descends only 1.5 m, a 7.1° grade, before the separate 4 m, 33° sump ramp. The pacing is useful, but the abrupt change from gentle gallery ramp to steep chute concentrates almost all bodily drama into four meters.

src/lib/features/museum/data/drowned-gallery-terrain.ts:369 | MINOR | The 10.5 m sump contains 4 m of descent, 3.5 m of flat floor, and 3 m of ascent. Only one-third is a sustained low passage. At ordinary walking speed the claustrophobic plateau lasts roughly three seconds, so sound, ceiling variation, or resistance must carry the intended ten-meter ordeal.

src/lib/features/museum/data/drowned-gallery-terrain.ts:18 | MINOR | The sump provides 2.2 m from floor to ceiling. With an estimated 1.6 m eye height, the eye is about 0.6 m below the ceiling and 1.0 m below the waterline. This is convincingly submerged but not physically constricted; the Phase 2 shell must create lateral and overhead irregularity without reducing collision clearance below the player envelope.

corridor run (12, 25.75, yaw −π/2) | MAJOR | The Z corridor has a roughly 11 m transverse leg only 1.5 m thick. That is strong compression, but its floor is at −2.2 m, putting the eye near −0.6 m, approximately 0.9 m above the waterline. The route changes from diving to wading before the reveal and risks spending the final approach with the water plane cutting across the player’s torso.

src/lib/features/museum/components/game/DrownedGalleryGraybox.svelte:419 | MINOR | Corridor walls rise to y = 2.8 but no corridor ceiling is rendered. From an eye near y = −0.6, the enclosure is over 3 m above eye level and may leak the glowworm dome or grotto light before the surfacing frame. Phase 2 needs a low, occluding roof through the final westward run and turn.

src/lib/features/museum/data/drowned-gallery-terrain.ts:256 | MINOR | The surfacing ramp rises 1.9 m over 3 m, about 32.3°. Its 2 m width is workable but visually reads as a steep utility ramp, not authored cave steps. This is the reveal frame and deserves explicit landings and a controlled eye-height crest.

src/lib/features/museum/data/drowned-gallery-terrain.ts:415 | MINOR | The exit gains only 0.3 m over 2 m, an 8.5° grade, inside a 6 m-long reserved rectangle. The leg is spatially generous relative to its elevation task and may feel like residual circulation unless the Fire threshold becomes visible early enough to pull the visitor east.

src/lib/features/museum/data/drowned-gallery-terrain.ts:222 | MINOR | The gate blocks a 3 m-wide east leg with a strip only 0.6 m deep. It functions in plan, but the thin threshold lacks a vestibule or compression zone and may read as a railing dropped across a walkway rather than a consequential museum boundary.

src/lib/features/museum/components/game/DrownedGalleryGraybox.svelte:523 | MAJOR | The waterfall is a 1.6 × 11 m luminous rectangle at the pool’s northwest corner, less than one performer-bay wide. At reveal distance it competes as a bright vertical stripe rather than balancing the three-alcove procession. The Phase 2 waterfall needs a source crack, plunge basin, mist footprint, and asymmetrical rock mass.

src/lib/features/museum/components/game/DrownedGalleryGraybox.svelte:426 | MAJOR | The “dome” is a flat 25 × 22 m slab at y = 9.8. It proves clearance but cannot test the intended vertical composition, compression-to-release silhouette, or reflected ceiling. The graybox currently validates room height, not dome shape.

src/lib/features/museum/components/game/DrownedGalleryGraybox.svelte:560 | MINOR | All 250 glowworms occupy only the top 1.4 m beneath a flat ceiling. Their random distribution has no seed, density gradient, dark gaps, or relationship to the pool and reveal axis, so the ceiling reads as an even particle layer rather than a natural field.

src/lib/features/museum/components/game/DrownedGalleryGraybox.svelte:574 | MINOR | Twelve unshadowed point lights provide broad overlapping coverage: three alcove lights, a waterfall key, and eight fills. This is inexpensive enough for graybox use, but the 30–34 m pool and dome fills flatten depth and undermine the planned darkness hierarchy.

src/lib/features/museum/components/game/DrownedGalleryGraybox.svelte:38 | MINOR | The palette has a coherent cold-water/warm-fire split, and the restrained rock, blue water, amber alcove, and gold gate assignments should survive into Phase 2. The strongest existing visual decision is the warm alcove light mirrored across a cold pool.

src/lib/features/museum/components/game/DrownedGalleryGraybox.svelte:651 | MAJOR | Water is represented simultaneously by emissive translucent planes and back-face box volumes. The 0.85 emissive intensity makes the surface a light source, while 0.55 surface opacity plus 0.30 volume opacity can wash out the black-mirror value needed for firelight doubling.

src/lib/features/museum/data/drowned-gallery-terrain.ts:304 | MAJOR | The approach/sump water plane spans x = 12–16.5, 4.5 m wide, over a 2.5 m interior passage. It extends a meter into nominal rock on both sides. The matching water volume is narrower and begins at the sump, so surface and underwater boundaries disagree around the approach and connector.

src/lib/features/museum/components/game/DrownedGalleryGraybox.svelte:436 | MAJOR | The sump water volume covers only x = 13–15.5 and z = 28.5–44. It omits the flooded approach ramp, the widened approach-to-sump surface margins, and the surfacing-step water. The separate global submersion effect may hide this in first person, but the geometry is not a closed or consistent body of water.

src/lib/features/museum/components/game/DrownedGalleryGraybox.svelte:321 | MINOR | The pool basin is a rectangular 20 × 14 m box with four vertical sides and a flat bottom. Phase 2 must replace it with an irregular bathymetric bowl, undercut shoreline, shallow reflective shelf, and localized plunge depth; texture alone cannot remove the artificial tank silhouette.

src/lib/features/museum/components/game/DrownedGalleryGraybox.svelte:639 | MINOR | Structural geometry creates a separate mesh and material instance for every slab, wall run, shelf, fin, and balustrade segment. Corridor decomposition alone adds 21 floor/wall meshes. This is acceptable for a temporary graybox but should not survive into the authored shell.

src/lib/features/museum/components/game/DrownedGalleryGraybox.svelte:36 | NIT | Layout derivation happens once during component initialization and performs no per-frame geometry work. The static posture is appropriate for the graybox.

src/lib/features/museum/components/game/DrownedGalleryGraybox.svelte:562 | MINOR | `Math.random()` makes glowworm positions change on every component construction or hot reload. That prevents stable camera comparisons and can create server/client divergence if this component is ever rendered across hydration.

src/lib/features/museum/data/drowned-gallery-terrain.ts:352 | MAJOR | Elevations use ordered, first-match rectangles with a silent datum fallback of 0. Any future uncovered corridor tile becomes dry floor without an error, recreating the original “walking on water” failure. The API has no invariant that every walkable water-bay tile is covered exactly once.

src/lib/features/museum/data/drowned-gallery-terrain.ts:247 | MINOR | `corridorSG` deliberately uses a 13 × 5 m bounding box for elevation while visuals use the carved Z segments. This keeps current walkable tiles correct, but a future walkable tile introduced anywhere inside that box would inherit −2.2 m even if it belonged to another feature.

src/lib/features/museum/data/drowned-gallery-terrain.ts:274 | MINOR | Corridor visuals correctly derive from the compiled grid’s real `corridor` and `door` tiles. This is the implementation’s strongest coupling decision and directly prevents the prior invisible-wall mismatch.

src/lib/features/museum/components/game/DrownedGalleryGraybox.svelte:50 | MAJOR | `DOOR_GAP` is hardcoded to 3 m. The grotto south door is approximately 1.5 m wide and the east door approximately 2 m wide, so the visible shell leaves holes 1–1.5 m wider than the compiled doors and collision path.

src/lib/features/museum/components/game/DrownedGalleryGraybox.svelte:335 | MAJOR | The east wall opening is inferred from the exit ramp center rather than scanned from the compiled east-door tiles. Moving or realigning the door in the layout engine can separate the visible opening, ramp, and walkable doorway without failing a test.

src/lib/features/museum/components/game/DrownedGalleryGraybox.svelte:199 | MINOR | The approach-to-sump connector is reconstructed from sump bounds rather than exposed by `buildDrownedGalleryLayout`. The stated “all visuals derive from layout” contract is therefore incomplete, and this remaining duplicate assumption can drift.

src/lib/features/museum/data/vulcan-cave-floor-plan.ts:26 | MINOR | `CAVE_MODE_ROOMS` still advertises one obsolete Water performer and sequence even though the grotto now contains A, B, and C. Downstream floor-plan or HUD logic can report a false single-performer state.

src/lib/features/museum/data/vulcan-cave-floor-plan.ts:598 | MINOR | The file retains a separate tile-center convention for the 2D floor plan, while terrain and physics use tile index × 0.5. The traversal report already encountered this footgun; the two coordinate types are not encoded distinctly.

tests/unit/museum/drowned-gallery-traversal.test.ts:217 | MINOR | The claimed spawn-to-Fire test begins at the squeeze’s north door, skipping the real spawn, the squeeze, and the squeeze-to-approach connector. It proves the water route, not the route named in the test.

tests/unit/museum/drowned-gallery-traversal.test.ts:281 | MINOR | Underwater coverage checks only the sump’s flat middle. It does not assert waterline crossing, camera-eye submersion, the approach ramp, either connector, surfacing behavior, or the corridor’s intended wading depth.

tests/unit/museum/drowned-gallery-traversal.test.ts:295 | MINOR | The 0.6 m successive-elevation threshold catches cliffs but permits a vertical discontinuity comparable to a large stair riser. It also samples only one generated route, so other legal approaches to ramp edges can remain untested.

tests/unit/museum/drowned-gallery-traversal.test.ts:313 | MINOR | The pool test proves the provider does not enter a blocked point while walking from one probe toward center. It does not sweep the full shoreline, overlook edges, gate ends, or collision-radius corner cases for leaks.

tests/unit/museum/drowned-gallery-traversal.test.ts:332 | MINOR | Overlook tests prove tile connectivity only. They do not verify clear sightlines, angular size, balustrade occlusion, performer orientation, or that each overlook visually favors its assigned letter.

tests/unit/museum/drowned-gallery-traversal.test.ts:271 | NIT | The focused terrain and traversal suites pass: 2 files and 14 tests, including route connectivity, sump depth, elevation continuity, exit height, pool blocking, and overlook reachability.

src/lib/features/museum/services/museum-physics-provider.ts:183 | MINOR | Rising terrain clamps the player immediately to the new floor, while descending terrain relies on incoming gravity to settle. Geometry continuity is therefore sensitive to controller step size and frame behavior, but the tests exercise only fixed 0.05 m steps with an artificial −0.2 m vertical input.

## Ranked aesthetic push

1. **Change:** Recompose the reveal around the arrival axis by moving A/B/C to approximately x = 6.5/12.5/18.5 and z = 4–4.5, with C no farther than x = 19. **Why:** The current x = 7/14/21 procession makes C 24.87 m away and 43% farther than A from the reveal. **Acceptance criterion:** At top of steps reveal (2.75, 20, yaw π), all three 1.6 m performers must subtend at least 4.5° vertically; nearest-to-farthest viewing-distance ratio must be ≤1.25; all three alcoves and the waterfall must remain visible in one 75° horizontal frame. **Cost:** M. **Phase:** graybox-now.

2. **Change:** Replace the flat ceiling proxy with a faceted dome blockout before approving the spatial gate. **Why:** A flat slab cannot validate the room’s main release gesture or the glowworm composition. **Acceptance criterion:** Dome spring line at y = 4.5 ± 0.5 m, apex at y = 11.5–12 m, at least five faceted cross-sections, and the glowworm field occupies 25%–35% of the upper frame at top of steps reveal while no ceiling is visible from corridor run (12, 25.75, yaw −π/2). **Cost:** S. **Phase:** graybox-now.

3. **Change:** Pull the pool’s south edge north from z = 19 to z = 17.5 while preserving the north edge near z = 5; shape the three overlooks as 2.5–3 m projections. **Why:** The current pool consumes 51% of the room and leaves a shallow foreground apron without making the demonstrations close enough. **Acceptance criterion:** Pool footprint ≤250 m² and 42%–46% of grotto area; south apron depth ≥6 m; each overlook reduces its assigned performer distance by at least 2.5 m relative to the main causeway; all pool edges remain blocked in a perimeter test at 0.25 m intervals. **Cost:** M. **Phase:** graybox-now.

4. **Change:** Add a low authored roof to the entire sump-to-grotto corridor and conceal the dome until the surfacing crest. **Why:** The corridor currently has tall open walls and no ceiling, risking premature light and glowworm leakage. **Acceptance criterion:** Corridor clear ceiling height varies between 2.0 and 2.4 m; at corridor run (12, 25.75, yaw −π/2), zero glowworms, alcove lights, waterfall, or gold gate are visible; the first frame containing all three alcoves occurs only after eye elevation rises above −0.8 m on the surfacing ramp. **Cost:** M. **Phase:** graybox-now.

5. **Change:** Turn the surfacing ramp into a staged reveal stair with a short crest landing. **Why:** A continuous 32.3° plane makes the most important camera transition feel infrastructural. **Acceptance criterion:** Use 9–11 risers at 0.17–0.21 m each, tread depth 0.28–0.36 m, clear width ≥1.8 m, and a level landing at least 1.5 m deep at CAUSEWAY_Y; from the final submerged tread, no performer feet are visible, while all three full figures are visible from the landing center. **Cost:** S. **Phase:** graybox-now.

6. **Change:** Author the pool as a black-mirror composition rather than a uniformly emissive surface. **Why:** The firelight-doubling idea is the room’s strongest current visual choice, but emissive water and broad blue fills reduce contrast. **Acceptance criterion:** At causeway (10, 21), each alcove produces one distinct warm reflection streak separated by at least 5% of frame width; reflected warm luminance is 20%–40% of the source niche; the unlit central pool remains at least 2 stops darker than the waterfall; no blue emissive term is used on the final surface material. **Cost:** L. **Phase:** Phase-2 shell.

7. **Change:** Build an irregular basin and shoreline into the authored GLB. **Why:** The present flat-bottomed rectangular tank will remain artificial under any texture or shader. **Acceptance criterion:** Shoreline deviates at least 0.75 m from a rectangle at six or more locations; include a 0.3–0.8 m shallow shelf around at least 40% of the perimeter, one plunge zone reaching −5 m beneath the waterfall, and no straight basin edge longer than 4 m. Collision must preserve all three overlooks and the unreachable far shore. **Cost:** L. **Phase:** Phase-2 shell.

8. **Change:** Give the waterfall a rock source, offset plunge basin, and mist mass that counterbalances the alcoves. **Why:** The current 1.6 m luminous column reads as a marker rather than a geological event. **Acceptance criterion:** Source crack width 1.2–2 m at y ≥9 m; visible fall height ≥9.5 m; plunge disturbance diameter 3–4 m; mist footprint 4–6 m wide; waterfall occupies 8%–15% of the reveal frame and does not overlap performer A’s silhouette from top of steps reveal. **Cost:** L. **Phase:** Phase-2 shell.

9. **Change:** Integrate the three alcoves into a continuous sculpted far-wall rhythm. **Why:** Three low box niches beneath 7.3 m of blank wall will strand the teaching content. **Acceptance criterion:** Each niche clear opening 3.5–4.5 m wide and 3–4 m high; two separating fins project 2–3 m toward the pool and rise to at least y = 5; no station sees two performers against the same uninterrupted back-wall plane; at overlook B, B is fully visible while at least 25% of A and C’s lit backdrops are occluded by fins. **Cost:** L. **Phase:** Phase-2 shell.

10. **Change:** Replace uniform glowworms with a seeded, composed field tied to dome curvature. **Why:** Stable clustering and negative space are necessary for repeatable framing and a natural ceiling hierarchy. **Acceptance criterion:** Fixed seed; 600–1,000 points; 60%–75% grouped into 8–14 clusters; two dark gaps each spanning at least 12% of dome width; density peak above the pool’s middle third; identical point positions across reloads. **Cost:** M. **Phase:** Phase-2 shell.

11. **Change:** Establish a measured light hierarchy and remove broad flattening fills. **Why:** Twelve overlapping point lights make every surface available at once and weaken compression, depth, and reflected firelight. **Acceptance criterion:** No more than six direct light sources in the final grotto setup excluding glowworm particles; approach:sump:grotto average luminance ratio approximately 1:0.35:1.8; alcove key color temperature 1,800–2,200 K; waterfall key 6,500–8,000 K; the far wall between niches remains at least 1.5 stops below performer faces. **Cost:** M. **Phase:** Phase-2 shell.

12. **Change:** Make the gate a spatial endpoint rather than a thin barred strip. **Why:** Its current 0.6 m depth has little authority despite being the route’s close-view payoff. **Acceptance criterion:** Gate assembly depth 0.8–1.2 m, framed opening 2.2–2.8 m wide and 2.4–3 m high, approach compression lasting at least 2.5 m, and at gate view (25, 7.6, yaw −2.415) C occupies 12°–18° vertically with the full gate frame and part of its pool reflection visible. **Cost:** M. **Phase:** Phase-2 shell.

13. **Change:** Give the east exit a visible Fire-room pull and tighten unused ramp space. **Why:** A 6 m reserved zone for a 0.3 m rise risks becoming dead circulation after the gate payoff. **Acceptance criterion:** From causeway (10, 21), a warm Fire cue is visible within the rightmost 10%–20% of a 75° frame; exit ramp run is 2.5–4 m with slope ≤8°; from gate view, the Fire doorway is occluded so the gate remains the endpoint before the player turns south. **Cost:** S. **Phase:** graybox-now.

14. **Change:** Close the geometry contract by deriving every doorway, connector, water extent, and opening from compiled tiles. **Why:** Hardcoded 3 m gaps and reconstructed connector rectangles can reintroduce visual/collision drift when the layout engine moves a door. **Acceptance criterion:** Remove `DOOR_GAP`; expose approach-sump segments and all four relevant door spans from `buildDrownedGalleryLayout`; add tests asserting visible opening bounds match door-tile bounds within 0.25 m and every walkable water-bay tile has exactly one intended elevation classification. **Cost:** M. **Phase:** graybox-now.

15. **Change:** Expand automated coverage from one successful route to spatial invariants. **Why:** Current tests prove basic traversal but not the composition or the boundaries most likely to drift. **Acceptance criterion:** Add full spawn-to-Fire traversal; 0.25 m shoreline and gate sweeps; waterline-crossing assertions for approach, sump, corridor, and steps; maximum adjacent elevation discontinuity ≤0.22 m at 0.1 m samples; deterministic tests for all six named camera stations and their required visible/occluded landmarks. **Cost:** M. **Phase:** graybox-now.
---
status: active
value: 4
effort: M
remaining: 'Synthesis of the two cold reviews into a phased, measurable push. Wave 1 is executable now; Wave 2 has one design fork for Austen; Phase-2 shell requirements collected for the Blender pass.'
depends_on: 'docs/superpowers/specs/backlog/2026-08-02-vulcan-cave-water-room-drowned-gallery-design.md'
plan_path: ''
tags: [museum, drowned-gallery, plan, review-synthesis]
last_triaged: 2026-08-02
---
# Drowned Gallery — The Measurable Aesthetic Push (cold-review synthesis)

Two independent cold reviews of the Phase-1 graybox, same brief, different
capabilities:

- **Opus** (`2026-08-02-drowned-gallery-cold-review-opus.md`) — read the full
  implementation AND walked nine stations in the browser. 40 findings.
- **Codex** (`2026-08-02-drowned-gallery-cold-review-codex.md`) — no browser;
  computed viewing distances, subtended angles, and ratios from the geometry.
  44 findings.

Where they converge independently, confidence is high. This plan merges their
ranked lists into waves. Every item keeps a measurable acceptance criterion;
sources are tagged [O]pus / [C]odex / [O+C] both.

## What both reviews say is working — protect these

- **The pool's firelight doubling** — three warm streaks under the alcoves.
  Both reviews independently call it the room's strongest visual decision.
  Everything in this plan is subordinate to making it stronger. [O+C]
- **The corridor's 11 m westward jog** — kills the sightline leak into the
  grotto. Keep it deliberately. [O]
- **The palette** — warm rock / cool water / firelight vs `#0d3a52`. Hues
  survive into Phase 2; the problem is light, not color. [O+C]
- **The BackSide water-volume tint** and the zero-per-frame-work posture. [O]

## The verdict in one line

The space works mechanically but fails at eye level in specific, measurable
ways: the money shot doesn't contain the subject, half the room is unlit, the
"underwater" premise delivers 2.2 seconds of submersion in a 15-second dark
approach, and the teaching content subtends under 5° from everywhere a
visitor stands. None of this needs art yet — most of it is numbers.

## Wave 1 — cheap fixes that unblock the eye-level gate (all S, graybox-now)

1. **Door gaps derived from real door tiles.** [O+C, both top-severity]
   `DOOR_GAP = 3` renders a 3 m hole for the grotto's 1.5 m south door
   (0.25 m off-center), and the east/Fire gap overlaps the real 2 m door by
   only 1 m — half the exit is behind rendered wall. Same defect class
   Austen has reported twice. Accept: south gap = world x 2.0–3.5 ±0.05;
   east gap = world z 21.0–23.0 ±0.05; spans exported on
   `DrownedGalleryLayout`; test asserts no wall rect overlaps any door
   tile's extent.
2. **Light the south half of the room.** [O — blocker seen in-frame]
   Turning around on the causeway gives a 100% black frame. Accept: two warm
   points at ~(8, 1.2, 21.5) and (19, 1.2, 21.5); at station (10, 21, yaw 0)
   the south wall, causeway floor, and south doorway are all visible; mean
   luminance ≥12% of the north-facing frame.
3. **Sump lights below the waterline + roof the passages.** [O+C]
   Both "underwater" lights sit at y −1.2 — above the waterline AND above the
   sump ceiling; they light nothing they name. 32.5 of 46 m of the approach
   sequence has no ceiling; the dome/glowworms can leak into the corridor.
   Accept: sump lights at y ≈ −3.0; ceiling slabs over approach, link, sump
   ramps, corridor segments, and steps; at (12, 25.75, yaw −π/2) the corridor
   reads as a closed tube and ZERO glowworms/alcove light/waterfall/gate are
   in frame [C #4's occlusion criterion].
4. **Alcoves: one source of truth.** [O — visible in frame]
   Performer A stands 0.5 m off its own glyph disc because floor plan and
   graybox place alcoves with two independent formulas. Accept: performer
   world x/z equals `layout.alcoves[i]` within 0.05 m, unit-tested.
5. **Soften + widen the surfacing steps.** [O+C]
   The reveal is delivered by a 32.3°, 2 m-wide chute — the same gradient
   already rejected at the sump entry. Accept: slope ≤20° (with a deepened
   corridor that's a ~7.5 m run), width ≥3 m, plus a level crest landing
   ≥1.5 m deep at CAUSEWAY_Y [C #5's landing]; one layout field drives both
   terrain zone and graybox ramp.
6. **Deepen the corridor to a real wade.** [O+C]
   Floor −2.2 gives 0.7 m of water with the eye 0.9 m clear — a puddle, not
   "you came through the water." Accept: `CORRIDOR_SURFACING_Y` −2.2 → −2.9
   (1.4 m depth, eye 0.2 m above surface); cliff test stays green.
7. **De-throne the waterfall and the discs; re-key the glowworms.** [O+C]
   The 11 m emissive white box and the blown-out cyan discs out-shine the
   performers; 250 unseeded uniform points read as sparse night sky.
   Accept: waterfall peak luminance below every glyph disc at (14, 21, yaw π);
   disc `emissiveIntensity` ≤0.25, warm ochre; glowworms seeded (fixed
   constant), ≥900 points, ≥3× density within 7 m of pool center vs beyond
   12 m, reproducible across reloads.

## Wave 2 — spatial recomposition (M, graybox-now; contains THE design fork)

8. **Re-aim the reveal so A/B/C are the subject.** [O+C — the headline]
   Opus saw it: the money shot is 45% black wall + waterfall center + C
   clipped off-frame. Codex measured it: A/B/C at 17.4/20.3/24.9 m subtend
   5.3°/4.5°/3.7°; C is 43% farther than A.
   **Design fork — Austen picks one:**
   - (a) Move the grotto south door to center-south (wall `alignment`
     "start" → "center"); steps and arrival axis follow. Symmetric reveal.
   - (b) Keep the SW-corner arrival, redistribute the alcoves around the
     arrival axis (Codex: ~x 6.5/12.5/18.5, z 4–4.5) and angle the crest
     toward alcove B. Asymmetric but keeps the corner drama.
   Accept (either): all three glyph discs fully in frame with ≥8% margin at
   the crest station; every performer subtends ≥4.5° vertically; near:far
   distance ratio ≤1.25; waterfall <15% of frame width.
9. **Shrink the pool / commit the shore.** [O+C]
   Pool is 50.9% of the room; the blocked 3.5 m shore holds 36 m² of shelf
   and 51.5 m² of nothing. Accept: pool ≤46% of grotto with a ≥6 m south
   apron [C], and the shore either narrows to 2.2 m or fills with rock mass
   so it reads as a wall with three cut niches — at overlook B, ≤25% of the
   z 1.5–5.0 horizon band is empty ledge [O].
10. **Make the submersion last.** [O+C]
    Genuinely submerged travel is 6.6 m ≈ 2.2 s. Accept: contiguous
    eye-below-waterline span ≥14 m (raise sump `minInteriorHeight` 14 → 20
    tiles); asserted in the traversal test. Note: `SUMP_CEILING_Y` (−1.9) is
    below the waterline (−1.5) — fix so the surface is visible above you and
    surfacing can be foreshadowed [O].
11. **Progressive reveal + three timed light events.** [O+C]
    Everything is visible from the first causeway step, and the 46 m approach
    is featureless darkness. Accept: one occluding rock mass so exactly two
    of three discs are visible from the crest and all three only from
    x ≥ 12 [O #16]; one visible light target every ~12 m of the approach
    route (waterline glow → mid-sump sconce → corridor-elbow glow), at least
    one non-black light source in frame at every route station [O #15].
12. **Give the gate weight.** [O+C]
    0.42 m gaps, top rail below eye height. Accept: gaps ≤0.20 m, height
    2.4 m + lintel and jambs; at the gate station the bars cross the full
    frame height containing C; C subtends 12–18° there [C #12].
13. **Rail the whole pool edge or none.** [O] Accept: balustrade on the full
    walkable perimeter minus overlook mouths (≥40 m total).

## Wave 3 — engineering hardening (prevents the next regression)

14. **Test the coupling, not just the walk.** [O+C — both called out that 204
    green tests coexisted with live visible-vs-walkable defects]
    Three tests: full-grid elevation sweep (every walkable tile vs 4
    neighbours ≤0.6 m); floor coverage (every walkable tile center inside a
    rendered floor rect); door coverage (no wall over any door tile). All
    three must FAIL against today's main, pass after Wave 1. Plus: assert
    submersion with the trigger's own math (`y + 0.75 < waterlineY`), and the
    corridor's NOT-submerged inverse [O].
15. **Retire duplicated geometry + the silent datum.** [O+C]
    `corridorAS`, sump ramp lengths, `exitRamp`, door gaps all move onto
    `DrownedGalleryLayout`; `elevationAt` throws in dev when unmatched inside
    the water bay instead of silently returning 0 (root cause of both
    historical bugs); missing-wing case throws like the missing-door case.
16. **Close the physics holes.** [O] `teleport()` ignores `blockedAt` — any
    teleport into the pool stands on water (all 2200 grotto tiles are
    tile-walkable). Pool has no physics floor (`POOL_BOTTOM_Y` is visual
    only). Accept: teleport rejects/resolves blocked destinations, test
    included.
17. **Respect the museum's own budgets.** [O] 12 raw point lights bypass
    `MAX_ROOM_LIGHTS = 16`/proximity cull; ~89 meshes always resident with no
    streaming gate (sibling `VulcanCaveScenicLayer` honors both). Accept:
    graybox takes `currentRoomId`/`visible`; ≤6 simultaneous lights.
18. **Record the ROOM_SCALE dependency.** [O — latent blocker] Grotto ships
    25×22 m because of a global 1.5× tunable; every fixture constant is
    absolute meters. Accept: guard test on grotto extents (25×22) so a
    ROOM_SCALE change fails loudly.
19. **Housekeeping.** [O+C] Stale `CAVE_MODE_ROOMS` entry (handoff #5);
    glowworm geometry/material disposal; `$derived` for grid-dependent
    consts; scope the underwater tint to the canvas (HUD washes out);
    buried torch tile behind performer B; trim the sump water plane out of
    the roofed span; drop dead shadow flags.

## Phase-2 shell requirements (the Blender pass — collected, not started)

What boxes cannot deliver, per both reviews, with Codex's target numbers:
- **Dome with silhouette**: vault apex 11.5–12 m over the pool center, spring
  line ~4.5 m; glowworm field mapped to real curvature, occupying 25–35% of
  the upper reveal frame. A faceted BLOCKOUT of this belongs in graybox
  (cheap) so the spatial gate judges the actual gesture. [O+C]
- **Black-mirror water**: no emissive term on the final surface; Fresnel
  darkening; reflected warm streak luminance 20–40% of its source niche;
  unlit pool center ≥2 stops darker than the waterfall. [O+C]
- **A waterfall that is water**: source crack at ≥9 m, plunge basin,
  3–4 m disturbance, mist; 8–15% of the reveal frame, never overlapping
  performer A's silhouette. [O+C]
- **Niches with depth**: openings 3.5–4.5 m wide × 3–4 m high, fins
  projecting 2–3 m and rising to y ≥ 5, connecting the teaching layer to the
  dome (7.3 m of blank wall above the alcoves today). [O+C]
- **Irregular basin/shoreline**: ≥6 deviations ≥0.75 m from rectangular, a
  shallow shelf on ≥40% of perimeter, no straight edge >4 m; overlooks and
  the unreachable far shore preserved in collision. [C]
- **Wet-rock response**: caustics above the waterline, sheen on the causeway;
  a measured light hierarchy — ≤6 direct sources, approach:sump:grotto
  luminance ≈1:0.35:1.8, alcove keys 1800–2200 K vs waterfall key
  6500–8000 K, inter-niche wall ≥1.5 stops below performer faces. [O+C]

## Open questions for Austen (the plan's only blockers)

1. **The reveal fork (item 8)**: center-south door (symmetric procession) or
   SW arrival with redistributed alcoves (asymmetric, keeps the corner)?
2. **"Reach the other end"** (carried from the handoff): exit = done; far
   shore = needs a design decision before anyone opens the habitat.
3. Wave 2 items 9–11 change room dimensions and pacing — worth one eye-level
   walk of Wave 1 first, or straight into recomposition?

---
status: active
value: 4
effort: L
remaining: 'Design approved by Austen 2026-08-03 (from the plan sheet). Graybox v2 build dispatched to an Opus executor; eye-level gate after.'
depends_on: 'docs/superpowers/specs/backlog/2026-08-02-vulcan-cave-water-room-drowned-gallery-design.md'
plan_path: 'docs/superpowers/plans/2026-08-03-drowned-gallery-ring-graybox.md'
tags: [museum, drowned-gallery, design]
last_triaged: 2026-08-03
---
# The Drowned Gallery — The Ring (Flow Rethink v2)

Approved by Austen 2026-08-03 from the plan sheet
`static/sketches/2026-08-03-drowned-gallery-ring-plan.html`
([localhost view](https://localhost:5173/sketches/2026-08-03-drowned-gallery-ring-plan.html)).
Supersedes the ROUTE portions of the 2026-08-02 design (sump + corridor +
overlooks + gate leg). The grotto's composition concepts (doubling, alcoves,
palette) carry forward. Informed by the two cold reviews and their synthesis
(`2026-08-02-drowned-gallery-aesthetic-push-plan.md`).

## One paragraph

Under the water, out of the water, around the water. The middle of the route
becomes a real flooded world: ~30 m walked on the bottom of a rock-roofed
gallery whose ceiling (−1.9) sits BELOW the waterline (−1.5), so the surface
is never visible — no sign of air — with cave-native life thickening into a
bloom at the midpoint. A surfacing stair breaks the water at a mid-stair
landing: the first breath and the money shot are the same instant (black
mirror pool doubling three firelights, symmetric, center-south arrival). The
grotto is a ring: apron → west walkway (past the waterfall plunge) →
procession walkway between pool and channel, reading A, B, C at 5–6 m across
4 m of water → carved threshold → east to Fire. Zero dead-ends; "reach the
other end" is answered by circumnavigation.

## Decisions (Austen, 2026-08-03 brainstorm)

- Submersion is the sacred beat, made REAL: thoroughly submerged, fish and
  plants around you, clear direction forward, no air until the far side.
- Locomotion: **walk the bottom** (existing walker; no swim controller).
- World flavor: **cave-native underwater** — pale cave fish, dark plants,
  glow accents. No reef/coral/tropical (standing decision holds everywhere).
- Close reads: **procession along a channel** — walkway passes A→B→C at
  close range across ~4 m of water; performers stay unreachable.
- The gate close-view "did not translate" → reworked as a carved threshold on
  the exit leg. The overlook spurs are replaced by the procession.
- Route shape: **Approach A, "The Ring"** (center-south arrival, full loop).

Defaults chosen for the sheet's four open questions (revisit at the eye-level
walk, none is load-bearing): apron stays 4.5 m; the bloom is self-lit
bioluminescent plants (keeps "no sign of air" intact); channel 4 m; waterfall
stays graybox-simple, but the west walkway runs the full channel end so the
plunge gets a drive-by beat for free.

## Kept · Reworked · New

- **Kept:** firelight doubling on the dark pool; warm-rock/cool-water
  palette; pool-as-barrier; approach ramp + waterline glow; graybox-first
  gates; existing FishBoids/GLB catalog for real fauna (Phase 3).
- **Reworked:** sump + sump↔grotto corridor → one **flooded gallery** room;
  surfacing chute → 3 m-wide stair with a surface-break landing at −2.3;
  gate → carved threshold; waterfall → west end of the channel.
- **New:** center-south arrival axis; procession walkway; full ring
  circulation; cave-native life stand-ins with a seeded bloom.

## Geometry (world meters; north = decreasing z; derive from room bounds, not absolutes)

**Grotto** (existing wing, interior 25 × 22, x 1.5–26.5, z 1.5–23.5):

| Band | z | Notes |
|---|---|---|
| Alcove shore (blocked) | 1.5–5.0 | Rock mass with three cut niches; alcoves at x 7 / 14 / 21, z ≈ 3.1, shelf −1.0. ONE anchor source: the layout. |
| Channel (water, blocked) | 5.0–9.0 | x 4–23; waterfall at the west end (x 4–5.5). |
| Procession walkway | 9.0–11.5 | x 4–23, at −0.3; balustrade both sides. |
| Mirror pool (water, blocked) | 11.5–19.0 | x 4–23; visual bottom −5.0. |
| Arrival apron | 19.0–23.5 | Full width, −0.3. Composed view faces north. |

West walkway x 1.5–4.0, z 5.0–19.0 (passes the waterfall plunge). East
walkway x 23.0–26.5, z 9.0–23.5 with the carved threshold at z ≈ 16; Fire
door on the east wall (z 21–23, existing). Water ≈ 41% of the room.

**Flooded gallery** (new wing replacing the sump; interior ≈ 12 × 20.5 m,
between approach and grotto): door to the grotto is CENTERED, 6 tiles (3 m).
Inside, rock fill shapes an S-path (≈2.5–3 m wide): descent stair at the
south door (−1.5 → −4.5), west run, north run (the **bloom** at its
midpoint), east bend to the surfacing stair. Floor −4.5; rock roof −1.9 over
every wet tile (BELOW the waterline — deliberate; the old "sump ceiling below
waterline" defect becomes the design). Everything outside the path is
blocked and rendered as rock.

**Surfacing stair:** 3 m wide at the grotto door span; −4.5 → −0.3 over ~7 m
run (~23 risers visually; terrain = two ramp zones with a FLAT landing at
−2.3, z-depth ≥ 1.2 m). Eye (floor + 1.6) breaks the −1.5 waterline ON the
landing.

**Approach** (existing wing): unchanged ramp 0 → −1.5 with waterline glow.
The old sump wing is removed from the graph: squeeze → approach → gallery →
grotto → fire.

## Datums

Museum floor 0 · waterline −1.5 · gallery floor −4.5 · gallery roof −1.9 ·
landing −2.3 · causeway/apron/walkways −0.3 · shelf −1.0 · channel bed −2.7
(visual) · pool bottom −5.0 (visual) · dome 9.5 (unchanged this phase).

## Light plan (graybox austerity, but nothing 100% black)

Waterline glow at the approach bottom (keep) · cool glow cue at each gallery
bend · bloom self-glow · warm spill down the surfacing stair (visible through
water from the last bend — "the turn") · apron + south-half fill (the
100%-black-looking-back defect must not recur) · three alcove firelights
(the doubling engine) · cool waterfall accent. Seeded RNG everywhere;
component takes `currentRoomId`/`visible` for streaming.

## Engineering invariants (from the cold reviews — build them in, not on)

1. Every rendered door gap derives from real door tiles (doorXSpan family);
   no `DOOR_GAP` constant.
2. One geometry source: every rect/stair/anchor the graybox renders comes off
   `DrownedGalleryLayout`; performers read the SAME alcove anchors.
3. `elevationAt` throws in dev when unmatched inside the water bay (no silent
   datum-0); missing wings/doors throw.
4. Coupling tests: full-grid neighbor elevation sweep (≤0.6 m); every
   walkable water-bay tile centered inside a rendered floor rect; no wall
   over any door tile; performer anchor == layout anchor (±0.05).
5. Submersion asserted with the trigger's own math (`y + 0.75 < −1.5`):
   contiguous submerged span ≥ 24 m in the gallery; procession NOT submerged.
6. Ring test: apron → west → procession → east → apron walkable circuit;
   pool/channel/shore blocked at 0.25 m probe intervals along edges.

## Acceptance (eye-level gate, station list for the re-walk)

- Landing (14, ~z of landing, yaw π): first air = doubled firelight; all
  three glyph discs in frame with ≥8% margin; A/B/C distance ratio ≤ 1.10.
- Gallery mid-run: enclosed on all four sides; zero grotto light visible
  before the last bend; the bloom readable at ≥ 8 m.
- Procession at B (z 10.25): performer subtends ≥ 15°; balustrade continuous.
- Looking south from the procession: not black — apron, threshold, and south
  wall all readable.
- Ring walk: no invisible walls, no dead-ends, threshold frames the Fire exit.

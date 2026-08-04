---
status: active
value: 4
effort: L
remaining: 'Design approved by Austen 2026-08-04 ("let's build it"). Graybox build dispatching to one Opus executor; eye-level gate after.'
depends_on: 'docs/superpowers/specs/2026-08-03-vulcan-cave-fire-room-handoff.md'
plan_path: 'docs/superpowers/plans/2026-08-04-first-fire-graybox.md'
tags: [museum, fire-room, first-fire, design]
last_triaged: 2026-08-04
---
# The First Fire — Vulcan Cave Fire Room Design

Approved by Austen 2026-08-04 from the concept sheet
`static/sketches/2026-08-04-fire-room-floor-plans.html` (Plan C "The First Fire"
with Plan A's lava-crossing approach) and the painted mood target
`static/sketches/2026-08-04-first-fire-concept-frame.html`.

## One paragraph

The visitor leaves the Drowned Gallery through the carved threshold and crosses
a basalt bridge over a lava stream — heat shimmer, ember rain, the element felt
first-person — then the light behind them dies through a darkening crack, and
the room opens: a stepped basalt amphitheater facing three automatons across a
4 m lava fissure, each at a low fire pit, spinning burning staves in the dark.
The performance is the room's light source. A cold ash circle with abandoned
charred staves sits behind the benches: the visitor's side of the ancestral
fire jam. Exit ascends east to Earth.

## Pedagogy (MCP-verified 2026-08-04)

Performers are the three opposite-direction compound pairs **DJ, EK, FL**
(JD/KE/LF depending on start): full cycles alpha↔beta with constant rotation
character — DJ pro/pro, EK anti/anti, FL hybrid (blue anti / red pro). Timing
(split vs tog) is a property of the compound's phase — which specific
alpha/beta variations it runs between; downbeats together = tog, 180° apart =
split. Fire's canon slot is the **split-timing variations**; Air later gets the
together-timing variations of the same pairs.

**Resolved 2026-08-04:** the graybox initially shipped the generator's
variation-0 runs, which are the TOG-timing (Air) versions — Austen caught it at
the gate walk. The sequences now transcribe the canonical T&D base catalog's
`tnd-split-opp-*` entries verbatim (`static/data/hero/tnd-base-words.json`):
alpha1-anchored, blue at the downbeat while red crests. Commit `3a3279f4a4`.
Lesson recorded: the catalog, not the generator default, is the variation
authority for roster sequences.

## Geometry (derive from wing bounds, never absolutes — Water's rule)

Wing `cave-fire`, interior ≈ 26 × 20 m plus the bridge approach. Entered from
the grotto's east door (z 21–23); exits east to Earth (`fireToEarth`).
West→east program:

| Station | Floor | Notes |
|---|---|---|
| Ember bridge | −0.3 | 3 m wide, ~8 m long, aligned to the grotto door axis; lava stream (blocked) both sides, visual bed −2.0 |
| Darkening crack | −0.3 → −0.8 | ~2.5 m wide, one bend (kills the sightline); light falls off along it |
| Bench terraces (3 arcs) | −0.8 / −1.3 / −1.8 | descending north toward the fissure; 0.5 m risers with aisle steps |
| Ash circle | on the −0.8 terrace, south-center | blocked inner disc, charred stave props (graybox: dark cylinders) |
| Lava fissure | blocked | 4 m band east–west, visual bed −3.5; THE barrier (pool rule) |
| Performer shore | −1.3, blocked | north band, unreachable; three fire-pit stations at thirds |
| Exit stair | −0.8 → 0 | east side, to the `fireToEarth` door |

Datums: entry/bridge −0.3 (matches grotto walkways) · benches −0.8/−1.3/−1.8 ·
shore −1.3 · fissure bed −3.5 (visual) · lava stream bed −2.0 (visual) · exit
door 0. Eye = floor + 1.60 (STANDING_Y 0.85 + camera 0.75).

## Light plan (graybox austerity; decay=2 ⇒ intensity ≈ target·r²)

The room's light hierarchy IS the concept: three fire-pit warm lights are the
primary sources; a slow sine pulse (or static, if pulse is fussy) stands in for
performance-synced flare. Support: dim glow under the bridge lava, one cool cue
in the crack, faint amphitheater fill so looking back is never 100% black
(Water's defect must not recur), warm rim on bench edges. Trail placeholders:
two emissive torus rings per performer (tilted, white-hot + amber) at chest
height — static stand-ins for Phase 3 trails.

## Engineering invariants (Water's six, carried forward)

1. Door gaps derive from real door tiles; no constants.
2. One geometry source: a `FirstFireLayout` module drives terrain zones AND
   graybox meshes AND performer anchors.
3. `elevationAt` throws in dev on uncovered in-bay points.
4. Coupling tests: rendered-vs-walkable floor coverage, door coverage, neighbor
   elevation sweep (≤0.6 m), performer anchor == layout anchor (±0.05).
5. Route test: bridge → crack → amphitheater (all three terraces) → exit stair
   walkable; fissure/lava/shore blocked at 0.25 m probe intervals.
6. `suppressedSpans` check: adding `cave-fire` to the suppressed set must not
   silently strip tile floor outside the suppressed wings (pair-bounding-box
   heuristic; regression-test it).

## New tech (graybox proves the seam, not the art)

- Performance-synced lighting: graybox = slow sine pulse per pit. Real beat-
  clock sync is Phase 3.
- Prop-head flames + trails on performer rigs: graybox = emissive torus
  stand-ins. Real trails Phase 3 (existing trail/effects family).
- Ember-scene kit (LavaPool/Cracks/Rivers, HeatDistortion, VolumetricFire,
  EmberFountains, VolcanicHaze, ObsidianPillars) is Phase 2+ reuse, NOT graybox.

## Data changes

- `CAVE_MODE_ROOMS` fire entry migrates to `performerIds`/`sequenceIds` arrays
  (Water precedent).
- `museum-exhibit-sequences.ts` gains `cave-fire-seq-dj/-ek/-fl` (MCP step data
  embedded in the plan, score 1.00 each). Old single `cave-fire-seq` /
  `cave-fire-automaton` entries replaced. Orphaned `cave-water-seq` movement
  data may be deleted in passing (handoff loose end #5) if touched anyway.

## Gate

Austen walks it first-person: bridge heat beat reads; crack kills the light;
the amphitheater reveal lands with three fire-lit stations as the only strong
sources; ring of terraces walkable with no dead ends except by design (exit
stair reachable from every terrace); looking back never black. Iterate geometry
here where it is nearly free; art phases stay gated.

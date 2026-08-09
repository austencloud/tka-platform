---
status: rejected
rejected_on: 2026-08-09
rejected_because: >-
  Three channels split the ensemble to buy a corridor choice. Water's unique
  observable is all three letters legible at once, doubled in still black
  water; this design spent that asset and then needed an automaton state swap
  to fake it back for the finale. Scene reverts to "The Ring" (grotto,
  waterfall, mirror-pool reflection) — commit 3b946cfae1.
value: 4
effort: L
tags: [museum, vulcan-cave, water, drowned-gallery, graybox, design]
depends_on: 'docs/superpowers/specs/2026-08-02-vulcan-cave-water-room-drowned-gallery-design.md'
last_triaged: 2026-08-09
---

# The Drowned Gallery: Three Channels — Design

**Scene ID:** `drowned-gallery` (revision of the Water route: `cave-water-approach`,
`cave-water-gallery`, `cave-water`)

**Supersedes:** the single S-path flooded gallery of the 2026-08-02 design. The
grotto ring, mirror pool, alcove firelight, waterfall, gilded threshold, and
cave-native-water rule all carry forward.

**Pipeline:** the 2026-08-09 Blender graybox pipeline (layout module → hash-
stamped manifest → `build-drowned-gallery-graybox.py` → optimized GLB →
`/test/drowned-gallery-graybox` walk route, commit `3b946cfae1`). This design
revises the layout module; everything downstream regenerates.

## Outcome

The visitor should leave Water having *chosen* one letter as their personal
introduction — one dive, one private air-bell audience — and then discovered
all three letters together, doubled in the mirror pool. The choice is the
mechanic: which channel you take determines which performer meets you alone.
The other two bells stay open as optional dives and replay variation; nothing
is locked, and nothing is a checklist. The felt sequence is descent → choice
→ breath → weightlessness → reflection.

**Amended 2026-08-09 (Codex review, accepted):** the original draft required
earning all three audiences before the shaft. That made Water a three-item
errand in the same dramatic grammar as Fire. The governing rule now: **make
the visitor earn the room's transformation, not every letter.** Fire keeps
its full progression because its room state causally requires the set; Water
requires exactly one dive.

## Experience sentence

> The player enters from the Squeeze, wades down the flooded approach until
> the rock closes overhead, chooses one of three dark channel mouths in the
> drowned hub, surfaces into a private air-bell where a single performer plays
> at arm's length, dives back to choose again, rises weightless up a glowing
> buoyant shaft to the grotto ring, watches A, B and C play doubled in the
> black mirror pool, and exits east through the gilded threshold toward Fire.

## The five beats (each is a property of water)

| Beat | Property | Mechanic | Ownership |
|---|---|---|---|
| 1. Descent | Pressure | Existing: ramp under a roof below the waterline; submersion overlay | Shipped (terrain + Museum3DScene trigger) |
| 2. Choice | Depth/dark | NEW: a flooded hub with three channel mouths | Layout revision |
| 3. Breath | Surfacing | NEW ×3: air-bell grottos, one performer each | Layout revision + performer moves |
| 4. Weightlessness | Buoyancy | NEW: buoyant shaft — water column with reduced gravity, jump in, float up | Reuses the Moon's per-room gravity-scale seam; no new locomotion capability |
| 5. Reflection | Doubling | Existing, promoted to finale: mirror pool doubling all three performers + firelight | Grotto ring (kept) |

No breath meter, no fail state, no free 3D swimming. Locomotion stays the
standard walker throughout; the buoyant shaft modulates gravity only inside
one bounded column with one entrance and one exit.

## Structural decisions

1. **One choice, not a checklist.** The hub is hub-and-spoke: the visitor
   picks ONE channel, meets that letter privately, and that bell feeds the
   buoyant shaft up to the finale. The other two channels remain open —
   optional dives before ascending, or replay variation — but the route
   requires exactly one. Fire is the cave's forced full procession; Water is
   its opposite: a single meaningful choice. Channel character (length, glow
   color) differentiates the letters without ranking them as tasks.
2. **One performer per bell.** A, B and C leave the shared shore shelf. Each
   air-bell stages exactly one performer on its own firelit shelf, close
   (3–4 m read distance), alone — Fire's isolated-shrine intimacy in Water's
   vocabulary. The bells must not share performance sightlines or acoustic
   fields with each other.
3. **The grotto ring keeps its role but loses the row.** The shore shelf's
   three-in-a-row staging is replaced by the ensemble *reflection*: at the
   ring, all three performers are visible around/behind the mirror pool so the
   pool doubles them. (Exact staging — around the pool vs. reflected from
   elevated niches — is a Gate 1 composition question.)
4. **Legibility over maze.** Exactly three mouths, visually distinct (each
   mouth glows faintly with its bell's firelight color temperature carried
   through the water), runs short (≤ 12 m per channel), no junctions inside a
   channel. A channel is a corridor, not a maze. The hub is one readable room.
5. **The pool stays a walking barrier and becomes a diving door.** The far
   shore is reachable only through water — closing the 2026-08-02 loose end
   ("I really do want to reach the other end") without opening the habitat to
   dry walking.

## Layout requirements (feed the terrain module revision)

- **Approach (kept):** ramp 0 → SHALLOWS_Y, existing.
- **Drowned hub (new, replaces the S-path):** floor at GALLERY_FLOOR_Y, roof
  at GALLERY_ROOF_Y (below waterline), fed by the existing descent stair. The
  hub holds three channel mouths on distinct walls plus the return mouth to
  the descent. One open shaft over the hub centre keeps a visible water
  surface overhead (orientation anchor: light = the way back up).
- **Three channels (new):** PATH_WIDTH-class corridors at GALLERY_FLOOR_Y,
  roofed below the waterline, each ending in a surfacing stair into its bell.
  Target runs ~6 m (A), ~9 m (B), ~12 m (C).
- **Three air-bells (new):** small grottos (~6 × 5 m) with floor near
  LANDING_Y-to-CAUSEWAY_Y, air above the waterline, one performer shelf at
  SHELF_Y-equivalent behind a narrow water margin, firelight niche, and a
  ceiling low enough to feel held (≈ 3 m over the deck) — the opposite of the
  dome. **Every bell connects to the buoyant shaft** (shared column or per-
  bell feeders — Gate 1 topology call), so any single dive completes the
  route; each bell's exit also returns to its channel for backtracking and
  optional further dives.
- **Buoyant shaft (new):** a vertical water column (~2.5 m square) from
  gallery depth up to the grotto ring apron level. Inside the column, gravity
  scale drops (Moon seam) so a jump floats the player up; a lip at the top
  lands them on the apron. Glowworm points line the shaft so the rise is lit.
  One-way DOWN is prevented by the lip geometry (you can look down it, not
  fall in — or falling in is safe and floats you, Gate 2 feel test).
- **Grotto ring (kept, restaged):** shore/channel/pool/apron bands as shipped;
  performer staging revised per structural decision 3; balustrades, waterfall,
  glowworm dome, gilded threshold, east exit ramp all unchanged.
- **Datums:** all existing datums keep their values. New bells introduce one
  new datum (BELL_FLOOR_Y) chosen so the bell deck sits dry with eye above
  waterline immediately on surfacing.
- **The elevation/blocking contract holds:** every walkable point is covered
  by a floor rect; basins and rock stay blocked; `elevationAt` still throws on
  uncovered bay points. The traversal test extends to all three channels, all
  three bells, and the shaft.

## Claim ledger (initial classification)

| ID | Class | Statement |
|---|---|---|
| C-001 | literal | Water stages the exact museum performers and sequences `cave-water-seq-a/b/c` (A, B, C). |
| C-002 | literal | A, B, C are the first three letters of the alphabet's first VTG group (verify group name via MCP at Gate 0 — do not trust this row). |
| C-003 | metaphor | Channel length encodes letter order/difficulty (A shortest). |
| C-004 | metaphor | The mirror pool doubling three performers expresses water showing motion twice. |
| C-005 | invention | Private air-bell audiences; surfacing = meeting a letter. |
| C-006 | invention | The buoyant shaft; rising through water as reward for completing the dives. |
| C-007 | invention | Channel mouths glow with their bell's firelight through the water. |

## What this deliberately does NOT do

- No swim locomotion, no oxygen/breath meter, no fail states.
- No reef/tropical/ocean dressing (cave-native water only, standing decision).
- No fish work in this phase (FishBoids + existing GLBs remain Phase 3).
- No change to Fire-side or Squeeze-side transitions.

## Production plan (museum-scene-production gates)

- **Gate 0:** evidence preflight on the revised scope; verify C-002 via MCP;
  fingerprint the three sequences; record the supersession of the S-path in
  the tracker. Create `scene-gates.json` from the template.
- **Gate 1:** measured plan — revised layout module (hub, channels, bells,
  shaft) + plan board with route strip, long section through a channel+bell
  (the section is the money drawing: roof-below-waterline must be legible),
  moving sightline windows for each bell's performer, and the ring's doubled
  final frame. Austen approves on comprehension.
- **Gate 2:** regenerate manifest → Blender build → GLB → walk route (the
  shipped pipeline; builder gains bell/shaft geometry). Buoyant shaft gravity
  seam wired in the walk route for the feel test. Austen walks it.
- **Gate 3+:** per the standard contracts; visual target should carry the
  channel-mouth glow and bell warmth/dome coolness contrast.

## Open questions for Gate 1

1. Bells → shaft topology: RESOLVED by the 2026-08-09 amendment — every bell
   reaches the shaft, so one dive completes the route. Remaining sub-question:
   one shared column with three feeders, or the hub as the shaft's entry.
2. Ring staging of the three performers for the doubled final frame.
3. Does the gallery room's compiled footprint grow to fit three bells, and if
   so, does the whole cave walk need a re-check (rooms move downstream)?
4. Falling into the shaft from the top: blocked, or safe-and-floaty?

## Risks

- **Dark-water legibility** — the entire design bets on three mouths staying
  readable. Gate 2's walk test kills the design if a tester (Austen) ever
  feels lost in the hub. Mitigation is in the mouth-glow and the lit shaft.
- **Footprint pressure** (open question 3) — bells may not fit the current
  24 m gallery depth; growing the room moves the cave.
- **Performer proximity in bells** — 3–4 m reads need the shared avatar rig
  to hold up close; the rig-space body-follow defect (Earth Gate 2 feedback)
  must be fixed independently before Gate 2 judgment here.

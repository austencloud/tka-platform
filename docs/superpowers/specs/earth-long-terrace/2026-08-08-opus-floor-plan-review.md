# Opus review — Earth Long Terrace, Gate 1 candidate

**Date:** 2026-08-09
**Reviewer:** Claude Opus 5, acting as independent creative director / level designer / 3D environment lead / TKA domain reviewer
**Scope:** the Earth Long Terrace Gate 1 candidate, judged against the ideal Earth room rather than against its own proposal
**Repository writes:** this file only

---

## Verdict

| Question | Verdict |
| --- | --- |
| Gate 1, Earth Long Terrace | **REJECT** |
| The synchronized-row insight | **KEEP.** It is the best idea in either Earth candidate. |
| The Long Terrace container (flat terrace parallel to the row, 3.6 m drop, all three visible from stop 2) | **REPLACE** |
| Infrastructure (plan-contract-as-code, generated board + report, full-ribbon sampling method, 75 deg vertical FOV, domain proof) | **KEEP and reuse** |

Reject is not "move things a metre." Four of the candidate's failures are structural
and one is a false number on the evidence board:

1. The walkable surface is undefined, and under the plan's own drawn terrace the
   performers are **entirely hidden** (Blocker 1).
2. Stops 3, 4 and 5 are the same frame with the labels swapped — 31 % of the route
   produces no new composition (Blocker 3).
3. The climax adds no new image: 2.5 deg of apparent size on a subject the visitor
   has been looking at since stop 2, and 1.6 deg of horizon in a 75 deg frame
   (Blocker 4).
4. The room's own governing metric — can a visitor tell a ring from a four-petal
   flower — is never measured anywhere in the plan, the report, the tests or the
   board (Blocker 5).
5. The Gate 1 board labels the daylight reveal `G 8.5° H 8.5° I 8.5°`. The true
   values at that stop are **7.18 / 6.23 / 5.37** (Blocker 2).

The candidate is also stronger than the Root Observatory in real ways, and those
gains must survive the rebuild. They are listed in §4.

---

## 0. Method and evidence

Everything below was produced in this session. Nothing is inherited from the
2026-08-08 Opus or Fable process reviews; where I disagree with the earlier Opus
recommendation I say so explicitly (§2.2, §6).

**Domain (Flow Arts MCP, local server, this turn).**
`get_letter_explanation` G / H / I, `compare_letters` G vs I, `get_term_definition`
for `beta`, `pro`, `antispin`. Catalog entries `tnd-tog-same-gggg` / `-hhhh` /
`-iiii` read directly from `static/data/hero/tnd-base-words.json`. Bound museum
sequences `cave-earth-seq-g` / `-h` / `-i` read step-by-step from
`src/lib/features/museum/data/museum-exhibit-sequences.ts`.

**Code read in full.** `earth-long-terrace-plan.ts`,
`scripts/generate-earth-long-terrace-board.ts`,
`tests/unit/museum/earth-long-terrace-plan.test.ts`,
`src/routes/test/earth-long-terrace-floor-plan/+page.svelte`,
`vulcan-cave-floor-plan.ts`, `earth-canyon-layout.ts` (the live Earth room),
`air-chimney-layout.ts`, `packages/camera-3d/src/lib/types.ts`, the production
contract, `scene-gates.json`, `earth-long-terrace-gate1-report.json`, the skill
package (`SKILL.md`, `gate-contracts.md`, `visual-bridge.md`,
`process-review-ledger.md`) and both prior reviews.

**Canon.** `docs/museum/story-bible.md` line 209 (Vulcan Cave wing) read in full.
Tracker: `node scripts/museum-dev.js list`, then items `LRVn0dwoX9omGzSTmXlf`
(the Long Terrace proposal), `AsEXOfJUUS0bKdErKeZW` (player verbs — answered),
`s278g83rbcQybhjZnIfO` (the sightline correction that killed Gate 1.1).

**Commands run now.**

```text
pnpm exec vitest run --config tests/config/vitest.config.ts \
  tests/unit/museum/earth-long-terrace-plan.test.ts
  -> 1 file passed, 9 tests passed (1.99 s)

node .claude/skills/museum-scene-production/scripts/validate-scene-gates.mjs \
  docs/superpowers/specs/earth-long-terrace/scene-gates.json
  -> PASS: earth-long-terrace gate manifest is valid   (exit 0)

node .claude/skills/museum-scene-production/scripts/validate-scene-gates.mjs --self-test
  -> 6 PASS lines
```

**Live inspection.** Reused the existing vite server on 5177 (53 GB RAM free,
several servers already up — I spawned none and killed none). Shared debug Chrome
via `scripts/launch-chrome-debug.ps1`; task-owned background tabs only; emulation
cleared and both tabs closed at the end.
[`https://localhost:5177/test/earth-long-terrace-floor-plan`](https://localhost:5177/test/earth-long-terrace-floor-plan)
served 200, rendered at 1920x1080, **zero console errors or warnings**. The board
SVG was also opened directly at its native 2200x1500 and read panel by panel.
(An unrelated `ChoreoCard.svelte` HMR compile error from another session was
overlaying the page; it is not this scene's.)

**Geometry.** Every number attributed to the plan below was re-derived from
`earth-long-terrace-plan.ts` in throwaway scripts under the OS temp directory,
not read from the report. The report's headline figures reproduce exactly
(46.201 m, +0.42027 m, 9.697 / 10.906 / 10.990 deg) — the reported metrics are
honest. What they measure is the problem.

---

## 1. The ideal Earth room, derived before judging this one

### 1.1 What the cave is teaching, and what Earth uniquely owns

`CAVE_MODE_ROOMS` in `vulcan-cave-floor-plan.ts` and the story bible agree: six
rooms, one timing-and-direction cell each. Earth is `TS`, Together-time /
same-direction, roster G / H / I, catalog family `tnd-tog-same-*`.

MCP and the bound sequences, verified this turn, say what that means physically:

| | blue | red | hand path (both hands) |
| --- | --- | --- | --- |
| G | pro cw, orientation `in → in` every step | pro cw, `in → in` | s→w→n→e→s |
| H | anti ccw, `in → out → in → out` | anti ccw, `in → out → in → out` | s→w→n→e→s |
| I | anti ccw, `in → out → in → out` | pro cw, `in → in` | s→w→n→e→s |

Both hands are at **beta** — the same grid point — at every step boundary, and
both travel the same leg in the same direction. MCP: *"beta: a position where both
hands are at the same grid point (0 degrees apart) … a natural start position for
'together' patterns."* MCP on pro: *"At 0 turns … this specific case is called an
'isolation', where the prop rotates with the arc creating the visual effect of a
fixed point."* MCP on anti: *"the prop rotates opposite to the hand's arc. Creates
petal-like patterns."*

So Earth's subject, stated precisely and for the first time in this scene's
documentation:

> **Two props travelling as one, around one circle, at one instant — and the only
> question is what each prop does while it travels.**

That is a *unison* subject, and it is a subject **inside a single performer**
before it is a subject across three. G and H are the two pure cases. I is the
mixture, and I is not a metaphor for a mixture: in
`museum-exhibit-sequences.ts`, `cave-earth-seq-i`'s blue column is byte-identical
to `cave-earth-seq-h`'s blue column, and its red column is byte-identical to
`cave-earth-seq-g`'s red column, orientations included. On I, at the same instant
and in the same place, one prop draws a ring while the other draws a flower, and
the blue prop's ends flip in/out every quarter while the red prop's do not.

**That single-performer image is the strongest thing in the room and neither
candidate makes it the hero.** The contract has it as C-003 and then spends the
whole room on the three-way comparison.

### 1.2 What Fire hands over and what Air takes

**Fire** (`2026-08-06-first-fire-torch-procession-design.md`, locked): a
horizontal procession through a torch maze, three shrines that never share a
performer sightline, verified at 0.2 m sampling, ending in total extinction, one
breath of silence, then moss circling the last cold trench and leading the visitor
around a bend. Fire owns **isolation**, **darkness**, and **one at a time**.

**Air** (`air-chimney-layout.ts`): `AIR_CEILING_Y = 13.0`, ledges at
`LEDGE_YS = [2.4, 5.0, 7.6]`, all three on the **same** wall, staggered along z.
The source comment is explicit about why: alternating walls meant *"from the floor
you could not see a single performer"*; on one side *"they read as three lit stages
rising away — the 'three heights, one beat' frame the concept asks for is simply
there when you walk in."* Air owns **verticality**, **motion**, and — this is the
part the Long Terrace missed — **all three at once, in one frame, from the moment
you enter.**

The Long Terrace correctly refuses to duplicate Air's axis. It then duplicates
Air's *frame*: a trio, synchronized, simultaneously legible, present from the
threshold. Earth and Air become the same composition rotated 90 degrees, and the
one thing that distinguishes them (hand-path direction: same vs opposite) is the
harder read of the two. **Earth must own the sequence and the unison; Air owns the
simultaneity.**

Story bible, verbatim, on this exact point:

> "Fire isolates its DJ, EK, and FL performers in separate shrine habitats. **Earth
> presents G, H, and I as sequential close encounters before one final ensemble
> sightline.**"
> "Each chamber is an exhibit-scale habitat, not a performer bay: visitor
> circulation and interpretation occupy the public side of a gate or architectural
> threshold, while automatons perform in recessed prehistoric environments."

Canon already gives Earth its structure *and* its architecture: sequential, then
one ensemble; visitor behind a gate or threshold; performers recessed. The Vulcan
Cave paragraph also names **glass-walled exhibits** for this wing — which turns out
to be the geometrically decisive detail (§1.3).

### 1.3 The two laws the ideal room obeys, and neither candidate states

Both Earth candidates have now failed on foot-line occlusion, and both re-derived
the fix by sampling. The relation is closed-form and it should live in the plan
contract as a formula, not as a sampled number.

**Law 1 — the occlusion budget.** Let `E` = eye height above the visitor's own
floor, `B` = barrier/lip top above that floor, `D` = performer floor below that
floor, `S` = the visitor's setback from the barrier, `L` = horizontal distance to
the performer. The performer's feet are visible iff

```
S / L  <=  (E - B) / (E + D)
```

Consequences, computed with `E = 1.65`:

| Geometry | `D` | `B` | budget `(E-B)/(E+D)` |
| --- | --- | --- | --- |
| Long Terrace, no guard | 3.6 | 0.00 | 0.314 |
| Long Terrace, 0.45 m guard | 3.6 | 0.45 | 0.229 |
| Long Terrace, 0.90 m guard | 3.6 | 0.90 | 0.143 |
| live canyon slab apron | 6.15 | 0.45 | 0.154 |
| live canyon rim | 5.85 | 0.90 | 0.100 |
| **1.0 m shelf, glazed (no lip)** | **1.0** | **0.00** | **0.623** |
| 1.0 m shelf, 0.90 m opaque rail | 1.0 | 0.90 | 0.283 |

Three things fall out, and all three are counter-intuitive enough that they explain
both failures:

- **A deeper drop makes the lip problem worse, not better.** A steeper ray falls
  faster past the lip. The live room's own constants encode this discovery —
  `PARAPET_HEIGHT = 0.9` carries the comment *"The sightline math caps this at
  1.07 m … Do not 'safety up' this number,"* and `SLAB_NOSE_OUTER_Y = -4.5`
  carries *"a flat 2 m tongue at apron height sits exactly across the eye's line to
  the performers … so a level nose hides the entire performance from the one place
  the room is composed for."* Earth has now paid for that lesson three times.
- **Every 0.2 m of opaque barrier costs roughly 1 m of proven viewing depth** at
  these proportions. The only barrier that costs nothing is a transparent one. The
  story bible's "glass-walled exhibits" is therefore not decoration; it is the
  enabling geometry.
- **Put the occluding edge at the visitor's feet and let the ground fall away
  beyond it.** With the edge 1.4 m out (Long Terrace) a 2.4 m band is the most you
  can prove. With the edge at the lip and a scarp beyond it, a 3.4 m band proves
  out — measured in §7.

**Law 2 — trace-plane foreshortening.** G, H and I trace their rings and petals in
the *wall plane*, a vertical plane facing the visitor. Looking down at depression
`phi` compresses that plane by `cos(phi)`. This is the metric that decides whether
the room works, and it appears nowhere in the plan, the report, the tests or the
board.

| Viewpoint | depression | `cos(phi)` |
| --- | --- | --- |
| live canyon, slab apron → centre boss | 60.0 deg | **0.50** |
| Long Terrace, stop 3 → G | 27.9 deg | 0.88 |
| Long Terrace, near stand → I | 41.7 deg | **0.75** |
| 1.0 m shelf, 6–7.5 m out | 19–23 deg | **0.92–0.94** |

The live canyon squashes the room's subject 2:1 at the exact point it is composed
for. The Long Terrace's own climax is its *worst* foreshortening — the closer the
visitor gets, the flatter the traces read, because the drop is fixed and the
distance shrinks. **The correct Earth drop is about 1 m, not 3.6 m and not 5.85 m.**
Scale and awe come from the canyon *behind* the performers, where they cost nothing.

### 1.4 The verb the tracker already specified

Tracker item `AsEXOfJUUS0bKdErKeZW` — *"INTERACTIVE EXHIBIT DESIGN — PLAYER
VERBS"* — is answered and accepted:

> "Core loop defined: Walk, listen, interact. Player walks up to an exhibit and
> presses a button … **Interactive exhibits let the player control playback: change
> speed, swap props, play backwards, manipulate the performance parameters. Like
> holograms they have complete control over.**"

Earth is the single best room in the museum for that verb, because the three
sequences are byte-identical except for prop rotation. Switching a performer's
bound sequence among `{cave-earth-seq-g, cave-earth-seq-i, cave-earth-seq-h}`
changes **only** what the props do — never a hand position, never the clock, never
the body. So:

> **The authored verb: at G's station the player turns one hand's rotation and G
> becomes I. At H's station they turn the other and H becomes I. Then they meet the
> real I and already know what it is, because they built it twice from opposite
> directions.**

Zero new sequence data, zero new fingerprints, no data mutation — a sequence swap
against three assets already bound and already digested. This is the room's thesis
as a mechanic.

---

## 2. Answers to the nine questions

### Q1 — Is a bright Long Terrace with G/H/I in a synchronized side-by-side row the strongest Earth concept after Fire and before Air?

**Partly. Three of its four premises are right and the container is wrong.**

- **Bright: yes, keep.** Fire ends in blackout and one breath of silence. Earth is
  the first daylight in the cave and the visitor should squint. This is correct and
  it is the candidate's best instinct after the clock.
- **Synchronized on one clock: yes, keep, and make it load-bearing.** Because the
  hand paths and timing are identical, three synchronized performers are
  body-identical every frame, so the only visible difference is prop rotation. That
  is a controlled experiment and it is free. Verified from the bound sequences, not
  inferred.
- **A side-by-side row: yes, keep**, at the live room's `BOSS_SPACING = 4.0` rather
  than 3.5 (which leaves only 0.7 m between 2.8 m stages — props will read as
  colliding).
- **A long flat terrace parallel to the row, all three visible from stop 2: no.**
  It duplicates Air's frame one room early, it makes the middle 31 % of the route
  one repeated composition (Q3, Blocker 3), it leaves the room with no new image at
  its climax (Blocker 4), and it converts the story bible's sequential structure
  into a reinterpretation request rather than a design.

The strongest Earth concept keeps the clock, the row and the daylight, and replaces
the container with **a near-level gallery behind a threshold, three isolated close
reads, and one ensemble reveal** — §7.

### Q2 — Does the plan honestly reconcile "sequential close encounters" with Together Same, or is it a compromise that weakens both?

**It is honest about proposing a reinterpretation — the contract, the board banner
and the review page all flag it as an open decision, which is exactly right. But
the reinterpretation weakens both halves, and it is not necessary.**

The plan's reading is "three changing nearest reads rather than three isolated
rooms." The geometry does not deliver even that. Measured from the plan:

```
apparent body height (deg)        G      H      I
stop 3  (19.0, 19.4)            8.47   8.13   7.31
stop 4  (22.5, 19.4)            8.13   8.47   8.13
stop 5  (26.0, 19.4)            7.31   8.13   8.47

bearing of each performer, relative to walking direction
stop 3                          0.0   +19.5  +35.3
stop 4                        -19.5    0.0   +19.5
stop 5                        -35.3  -19.5    0.0
```

The nearest performer subtends **8.47 deg at all three stops** — identical by
construction, because the route runs parallel to the row at a constant 9.9 m. Stop
5 is the mirror image of stop 3. There is no "changing read": there is a
translation. The claim in the contract that "successive terrace positions make G,
H, and I the closest comparison" is true only in the trivial sense that a different
body is directly in front of you.

It weakens the other half too. Together-Same's real subject is unison *inside* a
performer (§1.1). Reading that requires being close and near-frontal. The plan's
comparison stops sit at 9.9 m and 27.9 deg depression, and its climax at 5.9–7.9 m
and 41.7 deg — the worst foreshortening in the room.

**The reconciliation that does not compromise:** isolate the *views*, not the
performers. All three share one habitat and one clock (Together-Same is preserved
and is the whole point); the visitor meets them one at a time through three framed
openings in a threshold (canon's "sequential close encounters" and "the public side
of a gate," literally satisfied); the threshold then ends and all three resolve at
once (canon's "one final ensemble sightline," and a genuine reveal because you have
never seen more than one). Fire isolates *performers in separate habitats across a
60 m maze*; Earth isolates *views of performers who share one habitat and one
clock*. That is the opposite lesson, not a repeat.

### Q3 — Are the hero hierarchy, 46.2 m route, blind turn, performer spacing, stage drop, daylight reveal, near stand, exit to Air, lush habitat, and persistent wall traces spatially and experientially convincing?

Item by item. Every number re-derived from the plan.

| Element | Verdict | Measured basis |
| --- | --- | --- |
| **Hero hierarchy** (row / canyon / traces / habitat) | **Right order, not delivered.** At the final camera the horizon sits 1.59 deg below the top of a 75 deg frame — hero #2 (the daylight canyon) occupies 2 % of the climax frame. Hero #3 (traces) has no declared elevation or height anywhere. | camera pitch -35.91 deg, half-V 37.5 deg |
| **46.2 m route** | Length is fine and the doors are correct. Grades 0–6.00 %, max on the exit run, inside 1:16. But 7.8 % of the centreline and 13.5 % of the 2.4 m band lie **inside the reveal blocker** — the solid root bluff. Path index 2 `(8, 16.2)` is literally inside the blocker rect. | 0.1 m polyline sampling |
| **Blind turn** | The *idea* is right and it is the one place the plan improves on the live gully's job. The *implementation* proves concealment against a rect (`6.2–10.8 × 9–16.2`) that is 0.5 m deeper than the root mass that justifies it (`blind-turn-roots` reaches z 15.7), and the route uses that half-metre. Concealment is proven against geometry that does not exist; walkability against geometry that does. | rect vs ellipse test |
| **Performer spacing** | 3.5 m centres on 2.8 m stages leaves **0.7 m** between stage rims. The live room uses `BOSS_SPACING = 4.0` on `BOSS_RADIUS = 1.25` (1.5 m gaps). Props on a full hand circle at beta will read as overlapping between neighbours at 0.7 m. | plan vs `earth-canyon-layout.ts` |
| **Stage drop** | **Wrong direction and undeclared as a change.** 3.6 m gives the worst of both: 41.7 deg foreshortening at the climax (Law 2) and a 0.314 occlusion budget that no guard rail fits inside (Law 1). The live room is `RIM_Y -1.4` to `BOSS_Y -7.25` = **5.85 m** ("six metres below" in the compiled description). The contract's Authority ledger records the room shell conflict as **"None: 34 × 24 m shell and both doors retained."** A 38 % reduction of the canonical drop is not "none." | `RIM_Y`, `BOSS_Y` |
| **Daylight reveal** | **Unmodelled.** No aperture, no ceiling, no light geometry anywhere in the plan or the section. The live room already owns the answer: `AVEN_RADIUS = 5.0`, an opening in the roof at `EARTH_CEILING_Y = 3.6` centred over the bosses, with a *derived* `avenShaftRadius` because a column sized to contain the performers "puts its own translucent wall a handspan in front of the visitor's eye." The candidate keeps the promise and drops the mechanism. | `earth-canyon-layout.ts:87,126` |
| **Near stand** | **Not a climax.** It is +2.5 deg of apparent size on a subject visible since stop 2, and it is a 147 deg hairpin (arrive on heading 340 deg, depart on 127 deg). `retraceRequired: false` is true only in the sense that no segment is literally repeated; the detour costs 7.2 m of 46.2 m (15.6 %). It sits 2.8 m north of the plan's own `terraceViewEdge` with nothing declared holding it up, and it is outside all three interaction zones, so nothing new fires there. | path indices 6→7→8 |
| **Exit to Air** | Correct door, correct datum, no retrace of the terrace, and better than the Root Observatory's out-and-back. Stop 7's "trio remains visible over the shoulder" requires a ~140 deg look back, which is turning around, not glancing. | walkPath[9] vs south door |
| **Lush habitat** | Five masses, 75+ m² plan area, labelled, and correctly subordinate. But `isEarthLongTerraceSightlineBlocked` consults **only** `revealBlocker` — the habitat masses are never tested for occlusion, exactly as in the Root Observatory. Today they happen to sit clear; nothing enforces it. | plan module |
| **Persistent wall traces** | The best invention in the candidate and the least specified. `traceWall` is a 12.6 × 0.7 m rect with **no elevation and no height**, sitting 6.5 m north of the performers, with the four canyon shelves (-7.8 … -25) nominally in that same 6.5 m — a 21 m descent crammed into 6.5 m of plan depth. From the terrace the traces would appear *below* the performers, in the shadowed pit. The live room puts its shelves *outside* the interior rect as blocked visual bands north of the parapet; the candidate tries to fit the canyon inside a 24 m room and there is no room. | `traceWall`, `canyonShelfElevations`, `CANYON_SHELF_Y` |

One more canon conflict the ledger does not record: the live shell sets Earth's
`north: EMPTY_WALL` with the comment *"The canyon is open north."* The candidate
places a solid `traceWall` at z 2.3–3.0 — closing the side the live shell
deliberately opens, and the trace metaphor depends on that wall existing.

### Q4 — Does the interaction have an authored verb and a meaningful environmental response, or is proximity-triggered trace retention still passive museum slop?

**Still passive.** The player's entire contribution is walking, and the response is
additive decoration on an unspecified surface.

To be fair to the candidate, walking-as-trigger is not unprecedented here: Fire's
locked design says *"ordinary forward movement completes the interaction"* and uses
four 75 deg zones advancing every 55 deg so *"one missed boundary event cannot
strand the visitor."* The Long Terrace copies that robustness correctly — its three
2.4 m zones on 3.5 m centres overlap by 1.3 m, `earthLongTerraceInteractionGap`
returns -1.3, and the test asserts it. That is a real improvement over the Root
Observatory's single missable trigger and it should survive.

But Fire's *state* does something: DJ → EK → FL → total extinction → green growth,
a monotonic chain that blacks out the room and then leads you out. Earth's chain is
reveal → retain → brighten once. Nothing is at stake, nothing changes, nothing can
be got wrong, and the "brighten" fires at a stand that is outside every zone.

And the museum has already answered what Earth should do instead — tracker
`AsEXOfJUUS0bKdErKeZW`, quoted in §1.4: *let the player manipulate the performance
parameters.* Earth is the one room where that verb is also the curriculum, because
the three loops differ **only** in prop rotation. The verb in §1.4 (turn one hand's
rotation; G becomes I) is buildable from three sequences the room already owns and
has already fingerprinted.

Two further notes:

- Earth has **no state module**. Fire has `first-fire-procession-state.ts` with
  monotonic transitions, idempotent overlapping triggers, session persistence and
  its own test file, plus an explicit warning: *"Do not scatter progress booleans
  across geometry, scene, and performer components."* C-004 and C-005 describe
  reveal, retention and acknowledgement with no owner and no tests. That must exist
  before any interaction geometry.
- The traces are classified `metaphor` (manifest C-003). They do not have to be.
  The repo renders prop trails already; generating the wall trace from the bound
  sequence's actual prop-tip path would make it **literal** and would fix a domain
  error in the board at the same time (§Q6).

### Q5 — Are the sightline and FOV proofs sufficient for free walking and real avatars/props?

**The FOV proof is sound and is a genuine improvement. The sightline proof is not
sufficient, and its headline number is undefined rather than wrong.**

**What is right, and credit where due.**
`EARTH_LONG_TERRACE_CAMERA_VERTICAL_FOV = 75` matches `fovFirstPerson: 75` in
`packages/camera-3d/src/lib/types.ts`, which Three.js treats as vertical. The
derived horizontal 107.51 deg at 16:9 is correct. `isEarthLongTerraceBodyInsideFinalFrame`
tests yaw **and** foot pitch **and** head pitch — a real vertical framing check,
which the Root Observatory never had. The sampling method is also right in
principle: `earthLongTerraceViewingSamples` walks the ribbon 0.2 m along *and
across*, 962 positions, 2 886 rays, all aimed at the stage floor rather than a
torso. That method should be lifted into the gate contract.

**Blind spots, in severity order.**

1. **The occluder is undefined, and one reading hides the performers completely.**
   The plan declares `publicTerrace` as z 13.6 → 22.8 (186.8 m², drawn on the board
   as a filled terrace plate) **and** `terraceViewEdge` as a line at z 18 whose
   elevation equals the terrace elevation. Those cannot both be true: a floor edge
   at the same height as the floor on both sides is not an occluder. The proof
   samples z 18 and reports +0.42 m. At the *drawn* north edge (z 13.6) the same
   formula gives:

   ```
   visitor z 19.4   S/L = 0.586   budget 0.314   ->  ray 1.43 m below the floor line
   visitor z 20.6   S/L = 0.631   budget 0.314
   visitor z 22.8   S/L = 0.692   budget 0.314
   ```

   and from stop 3 the lowest visible elevation at the performer plane is **-1.77 m**
   while G's head is at **-2.45 m** — the performer is **entirely hidden, by 0.68 m.**
   The proof samples 4.4 m short of the plan's own drawn floor edge.
2. **The proven area is 18.6 % of the declared floor.** Ribbon 34.8 m²;
   `publicTerrace` 186.8 m². Free walking is the condition that killed Gate 1.1
   (`s278g83rbcQybhjZnIfO`: *"remain fully readable while the visitor is moving"*),
   and it is the condition still excluded. Beyond visitor z 21.9 the feet go
   negative even on the z-18 reading.
3. **No fall protection, and none is affordable.** The plan has no parapet, rail or
   kerb beside a 3.6 m drop 1.4 m from the walking line, whose north edge sits
   0.2 m from the drop. Adding one breaks the proof: at the ribbon's back edge a
   0.45 m kerb gives **-0.03 m** and the live room's own `PARAPET_HEIGHT = 0.9`
   gives **-0.48 m**. The candidate's clearance budget is one third of the live
   room's slab-lip budget, and the cause is the flattened drop (Law 1).
4. **The route intersects its own occluder** (Q3): 13.5 % of the 2.4 m band touches
   the reveal-blocker rect, and `isEarthLongTerraceSightlineBlocked` returns
   `true` for any eye inside that rect — so an invalid standing position is scored
   as "concealed" rather than as a collision error.
5. **Habitat masses are excluded from the occlusion test** (Q3).
6. **Legibility is measured on the wrong subject.** Everything is body height.
   Nothing measures the prop-trace envelope, which is what the room exists to make
   readable, and nothing measures foreshortening (Law 2). At the near stand the
   bodies are 140–158 px tall at 1080p; the traces are squashed to 0.75.
7. **Accessibility.** Grade and width pass (2.4 m, ≤ 6.00 %, no landings needed at
   ≤ 0.35 m rise per run). Cross-slope is undeclared; the unguarded drop-edge
   proximity is the real failure; and the 147 deg hairpin at the climax is a poor
   wheelchair turn on a 2.4 m band.
8. **Collision clearance for real avatars.** 0.7 m between 2.8 m stages with both
   hands on a full circle at beta; `MuseumPerformerStation3D` exists and
   `standingSurfaceHeight`/`showPlatform` are already extended for this family, but
   the prop envelope is never checked against the neighbour's stage.
9. **Tests assert the numbers the plan chose to expose.** All 9 pass;
   `expect(centreSpacing).toBe(3.5)` pins a coordinate without testing whether 3.5
   is good, and `earthLongTerraceMinimumFloorMargin` can only be as honest as
   `terraceViewEdge`, which is the undefined field.

### Q6 — Does the board communicate what the player sees and feels at A, B, C, G, H, I, the ensemble and Air? Is the vertical section useful?

**The plan panel is good. The section is not useful. The eye-level panel contains a
false claim. Two panels have layout defects.** All observed at the board's native
2200x1500 and on the review route.

**Panel 1, top-down plan — genuinely good.** Numbered route with arrows, doors
labelled FROM FIRE / TO AIR, 5 m scale bar, north arrow, hero-order legend,
interaction zones as dashed circles, sightline fans from the reveal and the stand,
per-performer motif glyphs on the stages, habitat masses labelled. This reads
without prose, which is the visual-bridge standard. Two gaps: **the occluder the
entire proof depends on (`terraceViewEdge`, z 18) is not drawn anywhere**, and the
ceiling is never mentioned.

**Panel 2, vertical section — fails its own requirement.** About 85 % empty black.
No ceiling (Gate 1 requires it; the live room's is +3.6). No canyon: the generator
draws the shelves at y 524 / 576 / 642 while the panel spans y 104–514, so all four
shelves are drawn **outside the panel**, and the review page's crop (`viewBox
"1370 96 800 430"`) discards them too. The label *"shelves continue to -25 m"*
therefore floats beside nothing, in both artifacts. No trace wall, no aperture, no
parapet. And there is no horizontal scale: the three performers are drawn 155 px
apart at a vertical scale of 11 px/m, so their 3.5 m spacing is rendered ~4x too
wide, with G apparently standing on the cliff line while H and I float on discs
over nothing.

**Panel 3, eye-level compositions — one false claim.** The frame titled
`STOP 2 · DAYLIGHT REVEAL` is labelled `G 8.5° H 8.5° I 8.5°`. Those are
`comparisonSizes`, computed in the generator as performer *i* seen from
`plan.stops[i+2]` — i.e. **stops 3, 4 and 5**. The true values at stop 2 are
**7.18 / 6.23 / 5.37 deg**. The board overstates the reveal by 18–58 % per
performer and asserts three equal sizes where they differ by 34 %. The figures in
both frames are drawn at hardcoded scale factors (`[0.62,0.62,0.62]` and
`[0.79,0.88,0.90]`), not derived — so the reveal frame draws three equal-sized
bodies that are not equal. The two frames also look nearly identical, which is
accidentally the most honest thing on the board about the climax.

**Panel 4, performance → environment — layout broken.** The three cards
(`y 852`, height 154) are drawn over the panel's own heading at `y 882`, so
`4 · PERFORMANCE → ENVIRONMENT` is unreadable behind card 1; card text overflows
its box into the neighbour and past the panel edge (card 3's line is cut at
"…legible inside one shared").

**Panel 4 also carries a domain error.** The motifs draw G as two rings side by
side (`ringPath(x-9)`, `ringPath(x+9)`) and I as a ring beside a petal
(`ringPath(x-7)`, `petalPath(x+7)`). Both hands are at **beta** — the same grid
point — so the two props are co-located and their traces are concentric or
overlapping, never side by side. The board draws the two props in different places
in the room whose entire subject is that they are in the same place. I's real image
— one ring and one flower drawn on top of each other by one performer — is the
strongest picture available and the board gives it away.

**Panel 5, route storyboard — good.** Seven cards, FIRST FOCUS / EXPERIENCE / ROOM
RESPONSE, arrows between, and the canon-reconciliation banner honestly flagged in
warning colour. It answers "what happens in order" without prose. The review page
mirrors it and adds a "Decision needed" aside, which is the right way to surface an
open interpretation.

**Review route.** Renders at 1920 with zero console errors, four 439x181 metric
cards, plan crop at 1791x1248, two proof crops at 887 px. Clean and readable. Its
one substantive flaw is inherited: the section crop shows a section with nothing in
it.

### Q7 — What would a AAA environment team demand before Gate 1 approval?

1. **One declared walkable surface, with roles.** A polygon (or polygon set) with
   an elevation per region, split into a **viewing band** (100 % of it must satisfy
   every sightline requirement) and **circulation** (explicitly not a viewing
   position). No second rect named `publicTerrace` whose relationship to the proof
   is unstated.
2. **All occluders as geometry in the contract**, with elevations and heights:
   floor edges, kerbs, guards, screens, the reveal blocker, and the habitat masses.
   Then the sightline check takes the **maximum** over all of them instead of one
   hardcoded z. Sampling parameters live in the check, never in the artifact under
   test.
3. **A fall-protection decision made before the sightline proof, not after.** State
   the guard height, then prove the sightline with it in place.
4. **A subject-legibility proof, not a body-height proof.** Minimum apparent
   angular size of the *prop-trace envelope* plus the foreshortening factor, at
   every named camera and at every point of the viewing band.
5. **First-person frames generated from the plan contract at Gate 1.** Not stick
   figures at hand-picked scales — a crude WebGL fly-through from the same
   contract, at the runtime's real 75 deg vertical FOV. Every fault in this review
   and in the Root Observatory review was visible in the first eye-level frame.
6. **A lighting intent with geometry.** Where the aperture is, how big, whether it
   is in frame, and the light hierarchy (performers brightest). "Cool daylight" is
   not a spec.
7. **A vertical section that passes through the final camera and every named
   reveal**, at a declared and equal horizontal and vertical scale, showing the
   ceiling, the aperture, the barrier, the drop, the shelves and the trace surface.
8. **A state module with tests before interaction geometry**, modelled on
   `first-fire-procession-state.ts`.
9. **A one-page room brief above Gate 1**: what this room teaches, how it differs
   from both neighbours, what each adjacent approved design requires of it, and
   whether the shell is a given or a derivation. Earth has now failed twice
   *upstream* of Gate 1, and no amount of Gate 1 rigour catches that.
10. **Every declared conflict actually declared.** The drop changed by 2.25 m and
    the open-north canyon was closed; the ledger says "None."
11. **One claim ledger per scene.** The contract carries C-001…C-006 and the
    manifest C-001…C-005, offset by one, with C-003 meaning different things in each.
    The skill's own authority table forbids this, and it is the second scene in a
    row to do it.
12. **No metric on the board that is not computed at the point it labels.**

### Q8 — The replacement concept

See §7 for the full specification with verified geometry.

### Q9 — Verdict and punch list

See §5 and §6.

---

## 3. Domain audit

Every literal claim I re-checked holds, and the domain work is again the strongest
part of the package.

| Claim | Class as filed | Verdict |
| --- | --- | --- |
| Contract C-001 / manifest C-001: G, H, I are Together Same, together timing, same hand path | literal | **Correct.** MCP puts all three in the Together-Same group (GHI); the catalog gives all three `handPathId: "s→w→n→e→s\|s→w→n→e→s"`, `familyId: tog-same`, `startPosition: beta5`, 4 steps, `isCircular: true`, `turns: 0` throughout. |
| C-002: G pro/pro, H anti/anti, I blue anti + red pro | literal | **Correct.** MCP: G blue pro cw / red pro cw; H blue anti ccw / red anti ccw; I blue anti ccw / red pro cw. Catalog agrees on all four steps. |
| Contract C-003: I carries H's blue behavior and G's red behavior | literal | **Correct, and stronger than filed.** In `museum-exhibit-sequences.ts` I's blue column is byte-identical to H's and its red column byte-identical to G's, orientations included. `compare_letters(G, I)` confirms. This should be the room's centrepiece. |
| Manifest C-003 / contract C-004: the wall translates G→twin rings, H→paired petals, I→both | metaphor | **Correctly classified, wrongly drawn.** Pro at 0 turns is isolation (MCP: "the visual effect of a fixed point"), anti is "petal-like patterns" — so ring / petal vocabulary is sound. But both hands are at beta, so the traces are co-located, not side by side (§Q6). Could be promoted to `literal` by generating the trace from the bound sequence's prop-tip path. |
| C-004/C-005 (manifest): proximity reveal, retention, brightening | invention | Correctly classified. No owner, no tests, no vertical geometry (§Q4). |

Two accuracy defects:

- **Gate 0 mis-states its own selected step.** The contract says *"The selected
  first step for all three travels beta 3 to beta 5."* That is MCP variation **0**
  of the letters. The selected museum sequences open with a `β` static step at
  beta5 and their first motion step travels **beta5 → beta7** (variation 1). The
  motion proof cites a variation the room does not use.
- **`motion-proof` is a JSON report, not a loop capture.** `visual-bridge.md`:
  *"Capture continuous motion as a loop. A still frame cannot prove timing."*
  Better than the Root Observatory's board SVG, still not a capture.

Fingerprints and digests are clean: the three catalog fingerprints in the manifest
match those in the report, the catalog `sourceSha256` matches, the board and plan
digests are recorded, and `validate-scene-gates.mjs` passes on the manifest and on
its own self-test.

---

## 4. What must survive the rebuild

The candidate is a real advance on the Root Observatory in eight specific ways.
Reject does not mean start over.

1. **The one-clock insight.** Synchronizing three body-identical loops so that only
   the props differ. This is the room's best idea and it is verified from data.
2. **Full-legal-width sampling aimed at the stage floor.**
   `earthLongTerraceViewingSamples` (0.2 m along **and** across) and
   `earthLongTerraceFloorSightlineMargin` are the right shape. Promote the method
   into `gate-contracts.md`; fix what it samples.
3. **A real vertical framing check.** `isEarthLongTerraceBodyInsideFinalFrame`
   tests yaw, foot pitch and head pitch. The Root Observatory had bearings only.
4. **The correct camera model.** 75 deg **vertical**, matching `fovFirstPerson`,
   with the horizontal derived. The previous candidate composed for the wrong frame.
5. **Overlapping interaction zones with a proven negative gap**, plus a test.
6. **No competing hero object.** Removing the tree was right.
7. **A generated board and report from the plan contract**, with digests — and a
   review route that renders the plan live with zero console errors.
8. **Forward exit, no long out-and-back.** 15.6 % detour versus 28 %.

Plus the inherited architecture: plan-contract-as-code with no absolute world
positions, room-shell consumption through `interiorWorldRect`/`doorSpan`, and
composition of `MuseumPerformerStation3D` rather than a fork.

---

## 5. Punch list

### Blockers — Gate 1 cannot pass with any of these open

| # | Blocker | Fix |
| --- | --- | --- |
| **B1** | **The walkable surface and its occluding edge are undefined.** `publicTerrace` (186.8 m², drawn as floor) and `terraceViewEdge` (z 18, at floor elevation) contradict each other. Under the drawn floor the performers are **entirely hidden by 0.68 m** from stop 3. The proof covers 18.6 % of the declared floor. | Declare one walkable polygon set with per-region elevations and a `viewing`/`circulation` role. Declare every occluder as geometry with a height. Make the check take the max over all occluders. |
| **B2** | **The board states a false metric.** `STOP 2 · DAYLIGHT REVEAL` is labelled 8.5/8.5/8.5 deg; the true values are 7.18/6.23/5.37. Figure scales are hardcoded, not derived. | Compute every label at the viewpoint it names. Derive drawn scale from apparent angle. |
| **B3** | **Stops 3, 4 and 5 are one frame repeated.** 8.47 deg at all three; bearings mirror; 14.5 m (31 % of the route) with no new composition. | Structural: the route cannot run parallel to the row at constant distance. §7. |
| **B4** | **The climax has no new image.** +2.5 deg of size on a subject visible since stop 2; horizon 1.59 deg below frame top, so hero #2 is 2 % of the frame; a 147 deg hairpin outside every interaction zone. | Structural. §7. |
| **B5** | **The room's governing metric is never measured.** No prop-trace envelope, no foreshortening. The climax is the worst foreshortening in the room (0.75). | Add both to the plan module, the report and the tests (Law 2). |
| **B6** | **Undeclared canon conflicts filed as "None."** Live drop `RIM_Y → BOSS_Y` = 5.85 m becomes 3.6 m; live `north: EMPTY_WALL` ("the canyon is open north") is closed by `traceWall`; `AVEN_RADIUS` daylight source dropped while the daylight promise is kept. | Record each as a conflict with a tracker item and an accepted rationale, or restore the live value. |
| **B7** | **The route passes through its own occluder.** 13.5 % of the 2.4 m band is inside the reveal-blocker rect, which is 0.5 m deeper than the root mass justifying it. | Model the bluff once, as one mass, used for both occlusion and collision. |
| **B8** | **No fall protection is possible under this geometry.** 0.45 m kerb → -0.03 m; the live 0.9 m parapet → -0.48 m, beside a 3.6 m drop 1.4 m from the walking line. | Decide the barrier first, then prove the sightline with it (Law 1). Transparent barriers cost nothing. |
| **B9** | **No state owner for C-004/C-005.** Reveal, retention and acknowledgement have no module and no tests; Fire's warning about scattered booleans is explicit. | An `earth-*-state.ts` with monotonic, idempotent, session-persisted transitions and its own test file, before interaction geometry. |

### Improvements — should land, do not individually block

| # | Item |
| --- | --- |
| I1 | Adopt `BOSS_SPACING = 4.0`; 0.7 m between 2.8 m stages is too tight for props on a full hand circle. |
| I2 | Fix the vertical section: draw inside its panel, declare and equalise both scales, and include the ceiling, the aperture, the barrier, the drop, the shelves and the trace surface, through the final camera. |
| I3 | Fix panel 4: the heading is drawn under the cards and card text overflows. |
| I4 | Redraw the motifs as co-located traces; make I's overlaid ring-and-flower the board's centrepiece. |
| I5 | Give `traceWall` an elevation, a height and a facing, and place the canyon shelves — outside the interior rect, as the live room does. |
| I6 | Include habitat masses in the occlusion test. |
| I7 | One claim ledger per scene; the manifest owns it, the contract renders it. |
| I8 | Correct Gate 0's first-step claim to beta5 → beta7 (the variation actually bound). |
| I9 | Make `motion-proof` a loop capture. |
| I10 | Replace the proximity trigger with the authored verb in §1.4 (sequence swap among G/I/H). |
| I11 | Promote the trace claim from `metaphor` to `literal` by generating it from the bound sequence's prop-tip path. |
| I12 | Add cross-slope and a turning-circle note for the climax stand. |

---

## 6. Where I disagree with the earlier Opus review

The 2026-08-08 Opus review proposed the Long Terrace, and its central argument was
that the comparison must be **simultaneous** to be a controlled experiment: *"a
visitor who sees all three at once, in sync, side by side, learns the entire lesson
in one glance."* Codex implemented that faithfully. I now think it is half right and
that the half that is wrong is what produced B3 and B4.

**What the experiment is actually controlled by is the identity of the loops, not
the simultaneity of the viewing.** Because the three sequences are byte-identical
except for prop rotation, a visitor who sees them one at a time in three
identically-framed openings performs the same controlled comparison in memory — and
gets each read at roughly twice the apparent size and at a far better viewing
angle, because a single subject can be met close and near-frontally while a trio
cannot. Simultaneity is worth exactly one frame, at the end, where canon already
puts it.

That earlier review was also right about three things that this review reaffirms:
the tree was a competing hero; the room's hero is the performers, not the
environment; and the canyon is a load-bearing dependency of Fire's locked design.
It was wrong to treat the live room's 5.85 m drop as an asset — measured against
Law 2 it is the worst viewing angle in the building for this room's subject.

---

## 7. Replacement concept: **Earth — The Sunlit Shelf**

An Opus proposal, not a decision. Every number below was verified in this session;
the one open decision is named in §7.5 rather than papered over.

### 7.1 The one-sentence room

> Out of Fire's blackout into a dark root gallery, where daylight spills through
> the first opening in a rock threshold; three times the visitor stops at an
> opening and meets one performer alone, close, sunlit, and almost face-on, with
> the same two props travelling as one; then the threshold ends and all three
> resolve together at the same distance, with the canyon falling away behind them
> into haze — and Air waits ahead.

Hero order unchanged and now all four are in the final frame: **the row**, then the
**daylight canyon**, then the **traces**, then the **habitat**.

### 7.2 The three governing results

Verified numerically this session:

1. **Drop ≈ 1.0 m, not 3.6 or 5.85.** Foreshortening 0.92–0.94 instead of
   0.75/0.50, and the occlusion budget triples to 0.623 (Law 1, Law 2).
2. **Occluding edge at the visitor's feet, ground falling away beyond it, and a
   transparent barrier.** A 1.0 m vertical step set 1.0 m out fails at -0.576 m
   over the same gallery; the same drop as a scarp starting at the lip proves a
   **3.4 m** band. An opaque rail costs ~1 m of proven depth per 0.2 m of height,
   which is why the barrier must be glazing — canon already has "glass-walled
   exhibits" in this wing.
3. **The ensemble row on an arc centred on the ensemble viewpoint.** All three
   exactly equidistant, so all three are the same apparent size, and the frame has
   room left over for the canyon.

### 7.3 Measured geometry (local room coordinates: x east, z south, `minZ` = north; 34 x 24 m shell, ceiling +3.6, gully ceiling +2.6, west door z 11–13, south door x 31.5–33.5, both at datum 0)

**Bands, north to south**

| Band | z | Elevation | Walkable |
| --- | --- | --- | --- |
| Canyon lip | 0.0 – 0.9 | -1.3, falling away north | no (blocked) |
| **Sunlit shelf** (performers) | 0.9 – 7.1 | **-1.3** | no (blocked, never walked) |
| **Scarp** (the "no way down") | 7.1 – 8.1 | -0.3 → -1.3, ~45 deg, falling away from the lip | no |
| **Gallery — proven viewing band** | 8.1 – 11.5 | **-0.3** | yes |
| Circulation / arrival / exit | 11.5 – 14.4 | -0.3 | yes, declared **circulation** |

Reuse without re-deriving: `EARTH_CEILING_Y = 3.6`, `GULLY_CEILING_Y = 2.6`,
`CANYON_SHELF_Y = [-10.5, -14.5, -19.0, -25.0]` (rendered **north of the interior
rect**, as the live room already does), `AVEN_RADIUS`-class roof opening,
`BOSS_SPACING = 4.0`-class spacing.

**The row — arc of radius 7.5 m centred on the ensemble stand at `(20.0, 12.0)`,
bearings -33 / 0 / +33 deg, all on the shelf at -1.3, all facing the stand**

| | position | distance to stand | stage disc | gap to neighbour |
| --- | --- | --- | --- | --- |
| G | **(15.92, 5.71)** | 7.497 m | r 1.4 | 1.46 m |
| H | **(20.00, 4.50)** | 7.500 m | r 1.4 | 1.46 m |
| I | **(24.08, 5.71)** | 7.497 m | r 1.4 | — |

Chord G→H = H→I = **4.26 m** (so 1.46 m of clear air between stage rims, twice the
Long Terrace's 0.7 m).

**Ensemble frame, from `(20.0, 12.0)` at eye -0.3 + 1.65 = 1.35**

```
apparent body height        12.62 deg for all three, identical by construction
                            = 182 px at 1080p, 363 px at 2160p
horizontal                  outer stage edge at 43.6 deg vs half-FOV 53.8 deg -> 10.2 deg margin
camera aimed at chest       pitch -13.1 deg
horizon                     24.4 deg below the top of frame
                            -> the top 32 % of the final frame is canyon, haze and daylight
foreshortening              cos 19.5 deg = 0.94  (near face-on)
```

Compare the Long Terrace's climax: 9.70 / 10.91 / 10.99 deg, foreshortening 0.75,
and **1.6 deg** of horizon (2 % of frame).

**Sightline proof, occluder at the gallery lip (z 8.1, y -0.3), scarp beyond**

```
visitor z   G      H      I
   9.0    +0.93  +1.12  +0.93
  10.5    +0.32  +0.59  +0.32
  11.5    +0.09  +0.35  +0.09      <- back edge of the proven band
  12.0    +0.01  +0.27  +0.01
  14.4    -0.27  -0.04  -0.27      <- circulation only, declared not a viewing position
```

Proven viewing band **z 8.1 – 11.5, worst floor margin +0.09 m**; recommend
declaring **8.1 – 11.0** for a **+0.20 m** budget, with 11.0 – 14.4 as circulation.
Sensitivity, so the guard decision is made with numbers: proven depth is 3.94 m
glazed, 2.89 m with a 0.2 m kerb, 1.98 m with 0.45 m, 0.94 m with 0.9 m.

**The threshold and its openings — a root-and-boulder screen, z 8.1 – 10.7 (2.6 m
deep), base -0.3, top +1.8, glazed flush at its south face so the visitor cannot
enter an embrasure**

Three openings, 2.4 m wide, centred on x = 15.92 / 20.00 / 24.08 (each on its
performer's radius). Isolation verified from every legal eye position:

```
embrasure cone half-angle   atan(1.2 / 2.6) = 24.8 deg
window G   neighbours at 33.3 deg (H) and 58.6 deg (I)   -> isolated by 8.5 deg
window H   neighbours at 39.3 deg (G) and 39.3 deg (I)   -> isolated by 14.5 deg
window I   neighbours at 33.3 deg (H) and 58.6 deg (G)   -> isolated by 8.5 deg
```

So each opening shows exactly one performer, to every visitor, everywhere in the
gallery — no sampling, no favourable stops. "Sequential close encounters" becomes a
property of the architecture rather than a claim about the route.

**Daylight.** A slot aven in the roof at +3.6, spanning the row plus ~2 m either
side in x and z ≈ -1.0 → 6.0, so its south rim is ~2 m north of the lip. The
gallery stays under solid roof (3.3 m of headroom) and the shelf is fully lit.
Performers brightest, visitor in shadow, aperture in frame at the reveal. Derive
the shaft radius the way the live room does; do not let the column wall land in the
visitor's near plane.

**Traces.** The far canyon face north of the shelf, top at about -1.3 and falling,
2.0–6.0 m behind the row — so the traces sit **behind and around** each performer
rather than below them in a pit, and are in frame at both the close reads and the
ensemble. Generate each trace from the bound sequence's prop-tip path so the claim
is `literal`, and draw G's two traces concentric (both hands at beta), H's as one
four-lobed figure, and I's as a ring and a flower **overlaid in the same place** —
the room's single best image.

### 7.4 Route and beats

| # | Position and action | First focus | Room response | Cue forward |
| --- | --- | --- | --- | --- |
| 1 | Cross from Fire into a dark root gully | A blade of daylight on the floor from the first embrasure | Fire's heat, orange and ceiling pressure fall away | The light comes from the right, ahead |
| 2 | Step in front of opening G | **G alone**, sunlit, 6–7 m, near face-on: two props travelling as one, both drawing rings | The canyon face behind G takes G's trace and keeps it | The gallery continues east |
| 3 | **Verb at G** — turn one hand's rotation | G's blue prop opens into a flower while red keeps its ring: **G has become I** | The retained trace forks | The next opening |
| 4 | Step in front of opening H | **H alone**: the same two props, both drawing flowers | H's trace joins the wall | — |
| 5 | **Verb at H** — turn the other hand | H's red prop closes into a ring: **H has become I from the other side** | — | The threshold is ending |
| 6 | Step in front of opening I | **I alone**: one ring and one flower, in the same place, at the same instant, from one performer | The wall now holds all three | The threshold ends ahead |
| 7 | **The threshold ends. Step back and centre.** | **All three at once**, all at 7.5 m, all the same size — one body, three prop relationships — and behind them the canyon falling to -25 m into haze and daylight | The three retained traces settle together on the wall | A rising slot to the south-east |
| 8 | Cross the south-east threshold | The shaft | Ground drops away; updraft | Air |

The verb at beats 3 and 5 is a bound-sequence swap among assets the room already
owns (§1.4). If Austen rejects the verb, the room still teaches — the openings and
the ensemble carry it — which is the degrade-safe property the Long Terrace's
proximity chain lacks.

### 7.5 The one open decision, named rather than hidden

An **equidistant** ensemble read requires the viewpoint at the arc's centre, which
is **behind the middle opening**. The Fire door is fixed on the west wall and the
Air door in the south-east corner. Those three facts are in tension, and it is the
tension that produced both failed candidates. The three resolutions, with measured
costs:

| Option | Ensemble read | Route cost | Notes |
| --- | --- | --- | --- |
| **A. Screen ends east of the arc centre; visitor steps back and south ~2 paces onto the stand** *(recommended)* | **equidistant, 12.62 deg, 32 % canyon in frame** | one 4–5 m move, ~99 deg turn, no segment retraced, exit continues south-east | "Step back and the whole thing resolves" is a real museum gesture and reads as authored |
| B. Stand at the gallery's east end, screen runs to it | uneven, ~1.9 : 1 in distance | none | reproduces the Long Terrace's oblique climax at smaller scale |
| C. Widen the middle opening into a collapsed bay and view from its throat | narrows, not widens — an aperture always crops | none | verified not to work: stepping back through an opening reduces the cone to ±21 deg |

Recommend **A**, and note that the two-pace step back is a *feature*: it is the one
moment in the room where the visitor moves away from the subject and gets more.

### 7.6 What this concept keeps from the Long Terrace

The one clock; the daylight-after-blackout reset; the row; no competing hero
object; the forward exit; full-width floor-aimed sampling; the vertical framing
check; the 75 deg vertical camera; overlapping activation; plan-contract-as-code
with a generated board and report; and the review route. The container, the drop,
the barrier, the ensemble geometry and the verb change.

---

## 8. Recommended next step

Do **not** re-cut this plan's numbers. Write a one-page Earth brief first — what
the room teaches (Together-Same unison, and I as G's red plus H's blue), how it
differs from Fire (isolated *views*, not isolated habitats) and from Air
(sequential then simultaneous, not simultaneous throughout), what Fire's locked
design requires of it (the canyon reveal, twice named), what the live shell already
provides (`earth-canyon-layout.ts`: aven, parapet cap, slab-nose fall-away,
shelves, 4.0 m spacing), and which live values are being changed with a tracker
item for each. Then produce Gate 1 geometry against the two laws in §1.3, with a
crude first-person fly-through generated from the plan contract in the same pass.

Earth has now spent two full Gate 1 cycles proving ray clearances at chosen sample
points while nobody wrote down what the room is for. The geometry is not the hard
part; the brief is.

---

**Verdict: REJECT at Gate 1.** Keep the one-clock insight, the daylight, the row,
and all of the infrastructure listed in §4. Replace the container.

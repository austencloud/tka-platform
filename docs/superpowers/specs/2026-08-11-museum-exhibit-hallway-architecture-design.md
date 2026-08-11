# Museum Exhibit-Hallway Architecture — Bird's-Eye Design

**Date:** 2026-08-11
**Status:** APPROVED (Austen, 2026-08-11 — "It's good. I like it. Let's seal it in.")
**Tracker session:** `EyuCr7HhHcglvFn06nfG` (all decisions below are captured there)
**Supersedes:** the six walk-through mode-room grammar; `fsJqYPYk` (three
performers on one stage per room); both Earth Gate 1 floor plans as drawn;
the drowned-gallery gate ledger (already `rejected`, now retired)

---

## Diagnosis (why the rooms went scattershot)

Six rooms were dispatched to six independent agents. Each drew geometry before
anyone wrote down what the room teaches, so every rejection (three-channels,
the traverse's drive-by performers, the grotto) traces to an organizing
principle that was never stated — and no probe could check it. Four rooms
hand-rolled four different review pages, so rooms were never even looked at
the same way. The deepest drift: the museum's original notion — you are HERE,
the performers are THERE, beyond a barrier, encased — was abandoned for
walk-through immersion. Tracker `VyGMg2dc` (chambers are exhibit-scale gated
habitats; the visitor stays on the public side of a threshold) had already
decided this and the builds ignored it.

## The architecture

### The structure: 19 exhibits, 6 wings, one walk

The six wings are the six timing/direction modes (MCP `elemental-model`,
verified 2026-08-11). One exhibit case per TnD base word
(`static/data/hero/tnd-base-words.json`; leader/follower reversals collapse —
PM = MP, same word):

| Wing | TnD class (labeled) | Element (felt, never labeled) | Cases |
|---|---|---|---|
| 1 | SPLIT-SAME | Water | A, B, C |
| 2 | SPLIT-OPPOSITE | Fire | JD, KE, LF |
| 3 | TOGETHER-SAME | Earth | G, H, I |
| 4 | TOGETHER-OPPOSITE | Air | DJ, EK, FL |
| 5 | QUARTER-SAME | Sun | S, T, U, V |
| 6 | QUARTER-OPPOSITE | Moon | MP, NQ, OR |

Fire/Air compound assignment is grid-mode dependent (diamond vs box permutes
opposite-direction elements); the catalog rows are the variation authority.
Walk order remains Water → Fire → Earth → Air → Sun → Moon
(`vulcan-cave-floor-plan.ts`), giving three timing pairs, each a same-direction
wing followed by its opposite-direction twin. Twins share an architectural
family; the direction flip is expressed as mirroring (opposite-direction wings
carry a mirror axis).

### The three rules (the "one architect" feel)

1. **The barrier is elemental.** The binding rule is *you never share floor
   with a performer*. Each wing enforces it in its own element's medium:
   Water separates by still water, Earth by elevation, Air by a void crossed
   on bridges, Fire by heat and shrine gates, Sun by a light shaft, Moon by
   literal sealed glass (no air out there). One rule, six expressions.
2. **Museum-ness lives in the furniture, not the walls.** Order-built brass
   rails, numbered cases, specimen plates, filing stamps, rope stanchions and
   institutional fixtures bolted into vast natural environments. House on the
   Rock model; the story bible's own "cavernous tunnels, glass-walled
   exhibits, dim torchlight." The Bureau labeled everything, even the abyss.
3. **Spectacle belongs to circulation; exhibits belong to stations.** Each
   wing gets ONE signature spatial move in the visitor's own path, then its
   solo exhibit stations viewed across the barrier. Known signature moves,
   salvaged from the room era: Water = the dive-through passage arriving at
   the mirror-pool parapet; Earth = the elevated terrace climb above the
   performers. Fire/Air/Sun/Moon signature moves are chosen at wing design
   time — each must be stated in one sentence before geometry.

### Labels

The elemental associations are never spoken. The Order stamps every wing
threshold and specimen plate with its clinical TnD classification
(SPLIT-SAME … QUARTER-OPPOSITE). Story bible updated 2026-08-11.

### The wing grammar (every wing, same beats)

1. **Threshold** — classification stamp + the seam handoff from the previous
   wing (canonical example: Fire's extinction → green growth → Earth).
2. **Opener station** — the mode's zero-turn hand path floating in space:
   a normal performer station with avatar and props set invisible and the
   trail effect on, element-colored. The Bureau isolated the motion from the
   host; the specimen is the path itself. Water's opener stages dual-wheel
   (`6bfjxuoT`). Plaque carries the class name.
3. **Solo performer cases** — one base word each, unmissable per the
   reverence rule (`JqxXbDud`): circumnavigate, interact, or unavoidable
   framing. Zero-turn variations only — in-fiction, turns have not been
   discovered yet at this point in the record ("first turns at the deepest
   point" is the only sanctioned tease).
4. **Payoff view** — one composed view that reads the wing as a whole
   (Water: the mirror pool doubling everything). Never split-then-reassemble:
   when a layout needs a mechanism to restore what it broke, the layout is
   wrong.
5. **Exit handoff** — the next element announces itself before the door.

### The spectator → participant overlay

The barrier itself is the game's progression. Early wings: hard barriers
(sealed glass, rails). Later wings: softening (open air, low water, a gap you
could almost step over). Endgame: none — the Scribe-room jam where the player
picks up the prop. The room-scale hand-path projection is reserved as a
one-time endgame echo: when the barriers are gone, the path finally fills a
room. The immersive walk-through work is the END of the arc, not the default
grammar. This is the wax-figure thesis ("the Order engineered a way to study
the thing without anyone having to spin") made walkable.

## Process

1. **Teaching statement before geometry.** Gate 0 for every wing requires the
   one-sentence unique observable and the five-beat mapping before any
   layout is drawn.
2. **Lockstep gates — AMENDED 2026-08-11 (Austen: "Yes. Let's do that."):
   vertical slice first, then lockstep.** Water runs ahead as a vertical
   slice: one case driven all the way through — declaration → graybox in the
   shared harness → the sealed case triptych (alcove avatar + screen + choreo
   card, one playback clock) → the choreo-card opener with the propless
   trail avatar. Rationale: the triptych is the highest-risk, highest-value
   element in the whole design and has never been built once; lockstep
   breadth would front-load six grayboxes around an unproven core, and
   agents replicate a proven template far better than they invent under
   ambiguity. Once the Water slice is approved, the remaining five wings
   proceed under the original lockstep rule: no wing passes Gate 2 until all
   five have an approved Gate 1 plan; no wing enters Gate 3 until all
   grayboxes are approved. Depth beyond the slice is only purchased
   museum-wide.
3. **Shared graybox review layer** (absorbed workstream): one runtime
   harness — `GrayboxRoom` inside the Canvas + `GrayboxReviewShell` outside
   it, grey shell default — replaces the four hand-rolled review routes.
   Generators and audits stay per-wing. Next design artifact: the room/wing
   declaration shape the harness consumes, which is also where each wing's
   teaching sentence and five beats are declared (machine-checkable grammar).

## Per-wing game plan

| Wing | Inherits | Next action |
|---|---|---|
| Water | ring-station terrain, dive passage, mirror pool optics | **VERTICAL SLICE (amended 2026-08-11):** re-plan as wing 1 under this spec (passage = signature move, A/B/C as cases across the water, pool = payoff), then drive one case through graybox + triptych + opener in the shared harness before any other wing boards Gate 1. |
| Fire | cinder-court shrine structure (G1 was approved; G2 rejected) | Shrines become cases behind heat/gates; re-board Gate 1 under the wing grammar. Roster transcribed from catalog rows. |
| Earth | terrace-overlook signature move | Both existing Gate 1 boards are superseded as drawn; the overlook survives. New Gate 1 board. |
| Air | nothing (weakest room, zero scene work) | First wing designed FROM the grammar rather than retrofitted. Teaching sentence + Gate 1. |
| Sun | 08-05 mandala spec ideas | Four cases (S,T,U,V) dissolves the old roster conflict. Teaching sentence + Gate 1. |
| Moon | regolith plain | The plain becomes the diorama beyond sealed observation glass — the one wing where literal glass is the most dramatic choice. Gate 1. |

App-background scenes in the same gate ledger (moonlit-firefly-forest,
moonlit-winter-hollow, seraphic-vault/olive-cloudbreak) are outside this
spec's scope.

## Fit within the historical museum

The TnD hallway is the Vulcan Cave wing — chapter one of the story bible's
chronological walk (Cave → Egyptian → Classical/Medieval → Enlightenment →
Victorian → Modern → Scribe rooms → sequential endings → gift shop → jam).
The live floor plan already exits through `egypt-threshold`.

- **Curriculum position:** zero-turn is the cave's place in the record.
  Whole turns, Types 3-6 and LOOPs are canonically discovered in the
  Egyptian wing — the 49-cell turn matrix we withhold here is that wing's
  inheritance. Each historical wing unlocks its slice of the curriculum and
  declares its case roster from a catalog authority, as the cave's 19 come
  from `tnd-base-words.json`.
- **The barrier rule is the museum-wide through-line.** Cave barriers are
  natural media (softest, most reverent). The casing grows institutional
  with history: temple gates, Victorian brass-and-glass vitrines, Modern
  one-way observation glass, peaking at the isolation cubicles (endings
  Room 2), vanishing in Room 3 and the jam. The display furniture itself
  narrates the Order's tightening grip — the spectator → participant arc
  spans the whole museum, not just the cave.
- **Furniture carries the secondary timeline** (wings reflect construction
  decade, per the bible): 1930s Bureau stamps retrofitted onto ancient rock
  in the cave; track lighting and early digital signage on 1990s cases.
- **The grammar repeats per era:** one signature move, solo cases behind the
  era's barrier, period props per canon (torches → staves → fans → clubs →
  LED). The opener slot generalizes: each wing's first station uses the same
  invisible-performer trail tech to show what that era discovered (the cave
  shows a mode's path; Egypt's could show a path turning for the first time;
  later, a LOOP closing on itself).
- **The wing declaration shape is era-agnostic** — teaching sentence, beats,
  cases, barrier type — so future historical wings are new manifests, not
  new architectures.

## Open items

- Signature moves + teaching sentences for Fire, Air, Sun, Moon (gate 0 work).
- Hallway routing: how the six wing segments and their seams lay out in plan
  (the twisting hallway), and how the existing lobby/egypt thresholds attach.
- Barrier-softening schedule across the walk (which wing is the first to
  crack the glass).
- Wing/room declaration shape for the shared review harness (next design).
- Interactive controls at cases (crank/replay) — deferred; optional depth,
  not a gate.

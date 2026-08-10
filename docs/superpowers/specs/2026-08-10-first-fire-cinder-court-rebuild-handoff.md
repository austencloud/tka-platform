# First Fire: The Cinder Court — Rebuild Handoff (2026-08-10)

## Mission

The Cinder Court is the Fire exhibit of the Vulcan Cave museum walk: a visitor
enters from Water, walks a corridor, and orbits three performer courts (DJ, EK,
FL) before a blackout hands off to Earth. It is being produced through the
`museum-scene-production` gate workflow.

**This handoff exists because the work went off the rails, and the previous
agent (me) is the reason.** Austen has rejected the room three times in three
days with escalating specificity, and the third rejection (2026-08-10) was
total: *"I am absolutely livid with you... I actually want you to create a
handoff document and completely forget yourself because everything that's in
your context and your memory must be trash at this point."*

Do not read this doc as a to-do list to resume. Read it as a post-mortem plus a
measured survey of what is actually in the file. **Austen's instruction is to
step back and rebuild the room's spatial and placement logic from the ground
up**, with the individual assets kept and the composition thrown away.

Gate contract: `.claude/skills/museum-scene-production/references/gate-contracts.md`
Scene spec dir: `docs/superpowers/specs/first-fire-cinder-court/`
Gate 3 design: `docs/superpowers/specs/first-fire-cinder-court/2026-08-09-first-fire-gate3-visual-target-design.md`

---

## The core failure (read this before anything else)

**Gate 3 art direction was being applied to a Gate 2 graybox that was never
approved and is structurally broken.**

Austen flagged this himself on 2026-08-08: *"I suspect we're going too fast and
we need to slow down and author this with significantly more intention... are we
just barreling forward and trying to do too much step 10 stuff when we're really
in step three."* That was correct, and I kept dressing anyway. The last five
commits on this scene are all the same act: re-composing the entry hall's
props while the shell under them stayed broken and the three courts stayed empty.

The result Austen walked on 2026-08-10:

- Steps over a "furnace" that is not inlaid into the floor, sits in the walking
  line, and does nothing when you cross it.
- Passes three free-standing torches on the ground at random distances from the
  wall, no arrangement logic.
- Sees the floor/wall seam split open with the void visible through it.
- Falls through the floor into empty space.
- Passes a coal bank floating a foot and a half off the wall.
- Arrives in the actual performer chambers to find them empty.

His summary, which is the design brief for the rebuild:

> "You made all these elements like the lamp and the torch and the coal bed and
> they were wonderful and they looked so pretty in the showroom and then what
> you did is you took every single one of them and you just smushed them all in
> one tiny little area with no aesthetic decision making whatsoever... you
> emptied the whole chamber with the actual performer of any of those elements
> and you fill the very first hall with all of those elements like somebody with
> no restraint."

**The assets are good. The placement system is the defect.** Do not rebuild the
lamp, the torch, the coal wall, or the vent. Rebuild where things go and why.

---

## Done — verified

### 1. Extinguish-on-distance interaction — `c7c60ec6e4`

A finished performer used to go black the frame the orbit completed, while the
visitor was still standing next to them. Now a finished court keeps burning
until the visitor leaves its light, latched so walking back in cannot relight it.

The 14 m threshold is not arbitrary: the court key in `FirstFireEmberDressing`
is a `PointLight` with `distance={14} decay={2}`, so at 14 m it contributes
exactly zero. That is the literal edge of "their light has reached you."

Evidence — runtime query of the DJ flame-anchor lights:

| State | Visitor position | DJ flame lights |
|---|---|---|
| `dj-complete` | in court, ~5 m | 19.21 and 17.09 — burning |
| `ek-active` | at EK, ~25 m from DJ | 0 and 0 — out |

`tests/unit/museum` 46 files / 425 tests passed. `npm run check` EXIT=0,
0 errors / 0 warnings. This one is genuinely sound and Austen has not disputed
it. **Keep it.**

### 2. Trench staging bug — `c7c60ec6e4`

The staging filter asked for `FF_Trench_*_Magma`, a node name the GLB has never
contained, so no trench was ever staged and all three molten channels glowed
from load. Fixed the filter to `FF_Trench_(dj|ek|fl)` and dropped a trailing
underscore in the visibility selectors that never matched.

Evidence: `dj-complete` → `{dj:true, ek:true, fl:false}`; `approach` →
`{dj:true, ek:false, fl:false}`. Confirmed in the running scene. **Keep it.**

### 3. Structural survey of the shell (2026-08-10, this session)

Run in the live scene against `FF_Shell_Rock`. **These three numbers are the
most valuable thing in this document** — they explain every complaint Austen
made, and none of them were known before today.

**(a) All dressing is anchored to a corridor width that does not exist.**

`FirstFireCoalDressing.svelte` places every fitting using
`wallOffset = corridorWidth / 2` = **2.25 m** from the route centreline, taken
from the plan's `pathSections[].width`. Measured against the actual carved
shell at the ember-bridge centreline (-23.5, 0), waist height:

```
plan corridor half-width : 2.25 m
nearest real shell vertex: 3.15 m
                     gap : 0.90 m
```

Every wall-hugging prop floats **0.90 m (~3 ft)** off the rock. Austen
estimated "a foot and a half" by eye; it is twice that. This is a systematic
error, not a per-prop mistake — the plan's nominal corridor and the carved
shell's real wall are two different surfaces and nothing reconciles them.

**(b) The corridor shell is nearly vertex-free at wall height.**

Only **20 vertices** of `FF_Shell_Rock` fall inside a 6 m-radius column at
0.6–2.2 m height around that same point. For comparison,
`gate2/carve-shell-section-measurements.json` records 410 / 641 / 447 wall
vertices for the three courts. The corridor got almost none. A surface that
sparse cannot hold a clean floor/wall seam — that is the split Austen saw the
void through, and it is very likely the fall-through too.

**(c) The torches have no placement logic at all.**

24 `FF_TorchStem_field_*` objects, measured to the nearest shell vertex:

```
closest : 0.42 m  (FF_TorchStem_field_011)
          0.48 m  (field_016)
          0.50 m  (field_010)
farthest : 1.22 m (field_015)
           2.59 m (field_001)  <- the arrival corridor, ~8.5 ft from any wall
```

A 6× spread with no pattern. They are also **stems** — free-standing posts
planted on the floor, not wall brackets. Austen: *"they could be wall torches
they could be put on the side of the cave they could be placed in an
arrangement pattern but no instead one of them shows up 3 feet from the wall
and the other one shows up 6 inches from the wall."* Measured, he is right and
generous.

---

## Believed done — unverified

**Nothing in the Gate 3 dressing pass should be treated as done.** Three
commits (`c7044b02b6`, `179135c392`, `83bd25d105`) each claimed to have fixed
the entry-hall overwhelm. Austen rejected all three. The code compiles, the
tests pass, and the result is wrong — which is exactly the failure mode
`.claude/rules/visual-verification-mandatory.md` was written about, one level
up: I verified my own frames and still shipped a bad room, because I was
judging one camera instead of walking it.

- **`83bd25d105` (2026-08-10, most recent)** — cut the steam plume from 190
  sprites to 17, shrank the quench vent from 3.4×1.3 m to 2.0×0.9, removed one
  of two chain lamps, moved the coal crib to 10.0 m. I screenshotted
  `water-entry` and `ember-bridge` and judged them improved. Austen then walked
  it and the verdict was unchanged. **The frames got better and the room did
  not.** Treat this commit as unproven.
- **The `@` in that commit's subject line** is a stray from a PowerShell
  here-string used in a Bash call. Body is intact. Another session committed on
  top before I noticed, so it was left rather than rewriting shared history.

---

## In flight

Working tree is clean for this scene except one untracked file:

```
?? docs/superpowers/specs/first-fire-cinder-court/gate3/dj-volcano-wip-2026-08-09.webp
```

A WIP frame deliberately left out of earlier commits. Keep or delete; it is not
load-bearing.

All work is on `main` in the primary checkout `E:/tka-platform`. No branch, no
worktree (per `.claude/rules/worktree-workflow.md`, main is where work happens
unless Austen asks otherwise).

---

## Loose ends (ranked)

**#1 — Decide with Austen whether Gate 2 reopens.** This is the real question
and it is his call, not yours. The shell has a 0.90 m mismatch against the plan
corridor, ~20 vertices where it needs a wall, a visible floor/wall seam split,
and a fall-through. Those are Gate 2 geometry defects, and Gate 3 cannot be
made good on top of them. Austen: *"are we just going too far too soon are we
not finished with the graybox are we jumping forward before we even make sure
that the walls all make sense is that the problem here is that what's going
on."* Answer him with the three measurements above, then take his decision.
**Do not start dressing again before this is settled.**

**#2 — Reproduce and locate the fall-through.** Austen fell through the floor
into open space. Colliders live in
`src/routes/test/first-fire-graybox/first-fire-graybox-colliders.ts`. Find
whether the hole is a collider gap or a hole in `FF_Shell_Rock` itself. This is
a hard bug with a reproducible symptom — start here for something concrete.

**#3 — Establish placement rules before placing anything.** The absent artifact
in this whole effort is a written rule for *why a prop sits where it sits*. It
needs at minimum: how a fitting finds the real wall (raycast the shell, never
trust `pathSections[].width`); minimum and maximum standoff; whether torches
are wall-mounted or floor-standing and at what interval; what may sit in the
walking line and what may never. Austen asked for exactly this: *"reasonable
guidelines for where we place things and how we place them and why we place
them."*

**#4 — Rebalance the room's contents.** The corridor holds a vent, a coal bank,
a lamp and a torch lane; the three performer courts hold almost nothing. That
ratio is backwards and Austen named it directly. The chambers are where the
visitor stops and watches; the corridor is where they pass through.

**#5 — Torch identity.** 24 field stems, verifier-locked at 24 by
`scripts/verify-first-fire-graybox-glb.mjs:135`. Changing the count or the
positions is a plan-level change that reopens Gate 1/2 geometry — do not do it
quietly, but do raise it, because their current placement is indefensible.

**#6 — `Cube`.** There is a mesh literally named `Cube` in the GLB. Almost
certainly a Blender default that got exported. Find it or delete it.

**Parked until the room is approved** — do not touch these yet: the two
optimized Meshy props (`cinder-lamp`, `coal-lump-cluster-a`, purchased and
never yet rendered); coal beds emanating heat on the floor; the connecting
thread across all three exhibits; mitring the `FF_Route_*` ribbon slabs
(square-ended per-segment boxes cause a sawtooth in plan view); the pale EK/FL
orbit-band floor.

---

## Decisions already made

Do not re-litigate these.

**Art direction (2026-08-08, verbatim intent):**
- Each room is an independent exhibit, but they need a thread connecting them.
- Room 1 screams VOLCANO/coal, room 2 FIRE, room 3 LIGHTNING. *"Not three rooms
  in a row that look roughly the same and then have different effects applied to
  them."*
- The coal room: hot coals everywhere, walls to do with hot coals, coal beds
  emanating heat and glowing, steam or a furnace blowing out heat — *"just heat
  in general."*
- Lamps with coals falling out of them, hanging from the ceiling, decorating the
  space. Specifically *"some sort of black pyramid shaped thing with a bottom
  section on a black chain that hangs almost like a dungeon from the ceiling to
  mark the way."*
- The Ember scene's textures are the Ember-coal vocabulary — reuse them.

**Process:**
- Gate approvals are Austen's alone. Never stamp one. Praise or curiosity is not
  approval (`museum-scene-production` skill).
- Gate 2 re-approval is still outstanding after the carve remediation
  (`77e3352fac`). It has never been given.
- Ask before spending on the remaining 5 Meshy assets (~150 credits, ~$3).
- Blender-first for scene geometry (`.claude/rules/blender-first-3d-scenes.md`).
- Commit with explicit pathspec only (`.claude/rules/commit-only-your-own-changes.md`).
- Port 5173 is Austen's dev server. Never kill or restart it.

**Rejected approaches — do not retry:**
- Uniform prop sampling ("a fitting every N metres down both walls"). Tried in
  `179135c392`, produced coal packed floor-to-ceiling for sixteen metres.
- Spacing props by plan-view distance. Tried in `c7044b02b6` and `83bd25d105`.
  Leg A is a straight 7 m and the visitor spawns at 2.0 m, so plan distance does
  not separate objects — it stacks them into one sightline. Only the bend
  separates them, and even fixing that did not save the room.
- Multi-agent design fan-outs for visual work. Subagents cannot see the page and
  produce documents, not pixels (`.claude/rules/fable-routing.md` → Workflow
  Cost Discipline). Austen on a prior run: *"the workflow sucked. do it
  yourSELF."*

---

## Gotchas

**Coordinate mapping.** Blender `(x, y, z)` → runtime `(x, z, -y)`. In JS:
`toRuntime = (p) => [p.x, -p.y]`. Getting this wrong silently mirrors the room.

**`?proof=N` drifts.** Proximity auto-advance offsets N, so `proof=2` may land
on a different phase than you expect. Always read the on-screen phase label
before capturing evidence. Locked camera ids: `water-entry, ember-bridge,
dj-threshold, ek-threshold, fl-threshold, blackout, earth-reveal, overview,
plan`, passed as `?camera=<id>`.

**Verification seams on `window`.** `__firstFireScene` is the graybox Group —
walk `.parent` up to reach the render-tree Scene root. `__firstFireMaterialReport`
is also exposed. These are how every measurement in this doc was taken.

**DevTools `emulate` ignores dpr** — use `2112x1188x1` for a 1920×1080 target.
Screenshots always `format:"webp", quality:70`.

**`preview_start` returning `navOk: true` does not mean a tab is on Austen's
screen.** I trusted it and handed him a link to a blank pane. `tabs_context`
reported no preview open at all a minute later. Verify the pane with
`get_page_text` before telling him to go look, and note that `computer
screenshot` fails with *"the Browser pane is not displayed"* whenever the pane
is backgrounded — that is not a page error.

**Dev servers.** Austen's is 5173 (untouchable). Agent servers were live on
5174 and 5175 during this session; reuse one rather than spawning a third
(`.claude/rules/resource-budget.md`). All localhost URLs must be `https://` —
vite serves HTTP/2 and `http://` returns ERR_EMPTY_RESPONSE.

**Bash vs PowerShell here-strings.** `@'...'@` is PowerShell. Using it in the
Bash tool leaks `@` into your commit subject. Use a heredoc in Bash.

**The emitter drifts past `spawnRadius`.** `EmberFountains` measured ~3 m across
for a 0.77 m configured radius. Any particle station a visitor stands near must
be budgeted for the close-up view, not for how it reads in a wide shot.

**Do not trust my aesthetic judgments in the git history.** Several commit
messages in this scene argue confidently for compositions Austen then rejected
(`c7044b02b6` "compose the first section instead of packing it", `83bd25d105`
"hold the arrival back"). The reasoning in them is plausible and the results
were wrong. Read them for what changed, not for whether it was right.

---

## The one thing to carry forward

The individual assets are genuinely good and Austen has said so twice. The
failure is that they were placed by a process that never had to answer "why
here?" — nominal widths instead of the real wall, plan-view distance instead of
sightlines, and every element crammed into the first room the visitor sees while
the rooms that matter sat empty.

Start by measuring the room you actually have, not the one the plan describes.
The 0.90 m gap in section 3(a) is where I should have started three days ago.

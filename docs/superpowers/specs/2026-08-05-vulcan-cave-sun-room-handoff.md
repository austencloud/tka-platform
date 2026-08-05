---
status: handoff
value: 4
effort: L
remaining: 'Sun is fully designed and Task 1 of its graybox is built and verified. Tasks 2-5 (layout module, the eye, graybox scene, look at it) are not started. The room is currently a bare, unlit tile chamber with four correctly-placed performers.'
depends_on: 'docs/superpowers/plans/2026-08-05-sundial-graybox.md'
plan_path: 'docs/superpowers/plans/2026-08-05-sundial-graybox.md'
tags: [museum, vulcan-cave, sun, sundial, ornament, handoff]
last_triaged: 2026-08-05
---

# The Sun Room (Sundial) + the Wing's Ornament Grammar — Handoff (2026-08-05)

## Mission

The Vulcan Cave is a six-room wing of the museum (Water → Fire → Earth → Air →
Sun → Moon), each room demonstrating one VTG timing-and-direction with three or
four automaton performers. Water, Fire, Earth and Air are built. This session
**designed Sun end to end and started building it**, and along the way derived a
rule that governs ornament in all six rooms.

Authority documents, all committed to `main`:

- Sun design (the room):
  [2026-08-05-vulcan-cave-sun-room-design.md](file:///E:/tka-platform/docs/superpowers/specs/2026-08-05-vulcan-cave-sun-room-design.md)
- Ornament grammar (the wing):
  [2026-08-05-vulcan-cave-ornament-grammar.md](file:///E:/tka-platform/docs/superpowers/specs/2026-08-05-vulcan-cave-ornament-grammar.md)
- Graybox plan (the build, with the math locked):
  [2026-08-05-sundial-graybox.md](file:///E:/tka-platform/docs/superpowers/plans/2026-08-05-sundial-graybox.md)
- Plan sheet (drawing):
  [2026-08-05-sundial-floor-plan.html](file:///E:/tka-platform/static/sketches/2026-08-05-sundial-floor-plan.html)
  → served at [localhost:5173/sketches/2026-08-05-sundial-floor-plan.html](https://localhost:5173/sketches/2026-08-05-sundial-floor-plan.html)

Walk the room: [localhost:5173/test/museum-cave-3d?room=cave-sun](https://localhost:5173/test/museum-cave-3d?room=cave-sun)
(**:5173, not :5174** — see Gotchas).

---

## The room in one paragraph

Your bearing from the chamber centre is the sun's azimuth and **the sun sits at
your back**, so every shadow in the room — the four performers' and your own —
runs parallel with yours. Your distance from the centre is the sun's elevation:
the rim is ~8°, dead centre is 90°. Walking inward walks you to noon. A spiral
crossing winds in from r=9 to r=4 while sweeping **exactly 90°**, so the sun
climbs and rotates in one move and the walk to zenith performs Quarter-Same's
own phase offset with your body. At the centre the shadows retract into a
top-down projection of each prop path on the pale ring floor — the thesis is **a
pictograph is a shadow**. You leave by standing in the eye at dead centre; the
ground rises, a hatch in the ceiling medallion irises open, and you surface on
the Moon at noon, into blackness and silence.

---

## Done — verified

All on **`main` in the primary checkout** (`E:/tka-platform`). No branch, no
worktree.

### 1. Sun design doc — `426b5b1d3f`, revised by `0e2d520af9`, `750cca3497`, `d81ec81f2f`

The sweeping-beam Sundial is replaced, not parked. Content verified through the
Flow Arts MCP in-session:

- `get_letter_explanation` (S, U): **STUV is Quarter-Same**, the only VTG group
  with four letters, because same-direction shifts at a right angle have a
  leader and a follower, so the hybrid splits into U (leader pro) and V (leader
  anti). Quarter-Opposite (M–R) has no leader/follower.
- `get_sequence_data` with `constraintPreset: "smooth"` for **SSSS, TTTT, UUUU,
  VVVV**: each compiles to a 4-step closed loop, score 1, perfect continuity, no
  reversals, 100% hand-path satisfaction. S and T close on `gamma3`; U and V on
  `gamma11`.

### 2. Ornament grammar — `0e2d520af9`

Grounded in MCP `get_term_definition` (split, tog, quarter-time), which is
explicit that **VTG's three "timings" are phase offsets, not durations**: tog =
0° at beta, quarter = 90° at gamma, split = 180° at alpha. Crossed with
direction that is exactly six rooms, which is exactly the wing — a 3 × 2 grid
nobody had written down. Phase offset sets rotational order; direction sets
whether a mirror exists. Sun is four-fold chiral (it turns); Moon is four-fold
mirrored (it cannot).

MCP also states plainly that **"quarter-time" is a misnomer** — *"It describes a
90-degree phase offset ... NOT a timing or duration change ... strapped onto
VTG's framework by later practitioners."* `CAVE_MODE_ROOMS` still labels Sun and
Moon "Quarter-time / …". Left alone deliberately; it is Austen's call, not a
silent fix.

### 3. Elemental motif harness — `8259648d4e`

`/test/element-motifs`. Six stations, one per VTG category, avatar and props
hidden so only the effect trace moves.

- Evidence: `svelte-check` 0 errors; browser screenshot at 2112×1188 showing all
  six stations rendering with per-station effect selectors.
- **`PerformerRig` supports the idea with no engine work.** `effectsSlot` is a
  sibling of the avatar and prop blocks and receives `bluePropState` /
  `redPropState` directly, so `showAvatar={false} showProps={false}` leaves the
  trace alone in space. `CovenStation` already shipped both toggles; it gained a
  `showProps` prop rather than being forked.

### 4. 3D effects coverage gap found and planned — `6e679144d8`

The harness earned itself immediately: the registry lists 16 effects, but
`EffectOrchestrator3D` renders **four** (`trails`, `led`, `charcoal`, `fire`).
The other eight with renderers (`goo`, `bubbles`, `smoke`, `petals`, `sparkles`,
`zap`, `ghost`, `bloom`) live in `EffectsLayer`, which was mounted **nowhere**.
Four (`ink`, `silk`, `animal`, `pulse`) are genuinely absent in 3D.

**Another agent took this work and has been landing it** — see In flight.

### 5. Sun bay resized — `d9e92e8a68`

`cave-sun` was `minInterior 7 × 7`. Now 43 × 45 → **32.5 × 34.0 m interior**.

- Evidence: throwaway vitest printed `cave-sun tiles 67 x 70 | interior m 32.5 x
  34.0` and `cave-air ... 17.5 x 20.5`, the latter matching Air's own doc, which
  confirms the `ceil(minInterior × 1.5) × 0.5` formula rather than assuming it.
- The pacing test caught the reclassification correctly (bays must exceed solo
  chambers). `cave-sun` was added to `BAY_ROOM_IDS` — **the test was not
  loosened**; that set means "carries its own layout, terrain and graybox".

### 6. Four Quarter-Same stations — `e45af28ab3`

`cave-sun-seq` (`STST`, one performer) replaced by `cave-sun-seq-u|s|v|t` for
UUUU/SSSS/VVVV/TTTT, wired in `vulcan-cave-floor-plan.ts`,
`museum-room-content.ts` and `museum-exhibit-sequences.ts`.

- Evidence: throwaway vitest asserted and printed all four at **exactly 6.50 m**
  radius with facings south/west/north/east (inward): `cave-sun-automaton-u 6.50
  south`, `-s 6.50 west`, `-v 6.50 north`, `-t 6.50 east`.
- `npx vitest run tests/unit/museum/` → **26 files, 284 tests passed**.
- `npx svelte-check --threshold error` → **0 errors, 0 warnings**.

### 7. Plan sheet — `7c41e44bdf`

Plan, section A–A, sun-elevation chart, schedule. The spiral is computed from
the same equation the layout module will use, not drawn by eye. Verified by
screenshot at 2112×1188 and by `evaluate_script` measuring no horizontal
overflow (sheet 1728 px in a 1920 viewport).

### 8. Chamber teleport — `1796de4e76`

`?room=<roomId>` deep link plus the six HUD chamber dots turned into buttons.

- Evidence: browser on `?room=cave-sun` returned
  `{"room":"Sun Chamber","hint":"Jumped straight to Sun","dots":6,"seeded":"{\"playerWorldX\":100,\"playerWorldZ\":73,...}"}`
  and the screenshot shows "DEMONSTRATION 5 OF 6 / Sun Chamber".
- `svelte-check` 0 errors.

---

## Believed done — unverified

1. **The room reads as anything at all.** It has no terrain, no lighting and no
   graybox, so the screenshot is near-black with one performer visible. The four
   stations are proven by measurement, not by eye. Nobody has SEEN the ring.
2. **The other five teleport targets.** Only `cave-sun` was exercised in a
   browser. The other five links are built the same way and the spawn search is
   room-agnostic, but they were not clicked.
3. **The elemental motif effect assignments.** `element-motifs.ts` carries
   candidate shortlists per element, but which effect actually reads as which
   element is unanswered — that is what the harness exists to decide, and it
   needs Austen's eye. Another agent has since changed the defaults.
4. **The ornament grammar teaches anything.** A visitor will never name a
   symmetry group. The claim that four-fold ornament in a four-fold room makes
   the modality *felt* is unproven until a room is built to it.

---

## In flight

**Nothing of mine.** Every path I touched is committed:
`src/lib/features/museum/data/**`, `src/routes/test/museum-cave-3d/**`,
`src/routes/test/element-motifs/**`, `src/lib/features/coven-hub/**`,
`static/sketches/**`, `tests/unit/museum/**`, and the four docs.

**Other sessions have uncommitted work in the tree — do not commit or revert
it.** At handoff time that included `src/lib/features/write/**`,
`src/lib/features/create/shared/components/sequence-actions/**`,
`src/lib/shared/transitions/**`, `src/routes/test/sequence-actions/**`, and
notably **`src/lib/shared/3d/effects/EffectOrchestrator3D.svelte` and
`EffectsLayer.svelte`** — that is the effects-migration agent working my plan.
Their landed commits already include `6d42c51607` (sparkles scale),
`e73536d9a9` (zap), `9d6f2810f7` (bubbles), `211b8546c3` (bloom), `168de53d95`
(goo). Coordinate before touching those two files.

`main` is ahead of `origin/main` with several sessions' commits mixed together.

---

## Loose ends (ranked)

1. **Task 2 of the graybox plan: `sundial-layout.ts`.** This is where the next
   agent starts. The plan has the closed-form spiral predicate and the polar sun
   mapping written out so they cannot be guessed at, plus a seven-assertion test
   to write first. **It must import `SUN_CHAMBER_CENTRE_X_M` /
   `SUN_CHAMBER_CENTRE_Z_M` from `vulcan-cave-floor-plan.ts` rather than
   deriving a centre** — see Gotchas.
2. **Task 3: the eye.** The rising plinth and iris hatch. Reuses Air's Y-drive;
   must NOT be built as moving collision.
3. **Task 4 + 5: graybox scene, then look at it.** Task 5 Step 4 is the real
   gate: if the noon shadows do not read as notation on the ring floor, the
   room's thesis is wrong and it needs rethinking, not polishing. Say so plainly
   if that happens.
4. **A work light in the Sun bay.** Offered to Austen and not yet done. The room
   is unlit, so any interim review of the station ring is looking at black. One
   temporary point light would make loose end #0 possible before the graybox.
5. **Delete the east exit — but only with the lift.** See Gotchas.
6. **Moon has no design doc**, and its design changed this session: it loses its
   entry crack and gains a round hole in the regolith, and its low gravity now
   starts on the first step off the plinth. Whoever writes it must start from
   the Sun doc's departure section, not from the concepts doc.
7. **The elemental motif → element mapping** still needs Austen at the harness.
8. **`?room=` only covers the cave route.** Fine for now; other wings would need
   the same treatment if reviews move there.

---

## Decisions already made

Do not re-litigate. All Austen, 2026-08-05.

- **Sun is Dawn, not heat.** *"I am kind of leaning toward Dawn I think that's
  the most interesting one and it means that it can transition into moon mode in
  an interesting way."*
- **The visitor's walk drives the day.** Not a clock, not station triggers, not
  a one-way trigger on entry.
- **The shadows are the exhibit.** Every performer stays lit and visible; the
  light changes the drawing, never the access. The rejected beam decided what
  you were *permitted to see*; this does not.
- **The modality must be expressed as material throughout the room** — *"I want
  to have artistic representations of the specific modality that each room
  represents everywhere in the room ... embedded into the walls or into the
  floor or into the ceiling."* This corrected an earlier draft that made the
  noon shadow the room's only notation.
- **Ornament grammar is wing-wide, derived from VTG.** Chosen over "Sun only for
  now".
- **The crossing spirals**, and it sweeps exactly 90°. A literal climbing stair
  was rejected by me and accepted as rejected: it costs zenith (elevation IS
  distance from centre) and duplicates Air's vertical axis one room later.
- **The room ends by lifting you into the Moon.** *"the ground literally rises
  beneath you to open you up through a ceiling hatch that opens as you are risen
  toward it ... you burst out of the surface of the sun's ceiling out into the
  floor of the moon."* This does not spend Air's exclusivity: the wing rule is
  that the *element* moves the visitor only in Air, and a rising stone plinth is
  architecture, not air.
- **Departure is at noon, not dusk.** Supersedes the earlier dusk handoff.
- **Content, plan and performer count were all reopened and all came back.**
  Austen opened all three; four Quarter-Same performers on a ring survived on the
  merits, and the MCP data is the reason.
- **Bubbles is the Water room's motif**, and the 3D effects pass covers all eight
  stranded effects. **Do not re-add realistic water** — rejected after many
  iterations, `feedback_water_renamed_to_goo`.

---

## Gotchas

**The chamber centre is NOT the room centre.** The northern 10 m of the 34 m
interior is the rising light crack, so the ⌀24 m chamber occupies the southern
24 m and its centre sits 5 m south of the bay's own centre. It lives in
`SUN_CHAMBER_CENTRE_X_M` / `SUN_CHAMBER_CENTRE_Z_M` in
`vulcan-cave-floor-plan.ts`. **Import them.** Re-deriving a centre puts the sun
mapping and the pillars on different axes, and the sun mapping is polar about
the chamber centre.

**That centre is tile-snapped, deliberately.** Performers land on 0.5 m tile
centres. Unsnapped, the centre fell at x.25 and produced radii of 6.25 / 6.50 /
6.50 / 6.75 — an asymmetric ring in the one room whose entire subject is
four-fold rotational symmetry. `snapToTileCentre` costs 0.25 m of centring in a
32.5 m bay. Keep it.

**The east door survives, against the design.** `buildCirculation` resolves the
`sunToMoon` edge to a real door tile and **throws** without one, so it is
currently the only route to Moon. I tried removing it and got
`Error: Expected a east door in cave room "cave-sun"`, which broke 8 test files.
Delete it in the same change that lands the eye lift, not before. The wall is
commented with this.

**`minInteriorWidth`/`Height` are NOT tiles.** Interior metres =
`ceil(minInterior × 1.5) × 0.5`. A comment in this exact file once read them as
tiles and put Air at 17 × 24 m when it compiled to 25.5 × 36. Measure the
compiled grid; a throwaway vitest that calls `buildVulcanCaveFloorPlan()` and
`console.log`s is how every number in this handoff was obtained.

**Use :5173 for the museum, not :5174.** `:5174` is another session's server and
served me an entirely different screen for `/test/museum-cave-3d` — an app 3D
viewer in a forest. `:5173` was correct immediately. Conversely, **a route
directory created after a server started will not be served by it** and bounces
to `/create/construct`; that is why `/test/element-motifs` needs :5174 (or a
restarted :5173). This cost a full diagnosis round.

**The walker deletes your spawn if it is solid.** `DimensionFlipProof` validates
the restored sessionStorage tile and silently `removeItem`s it, dumping you at
the cave mouth with no message. The teleport therefore uses the game's own
exported `SOLID_TYPES` predicate and expands outward from the room centre.
**Its `TILE_SIZE` is 0.5, not 1** — seeding at the wrong scale lands the player
inside rock. I checked rather than assumed, which is the only reason it works.

**Two `UnifiedCameraController.svelte` copies exist.** The museum imports
`@austencloud/camera-3d`, resolved to `packages/camera-3d/src/` via the
`"svelte"` export condition. Editing `src/lib/shared/3d/camera/` is a silent
no-op for the museum.

**Museum point lights are `decay: 2`** — size them `intensity ≈ target × d²`.
Cave fog is `FogExp2`, density 0.06, colour `#1a1008`. If a cave room reads as
pale haze it is the lights, never the fog. A lamp hung straight over a performer
sits inside the mannequin's head; hang it above *and in front*.

**Chrome DevTools MCP cannot grab pointer lock**, so you cannot mouse-look. Seed
position and yaw instead — and note `?room=` now does this for you, which is
strictly easier than the `initScript` technique the Air handoff describes.
**yaw 0 faces +Z (south).**

**No expert agent owns this canon.** I checked `.claude/rules/expert-routing.md`
— the table covers arrows, props, TKA domain, decks, feedback, a11y, audits and
release notes. Vulcan Cave room design belongs to none of them, so no expert
`.md` needed updating. If a museum-room expert is ever created, this handoff and
the two design docs are its seed material.

**Commit with an explicit pathspec.** The tree holds several sessions' work at
once; a bare `git commit` sweeps other agents' files into yours.

---
status: active
value: 4
effort: L
remaining: 'Fire room (The First Fire) graybox built, walked, sequence-fixed; Austen: "as a Gray box I think we''re on the right track... as far as just being a traversable environment this is gonna work." Next: Earth room, from the all-rooms concept doc.'
depends_on: 'docs/superpowers/specs/2026-08-04-first-fire-design.md'
plan_path: ''
tags: [museum, handoff, earth-room, first-fire]
last_triaged: 2026-08-04
---
# Vulcan Cave — Fire room SHIPPED, Earth room next — Handoff (2026-08-04)

## Mission

The Vulcan Cave wing is built room by room as walkable grayboxes with a hard
gate: Austen approves layout/flow/scale at eye level before any art spend.
Water ("The Drowned Gallery") passed 2026-08-03. Fire ("The First Fire")
graybox is built and provisionally accepted 2026-08-04 — Austen: *"as a Gray
box I think we're on the right track ... as far as just being a traversable
environment this is gonna work"* (lots of iteration expected later; that is
Phase 2+ art, not graybox rework). The next deliverable is the **Earth room**
(`cave-earth`), taken through the same process, working from the wing-wide
concept doc (see Loose end #1). Fire's design:
`docs/superpowers/specs/2026-08-04-first-fire-design.md`; executor plan with
closed ledger: `docs/superpowers/plans/2026-08-04-first-fire-graybox.md`;
wing grammar + roster canon:
`docs/superpowers/specs/backlog/2026-08-02-vulcan-cave-water-room-drowned-gallery-design.md`.

## Done — verified

- **Fire concept sheet + painted mood frame** (commits `bb4ad1d772`,
  `24839a473f`, `61ffbc9e76`): three floor plans + recommendation at
  `static/sketches/2026-08-04-fire-room-floor-plans.html`, first-person
  concept frame at `static/sketches/2026-08-04-first-fire-concept-frame.html`.
  Austen picked the recommendation ("C's soul on A's approach"). Evidence:
  both pages screenshot-verified at 1920 in-session.
- **First Fire graybox built by an Opus executor** (`8a3bf8e118` P1,
  `d97bec31e0` P2, `987b7d68b2` ledger): `first-fire-layout.ts` (single
  geometry source: ember bridge over lava → bent darkening crack −0.3→−0.8 →
  three bench terraces −0.8/−1.3/−1.8 → blocked ash circle → 4 m lava fissure Hey hey now I can hear you Oh look the video's very Peter just arrived OK you're gonna get a plane You need me to print something after 7 like at that specific time or right now no if you can print them right now so that they're they're just ready I would like 2 copies of the little sale that I emailed to you Yeah so that way if this person
  → performer shore −1.3 with three stations → exit stair to Earth door),
  `FirstFireGraybox.svelte` (mounted in `Museum3DScene.svelte`), `cave-fire`
  wing resized (interior ≈ 46.5 × 20.5 m), CAVE_MODE_ROOMS migrated to
  `performerIds`/`sequenceIds` arrays, orphaned `cave-water-seq` deleted.
  Evidence: my own re-run `npx vitest run tests/unit/museum/` → **23 files,
  242/242 passed**; executor's `npm run check` → 0 errors/0 warnings.
- **Verification walk done at 1920** (frames read in-session): bridge, crack,
  reveal, front bench, look-back. The reveal (crack exit → three fire-lit
  automatons across the fissure) and look-back (never black) both pass.
- **Lighting fix from the walk** (`ae73b8e6d2`): pit lights 90→48 and raised
  (front bench was washed white inside 3 m), bridge under-glow lifted above
  the deck that occluded it + two flanking lava glows, crack cues brightened.
  Evidence: before/after frames read in-session; bridge now reads warm over
  lava, front-bench automaton reads fire-rimmed with blue/red staves visible.
- **Sequence timing fix** (`3a3279f4a4`, doc update `0bca0b71e0`): the
  graybox first shipped the generator's variation-0 runs, which are
  TOG-timing — Air's versions. Austen caught it. All three sequences now
  transcribe the canonical catalog's `tnd-split-opp-*` entries verbatim
  (alpha1-anchored, blue at downbeat while red crests). Evidence: 242/242
  after the swap; `check:fast` errors (19) all in other sessions' files, none
  in museum code. NOTE: split-vs-tog only reads in MOTION — data is verified
  against the catalog, but nobody has yet watched the new runs play.

## Believed done — unverified

- The performers' new alpha1-anchored runs playing correctly in the room
  (data-verified only; watch one full cycle in the browser or on Austen's
  next walk).

## In flight

- Nothing uncommitted from this workstream. **The all-rooms concept doc
  LANDED** (`f2d7944030`, 421 lines, cleanly scoped):
  `docs/superpowers/specs/2026-08-04-vulcan-cave-all-rooms-concepts.md` —
  Earth "The Weight" (low bedding passage, boulder choke, sinkhole rim: the
  only room viewed from above, barrier = 6 m vertical drop, Tog-Same's
  convergence read from overhead), Air "The Chimney" (+8.4 m switchback
  climb, Fire's designed phase-twin), Sun "The Sundial" (round, daylit,
  oculus beam sweeping four stations — NOTE: beam since rejected by Austen,
  see below), Moon — SUPERSEDED 2026-08-05, now "The Sea of Tranquility"
  (the wing stops being a cave and opens onto the lunar surface; the old
  "Still Room" reflection-pool concept and its `MuseumMirror.svelte`
  Reflector path are retired). Wing pacing thesis: no two adjacent rooms share a
  dominant axis. Build order: Earth next, deliberately spectacle-free.
  AWAITING AUSTEN'S REVIEW — treat it as a proposal, not approved canon; the
  Earth brainstorm starts by walking him through the Earth section.
- The checkout carries MANY other sessions' dirty files (shop, codex, agents,
  scripts...). Do not touch, stage, or revert them. `main` has unpushed local
  commits from several sessions; do not push without confirming ownership of
  every one.

## Loose ends (ranked)

1. **Earth room graybox** — the next deliverable. Process that worked twice
   (follow it): review the all-rooms concept doc → brainstorm/refine with
   Austen → HTML plan sheet in `static/sketches/` (he loves these; Fire's
   sheet is the format reference) → design doc + executor plan → ONE Opus
   executor → my own audit + browser walk with lighting iteration → Austen's
   eye-level gate. Earth's letters: **GGGG, HHHH, IIII** (Tog-Same,
   beta-to-beta) — transcribe step data from the catalog's `tnd-tog-same-*`
   entries in `static/data/hero/tnd-base-words.json`, NOT from the MCP
   generator default (see Gotchas). Earth is entered from Fire's east door
   (`fireToEarth`), exits via `earthToAir`.
2. **Fire iteration backlog (post-gate, Austen expects it)**: he flagged
   "lots of stuff to iterate on" without specifics. Known candidates: real
   trails + beat-synced flare (Phase 3), watch the split runs play, ceiling
   height feel, ash-circle read. Collect his specifics at the next walk.
3. **Fire Phase 2+ (art)** not started, gated on Austen scheduling: ember-kit
   dressing (LavaPool/Cracks/Rivers, HeatDistortion, VolumetricFire,
   EmberFountains at `src/lib/shared/3d/environments/scenes/ember/`),
   Blender-first shell per `blender-first-3d-scenes.md`.
4. **Water: procession niche read** (carried from the 2026-08-03 handoff,
   polish-tier).

## Decisions already made (Austen)

- **2026-08-04: Fire graybox provisionally accepted as a traversable
  environment** (quote in Mission). Iteration later; layout works.
- **2026-08-04: Fire = "The First Fire"** — Plan C (darkness amphitheater,
  performance-as-light, fire jam fiction) entered via a compressed lava-bridge
  beat from Plan A. Full rationale in the design doc.
- **2026-08-04: pedagogy is compound pairs** DJ/EK/FL, not single letters,
  and timing (split vs tog) is the compound's phase set by variation choice —
  Fire = split runs, Air = tog runs of the same pairs (deliberate phase-twin
  rooms).
- **Budget discipline (2026-08-02, still standing)**: one Opus executor per
  phase, no fan-outs/panels for execution; Fable does synthesis + visual
  verification itself.
- **Graybox-first with hard gates** — standing process for every room.

## Gotchas

- **Sequence variation authority**: the MCP generator's variation-0 default
  returns TOG-timing runs. For any roster sequence, transcribe the canonical
  catalog `static/data/hero/tnd-base-words.json` entry verbatim (memory:
  `reference_tnd_catalog_variation_authority`). This shipped wrong once.
- **Teleporting the player** (for verification walks): `navigate_page` with
  `initScript` setting
  `sessionStorage.setItem("museum-cave-3d-state-v1", JSON.stringify({playerWorldX, playerWorldZ, viewMode:"first-person", topDownHeight:12, playerYaw}))`,
  then wait for the text "Click to look around" (loading % sits at 93% a
  while). Yaw: north(−z) = π, east(+x) = π/2, south(+z) = 0; `atan2(dx, dz)`.
  Route: `/test/museum-cave-3d`. Fire coordinates: bridge (34, 11.75),
  crack bend (45, 13), reveal (49.5, 19.5, yaw 2.46), front bench (62,
  11.25), stations x 54/62/69.5 at z 4.
- **Lights use `decay={2}`**: intensity ≈ target·r², AND the inverse bite —
  what reads at 17 m blinds at 3 m (pit lights at 90 washed the front bench
  white; 48 raised to +1.6 is the tuned value). Also: a light BELOW a walkway
  is occluded by it (the bridge under-glow bug).
- **Layout coordinate dump**: to get world coords for walk stations, build
  the layout in a throwaway vitest file (`buildVulcanCaveFloorPlan().grid` →
  `buildFirstFireLayout(grid)`) and JSON.log it — the museum-room-graph
  module does NOT export a grid builder directly. Delete the temp test after.
- **Rect cell math / door-derived gaps / one geometry source /
  suppressedSpans**: all encoded in
  `docs/superpowers/plans/2026-08-04-first-fire-graybox.md` → "Non-negotiable
  gotchas". Reuse that section verbatim in Earth's executor plan.
- **chrome-devtools MCP can disconnect mid-session**; Austen reconnects it
  with `/mcp`. `take_screenshot` can also hang (2 min timeout) on
  first-capture of a heavy page — TaskStop and retry after a reload.
- **Commits**: explicit pathspec ONLY; new files need `git add <paths>`
  first. The index is shared with parallel sessions.

## Update 2026-08-05 — Air room brainstorm begun; Austen's input captured

Water, Fire, and Earth grayboxes exist. Air is the next room. A live
brainstorm with Austen (mushroom-coffee session) produced:

- **DECIDED 2026-08-05 — Air = Plan B, "The Last Lift."** Austen chose it off
  the plan sheet. Ramp to landings A (+1.6, D-J) and B (+4.6, E-K) exactly as
  the all-rooms doc specifies; **ramp 3 does not exist** — the final +4.6 →
  +8.4 is a visible updraft column, and the ~4 s rise is the room's reveal
  (three ledges stack into one vertical frame, all pairs land together as you
  crest). **Fallback preserved:** if the updraft ever fails a feel gate,
  restoring the concept doc's ramp 3 (10 m run, east wall, +4.6 → +7.6)
  reverts the room to Plan A with nothing else moving. Do not delete the
  ramp-3 geometry spec from the all-rooms doc.
- **Updraft feel-prototype BUILT and measured** (`18c35bcc1e`, plan with
  closed ledger: `docs/superpowers/plans/2026-08-05-air-updraft-prototype.md`).
  `cave-air` is now an authored bay: bare shaft, ramp to +4.6, visible updraft
  column, overlook lip at +8.4. Measured rise **+3.81 m in 3.93 s, no jump
  input**; overshoot 0.013 m; step-out mid-rise drops safely. Evidence:
  281 museum tests pass, `npm run check` 0 errors/0 warnings, three 1920
  frames read (two real defects found and fixed — an opaque column that
  filled the frame, and a lip rim that walled off the overlook view).
  **AWAITING AUSTEN'S FEEL GATE** — the numbers are right; whether 1.0 m/s
  reads as the room's reveal is his walk, not a headless viewport's.
  Teleport into the column and ride it.
- **Prototype gotchas for the Air room build:**
  1. **Two UnifiedCameraController copies exist.** The museum imports from
     `@austencloud/camera-3d` (`packages/.../lib/components/`), NOT
     `src/lib/shared/3d/camera/`. Editing only the src copy is a silent
     no-op — this cost the executor a full measurement round. Both now carry
     the identical guarded lift branch.
  2. **The top hovers rather than settles.** Lift cuts at the lip, gravity
     pulls back under it, lift resumes — the player bobs within ~1 cm at lip
     height indefinitely. Reads as forgiving beside a steppable ledge, but a
     real dismount wants a spent-state on the column, not a ceiling. Decide
     before the room build.
  3. **The physics seam is 2D.** `blockedAt`/`elevationAt` take no Y and the
     ground clamp is a floor-only minimum, so any raised ledge XZ-adjacent to
     lower ground can be walked straight up onto. The prototype's rims exist
     only to close that. Air either keeps fences or the terrain program gains
     a Y-aware blocker — the latter is the better answer for a room whose
     whole plan is stacked elevations.
- Superseded context (kept for reasoning): three tiers on the plan sheet
  `static/sketches/2026-08-05-air-room-floor-plans.html` — A pure switchback
  (all-rooms doc as written), B "The Last Lift" (single updraft column
  replaces ramp 3; the lift IS the reveal; recommended), C full updraft-pad
  hopping (Austen's literal pitch). Austen has not picked. The updraft
  mechanic = trigger volume adding +y velocity with soft terminal speed;
  prototype on a bare shaft and gate on feel BEFORE building the room.
- **Moon DECIDED 2026-08-05 — "be on the moon" wins; Still Room retired.**
  Austen: *"put the fucking person on the moon ... make them think holy shit
  I just walked through the door and I'm on the moon."* The reflection pool
  is retired outright, NOT merged — a mare-pool hybrid was considered and
  dropped, since repeating Water's mirror pool as the wing's closing image
  was the main problem the surface concept solves. Built from `scenes/cosmic/`
  (`LunarGroundPlane`, `EarthSphere`, `Starfield`, `EarthGodRays`,
  `LunarCrystals`, `MeteorStreaks`, `NebulaLayer` — all verified on disk).
  Approved in the same session: low gravity (persistent, player-driven —
  distinct from Air's scripted lift, but SHARES the walker/ground-clamp risk,
  so coordinate the prototypes); total silence (the only room with no audio
  bed, and it must be a deliberate registry entry so it doesn't read as a
  bug); two-source lighting, hard sun key plus Earthshine fill, which Austen
  is skeptical of and gated to graybox. The barrier is plain scale — no wall,
  no drop. A distance-misjudgement effect was considered and is flagged
  UNPROVEN: do not build the barrier on it. The room's cost profile flipped —
  it no longer carries the real-time planar Reflector, but it does carry an
  uncapped open-sky room on a tile system built for enclosed bays. Full
  rewritten section: `## Moon — "The Sea of Tranquility"` in the all-rooms doc.
- **Sun — beam mechanism rejected in principle, room still undecided.**
  Austen on the Sundial's sweeping beam: *"I'm not sold on the whole notion of
  a spotlight beam revealing one performer at a time."* Parked, not replaced.
  Two live directions: glare inversion (barrier and light channel become the
  same thing — the lit performer is the one you CANNOT look at), or small,
  close and hot, which is newly available because Moon has taken over the
  wing's bright-open-peak role. Sun is now the only room with no agreed
  mechanism. The sun-bubble idea remains logged with Austen lukewarm on it.
- **Standing directive**: every room's Phase 2 art pass starts with an
  inventory of the existing scene libraries (`scenes/ember|ocean|cosmic|
  celestial|autumn`) and `static/models/` GLBs before authoring anything.
  Reuse Map sections in design docs are mandatory.

Full detail in the Addendum of
`docs/superpowers/specs/2026-08-04-vulcan-cave-all-rooms-concepts.md`.
Next steps: Austen picks a plan on the sheet → Air design doc + executor
plan (reuse Fire plan's "Non-negotiable gotchas" verbatim) → updraft
prototype (if B/C) → graybox → eye-level gate.

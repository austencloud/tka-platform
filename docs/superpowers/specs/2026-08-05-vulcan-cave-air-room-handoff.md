---
status: active
value: 3
effort: M
remaining: 'Air graybox is built and committed. Austen has not judged the rise rate (1.0 m/s), and the overlook + sink column have been simulated in tests but never seen in a browser. Sun is the only room with no agreed mechanism. Moon is decided but has no design doc or graybox.'
depends_on: 'docs/superpowers/specs/2026-08-04-vulcan-cave-all-rooms-concepts.md'
plan_path: ''
tags: [museum, vulcan-cave, air, moon, handoff]
last_triaged: 2026-08-05
---

# Vulcan Cave — Air Room Rebuild + Moon Decision — Handoff (2026-08-05)

## Mission

The Vulcan Cave is a six-room wing of the museum (Water → Fire → Earth → Air →
Sun → Moon), each room demonstrating one TKA technical mode with three or four
automaton performers. Water, Fire and Earth are built. This session rebuilt
**Air** and settled the design of **Moon**.

Concepts and floor-plan programmes for all six rooms:
`docs/superpowers/specs/2026-08-04-vulcan-cave-all-rooms-concepts.md`. The Air
and Moon sections in that document were rewritten this session and now describe
what exists / what was decided — they are current, not aspirational.

Prior handoff (Earth, plus the Air prototype):
`docs/superpowers/specs/2026-08-04-vulcan-cave-earth-room-handoff.md`.

Walk the wing at
[/test/museum-cave-3d](https://localhost:5173/test/museum-cave-3d). Air is
demonstration 4 of 6.

---

## Done — verified

### 1. Air chamber rebuilt so the lift IS the traversal — `410584cff3`

The room has **no ramp**. Open floor; a rise column carries the visitor from the
datum past three performer ledges to a +9.0 overlook; a warmer sink column sets
them back down beside the Sun door. Nothing in the room is blocked.

Evidence:

- `npx vitest run tests/unit/museum/` → **26 files, 284 tests passed**
  (2026-08-05). 13 of those are `tests/unit/museum/air-chimney-updraft.test.ts`,
  which asserts: every floor surface is flat (no ramp may reappear), `blockedAt`
  is false at every probe, the floor stays at datum under the overlook and all
  three ledges, a surface IS returned when the player is actually up there, the
  ledge void is ≥1.8 m, performers stay within 7 m laterally, a no-jump ride
  reaches the overlook, and a no-jump descent returns to the floor.
- `npm run check` → **0 errors, 0 warnings** (2026-08-05).
- Browser, `/test/museum-cave-3d`, viewport 2112×1188 (= 1920 × the 1.1 DPR
  correction in `reference_devtools_emulate_dpr`): performers render at all
  three ledge heights with blue and red staves legible; the shaft reads as the
  brightest thing in the room; the three ledges read as lit stages climbing away
  from the door.

### 2. Three performers where there was one — same commit

`cave-air` shipped with a single station (`cave-air-automaton`, sequence
`cave-air-seq` / word JKJK). It now carries Fire's three pairs met again.

Evidence: compiled grid contains `cave-air-automaton-dj|ek|fl` at elevations
2.4 / 5.0 / 7.6 with facings east/east/east and sequences
`cave-air-seq-dj|ek|fl` (printed from `buildVulcanCaveFloorPlan()` in a scratch
test, since deleted). Sequence data for DJDJ, EKEK and FLFL was generated
through the Flow Arts MCP (`get_sequence_data`, `constraintPreset: "smooth"`) —
all three report perfect continuity, no reversals, and close beta3 → beta3 so
they loop cleanly under autoplay.

### 3. The elevation seam is Y-aware — same commit

`MuseumTerrainProgram.elevationAt(x, z, fromY?)` gained an optional foot-height
argument and returns the highest surface at or below it (0.6 m step-up
tolerance). Omitting it preserves the old topmost-surface behaviour, so Water,
Fire and Earth are untouched.

This is the root-cause fix, not a nicety: the physics clamp treats the floor
height as a *minimum*, so with a 2D lookup anyone walking under a ledge was
teleported on top of it. The prototype's head-height rock rims existed only to
fence that off, and one of them was the wall Austen had to walk through to reach
the room.

Evidence: the two elevation tests named above, plus all pre-existing Water /
Fire / Earth terrain and traversal suites still passing (284 total).

### 4. A negative updraft is a descending column — same commit

`packages/camera-3d/src/lib/components/UnifiedCameraController.svelte`:
`if (lift > 0)` → `if (lift !== 0)`. Easing toward a downward target is a
controlled sink where gravity would be a fall. This is what lets the room owe no
ramp for the trip back down.

Evidence: the sink-column descent test (simulation against the real terrain,
mirroring the controller's ease constant); `npm run check` clean.

### 5. Moon decided — surface of the moon, Still Room retired — `17fdfc1c23`

Austen, 2026-08-05: *"put the fucking person on the moon ... make them think holy
shit I just walked through the door and I'm on the moon."* The reflection-pool
"Still Room" is retired outright, not merged.

Evidence (documentation only — no code): the Moon section of the all-rooms doc
rewritten as "The Sea of Tranquility", plus every stale cross-reference in Earth,
Air, Sun, the pacing thesis and the build order corrected (they each asserted
Moon was seen only in reflection). All `scenes/cosmic/` assets cited were
verified present on disk: `LunarGroundPlane`, `EarthSphere`, `Starfield`,
`EarthGodRays`, `LunarCrystals`, `MeteorStreaks`, `NebulaLayer`.

### 6. Air section of the concepts doc rewritten to match the build

The concepts doc still described the switchback ramp with landings A/B/C. A
stale plan there is how a future agent rebuilds the thing Austen rejected, so it
now describes the built room, with the ramp version preserved under
**Retired: the ramp**. The addendum's "Austen chose B" entry is marked
superseded and the build-order entry for Air marked BUILT.

---

## Believed done — unverified

1. **The ride feels like a reveal.** The rise is 1.0 m/s over 9 m. Tests prove a
   no-jump ride *arrives*; they say nothing about how it feels. Austen has never
   signed off on the rate — it was the prototype's open question and it still is.
   `UPDRAFT_SPEED` in `air-chimney-layout.ts` is one constant.
2. **The overlook and the sink column look right.** Both are simulated in tests
   against the real terrain and both pass. Neither has been seen in a browser —
   I could not get up there (see Gotchas: no pointer lock). Nobody has laid eyes
   on the crest, the step-off, or the descent.
3. **A pair actually reads at eye level from inside the column.** The geometry
   is right (≈5.8 m lateral, within a 75° cone, asserted by test) and the ledges
   read well from the floor. The eye-level pass itself was never observed.
4. **Nothing else in the museum regressed from the `elevationAt` signature
   change.** All 284 museum tests pass and the signature is backward compatible
   by construction, but no other room was walked in a browser this session.

---

## In flight

Nothing of mine. My paths (`src/lib/features/museum/**`, `packages/camera-3d/**`,
`tests/unit/museum/**`, the two Vulcan Cave docs) are committed and clean.

All work is on **`main` in the primary checkout** (`E:/tka-platform`). No
branch, no worktree.

Other sessions have uncommitted work in the tree — shop docs, gallery, onboarding
and start-position specs. **Not mine, do not commit or revert them.**

`main` is ahead of `origin/main` with several sessions' commits mixed together.

---

## Loose ends (ranked)

1. **Austen walks the Air room and judges the rise rate.** This is the one thing
   blocking Air from done. Everything else about the room is verified. If it
   wants to be faster, slower, or to hang a beat at the top, that is
   `UPDRAFT_SPEED` (and, for a hang, the ceiling behaviour in `updraftAt`).
2. **Look at the overlook and the descent in a browser.** Ride to +9.0, step
   south onto the overlook, walk into the sink column, confirm the set-down is a
   sink and not a fall, and confirm the walk to the Sun door reads. This is the
   only part of the room nobody has seen.
3. **Sun has no agreed mechanism.** Austen rejected the sweeping-beam Sundial in
   principle on 2026-08-05: *"I'm not sold on the whole notion of a spotlight
   beam revealing one performer at a time ... but it's better than anything I
   have right now."* Two live directions are logged in the concepts addendum:
   the glare inversion (the lit performer is the one you *cannot* look at, which
   makes barrier and light channel the same thing and gives Sun a body channel
   it currently lacks), or small/close/hot now that Moon has taken the wing's
   bright-open-peak role. Neither is chosen. Sun is third in build order.
4. **Moon needs its own design doc and graybox.** The concept is settled and
   detailed, and its cost profile flipped (no more real-time planar reflector,
   but an uncapped open-sky room on a tile system built for enclosed bays —
   that is the largest unknown in the wing). Its low gravity shares the walker
   and ground-clamp risk with Air's lift; prototype the two together.
5. **The `/q`-style question of whether other rooms want the Y-aware seam.**
   Water, Fire and Earth still carry hand-placed blockers and rims that predate
   it. Nothing is broken, so this is opportunistic, not owed.
6. **Air still has no design doc of its own**, only the (now accurate) concepts
   section plus this handoff. Every other built room has one.

---

## Decisions already made

Do not re-litigate these.

- **Air: the lift is the traversal, no ramp.** Austen, 2026-08-05, on walking
  the prototype: *"why would I go up the ramp to get to the airlift — the
  airlift is demonstrating me how I can lift."* This supersedes Plan B ("The
  Last Lift"), which he had chosen earlier the same day. Plan B's ramp-3
  fallback is void. A unit test asserts no floor surface may be sloped.
- **Air: floor plan is Austen's ask.** *"let's kind of redo this whole floor
  plan to be something that's more traversable and usable."* The open floor,
  the two columns and the one-wall ledges are the answer to that.
- **Air: the vibe was already right.** *"as far as vibes and openness and
  general concept you're doing great keep it up."* The palette, the mote
  columns and the general feel are endorsed — changes here should be
  conservative.
- **Moon: the surface of the moon, not the Still Room.** Approved in the same
  session: low gravity (persistent, player-driven — distinct from Air's
  scripted lift), total silence (the only room in the wing with no audio bed,
  and it must be a deliberate registry entry so it does not read as a bug),
  and two-source lighting (hard sun key plus Earthshine fill) which Austen is
  **skeptical of** and gated to graybox: *"I'm a little bit skeptical but I
  would like to see how it goes."* The barrier is plain scale; the
  distance-misjudgement idea is recorded as UNPROVEN and must not be
  load-bearing.
- **Sun: the sweeping beam is rejected in principle.** Parked, not replaced.
- **Standing directive:** every room's Phase 2 art pass starts with an inventory
  of the existing element scenes (`scenes/ember|ocean|cosmic|celestial|autumn`)
  and the ~500 GLBs under `static/models/` before authoring anything new.

---

## Gotchas

**Two `UnifiedCameraController.svelte` copies exist.** The museum imports
`@austencloud/camera-3d`, which resolves to `packages/camera-3d/src/` via the
`"svelte"` export condition — there is no `dist/`, so no build step is needed
and Vite serves the source. Editing `src/lib/shared/3d/camera/` is a **silent
no-op for the museum**. This cost the prototype session a full measurement round.

**`minInteriorWidth`/`Height` are NOT tiles.** Interior metres =
`ceil(minInterior × 1.5) × 0.5`. A comment in `vulcan-cave-floor-plan.ts` read
them as tiles and claimed Air was 17 × 24 m; it actually compiled to 25.5 × 36,
which is why the shaft looked lost and the ledges sat 11 m from it. Air is now
23 × 27 → 17.5 × 20.5 m. **Measure, do not trust the comments** — the Earth
comment had the formula right and the Air comment had it wrong, in the same file.

**Chrome DevTools MCP cannot grab pointer lock**, so you cannot mouse-look and
therefore cannot freely aim the camera. What works:

- Place and orient the player by seeding `sessionStorage` key
  `museum-cave-3d-state-v1` with
  `{playerWorldX, playerWorldZ, viewMode:"first-person", isInFPS:true, topDownHeight, playerYaw}`.
- **It must be seeded via the navigation `initScript`, not `evaluate_script`
  + reload** — the page's own unload handler writes the live position over
  anything you set beforehand.
- **yaw 0 faces +Z (south); yaw −π/2 faces west; yaw +π/2 and π do not.** I
  burned several loads guessing this.
- WASD works via `window.dispatchEvent(new KeyboardEvent("keydown", {key:"w", code:"KeyW"}))`,
  and the updraft then carries the player with no further input.
- Scene build takes ~10 s after navigation before anything renders.

**Museum point lights are `decay: 2`.** Size them `intensity ≈ target × d²`.
Sizing by intended reach is how the first pass ended up with a 2 m ledge lamp at
intensity 85 (≈20× over) and flattened the whole chamber into a featureless blue
wash. **Cave fog is `FogExp2`, density 0.06, colour `#1a1008` — dark brown.** If
a cave room reads as pale haze it is the lights, never the fog. Second related
trap: a lamp hung straight over a performer sits inside the mannequin's head and
blows the torso to white; hang it above *and in front*, on the side the visitor
approaches from.

**`window.__gameBridge` exists but is unbound** (no websocket, empty bindings) —
it is not a way to query player state. There is no global handle to the Threlte
scene either. To read compiled geometry, write a throwaway test that calls
`buildVulcanCaveFloorPlan()` / `buildAirChimneyLayout()` and `console.log`s —
that is how every coordinate in this handoff was obtained.

**`collisionRadiusTiles` is 2D.** Air's performers deliberately carry none: they
are 2.4–7.6 m overhead and unreachable, and a collider would plant an invisible
pillar in the open floor the room depends on being open.

**Commit with an explicit pathspec.** The tree holds several sessions' work at
once; `git commit -- <paths>` is mandatory here, and a bare `git commit` will
sweep other agents' files into yours.

---
status: handoff
value: 4
effort: M
remaining: 'All six Vulcan Cave chambers are built and walkable. The Sun noon-shadow gate is unproven and needs Austen at the summit looking DOWN. The Moon low-gravity jump arc is unverified. The Sun-to-Moon transition does not exist yet.'
depends_on: 'docs/superpowers/plans/2026-08-05-sundial-graybox.md'
plan_path: 'docs/superpowers/plans/2026-08-05-sundial-graybox.md'
tags: [museum, vulcan-cave, sun, moon, mobile, handoff]
last_triaged: 2026-08-05
---

# The Vulcan Cave wing is complete — Handoff (2026-08-05)

## Mission

The Vulcan Cave is a six-room wing of the museum — Water → Fire → Earth → Air →
Sun → Moon — each chamber demonstrating one VTG timing-and-direction with three
or four automaton performers. Water, Fire, Earth and Air were already built.
**This session built the Sun and the Moon, which completes the wing**, and along
the way made the whole museum walkable on a phone.

Authority documents, all on `main`:

- Sun design: [2026-08-05-vulcan-cave-sun-room-design.md](file:///E:/tka-platform/docs/superpowers/specs/2026-08-05-vulcan-cave-sun-room-design.md)
- Ornament grammar (wing-wide): [2026-08-05-vulcan-cave-ornament-grammar.md](file:///E:/tka-platform/docs/superpowers/specs/2026-08-05-vulcan-cave-ornament-grammar.md)
- Graybox plan, with the Sun's math locked: [2026-08-05-sundial-graybox.md](file:///E:/tka-platform/docs/superpowers/plans/2026-08-05-sundial-graybox.md)
- Superseded morning handoff: [2026-08-05-vulcan-cave-sun-room-handoff.md](file:///E:/tka-platform/docs/superpowers/specs/2026-08-05-vulcan-cave-sun-room-handoff.md)
  (its design decisions stand; its loose ends are stale)

Walk it: [localhost:5173/test/museum-cave-3d?room=cave-sun](https://localhost:5173/test/museum-cave-3d?room=cave-sun)
and [?room=cave-moon](https://localhost:5173/test/museum-cave-3d?room=cave-moon).
**:5173, not :5174.**

The Moon has no design doc — its rationale lives in `moon-layout.ts`'s header.

---

## Done — verified

Everything below is on `main` in the primary checkout (`E:/tka-platform`). No
branch, no worktree. Every commit used an explicit pathspec.

**Standing evidence for all of it**, run at the end of the session with the
final tree: `npx vitest run tests/unit/museum/` → **28 files, 308 tests
passed**; `npx svelte-check --threshold error --output human` → **0 errors, 0
warnings**. (299 tests before this session's work.)

### 1. The Sundial built — `c8dab5f060`

`sundial-layout.ts` (polar geometry: rim/collapse/disc bands, closed-form
spiral predicate, the sun mapping, the eye lift) + `SundialGraybox.svelte` +
`tests/unit/museum/sundial-layout.test.ts`.

Evidence: 11 tests green at the time; browser screenshots at 1920×1080 webp/70
of the rim frame and the noon frame. Two corrections the tests forced, both
recorded in the plan's Progress section: the chamber centre snaps to a tile
CENTRE not a boundary (the "all four performers at r=6.5" assertion caught it at
6.25), and the bay needed 0.5 m more depth.

### 2. Chamber teleport stopped dropping the visitor into a pit — `8be81b165f`

`?room=cave-sun` seeded r=4.5, inside the blocked collapse ring, walled in on
all sides. The spawn search read tile types only and knew nothing about a
terrain program's `blockedAt`.

Evidence: throwaway vitest printed the chosen spawn for all six chambers, each
`blockedAt` false; `cave-sun` moved from r=4.5 → **r=3.50** on the disc.
Confirmed in-browser: `?room=cave-sun` seeds `(99.5, 74.5)` and the frame shows
open floor in every direction.

### 3. The walkway ran through a pillar; the lift read as falling — `1d29118a59`

Both were visible in Austen's own screenshots.

Evidence: a diagnostic run printed **`sun-pillar-t centreline dist 0.55,
clearance −1.55 *** OVERLAP ***`**. After the fix every pillar clears by ≥0.5 m,
asserted by a new test that measures edge-to-edge along the spiral. Browser
frame from the crossing's midpoint shows the walk threading cleanly between two
pillars.

The guard that should have caught it compared the pillar's CENTRE against the
spiral's centreline using the pillar's radius as tolerance — it ignored the
walkway's own width entirely.

`isGrounded()` was false every frame of the eye's ride, so the avatar played its
falling animation the whole way up. A lift is ground that is moving. Air's
column had the same bug and is fixed by the same line.

### 4. The crossing became a real spiral staircase — `1f4a922f94`

Evidence: the same diagnostic measured the old crossing's **total rise as 0.19 m
over its entire run** — flat. It now climbs 6.4 m from the rim to a summit at
+6.0, still sweeping exactly 90°. Browser screenshot from the bottom of the
flight shows treads and risers reading as a staircase, with a performer at eye
level as you pass. New tests assert the climb is monotonic, that no step exceeds
what the physics provider's 0.6 m step-up allows, and that the summit is
reachable only by the stair.

### 5. The museum is walkable on a phone — `684d5099cf`

Before this **no cave room was traversable on a touch device**. Look worked (the
camera controller falls back to drag-look without pointer lock) but every
movement path reads `heldKeys`, which a phone cannot fill.

Evidence: driven in an emulated 412×915 touch viewport with synthetic
`TouchEvent`s — **full stick push travelled 0.60 m, half push 0.28 m over the
same interval**, which is the analog working rather than a threshold. Screenshot
shows the stick on screen at bottom-left.

### 6. The Sundial's light crack was mostly invisible wall — `3d6ce9a580`

Austen walked toward the chamber and stopped dead on open, lit floor. The
graybox floors the whole band north of the chamber; `blockedAt` allowed only a
6 m strip on the door's axis.

Evidence: new test walks the full width of the crack at three depths — 15 tests
green in that file.

### 7. The Moon built — `75ceb51cee`

A ⌀20 m plain in a 22.5 m bay under an open sky, three Quarter-Opposite
stations, a real hole in the floor at the arrival, and low gravity that begins
on the first step OFF the Sun's plinth.

Evidence: 9 new tests in `tests/unit/museum/moon-layout.test.ts` (plain walkable
to its edge across 60 bearings × 6 radii, both door approaches walkable end to
end, all four rock corners blocked, three mounds at exactly
`MOON_STATION_RADIUS_M`, every mound clear of the arrival hole, gravity off on
the plinth and on one step away, compiled performers landing on mound centres).
Browser screenshot at 1920×1080 confirms the hard-light read and the arrival
hole. `cave-moon` moved from the solo-chamber list into `BAY_ROOM_IDS` in
`vulcan-cave-floor-plan.test.ts` — the room genuinely changed category; that is
not a loosened assertion.

### 8. The real Moon put in the Moon room — `63cb847eb7`

The room shipped in #7 drew an empty black hemisphere while
`src/lib/shared/3d/environments/scenes/cosmic/` — which already IS a lunar
surface — sat one directory away. Austen: *"Look at my scenes package. Find
cosmic. That's the moon."*

Evidence: browser screenshot at 1920×1080 webp/70 shows **Earth in frame with
South America and the terminator lit, stars across black sky**, the regolith
plain, the arrival hole with the warm Sun-stone plinth inside it, and a
performer throwing a hard shadow. `list_console_messages` → **no console
messages found**.

---

## Believed done — unverified

1. **The Sun's noon gate — the room's own thesis.** From the new +6.0 summit the
   visitor is ten metres above the ring floor where the prop shadows land, which
   should be the top-down projection the design asks for. **I could not verify
   it: Chrome DevTools MCP cannot grab pointer lock, so the camera cannot be
   pitched downward.** Needs Austen standing on the summit looking down. If it
   still does not read as notation, the room needs rethinking, not polishing.
2. **The Moon's low-gravity jump arc.** `MOON_GRAVITY_SCALE`, the
   `isLowGravityAt` boundary and the prop wiring are unit-tested and the prop
   reaches `UnifiedCameraController`, but nobody has jumped off the plinth and
   watched the hang time. Needs pointer lock and a keypress in a live window.
3. **How Earth reads from the Moon's other angles.** Verified from one position
   only, for the same pointer-lock reason.
4. **Mobile feel.** The analog ratio is measured, but absolute walking speed
   under an emulated phone at dpr 2 is not a trustworthy number. Needs a real
   thumb on a real phone.
5. **Frame cost — never measured.** Task 5 Step 5 of the plan. Other sessions'
   HMR kept reloading the page and a clean timing window never opened. Four rigs
   plus a moving shadow-caster makes the Sun the heaviest room in the wing.

---

## In flight

**Nothing of mine.** Every path I touched is committed, and `main` is level with
`origin/main`.

**Other sessions have uncommitted work in the tree — do not commit or revert
it.** At handoff time that included `src/lib/features/write/**` (MusicPlayer,
ActPlayer, ChoreoSheet*), `src/lib/shared/3d/effects/bubbles/**`,
`src/routes/test/effect-grid/**`, `src/routes/test/element-motifs/**`, and
`docs/superpowers/specs/2026-08-05-gallery-split-pane-workspace-handoff.md`,
plus untracked `.codex/`, `artifacts/` and `.codex-qft-review.md`.

---

## Loose ends (ranked)

1. **Stand on the Sun's summit and look down.** The gate above. Everything else
   is polish next to it.
2. **The Sun→Moon transition does not exist.** The eye lifts you to the hatch
   and nothing happens — no teleport into the Moon. Until it lands, the Sun's
   east door MUST stay: `buildCirculation` resolves the `sunToMoon` edge to a
   real door tile and **throws** without one, breaking 8 test files. Delete it
   in the same change that lands the transition, never before. The wall is
   commented with this.
3. **Above the Sun's summit the chamber is unlit.** Dark from +6 up, which is
   the whole ride.
4. **The Moon has no design doc**, and the cosmic-sky decision is only in code
   comments. Start from the Sun doc's departure section, not the concepts doc.
5. **Frame cost** (Believed-done #5).
6. **The joystick is low-contrast** on the pale summit floor; at 412px the back
   button and the "Look around" chip overlap top-left (that overlap is
   pre-existing, not from this session).
7. **`DimensionFlipProof`'s restore check still validates tile type only** — it
   does not consult `grid.terrain?.blockedAt`. Harmless today because nothing
   seeds a terrain-blocked position, but the next room with a terrain program
   and blocked interior ground will hit it.
8. **The elemental motif → element mapping** still needs Austen at
   `/test/element-motifs`.

---

## Decisions already made

Do not re-litigate. All Austen unless noted.

- **The Sun's crossing climbs.** (2026-08-05) The original was flat by design —
  distance from centre carried the sun's elevation and a literal stair was
  explicitly rejected. He walked it: *"I don't really get the staircase effect
  it's not really going up like a spiral staircase"*, and of the eye, *"way too
  low and I should have to work for [it] by climbing around a spiral
  staircase."* He chose the helix over a stair-wrapped tower and over merely
  raising the eye. **The 90° sweep is NOT negotiable** — that sweep is
  Quarter-Same's own phase offset performed with the visitor's body.
- **The Moon is the cosmic scene.** (2026-08-05) *"Look at my scenes package.
  Find cosmic. That's the moon."* Sky borrowed from cosmic; ground stays local
  because the cosmic floor is a performance stage.
- **The Moon's words are the Quarter-Opposite PAIRS: MP, NQ, OR.** (2026-08-05,
  Austen) *"seriously bro that was something you coulda looked up easy."* He
  said "four" and named three; the room is built for three, with the fourth
  compass point given to the arrival hole.
- **Mobile movement is analog, not thresholded booleans.** Chosen because a
  switch cannot ease up on a 1.5 m stair over a drop.
- Everything in the morning handoff's "Decisions already made" still stands:
  Sun is Dawn not heat; the visitor's walk drives the day; the shadows are the
  exhibit; the modality is expressed as material throughout the room; ornament
  grammar is wing-wide and derived from VTG; departure is at noon.

---

## Gotchas

**Quarter-Opposite PAIRS; it does not repeat.** MPMP/NQNQ/OROR all score 1.00
with continuity + handPath. Single letters (MMMM…RRRR) score 0.25–0.63 and
satisfy nothing. I burned six MCP calls learning this. Ask for the pairings.

**Anything the graybox draws as floor MUST be walkable in `blockedAt`.** This
bit twice in one session (the Sundial's crack, and it is why the Moon exports
`doorBand` so its graybox and predicate share one band). Both layout headers
claim it is impossible by construction — it is only impossible if a test checks.

**A throw inside a Threlte group silently deletes the whole group.** Reading
`cosmic.particles.effects.meteorStreaks` — `effects` is absent on the night
variant — took Earth, stars and nebula down with it. The frame looked like "the
feature didn't apply", not like a crash. One unhandled promise rejection was the
only evidence. Check the console before believing a screenshot.

**A room centre must be tile-CENTRED (`tileCentredOffset`), not rounded to a
tile boundary**, or station radii come out unequal.

**Clearance is measured edge-to-edge, not centre-to-centreline.** And biasing
the Sun crossing's start bearing to gain clearance makes it WORSE at one end
whichever way it turns (+8° took pillar T to 0.09 m; −8° did the same to U).
Compass-exact is provably optimal; clearance comes out of the widths.

**`CameraMovementController` in `packages/camera-3d` is exported and unused.**
The museum's `UnifiedCameraController` has its own inline movement. I edited the
service first; it was dead code and I reverted it.

**`UnifiedCameraController` builds its own `createInputCapabilities()` inside
the package**, so pointer events it sees never reach the app-side singleton and
`currentPointerType` stays `null` forever. `shouldShowTouchUI()` cannot work
from outside — use a coarse-pointer media query.

**`VirtualJoystick` speaks `TouchEvent`, not `PointerEvent`**, and its `y` is
already inverted (up is +1). The procedural-engine consumer passes it straight
through as `z`; follow that rather than reasoning about screen space.

**Two `UnifiedCameraController.svelte` copies exist.** The museum resolves
`@austencloud/camera-3d` to `packages/camera-3d/src/` via the `"svelte"` export
condition. Editing `src/lib/shared/3d/camera/` is a silent no-op for the museum.

**`minInteriorWidth`/`Height` are NOT tiles.** Interior metres =
`ceil(minInterior × 1.5) × 0.5`. Measure the compiled grid with a throwaway
vitest; delete it after.

**A stale tab wedges Chrome DevTools MCP** — every call including `list_pages`
fails with `Network.enable timed out`. Close it via
`http://127.0.0.1:9222/json/close/<id>`, ids from `/json/list`. This cost a
full diagnosis round.

**DevTools MCP cannot grab pointer lock**, so you cannot pitch the camera. Seed
position and yaw via the `museum-cave-3d-state-v1` sessionStorage key in a
navigation `initScript`; **yaw 0 faces +Z (south)**. The route overrides
`viewMode`, so you cannot force top-down through the seed. Pitch is Austen's job.

**No expert agent owns this canon.** `.claude/rules/expert-routing.md` covers
arrows, props, TKA domain, decks, feedback, a11y, audits and release notes —
Vulcan Cave room design belongs to none of them, so no expert `.md` needed
updating. If a museum-room expert is ever created, this handoff plus the two Sun
design docs and `moon-layout.ts`'s header are its seed material.

**Commit with an explicit pathspec.** The tree holds several sessions' work at
once; a bare `git commit` sweeps other agents' files into yours.

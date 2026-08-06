---
status: handoff
value: 4
effort: M
remaining: 'All six chambers exist and are walkable. The Sun noon-shadow gate is unproven and needs Austen at the summit looking DOWN. The Moon low-gravity jump arc is unverified. The Sun-to-Moon transition does not exist yet.'
depends_on: 'docs/superpowers/plans/2026-08-05-sundial-graybox.md'
plan_path: 'docs/superpowers/plans/2026-08-05-sundial-graybox.md'
tags: [museum, vulcan-cave, sun, moon, mobile, handoff]
last_triaged: 2026-08-05
---

# The wing is complete — Handoff (2026-08-05, evening)

Supersedes the morning handoff
[2026-08-05-vulcan-cave-sun-room-handoff.md](file:///E:/tka-platform/docs/superpowers/specs/2026-08-05-vulcan-cave-sun-room-handoff.md)
for everything below. That document's design decisions all still stand; only its
"Loose ends" are stale.

Walk it: [localhost:5173/test/museum-cave-3d?room=cave-sun](https://localhost:5173/test/museum-cave-3d?room=cave-sun)
(**:5173, not :5174**.)

---

## Landed this session

All on `main` in the primary checkout. Every commit used an explicit pathspec.

| Commit | What |
|---|---|
| `c8dab5f060` | Sundial built: `sundial-layout.ts`, `SundialGraybox.svelte`, 11 tests |
| `8be81b165f` | Chamber teleport stopped dropping the visitor into the collapse pit |
| `1d29118a59` | Walkway ran through pillar T; lift read as falling |
| `1f4a922f94` | The crossing became a real spiral staircase |
| `684d5099cf` | The museum is walkable on a phone |
| `3d6ce9a580` | The light crack was mostly invisible wall |
| `75ceb51cee` | The Moon, and the first step off the Sun's stone |

### The Sun room, as built

A ⌀24 m chamber. Rim walk at −0.4 (r 9–12), a collapsed ring floor at −4.0
(r 4–9) that is seen and never walked, and a **helix stair** climbing 6.4 m from
the rim to a summit at **+6.0**, sweeping exactly 90°. Four Quarter-Same
performers (SSSS/TTTT/UUUU/VVVV) on caps at **+2.6**, so you pass them at eye
level climbing and look down on all four from the top. The eye lifts from the
summit to a hatch at +15.4.

**The sun is driven by the visitor**, and this is measured, not assumed. On the
north rim (r=10.5) the light sits at `(99.5, 12.5, 40)` — 18° elevation, on the
visitor's own bearing. Near the centre it is at `(99.5, 39.1, 86.5)` — 73°.

### Mobile traversal (wing-wide, not Sun-specific)

Before `684d5099cf` **no cave room was walkable on a phone**. Look worked; every
movement path reads `heldKeys` and a phone cannot fill it. The shared
`VirtualJoystick` now drives both paths: first-person via a new analog
`moveAxis` prop on `UnifiedCameraController`, and the 2D top-down mode via
synthesised WASD. Measured analog: full push 0.60 m, half push 0.28 m over the
same interval.

---

## The open question — Austen's call, and it needs his eyes

**Does the noon frame read as notation?** This is Task 5 Step 4 of the plan, the
room's own gate, and it is still unproven.

The first (flat) graybox failed it outright: from a centre disc at −0.2 the prop
shadows landed on the ring floor at −4.0, in a pit, behind the pillars,
invisible from the one place the thesis needed them seen. **The helix probably
fixes this** — from a summit at +6.0 the visitor is ten metres above that ring,
looking down at it, which is exactly the top-down projection the design asks
for. I could not verify it: Chrome DevTools MCP cannot grab pointer lock, so the
camera cannot be pitched downward. Austen can do it in five seconds.

If it still does not read, the room needs rethinking rather than polishing. Say
so plainly.

---

## The Moon — LANDED (`75ceb51cee`)

**The wing is complete: all six chambers exist and are walkable.**

A ⌀20 m plain in a 22.5 m bay, under an open black sky. One hard white key light
at 22° with `castShadow`, against a hemisphere at **0.05** — the Sun room runs
0.55, and that ratio is the whole difference: no atmosphere, no scattered light,
shadows to near-black. Verified in-browser at 1920×1080: the plain reads bone
white, the mounds throw long hard-edged shadows, and the shadowed side of a
performer goes to silhouette. It looks nothing like the Sun room, which is the
entire point of the pair.

The arrival is a real hole — the plain is a `ShapeGeometry` with a `Path` hole
cut at the arrival point, so the Sun's shaft is seen THROUGH the floor rather
than decalled onto it.

**Three stations, not four, and that is a design answer rather than a
shortfall.** The west compass point is the arrival hole, so the plan mirrors
about the axis the visitor surfaces on: N and S reflect into each other, E sits
on the axis, the visitor stands at its far end. `moon-layout.ts` throws if a
station is ever placed on the hole, and the reasoning is written into
`MOON_STATIONS` so a later session does not "fix" it by adding a fourth.

Its `cave-moon` also moved from the solo-chamber list into `BAY_ROOM_IDS` in
`vulcan-cave-floor-plan.test.ts` — the room genuinely changed category, and the
wing now has no solo chambers left. That is not a loosened assertion.

**The pairings**, from Austen, all verified through the Flow Arts MCP with
`constraintPreset: "smooth"` — 5 steps, gamma3→gamma3, score 1.00, continuity +
handPath, every beat `timing: quarter` / `direction: opp`:

| word | closes | score | satisfied |
|---|---|---|---|
| **MPMP** | gamma3 | 1.00 | continuity, handPath |
| **NQNQ** | gamma3 | 1.00 | continuity, handPath |
| **OROR** | gamma3 | 1.00 | continuity, handPath |

That is three pairs across all six letters M–R. Austen said "the four moon words
are MP, NQ, and OR" and named three; the room is built for three, with the
fourth point given to the arrival.

Do NOT repeat my mistake of testing MMMM/NNNN/OOOO/PPPP/QQQQ/RRRR: those score
0.25–0.63 and satisfy nothing. **Quarter-Opposite pairs; it does not repeat.**
Ask for the pairings rather than enumerating single letters.

**Unverified on the Moon:** the low-gravity JUMP ARC. The scale factor, the
boundary predicate (`isLowGravityAt` — normal gravity on the Sun-stone plinth,
lunar one step off it) and the wiring are all unit-tested and the prop reaches
`UnifiedCameraController`, but nobody has jumped and watched the hang time. That
needs pointer lock and a keypress in a live window.

---

## Loose ends, ranked

1. **The noon gate** (above). Everything else is polish next to it.
2. **The Sun→Moon transition does not exist.** The eye lifts you to the hatch
   and nothing happens — no teleport into the Moon. Until that lands, the Sun's
   east door must stay: `buildCirculation` resolves the `sunToMoon` edge to a
   real door tile and **throws** without one. Delete it in the same change that
   lands the transition, never before.
3. **Above the summit the chamber is unlit.** The wall is dark from +6 up, which
   matters because that is the whole ride.
4. **Frame cost never measured.** Task 5 Step 5. Other sessions' HMR kept
   reloading the page and a clean timing window never opened. Four rigs plus a
   moving shadow-caster is the heaviest room in the wing.
5. **The joystick is low-contrast** against the pale summit floor, and at 412px
   the back button and the "Look around" chip overlap in the top-left (that
   overlap is pre-existing, not from this session).
6. **The Moon has no design doc.** Its rationale currently lives only in
   `moon-layout.ts`'s header. Whoever writes it starts from the Sun doc's
   departure section, not from the concepts doc.
7. **`DimensionFlipProof`'s restore check still validates tile type only.** It
   does not consult `grid.terrain?.blockedAt`. Nothing seeds a terrain-blocked
   position any more, so it is currently harmless — but the next room with a
   terrain program and blocked interior ground will hit it.
8. **The elemental motif → element mapping** still needs Austen at
   `/test/element-motifs`.

---

## Traps that each cost a round this session

**Anything the graybox draws as floor MUST be walkable.** The Sundial floored
the entire light crack and blocked all but a 6 m strip of it; Austen walked in
and hit an invisible wall on lit ground with the stair in plain sight. Both
layout modules claim in their headers that this is impossible by construction.
It is only impossible if a test checks it — there is one now.

**A room centre must be tile-CENTRED, not rounded to a tile boundary.**
`tileCentredOffset`, not `Math.round(m / TILE) * TILE`. The boundary version put
the Sundial's centre 0.25 m off its own performer ring.

**Clearance is measured edge-to-edge, not centre-to-centreline.** The guard
against a pillar standing on the walkway compared the pillar's centre against
the spiral's centreline using the pillar's radius as the tolerance — it ignored
the walkway's own width and reported clear while the walk ran 1.55 m through
pillar T. Also: biasing the crossing's start bearing to gain clearance makes it
WORSE at one end whichever way it turns; compass-exact is provably optimal, and
clearance comes out of the widths.

**`CameraMovementController` in `packages/camera-3d` is exported and unused.**
The museum's `UnifiedCameraController` has its own inline movement. Editing the
service is dead code.

**`UnifiedCameraController` builds its own `createInputCapabilities()` inside
the package**, so pointer events it observes never reach the app-side singleton
and `currentPointerType` stays `null` forever. `shouldShowTouchUI()` cannot work
from outside. Use a coarse-pointer media query.

**`VirtualJoystick` speaks `TouchEvent`, not `PointerEvent`**, and its `y`
arrives already inverted (up is +1). The procedural-engine consumer passes it
straight through as `z`; follow that rather than reasoning about screen space.

**A stale tab wedges Chrome DevTools MCP.** Every call, including `list_pages`,
fails with `Network.enable timed out`. Close the offender via
`http://127.0.0.1:9222/json/close/<id>`, ids from `/json/list`.

**Chrome DevTools MCP cannot grab pointer lock**, so you cannot pitch the camera.
Seed position and yaw via the `museum-cave-3d-state-v1` sessionStorage key in a
navigation `initScript`. **yaw 0 faces +Z (south).** Pitch is Austen's job.

**`?room=` seeds the spawn but the route overrides `viewMode`** — you cannot
force top-down through the seed.

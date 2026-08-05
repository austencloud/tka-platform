---
status: active
value: 4
effort: L
remaining: 'Design approved 2026-08-05. No code. Next is a graybox that proves three things in order: the polar sun mapping is legible, the visitor-cast shadow reads, and four rigs plus a moving shadow-caster hold frame rate.'
depends_on: 'docs/superpowers/specs/2026-08-04-vulcan-cave-all-rooms-concepts.md'
plan_path: ''
tags: [museum, vulcan-cave, sun, design]
last_triaged: 2026-08-05
---

# The Sun Room — "The Sundial" — Design (2026-08-05)

## What this replaces

The Sun chamber has been a round room with an oculus and a sweeping beam that
lit one of four performers at a time. Austen rejected that mechanism in
principle on 2026-08-05: *"I'm not sold on the whole notion of a spotlight beam
revealing one performer at a time ... but it's better than anything I have right
now."*

This document keeps the round plan, the four performers, the collapse ring and
the rib bridge, and replaces the mechanism underneath them. The beam is gone.
Nothing hides anything.

Brainstormed with Austen 2026-08-05. Decisions taken in that session are in
**Decided** below and are not open.

## The thesis

**A pictograph is a shadow.**

A pictograph is a top-down projection of hand paths onto a grid. A sun directly
overhead is a top-down projector. Put a performer under a zenith sun and the
thing that lands on the floor beneath them is the notation — drawn in real
time, at full scale, by light.

Sun is the only room in the wing that connects the 3D performers back to the
notation the rest of the app is built on. That connection is the reason to
build it, and every other decision here serves it.

## The mechanism — you move the sun

The visitor's position in the chamber sets the sun, in polar coordinates:

| Visitor | Sun |
|---|---|
| Bearing from chamber centre, θ | Azimuth — **the sun is always at your back** |
| Distance from centre, r | Elevation — rim ≈ 8°, centre = 90° |

Two consequences carry the room.

**The sun is at your back, so every shadow in the room agrees with yours.** All
shadows from a single directional light are parallel. With the sun behind the
visitor, all four performers' shadows and the visitor's own run away from the
visitor, into the room, converging in perspective. Stand on the north rim and
the whole room points south.

**Walking inward is walking toward noon.** At the rim the sun is low and the
shadows are enormous. At the centre it is overhead and they retract to the
performers' feet. The mapping has exactly one singularity — azimuth is
undefined at r = 0 — and it sits precisely where azimuth stops mattering,
because the sun is at zenith.

Nobody has to be told any of this. The visitor's own shadow is on the ground in
front of them from the moment they enter, and it moves when they move. It is
the tutorial, and it is why a first-person visitor needs a shadow-casting
proxy (see New tech).

### Why this is not the rejected beam

The beam decided what the visitor was permitted to see, one performer at a
time, on a clock the visitor did not control. Here every performer is lit and
visible at all times, nothing is ever concealed, and the only thing the light
changes is the *drawing* — where the shadows fall, how long they are, and what
they resolve into. The visitor drives it by walking.

## Room program

Enter north (`airToSun`), exit east (`sunToMoon`) — matches the existing wall
definitions in `vulcan-cave-floor-plan.ts`.

| # | Station | Dims | Floor Y | Walkable |
|---|---|---|---|---|
| 1 | Rising light crack (north) | 10 m run, 2.5 m wide | −1.2 → −0.4 | yes |
| 2 | Outer rim walk — **full circle** | 3 m wide annulus | −0.4 | yes |
| 3 | Annular collapse ring | 5 m gap | −4.0 (visual) | **blocked** |
| 4 | Rib bridge (single crossing) | 6 × 2 m | −0.4 → −0.2 | yes |
| 5 | Centre disc | ⌀ 8 m | −0.2 | yes |
| 6 | Four pillars, N/E/S/W of the ring | ⌀ 1.2 m shafts, ⌀ 2.2 m caps | cap +0.4 | blocked |
| 7 | Exit crack to Moon (east) | 7 m run, 2.5 m wide | −0.4 → −0.8 | yes |

Chamber ⌀ ≈ 24 m. Bay ≈ 32.5 × 34.0 m including both cracks, which is
`minInteriorWidth: 43`, `minInteriorHeight: 45` under
`metres = ceil(minInterior × 1.5) × 0.5`. **Measure the compiled grid rather
than trusting these numbers** — a wrong comment in this exact file once put Air
at 17 × 24 m when it compiled to 25.5 × 36.

Three changes from the earlier program, each load-bearing:

1. **The rim walk is a full circle, not two arcs.** Azimuth control needs 360°
   of walkable bearing. This is the room's primary interaction surface.
2. **The centre is a ⌀8 m disc, not a ⌀6 m boss.** The visitor needs room to
   circle a near-zenith sun and watch short shadows rotate, which is the
   room's second read.
3. **The collapse-ring floor is the page.** Pale sandstone, the brightest and
   most uniform surface in the chamber, unbroken under each pillar. It exists
   to receive the noon shadows.

The rib bridge sits at one bearing, so crossing it holds azimuth constant and
raises elevation only: the sun climbs vertically while the visitor walks. That
is a legible authored move, not a limitation.

## The two frames

**At the rim, low sun.** Four shadows thrown twenty metres up the curved
chamber wall — enormous, parallel, spinning at quarter-phase offsets, with the
visitor's own among them. The wall is the wall-plane read.

**At the centre, zenith.** The shadows retract until each performer's prop path
is projected straight down onto the ring floor at the base of their pillar:
four discs of notation, roughly ⌀3 m each, at the four compass points, ringing
the visitor at and just below their own level. The same four-step loop at four
rotations. The visitor's own shadow is a puddle at their feet — noon erases
you.

The room is the walk between those two frames, and it is reversible.

**Distinct from Earth.** Earth is one sustained look *down* at a trio six
metres below, across a chasm, in an enclosed chamber. Sun's diagrams ring the
visitor at their own level, there are four of them, they are made of light, and
the visitor drew them.

## Content — Quarter-Same, verified

Four performers, one per compass point, running the four Quarter-Same letters.
Confirmed by the Flow Arts MCP on 2026-08-05:

- **STUV is Quarter-Same**, the only VTG group with four letters. Same-direction
  shifts at a right angle have a leader and a follower, so the hybrid splits
  into **U (leader pro)** and **V (leader anti)**. Quarter-Opposite (M–R) has no
  leader/follower. (`get_letter_explanation`, S and U.)
- `get_sequence_data` with `constraintPreset: "smooth"` for **SSSS, TTTT, UUUU,
  VVVV**: each compiles to a **4-step loop, score 1, perfect continuity, no
  reversals, 100% hand-path satisfaction**, and each closes on its own start —
  S and T on `gamma3`, U and V on `gamma11`. All four autoplay cleanly.

Two things fall out of that data and both are used:

1. **Four steps, four stations.** Offset each performer's playhead by one step
   and the quarter-phase relationship becomes the angle around the room. The
   content does not need to be arranged into a diagram; it already is one.
2. **The closing positions split STUV into two axes.** S and T share `gamma3`;
   U and V share `gamma11`. So **U opposite V** (the leader/follower inversion
   mirrored across the centre, as the concepts doc wanted) and **S opposite T**
   on the cross axis, now with a data reason rather than an aesthetic one.

Station assignment: U north, V south, S east, T west. Faced inward at the
centre.

Registry work: `cave-sun` currently carries a single `cave-sun-automaton` /
`cave-sun-seq` and `minInterior 7 × 7`. It needs four performer and sequence
entries in the shape Fire and Air already use
(`cave-sun-automaton-s|t|u|v`, `cave-sun-seq-s|t|u|v`) in
`vulcan-cave-floor-plan.ts`, `museum-room-content.ts` and
`museum-exhibit-sequences.ts`.

## Light, colour and the handoff to Moon

One directional light. Its direction is derived from the visitor each frame;
nothing else in the room moves it.

| Sun elevation | Colour | Fill | Reading |
|---|---|---|---|
| ≈8° (rim) | deep amber | warm bounce off the sandstone | dawn / dusk |
| ≈45° (bridge) | gold | dropping | mid-morning |
| 90° (centre) | white-gold, hardest | near none | noon |

The sky aperture is a **collapsed roof** — the chamber's dome has fallen in,
leaving a wide ragged opening. Not an oculus: an oculus is a small hole and
cannot justify a sun that reaches 8° elevation. This also keeps Sun clear of
Earth's canyon-rim vocabulary, since the opening is overhead and ragged rather
than a rim you stand on.

**The dusk handoff.** The exit crack to Moon is east. Walking out of the chamber
toward it pushes r back toward the rim and drops the sun to the horizon behind
the visitor: the room goes red, then dim, and the visitor enters the final tube
at nightfall. Moon's approved lighting is a hard sun key with Earthshine fill
and no atmospheric scatter — the same physics one step further. **The wing's
day ends in the Sun room and Moon is the night on the other side of the tube.**
This is the strongest sequencing argument the wing has and it should survive
into interpretation copy.

Sun keeps its audio bed. Moon has none — silence starts at the Moon threshold,
not here.

## Wing grammar

- **The sixth verb.** Under water → around fire → atop earth → carried by air →
  **you move the sun** → and on the moon you weigh nothing. Sun is the only
  room where the visitor operates the element instead of being subject to it.
  Air's lift is scripted and involuntary; this is continuous and driven.
- **Axis.** Water horizontal-through, Fire horizontal-across, Earth
  vertical-down, Air vertical-up, Sun **radial**, Moon outward-unbounded. No
  two adjacent rooms share a dominant axis; unchanged.
- **Pacing.** Sun is a release, but it no longer has to be the wing's peak —
  Moon took bright-and-open on 2026-08-05. Sun's release is *warmth and
  agency*, not scale.

## Reuse map

Mandatory per the standing directive: inventory the existing element scenes and
the ~500 GLBs under `static/models/` before authoring anything new.

| Need | Reuse |
|---|---|
| Volumetric shafts through the collapsed roof | `scenes/celestial/GodRays.svelte`, `scenes/ocean/runtime/atmosphere/GodRayShafts.svelte` — animate the sun direction, not the mesh |
| Pillar profiles / instancing | `scenes/celestial/CelestialPillars.svelte`, `scenes/ember/ObsidianPillars.svelte` |
| Mineral detail on the ring floor | `scenes/cosmic/CrystalFormations.svelte` |
| Dust in the shafts | `environments/primitives/FallingParticles.svelte` |
| Warm grade | `MuseumPostProcessing.svelte` |
| Heat shimmer at noon (Phase 2 only) | `scenes/ember/HeatDistortion.svelte` |
| Layout contract, tests, graybox structure | `first-fire-layout.ts` and `air-chimney-layout.ts` — one geometry source; a rect the graybox draws that the layout module does not know about is a bug by construction |

Geometry lives in a new `src/lib/features/museum/data/sundial-layout.ts`
exposing `elevationAt` / `blockedAt` plus the rect lists the graybox renders,
matching the Air and Fire contract exactly.

## New tech (ranked by risk)

1. **A moving real-time shadow-caster.** The whole room. One
   `DirectionalLight`, `castShadow`, shadow camera fitted to the chamber
   bounds, 2048 map, PCF soft. Only the four performers and the visitor proxy
   cast. Long raking shadows at 8° over a 24 m chamber are the worst case for
   acne and peter-panning — bias and normal-bias need tuning against the rim
   frame specifically, not the noon frame.
2. **The visitor must cast a shadow.** First-person, so there is no body. Needs
   an invisible-to-camera, shadow-casting proxy at the player position. This is
   not decoration: the visitor's own shadow is how the mechanism explains
   itself.
3. **Circular blocking on a square tile grid.** The annulus, the round centre
   disc and the four pillars are new blocking predicates, and a route test must
   prove the rib bridge is the only crossing. Already flagged in the concepts
   doc as Sun's structural unknown.
4. **Four rigs in one room.** First time in the wing; Fire's three is the
   benchmark. Measure before art.
5. **Orientation loss.** A round room with a moving sun is the easiest place in
   the wing to lose the exit. The east crack needs a permanent warm cue that
   does not depend on the sun's current position.

## Graybox scope — what proves the room

In order. Stop and show Austen after each.

1. **Mapping legibility.** Grey box chamber, one moving directional light, one
   primitive performer, the visitor proxy shadow. Does anyone realise they are
   moving the sun? If not, nothing downstream matters.
2. **The two frames.** Four primitive performers on pillars, the pale ring
   floor, the bridge and the centre disc. Ride the rim frame and the noon
   frame. **The noon frame is the gate** — if the shadows on the ring floor do
   not read as notation, the thesis is wrong and the room needs rethinking, not
   polishing.
3. **Cost.** Four rigs plus the moving shadow-caster, measured against Fire.

No volumetrics, no colour grade, no ember kit until all three pass. Judge
legibility first — the same discipline the concepts doc already asked of the
beam version.

## Decided — do not re-litigate

- **The sweeping beam is dead.** Not parked; replaced.
- **Sun is Dawn, not heat.** Austen, 2026-08-05: *"I am kind of leaning toward
  Dawn I think that's the most interesting one and it means that it can
  transition into moon mode in an interesting way."* The room is a day, and the
  day handing over to Moon's night is deliberate.
- **The visitor's walk drives the day.** Not a clock, not station triggers, not
  a one-way trigger on entry.
- **The shadows are the exhibit.** Every performer stays lit and visible; the
  light changes the drawing, never the access.
- **Content, plan and performer count were all reopened and all came back.**
  Austen opened all three; four Quarter-Same performers on a ring survived on
  the merits, and the MCP data above is the reason.

## Open

1. **Elevation curve.** Linear in r, or eased so noon holds longer near the
   centre? Graybox question, one constant.
2. **Does the sun lag the visitor?** A short ease would feel like mass rather
   than a cursor. Untested.
3. **Ring-floor shadow scale.** ⌀3 m projected paths on a ⌀4 m disc is an
   estimate from staff length and hand radius; measure it in the graybox before
   fixing pillar spacing.
4. **Whether the four playheads are offset by one step or free-running.** The
   quarter-offset is the diagram, but four rigs in lockstep may read as
   mechanical. Judge in motion.

## Related

- `docs/superpowers/specs/2026-08-04-vulcan-cave-all-rooms-concepts.md` — wing
  concepts; the Sun section there is superseded by this document
- `docs/superpowers/specs/2026-08-05-vulcan-cave-air-room-handoff.md` — the
  room before this one, and the Gotchas list every Vulcan Cave session needs
- `.claude/rules/effects-earn-their-slot.md`, `never-hand-roll.md`

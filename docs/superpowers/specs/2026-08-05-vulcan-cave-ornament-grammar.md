---
status: active
value: 4
effort: M
remaining: 'Grammar derived and agreed 2026-08-05. No code. Sun is the first room to build ornament from it; the three built rooms (Water, Fire, Earth) predate it and are not retrofitted.'
depends_on: 'docs/superpowers/specs/2026-08-04-vulcan-cave-all-rooms-concepts.md'
plan_path: ''
tags: [museum, vulcan-cave, ornament, vtg, design]
last_triaged: 2026-08-05
---

# Vulcan Cave — Ornament Grammar (2026-08-05)

## The problem this solves

Austen, 2026-08-05: *"I want to have artistic representations of the specific
modality that each room represents everywhere in the room ... embedded into the
walls or into the floor or into the ceiling."*

Before this document, each room's ornament would have been invented separately —
six unrelated art directions, six chances to drift, and no reason for any of it
beyond taste. The wing already contains a rule that decides it. Nobody had
written the rule down.

## The wing is a 3 × 2 grid

The six Vulcan Cave rooms are not six arbitrary elements. They are every
combination of VTG phase offset and direction, and the six element names sit on
top of that structure.

Grounded in the Flow Arts MCP (`get_term_definition`, 2026-08-05). **The three
VTG "timings" are phase offsets, not durations:**

| VTG timing | Phase offset | Position family | MCP wording |
|---|---|---|---|
| Together (tog) | 0° | beta — hands at the same point | "both props pass through the downbeat (south) at the same moment" |
| Quarter | 90° | gamma | "a 90-degree phase offset between hands, NOT a timing or duration change" |
| Split | 180° | alpha — hands at opposite points | "the two props are 180 degrees out of phase" |

Crossed with direction, that is the wing:

| | Same direction | Opposite direction |
|---|---|---|
| **0°** (beta, tog) | **Earth** — GHI | **Air** — DEF |
| **90°** (gamma) | **Sun** — STUV | **Moon** — M–R |
| **180°** (alpha, split) | **Water** — ABC | **Fire** — JKL |

Letter groups per MCP `get_letter_explanation`: Type 1 is organised as
Split-Same (ABC), Together-Opp (DEF), Together-Same (GHI), Split-Opp (JKL),
Quarter-Opp (M–R), Quarter-Same (STUV).

## The rule

**Phase offset sets the rotational order. Direction sets whether a mirror
exists.**

- A 90° offset closes after four copies; 180° after two; 0° coincides.
- **Same-direction is chiral** — pure rotation, no reflection. It turns.
- **Opposite-direction introduces reflection** — the mirrored partner is
  present, so the figure holds still.

| Room | Offset | Direction | Symmetry | Reads as |
|---|---|---|---|---|
| Earth | 0° | same | unison / translation | Weight. Repetition without variation. |
| Air | 0° | opposite | single mirror axis | A pair facing each other. |
| Water | 180° | same | two-fold rotation, no mirror | A slow pinwheel. |
| Fire | 180° | opposite | two-fold with mirrors | Opposed, symmetrical, violent. |
| **Sun** | **90°** | **same** | **four-fold rotation, chiral** | **A pinwheel that turns.** |
| Moon | 90° | opposite | four-fold with mirrors | A fixed crystal. |

## Why this is worth trusting

Sun and Moon share the same 90° offset and differ **only** by whether a mirror
is present. Sun's brief — decided 2026-08-05 — is a day the visitor turns by
walking. Moon's brief, decided the same day, is total stillness: no moving
light, no audio bed, fixed Earthshine. A chiral form that turns and a mirrored
form that cannot are exactly those two briefs, and the symmetry groups were
derived from the domain rather than from the briefs.

The grammar is descriptive of what the rooms already are. That is the argument
for it.

## How it gets applied

1. **Ornament is generated, not modelled.** The Composer already produces
   mandalas, 3×3 grids with a rotation applied per cell, and 3D tunnels, and it
   can render tip effects with the prop and avatar hidden
   (`PerformerRig showAvatar={false} showProps={false}` — see the elemental
   motif harness at `src/routes/test/element-motifs/`). A room's ornament is
   its own sequence, rendered through its own symmetry.
2. **The rotation step is the phase offset.** Sun's grid rotates 90° per cell
   and closes after four. Water's rotates 180° and closes after two. Do not
   pick rotation steps by eye.
3. **Opposite-direction rooms must show the mirror.** If a room is
   opposite-direction and its ornament has no reflection in it, the ornament is
   wrong regardless of how it looks.
4. **Ornament must not fight the room's mechanism.** Sun is the live case: its
   exhibit is cast shadows, which need a pale uncluttered floor and real
   contrast. See the Sun design doc for how the two are separated by time of
   day rather than by space.

## Scope

- **Sun is the first room built to this grammar.** It is the proving ground.
- **Water, Fire and Earth predate it and are NOT retrofitted.** They are built
  and they work. Retrofitting is opportunistic, not owed, and should only
  happen if a room is being substantially reworked anyway.
- **Air is built but has no ornament pass yet**, so it can adopt the grammar
  when its art pass happens without any rework.
- Every room's Phase 2 art pass still starts with an inventory of the existing
  element scenes (`scenes/ember|ocean|cosmic|celestial|autumn`) and the ~500
  GLBs under `static/models/` before authoring anything new — standing
  directive, `never-hand-roll.md`.

## Open

1. **The wing labels a term MCP calls a misnomer.** `CAVE_MODE_ROOMS` carries
   `technicalMode: "Quarter-time / same-direction"` for Sun and Moon. MCP:
   *"A misnomer for gamma patterns (M through V) ... It was strapped onto VTG's
   framework by later practitioners ... In TKA, these patterns are simply the
   gamma letters."* Whether the museum should say "quarter-time" to visitors is
   Austen's call, not a bug to fix silently.
2. **Whether the grammar is visible enough to teach.** A visitor is not going
   to name a symmetry group. The claim is only that four-fold ornament in a
   four-fold room makes the modality *felt*. Unproven until a room is built to
   it.
3. **Tunnels have no home yet.** A tunnel is strongly axial and Sun is radial,
   so it fights that room. It likely belongs to Water (horizontal-through) or
   Air (vertical-up).

## Related

- `docs/superpowers/specs/2026-08-05-vulcan-cave-sun-room-design.md` — first room built to this
- `docs/superpowers/specs/2026-08-04-vulcan-cave-all-rooms-concepts.md` — the six rooms
- `src/routes/test/element-motifs/` — the harness that generates motif traces
- `.claude/rules/never-hand-roll.md`, `.claude/rules/mcp-ground-truth.md`

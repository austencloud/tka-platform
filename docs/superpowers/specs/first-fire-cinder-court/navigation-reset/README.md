# First Fire Cinder Court — Navigation Reset Proposal (2026-08-09)

Status: **SUPERSEDED 2026-08-09.** Austen approved this hub-and-spoke proposal
in the morning, then rejected the built result the same day: too many torches
placed "willy nilly", corridors that felt claustrophobic, and a green Earth path
already visible before the performers had been seen. He asked for the original
2026-08-06 torch procession back — "the one that goes just around loops where
you walk around each performer."

The live design is
`docs/superpowers/specs/2026-08-06-first-fire-torch-procession-design.md`. The
plan contract, Blender manifest, GLB, Gate 1 board and runtime review were all
rebuilt on it. The three defects above are addressed structurally: 60 torches
that all sit on the walked route, 4.5 m corridors, and an Earth path that is
both state-gated and hidden behind rock from every court.

Everything below is retained as the record of the rejected direction.

## The design in one line

One lit path at a time: a hub-and-spoke cave where the ember-cairn hub is the
only fixed landmark and the single active gate is the only red thing you can
see.

## What changed from the rejected room

- The open basalt forest is gone. The room is solid rock with **carved
  corridors** — you cannot get lost because there is nowhere else to walk.
- The hub is a 13 m circular chamber with a central ember cairn. Four gates on
  its rim (DJ NW, EK S, FL NE, Earth SE). Only the active gate burns.
- The three courts are differentiated: **DJ = canyon slot** (narrow, high,
  performer at the dead end), **EK = sunken bowl** (wide, low, performer below
  a rim ledge), **FL = chimney rotunda** (tall cylinder, vertical reveal).
- Fire is boundary and beacon only: gate jamb flames, wall-ledge flames at
  3.2 m along the active corridor, coals on the walked floor. The centreline is
  always clear rock.
- Encounter contract preserved: DJ (JDJD) → hub → EK (KEKE) → hub → FL (LFLF)
  → blackout → green growth corridor → Earth door.

## Artifacts

- `navigation-reset-plan.svg` — measured floor plan, numbered route 1–8, gate
  and camera markers.
- `frame-1..5-*.svg` — five computed eye-height (1.7 m) sightline frames:
  Water threshold, hub with exactly one lit gate, active fire corridor, court
  reveal after the bend, coals leading back to the hub.
- `index.html` — all six on one page.
- Generator: `scripts/generate-first-fire-navigation-reset-proposal.mjs`
  (deterministic; geometry lives only there until approval, then it replaces
  `first-fire-procession-plan.ts`).

These are filled-wireframe **geometric readability proofs**. Flame, coal, and
growth marks are diagram glyphs, not visual targets; the visual bar (emissive,
shadow-casting fire) is unchanged from the recorded decisions.

## Open on approval

- Replace the rejected procession plan + tests with this geometry.
- Regenerate Gate 1 board; Gate 0 still owes live performer-motion evidence.
- Record a superseding decision in museum tracker session `6S7U3amt1mpyqTYeqk6Y`
  (the earlier `lock it` decision `1bUBNo26hJpRq4Bf36gh` is superseded by the
  2026-08-09 rejection).

# QfT × Shape Matrix — reading TKA flowers as 2011 poi notation

**Date:** 2026-07-28
**Status:** Shipped
**Route:** `/notation/qft` — third mode, "From the matrix"

## The claim

TKA's shape matrix and Charlie Cushing's 2011 QfT notation describe the same
geometry in two notations written fourteen years apart. Any cell of the matrix
can therefore be written as QfT, and animated in it.

This is checkable rather than asserted. TKA counts a flower's petals as
`2·turns` for prospin and `2·turns + 2` for antispin
(`shape-matrix/domain/flower-signature.ts`). QfT counts them as `n − 1` for
inspin and `n + 1` for antispin (`notation/qft/qft-naming.ts`, derived from the
article's worked examples). Those are the same two formulas once
`n = 2·turns + 1` — which is also the numerator of the VTG ratio the matrix
already labels its axis with. Neither function knows the other exists;
`tests/unit/qft-flower-bridge.test.ts` asserts they agree on all 56 flowers of
the axis.

## Scope

The matrix's `large` size preset is 12 flowers per axis — diamond grid, turns
0/1/2, both styles, both orientations — giving 144 cells. Each cell has six VTG
realizations, so **864 distinct moves**, and all 864 are expressible.

## What the model needed

Two knobs, both native eight-point-compass quantities. QfT as published
describes ONE hand, so it never had to name where the hand starts or which way
it goes; with a second hand on the stage, the relationship between them is
exactly those two facts.

| Knob | Type | What it buys |
|---|---|---|
| `handPhase` | 0–7 eighths | VTG timing (together 0, quarter 2, split 4) and the 45°-rotated box grid (1) |
| `handDirection` | ±1 | VTG direction (same / opposite) |

Both default to the published behaviour (`0`, `+1`), so every existing table is
byte-identical — asserted in the test, and the 26 pre-existing model tests pass
untouched.

The substitution is one line in each place: hand index becomes `d·u + p`, prop
index becomes `p + phase + d·spinSign·downbeats·u`. The hand's sign multiplies
into the prop rate because `spin` is relative to the hand — without it,
reversing a hand would silently convert its inspin flower to antispin, a
different shape with a different petal count. `directionDrex`'s perpendicular
offset takes the same sign so it stays on the side the prop is actually heading.

## The mapping

`src/lib/shared/notation/qft/qft-flower-bridge.ts` — pure, no engine imports.

```
flowerToKnobs(f)
  downbeats = 2·f.turns + 1
  spin      = f.style === "pro" ? "inspin" : "antispin"
  phase     = f.ori === "out" ? 0 : 4
  handPhase = f.grid === "box" ? 1 : 0
  radius    = FLOWER_RADIUS

realizationToHands(blue, red, mode)
  blue unchanged in all six modes
  red.handPhase     += { T: 0, Q: 2, S: 4 }[timing]
  red.handDirection  = direction === "O" ? -1 : +1
```

Blue is left alone and red carries the whole relationship, so a cell's blue
reading is the same in all six modes — which is what makes the six comparable
at a glance.

### Radius

`FLOWER_RADIUS = 1`. `ENGINE_GRID_RADIUS = 150` puts the cardinal grid points at
the staff's half-length, so the hand circle and the prop are the same length and
the ratio is exactly 1 — which is also the radius every flower in the 2011 guide
is drawn at. Both are describing a prop swung at arm's length.

The mandala renderer's `MANDALA_STANDARD_TIP_DX = 120` would read as 1.25, but
that is a drawing convention for comparing fans against staves in one picture,
not a claim about the geometry. Not used.

### A degenerate corner, recorded not hidden

At radius 1 a 1:1 antispin has zero petal width — it is a straight line.
`isDegenerateLine` already knew this. So the matrix's four 0-turn antispin cells
draw flat. Both notations are right: TKA counts 2 petals by its rule, the
geometry says line. The test records it so nobody later "fixes" the stage into
explaining a flower that renders as a stroke.

## Components

- **`QftFigure.svelte`** (new) — one hand and its prop: hand path, swept sector,
  trail, tether, direction dart, prop compass. Split out of `QftStage` so a
  second hand costs one element rather than a second copy of the drawing code.
  Takes a `color` and `dartColor`; draws into the parent's user space.
- **`QftStage.svelte`** — now owns the picture as a whole: viewBox, the `reach`
  fit (unioned across hands), and the body compass every hand is read against.
  Keeps the single-hand props so the guide and the instrument pass through
  unchanged; `hands` overrides them. Body-compass origin markers tint per hand
  and hold a list, because in a duet two hands sitting on one number is
  precisely together timing.
- **`QftFlowerPicker.svelte`** (new) — one matrix axis, each flower previewed as
  the trail it actually traces, computed from the bridge. Twelve previews per
  axis rather than 144 per grid: a cell is really two independent choices, and
  the pair is drawn full size on the stage anyway.

## Layout decisions

- The cell pane reuses the instrument's `header / stage / knobs` shape, so its
  4K composition applies directly.
- **Reading column is wider than the guide's and instrument's**
  (`clamp(26rem, 46vw, 74rem)` vs `clamp(26rem, 32vw, 46rem)`). It carries two
  eight-row tables where they carry one. At the shared width the tables stacked
  and the pane ran past a screen and a half; the wider column also closes most
  of the dead rail the shared tier left at 4K. Consequence, accepted: the three
  modes no longer stay registered across the crossfade.
- **The duet's two-up threshold is a container query, not a media query.** The
  tables care about the column they sit in, not the viewport. Keyed to viewport
  it went two-up at 1440 where the column is 430px, producing ~200px tables with
  colliding RADIUS/ARRIVE headers and a `Prop` column clipped to `Pro`.
- **The picker chips are their own container.** The two axes sit side by side at
  the wide-and-short tier, which halves per-chip width without changing the
  column's. Under 34rem the petal count drops and `in`/`out` stays — the two
  differ by a half turn of prop phase, so the traced shape looks the same and
  the word is the only thing distinguishing them.
- **Wide-and-short (fold landscape) hides the two tables.** The pane is ~220px
  there; eight rows of seven numbers, twice, is not notation anyone can read at
  that height. Same call the guide makes with its quote. Revisit when the
  controls move into a bottom dock.

## Verification

- 45/45 unit tests across `qft-flower-bridge`, `qft-model`,
  `notation-qft-diagram-contract` — including a sweep of all 864 realizations
  asserting every derived value lands on the compass.
- `svelte-check` clean.
- SSR 200 on cold load.
- Screenshotted at 4266×2323, 2133×1200, 1440×900, 1066×457, 820×1180,
  375×667. Guide mode re-checked after the `QftFigure` extraction and renders
  identically.

## Not in this pass

The toy redesign: `ControlDock` replacing the two chip rails, and click-the-
animation to play/pause instead of a Pause button. Separate spec, on top of this.

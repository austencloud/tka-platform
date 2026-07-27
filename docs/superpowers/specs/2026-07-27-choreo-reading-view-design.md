# Choreo Reading View — the act on a phone

**Date:** 2026-07-27
**Status:** shipped
**Follows:** `2026-07-26-choreo-mcp-and-performance-variants-handoff.md`

---

## The problem

Every size in the sheet preview derives from `--pt: 100cqw / pageWidthPt`. A
landscape US-Letter page inside a 375px viewport therefore renders at 303px, and
takes all of its content down with it:

| | at 375px |
|---|---|
| Pictograph cell | 32px |
| Cue rail | 24px |
| Timestamp text | 4.2px |
| Cue text | 4.0px |
| Note text | 3.6px |

No CSS rescues this, because uniform scaling *is* the model. The only fix is to
stop scaling and reflow.

## Why it was not possible before

Reflowing means re-chunking bands at a different column count. Until
`67d4ca3103`, cues and notes stored a band-relative address (`band` +
`count`), both functions of `layout.columns` — so re-chunking scrambled every
annotation. Now they carry an absolute `stepIndex` and the planner derives
`(band, count)` at render time, which makes re-chunking free and exact.

The reading view is a direct payoff of that fix.

## Shape

Two view modes, chosen by a `SegmentedControl` in the toolbar:

- **Page** — the existing faithful print preview. Unchanged.
- **Reading** — the same act reflowed: bands stacked vertically, sized in
  `rem`/`px`, pictographs in a grid.

A phone defaults to Reading, desktop to Page. An explicit choice wins and
persists to `localStorage` under `tka-choreo-view-mode`.

**The mode is never written to `sheet.layout`.** That object is the print model;
what prints must not depend on how wide the window happened to be.

## One band-building implementation

`sheet-row-planner.ts` splits into:

```
buildBands(input): SheetBand[]      chunking + annotation resolution
planBands(input): SheetBandPage[]   buildBands + height pagination
```

Reading view calls `buildBands` with `getSheetPageLayout({ ...layout, columns })`
at its own column count. Same pure function, different input — no second
implementation of chunking or annotation placement. This is deliberate: the
page-chrome bug in this module happened when a third surface grew its own layout
math. `tests/unit/sheet-band-planner.test.ts` asserts
`buildBands(x) === planBands(x).flatMap(p => p.bands)`.

## Column count is the caller's

The grid renders `repeat(var(--rb-cols), 1fr)` where `--rb-cols` is the count the
bands were **built** with, passed as a prop. A media query may never change it —
a CSS-only override leaves a 4-cell band sitting in an 8-track row.

- `< 700px` → **4 across**, a 79px cell at 375. Validated by rendering real
  pictographs at 64/83/96/113px and looking: 79px keeps arrows, grid dots,
  letter, and step number legible.
- `≥ 700px` → **8 across**. Wider screens get *more* pictographs, never bigger
  ones; at 960px, 4 columns produced 215px cells that wasted the viewport.

4 also divides cleanly — TKA sequences are near-always multiples of 4, so 8- and
16-step sequences chunk without a ragged last row.

## Badges are step numbers, not counts

A note's badge shows `stepIndex + 1` — the number printed on the pictograph it
refers to. `count` is a within-band column that differs per column count, so a
badge reading "1" beside a cell labelled "5" is worse than no badge. Cues merged
into one band by a wider layout carry the same step badge.

## Editing

Same callbacks as the page preview (`onSetCue`, `onAddNote`, `onSetNote`,
`onRemoveNote`) — no new state surface. The affordances differ because the
targets do:

- **Pin a note:** tap its pictograph. The cell is a real 79px target, replacing
  eight invisible column strips. The new note takes focus, so add-and-type is
  one gesture.
- **Bullet:** one `＋ note` button per band.
- Inputs are 16px (below that iOS zooms on focus) with a 44px touch floor.

The note list also sidesteps the adjacent-pin overlap that exists in the page
view — a list cannot collide with itself.

## Verified

375 / 820 / 960×412 in Reading; 1440 / 1920 / 2560 / 3840 in Page. No horizontal
overflow at any width, every touch target ≥44px, page mode byte-identical.
103/103 choreo tests pass.

## Not done

- **Adjacent pinned notes overlap in the PAGE view** (~100px at 1920): `.pin` is
  239px against a ~140px column stride. Pre-existing; a correct fix has to cover
  the PDF's text drawing too.
- Reading view has no print/PDF path, by design — Page owns that.

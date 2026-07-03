# Choreo Annotated Sheet — Design

**Date:** 2026-07-02
**Module:** `src/lib/features/write` (Choreo)
**Status:** approved (visual sketch reviewed), ready for plan

## Problem

The choreo sheet today is a dense grid of step-pictographs — good for study, but it
is not the performance document Austen actually choreographs from. His real acts
(1940, All Eyes On Me) are annotated sheets: a **left rail** of musical timestamps +
lyric cues, an 8-count grid of pictographs, and a **note strip** under each row for
free-form choreography actions ("Pirouette to left, pass staff into left hand"),
plus a **page header** (title block on page 1, running header after). This design
adds that annotation layer to the sheet, in both orientations, for screen preview
and PDF export.

Reference artifacts (rasterized to sketch): `D:\_THE KINETIC ALPHABET\_ACTS\1940\`,
`…\All Eyes On Me\`. Sketch reviewed at
`static/sketches/2026-07-02-choreo-annotated-sheet.html`.

## Decisions (locked)

From the sketch review:

1. **No separate counts row.** The step number is already rendered inside each
   pictograph (`stepNumberOverride` → `StepNumber`). Do not add a row of 1–8 count
   labels above the cells. Drop the `countStyle` toggle for v1.
2. **Rail = timestamp + lyric cue, in the left column.** Per row-band. Timestamp
   italic + tabular; cue italic text under it.
3. **Note strip = free-form action notes, flexible height.** Base height ≈ 0.5× a
   cell; a band grows taller when its notes need more than one line. Notes are
   either full-width bullets or pinned to a count column.
4. **Flexible band height, content-driven pagination.** Rows-per-page is NOT a fixed
   number. Landscape targets ~4 bands with header + notes, but any band may grow;
   the planner packs bands until the page's usable height is full, then breaks.
5. **Both orientations**, a layout setting (`orientation` field already reserved).
6. **Header:** page 1 = full title block (act name, "Choreography by", "Song by",
   tagline, date, corner page number). Page 2+ = running header (song name,
   page-start timestamp [derived], page number). No title-block repeat.
7. **Row-aligned packing in annotated mode.** Each sequence starts a fresh row-band;
   a 12-step sequence = 2 bands (8 + 4). This matches the real sheets (each labeled
   8-count is one coherent phrase) and gives annotations a stable anchor. The
   existing dense **continuous-flow** packing (sequences straddle rows) remains the
   non-annotated study layout, selected by `packing: "flow" | "aligned"`.
8. **Timestamps: BPM prefill + editable.** Each band's timestamp is auto-computed
   from the act's BPM (band's first-step beat index ÷ BPM) as a starting value; the
   user can overtype any of them. Cue and note text are always hand-typed.

## Data model

Annotations live on the sheet document (persisted, not derived), anchored to a
stable **band key** so they survive sequence insert/remove/reorder.

```ts
// domain/types/choreo-sheet.ts (extended)

type BandKey = string; // `${sequenceId}:${rowInSequence}` — sequence + its local row

interface CueMark {
  band: BandKey;
  timestamp: string;   // "0:42", user-editable, BPM-prefilled
  text: string;        // lyric / musical cue, e.g. "so rise"
}

interface NoteMark {
  band: BandKey;
  count: number | null; // 1..columns to pin under a column; null = full-width bullet
  text: string;
}

interface SheetHeader {
  songName?: string;
  choreographer?: string;
  songArtist?: string;
  tagline?: string;
  date?: string;
  showTitleBlock: boolean; // page-1 title block on/off
}

interface ChoreoSheetAnnotations {
  cues: CueMark[];
  notes: NoteMark[];
  header: SheetHeader;
}

// ChoreoSheetLayout gains:
//   orientation: "landscape" | "portrait"   (now live)
//   packing: "flow" | "aligned"             (aligned enables annotations)
//   showCueRail: boolean
//   showNoteStrips: boolean

// ChoreoSheet gains:
//   annotations: ChoreoSheetAnnotations
//   bpm?: number       (for timestamp prefill; sourced from the act when present)
```

`BandKey` = `sequenceId:rowInSequence`. Because annotated packing is row-aligned,
`rowInSequence` is stable: sequence X's 2nd row is always its steps 9–16 regardless
of what sits before it. Reordering sequences carries their cues/notes along. A
`NoteMark.count` beyond a band's actual step count (short final row) renders
full-width instead of pinned (graceful).

## Geometry

`sheet-page-layout.ts` — one function, branch on `orientation`, and return the new
fields. A **band** = one pictograph row + its note strip + inter-band gutter. The
rail is a fixed-width left column spanning the band's pictograph-row height.

```
pageW/pageH:  landscape 792×612pt, portrait 612×792pt
railWidthPt:  showCueRail ? ~64pt : 0
cellSizePt:   (usableW − railWidthPt − (columns−1)·gutter) / columns   // square
stripBaseHt:  showNoteStrips ? cellSizePt · 0.5 : 0
bandBaseHt:   cellSizePt + stripBaseHt + interBandGutter
```

New geometry fields: `railWidthPt`, `stripBaseHeightPt`, `interBandGutterPt`,
`orientation`, plus the existing cell/margin fields. `cellsPerPage` / fixed `rows`
are replaced by a `usableHeightPt` the planner packs against.

Flexible height: each band reports a measured height (base, or taller when its
strip holds multi-line notes). Preview measures in the DOM (natural flow). PDF
measures note text against the strip width to compute line count → strip height.

## Planner

`planSheet` (row-aligned branch): for each sequence, chunk its steps into rows of
`columns` (last row short, not padded across sequences); each row becomes a band
carrying its `BandKey`, cells, and resolved cue/notes. Then **pack bands into pages
by height**: accumulate band heights until the next would exceed `usableHeightPt`
(minus header height on page 1), then start a new page. `keepBlocksTogether` keeps a
sequence's bands on one page when they fit.

Output shape gains per-band annotation payload and per-band height so preview and
PDF lay out identically:

```ts
interface SheetBand {
  key: BandKey;
  cells: SheetCell[];          // ≤ columns; short last row not cross-padded
  cue: CueMark | null;
  notes: NoteMark[];
  isSequenceStart: boolean;    // first band of a sequence (separator/break marks)
  heightPt: number;            // measured/estimated band height
}
interface SheetPage { bands: SheetBand[]; pageIndex: number; }
```

The dense `packing: "flow"` branch keeps today's continuous-cell behavior (no bands,
no annotations) unchanged.

## Rendering

Preview and PDF share geometry + planner output, not a renderer (existing pattern).

**Preview** (`SheetPreviewPages.svelte`, annotated branch):
- Page 1 title block / page 2+ running header components.
- Per band: rail (editable timestamp input + cue textarea) | row (`PictographContainer`
  cells, unchanged) with a note strip beneath.
- Strip: click a count column to add a pinned note; an "add note" affordance for a
  full-width bullet. Notes are inline-editable text. Reserved base height, grows with
  content (no layout shift on siblings — the page is fixed-aspect, bands flow).
- Editing is inline (no modal). Empty rail/strip show faint affordances only in an
  "edit" state; print/preview-clean state hides them.

**PDF** (`sheet-pdf-exporter.ts`, annotated branch):
- Pictographs rastered as today (numbers baked via canonical `drawStepNumber`).
- Rail text, cue, header, and note strips drawn as **vector pdf-lib text** (crisp,
  selectable), positioned by the same band geometry + measured heights.
- Pinned notes left-anchored at the count column's x; bullets at the rail edge with
  a `•`. Running-header page-start timestamp = first band's timestamp on that page.

## State

`choreo-sheet-state.svelte.ts` gains annotation editing on the factory (getters-only
API): `setCue(band, patch)`, `setNote(band, id, patch)`, `addNote(band, count)`,
`removeNote(band, id)`, `setHeader(patch)`, and `prefillTimestamps()` (BPM →
per-band timestamps, only filling blanks). `actSequence`/BPM feed the prefill. Dirty
tracking already exists; annotations join it.

## Persistence

`ChoreoSheetRepository` + zod schema extend to store `annotations`, `bpm`, and the
new layout fields under `users/{uid}/choreoSheets/{id}` (rules block already
shipped). Back-compat: missing `annotations` hydrates to an empty default; missing
layout fields default (`orientation:"landscape"`, `packing:"flow"`, rail/strips off)
so existing sheets render exactly as before.

## Testing

Unit (vitest, existing `tests/unit/sheet-*` pattern):
- Planner row-aligned chunking (12 → 8+4), band-key assignment, height-packed
  pagination (bands fill a page, overflow starts a new one, `keepBlocksTogether`).
- BPM timestamp prefill (beat index → "M:SS", only fills blanks, no overwrite).
- `NoteMark.count` beyond band length → full-width fallback.
- Annotation anchor stability across a simulated sequence reorder.
- Back-compat: a pre-annotation sheet object hydrates to flow mode unchanged.

Component tests are out of scope (test-on-fix discipline); the sketch already
answered the visual-balance question.

## Out of scope (v1)

- Per-row 1–8 count relabeling (in-pictograph global number stands).
- A4 / portrait paper variants beyond the two orientations.
- Audio-clock-accurate timestamps (BPM prefill is the timing source; the act player's
  audio sync is a separate track).
- Rich text / formatting in notes (plain text).

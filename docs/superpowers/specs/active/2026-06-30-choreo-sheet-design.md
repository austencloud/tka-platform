---
status: active
value: 4
effort: L
remaining: "Body status: Active"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# Choreo Sheet — Printable Landscape Roster — Design

**Date:** 2026-06-30
**Status:** Active
**Topic:** A printable landscape choreo sheet derived from picked sequences — one
sequence per row of step-pictographs, 8 cells across, 6 rows per US-Letter
landscape page, with on-screen preview + PDF export. Lives in the Write module
alongside the existing Act (performance playlist).

## Problem

The Write module (`src/lib/features/write/`, shipped Dec 13 2025) models an **Act**
— an ordered playlist of whole sequences played with music, timing, and
transitions (`ActItem` → `sequenceId`, `startTime`, `repeatCount`,
`transitionType`). Its grid renders one thumbnail card per whole sequence
(`SequenceGrid.svelte`, responsive `minmax(280px,1fr)` — screen, not print).
`exportAct()` is a stub.

There is no way to put choreography **on a sheet of paper**. The need: pick a set
of sequences, lay each one out as a row of its individual step-pictographs, 8 to
a row, and print/PDF a landscape page that fits 6 rows comfortably — so a teacher
or performer can carry the choreo on paper.

Austen (2026-06-30): *"we need to make it easy for people to put Choreo on a
sheet ... if you print out a landscape sheet it can fit eight cells comfortably
in its landscape mode in a row [and] six rows on a page ... sheets that are
derived from sequences you pick which are really easy to put together which have
one row per sequence ... flexible enough to put sequences at any length ... in
general we're going to be using it for eight and 16 from the gate."*

## Decisions (locked)

From investigation + four product answers (2026-06-30):

- **Home:** a new lightweight **`ChoreoSheet`** artifact inside the Write module.
  NOT an overload of `Act` (a sheet needs no music/timing/transition/row
  semantics). A sheet can be **seeded from** an existing Act ("print this Act as a
  sheet") but is its own model. Sibling to Act in Write.
- **Cell = one step.** One printed cell = one `StepData` = one pictograph.
  `steps.length` is the true count (8-count = 8 steps). **Steps only, no label,
  no start-position cell** — a row is purely the sequence's step-pictographs.
- **Row width 8, wrap to rows of 8.** Sequences longer than 8 steps wrap: a
  16-count = 2 rows of 8, kept together as **one sequence block** (no split across
  a page break). Short sequences pad the row with blank cells (`isBlank`).
- **Output:** on-screen landscape preview **+** print-ready PDF. Preview (live
  virtualized pictograph cells) and PDF (raster at print DPI) share the same
  `planSheet()` output, page geometry, and locked visibility → layout + visual
  parity.
- **Geometry confirmed:** US-Letter landscape = 792×612pt. Margin 18pt, gutter
  3pt → 8 cols of ~92pt (~1.28") square cells; 6 rows × 92pt = 552pt ≤ 564pt
  usable height. 48 pictographs/page. Austen's "8 comfortably, 6 rows" holds.

### Resolved-by-investigation (defaults, open to change)

- **Group separation without a text label:** a thin hairline rule + small gap
  between sequence blocks, so a wrapped 16-count (2 rows) reads as one sequence
  and is distinguishable from two 8-counts. No text. (`groupSeparator`.)
- **Step numbers:** the renderer overlays `stepNumber` natively; default ON,
  toggleable (`showStepNumbers`).
- **Paper:** US Letter landscape for v1. A4 is a later toggle (geometry is
  parameterized so adding it is a constant + an enum value).
- **Preview = live virtualized pictograph cells; PDF = raster.** Live
  `StepCell`/`PictographContainer` (what WorkspaceGrid / the viewer already use)
  give instant, crisp rendering with no 15s worker cold-start, so the builder
  feels snappy on reorder. The preview **virtualizes to the visible page(s)** to
  cap live-component count. PDF export rasterizes via the existing card render
  stack at print DPI. Parity is guaranteed not by sharing the renderer but by both
  consuming the same `planSheet()` + geometry + locked visibility (`§3`).

## Existing primitives (reuse, do not rebuild)

Grep-proven during recon (2026-06-30). Net ~70% reuse.

| Concern | Reuse | Path |
|---|---|---|
| Sequence/step model | `SequenceData.steps: readonly StepData[]`; `StepData extends PictographData` (`stepNumber`, `duration`, `isBlank`) | `src/lib/shared/foundation/domain/models/sequence-data.ts`, `step-data.ts` |
| Load + hydrate sequences | `LibraryRepository.getSequences`/`getSequence`; `PublicSequencesLoader.loadFullSequenceData` (gallery thumbs carry empty `steps`) | `src/lib/shared/library/services/library-repository.ts` |
| Per-cell raster render | `Canvas2DDirectRenderer` (rasterizes a prepared pictograph), `LayerCompositor` (layer split + LRU cache: base 2000 / grid-pts 500 / TKA 500) | `src/lib/shared/render/services/canvas-2d-direct-renderer.ts`, `layer-compositor.ts` |
| Pictograph prep | `PictographPreparer.prepareSingle()` → `PreparedPictographData` (cached, dedup) | `src/lib/shared/pictograph/shared/services/pictograph-preparer.ts` |
| Worker pool batch render | `CompositionDispatcher` (2–8 workers, AssetBundle + glyph bitmaps pre-seeded) | `src/lib/shared/render/services/composition-dispatcher.ts` |
| Canonical SVG renderer (used internally by raster path; has `printMode` white-bg + `stepNumber`) | `PictographRenderer.svelte` | `src/lib/shared/pictograph/shared/components/PictographRenderer.svelte` |
| Locked print visibility | `buildCanonicalCardVisibility()` | `src/lib/features/choreo-card/domain/canonical-card-visibility.ts` |
| Page-frame structure (`.page`, crop marks, page guides) | `PrintPreviewPages.svelte` (portrait-locked — extend to landscape) | `src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte` |
| pdf-lib assembly patterns (embed PNG, slot math, paginate, duplex, download) | `print-pdf-exporter.ts` (`exportHomePrintPDF`), `codex-sheet-pdf.ts` | `src/lib/features/choreo-card/services/` |
| Page geometry builder | `card-sizes.ts` `buildLayout()`/`getPageLayout()` (portrait 612×792 — extend) | `src/lib/features/choreo-card/domain/card-sizes.ts` |
| Slot/blank-pad pattern | `planPrintSlots<T>()` (reference pattern; our planner adds wrap+grouping) | `src/lib/features/choreo-card/services/print-slot-planner.ts` |
| Module registration | module-definitions / nav | `src/lib/shared/navigation/config/module-definitions.ts` |

**Do NOT** base anything on the dead `PageLayout.ts` domain model (imported
nowhere) or on any container-reflow grid (`CardGridLayout`, `WorkspaceGrid`,
`CompositionGrid`, `grid-calculations.ts`) — those reflow to container width and
are wrong for fixed page geometry.

## Data model (new)

`src/lib/features/write/domain/types/choreo-sheet.ts`

```ts
export type PaperSize = 'letter';            // 'a4' later
export type SheetOrientation = 'landscape';  // fixed v1
export type GroupSeparator = 'rule' | 'gap' | 'none';

export interface ChoreoSheetLayout {
  columns: number;            // default 8
  paperSize: PaperSize;       // 'letter'
  orientation: SheetOrientation;
  showStepNumbers: boolean;   // default true
  groupSeparator: GroupSeparator; // default 'rule'
  keepBlocksTogether: boolean;    // default true (no sequence split across pages)
}

export interface ChoreoSheet {
  id: string;
  name: string;
  ownerId: string;
  sequenceIds: readonly string[]; // ordered; one block per sequence
  layout: ChoreoSheetLayout;
  createdAt: Date;
  updatedAt: Date;
}
```

Sheets persist **sequence references only** (like Act); steps are hydrated from
the library at render time. `DEFAULT_SHEET_LAYOUT` exported alongside.

## Changes

### 1. Page geometry — `card-sizes.ts` landscape + grid-spec

Add landscape US-Letter constants (`LETTER_W_LANDSCAPE_PT = 792`,
`LETTER_H_LANDSCAPE_PT = 612`) and a **grid-spec page layout** path that is
decoupled from physical card inches (the existing `buildLayout` derives cell size
from card width/height; a step-pictograph sheet has square cells sized by
`pageWidth / columns`). New:

```ts
export function getSheetPageLayout(opts: {
  columns: number; rows: number; paperSize: PaperSize; orientation: 'landscape';
}): PageLayout   // square cellPt = (pageW - 2*margin - (cols-1)*gutter)/cols
```

Returns the same `PageLayout` shape (cols, rows, cardsPerPage, cellW/H Pt,
gutter, margins) so downstream slot/PDF code is shared. Existing portrait
card layouts untouched.

### 2. Sheet-row planner (new) — `services/sheet-row-planner.ts`

Pure function. Input: ordered hydrated sequences + `ChoreoSheetLayout`. Output:
paginated rows.

- Each sequence → `ceil(steps.length / columns)` rows; each row = up to `columns`
  step cells, **padded with blank cells** to fill the row.
- Rows tagged with `sequenceId` + `isBlockStart`/`isBlockEnd` so the preview/PDF
  can draw the group separator.
- Pagination: pack rows into pages of `layout.rows` (6). If
  `keepBlocksTogether` and a block's rows don't fit the remaining page rows, push
  the **whole block** to the next page (pad the current page tail with blank
  rows). Mirrors `planPrintSlots`' blank-pad guarantee so preview == PDF.

```ts
export interface SheetCell { step: StepData | null; isBlank: boolean; }
export interface SheetRow { cells: SheetCell[]; sequenceId: string; isBlockStart: boolean; isBlockEnd: boolean; }
export interface SheetPage { rows: SheetRow[]; }
export function planSheet(seqs: readonly SequenceData[], layout: ChoreoSheetLayout): SheetPage[]
```

### 3. Shared cell render config — `services/sheet-cell-config.ts`

A tiny module that both the live preview cells and the PDF rasterizer consume, so
a step looks the same in each: the locked visibility set
(`buildCanonicalCardVisibility()`), light/`printMode` background, `stepNumber`
overlay gating (`showStepNumbers`), and `gridMode` resolution for a `StepData`.
No rendering here — just the shared config object + a `cellRenderInput(step,
layout)` helper. Blank cells render as an empty white tile in both paths.

The two renderers that consume it:
- **Preview** (§7): live `StepCell`/`PictographContainer` Svelte components.
- **PDF** (§8): the existing card raster stack — `PictographPreparer.prepareSingle()`
  → `Canvas2DDirectRenderer` (worker pool via `CompositionDispatcher` when warm,
  main-thread fallback; `LayerCompositor` LRU cache renders identical pictographs
  once) at print DPI (`cellPt/72 × 300`).

### 4. ChoreoSheet state + persistence — `state/` + `services/`

- `state/choreo-sheet-state.svelte.ts` — factory + context (project state
  pattern): current sheet, ordered `sequenceIds`, hydrated `SequenceData[]`
  (lazy via `LibraryRepository.getSequence`), layout settings, derived
  `SheetPage[]` (memoised on ids+layout). Reorder/add/remove/seed-from-act.
- `services/choreo-sheet-repository.ts` — Firestore CRUD following the
  `LibraryRepository` per-user pattern (`choreoSheets/{id}`): list, load, save,
  delete. (Note: this is also the persistence the Write/Act module never got;
  `act-manager.ts` stays stubbed — out of scope.)

### 5. Multi-select sequence picker (new UI)

Browse is single-select today; there is no "tick N sequences" surface. New:
`components/picker/SequencePickerSheet.svelte` — a grid of library sequence
thumbnails with tap-to-toggle multi-select, search/filter, and a confirm action
returning an ordered `string[]`. Reuses `LibraryRepository.getSequences` for the
list and existing thumbnail rendering. Toggle = button + toggle-indicator
(per `no-checkboxes`), 44px targets, design tokens (`feedback_design_system_mandatory`).

### 6. Sheet builder view — Write module

`components/sheet/ChoreoSheetView.svelte` — the build surface:

1. **New Sheet** (or seed-from-Act) → opens `SequencePickerSheet`.
2. Picked sequences become **ordered rows**; drag to reorder (reuse the existing
   drag primitive used elsewhere — confirm `@neodrag`/existing handle during
   plan, do not hand-roll), remove per row.
3. A settings strip: columns (default 8, locked to 8 for v1 UI but model
   supports others), step-numbers toggle, separator style.
4. Live landscape **preview** (section 7) + **Export PDF** (section 8).

Wired into `WriteTab.svelte` as a second mode/tab next to the Act editor
(Act = playlist, Sheet = printable). Minimal, non-destructive to the Act path.

### 7. Landscape preview — `components/sheet/SheetPreviewPages.svelte`

Clone the `PrintPreviewPages` page-frame structure (`.page`, crop marks, page
guides, multi-page stacking) but **landscape** (`aspect-ratio: 11/8.5`) and
grid-spec driven (`grid-template-columns: repeat(columns, cellPct)`). Renders
each `SheetPage` → rows → cells as **live** `StepCell`/`PictographContainer`
components using the §3 shared config; **virtualizes** so only the visible page(s)
mount their cells (cap live-component count). Draws the group separator between
blocks. Honors reduced-motion / tokens.

### 8. Landscape 8×6 PDF — `services/sheet-pdf-exporter.ts`

Model on `codex-sheet-pdf.ts` (verified template: `PDFDocument.create` →
`embedPng` → `addPage([W,H])` → `drawImage` → blob → download): a pdf-lib
document, landscape pages (792×612), each cell rasterized via the existing card
render stack (`PictographPreparer` → `Canvas2DDirectRenderer`, §3 config) at
print DPI and embedded as PNG, positioned by the shared geometry + `planSheet()`,
optional crop marks, group separators drawn as thin lines, paginated. Download via
a `downloadChoreoSheetPDF` helper mirroring `downloadCodexSheetPDF`.
`buildChoreoSheetPDF(sheet, hydratedSeqs, onProgress): Promise<Blob>`.

### 9. Module wiring

Register the Sheet surface in the Write module (no new top-level module — it's a
mode within Write). i18n keys for the new labels. Premium gating: follow Write's
current tier (Write is shipped/free); flag to Austen if sheets should be
Scribe-gated (`project_premium_philosophy`) — default free with Act.

## Layout rules (summary)

- Row = `columns` (8) cells; short rows blank-padded; long sequences wrap to
  multiple rows kept as one block.
- `keepBlocksTogether`: a block never splits across a page break (push whole
  block to next page; pad tail with blank rows).
- Group separator (`rule` default) between blocks; none within a wrapped block.
- Step numbers default ON.
- Cells are square; page is fixed-geometry landscape Letter.

## Phasing (vertical slice first)

1. **Geometry + planner + cell renderer** (§1–3) — pure logic, unit-tested.
2. **Preview + PDF** (§7–8) with a hardcoded sequence set — proves the sheet
   renders and exports (the core value) before any picker/persistence.
3. **State + picker + builder view** (§4–6) — the "easy to put together" UX.
4. **Persistence + module wiring + polish** (§4 repo, §9).

Ship 1–2 first (a printable sheet from a known sequence list), then 3–4.

## Verification

- **Unit:** `sheet-row-planner` — wrap (16→2 rows), blank-pad (5-count → 5+3
  blanks), block-keep-together pagination (block pushed when it doesn't fit),
  block-start/end tagging. Geometry — cell size + 8×6 fits 792×612 with margins.
- **Render parity:** a fixed multi-sequence set → preview pages and PDF page
  count + slot positions match (shared planner).
- **Visual (DevTools, ask Austen first):** test page at
  `src/routes/test/choreo-sheet` renders real sequences; eyeball that 8 cells fit
  comfortably, 6 rows/page, wrap + separators read correctly; export a PDF and
  open it.
- **Typecheck/build** green before "done".

## Risks / notes

- **Worker pool cold start** (~15s first render). Preview should show a skeleton
  + reuse the warm pool across re-renders; the LRU cache makes reorders cheap.
- **Raster, not vector.** PDF cells are high-DPI raster (the codebase's
  deliberate print path; no batch SVG→PDF exists and we are not building one —
  `research-before-building`). 300 DPI at ~1.28" cells is crisp for print.
- **`PrintPreviewPages` portrait math is baked in** (`colWidthPct`/crop-mark math
  assume 8.5/11). The landscape preview clones the structure rather than
  parameterizing that component in place, to avoid regressing the card print path.
- **Picker drag-reorder:** reuse the existing drag primitive; do not hand-roll
  (`never-hand-roll`). Pin the exact primitive in the plan.

## Out of scope (future toggles)

- A4 paper, portrait sheets, configurable columns in the UI (model supports;
  UI v1 is 8-wide landscape).
- Optional per-row text label / start-position cell (model can grow; locked OFF
  now).
- Finishing the Act `exportAct()` / Act persistence stub.
- Music/timing on sheets (that's the Act's domain).

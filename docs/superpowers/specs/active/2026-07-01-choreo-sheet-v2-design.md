# Choreo Sheet v2 — Continuity, Collections, Inline Picker, Cell Outlines

**Date:** 2026-07-01
**Status:** Active
**Supersedes/extends:** `2026-06-30-choreo-sheet-design.md`

## Problem

The choreo sheet (Write module) strings sequences into a printable landscape
roster, one sequence per block. Four gaps surfaced in use:

1. A sheet is a **single continuous routine**, but nothing enforces or reveals
   that row N's ending state connects to row N+1's starting state. You can
   silently stitch a sequence that ends at one position/orientation to one that
   starts somewhere else — physically impossible to perform as one flow.
2. Sequences are picked from Community / My Library, but not from the user's
   **Collections**, which is the primary way they'll assemble a sheet.
3. The add-sequences picker is a **fixed overlay** that covers the sheet page —
   you can't see the whole page while picking.
4. Pictograph cells on the page have no **outline**, so the grid reads as a soup
   of arrows rather than discrete cells.

## Domain grounding (verified in code)

- `StepData` carries `startPosition`, `endPosition`, and `motions.{blue,red}`
  with `startOrientation` / `endOrientation`
  (`src/lib/shared/foundation/domain/models/step-data.ts`).
- A sequence's **start state** = `steps[0].startPosition` + step 0's blue/red
  `startOrientation`. Its **end state** = `steps.at(-1).endPosition` + the last
  step's blue/red `endOrientation`.
- Existing continuity comparators to mirror (do not reinvent):
  - `src/lib/features/create/spell/services/orientation-continuity-validator.ts`
    — beat-to-beat + transition orientation checks.
  - `src/lib/shared/3d/state/avatar-instance-state.svelte.ts:70-106` — the LOOP
    check: `firstStep.startPosition === lastStep.endPosition` + blue/red
    `startOrientation === endOrientation`.
- Canonical, reusable sequence transforms (functional, no DI) at
  `src/lib/shared/create/services/sequence-transformer.ts`:
  - `shiftStartPosition(seq, targetStepNumber)` — the "first beat" rebase; makes
    a chosen beat the new beat 1 (cyclic for circular sequences via
    `first-step-analyzer.ts`).
  - `rotateSequence(seq, rotationAmount, targetHand)` — spatial rotation (rotates
    positions + orientations).
  - Also mirror / invert / rewind / colorSwap / deriveSequenceLetters.
- Collections: `getCollections(): Promise<LibraryCollection[]>`
  (`src/lib/shared/library/services/collection-manager.ts`);
  `LibraryCollection.sequenceIds: readonly string[]` — ordered id references.
- Browse engine `SequenceSource = "community" | "my-library"` only
  (`src/lib/shared/browse/engine/types.ts`) — Collections is NOT an engine
  source; it is filtered client-side by id membership.

## Design

### 1. Inline picker (docked column, not overlay)

Restructure `ChoreoSheetView` body to three columns: `[rail | preview | picker]`.

- Drop the `position: fixed` drawer + scrim. The picker is a normal flex column
  (e.g. `width: min(460px, 42vw)`) that pushes the preview narrower when open.
- The preview already scales the page to its container width, so a narrower
  preview shows the **whole page** smaller — never clipped.
- "Add sequences" toggles the column (`browseOpen`). On `max-width: 900px` the
  picker drops below the preview instead of beside it.
- `BrowsePanel layout="compact"` stays inside the column (unchanged).

### 2. Collections in the picker

Collections are filtered client-side, not a new engine source.

- A source `SegmentedControl` at the top of the picker column:
  **My Library · Community · Collections**. My Library / Community drive
  `browseEngine.setSource(...)`. "Collections" keeps the engine on `my-library`
  and reveals a collection chip row.
- Collection chips: `getCollections()` → one `FilterChipBase` (mode `toggle`,
  single-active) per collection, plus the count badge. Selecting a collection
  filters the visible grid to sequences whose `id ∈ collection.sequenceIds`.
- Reuses `SegmentedControl` (`chip-primitives.md` routing: single-select group)
  and `FilterChipBase`. No hand-rolled chips.
- Deselecting the collection (or switching source) clears the id filter.

### 3. Cell outlines

- Add a thin token border (`1px var(--theme-stroke)` equivalent, tuned for the
  light page) to each cell in `SheetPreviewPages` **and** an equivalent stroked
  rect in the PDF cell draw (`sheet-pdf-exporter.ts`), so preview and print match.
- Applied per-cell (including blank pad cells, subtler) so rows read as a grid.

### 4. Continuity (core)

New pure module `src/lib/features/write/services/sheet-continuity.ts`:

- **`connects(prev, next): boolean`** — `prev.lastStep.endPosition ===
  next.firstStep.startPosition` AND blue+red `endOrientation ===
  startOrientation`. Null-safe; a missing color on one side but present on the
  other = break.
- **`normalizeToStart(seq, target): SequenceData | null`** — the "first beat"
  normalization. `target` = `{ position, blueOri, redOri }` (previous row's end).
  Strategy, in order:
  1. If `seq` already starts at `target` → return as-is.
  2. If `seq.isCircular` and some beat `k` has `startPosition === target.position`
     → `shiftStartPosition(seq, k)`.
  3. If a `rotateSequence` amount maps `seq`'s start position onto
     `target.position` → apply it.
  4. After position aligns, if orientation still mismatches and an orientation
     transform can reconcile it → apply; else return the position-aligned
     sequence (orientation break remains, surfaced as a marker).
  5. No path connects → return `null` (caller keeps the original, marks a break).
- **`loopStatus(rows): "loops" | "open" | "empty"`** — whether the last row's end
  state equals the first row's start state (same comparator as `connects`).

Integration:

- `choreo-sheet-state`: `addHydratedSequences` (and the reorder path) run each
  newly-adjacent sequence through `normalizeToStart` against the preceding row's
  end. Store the **normalized** sequence in the row cache. Non-connecting adds
  are kept as-is and flagged.
- New deriveds: `boundaries` (one connect/break verdict per gap between rows) and
  `loopStatus`.
- **Break markers**: `SheetPreviewPages` renders a red rule + warning glyph at a
  block boundary whose `boundaries[i]` is a break. Non-blocking (per the decision
  to normalize, not filter). PDF draws the same marker for parity.
- **Loop badge**: builder toolbar shows **Loops ✓** / **Open** from `loopStatus`,
  layout-stable (`no-layout-shift.md`: reserve the wider label).

### Reorder & remove implications

Reordering rows re-evaluates boundaries (and may re-normalize the moved row and
the one after it against their new predecessors). Removing a row re-evaluates the
now-adjacent pair. Normalization is idempotent (step 1 short-circuits).

## Architecture / files

**New:**
- `src/lib/features/write/services/sheet-continuity.ts` — `connects`,
  `normalizeToStart`, `loopStatus` (pure; TDD).
- `tests/unit/sheet-continuity.test.ts`.

**Edit:**
- `choreo-sheet-state.svelte.ts` — normalize on add/reorder; `boundaries` +
  `loopStatus` deriveds.
- `ChoreoSheetView.svelte` — 3-column inline layout; source `SegmentedControl` +
  collection chips; loop badge.
- `SheetPreviewPages.svelte` — cell outlines + break markers.
- `sheet-pdf-exporter.ts` — cell outlines + break markers (parity).
- (picker) collection load via `getCollections()` + id-membership filter.

**Reuse (no reinvention):** `sequence-transformer` (shift/rotate),
`orientation-continuity-validator` comparator shape, `BrowsePanel` +
`createBrowseEngine`, `SegmentedControl`, `FilterChipBase`, `getCollections`.

## Testing

- `sheet-continuity.test.ts` (pure, heaviest coverage):
  - `connects`: matching position+orientations → true; position mismatch,
    blue-ori mismatch, red-ori mismatch, missing-color asymmetry → false.
  - `normalizeToStart`: already-aligned no-op; circular rebase to a passed-through
    beat; rotation alignment; unreconcilable → null.
  - `loopStatus`: empty, open, loops.
- Existing choreo-sheet unit + persistence tests stay green.
- Visual verification (Austen): inline layout shows whole page; collections
  filter; break markers; loop badge; cell outlines; PDF parity.

## Out of scope

- Hard-filtering the picker to only-connecting sequences (rejected — normalize
  instead).
- Requiring the whole sheet to loop (show status only).
- Editing individual steps from the sheet (that's the Create module).
- Non-circular deep normalization beyond rotation (flagged as a break instead).

## Open risk

Normalization is the novel core. It is clean for circular sequences (lossless
rebase) and rotation-aligned starts; non-circular sequences that neither start
correctly nor rotate into place are surfaced as breaks rather than force-fit.
This is the most-tested unit.

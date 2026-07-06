# Proof-Text Paragraph Grouping — Design

**Date:** 2026-07-06
**Status:** approved (brainstormed; "do your best" → implement this turn)
**Scope:** Guide Level-1 dev-only "Illustrator mode". Bind consecutive proof-text
runs into paragraph **groups** that move + edit as one unit, without changing the
faithful printed output.

## Problem

`ProofTextPage.svelte` renders each `ProofRun` (a proof PDF text fragment) as its
own absolutely-positioned span → its own draggable + double-click-editable block.
The proof extractor splits every visual line into runs (and every line of a
paragraph is a separate run), so a 3-line centered paragraph is 3–9 independent
blocks. Repositioning or retyping a paragraph means touching each line. Austen:
group single-line blocks into paragraph groupings, auto-pick the high-value ones.

The bespoke built pages already use one `<p>` per paragraph (move/edit as a unit).
This brings the auto-populated (ProofTextPage) pages to that model — automatically,
across all ~21 proof pages — without hand-editing the GENERATED `proof-text.ts`.

## Approach: render-time auto-grouping, faithful by default

Grouping is inferred from the runs' own coordinates at render time. The generated
data is untouched. Non-edit output is byte-identical to today until a paragraph is
actually edited.

### 1. `proof-grouping.ts` (new — pure, unit-tested)

`groupRuns(runs: ProofRun[]): Group[]`

- **Lines:** cluster runs with `|Δy| ≤ 4pt` into a line; sort line runs by x.
- **Paragraphs:** append the next line to the current paragraph when
  `yGap ≤ dominantFs × 1.5` **and** x-ranges overlap **and** `|Δfs| ≤ 2`;
  otherwise start a new paragraph. (Validated: intra-paragraph gaps are ~1.2×fs
  ≈ 18pt for fs15 / 16.8pt for fs14; paragraph breaks are ≥27pt.)
- Per group compute: `runs` (owned copies), bbox `x0/y0`, `align`
  (`center` when all line-centers agree within ~5pt, else `left`), `anchorX`
  (center-x or x0), `leading` (median line-gap ÷ fs, fallback 1.2), dominant `fs`,
  and combined `html` — each run wrapped by style (`bold`→`<strong>`,
  `italic`→`<em>`, `bolditalic`→`<strong><em>`, `heading`→`<strong>`), text
  HTML-escaped, joined by a space on a positive x-gap (> 2pt), lines joined by
  `<br>`.

`Group.id = proof-${pageId}-g${n}`.

### 2. ProofTextPage renders groups, not runs

- **Singleton group (1 run):** render exactly as today — the run *is* the
  `ptDrag` + `editText` (plain) node. Captions/labels unchanged, never collapse,
  zero reflow.
- **Multi-run group (≥2):** render member runs at their exact proof coords
  (faithful, in and out of edit mode). In edit mode only, add one transparent
  bbox **overlay handle**:
  - `use:ptDrag` with a group Movable → drag moves every member run together
    (Shift-axis-lock, nudge, delete all act on the whole paragraph).
  - double-click → **collapse** the group to a single flowed block at the bbox
    (detected align + leading + dominant fs) and enter rich edit via `editText`.
- **Peek-safe collapse:** double-click collapses + edits; Escape with no change
  reverts to per-run rendering (no reflow); committing a change keeps the flowed
  block.

### 3. Fidelity

- Non-edit render unchanged until a paragraph is edited.
- Collapsed block matches run rendering: same font stack + color, `font-size =
  fs×S`, `line-height = leading`, `top` nudged up by `(leading−1)·fsPx/2` so the
  first line's glyph box aligns with the equivalent `line-height:1` run.
- Centered paragraphs (the vast majority) reproduce via `translateX(-50%)` at the
  detected center; left paragraphs anchor at `x0`. A staggered paragraph may shift
  on edit — accepted trade-off.

### 4. Copy dump (make permanent in source)

`registerEditSource` per page now iterates groups:
- expanded group → per-run coords (as today).
- collapsed group → a paragraph descriptor block: `anchor`, `align`, `leading`,
  and the html. Edited text also appears in the existing EDITED-TEXT section via
  `editedTextIds`.

### 5. Shared-infra touch (minimal)

- `Editable` gains optional `onCommit?(changed: boolean): void`; `editText` calls
  it at the end of `commit`. ProofTextPage uses it to revert a peeked collapse.
- Everything else — undo/redo, Copy, selection, Shift-lock, delete — reused
  unchanged.

## Non-goals / known gaps

- The collapse *transition* is not on the undo stack (moving/editing a collapsed
  block is). Acceptable for a dev-only tool.
- Per-line nudge inside a multi-run group is dropped in favour of paragraph-unit
  drag (a paragraph is one handle). Follow-up if ever needed.
- No re-splitting a collapsed block back into per-run coords — collapse is
  one-way per session (by design; matches the chosen "edit as unit" behavior).

## Files

- **Create:** `_data/proof-grouping.ts`; `tests/unit/guide/proof-grouping.test.ts`.
  (Grep: nothing clusters proof runs today; ProofTextPage rendered them flat.)
- **Edit:** `_pages/ProofTextPage.svelte` (render groups); `_data/guide-edit.svelte.ts`
  (`Editable.onCommit`).

# Element-Grouped Print Copies — Design

**Date:** 2026-05-30
**Status:** Approved (pending spec review)
**Area:** Choreo Card deck print export

## Problem

A released deck colored by TnD element (e.g. "TKA One Learning Letters", 19 cards
across 6 elements) is being printed in quantity for physical distribution. The
home-print PDF currently lays cards out in element-sorted order, but at a fixed
`cardsPerPage` boundary, so a single sheet routinely mixes two element colors
(e.g. water + earth on sheet 1). Cutting across a color boundary risks
inaccurate cuts that bleed one color into the adjacent card.

Two capabilities are missing:

1. **Copies** — print N copies of the whole deck in one export for mass
   distribution.
2. **One element per sheet** — guarantee a cut line never crosses two colors.

## Goal

Extend the home-print PDF export so the user picks a copy count, and every
printed sheet contains exactly one element's cards. Within a color, the deck's
cards for that element repeat as whole blocks N times so they can be dealt into
N complete decks after cutting.

## Non-Goals

- MPC ZIP export is unchanged. It exports one PNG per card; print quantity is
  chosen at the MakePlayingCards.com order step, not here.
- No change to single-card-per-page `exportDeckPDF`.
- No change to element assignment, card rendering, or the preview sort.

## Affected Files

| File | Change |
|---|---|
| `src/lib/features/choreo-card/services/print-pdf-exporter.ts` | Add element grouping + copies + per-element sheet padding to `exportHomePrintPDF`. |
| `src/lib/features/choreo-card/components/print-preview/PrintDialog.svelte` | Add "Copies per card" number input (PDF formats only); live sheet-count estimate reflecting copies + padding. |
| `src/lib/features/choreo-card/components/deck-releaser/ReviewStep.svelte` | Thread `copies` + sorted `tndElements` into the export call. |

## Data Model

`exportHomePrintPDF` gains an options object:

```ts
interface HomePrintOptions {
  /** Whole-deck copies. Each element block repeats N times. Default 1, min 1. */
  copies?: number;
  /** Element tag per pair, parallel to `pairs`. Absent → no grouping/padding
   *  (legacy behavior: pack tight in given order). */
  elements?: (TnDElement | undefined)[];
}
```

Signature becomes:

```ts
exportHomePrintPDF(
  pairs: CardPair[],
  deckName: string,
  cardSize: CardSizeId,
  onProgress?: (current: number, total: number) => void,
  mode?: PrintPDFMode,
  options?: HomePrintOptions,
): Promise<Blob>
```

`elements` is the already-sorted `tndElements` array from `ReviewStep`
(`elementSorted.tndElements`), parallel to `renderedPairs`. Passing it makes
grouping exact rather than re-inferring from icon paths inside the exporter.

## Algorithm

Given `pairs`, parallel `elements`, `copies = N`, and `cardsPerPage = P` (with
`cols`/`rows` from `getPageLayout`):

1. **Group.** Bucket pairs by `element.element` string. Order buckets by the
   fixed `TND_ELEMENTS` sequence (water → earth → sun → fire → air → moon).
   Any pair whose element is `undefined` goes into a trailing "untagged" bucket
   (preserves the case of a non-TnD or mixed deck).
2. **Repeat (whole-block).** For a bucket of `k` pairs, emit the bucket's pairs
   in order, repeated `N` times: `[c1..ck, c1..ck, …]` → `k*N` pairs. Whole-block
   (not per-card runs) so each color produces N identical runs that deal cleanly
   into N complete decks.
3. **Pad.** Append `null` (blank) slots to the bucket until its length is a
   multiple of `P`. Blank slots render as empty cells (no image) on both fronts
   and backs.
4. **Concatenate** all padded buckets into one ordered slot list. Because every
   bucket length is a multiple of `P`, each page holds exactly one element.
5. **Paginate fronts.** `P` slots per Letter page, same grid math as today.
   Blank slots draw nothing.
6. **Paginate backs.** Same slot grid; column index mirrored (`cols-1-col`) for
   long-edge duplex, exactly as today. Blank slots draw nothing on backs too, so
   front/back blanks align.

When `elements` is absent or `copies` defaults to 1 with no element data, the
output is byte-compatible with today's behavior (grouping/padding are no-ops).

### Blank-slot handling

The current loop maps a `CardPair` per grid cell. Introduce a `Slot = CardPair | null`
list. A `null` slot is skipped in the draw loop (cell left empty) but still
occupies its grid position, preserving alignment between fronts and mirrored
backs. Crop marks continue to render for the full grid (already drawn per
column/row, independent of card presence), so blank cells still get cut guides —
correct, since the user trims the whole sheet.

### Sheet-label / progress

`totalSheets` is recomputed as the sum over buckets of `ceil(k*N / P)`.
Progress total = fronts sheets + backs sheets (per existing mode gating).
Sheet labels keep `Sheet n of N`. Optionally append the element name to the
label (e.g. `FRONTS · Fire · Sheet 4 of 11`) — low cost, high cutting clarity.
Include the element name in the label.

## UI

`PrintDialog.svelte`:

- New **Copies per card** number input. Visible only when `selectedFormat` is a
  PDF mode (`fronts` / `backs` / `combined`); hidden for `zip`. Min 1, default 1,
  integer.
- The existing per-format `getDetail()` sheet estimate is recomputed from the
  grouped+padded+copies math instead of `ceil(cardCount / cardsPerPage)`. It
  needs the element counts (already computed as `elementCounts`) and `copies`:
  `sheets = Σ ceil(elementCount * copies / cardsPerPage)`.
- The element breakdown pills already shown can optionally annotate each color
  with its sheet count at the current copy setting (e.g. `Fire ×4 · 2 sheets`).
  Annotate with sheet count.
- `onExportPDF` callback gains the `copies` value. `ReviewStep.handleExportPDF`
  forwards `copies` and `tndElements` into `exportHomePrintPDF`.

No checkbox anywhere; the copies control is a numeric stepper input.

## Edge Cases

- **copies = 1, padding on:** still groups + pads to whole sheets. This is the
  fix for the original 19-card single-copy bleed problem, independent of mass
  printing.
- **Untagged deck (no element data):** single trailing bucket; behaves like
  today plus optional copies + tail padding.
- **One element only:** one bucket, `ceil(k*N/P)` sheets, no inter-color blanks
  except the final partial-sheet pad.
- **Large copies:** sheet count scales linearly; progress callback already drives
  the UI. Avoid re-encoding: embed each unique pair's front/back PNG once and
  reuse the returned pdf-lib image handle across its N repeats (see Performance
  Note) rather than calling `embedPng` per occurrence.

## Performance Note

Embed each unique card's front/back PNG **once** (outside the repeat loop) and
reuse the pdf-lib image handle for all N draws of that card. Avoids re-encoding
and re-embedding the same bitmap N times.

## Testing

- Unit: a pure `planPrintSlots(pairs, elements, copies, cardsPerPage)` helper
  returns the ordered `Slot[]` (with nulls). Test:
  - grouping order matches `TND_ELEMENTS`,
  - each bucket length is a multiple of `cardsPerPage`,
  - whole-block repeat ordering (not per-card runs),
  - untagged trailing bucket,
  - copies = 1 with no elements is a pass-through.
- The PDF byte output itself is not unit-tested (binary); the slot planner is the
  testable seam. Visual confirmation via the print preview / a generated PDF.

## Verification

- Generate the PDF for the real deck at copies = 3, open it, confirm: every sheet
  is a single color, backs mirror correctly, blank cells align front/back, sheet
  labels name the element.
- `npm run check` clean.

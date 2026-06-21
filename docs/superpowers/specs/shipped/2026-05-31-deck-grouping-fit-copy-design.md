# Deck Releaser — FIT badge, group-by-letter, copy-for-AI

**Date:** 2026-05-31
**Scope:** `src/lib/features/choreo-card` deck-releaser print preview.

Three independent changes to the deck print/release preview, driven by Austen
viewing a 54-card 4-step LOOP deck.

## Part 1 — FIT badge only on the best count

**Problem:** the `Copies` segmented control (`CopiesSelect.svelte`) shows a 9px,
0.7-opacity badge on *every* zero-waste count, so multiple chips wear a cramped
tiny "FIT" (green under unselected, white beside the active number). Reads as
broken.

**Fix:**
- `bestFit` = smallest preset whose `annotate(p).perfect` is true (the
  authoritative `minZeroWasteCopies` zero-waste count; always present in the
  `suggestCopyCounts` ladder).
- Render the badge ("FITS") on that **one** chip only. Drop the per-chip `Nb`
  blank-count badges from the other presets (the per-chip `title` already states
  blank cells). Keep the live readout on the custom-number field — one
  contextual cell, useful while typing.
- Legibility: 9px → 11px, opacity 0.7 → 0.85, clean placement below the number.
  One chip wears it → no row noise. Static per deck/card-size → no layout shift.

## Part 2 — Group by letter (combinable with Group by color)

**Goal:** order cards AAABBBCCC instead of ABCABC, as an axis independent of
color grouping (both can be on at once → letters cluster within each color).

- New `groupByLetter` state in `DeckReleaserTab`, persisted alongside
  `groupByElement` in `deckReleaser.printSettings` (default `false`).
- `elementSorted` comparator honors both toggles:
  - primary key = element order index **only when `groupByElement`**,
  - secondary key = letter-cluster rank by first-appearance of `seq.word`
    **only when `groupByLetter`** → stable AAABBBCCC,
  - tiebreak = original composition index.
  - Both on → letter clusters sort within each color bucket.
- **Behavior change (flagged):** `groupByElement` off now actually un-clusters
  color. Today `elementSorted` element-sorts unconditionally; this makes the
  toggle honest. Default stays color-on, so the current view is unchanged.
- Toolbar: replace the single "Group by color" `FilterChipBase` with **two
  independent `FilterChipBase` toggles** — "Group by color" + "Group by letter"
  (chip-primitives rule: independent booleans → N toggles). Plumb
  `groupByLetter` / `onGroupByLetterChange` through `ReviewStep`.
- **No change** to `planPrintSlots`, `PrintPreviewPages`, or the PDF exporter:
  `PrintPreviewPages` plans slots from the `sequences` prop order without
  re-sorting, `planPrintSlots` preserves within-bucket + sequential order, and
  the PDF reads the same pre-sorted pairs + elements. Letter order is purely an
  upstream reorder that flows through.

## Part 3 — Copy-for-AI button (one button, everything)

- Reuse the shared `CopyForAIButton.svelte` primitive (icon-text, sm). Place on
  the right edge of the `ReviewStep` header; visible for both drafts and viewed
  released decks.
- New pure formatter `services/deck-ai-summary.ts`: `buildDeckAiSummary(input)`
  → markdown bundle. Sections:
  - **Header:** name / deck #, card count, step distribution, deck mode.
  - **Current print layout:** card size, cards-per-sheet, copies, group-by-color,
    group-by-letter, sheet count, blank cells (fit state).
  - **Recipe:** `rs.toRecipe()` for drafts, `release.recipe` for viewed decks —
    mode, start-orientation modes, grid modes, reversal, slice types, total
    cards, step weights (loop) / families + turn patterns (tnd).
  - **Card table:** position, letter (`card.word`), steps, color + family,
    variation summary (turns / reversal / register / grid).
- `DeckReleaserTab` assembles the input (it owns the recipe + the
  `copyWaste`/`cardsPerPage`/`groupSizes` math) and passes a `getAiSummary()`
  thunk down to `ReviewStep` → the button's `getData`.

## Reuse / no new primitives

- `CopyForAIButton.svelte` — reused (clipboard + state machine + a11y already
  built).
- `FilterChipBase.svelte` — reused for the second toggle.
- Only new file: `services/deck-ai-summary.ts` (pure string formatter).

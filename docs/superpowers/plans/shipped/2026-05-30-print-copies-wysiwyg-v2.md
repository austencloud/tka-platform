# Print Copies WYSIWYG (v2) Implementation Plan

> Execution: inline (controller has full context; edits are well-scoped). Commit each task with explicit pathspec (shared index).

**Goal:** Move the copies control onto the deck viewer toolbar with a 2026 segmented+custom control, and make the on-screen print preview repaginate to exactly what the PDF exports (strict one-color-per-full-sheet × N copies).

**Architecture:** Generalize `planPrintSlots` to `<T>` so the preview (`RenderedCard`) and the exporter (`CardPair`) share one layout planner. New `CopiesSelect` control (segmented presets 1·3·6·9·12 + hidden-spinner number field). `copies` state owned by `ReviewStep`, flows to toolbar (control), preview (display), dialog (estimate+export).

---

## Task 1 — Generalize the slot planner

**Files:** `print-slot-planner.ts`, `__tests__/print-slot-planner.test.ts`, `print-pdf-exporter.ts`

- Rename slot type to `PlannedSlot<T> = { item: T | null; elementName: string | null }`; `planPrintSlots<T>(items: T[], elements, copies, cardsPerPage): PlannedSlot<T>[]`. Body identical except `pair` → `item` and generic `T`.
- Keep a back-compat alias `export type PrintSlot = PlannedSlot<import("./types").CardPair>` so existing imports don't break.
- Update test: `slots[i].pair` → `slots[i].item`.
- Update exporter: import stays (`planPrintSlots, type PrintSlot`); replace the 4 `slot.pair` usages with `slot.item`. No behavior change.
- Verify: `npx vitest run src/lib/features/choreo-card/services/__tests__/print-slot-planner.test.ts` → 5 pass.
- Commit those 3 files.

## Task 2 — CopiesSelect control

**Files:** Create `src/lib/features/choreo-card/components/print-preview/CopiesSelect.svelte`

- Props: `value: number`, `onchange: (n: number) => void`, optional `presets = [1,3,6,9,12]`.
- Markup: a `role="radiogroup"` segmented group mirroring `CardSizeToggle` (active fill, hover, min 36–44px targets) — one button per preset, `aria-checked={value === p}`. After the buttons, an inline `<input type="number" min="1" inputmode="numeric">` whose value tracks `value` when it's not a preset; spinner arrows hidden via CSS (`appearance:none; -webkit-appearance:none; &::-webkit-outer/inner-spin-button{display:none}`). The custom field’s active styling shows when `!presets.includes(value)`.
- onblur/oninput clamp: `Math.max(1, Math.floor(n||1))`, then `onchange`.
- No checkbox, no stepper arrows, no dropdown.

## Task 3 — Preview repaginates (WYSIWYG)

**Files:** `PrintPreviewPages.svelte`

- Add prop `copies = 1`.
- Import `planPrintSlots`.
- Replace the `sheets` derived (current lines ~137–168, the `canIsolate` row-padding block) with planner-driven page isolation that carries `seqIndex`:
  ```ts
  let sheets = $derived.by(() => {
    const indexed = renderedCards.map((card, seqIndex) => ({ card, seqIndex }));
    const slots = planPrintSlots(indexed, tndElements ?? [], copies, layout.cardsPerPage);
    const pages: { card: RenderedCard; seqIndex: number | null; elementName: string | null }[][] = [];
    for (let i = 0; i < slots.length; i += layout.cardsPerPage) {
      pages.push(slots.slice(i, i + layout.cardsPerPage).map((s) => ({
        card: s.item?.card ?? BLANK_CARD,
        seqIndex: s.item?.seqIndex ?? null,
        elementName: s.elementName,
      })));
    }
    return pages;
  });
  ```
- Front + back `{#each sheet as ...}` loops: iterate slots; render `slot.card.frontUrl`/`.backUrl`; blank when falsy; click/keydown/contextmenu use `slot.seqIndex` (skip when null) instead of `sheetIndex*cardsPerPage+cardIndex`.
- Sheet labels (`page-label` + `page-guide` top): append element name when present, e.g. `Fronts · {capitalize(sheet[0]?.elementName)} · Sheet n of N`.
- `displayMode === "grid"` path untouched (copies only affects sheets mode).

## Task 4 — Control plumbing

**Files:** `PrintPreviewToolbar.svelte`, `deck-releaser/ReviewStep.svelte`, `print-preview/PrintDialog.svelte`

- `PrintPreviewToolbar`: add props `copies`, `onCopiesChange`; render `<CopiesSelect value={copies} onchange={onCopiesChange} />` in `.toolbar-left` after the size toggle.
- `ReviewStep`:
  - `let copies = $state(1);`
  - Pass `copies` + `onCopiesChange={(n)=>copies=n}` to `PrintPreviewToolbar`.
  - Pass `{copies}` to `PrintPreviewPages`.
  - Pass `{copies}` to `PrintDialog`.
  - `handleExportPDF(mode)` reads `copies` from state (drop the param default usage path; still forward `{ copies, elements: tndElements }`).
- `PrintDialog`:
  - Add prop `copies: number = 1`. Remove local `let copies = $state(1)` and the `<input>` stepper + `.copies-row` input markup.
  - Replace the copies row with a read-only summary line `Copies per card … {copies}` (reuse `.summary-row` style) shown only for non-zip formats.
  - `onExportPDF: (mode: PrintPDFMode, copies: number) => void` stays; `handleExport` passes the `copies` prop.
  - `sheetCount` / `elementCounts` estimates read the `copies` prop (already do; just sourced from prop now).
- Other `PrintDialog` callers (`CatalogBrowser`, `TnDFamilyDrillDown`, `test/print-deck`) need no change — `copies` defaults to 1.

## Task 5 — Verify

- `npm run check` once → no errors in changed files.
- Runtime (with user OK): toolbar copies change repaginates preview to one-color-per-sheet × N with element-named labels; no stepper; dialog shows `Copies: N` read-only; exported PDF matches preview.

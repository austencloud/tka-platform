# Inline Print Panel — Design

**Date:** 2026-05-30
**Status:** Approved (design), pending implementation plan
**Module:** `src/lib/features/choreo-card` (Deck Releaser)

## Problem

In the Deck Releaser review step, **Print This Deck** opens `PrintDialog` — a
centered modal with an 85%-opacity backdrop that floats over and obscures the
**live print preview** (`PrintPreviewPages`) the user is trying to print. The
modal also strands its two primary actions (Print / Download) at the top and
bottom of a tall, narrow, `width: min(900px, 100%)` box that looks marooned on a
wide 4K desktop.

Two real workflow facts the modal fights:

1. The user prints **fronts first, flips the paper, then prints backs** — never a
   single combined run. The dialog defaulted to a combined "fronts+backs" idea
   with the per-side choice buried.
2. The user wants the **preview and the print controls visible together** —
   "Why not integrate a print preview right here?"

## Solution

Retire the modal on desktop. The Deck Releaser already has a **320px right
sidebar** showing the released-decks list (`ReleaseHistoryPanel`). That list is
not something you need while focused on printing. Turn the sidebar into a
**two-mode panel** — `Browse` ↔ `Print` — switched by a `SegmentedControl` at
its top. The preview in `.releaser-main` never moves, never blurs.

```
┌─ ReviewStep (.releaser-main, flex:1) ──┐ ┌─ sidebar (fluid width) ─┐
│ Back   [ Deck name ]      [ Redraw ]   │ │ ┌─[ Browse | Print ]──┐  │  SegmentedControl
│ ── toolbar ──                          │ │ └─────────────────────┘  │
│ poker/tarot │  copies · color · ↻      │ │                          │
│ ─────────────────────────────────     │ │  BROWSE:                 │
│                                        │ │   Released Decks list    │
│        LIVE PREVIEW (untouched)        │ │   …                      │
│        sheet 1, sheet 2, …             │ │   [ Release Deck #007 ]  │  moved here
│        (scopes to selected side)       │ │                          │
│                                        │ │  PRINT:                  │
│                                        │ │   summary · element pills│
│                                        │ │   ○Fronts ○Backs         │
│                                        │ │   ○Combined ○Images      │
│                                        │ │   ─────────────          │
│                                        │ │   [ Print Fronts ] (grn) │  bottom
│                                        │ │   [ Download Fronts ]    │
└────────────────────────────────────────┘ └──────────────────────────┘
```

## Behavior

### Mode switch

- `sidebarMode: 'browse' | 'print'`, owned by `DeckReleaserTab`, default `browse`.
- A `SegmentedControl` (`color="accent"`, `size="sm"`, options
  `[{value:'browse',label:'Browse'},{value:'print',label:'Print'}]`) pinned at
  the top of the sidebar, above whichever panel is active.
- This switch is the **only** entry to print controls. The toolbar's
  **Print This Deck** button is removed; the old `showPrintDialog` modal path in
  `ReviewStep` is deleted.

### Browse mode

- Renders `ReleaseHistoryPanel` exactly as today.
- The **Release Deck #NNN** button (currently in the `ReviewStep` header
  `action-buttons`) moves to the bottom of the Browse panel. It is only shown
  when `!readOnly` (composing a new deck), matching today's gate. When viewing a
  released deck, Browse shows just the list.

### Print mode

- Renders `PrintPanel` (new — see below): deck summary, element breakdown pills,
  the 4-option side picker, and the **Print** + **Download** actions at the
  bottom.
- Selecting a side scopes the preview (next section).

### Preview scoping (the "handy" win)

`PrintPreviewPages` gains a `sideFilter: 'fronts' | 'backs' | null` prop:

| Side picker selection | `sideFilter` | Preview shows |
|---|---|---|
| Fronts | `'fronts'` | front sheets only |
| Backs | `'backs'` | back sheets only |
| Combined | `null` | all sheets (today's behavior) |
| Images (zip) | `null` | all sheets |

So picking **Fronts** makes the preview show exactly what the green **Print
Fronts** button will send — flip the stack, pick **Backs**, the preview switches
to backs. In Browse mode `sideFilter` is `null` (full preview).

### Toolbar redistribution

`PrintPreviewToolbar` declutters: card size (poker/tarot) stays on the **left**;
**copies · group-by-color · refresh** move to the toolbar's **right** section,
which is freed by removing the Print This Deck button. These three controls drive
the live preview render, so they stay always-visible regardless of sidebar mode.

### Responsive width (kill the magic 320px)

```css
.releaser-history {
  width: clamp(300px, 22vw, 440px);
  flex-shrink: 0;
}
```

Lands ~420–440px on 4K (roomy print controls), ~300px on a 1280px laptop, no
breakpoint guesswork. Browse and Print share the column so it never jumps on a
mode flip.

### Mobile (<900px)

The sidebar already stacks under the preview, capped `max-height: 280px`. Keep
that cap for **Browse** (scrollable list), but **drop it in Print mode** so the
side picker + action buttons get full height. The `SegmentedControl` sticks to
the top of the stacked panel. No separate mobile modal — one code path.

## State ownership

Lift to `DeckReleaserTab` (which already owns `rs` and the
`renderedPairs`-adjacent flow), passed down as props:

- `sidebarMode`, `selectedSide` (drives both preview `sideFilter` and the
  `PrintPanel` picker), `renderedPairs`, `isExporting`/`isPrinting`/progress/error.
- Print handlers (`handlePrint`, `handleExportPDF`, `handleExportZIP`) stay
  defined where `renderedPairs` is produced; if that production stays inside
  `ReviewStep`, lift `renderedPairs` and the handlers up via the existing
  `onPairsReady`/`onRenderStateChange` callbacks so both `ReviewStep` (preview)
  and the sidebar `PrintPanel` read one source of truth.

`selectedSide` replaces `PrintDialog`'s internal `selectedFormat` state — it now
lives at the tab so the preview can read it.

## Files

| File | Change |
|---|---|
| `components/deck-releaser/DeckReleaserTab.svelte` | Add `sidebarMode` + `selectedSide` state; render `SegmentedControl` + conditional `ReleaseHistoryPanel`/`PrintPanel` in `.releaser-history`; fluid width CSS + Print-mode height handling; move **Release Deck** button into Browse; lift print state/handlers from `ReviewStep` |
| `components/print-preview/PrintPanel.svelte` | **New.** `PrintDialog`'s `.dialog-body` content (summary, element pills, side picker, Print + Download, workflow tip) with no backdrop/close/`role=dialog` chrome. Single-column stacked layout (the dialog's existing <760px layout). Drops the in-summary `CardSizeToggle` and copies control — those live on the toolbar; summary shows size/copies as read-only text |
| `components/deck-releaser/ReviewStep.svelte` | Delete `showPrintDialog`, the `{#if showPrintDialog}<PrintDialog/>` block, and the header `action-buttons` Release button (Redraw stays); raise print state/handlers to the tab; pass `sideFilter` to `PrintPreviewPages` |
| `components/print-preview/PrintPreviewToolbar.svelte` | Move copies/group-by-color/refresh to the right section; remove the `print-btn` and its `onPrint` prop |
| `components/print-preview/PrintPreviewPages.svelte` | Add `sideFilter: 'fronts'\|'backs'\|null` prop; when set, render only that side's sheets |
| `components/print-preview/PrintDialog.svelte` | Untouched. Still imported by `test/print-deck/+page.svelte`, `TnDFamilyDrillDown.svelte`, `CatalogBrowser.svelte`; remains the modal those callers use. Only `ReviewStep` stops using it |
| `services/deck-release-store.ts` | Add `deleteDeck(deckNumber)` (manifest `deleteDoc`, counter untouched) |
| `components/deck-releaser/ReleaseHistoryPanel.svelte` | Add per-row hover/focus trash affordance with inline two-step confirm; restructure row so delete controls aren't nested in the select `<button>`; new `onDeleteRelease` prop |

## Deck deletion (Browse mode)

There is currently **no way to delete a released deck** — only `releaseDeck`,
`updateDeckMeta`, and read functions exist in `deck-release-store.ts`. Add it,
surfaced in the same Browse panel.

### Store

Add `deleteDeck(deckNumber: number): Promise<void>` to `deck-release-store.ts`:

```ts
import { deleteDoc } from "firebase/firestore";

export async function deleteDeck(deckNumber: number): Promise<void> {
  const db = await getFirestoreInstance();
  await deleteDoc(doc(db, getDeckReleaseManifestPath(deckNumber)));
}
```

Deletes only the manifest. The **counter is left untouched** — deck numbers are
permanent identifiers (content hashes, scan/short codes, and `releasedIds`
pruning all key off them), so a freed number is never reused.

### UX — inline two-step confirm

Each `release-item` in `ReleaseHistoryPanel` gets a trash affordance that appears
on hover/focus (always visible on touch). Clicking it does **not** delete
immediately; the row enters a `confirming` state where the trash icon is replaced
by inline **✓ Delete / ✗** controls. Confirm commits; cancel (or blur / Escape /
selecting another row) reverts. No modal, no context switch — matches "easy and
convenient" while keeping the two-step safety a destructive op needs.

The clickable affordances must not nest inside the existing `<button class=
"release-item">` (no button-in-button). Restructure the row so the select target
and the delete/confirm controls are sibling interactive elements within a row
container, preserving the current keyboard/`aria-pressed` select behavior.

### Flow

- `ReleaseHistoryPanel` gains `onDeleteRelease: (deckNumber: number) => void`.
- `DeckReleaserTab.handleDeleteRelease(deckNumber)`:
  1. `await deleteDeck(deckNumber)`.
  2. Remove it from `releases` and recompute `releasedIds` (so its
     `sequenceId`s return to the composable pool).
  3. If the deleted deck is the one being viewed (`rs.viewingRelease?.deckNumber
     === deckNumber`), reset back to the composer (`rs.viewingRelease = null`,
     `rs.step = "configure"`).
  4. `toast.success("Deck #NNN deleted")`.
  5. On failure, `toast.error` with the permission-aware message (mirror
     `handleConfirmRelease`'s `PERMISSION_DENIED` branch — delete is admin-gated
     by the same Firestore rules).

### Success criteria (deletion)

7. A released deck can be deleted from Browse via a two-step inline confirm; no
   accidental one-click deletes.
8. After deletion the row disappears, the deck's sequences rejoin the pool, and
   if it was being viewed the UI returns to the composer.
9. Deck numbers are never reused.

## Reuse (never-hand-roll)

- **Mode switch** → existing `SegmentedControl.svelte` (single-select group,
  exactly-one-active = chip-primitives routing rule). Not a new toggle.
- **Print panel content** → relocated from `PrintDialog`, not rewritten. Grep
  found no existing inline print-controls panel; `PrintDialog` is the source.
- **Group-by-color chip** → existing `FilterChipBase` (already in the toolbar).

## Out of scope

- No change to the print/PDF/zip generation pipeline (`planPrintSlots`,
  `exportHomePrintPDF`, `printPdfBlob`, `exportDeckZIP`) — only where the
  controls live and which sheets the preview shows.
- No change to the element-grouping (`groupByElement`) logic — the toggle just
  moves.
- The three other `PrintDialog` consumers keep the modal.

## Success criteria

1. Clicking the `Print` segment shows print controls in the sidebar; the preview
   stays fully visible and unblurred.
2. Selecting Fronts/Backs scopes the preview to that side; Combined/Images show
   all sheets.
3. **Print Fronts** / **Print Backs** send exactly the sheets shown.
4. Release Deck lives in Browse; no Release/Print buttons stranded in the header.
5. Sidebar width is fluid (no `320px` literal); usable from 1280px to 4K.
6. Mobile: Print mode gets full panel height; no modal.

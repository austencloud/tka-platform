# One-Spot Info Cell — Explicit Per-Card Chooser

**Date:** 2026-06-29
**Status:** Design (approved approach, pending spec review)
**Area:** Choreo card download/export — QR vs Mandala fill of the single empty info cell

## Problem

On a card with exactly **one** empty info cell (e.g. a 4-count sequence with the
start position shown), the QR code and the Mandala fill both want that one cell.

Today the resolution is implicit:

- `get-mandala-placements.ts:60` makes the mandala **yield** the cell to the QR
  (`rightCol = showQRCode ? cols - 1 : cols`), so with both toggles on the mandala
  returns zero placements. QR is preferential *by design*.
- But the grid only paints the QR when an image exists:
  `CardGridLayout.svelte:598` → `{#if qrGridPosition && qrDataUrl}`. When the QR
  image is unavailable (guest with no scannable code, an unsaved sequence with no
  short code yet, generation pending/failed, or start-position off), the QR cell
  is **blank** — and the mandala was already suppressed. Result: an empty cell.
- Both `showQRCode` and `showMandala` default to **on**
  (`image-composition-state.svelte.ts:72,75`), so a fresh 4-count card hits this
  contention immediately, with **no UI signal** that the two are competing for one
  slot.

`choreo-card-layout-state.svelte.ts:128` already adds a row for the **6-count
column** layout so QR + mandala both fit. There is no equivalent for the 4-count —
one spot is correct there; the card is too small to grow.

## Goal

When a card has a single info cell, make the QR-vs-Mandala choice **explicit and
per-card**, defaulting to QR (preferential), and never leave the cell blank
because of an implicit yield. Cards with two or more info cells are unchanged —
QR and mandala legitimately coexist there.

## Approved decisions

- **Resolution model:** explicit per-card single-select chooser (QR · Mandala ·
  None) for one-spot cards. Multi-cell cards keep the two independent toggles.
- **Default fill:** tracks the global toggles — both default on → **QR**. If QR is
  globally off, a one-spot card defaults to Mandala; if both off, None.
- **Persistence:** per length, same mechanism as column count and start-layout
  (`*Overrides: Record<string, …>`). Picking Mandala for 4-counts is remembered
  for all future 4-counts; other lengths are untouched.

## Architecture

### The core unit: one resolver

A single pure function decides the single cell's content, consumed by every render
path so preview and export can never disagree (the exact drift
`card-render-options.ts` was created to prevent):

```ts
// resolveInfoCellDisplay(args) → { showQRCode: boolean; showMandala: boolean }
```

Inputs: `stepCount`, `cols`, `rows`, `startPositionLayout`, `includeStartPosition`,
the global `showQRCode` / `showMandala`, the per-length `infoCellChoice`, and
`isAuthenticated`.

Logic:

1. `infoCellCount = getInfoCellCount(...)` — new pure helper beside
   `getMandalaPlacements`. Row layout → `cols - 1`; column layout → `rows - 1`
   (using the same row/col geometry, including the existing 6-count-column
   accommodation, so preview and export compute the **same** count).
2. `infoCellCount !== 1` → return the global `{ showQRCode, showMandala }`
   unchanged. (Behavior identical to today for 0-cell and 2+-cell cards.)
3. `infoCellCount === 1` → resolve the per-length choice to exactly one true:
   - `choice === "qr"` → `{ showQRCode: true, showMandala: false }`
   - `choice === "mandala"` → `{ showQRCode: false, showMandala: true }`
   - `choice === "none"` → `{ showQRCode: false, showMandala: false }`
   - Guest guard: a guest can never mint a scannable QR (existing policy). If
     `!isAuthenticated`, treat `"qr"` as `"mandala"` so the cell is never blank.

Because the resolver emits the existing effective booleans, **no placement math
changes** — `getMandalaPlacements` and `qrGridPosition` already produce exactly one
result from one true boolean. `none` yields an intentionally empty cell.

### State (mirrors `startPositionLayoutOverrides`)

In `image-composition-state.svelte.ts`:

- New persisted field `infoCellChoiceOverrides: Record<string, InfoCellChoice>`
  where `InfoCellChoice = "qr" | "mandala" | "none"`.
- `getInfoCellChoiceForStepCount(stepCount): InfoCellChoice` — returns the override
  if present, else the **derived default** from globals:
  `showQRCode ? "qr" : showMandala ? "mandala" : "none"`.
- `setInfoCellChoiceForStepCount(stepCount, value)` — if `value` equals the derived
  default, **delete** the override (clean-storage trick, identical to
  `setStartPositionLayoutForStepCount`); otherwise store it.
- `clearInfoCellChoiceOverride(stepCount)` and `hasInfoCellChoiceOverride(stepCount)`
  for parity with the start-layout API.
- Bump the persisted settings version / migration so existing stored settings get
  `infoCellChoiceOverrides: {}` (follow the file's existing migration pattern).

The global `showQRCode` / `showMandala` booleans are **never mutated** by the
chooser, so picking Mandala on a 4-count does not strip QR from 12-count cards.

### UI: `ExportImagePanel.svelte` (desktop sidebar + mobile ControlDock)

The panel knows `stepCount` and can compute `infoCellCount` from the composition
manager's per-length column/start-layout values (same inputs the live layout uses).

- `infoCellCount === 1`: replace the two independent **QR** and **Mandala** chips
  with one `SegmentedControl` (`src/lib/shared/3d/components/controls/SegmentedControl.svelte`,
  the canonical single-select primitive per `.claude/rules/chip-primitives.md`),
  `color="accent"`, `size="sm"`, options **QR · Mandala · None**. `value` =
  `getInfoCellChoiceForStepCount(stepCount)`; `onchange` =
  `setInfoCellChoiceForStepCount(stepCount, v)`.
  - Guests: omit the **QR** option → **Mandala · None** (their QR can never render;
    keeps the control honest and the cell non-blank).
- `infoCellCount !== 1`: render the existing two independent chips, unchanged.

This replaces both the desktop sidebar "QR" + "Mandala" `setting-row`s and the
mobile ControlDock `Info` chips for the one-spot case. No raw `class="chip"` filter
buttons are added (chip-primitives compliance); the segmented control owns the
single-select group and its sliding indicator.

### Render paths fed by the resolver

- **Live preview** — `choreo-card-layout-state.svelte.ts`: derive effective
  `showQRCode` / `showMandala` via the resolver before they reach
  `getMandalaPlacements` and `qrGridPosition`. The preview consumer
  (`ChoreoCard.svelte`) receives the same effective values so its QR `$effect`
  gate (`showQRCode` prop) agrees.
- **Export / download** — `card-render-options.ts` `buildCardRenderOptions`:
  replace the direct `ic.showQRCode` (line 90) and `ic.showMandala` (line 92) reads
  with the resolver's output. This file already computes `oneCount` and is the
  single source of truth for the export path, so the download PNG matches the
  preview by construction.

The deck/print path (`build-front-compose-options.ts`) is **out of scope** — it
uses the canonical locked deck visibility profile, not the user's per-card toggles.

## Files touched

| File | Change |
|---|---|
| `src/lib/shared/sequence-viewer/services/get-mandala-placements.ts` | Add `getInfoCellCount(args)` + `InfoCellChoice` type + `resolveInfoCellDisplay(args)` (or a sibling `info-cell-display.ts` if cleaner) |
| `src/lib/shared/share/state/image-composition-state.svelte.ts` | `infoCellChoiceOverrides` field + get/set/has/clear + settings migration |
| `src/lib/shared/choreo-card/state/choreo-card-layout-state.svelte.ts` | Feed resolver output into placements + `qrGridPosition` |
| `src/lib/shared/share/services/card-render-options.ts` | Use resolver for export `showQRCode` / `showMandala` |
| `src/lib/shared/sequence-viewer/components/ExportImagePanel.svelte` | SegmentedControl for one-spot; keep chips for multi-cell |

Reuses `SegmentedControl` — **no new primitive created**.

## Edge cases

- **Guest, one-spot card:** QR option omitted; default Mandala; cell never blank.
- **Authenticated, QR still generating:** cell briefly empty then the QR paints —
  unchanged from today, but now the user explicitly chose QR so the intent is clear.
- **`none` chosen:** the single cell stays intentionally empty (clean card). This is
  a deliberate state, distinct from the blank-by-accident bug.
- **Start position off:** with no anchored info-cell scheme, `infoCellCount` is 0 →
  resolver returns globals unchanged → no chooser shown (matches today).
- **6-count column:** the accommodation makes `infoCellCount === 2`, so it keeps the
  two independent chips and shows both — no chooser, no behavior change.
- **Length transitions:** switching the viewed sequence to a different length
  re-derives `infoCellCount` and the chooser appears/disappears accordingly; each
  length keeps its own remembered choice.

## Testing

- Unit (`getInfoCellCount`): row and column layouts across step counts 1–12 with
  start on/off; assert 4-count → 1, 6-count-column → 2, etc.
- Unit (`resolveInfoCellDisplay`): each `(infoCellCount, choice, isAuthenticated,
  globals)` combination → expected effective booleans; guest `"qr"` → mandala.
- Unit (state): `set` deletes override when equal to derived default; persists
  otherwise; migration seeds `{}`.
- Existing preview/export parity tests (`card-front-assembler.test.ts`,
  `find-empty-cell-for-qr.test.ts`, `getMandalaPlacements.test.ts`) must stay green;
  add a one-spot case asserting preview and export resolve the same single cell.

## Non-goals

- No change to multi-cell card behavior (both QR + mandala still coexist).
- No change to the deck/print render path.
- No growing of the 4-count grid to fit both (explicitly rejected — one spot is
  correct for a card that small).

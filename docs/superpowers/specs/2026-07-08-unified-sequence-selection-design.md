# Unified Sequence Selection — Design

**Date:** 2026-07-08
**Status:** Architecture approved (Austen, 2026-07-08). Visual specifics deliberately
left as tunable starting points — Austen lands the exact look by interacting with
real components on a test page before final values are committed.

## Goal

One centralized, reliable, accessible mechanism for hovering and selecting a whole
sequence at once, shared by the Level-1 guide sequence strips and the Choreo sheet.
Kill the two hand-rolled selection treatments that drifted apart and replace them
with a single token-driven primitive.

## Context — what exists today (both hand-rolled)

**Guide** (`_pages/*Page.svelte`, `.seq-hit`, 5 pages): one transparent absolute
`<button>` laid over a contiguous 5-cell strip. Hover only:
`outline: 2px solid rgba(120, 90, 200, 0.4); outline-offset: 4px;` + faint lavender
fill. `:focus-visible` → `#6f2da8` outline. No persistent selection — click just
emits the sequence up to the reader companion via `getGuideSequenceClick()`
(payload `{ strip, word, key }`, `key` like `t1-0`).

**Choreo** (`write/components/sheet/SheetPreviewPages.svelte`): one transparent
`.cell-select` `<button>` per grid cell. On select, **every** cell of the sequence
draws `::after` ring `border: 2px solid var(--theme-accent, #6366f1)` + 14% tint,
plus a Remove button on the first cell. Persistent single-select
(`builder.selectedSequenceId` / `toggleSequenceSelection` / `clearSelection`). Cells
live in a CSS grid and **wrap across rows**. No hover indication.

Neither reads as part of one system. There is no shared selection-ring primitive
anywhere in the codebase (grep: `SelectionRing|selectable|selection-outline` → no
UI primitive, only unrelated matches).

## Decisions (locked)

1. **Scope:** Guide + Choreo only this pass. Gallery/browse card select, the
   `/sequence/[id]` legacy surface, and any other selection surface are out of scope.
2. **Behavior unifies, not just the look:** guide sequences become persistently
   selectable, same as choreo. Click a cell selects the whole sequence group; the
   ring persists. Single-select per surface.
3. **Look:** the app accent (`--theme-accent`, fallback `#6366f1`;
   `--theme-accent-strong`, fallback `#4f46e5`, for emphasis). Token-driven so it
   matches app-wide selection language and re-themes automatically.

## Why per-cell ring (not one bounding box)

The guide strip is 5 contiguous cells on one row; a single rectangle fits it. Choreo
cells **wrap** across rows, so a sequence's bounding box is an L-shape — one
rectangle can't express it. Therefore the selection ring is drawn **per member
cell**: every cell belonging to the active group renders the same ring. This is
exactly how the guide's existing golden step ring works (a per-cell class toggled by
a context signal — `guide-active-step.svelte.ts` + `.guide-step-active` in
`guide.css`); we generalize that proven pattern into a reusable primitive. Both
surfaces then look identical by construction, and wrapping is free.

## Architecture

New home: `src/lib/shared/selection/` (cross-feature; consumed by both the guide
route and the write/choreo feature).

| File | Responsibility |
|---|---|
| `sequence-selection.svelte.ts` | Reactive state factory + Svelte context. Owns hover + single-select state, keyed by group id. Mirrors the `GuideActiveStep` class shape. |
| `SelectableSequenceCell.svelte` | Wraps one cell. Renders the transparent hit `<button>`, wires pointer + keyboard + ARIA, and applies the ring classes when its group is the hovered/selected one. |
| `selection.css` | The canonical visual layer as `:global` classes, all values from `--theme-accent*`. Hover / selected / focus-visible / reduced-motion defined once. Imported by the two host surfaces. |

### State factory — `sequence-selection.svelte.ts`

Mirrors `guide-active-step.svelte.ts` (a `$state` class + `Symbol`-keyed
`setContext`/`getContext`). Single-select; hover is transient.

```ts
import { getContext, setContext } from "svelte";

const SEQUENCE_SELECTION_KEY = Symbol("sequence-selection");

/**
 * Whole-sequence hover + single-select state, shared by any surface that lets the
 * user select a sequence (guide strips, choreo sheet). Keyed by an opaque group id
 * — every cell sharing a group id reacts together, so hovering or selecting any one
 * cell lights the whole sequence.
 */
export class SequenceSelection {
  hoveredId = $state<string | null>(null);
  selectedId = $state<string | null>(null);

  isHovered(id: string): boolean { return this.hoveredId === id; }
  isSelected(id: string): boolean { return this.selectedId === id; }

  hover(id: string | null): void { this.hoveredId = id; }

  /** Single-select. Re-selecting the current group is a no-op here; callers that
   *  want click-to-toggle (choreo) pass through toggle(). */
  select(id: string): void { this.selectedId = id; }
  toggle(id: string): void { this.selectedId = this.selectedId === id ? null : id; }
  clear(): void { this.selectedId = null; }
}

export function setSequenceSelection(state: SequenceSelection): void {
  setContext(SEQUENCE_SELECTION_KEY, state);
}

/** Null when no surface provides a scope (e.g. /print, /book) → nothing selectable,
 *  rings never render, output stays pristine. */
export function getSequenceSelection(): SequenceSelection | null {
  return getContext<SequenceSelection | null>(SEQUENCE_SELECTION_KEY) ?? null;
}
```

Choreo keeps its own `builder.selectedSequenceId` as the feature's source of truth
(Remove logic, persistence, Escape-to-clear already depend on it). The choreo host
adapts: it provides a `SequenceSelection` whose `selectedId` mirrors
`builder.selectedSequenceId` and whose `select/toggle` call
`builder.toggleSequenceSelection`. So the primitive drives the visual + a11y;
the builder stays the behavioral owner. The guide has no prior owner, so the scope
IS the owner there, and `select()` additionally emits the sequence to the companion.

### Cell wrapper — `SelectableSequenceCell.svelte`

```
Props:
  groupId: string            // sequence identity; cells sharing it react together
  isGroupStart?: boolean      // the one focusable/labeled cell (default false)
  label: string               // aria-label for the focusable cell ("Select the CAKE sequence")
  onselect?: (groupId) => void // surface consequence (guide: emit+animate; choreo: toggle+remove-affordance)
  disabled?: boolean
Children: the cell content (a PictographContainer, etc.)
```

Renders a relatively-positioned wrapper with:
- The cell content (slotted).
- A transparent absolute hit `<button>`:
  - `onpointerenter` → `scope.hover(groupId)`, `onpointerleave` → `scope.hover(null)`.
  - `onclick` → `onselect?.(groupId)` (the host decides select vs toggle).
  - `isGroupStart` cell: in tab order, `aria-label={label}`, `aria-pressed={scope.isSelected(groupId)}`.
  - Non-start cells: `tabindex="-1"`, `aria-hidden="true"` — pointer + hover only, no
    extra tab stop (fixes choreo's 5-identical-buttons redundancy).
  - `min-height`/`min-width`: `var(--min-touch-target, 44px)` via the shared class.
- Ring classes bound to scope: `class:is-hovered={scope?.isHovered(groupId)}`,
  `class:is-selected={scope?.isSelected(groupId)}`. When `scope` is null the wrapper
  renders inert (no button, no ring) so print/book are untouched.

Keyboard: the focusable button is a native `<button>`, so Enter/Space activate it for
free. Escape-to-clear stays a host concern (choreo already binds it; guide can add it).

### Visual layer — `selection.css` (STARTING VALUES — tunable)

All values below are the starting point for interactive tuning, not final. They mirror
the accent language already used for `.cell.selected::after` and the box-shadow
technique proven by `.guide-step-active` (outward `box-shadow` is not clipped by a
cell's own `overflow: hidden`; z-index lifts the active cell so the ring shows on
every edge; the lifted layer is `pointer-events: none` so it never steals the click).

```css
.tka-seq-cell { position: relative; }

.tka-seq-hit {
  position: absolute; inset: 0; z-index: 3;
  background: transparent; border: 0; padding: 0; margin: 0; cursor: pointer;
  border-radius: 6px;
  min-height: var(--min-touch-target, 44px);
  min-width: var(--min-touch-target, 44px);
}

/* Hover — subtle accent preview on every cell of the group. */
.tka-seq-cell.is-hovered::after {
  content: ""; position: absolute; inset: 0; z-index: 2; pointer-events: none;
  border-radius: 6px;
  outline: 2px solid color-mix(in srgb, var(--theme-accent, #6366f1) 45%, transparent);
  outline-offset: 3px;
  background: color-mix(in srgb, var(--theme-accent, #6366f1) 6%, transparent);
}

/* Selected — solid accent ring + tint + glow, lifted above neighbours. */
.tka-seq-cell.is-selected {
  z-index: 10;
}
.tka-seq-cell.is-selected::after {
  content: ""; position: absolute; inset: 0; z-index: 2; pointer-events: none;
  border-radius: 4px;
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--theme-accent, #6366f1) 90%, transparent),
    0 0 10px color-mix(in srgb, var(--theme-accent, #6366f1) 45%, transparent);
  background: color-mix(in srgb, var(--theme-accent, #6366f1) 12%, transparent);
}

/* Focus-visible on the group-start hit. */
.tka-seq-hit:focus-visible {
  outline: 2px solid var(--theme-accent-strong, #4f46e5);
  outline-offset: 4px;
}

@media (prefers-reduced-motion: reduce) {
  .tka-seq-cell.is-selected::after { box-shadow: 0 0 0 2px var(--theme-accent, #6366f1); }
}
```

Interactive-tuning knobs exposed on the test page (see below): ring width, offset,
radius, hover-vs-selected tint %, glow radius, and whether hover uses `outline` vs an
inset ring. These are the specifics Austen locks by feel.

## Data flow per surface

**Guide** (`Type1AlphaBetaPage`, `Type2ShiftsPage`, `Type3CrossShiftsPage`,
`GammaPage`, `Type456Page`):
1. `GuideReader` (the interactive host) creates a `SequenceSelection`, calls
   `setSequenceSelection(scope)`. `/print` and `/book` do NOT — no scope, nothing
   selectable, sheets stay pristine.
2. Each pictograph cell of a sequence strip wraps in `SelectableSequenceCell` with
   `groupId` = the strip key (`t1-0` — same value the click payload already uses),
   `isGroupStart` on cell 0, `label` = `Select the ${word} sequence`.
3. `onselect(groupId)` → `scope.select(groupId)` AND the existing
   `getGuideSequenceClick()` emit (animate in the companion). Selection persists →
   the accent group-ring stays on while it plays; the amber **step** ring
   (`.guide-step-active`, unchanged) hops cell-to-cell inside it. Two distinct
   colors, complementary — accent = "this sequence", amber = "this step".
4. The old single `.seq-hit` overlay + its per-page `<style>` block are removed.

**Choreo** (`SheetPreviewPages` + its host `ChoreoSheetView`):
1. Host provides a `SequenceSelection` mirroring `builder.selectedSequenceId`;
   `select/toggle` delegate to `builder.toggleSequenceSelection`.
2. Each `.cell` with a `sequenceId` wraps in `SelectableSequenceCell` with
   `groupId = cell.sequenceId`, `isGroupStart = cell.isSequenceStart`, and
   `onselect` → `builder.toggleSequenceSelection` (click-to-toggle preserved).
3. The Remove button stays exactly as is (choreo-only consequence), still gated on
   `isSequenceStart && isSelected`.
4. The old `.cell-select` button + `.cell.selected::after` ring are removed; the new
   `.tka-seq-*` classes replace them. Choreo gains group hover for free.

## Accessibility

- One tab stop per sequence (the group-start cell), a real `<button>` with a
  descriptive `aria-label` and `aria-pressed` reflecting selection. Non-start cells
  are pointer-only (`tabindex="-1"`, `aria-hidden`). Fixes choreo's redundant N
  buttons and keeps the guide's single-entry ergonomics.
- Enter/Space activate natively. Escape-to-clear stays host-owned.
- 44px minimum touch target from `--min-touch-target`.
- `prefers-reduced-motion` collapses the glow to a flat ring in the shared CSS; no
  consumer re-implements it.
- Focus-visible ring uses `--theme-accent-strong` for contrast against the hover/
  selected accent.

## Interactive-only / print safety

Rings and hit buttons render only when a `SequenceSelection` scope is present in
context. `/print` and `/book` never set one, so `getSequenceSelection()` is null and
`SelectableSequenceCell` renders inert content with no button and no ring — same
guarantee `.seq-hit` and `.guide-step-active` give today. A contract test asserts it.

## Test page (the interactive tuning ground)

`src/routes/test/sequence-selection/+page.svelte` — the surface Austen interacts with
to land the visual. Real components, per `visualization-routing.md` (test page with
real primitives, not a hand-rolled mockup). It renders:
- A **contiguous strip** (guide-style: 5 real `PictographContainer` cells in a row).
- A **wrapping group** (choreo-style: real cells in a grid narrow enough to wrap the
  sequence across 2 rows).
- Both wired to one `SequenceSelection` scope so hover/select/focus behave live.
- A control panel (existing `SegmentedControl` / `FilterChipBase` primitives, not
  hand-rolled) exposing the tunable knobs: ring width, offset, radius, hover tint %,
  selected tint %, glow radius, hover style (outline vs inset). Knobs write CSS
  custom properties on a wrapper so changes are live and copy-outable.

This page is where "I need to get my opinion through actual interaction with real
components" happens. Final values from this session get baked into `selection.css`.

## What gets removed

- Guide: `.seq-hit` markup + `.seq-hit` / `.seq-hit:hover` / `.seq-hit:focus-visible`
  CSS in all 5 `_pages/*` files.
- Choreo: `.cell-select` button + `.cell.selected::after` + `.cell-select` CSS in
  `SheetPreviewPages.svelte`.
- Neither surface keeps a local selection/hover visual; both point at `selection.css`.

## Verification

- `npm run check` green.
- Contract test `tests/unit/sequence-selection-contract.test.ts`: the two host
  surfaces import the shared primitive; neither reintroduces a raw
  `.seq-hit`/`.cell-select` interactive ring (static assert, mirrors
  `sequence-viewer-shell-contract.test.ts`).
- SSR: `/print` stays ring-free and button-free (grep the rendered HTML for
  `tka-seq-hit` → absent).
- Interactive: the test page renders both layouts; Austen eyeballs hover, select,
  focus-visible, wrap, and reduced-motion in one place.

## Out of scope (named, not forgotten)

- Gallery/browse single-card selection (different DOM: one card, not multi-cell).
- The `/sequence/[id]` legacy surface.
- Connected/merged borders between adjacent same-group cells (per-cell full rings
  ship first; a "seamless group outline" polish can layer on later if wanted).
- Multi-select. Both surfaces are single-select; not changing that.
- Collapsing `GuideActiveStep.key` and `SequenceSelection.selectedId` into one signal
  (they carry the same strip key in the guide; a later cleanup, not v1).

## Open visual questions (resolved by interaction, not up front)

1. Hover treatment: gapped `outline` (today's guide feel) vs inset ring vs tint-only?
2. Selected glow strength — subtle ring vs the fuller `box-shadow` glow above?
3. Ring radius/offset per surface — the choreo cells are tighter than guide cells; one
   value for both, or a per-surface `--tka-seq-*` override?
4. Does the persistent accent group-ring during guide animation compete with the amber
   step ring, or read as complementary? (The reason it needs to be felt, not specced.)

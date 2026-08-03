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

## The selectable unit (why the ring count differs per surface)

The primitive rings a **selectable unit** — whatever content a consumer wraps in one
`SelectableSequenceCell`. How many units make up a sequence is the layout's call:

- **Guide:** the strip is one bordered `.strip` grid of 5 *abutting* cells (shared
  hairline dividers, no gaps). Per-cell rings there would draw 5 rings inside one
  bordered box — busy and wrong. So the guide wraps the **whole strip as one unit** →
  a single clean ring around the strip. (The strip is contiguous on one row, so one
  rectangle fits perfectly.)
- **Choreo:** cells live in a CSS grid and **wrap across rows**, so a sequence's
  bounding box is an L-shape a single rectangle can't express. So choreo wraps **each
  cell as its own unit**, all sharing one `groupId` → per-cell rings that light and
  select together and survive wrapping.

Same classes, same scope, same CSS in both. Hover/select is keyed by `groupId`, so
whether a group is 1 unit or N, hovering or selecting any unit lights the whole group.
This generalizes the guide's existing golden step ring (a class on the *existing*
element toggled by a context signal — `guide-active-step.svelte.ts` + `.guide-step-active`
in `guide.css`) into a reusable, layout-agnostic primitive. The two surfaces are
cohesive (identical accent language, states, a11y) without being forced to identical
ring counts their layouts can't support.

### Why a class + child hit, not a wrapper component

The selection visual is applied by putting a `.tka-seq-cell` class (plus reactive
`is-hovered` / `is-selected`) on the host's *own* element — the guide `.strip`, the
choreo `.cell` — exactly like `.guide-step-active` sits on the existing `.cell`. Two
reasons a wrapper component fails here:

1. **Scoped styles don't cross the boundary.** A wrapper whose root carried
   `class="cell"`/`"strip"` would NOT pick up the host's scoped `.cell`/`.strip` rules
   (Svelte scopes those to the host's own template; a `class` string handed to a child
   does not inherit the parent's scope hash). The border/aspect-ratio/grid would be
   lost.
2. **`overflow: hidden` clips a nested `::after`.** Choreo's `.cell` sets
   `overflow: hidden` (to clip the pictograph). A ring drawn as an `::after` on a child
   nested inside it is a descendant and gets clipped. A `box-shadow` on the element
   *itself* is not clipped by that same element's overflow — which is precisely why
   `.guide-step-active` draws its ring as a `box-shadow` on the `.cell`.

So the ring is a `box-shadow`/`outline` on the `.tka-seq-cell` element itself (never a
nested pseudo for the outward ring; a pseudo is used only for the inner tint, where
clipping is harmless). The interaction + a11y live in a tiny `SelectionHit` child the
host drops inside the element; the host binds the `is-*` classes from the scope.

## Architecture

New home: `src/lib/shared/selection/` (cross-feature; consumed by both the guide
route and the write/choreo feature).

| File | Responsibility |
|---|---|
| `sequence-selection.svelte.ts` | Reactive state factory + Svelte context. Owns hover + single-select state, keyed by group id. Mirrors the `GuideActiveStep` class shape. |
| `SelectionHit.svelte` | The transparent hit `<button>` a host drops inside its `.tka-seq-cell` element. Wires pointer + keyboard + ARIA from the scope. Renders nothing when no scope is present. |
| `selection.css` | The canonical visual layer as `:global` classes (`.tka-seq-cell`, `.is-hovered`, `.is-selected`, `.tka-seq-hit`), all values from `--theme-accent*`. Outward ring is a `box-shadow`/`outline` on the element (unclipped); tint is a pseudo. Hover / selected / focus-visible / reduced-motion defined once. Imported by the two host surfaces. |

The host applies `.tka-seq-cell` + `class:is-hovered`/`class:is-selected` (bound to the
scope, keyed by `groupId`) to its own element, and drops a `<SelectionHit groupId … />`
inside — the same shape as today's `class:guide-step-active` + a context signal.

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

### Hit + a11y — `SelectionHit.svelte`

A tiny child the host drops inside its `.tka-seq-cell` element. It renders only when a
scope is present (so print/book emit no button). It owns interaction + ARIA; the host
owns the element and its `is-*` classes.

```
Props:
  groupId: string             // sequence identity; units sharing it react together
  isGroupStart?: boolean       // the one focusable/labeled unit per group (default false)
  label?: string               // aria-label for the focusable unit ("Select the CAKE sequence")
  onselect?: (groupId) => void // surface consequence (guide: emit+animate; choreo: toggle+remove-affordance)
```

Renders (only when `getSequenceSelection()` is non-null):

```svelte
<button
  type="button"
  class="tka-seq-hit"
  aria-label={isGroupStart ? label : undefined}
  aria-hidden={isGroupStart ? undefined : "true"}
  aria-pressed={isGroupStart ? scope.isSelected(groupId) : undefined}
  tabindex={isGroupStart ? undefined : -1}
  onpointerenter={() => scope.hover(groupId)}
  onpointerleave={() => scope.hover(null)}
  onclick={() => onselect?.(groupId)}
></button>
```

- `isGroupStart`: in tab order, labelled, `aria-pressed` reflects selection.
- Non-start units: `tabindex="-1"` + `aria-hidden="true"` — pointer + hover only, no
  extra tab stop (fixes choreo's N-identical-buttons redundancy; the guide is one unit
  per sequence, so it is naturally single-entry).
- `min-height`/`min-width`: `var(--min-touch-target, 44px)` via `.tka-seq-hit`.
- Native `<button>` → Enter/Space activate for free. Escape-to-clear stays host-owned
  (choreo already binds it; guide clears on companion close).

### Host integration

The host puts the classes on its own element and drops the hit inside:

```svelte
<div
  class="strip tka-seq-cell"
  class:is-hovered={selection?.isHovered(key)}
  class:is-selected={selection?.isSelected(key)}
  style="…coords…"
>
  <!-- existing content (the 5 pictograph cells, keeping class:guide-step-active) -->
  <SelectionHit groupId={key} isGroupStart label={`Select the ${word} sequence`}
    onselect={() => emitSequence?.({ strip, word, key })} />
</div>
```

`.tka-seq-cell` only adds `position: relative` (harmless where the host already sets
`position`, and the host's scoped rule wins anyway). No wrapper div, no scope-hash
crossing, and the ring is a `box-shadow`/`outline` on this element so choreo's
`overflow: hidden` can't clip it.

### Visual layer — `selection.css` (STARTING VALUES — tunable)

All values below are the starting point for interactive tuning, not final. They mirror
the accent language already used for `.cell.selected::after` and the box-shadow
technique proven by `.guide-step-active` (outward `box-shadow` is not clipped by a
cell's own `overflow: hidden`; z-index lifts the active cell so the ring shows on
every edge; the lifted layer is `pointer-events: none` so it never steals the click).

The outward ring is a `box-shadow`/`outline` on the `.tka-seq-cell` element itself
(never a nested pseudo), so choreo's `overflow: hidden` on `.cell` cannot clip it —
the same reason `.guide-step-active` uses a `box-shadow` on the `.cell`. A pseudo is
used only for the inner tint, where clipping is harmless. `z-index` lifts the active
element so the ring shows on every edge over neighbours.

```css
.tka-seq-cell { position: relative; }

.tka-seq-hit {
  position: absolute; inset: 0; z-index: 3;
  background: transparent; border: 0; padding: 0; margin: 0; cursor: pointer;
  border-radius: var(--tka-seq-radius, 6px);
  min-height: var(--min-touch-target, 44px);
  min-width: var(--min-touch-target, 44px);
}
.tka-seq-hit:focus-visible {
  outline: 2px solid var(--theme-accent-strong, #4f46e5);
  outline-offset: 4px;
}

/* Hover — outline on the element itself (unclipped), lifted above neighbours. */
.tka-seq-cell.is-hovered {
  z-index: 4;
  outline: var(--tka-seq-hover-width, 2px) solid
    color-mix(in srgb, var(--theme-accent, #6366f1) 45%, transparent);
  outline-offset: var(--tka-seq-hover-offset, 3px);
  border-radius: var(--tka-seq-radius, 6px);
}
/* Inner tint via pseudo (clipping harmless — it fills the box). */
.tka-seq-cell.is-hovered::after {
  content: ""; position: absolute; inset: 0; z-index: 2; pointer-events: none;
  background: color-mix(in srgb, var(--theme-accent, #6366f1) var(--tka-seq-hover-tint, 6%), transparent);
}

/* Selected — solid accent ring + glow as box-shadow ON the element (unclipped). */
.tka-seq-cell.is-selected {
  z-index: 10;
  border-radius: var(--tka-seq-radius, 6px);
  box-shadow:
    0 0 0 var(--tka-seq-sel-width, 2px)
      color-mix(in srgb, var(--theme-accent, #6366f1) 90%, transparent),
    0 0 var(--tka-seq-sel-glow, 10px)
      color-mix(in srgb, var(--theme-accent, #6366f1) 45%, transparent);
}
.tka-seq-cell.is-selected::after {
  content: ""; position: absolute; inset: 0; z-index: 2; pointer-events: none;
  background: color-mix(in srgb, var(--theme-accent, #6366f1) var(--tka-seq-sel-tint, 12%), transparent);
}
/* When both true (hovering the selected unit) the selected ring wins. */
.tka-seq-cell.is-selected.is-hovered { outline: none; }

@media (prefers-reduced-motion: reduce) {
  .tka-seq-cell.is-selected {
    box-shadow: 0 0 0 var(--tka-seq-sel-width, 2px) var(--theme-accent, #6366f1);
  }
}
```

Interactive-tuning knobs exposed on the test page (see below), all `--tka-seq-*`
custom properties: ring width, offset, radius, hover-vs-selected tint %, glow radius.
These are the specifics Austen locks by feel.

## Data flow per surface

**Guide** (`Type1AlphaBetaPage`, `Type2ShiftsPage`, `Type3CrossShiftsPage`,
`GammaPage`, `Type456Page`):
1. `GuideReader` (the interactive host) creates a `SequenceSelection`, calls
   `setSequenceSelection(scope)`. `/print` and `/book` do NOT — no scope, nothing
   selectable, sheets stay pristine.
2. Each sequence **strip** (the whole `.strip`, one unit) gets `class="strip
   tka-seq-cell"` + `class:is-hovered`/`class:is-selected` bound to the scope (keyed by
   the strip key `t1-0` — the same value the click payload already uses), and a
   `<SelectionHit groupId={key} isGroupStart label={`Select the ${word} sequence`} …/>`
   dropped inside it. The 5 pictograph `.cell`s keep their `class:guide-step-active`.
   One ring around the whole strip.
3. `SelectionHit`'s `onselect(groupId)` fires the existing `getGuideSequenceClick()`
   emit (animate in the companion); `GuideReader.handleSequenceClick` also calls
   `selection.select(payload.key)`, so selection persists → the accent group-ring
   stays on while it plays; the amber **step** ring (`.guide-step-active`, unchanged)
   hops cell-to-cell inside it. Two distinct colors, complementary — accent = "this
   sequence", amber = "this step".
4. The separate `.seq-hit` overlay `{#each}` block + its per-page `<style>` rules are
   removed (5 pages). The strip's own `.strip` visual/layout CSS stays.

**Choreo** (`SheetPreviewPages` + its host `ChoreoSheetView`):
1. Host provides a `SequenceSelection` and keeps its `selectedId` mirrored to
   `builder.selectedSequenceId` via an `$effect`. The builder stays the behavioral
   owner (Remove/persistence/Escape).
2. Each `.cell` with a `sequenceId` gets `tka-seq-cell` + `class:is-hovered`/
   `class:is-selected` (keyed by `cell.sequenceId`) and a `<SelectionHit
   groupId={cell.sequenceId} isGroupStart={cell.isSequenceStart} …/>` whose `onselect`
   → `onSelectSequence(id)` → `builder.toggleSequenceSelection(id)` (click-to-toggle
   preserved).
3. The Remove button stays exactly as is (choreo-only consequence), still gated on
   `isSequenceStart && isSelected`.
4. The old `.cell-select` button + `.cell.selected::after` ring are removed; the shared
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

Hit buttons render only when a `SequenceSelection` scope is present in context.
`/print` and `/book` never set one, so `getSequenceSelection()` is null, `SelectionHit`
renders nothing, and the host binds `is-hovered`/`is-selected` to a null scope
(`selection?.isSelected(...)` → falsy) so no ring paints — same guarantee `.seq-hit`
and `.guide-step-active` give today. A contract test asserts it.

## Test page (the interactive tuning ground)

`src/routes/test/sequence-selection/+page.svelte` — the surface Austen interacts with
to land the visual. Real components, per `visualization-routing.md` (test page with
real primitives, not a hand-rolled mockup). It renders:
- A **contiguous strip** (guide-style: 5 real `PictographContainer` cells in a row).
- A **wrapping group** (choreo-style: real cells in a grid narrow enough to wrap the
  sequence across 2 rows).
- Both wired to one `SequenceSelection` scope so hover/select/focus behave live.
- A control panel of range sliders (continuous px/% values — a dev-only tuning
  surface, so native `range` inputs are the right control; no-checkboxes does not
  apply to sliders) exposing the tunable knobs: ring width, offset, radius, hover
  tint %, selected tint %, glow radius. Each slider writes a `--tka-seq-*` custom
  property on the stage wrapper so changes are live and copy-outable straight into
  `selection.css`.

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

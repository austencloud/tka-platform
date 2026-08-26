# Buugeng Chirality Belongs to the Prop Picker

**Date:** 2026-08-25
**Status:** approved in conversation, implementing

## Problem

Buugeng-family props (`buugeng`, `bigbuugeng`, `trigeng`) are asymmetric, so
their handedness is a real choice: it changes what the prop looks like on every
surface, and two props of opposite chirality nest at a shared hand point instead
of separating (`beta-offset.ts` Gate 4).

That choice is reachable from exactly two places, both an unlabelled 36px
`fa-arrows-left-right` icon button whose only state cue is a `title` attribute:

- `features/create/shared/components/sequence-actions/PropTypeRow.svelte`
  (the Create step editor's per-color row)
- `settings/components/tabs/prop-type/CompactPropDisplay.svelte`
  (Settings -> Prop Type readout)

Meanwhile the prop *picker* — `BentoPropGrid` / `PropSelectionSheet` — has no
concept of chirality at all. Its contract is `onSelect(propType)` and nothing
else. That picker is mounted in eleven places, including the Animation Panel's
"Props" pill sitting directly beside the 2D canvas, the Arena prop drawer, My
Props, the deck releaser, Tunnel art settings, and the Level-1 guide. From every
one of them, chirality is unreachable.

Austen (2026-08-25): *"It should be way easier to change the chirality of the
buugeng and it should not be hidden behind this single button that only exists
in the step editor."*

## Decision

Chirality stays a modifier rather than becoming prop identity, but the modifier
moves into the picker, where it is visible and where every host inherits it from
one change.

Rejected: splitting each buugeng-family prop into two tiles (`Buugeng` /
`Buugeng mirrored`). It matches how Big variants already work — own tile, no
drill-down — but it doubles three tiles for an axis that is not prop identity,
changes `onSelect` for all eleven consumers, and cannot express per-hand
independence in the single-prop hosts.

## Design

### Seam

`BentoPropGrid.svelte` gains one optional grouped prop:

```ts
chirality?: {
  flipped: boolean;
  hand?: "blue" | "red";   // omitted = the control writes both hands
  onChange: (flipped: boolean) => void;
};
```

Absent means the row does not render, so no existing host breaks. The grouped
shape keeps it one seam rather than three loose props, and `hand` is what the
accessible name and the accent indicator read.

### Presentation

`PropChiralityRow.svelte`, a new sibling in
`settings/components/tabs/prop-type/`. It renders a visible "Chirality" label
plus a `SegmentedControl` — the canonical exactly-one primitive per
`chip-primitives.md` — with two options, `semantics="radiogroup"`.

Each segment renders the currently selected prop's own art through
`SegmentedControl`'s existing `optionContent` snippet: one upright, one
`scaleX(-1)`. No change to the primitive is needed; the slot already exists and
already documents that the option's `label` keeps owning the accessible name.

Visible words are **Standard** and **Mirrored**. The art carries the actual
difference; the words carry it for anyone who cannot resolve the small glyph.

The row renders only when the selected prop is buugeng-family, and it mounts in
the picker's existing bottom dock — the same slot `premium-nudge-dock` already
uses, outside `grid-scroll` — so revealing it moves nothing inside the grid.

### Per-hand vs both hands

The picker is already `color`-aware, so this falls out of the existing shape:

- **Color-scoped hosts** (`PropSelectionSheet` opened from the step-editor row)
  pass `hand`, and write that hand only. Blue Standard + red Mirrored stays
  reachable, which is the configuration that nests.
- **Single-prop hosts** (Animation Panel props pill, viewer art settings) omit
  `hand` and write both, exactly as `handlePropTypeChange` already does for prop
  type itself in `viewer-shell-interaction-state.svelte.ts`.

### Hosts wired

Animation Panel props pill, `PropSelectionSheet` (both colors), Settings -> Prop
Type, Arena prop drawer, My Props, Tunnel art settings.

Deliberately **not** the deck releaser or the Level-1 guide. The releaser renders
canonical print cards, and `image-composer` takes chirality from explicit
overrides only so a printed card never inherits the operator's handedness
(commit `9bf5a7d331`). A control there would fight that boundary.

### The two existing buttons

- **`CompactPropDisplay`**: its flip icon is a straight duplicate of the new row
  in the same view. Removed. The readout keeps mirroring its tile art so it
  still shows state.
- **`PropTypeRow`**: kept. It is the one-click per-color path and does not cost
  a sheet open. It gains a visible state readout and `aria-pressed` instead of
  relying on a `title` attribute.

## Verification

- Contract test: the picker exposes the seam, and each wired host passes it.
- Screenshots at all seven required viewports, with attention to whether the
  revealed row shifts anything in the Animation Panel dock tray or the mobile
  `PropSelectionSheet`.

## Related

- `.claude/rules/chip-primitives.md` — SegmentedControl owns exactly-one groups
- `.claude/rules/never-hand-roll.md` — extend the picker, do not add a 12th control
- `.claude/rules/no-layout-shift.md` — the reveal must not move siblings
- Commit `9bf5a7d331` — chirality reaching the rasterized render path

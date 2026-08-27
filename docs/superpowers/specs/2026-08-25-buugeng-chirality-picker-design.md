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
  hands: readonly { hand: "blue" | "red"; flipped: boolean }[];
  onChange: (hand: "blue" | "red", flipped: boolean) => void;
};
```

Absent means the row does not render, so no existing host breaks. The grouped
shape keeps it one seam rather than three loose props, and each entry's `hand`
is what its accessible name and accent read.

`hands` names the hands this picker governs: one entry for a picker that chooses
a single hand's prop, both entries for a picker that sets the pair. A picker that
sets both renders **two controls**, never one control writing both values — see
Per-hand, always.

### Presentation

`PropChiralityRow.svelte`, a new sibling in
`settings/components/tabs/prop-type/`. It renders a visible "Chirality" label
plus a `SegmentedControl` — the canonical exactly-one primitive per
`chip-primitives.md` — with two options, `semantics="radiogroup"`.

Each segment renders the currently selected prop's own art through
`SegmentedControl`'s existing `optionContent` snippet: one upright, one
`scaleX(-1)`. No change to the primitive is needed; the slot already exists and
already documents that the option's `label` keeps owning the accessible name.

Visible labels are **A** and **B**, matching what pictograph-inspect already
prints (`sequence-actions/pictograph-inspect/formatters.ts`). Neither handedness
is canonical — which SVG happens to be the base asset is the only thing that
would make one "standard" — so a neutral index tells the truth where
Standard/Mirrored implied a deviation from a norm that does not exist. The MCP
glossary has no `chirality` term, so no canonical vocabulary is being overridden.

The art carries the actual difference and is sized to say so; the letter carries
it for anyone who cannot resolve the glyph, and gives each segment an accessible
name.

The row renders only when the selected prop is buugeng-family, and it mounts in
the picker's existing bottom dock — the same slot `premium-nudge-dock` already
uses, outside `grid-scroll` — so revealing it moves nothing inside the grid.

### Per-hand, always

Chirality is **not** shared between hands the way prop type is. Buugeng chirality
is a statement about how the two props relate: two of the same handedness stay
apart, two of opposite handedness nest into one shape. A control that writes both
hands at once can only ever produce the same-handedness case, which erases the
only distinction the setting exists to make. Austen, 2026-08-26: *"it's all about
left's relationship to right so you need to be able to pick the left and right
chirality individually."*

So:

- **Color-scoped hosts** (`PropSelectionSheet` opened from the step-editor row,
  the Cat Dog blue/red grids) pass that one hand and render one control.
- **Pair hosts** (Animation Panel props pill, viewer art settings, Settings ->
  Prop Type outside Cat Dog) pass both hands and render two controls side by
  side — blue then red. This is where prop type and chirality diverge:
  `handlePropTypeChange` mirroring one prop type onto both hands is correct;
  mirroring chirality is not.

The two controls carry a per-hand background wash and ring built from
`--dm-motion-blue` / `--dm-motion-red`, which is what makes them read as two
groups rather than one four-option bar, and what lets the words Blue and Red stay
off the face (`chip-primitives.md`, Blue / Red Prop Identity). Each control keeps
a hand-specific `aria-label` as the non-visual cue. Below a 340px container the
pair stacks one per line and the "Chirality" label moves above it.

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

# Props Settings Tab Redesign — Flat Grid + Prop Modifiers

**Date:** 2026-06-18
**Status:** Phase 1 approved (build now); Phase 2 scoped (spec only)
**Author:** Austen + Claude (Opus 4.8)

## Context

The Props settings tab had two pain points:

1. **A redundant bottom sheet.** Clicking a prop-type rectangle
   (`CompactPropDisplay`) opened `PropSelectionSheet` — a `Drawer` wrapping the
   *same* `BentoPropGrid` already shown inline on desktop. Pure redundancy.
2. **A variant popover.** Multi-variant families (Staff→Big Staff, etc.) hid
   their variants behind a `Popover` on the base button — fiddly, and the count
   badges added noise.

`PropSelectionSheet` is shared (Arena, step editor, global prop drawer), so it is
**not** deleted; the Props tab simply stops using it. `BentoPropGrid` is the one
prop grid behind all those surfaces, so flattening it improves them consistently.

## Phase 1 — Flat grid, three sections (BUILD NOW)

### Single inline selector at every breakpoint
- Desktop: controls-panel (`CompactPropDisplay` readout + CatDog toggle +
  presets) left, `BentoPropGrid` inline right. Cat/dog → dual grids side-by-side.
- Mobile: grid renders inline under the controls (no sheet). Cat/dog → a
  Blue/Red **`SegmentedControl`** (shared primitive, single-select, hand color)
  over one grid; the tab picks which hand it edits. (`matchMedia` 899px.)
- `CompactPropDisplay` stops opening a sheet — it is a current-selection
  **readout** (icon + name) that hosts the chirality flip control.

### Flatten `BentoPropGrid`
- Remove the `Popover` variant-drill, the count badges, and the
  base-vs-variant split. **Every shown prop is its own button** (`PropTypeButton`,
  plain select).
- Group by three picker sections via a new **additive** `PROP_PICKER_SECTIONS`
  list (PropType[] per section). Do **not** change the shared `category` taxonomy
  or the variant maps in `prop-type-display-registry.ts` — 11 other consumers
  (`PropPopover`, `MyPropsDrawer`, composition recipes, …) depend on them.

### Sections (curated)

| Section | Props |
|---|---|
| **Standard** (11) | Staff, Club, Fan, Triad, Mini Hoop, Buugeng, Trigeng, Eight Rings, Double Contact Ball, Torch, Sword |
| **Big** (9) | Big Staff, Big Club, Big Triad, Big Hoop, Big Buugeng, Big Eight Rings, Big Torch, Big Chicken, Big Double Star |
| **Novelty** (5) | Chicken, Double Star, Quiad, Triquetra, Triquetra 2 |

### Curation
- **Gone entirely** (add to `DEACTIVATED_PROP_TYPES`): **Fractalgeng**, **Poi**
  (Poi is a `club.svg` placeholder and needs its own design + a real icon).
- **Kept, hidden from this picker** (still wired everywhere they're used; simply
  absent from `PROP_PICKER_SECTIONS`):
  - **Simple Staff** — backend prop that strips thumb orientation for pictographs
    that have none. Not audience-facing.
  - **Hand** — not a real prop (different properties); reserved for hand-path
    teaching. Stays in its ~20 data/render call sites; just not a picker option.
- **Culled from picker**: **Staff V2** (near-dupe alternate).

### Preserved
- Buugeng chirality flip in the readout.
- Presets (1-9,0 keyboard) and Cat/Dog toggle, unchanged.
- `PropSelectionSheet` untouched (Arena / step editor / global drawer keep working
  on the same flattened grid).

### Verify (Phase 1)
`npm run check` green. Desktop: rectangle no longer opens a sheet; inline grid is
flat with three sections, no popover. Mobile: inline grid; cat/dog shows the
Blue/Red tab. Buugeng flip works. Presets + shortcuts unaffected.

## Phase 2 — Prop Modifier (SCOPED, not built yet)

A way to transform the **current selection** into a variation of itself, on the
`CompactPropDisplay` readout (where the buugeng flip already lives), per hand.
**Additive** to the Big section — both resolve to the same enum; the section is
for browsing, the modifier for quick transforms.

### Three modifier axes (per Austen's direction)

1. **Size — Standard ⇄ Big.** Props with a big variant. Implementation: swap the
   enum via the existing `BASE_TO_VARIANTS` map (`STAFF ⇄ BIGSTAFF`). No new data.
   Big-capable set derivable from that map.
2. **In/Out — one-ended props** (Club, Fan, Triad, … exact set TBD). Swaps the
   prop's out-orientation to in by selecting the **alternate version baked into
   the SVG**. Data representation ties into the orientation system; to be detailed
   at Phase 2 planning (likely an alternate baked SVG keyed off an in/out flag).
3. **Chirality flip — Buugeng + Trigeng only.** Mirror on the other axis, which
   changes the two props' spatial relationship to each other. Generalizes the
   existing `blueBuugengFlipped`/`redBuugengFlipped` flip boolean from buugeng to
   trigeng. Austen: only these two have this distinct quality.

### Notes / open items for Phase 2 planning
- Reverse today has two representations — the flip boolean (chirality) and a
  distinct enum (`TRIQUETRA2` = Triquetra's alternate hold). Phase 2 should
  reconcile: chirality stays a per-hand flag; the in/out axis likely a second
  per-hand flag selecting the alternate baked SVG; reconsider whether
  `TRIQUETRA2` folds into Triquetra + a modifier.
- The Big section can remain even after modifiers ship (browse vs transform).
- Exact one-ended prop set for the In/Out axis is TBD with Austen.

## Change set (Phase 1)

| File | Action |
|---|---|
| `prop-type-display-registry.ts` | add `PROP_PICKER_SECTIONS` (additive); add Fractalgeng + Poi to `DEACTIVATED_PROP_TYPES` |
| `prop-type/BentoPropGrid.svelte` | flatten: remove Popover/badges/variant split; render `PROP_PICKER_SECTIONS` flat |
| `tabs/PropTypeTab.svelte` | (already) inline selector at all breakpoints + mobile cat/dog `SegmentedControl`; no sheet |
| `prop-type/CompactPropDisplay.svelte` | (already) readout + flip, no sheet-open |
| `prop-type/PropSelectionSheet.svelte` | untouched (shared) |
| `prop-type/PropTypeButton.svelte` | simplify if popover-only props drop (verify still used for plain select) |

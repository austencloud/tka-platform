# No Left-Edge Accent Bar — ENFORCED

## The Problem This Solves

The gallery's filter picker marked its selected category with
`box-shadow: inset 3px 0 0 var(--theme-accent)` — a colored bar down the left
edge of the tile. Austen (2026-08-11): *"it's doing this whole highlight the
left edge of the container pattern which is quintessential AI generated slop.
I need you to ban that from future styles because that is the most dead
giveaway this was AI generated and I'm not OK with that."*

He is right about the provenance. The left-edge accent bar is the single most
over-represented "selected/active" treatment in web training data — it shows up
in every generated dashboard, sidebar, and card list. Shipping it makes a
surface read as machine output rather than as a designed product, which is the
exact bar `visual-verification-mandatory.md` closes with: *does it look like a
product, or like output?*

## The Rule

**Never indicate selected, active, current, or focused state with a colored bar
on one edge of a box.** That includes every spelling of it:

- `box-shadow: inset Npx 0 0 <color>` (left bar) and its `inset -Npx 0 0`,
  `inset 0 Npx 0`, `inset 0 -Npx 0` siblings (right / top / bottom bars)
- `border-left: 3px solid <accent>` applied on an `.active` / `.selected` /
  `[aria-current]` / `:checked` variant
- A `::before`/`::after` pseudo-element absolutely positioned as a thin strip
  along one edge to signal selection

## What To Use Instead

Selection is a property of the WHOLE element, so mark the whole element:

1. **Accent edge all the way around** — `border-color: var(--theme-accent)`,
   optionally plus a full ring: `box-shadow: 0 0 0 1px color-mix(in srgb,
   var(--theme-accent) 55%, transparent)`.
2. **A tint of the accent in the background** —
   `color-mix(in srgb, var(--theme-accent) 22%, var(--theme-card-bg))`.
3. **A double ring** when the element carries full-bleed art a tint cannot sit
   on (the gallery's level tiles: `0 0 0 3px <panel-bg>, 0 0 0 6px <accent>`).
4. **The shared primitive's own selected state** — `SegmentedControl`'s sliding
   indicator, `FilterChipBase`'s active styling. Reach for these first
   (`chip-primitives.md`).

Whatever you pick, keep a non-color cue too (`aria-current`, `aria-pressed`,
`aria-selected`): color alone is not an accessible state signal.

## The Legitimate Exception: color as DATA

A colored edge stripe is fine when it encodes **identity**, not selection — a
per-category, per-module, per-owner, or per-severity color that is present on
every item in the list and differs between them. Examples already in the repo:
`--section-color`, `--module-color`, `--owner-color`, severity stripes on
feedback dialogs, and the spine on `BookCoverArt`. The test: **does the stripe
still appear when nothing is selected?** If yes, it is data. If it appears only
on the active item, it is the banned pattern.

## The Self-Check

Grep your diff before shipping any selected-state styling:

```bash
git diff -U0 | grep -nE "inset [0-9]+px 0 0|border-(left|right|top|bottom): *[0-9]+px solid"
```

Every hit must either be identity color (per the exception) or be replaced.

## Known Remaining Instances (not swept 2026-08-11)

Fixed at the time the rule was written: `CategoryTile.svelte` (catalog + rail
compositions) and `gallery-workspace-styles/01-foundations.css`. A repo-wide
grep found roughly a dozen more selection-state bars — including
`ConversationItem.svelte`, `OptionPickerHeader.svelte`,
`CollectionCardSurface.svelte`, `ShortcutRow.svelte`, and several `test/`
routes. They were left alone to keep that fix scoped. Convert one whenever you
are already editing its file; do not open a sweeping refactor for it.

## Related

- `visual-verification-mandatory.md` — "product, or output?"
- `chip-primitives.md`, `never-hand-roll.md` — the primitives own selection
- `no-checkboxes.md` — the other banned-by-default web-default pattern

# LOOP Configurator — Bento Redesign

**Date:** 2026-07-10
**Status:** Approved (Austen, full-send)
**Surface:** `src/lib/features/store/LoopDeckConfiguratorPage.svelte` (Build Your Own Deck / `/shop/…` LOOP listing)

## Problem

The v2 configurator works but looks hand-rolled against the rest of TKA. Austen's
complaint (2026-07-10): too visually complicated, repetitive, over-reliant on plain
theme-color buttons and stacked SegmentedControls, and the inline `PropPicker` reads
"blue against blue with the translucent background." The generate panel already solved
"present config as gorgeous data" with the bento card system, and the deck-releaser
(`LoopBentoBoard.svelte`) already ported that exact language to LOOP config. The shop
configurator is the only LOOP surface that never adopted it.

This is a **presentation swap only**. No change to the flat-$30 single SKU
(`loop-deck-custom`), the `loopConfig` checkout metadata, the firebase whitelist, or
the `LoopConfig` domain model. Same dials, same data, restyled onto the bento language.

## Reused primitives (never-hand-roll)

Grep + read confirmed these exist and are the canonical bento primitives:

| Need | Primitive | Path |
|---|---|---|
| Glass config tile (tap → modal) | `BaseCard` | `create/generate/components/cards/BaseCard.svelte` |
| Glass stepper tile (± value) | `StepperCard` | `create/generate/components/cards/StepperCard/StepperCard.svelte` |
| Level tile colors | `DIFFICULTY_LEVELS[n].cssBg` | `shared/config/difficulty-styles.ts` |
| Drill-down modal chrome | `.modal-backdrop` / `.picker-overlay` | pattern lifted from `LoopBentoBoard.svelte` |
| Shop prop choice (limited 5-set) | `PropPicker` (existing) | `store/components/PropPicker.svelte` |
| Preview fan | `DeckFanCover` (unchanged) | `store/components/DeckFanCover.svelte` |
| Crossfade stage | `Crossfade fill` (unchanged) | `shared/components/Crossfade.svelte` |
| Flavor chips | `LoopChips` (unchanged) | `store/components/LoopChips.svelte` |

**Rejected:** `BentoPropGrid` — renders the full prop taxonomy (`PROP_PICKER_SECTIONS`)
plus `isPropUnlocked` gamification lock glyphs. Wrong for the shop, which ships exactly
5 props and has no XP gating. Keep `PropPicker` (already the correct limited set); the
contrast fix comes from hosting it in a solid dark modal, not from swapping the grid.

## Layout

Two-column, unchanged skeleton: persistent preview column (left) + info column (right).
The info column's stacked controls become a **bento board**:

```
info column:
  eyebrow / h1 / meta                     (unchanged)
  ┌ primary board ─────────────────────┐
  │ [ LEVEL  ± ]   [ LENGTH  ± ]        │   two StepperCard tiles
  │ [ FLAVOR  › ]  [ PROP    › ]        │   two BaseCard tiles → modal
  └────────────────────────────────────┘
  ┌ secondary (muted) ─────────────────┐
  │ [ Size ]      [ Bundle ]           │   small BaseCard tiles, mostly coming-soon
  └────────────────────────────────────┘
  ‹ fine-tune the blend › + advanced   (unchanged disclosure)
  price / BuyButton / assurance         (unchanged)
```

Board grid mirrors `LoopBentoBoard`'s `.card-grid` (flex-wrap, `flex: 1 1 230px`,
fixed tile height ~120px) and its `--card-text-*` theme vars so the tiles match the
generate panel's type scale exactly.

## Tile behavior

### Level (StepperCard)
- Domain already exposes `AVAILABLE_LEVELS` (`["1","2","mix"]` today; grows as decks
  seed). Map that array to stepper **indices**: `currentValue` = index, `minValue` 0,
  `maxValue` = `AVAILABLE_LEVELS.length - 1`. `formatValue(i)` → `"1"|"2"|"Mix"`.
- `onIncrement`/`onDecrement` clamp within the available list, then set
  `level = AVAILABLE_LEVELS[idx]`. As Level 3's decks seed and `AVAILABLE_LEVELS`
  gains `"3"`, the stepper range extends automatically — no code change.
- Tile color: numeric level → `DIFFICULTY_LEVELS[n].cssBg` + `.text`. `"mix"` → a
  blended multi-stop gradient (baby-blue→gold) signaling "a bit of everything."
- `description`: level name for numeric (e.g. "No turns"), `LEVEL_MIX_COPY` for mix.

### Length (StepperCard)
- Same index mapping over `AVAILABLE_LENGTHS` (`["8","mix"]` today; 12/16 join as
  seeded). `formatValue` → `"8"|"12"|"16"|"Mix"`. `tabular-nums` inherited from card.
- Neutral tile color (existing `c.length.color` teal from the generate palette, via
  `getCardColors`). `description`: `LENGTH_MIX_COPY` for mix, else blank (reserved).

### Flavor (BaseCard → modal)
- Tile shows the current flavor name (`"Variety Pack"` or the flavor SKU name) on the
  LOOP gold gradient (`LOOP_COLOR` from `LoopBentoBoard`). Tap opens a modal.
- Modal body = the **current** flavor grid markup relocated verbatim: Variety Pack
  card first, then per-flavor tiles with `LoopChips`, roving radiogroup + arrow keys,
  gated flavors dimmed ("not at this level yet"). Selecting closes the modal.
- Keeps the exact a11y semantics that exist today (`role="radiogroup"`,
  `aria-checked`, `onFlavorKeydown`).

### Prop (BaseCard → modal)
- Tile shows the selected prop image + name on the purple glass gradient
  (`PROP_TILE_COLOR`). Tap opens a modal whose body is the existing `PropPicker`.
- Modal surface is the solid dark `.picker-overlay` — the contrast fix for the
  blue-on-blue muddiness (blue prop art now sits on a dark solid panel, not a
  translucent cosmic card).

### Size / Bundle (secondary BaseCard tiles)
- Replace the two full-width bottom SegmentedControls with two small muted
  `BaseCard` tiles. Poker is the only live size, "Deck only" the only live bundle;
  both other options are coming-soon. Non-clickable (`clickable={false}`) muted tiles
  that display the fixed current value — they exist for completeness, not interaction,
  until tarot/bundle ship. This removes the theme-button stacking Austen flagged
  without pretending disabled options are pickable.

## Modal chrome

Lift `LoopBentoBoard`'s modal pattern into the configurator: `.modal-backdrop`
(fixed inset, `rgba(4,7,14,.62)`, `backdrop-filter: blur(5px)`), `.picker-overlay`
(scale-in `transition:scale`, accent-tinted gradient, 2px accent border, 44px
`.po-close`, `.po-body` scroll, `.po-done` footer). Backdrop click + close button +
Escape all dismiss. Two modal instances: `showFlavor`, `showProp`.

## Preview / crossfade

Unchanged. The `Crossfade fill` key stays `${flavor}|${propType}|${excluded.size}`.
The preview box keeps its fixed clamp height so no dial swap resizes it
(no-layout-shift by construction). `prewarmCovers` effect unchanged.

## Advanced disclosure

Unchanged. "Fine-tune the blend" toggle, level-balance SegmentedControl, variety
grab-bag FilterChipBase toggles, and the PostHog instrumentation
(`shop_loop_advanced_opened` / `shop_loop_advanced_customized`) all stay as-is.

## Checkout wiring

Zero change. `loopConfig` `$derived.by`, `customSku` resolution, `BuyButton`
props, error handling — untouched. Verified the redesign touches only the info
column's control markup + styles.

## Out of scope

- The flat-$30 SKU, firebase whitelist, `LoopConfig` model, metadata flattening.
- The `/shop` landing, starter pack, TnD trilogy pages.
- Adding new levels/lengths/flavors (availability is data-driven; tiles follow it).

## Testing

- `npm run check` green (0 errors/0 warnings on the touched files).
- Visual: render at `/shop/…` LOOP route on desktop + a narrow viewport; confirm
  the four tiles read as the generate-panel bento, Level tile recolors per level,
  Flavor/Prop tiles open their modals, selection closes + updates the preview with
  no layout shift, and the board collapses to one column under 860px.
- Grep the diff: no raw `class="chip"` filter buttons, no `type="checkbox"`, no
  host-side theme-var declarations regressed.
- Austen confirms on his sim (automation viewport is pinned, can't screenshot the
  narrow branch).

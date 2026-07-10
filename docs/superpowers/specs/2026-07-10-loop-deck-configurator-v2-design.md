# LOOP Deck Configurator v2 — Design

Date: 2026-07-10
Status: awaiting Austen review

## What

Restructure the LOOP deck listing around the buyer's real decision order:
difficulty → depth → taste. Three dials, each with a curated "Mix" option,
flat $30, one SKU. Optional advanced panel for power customizers,
instrumented so we learn whether anyone actually opens it.

## Pricing + SKU model (the unlock)

- **Flat $30 for every combination.** Level and length never move the price.
- **ONE product doc + ONE Stripe price.** The full configuration rides
  checkout metadata → order doc, extending the shipped propType pattern:
  `{ propType, loopConfig: { level, length, flavor } }`.
- The 7 existing per-flavor loop-deck SKUs retire from the storefront (status
  draft, kept for history). The single "LOOP Deck" listing replaces them.
- Decks are composed at fulfillment (beta run is hand-printed) from the
  config via the deck-releaser recipes. No per-combo SKUs, bakes, or prices.

## The dials (LoopDeckConfiguratorPage)

Top-to-bottom order: Level, Length, Flavor. Prop stays below, then price/buy.

1. **Level** — chips `1` `2` `3` `Mix` (badge styling echoes the guide's
   level badge). Default `1`.
2. **Length** — chips `8` `12` `16` `Mix` (counts; TnD owns 4s). Default `8`.
3. **Flavor** — `Variety` tile first + the 7 flavor tiles. Default `Variety`.

Rules:

- **Mix is a fourth chip, not a separate product.** Uniform mental model:
  pick one, or let us blend it. Blend recipes are OURS, never user sliders:
  - Level Mix: mostly Level 1, 2s and 3s trickled in.
  - Length Mix: weighted toward 8s.
  - Flavor Variety: ~75% rotated quartered + grab bag of other flavors.
- Selecting a Mix chip shows ONE muted line describing the feel (e.g.
  "Mostly Level 1. A few cards that bite."). Never percentages.
- **Defaults make the page buyable untouched:** Level 1 · 8-count · Variety ·
  Staff · $30. Newcomer clicks Buy, gets the right deck.
- **Honest gating on the chips themselves:** combos without enumerated
  inventory render dimmed with "coming soon" (Level 3, 12/16 today — exact
  set derived from live decks). Same pattern as the tarot size gate.
- SegmentedControl for Level and Length (single-select, exactly one active);
  flavor stays a tile grid. PropPicker unchanged.

## Advanced panel (power customizers)

- Collapsed by default under the dials: a quiet disclosure button
  ("Fine-tune the blend"), NOT a bare text link (clickables look like
  buttons).
- v1 contents, deliberately thin:
  - Level balance for Mix: `Mostly 1` / `Even split` / `Mostly spicy`.
  - Flavor multi-select for Variety: FilterChipBase toggles to include or
    exclude specific flavors from the grab bag.
- Chosen values fold into the same `loopConfig` metadata
  (`loopConfig.custom: {...}` only when the panel was touched).
- **Instrumented via the PostHog activity logger** (`getActivityLogger()`):
  `shop_loop_advanced_opened`, `shop_loop_advanced_customized` (with which
  knob), and `loopConfig.custom` present on purchase. If nobody opens it in a
  month, we delete it — the events are the exit criteria.

## Preview

- Fan renders from enumerated decks for exact combos (baked covers where they
  exist); Mix/Variety shows a mixed hand sampled across the blend's sources.
- Crossfade in fill mode inside the fixed stage (crossfade-primitive rule);
  config changes swap the fan with zero layout shift.

## Bonus cards

Every deck ships +5 extra cards. Fulfillment-side only. One line in the
what's-in-the-box list: "59 cards in a 54-card box — we count generously."

## Checkout + functions

- `createMerchCheckout` accepts optional `loopConfig`; whitelist-validates
  level/length/flavor against mirrored constant arrays (same pattern as
  SHOP_PROP_TYPES). Flat metadata keys (Stripe metadata is string-only):
  `loopLevel`, `loopLength`, `loopFlavor`, `loopCustom` (JSON string, only
  when present).
- `handleMerchWebhook` copies them onto the order item.

## Out of scope

- Enumerating L3 / 12-beat / 16-beat decks (separate deck-skill work; chips
  stay gated until inventory exists).
- Composing the physical variety decks (deck-releaser recipes at
  fulfillment).
- Starter pack page (already ships; unaffected).

## Retirement checklist

- 7 flavor SKUs → status draft; new single listing seeded with $30 price.
- /shop landing LOOP tile copy updates (one deck line, "build yours").
- Old flavor-first configurator layout replaced by the dial stack.

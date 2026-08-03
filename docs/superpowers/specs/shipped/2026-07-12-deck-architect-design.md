# The Deck Architect — power-user LOOP recipe builder

**Date:** 2026-07-12
**Status:** Approved (conversational), built same session
**Route:** `/shop/loop-deck/architect`

## Why

The listing page optimizes for zero decision anxiety: three packs, a prop,
done. The hyper-specific buyer (half 8-counts half 16s, mixed levels, 90%
rotated with a 10% twist) has nowhere to go — the dials are single-pool and
the fine-tune panel was retired. Instead of an email escape hatch, give them
a separate page with the whole machine. The listing stays simple; only the
people who want the complexity ever see it.

## Scope decisions

- **One prop per deck (v1).** Per-slice props touch checkout, fulfillment,
  and cover baking — deferred until demand shows.
- **Both preview layers**: a hero fan sampling across slices, plus one live
  sample card per slice row.
- **Tone**: congratulate the boldness. Not mocking.

## The model

A recipe = up to **8 slices** of `{ count, flavor, level, steps, maxTurns? }`
summing to exactly **54**. Flat $30, same Stripe price as everything else.

- `steps` ∈ {4, 8, 12, 16} (safe quartered/halved generation lengths)
- `level` ∈ {1, 2, 3}; `maxTurns` absent at level 1, whole turns 1–3 at
  level 2, half steps 0.5–3 at level 3
- flavor = any implemented LOOP combo (no "variety" — a slice IS specific)

`LoopConfig` gains `recipe?: RecipeSlice[]` — third arm of the XOR
(pack | dials | recipe). Client validator mirrors the function's.

## Checkout

Stripe metadata values cap at 500 chars, so the recipe rides as a compact
string, one slice per segment: `count:flavor:level:steps[:turns]` joined by
`;` (e.g. `27:rotated:1:8;13:mirrored-swapped:2:16:1` ). 8 slices × worst-case
flavor slug stays under the cap. Function validates the structured array
(slice count, sum 54, whitelists, turn rules), `checkoutParams` encodes
`loopRecipe`, the webhook copies it onto the order item. Fulfillment parses
the string back into slices and live-generates, same as packs.

## The page

`/shop/loop-deck/architect`, `DeckArchitectPage.svelte`. Same shell language
as the listing (hero stage, purchase-card rail, prop chips).

- **Hero fan**: `recipePreviewCards()` samples 6 slots across slices
  (proportional to count, offset-staggered), settled-commit pattern; re-deal
  only on slice add/remove.
- **Slice rows**: count input + ± steppers, flavor button → the shared LOOP
  overlay modal, level/steps/turns as SegmentedControls, one live sample card
  (`recipeSliceCard`), remove button. Seeded with 54× rotated L1 8-count so
  the total is valid from the first frame.
- **Total meter**: "54 / 54" with over/under states; the buy CTA renders only
  at exactly 54 (a real disabled-styled state otherwise, with the delta named).
- **Prop**: shared `ShopPropPicker` (extracted from the listing page), deck-wide.
- **Copy**: eyebrow THE DECK ARCHITECT; "You want every card on your terms.
  Good. Here's the whole machine."

## Listing change

The Custom-mode "Email your recipe" mailto pill becomes "Open the Deck
Architect" linking to the page. Mailto retires.

## Instrumentation

`shop_loop_architect_opened` on mount; `shop_loop_architect_checkout` when the
buy CTA fires with a valid recipe.

## Deploy gate

Same firebase functions deploy that packs are waiting on — recipe validation,
metadata, webhook all ride it. No recipe (or pack) order can check out before
it ships. Austen's call.

## Known limits

- Preview sample cards are live-generated: a 5-slice recipe fires ~11 engine
  calls on first render (cached per dial key after).
- No per-slice prop, no odd lengths, no seeded/deterministic decks in v1.

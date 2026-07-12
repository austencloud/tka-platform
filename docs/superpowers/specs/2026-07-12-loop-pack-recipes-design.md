# LOOP Deck Packs: Mild / Medium / Spicy — Design

**Date:** 2026-07-12
**Status:** Approved (conversational), built same session
**Route:** `/shop/loop-deck`

## Why

Rotated loops — especially quartered rotated — are the only flavor that
produces reliably great mandalas (halved rotated is symmetric but less
quadrant-equal; the combo flavors get weird). The old presets were dial
positions: Beginner's Loop sold the all-flavor "Variety Pack" to total
beginners, exactly the buyers who should get pure rotated mandalas. And the
dials could only express single-pool configs, so no preset could say "mostly
8-counts with a few 12s and 16s."

## The model

A **pack** is a recipe: slices of `(flavor, level, per-length counts,
maxTurns)` totaling 54 cards. Recipes live in
`src/lib/features/store/domain/loop-config.ts` (`LOOP_PACKS`); the firebase
function whitelists only the ids; fulfillment resolves the id against the
constants.

| Pack | Composition |
|---|---|
| **Mild** — Level 1 · pure mandalas | rotated quartered L1: 38× 8, 8× 12, 8× 16 |
| **Medium** — Levels 1–2 · gentle turns | L1 rotated 14× 8 / 10× 12 / 6× 16 + L2 rotated (≤1 turn) 8× 8 / 6× 12 / 4× 16 + 6× mirrored-swapped L1 8 |
| **Spicy** — Levels 2–3 · the weird stuff | L2 rotated (≤2) 10× 8 / 8× 12 / 6× 16 + L3 rotated (≤2, halves) 6× 8 / 4× 12 + mirrored-swapped L2 ×7 + mirrored-inverted L1 ×7 + swapped-inverted L2 ×6 |

All 54 cards, flat $30, one Stripe price.

## UI

- Pack chips replace the presets, heat ramp cool-blue → amber → red.
- Pack selection is **explicit state** (`pack`), not derived from dial
  equality — recipes aren't dial-expressible.
- Composition line under the chips shows the recipe honestly; in Custom mode
  it says the dials drive the order (always rendered — no layout shift).
- Bento board = Custom mode. Pack active → board dims to 0.55 (hover 0.85),
  stays fully interactive; the first dial touch calls `enterCustom()` which
  deselects the pack and brightens the board. Prop is orthogonal — picking a
  prop does NOT leave the pack (print prop applies to packs too).
- Custom default flavor is **rotated** (mandala honesty). The all-flavor
  option renames Variety Pack → **Grab Bag** with honest copy.
- Preview fan deals the pack's `previewHand` (6 representative cards) through
  the live-generation preview service; slot index rides the cache key so
  repeated dials (Mild's four 8-counts) don't deal twins.

## Checkout

`LoopConfig` gains `pack?: LoopPackId`; dial fields become optional.
**Pack XOR dials**: a pack order is `{ pack: "mild" }` and nothing else — the
function rejects mixed payloads. Metadata writes `loopPack`; the webhook
copies it onto the order item. Custom orders unchanged.

**Deploy gate:** firebase functions deploy required before pack orders can
check out (validator + metadata + webhook changes staged). Austen's call.

## Known limits

- Spicy previews L3 cards via live generation; no L3 catalogs exist (fine —
  fulfillment is live generation too).
- Level "mix" and length "mix" remain in the domain for the advanced panel
  but no preset reaches them anymore; the levelBalance control only matters
  if a buyer lands on level mix via legacy paths. Candidate for removal if
  fine-tune usage instrumentation stays flat.

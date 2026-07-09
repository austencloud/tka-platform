# Shop Conversion Rebuild — Design Spec

**Date:** 2026-07-09
**Status:** Approved verbally ("go. fix this head to toe") 2026-07-09
**Parent:** `2026-07-08-shop-release-strategy-design.md` (§7 said shop UI is its own spec; this is that spec)

---

## 1. Problem

The shop grid renders 14 flat deck SKUs, 7 of them legacy products with blank covers,
$30 prices, and pre-curation card counts that contradict the locked lineup. The
detail page hero is a blank box (coverSequence never passed). Buy Now is clickable
with no Stripe price behind it and errors after the click. Copy is spec-speak. No
page answers "what is a choreo card." The parent spec already locked presentation
approach A: one configurable deck product, not N flat SKUs. The storefront
contradicts it.

Public /shop is gated to ComingSoon + waitlist, so this rebuild happens before any
live buyer sees the shop.

## 2. Buyer journey → page shape

Journey: what is this → that's beautiful → which one is mine → buy.

`/shop` (StorePage) becomes, top to bottom:

1. **Hero** — fanned real ChoreoCards (light/printed look on the cosmic background),
   one-sentence value prop, CTA that scrolls to the deck builder.
2. **THE DECK** — one configurable listing (see §4).
3. **How it works** — 3 steps: draw a card, read it, scan it to watch it animated
   in the app. The QR-to-app step is a differentiator no card seller has; say it.
4. **What's in the box** — 54 sequence cards + 1 explainer card + free laminated
   19-sequence sheet + foldable deck box.
5. **Beta-run story** — printed, cut, and packed by hand in Chicago by the system's
   inventor. First run. Handmade is the feature.
6. Remaining sections (Sampler / Guides / Props) unchanged below, still
   type-grouped. All currently draft.

## 3. Cover treatment (winner: fanned hand)

Real `ChoreoCard` components (cardMode, printed 5:7, light) fanned with fixed
tilts, hover spread, front card emphasized. Verified on `/test/shop-covers`
2026-07-09 (layout fix: no clip + `object-fit: contain`; AAA chip fix: near-white
label on color-mixed dark chip, identity in icon + border).

Per-deck cover sequences: the 6 auto-picked "sufficiently different" candidates
(scoring: dynamic-motion weights + variety + reversals; greedy max-min diversity),
Austen can swap picks on the test page later; covers re-embed via script.

New shared components (store feature):

- `DeckFanCover.svelte` — renders N (3–6, container-width responsive) ChoreoCards
  fanned. Used by grid tile, detail hero, and the /shop hero.
- `LoopChips.svelte` — color-coded LOOP component chips (data from
  `LOOP_COMPONENT_MAP`), AAA treatment from the test page.

## 4. One-listing configurator (kills the 7-tile wall)

- The 7 curated c54 SKUs stay in Firestore as **backing SKUs** and gain
  `listing: "loop-deck"`. StorePage collapses any products sharing a `listing`
  into ONE hero tile ("LOOP Deck · 7 flavors · $25") linking to
  `/shop/loop-deck`.
- `/shop/loop-deck` — configurator page:
  - **Flavor picker:** 7 visual options (mini fan + LoopChips + name). Rich
    per-option colors/artwork, so hand-built option cards (SegmentedControl can't
    express them; chip-primitives carve-out), selection semantics = exactly one
    active.
  - **Size:** poker (active) / tarot (visible, "coming soon", disabled).
  - **Bundle:** deck only $25 / deck + printed guide $40 (flat +$15, D1). Until
    guide + bundle checkout exist, the bundle option shows as coming soon.
  - **Buy:** resolves the selected flavor to its backing SKU productId → existing
    checkout. Gated (§5) while `stripePriceId` is empty.
- Old per-SKU URLs `/shop/{deckId}` keep working (direct links, admin).

## 5. Checkout gate

`BuyButton` gains an availability gate: when the product has no `stripePriceId`,
render "Not on sale yet" + the waitlist email form (reuses `joinWaitlist`, source
`shop-product-waitlist`) instead of a Buy button that errors after click.

## 6. Data changes (products/ docs, via admin script)

- 7 legacy deck products (`B8dDCYkEPunFCFVKiaBr`, `level-2-rotated-loop`,
  `tnd-motions-2to1`, `tnd-motions`, `4-beat-rotated-loop`, `halved-rotated-loop`,
  `rotated-loop-twin`) → `status: "draft"`. They keep their Stripe prices; they can
  return when they have covers and spec-compliant pricing.
- 7 beta c54 SKUs gain: `coverSequences` (6 full sequence docs), `loopComponents`
  (string list for chips), `listing: "loop-deck"`, rewritten benefit-first
  `description`.
- `book` stays draft at $39: **open pricing question** (locked guide ladder is
  $15 beta / $20 finished; the Book may be a bigger product than the guide).
  Flagged, not changed here.

## 7. Copy (MCP-grounded 2026-07-09)

Base: a LOOP is a circular sequence that returns to its start through a
transformation; the word repeats, transformed, until it arrives back home. Flavor
lines (per `get_term_definition`):

- **Rotated:** positions rotate around the grid, four quarters of 90° completing a
  full 360.
- **Mirrored:** the second half mirrors the first across the vertical axis,
  left and right trading places.
- **Inverted:** prospin becomes antispin in the second half; same hand paths,
  different visual.
- **Swapped:** your hands trade jobs halfway; what blue did, red does.
- Composites combine those operations.

Tone: fire jam test. No superlatives, no "unlock", no em dashes.

**Uniqueness copy ("no two decks alike") is GATED** behind enumerator
randomization (Phase D). Not claimed anywhere until true.

## 8. Phases

- **A. Hygiene (this pass):** draft legacy 7, checkout gate, copy rewrite,
  detail hero fix (subsumed by fan hero).
- **B. Covers (this pass):** DeckFanCover + LoopChips into grid, detail, hero.
- **C. Configurator (this pass):** listing collapse + /shop/loop-deck.
- **D. Uniqueness (next):** randomized curation per printed run, per-order deck
  minting via deck-recipe engine, then the no-two-alike copy.
- **E. Trust (next):** shipping/returns lines, photography of real pilot decks,
  og-image. Stripe prices are Austen's (secrets stay out of agent hands);
  multi-line-item bundle checkout needs a `createMerchCheckout` function update at
  that time.

## 9. Reuse evidence (never-hand-roll)

- Card render: `ChoreoCard` (features/choreo-card) — the real printed front.
- Chips colors/icons: `LOOP_COMPONENT_MAP` (`loop-constants.ts`).
- Fan pattern: `/test/shop-covers` (derived from gallery `SequencePeek` fans).
- Waitlist: `services/waitlist.ts` + `ShopComingSoon` form pattern.
- Morph/view transitions: existing `shop-morph.ts` (kept; fan replaces mandala as
  the morph content).
- Card backs exist as components (`card-back/CardBack.svelte`) — optional later
  addition to the fan (one back among fronts); not required this pass.

## 10. Verification

- Full `npm run check` green before commit.
- DevTools screenshots: /shop hero + configurator + detail on 5173.
- Grep diff: no `type="checkbox"`, no raw chip `<button class="chip">`, chips AAA.
- No-layout-shift self-check on configurator price/flavor swaps (reserve widths,
  tabular-nums).

# Starter Pack Listing — Design

Date: 2026-07-10
Status: approved (Austen, in-session)

## What

Fourth shop listing: The Starter Pack. One box with everything a newcomer needs:

- Timing & Direction trilogy (all 3 volumes)
- Curated 54-card mixed LOOP deck (samples across flavors; exclusive to the pack)
- The Kinetic Alphabet book
- Deck boxes for every deck
- Waterproof sleeved clear card holder with lanyard (black only for the beta run)

Price: $65. Buyer picks ONE print prop (staff/club/fan/triad/buugeng) for all decks in the pack, via the existing PropPicker.

## Decisions (from brainstorm)

- Sample deck = NEW curated mixed deck, pack-exclusive. Which 54 sequences go in it is an admin/deck-release task at fulfillment time, NOT part of this listing work. The listing only needs a cover fan.
- Lanyard: black only for beta. Color picker deferred; it slots in beside PropPicker later.
- Landing placement: Approach A — featured "Start here" band directly under the hero, before the two deck lines. Flagship hierarchy: newcomer → starter pack; enthusiast → individual decks.

## Data

One Firestore `products` doc:

- `type: "sampler-pack"` (enum value already exists, unused until now)
- `listing: "starter-pack"`
- `price: 6500`, `status: "draft"` until Austen flips it
- `boxContents: string[]` — NEW optional Product field; rendered as a check-list on the page
- NO coverCards of its own. The fan composes client-side from the other products' already-baked coverCards (one card per LOOP flavor + trilogy elements), exactly like the StorePage hero fan. Zero new bake work.
- `stripePriceId` empty → existing waitlist gate shows until Austen creates the Stripe price.

## Route

`/shop/starter-pack` → `StarterPackPage.svelte`, same skeleton as the configurators:

- Left: full-height fan stage (the 4K stretch rules from 2026-07-10 layout pass), mixed-hand fan
- Right: name, what's-in-the-box check-list (from `boxContents`), PropPicker (one prop, whole pack), price, BuyButton
- No size/bundle dials — single SKU
- `propType` flows through the existing checkout metadata path (createMerchCheckout → Stripe metadata → order doc) unchanged

## Shop landing

New featured band between hero and `.deck-listing`: wide tile linking to /shop/starter-pack. Fan + "The Starter Pack" copy + contents summary + $65 + CTA. Caps ~1700px centered on ultrawide; internal 2-col like deck tiles; stacks via container query when narrow. Deck pair, book band, bottom zone unchanged.

## Out of scope / deferred

- Curating the physical 54-card mixed deck (deck-release pipeline, at fulfillment)
- Lanyard color picker
- Stripe price creation (Austen)
- Multi-line-item checkout

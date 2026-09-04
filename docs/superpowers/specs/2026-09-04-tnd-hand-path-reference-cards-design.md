# TnD Hand-Path Reference Cards

**Date:** 2026-09-04
**Status:** Product decision approved; physical release integration pending

## Outcome

Every physical Timing & Direction deck includes the same six hand-path
reference cards, one for each relationship:

- Together-Same (`Tog-Same`)
- Split-Same (`Split-Same`)
- Quarter-Same (`Quarter-Same`)
- Together-Opposite (`Tog-Opp`)
- Split-Opposite (`Split-Opp`)
- Quarter-Opposite (`Quarter-Opp`)

These are part of the Choreo Card game system, not disposable packaging and not
lesson-only illustrations.

## TKA One Count

TKA 1: Learning Letters contains 19 sequence cards. Adding the six universal
hand-path cards makes it a **25-card content deck**:

```
19 sequence cards + 6 hand-path reference cards = 25 cards
```

The existing How to Read card remains a separate insert. Under the current
print contract, a TKA One manufacturing export therefore contains 26 physical
cards: 25 content cards plus 1 insert. Store and box copy should call TKA One a
25-card deck; print-vendor summaries must continue to state the additional
insert explicitly.

## Card Contract

Each reference card uses the production Choreo Card rendering pipeline with:

- poker-card geometry (2.5 × 3.5 inches, 5:7 aspect ratio);
- the canonical Start row above the four continuous-motion beats in their 2×2
  grid;
- `handPathMode`, so the card shows HAND props and motion paths without TKA
  letters;
- a plain-language relationship title rather than a word;
- no difficulty badge;
- the relationship definition in the notes region;
- the established full-card family frame treatment;
- no QR code or LOOP glyph.

The Hand Motions lesson is the first reviewed digital consumer of this contract.
It must render the same canonical card anatomy rather than a lesson-local
facsimile.

## Product and Release Semantics

- The six cards are universal: include one complete set in every TnD volume,
  regardless of how many sequence cards that volume contains.
- They are reference/game cards, not `DeckReleaseCard` sequence records. They
  do not receive sequence IDs, short codes, or physical scan issues.
- Released-deck manifests need a versioned hand-path-card flag, parallel in
  spirit to `insertCard`, so historical releases remain reproducible.
- Content-card count is sequence cards plus six reference cards. Printed-card
  count additionally includes the How to Read insert.
- ZIP, MPC PDF, and home-print PDF exports must all include the same six card
  fronts and standard Choreo Card backs. Multiple-copy exports include a full
  six-card set per copy.

## Ownership and Reuse

The digital source of truth is the existing canonical stack:

1. Timing & Direction relationship sequences and element identity come from
   `pictograph-foundation-content.ts`.
2. Card presentation comes from `ChoreoCard.svelte` with `handPathMode` and the
   canonical `CardGridLayout.svelte` Start cell.
3. Physical geometry comes from `CARD_SIZES.poker`.
4. Print integration belongs to the existing deck-release manifest and export
   services; it must not create a second hand-path renderer.

The shipped 2026-03-19 “Deck Hand Path Cards” design remains valid for catalog
family previews, but it describes representative sequence hand paths rather
than this universal six-card physical set.

## Implementation Boundary

This decision records the approved product and count contract. The lesson's
Start-position change can ship independently. Physical release integration,
export parity, store-count updates, and print-resolution proof require a
separate implementation pass through the deck releaser before any 25-card TKA
One product claim is published.

## Required Physical Verification

Before marking the physical integration shipped:

1. Export TKA One in ZIP, MPC PDF, and home-print formats.
2. Confirm all six fronts include Start plus four beats and match the reviewed
   digital cards.
3. Confirm 25 content cards and 26 physical cards including the insert.
4. Confirm each hand-path card uses a normal Choreo Card back and receives no
   short code or scan issue.
5. Export two releases back to back and multiple copies to catch stale-cache or
   missing-per-copy reference sets.

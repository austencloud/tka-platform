---
status: active
value: 4
effort: S
remaining: 'ACTIVE. Phases 1-4 shipped (a422744d68..c0df410868: shell, catalog front door, PDP re-seat, choreography-cards retirement). Phase 5 (7-viewport visual sweep) and Phase 6 (Codex review) not confirmed.'
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-08-02
---
# Shop Unification — Catalog Front Door + Shared Product Shell

- **Date:** 2026-08-02
- **Status:** Approved (Approach A chosen by Austen in-session; full autonomy granted, iterate-on-result mode)
- **Supersedes as nav/IA authority:** the piecemeal link structure from `2026-06-23-shop-spin-up-design.md` and `2026-07-09-shop-conversion-rebuild-design.md` (their PDP work is retained and re-seated)
- **Owner loop:** Fable orchestrates + reviews; Opus 5 executors implement; Codex second view before ship

## Why

The shop grew piecemeal: six sibling destinations behind a nav dropdown, the front door
(`/shop`) permanently gated to Coming Soon for non-admins, nav leading with a mid-funnel
explainer, product pages that dead-end into the locked door (including the post-purchase
success page), and no lateral cross-sell anywhere. The bones are good — rich PDPs, deployed
Stripe checkout + cart, a 5-step PostHog funnel — but there is no spine. Austen's goal:
**establish the brand line.** Make the shop feel singular, well thought through, legible:
"I know what this is, what I'm buying, and where to click."

## Decisions (locked in-session)

1. **Primary goal:** establish the brand line (coherence/legitimacy), not short-term conversion.
2. **Product family model:** a growing catalog — distinct products sharing a brand; future
   axes: more decks, apparel/merch, digital products, books/learning material.
3. **Explainer content lives inside product pages** (rich PDPs). No standalone explainer
   destinations in shop nav.
4. **Approach A:** catalog front door + shared product shell; cohesion by construction
   (same playbook as `SequenceViewerShell`).
5. **Gate opens.** Browse layer goes public now. Real charging remains blocked on Austen's
   two Stripe items (payout requirement, tax registration) → per-product purchase state
   keeps CTAs honest until then.
6. **Device-fit strategy:** reuse the approach proven by `/test/smart-collections`
   (Austen: "a wonderful example of making a flow and a layout fit on EVERY device").
   Recon digest: `scratchpad/digest-smart-collections-strategy.md` (session scratchpad).

## Information Architecture

### Routes

| Route | Fate |
|---|---|
| `/shop` | **Ungated catalog front door** (new page, replaces `ShopComingSoon` for everyone) |
| `/shop/loop-deck` | Stays; re-seated in `ShopProductShell` |
| `/shop/loop-deck/architect` | Stays; re-seated; linked as LOOP Deck's power-user variant |
| `/shop/tnd-trilogy` | Stays; re-seated |
| `/shop/starter-pack` | Stays; re-seated |
| `/shop/[productId]` | Stays (book/one-off SKUs); re-seated |
| `/shop/choreography-cards` | **Retired: 301 → `/shop`.** Card-anatomy + live-QR content absorbed into shell "how it works" sections; brand story compressed into `/shop` hero |
| `/shop/success` | Stays; gains cross-sell rail (no more dead end into the old gate) |

### Nav (header dropdown + footer column + launchpad tile, kept lockstep)

- "Shop" itself → `/shop` (the catalog).
- Dropdown/footer items: LOOP Deck, T&D Trilogy, Starter Pack. "How Choreo Cards Work"
  leaves the nav. Launchpad tile points to `/shop`.
- All inbound pointers to `/shop/choreography-cards` (landing `ShopCtaSection`, launchpad
  tile, footer) update to `/shop`.

## The `/shop` Front Door

Top to bottom:

1. **Brand-line hero** — what Choreo Cards are in one held moment: a real card, the live
   scannable QR (portable component from the explainer page), one sentence of story.
2. **The catalog** — shelves showing only what exists: **Decks** (LOOP Deck; Deck Architect
   surfaced as its power-user variant), **Books** (T&D Trilogy, printed guide),
   **Bundles** (Starter Pack). Grid grammar absorbs future shelves (Merch, Digital) without
   recomposition. No empty shelves, no coming-soon tiles.
3. **Onward band** — one path into the free product (Composer/guide) for people who won't
   buy today.

Visual direction — **CHOSEN 2026-08-02: the hybrid (C's hero on B's body).** Austen picked it
from three mockups (`static/sketches/2026-08-02-shop-front-door-{a,b,c}.html`, compare page
`...-shop-direction-compare.html`): direction C's teaching hero ("Every card is a sequence.
Scan it and it moves." + the live QR card) compressed to ~60% of the viewport, then direction
B's shelf grid — chip row (All · Decks · Books · Bundles) + uniform tiles with cover art, name,
one-liner, price, status chip. Sketch copy caveats to resolve against reality before ship:
"printed and packed in Chicago" claim, and the guide book's price (sketch showed $30 with no
seed-data backing).

## ShopProductShell

`src/lib/features/store/components/shell/ShopProductShell.svelte` (final path may follow
module conventions — executor confirms against `new-module`/store layout).

Owns the grammar every product page shares:

- Catalog context strip (back to `/shop`, product family breadcrumb)
- Hero band: media + title + price block + CTA cluster (one visual system for all PDPs)
- "How it works" section slot (card anatomy, QR demo — fed per-product)
- Specs/details slot
- **Cross-sell rail** ("More from the line") — data-driven from the product catalog; also
  rendered on `/shop/success`
- Purchase-state-aware CTA: `active` → Buy (existing `BuyButton`/cart spine), `preorder` →
  Pre-order, `notify` → per-product notify-me (reuses waitlist capture, tagged by product)

Host pages stay thin: data + per-product sections through the shell's slots/props.
Deltas go through props, never forked chrome (anti-drift, per `sequence-viewer-shell.md`
precedent). Existing shop-funnel analytics events keep firing unchanged.

## Purchase-State Honesty

Product data gains/uses an explicit status: `active` / `preorder` / `notify`.
Until Austen completes Stripe payout + tax registration, nothing renders a charge-now Buy
that would fail: flip-to-live is a data change, not a redesign. The shop-wide waitlist
band survives on `/shop` (bottom, subdued) since it's the only capture reaching casual
visitors today.

## Quality Bar

- Every route passes the full 7-viewport sweep (375×667, 960×412, 820×1180, 1440×900,
  1920×1080, 2560×1440, 3840×2160) per `visual-verification-mandatory.md`; 4K rules per
  `4k-native-layout.md` (1680 seam, `--shell-w`, rem-based ramp).
- No layout shift (`no-layout-shift.md`), primitives reused (`never-hand-roll.md`,
  `chip-primitives.md`, `crossfade-primitive.md`), copy per `ai-writing-guide` voice.
- Codex second-view review + full `npm run check` before ship.

## Execution Ledger

- [x] Recon: shop surface map (session)
- [x] Recon digests: smart-collections strategy; store module inventory
- [x] Direction mockups (3) → Austen picked the hybrid (C hero + B grid)
- [x] Phase 1: `ShopProductShell` + purchase-state resolver — `a422744d68`
- [x] Phase 2: `/shop` catalog front door (ungated) + waitlist band — `0beba28088`
- [x] Phase 3: re-seat 5 surfaces + success rail — `8ac5104819..801094ba52` (7 commits)
- [x] Phase 4: explainer absorption + 308 redirect + nav rewire — `c0df410868`
- [x] Phase 5: review harness (`b75732fbae`) + Fable 7-viewport loop → fix batch `395c25d85b`
- [x] Phase 6: Codex second view (15 findings → 8 fixed `4b1bd29c89`, 7 deferred below);
      full `npm run check` green (0 errors / 0 warnings); scoped commits throughout
- [x] Spec updated with chosen direction + shipped state

## Shipped state (2026-08-02, local commits — NOT pushed)

All work is committed locally. **Pushing main deploys production (CF Pages)** and would take
the ungated shop live; Austen sequences that. Blocking the push, deliberately:

1. `SiteHeader.svelte`, `SiteFooter.svelte`, `launchpad-tiles.ts` (+ `sitemap.xml/+server.ts`,
   `test/landing-directions/*`) hold BOTH our shop nav rewiring AND another session's
   uncommitted "Notation→History" relabel — left uncommitted per
   `commit-only-your-own-changes.md`. The committed `landing-route-morph.test.ts` expects the
   new launchpad tile href, so those files and that test must land in the same push.
2. `SALES_LIVE` remains `false` (`src/lib/features/store/domain/purchase-state.ts`) until
   Stripe payout + tax registration are done; every CTA renders notify-mode. Flip is a
   one-line change.

## Deferred follow-ups (from the Codex review round + build)

- `Date.now()` captured once in catalog-listings / LoopDeckConfiguratorPage / TnDTrilogyPage:
  preorder pricing won't cross the Sept 30 cutoff while a tab stays open. Low urgency.
- `cover-front-renderer.ts`: bootstrap failure permanently resolves (no retry); cached blob
  URLs never revoked (session-length leak). Pre-existing service behavior.
- `StorePage.svelte` orphaned (only a route-morph test reads it); deleting it strands
  `BakeCoversButton.svelte`, which needs an admin route home first.
- `PropPicker`/`ShopPropPicker` fork (pre-existing).
- Mobile: floating cart button overlaps the "Custom" difficulty chip on /shop/loop-deck at
  375 (pre-existing, outside shop files).

## Decisions Austen owns

- Three "Chicago" claims render on shop surfaces: Deck Architect product description
  ("Hand-cut and packed in Chicago" — Firestore data), and the assurance lines on
  LOOP/T&D/Architect PDPs ("printed and cut by hand in Chicago, small batches" — page copy
  predating this work). Confirm true, or say the word and they come out.
- Duplicate Firestore doc `products/prod_UsGN7MufXHI8VI` ("LOOP Deck", no `listing`):
  code now dedupes it, but the prod data doc should be fixed or deleted (not touched).
- T&D Trilogy shelves under **Decks** (its SKUs are `type: physical-deck`), so chips read
  All 5 · Decks 3 · Books 1 · Bundles 1. If the trilogy belongs under "Books" as the
  teaching line, that's a product-data change, not a layout change.

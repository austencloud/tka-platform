# Preorder Pricing Swap — Handoff

**Date:** 2026-07-15
**Status:** Shipped + verified live on production. LOOP Deck $35→$45 and Deck
Architect $45→$55 with an automated preorder→regular price swap at the Sept 30
cutoff. Free US shipping baked into every deck price. One open pricing decision
remains (other catalog products), noted in §7 — that one is the owner's call, not
a code task.
**For:** the next agent picking up shop/pricing work. Re-verify the reasoning
against the live code; don't trust this doc over grep. The one thing you must
internalize before touching prices is §3 (the two-doc trap) — it cost real
debugging time.

---

## 1. What we set out to do

Raise deck prices off the flat $30 and make the increase honest and automatic:

- **Preorder price now, higher regular price after a cutoff**, swapped
  automatically (no manual flip, no cron).
- **Free US shipping** folded into the higher price (no separate shipping line
  for US buyers).
- Make the "price goes up soon" message **clearly visible** on the buy surface.

**Locked values:**

| Product | Preorder | Regular (after cutoff) |
|---|---|---|
| LOOP Deck (packs / dials) | **$35** | **$45** |
| Deck Architect (bespoke) | **$45** | **$55** |

**Cutoff:** `2026-09-30T23:59:59-05:00` (Sept 30, Chicago). Decks ship Oct 1.
Swap is fully automated and evaluated server-side per checkout.

---

## 2. Architecture — how the swap works

Three layers, each with its own price gate. All three read the same product doc.

**a. Server checkout (authoritative).**
`firebase-functions/src/merch/resolveActivePrice.ts` →
`resolveActivePriceId(product, nowMs)`: returns `regularStripePriceId` when
`nowMs >= Date.parse(preorderPriceCutoff)` **and** a regular price exists; else
`stripePriceId` (preorder). Fail-safe: any missing/bad cutoff or missing regular
price falls back to the **preorder** price (never overcharges).
`createMerchCheckout.ts` calls this with `Date.now()` and builds the Stripe
Checkout line item from the resolved price. **This is the charged price.** Stripe
Checkout also shows the real price before payment, so a wrong client clock can at
most mislabel the storefront — it can never mischarge.

**b. Stripe webhook sync.**
`handleMerchWebhook.ts` mirrors Stripe `product.*`/`price.*` events into the
Firestore `products` collection. The `price.*` handler routes by the price's
`tier` metadata: `tier === "regular"` writes `{regularStripePriceId, regularPrice}`;
anything else writes `{stripePriceId, price}`. Without that routing the two prices
clobber each other. `checkout.session.completed` records `unitPrice =
session.amount_subtotal` (the actual amount charged, not a hardcoded value).
`productSync.ts` maps `preorderPriceCutoff` from Stripe product metadata onto the
doc.

**c. Client display (mirror, display-only).**
`src/lib/features/store/domain/preorder-pricing.ts`:
- `activePriceCents(product, nowMs)` — client mirror of the server gate. Preorder
  before cutoff, regular at/after. Falls back to `product.price` when no swap
  applies.
- `preorderWindowOpen(product, nowMs)` — true only when a cutoff **and** a
  regular price exist and now < cutoff. Gates the note.
- `formatUsd`, `cutoffLabel` (Chicago tz, "September 30").
`now` is read once at component init (no ticking timer). The note component is
`src/lib/features/store/components/PreorderPriceNote.svelte` → renders
"Preorder price — goes to $45 on September 30."

Wired into: `LoopDeckConfiguratorPage.svelte`, `DeckArchitectPage.svelte`,
`StorePage.svelte`, `ProductDetailPage.svelte`, `TnDTrilogyPage.svelte`.

**Product model fields** (`domain/models/product.ts`): `regularStripePriceId?`,
`regularPrice?`, `preorderPriceCutoff?` — all optional; absent ⇒ evergreen single
price.

---

## 3. THE TWO-DOC TRAP (read this before repricing anything)

The storefront does **not** always read the Stripe-synced `prod_…` doc. It reads
whatever doc carries the matching `listing` field, resolved client-side in
`services/product-loader.ts` (`loadActiveProducts` → `{ id, ...d.data() }`).

- **LOOP Deck's real purchasable SKU is a manually-seeded doc**
  `products/D6Ea11ALmrU9GB34qjPt` (`listing: "loop-deck-custom"`). It is **not**
  Stripe-synced — the webhook never touches it. Editing the Stripe product /
  `prod_…` mirror doc does nothing to the storefront.
- **Deck Architect's SKU *is* the Stripe-synced doc** `prod_UsFtOG…`
  (`listing: "loop-deck-architect"` lives in its Stripe metadata), so its webhook
  sync did reach the storefront.

That asymmetry is why, mid-task, LOOP showed $30 with a broken checkout while
Architect was already correct: the initial reprice hit the Stripe mirror, not the
manual SKU, and archiving the old $30 Stripe price left the manual SKU pointing at
an **archived** price (broken checkout). Fix was to update the manual doc directly
in Firestore.

**Rule for the next agent:** to reprice a storefront product, first
`firestore_query_collection` on `products` filtered by its `listing` to find the
doc the storefront actually reads. Do not assume it's the `prod_…` doc.

Current `D6Ea11` (LOOP Deck) values, set directly in Firestore:

```
price                 3500
stripePriceId         price_1TtLnzLkLsYsJ7akyfIEAtIh   (active, $35, prod_UsGN7M)
regularPrice          4500
regularStripePriceId  price_1TtLo5LkLsYsJ7akxbaeOwr0   (active, $45, prod_UsGN7M)
preorderPriceCutoff   2026-09-30T23:59:59-05:00
```

Architect ($45/$55) lives on `prod_UsFtOG…`, applied via webhook.

---

## 4. Free US shipping

`firebase-functions/src/merch/checkoutParams.ts` shipping options:
US `{ amount: 0, display_name: "Free US shipping" }`; Canada 1400; Intl 2500. The
US $0 line is intentional — shipping cost is absorbed into the higher deck price.

---

## 5. What's live + how it was verified

Production (`tkaflowarts.com`), verified in-browser and via curl on 2026-07-15:

- [`/shop/loop-deck`](https://tkaflowarts.com/shop/loop-deck) → **$35** ·
  "Preorder price — goes to $45 on September 30."
- [`/shop/loop-deck/architect`](https://tkaflowarts.com/shop/loop-deck/architect)
  → **$45** · "Preorder price — goes to $55 on September 30."
- Both Stripe prices confirmed active on `prod_UsGN7M`.
- JSON-LD `AggregateOffer` on the LOOP Deck route corrected `$30–$40` → `$35–$55`
  ([PR #35](https://github.com/austencloud/tka-platform/pull/35)), live in the
  SSR head.

Server functions (`resolveActivePrice`, tier-routed webhook, free-US-shipping
params) were deployed scoped to `functions:createMerchCheckout,functions:handleMerchWebhook`
(do NOT do an unscoped functions deploy — it would delete `scheduledFirestoreExport`).

Spec: `docs/superpowers/specs/2026-07-14-preorder-price-swap-design.md`.

---

## 6. Gotchas that ate time (so you don't repeat them)

- **PWA service-worker cache.** After a deploy, the browser can serve the **old**
  cached JS over **live** Firestore data — you'll see the new price but old
  behavior (e.g. missing note). Verify with `curl` (bypasses SW) or unregister the
  SW + clear caches + hard reload. Don't trust a single browser load post-deploy.
- **Two deploy pipelines.** `main` auto-deploys to Cloudflare Pages (project
  `tka-platform`). **Local `main` is often behind `origin/main`** because worktrees
  merge server-side via `gh` — grep `origin/main`, not the local tree, to see
  what's actually deployed. Prod builds take ~14 min; a *preview* deploy of the
  same commit finishes faster and is a valid way to verify rendered output early.
- **NTFS Greek-glyph phantom deletions.** Six `static/guide/level-1/**` files with
  Θ/θ in the name case-collide on Windows, so every fresh worktree shows them as
  unstaged ` D` deletions. Systemic, not your work — never stage/commit them.
  Always commit with an explicit pathspec (`git commit -- <file>`).
- **Client price gate is a hand-maintained mirror** of the server gate. If you
  change `resolveActivePrice.ts`, mirror it in `preorder-pricing.ts` (and vice
  versa). They're intentionally duplicated (the function can't import client code).

---

## 7. Open decision — owner's call, not a code task

Repricing was scoped to LOOP packs + Architect. Other **active** products still
sit at old prices, now inconsistent with the $35 floor:

- **TnD Trilogy** — TKA 1 / 2 / 3 listed at **$30 each** (no preorder swap).
- **7 LOOP flavor SKUs at $25** (`listing: "loop-deck"`: Inverted, Mirrored,
  Swapped, …). These are **backing / cover-art + flavor-list sources**.
- Book $39, Starter Pack $65 — untouched.

**VERIFIED 2026-07-15 (follow-up agent, live Firestore query of `products`):**
every product above has `stripePriceId: ""` — the flavor SKUs, all three TnD
volumes, the Book, AND the Starter Pack. `BuyButton.svelte` gates purchasability
on `Boolean(product.stripePriceId)`, so all of them render the waitlist form,
never a checkout — including via direct `/shop/<docId>` URLs and the
`flavorSkus[0]` fallback branches in the Configurator/Architect. **Nothing can
charge $25 or $30 today; the only purchasable products are the LOOP Deck
($35→$45) and Deck Architect ($45→$55), both swap-configured.** 29/29 merch unit
tests pass (`firebase-functions`, jest).

**Do NOT archive the flavor SKUs.** They must stay `status: "active"`: the
Configurator, Architect, and StorePage derive cover cards, hero fans, and the
flavor list from `listing === "loop-deck"` actives, and the Configurator
error-states when `flavorSkus.length === 0`. They are unpurchasable data
sources; their `price: 2500` field is never rendered anywhere (all displayed
prices come from the custom/architect SKUs). No $25 Stripe prices exist to
archive — the $25 lives only in the Firestore field.

Remaining owner decision (Austen): none of TnD / Book / Starter Pack is on sale
today (waitlist-only). When any of them goes on sale, pick its price then —
e.g. give TnD the same preorder→regular treatment if it should align
($30→$40). Do **not** apply a pricing scheme without his go-ahead — this is a
business decision.

---

## 8. Key files

| Concern | File |
|---|---|
| Server price gate | `firebase-functions/src/merch/resolveActivePrice.ts` |
| Checkout (calls gate) | `firebase-functions/src/merch/createMerchCheckout.ts` |
| Webhook tier routing | `firebase-functions/src/merch/handleMerchWebhook.ts` |
| Shipping options | `firebase-functions/src/merch/checkoutParams.ts` |
| Stripe→doc mapping | `firebase-functions/src/merch/productSync.ts` |
| Client price gate (mirror) | `src/lib/features/store/domain/preorder-pricing.ts` |
| Preorder note UI | `src/lib/features/store/components/PreorderPriceNote.svelte` |
| Product model | `src/lib/features/store/domain/models/product.ts` |
| Product loader | `src/lib/features/store/services/product-loader.ts` |
| Buy surfaces | `LoopDeckConfiguratorPage.svelte`, `DeckArchitectPage.svelte`, `StorePage.svelte`, `TnDTrilogyPage.svelte`, `ProductDetailPage.svelte` |
| SEO route (JSON-LD) | `src/routes/(public)/shop/loop-deck/+page.svelte` |
| Spec | `docs/superpowers/specs/2026-07-14-preorder-price-swap-design.md` |

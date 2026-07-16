# Preorder Price Swap — Design

**Date:** 2026-07-14
**Status:** Approved (full-send, no spec-review gate — per `feedback_skip_spec_gating`)
**Worktree:** `E:/worktrees/tka-platform/preorder-price-swap` (branch `preorder-price-swap`)

## Goal

Charge a lower **preorder** price now, auto-jump to a higher **regular** price after a
cutoff date — with zero manual action on the day. Bake free US shipping into the higher
price.

Business decisions (locked with Austen):

| SKU | Preorder | Regular (after cutoff) |
|---|---|---|
| LOOP packs (mild/medium/spicy) | $35 | $45 |
| Deck Architect | $45 | $55 |

- **Cutoff:** `2026-09-30T23:59:59-05:00` (end of Sept 30, Chicago — decks ship Oct 1).
- **Mechanism:** date-gate evaluated per-checkout server-side (no cron).
- **Free US shipping** baked in; Canada/International stay paid.
- **Scope:** physical decks only. Sampler / guide / digital untouched.

## Architecture constraint (why the naive approach breaks)

The Stripe Dashboard is the product editor. `handleMerchWebhook.ts` mirrors
`product.*` + `price.*` events into the Firestore `products` collection.
The current `price.*` handler writes `stripePriceId = <any active price>` — so a
second active price on the same product **clobbers** the first. The design routes
prices by a `metadata.tier` tag to keep both.

`unitPrice: session.amount_subtotal` (webhook) records the *actually-charged* price,
so order records stay correct through any swap — no order-recording change needed.

## Design (Approach A — two tagged prices + per-checkout date gate)

### 1. Data model — `src/lib/features/store/domain/models/product.ts`

Add to `Product` (all optional; absent ⇒ evergreen, no swap):

- `regularStripePriceId?: string` — post-cutoff Stripe price
- `regularPrice?: number` — post-cutoff display price (cents, matches `price`)
- `preorderPriceCutoff?: string` — ISO instant; the swap boundary

`stripePriceId` / `price` keep their meaning = the preorder (pre-cutoff) price.

### 2. Stripe authoring (operational — the one outward step)

Per deck product, in Stripe:

- New **preorder** price ($3500 pack / $4500 Architect), price `metadata.tier=preorder`
- New **regular** price ($4500 / $5500), price `metadata.tier=regular`
- Product `metadata.preorderPriceCutoff = 2026-09-30T23:59:59-05:00`
- Archive the old $30 / $40 prices

Stripe prices are immutable, so the $30→$35 change itself requires new prices — this is
the normal Stripe pattern.

### 3. Sync routing — `firebase-functions/src/merch/handleMerchWebhook.ts`

`price.created|updated` handler routes by tier (fixes the clobber):

- `price.metadata.tier === "regular"` → write `{ regularStripePriceId, regularPrice }`
- else → write `{ stripePriceId, price }` (preorder / default / legacy untagged)

`productSync.ts` `mapStripeProductToDoc`: pass `meta.preorderPriceCutoff` through to the doc.

### 4. Checkout date gate — `firebase-functions/src/merch/`

New pure resolver `resolveActivePriceId(product, nowMs)` (own file + unit test):

```
cutoff = product.preorderPriceCutoff ? Date.parse(...) : null
if cutoff !== null && nowMs >= cutoff && product.regularStripePriceId
  → regularStripePriceId
else
  → stripePriceId          // preorder, or fail-safe when regular missing
```

`createMerchCheckout.ts` calls it and passes the resolved id into
`buildMerchCheckoutParams` (its `product.stripePriceId` becomes the resolved id).
Server clock = authoritative; a client cannot force the old price. Fail-safe: past
cutoff but no regular price ⇒ charge preorder, `console.warn` (never block a sale).

### 5. Client display — `src/lib/features/store/`

New pure helpers `domain/preorder-pricing.ts` (client mirror of the resolver, same
convention as the existing function/client whitelist mirrors):

- `activePriceCents(product, nowMs)` → preorder vs regular by cutoff
- `isPreorderWindowOpen(product, nowMs)` → boolean
- `cutoffLabel(iso)` → e.g. "Sept 30"

New `components/PreorderPriceNote.svelte` — renders "Goes to $45 on Sept 30" with
**no layout shift** (reserved slot; visibility toggle, not `display`). Reused on the
buy surfaces.

Wiring:

- Every price render uses `activePriceCents(sku, now)` instead of raw `sku.price`
  (so grid, detail, configurator, architect all agree pre/post cutoff).
- `now = Date.now()` at component init — no ticking timer (checkout re-resolves
  server-side; a page open across the exact midnight boundary is negligible).
- Buy surfaces (ProductDetailPage, LoopDeckConfiguratorPage, DeckArchitectPage)
  additionally render `PreorderPriceNote` while the window is open.

### 6. Shipping — `firebase-functions/src/merch/checkoutParams.ts`

US shipping option `amount: 500 → 0`, `display_name: "Free US shipping"`.
Canada ($14) / International ($25) unchanged.

## Testing

- `resolveActivePriceId` (functions): before / at-boundary / after / missing-regular
  fallback / no-cutoff evergreen.
- Extend `checkoutParams.test.ts`: resolved id becomes the line item.
- Sync routing: `tier` routes to the correct field, untagged stays preorder.
- `preorder-pricing.ts` (client): mirror cases.
- No browser test (logic, not interactive-component behavior — per
  `component-test-discipline`).

## Rollout

1. Ship code (feature dormant — evergreen fallback until Stripe prices exist).
2. Create Stripe prices + product metadata (outward step; test mode first).
3. Deploy functions (`firebase deploy --only functions`).
4. Verify a test-mode checkout charges preorder now; simulate post-cutoff.

## Out of scope

TGC dropship automation (separate Phase-2 project). This is pricing only.

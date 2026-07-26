---
status: active
value: 4
effort: M
remaining: "Body status: Approved, ready for plan"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# Shop Cart + Order-Doc Persistence — Design

**Date:** 2026-07-13
**Status:** Approved, ready for plan
**Related:** `project_shop_preview_phase` (approve/reject preview rides this spine), `project_loop_deck_shop_live` (live Stripe preorders), `project_physical_merch_store`

## Problem

The shop is live with single-product Stripe preorders. The current checkout path
crams the product + LOOP configuration into Stripe session **metadata**
(`firebase-functions/src/merch/checkoutParams.ts`), which caps at 500 chars per
value, and the webhook (`handleMerchWebhook.ts`) reconstructs the `orders/{id}`
doc **from that metadata after payment**. Two things this can't do:

1. **Multi-item orders** — a buyer wants a guide + poster + mug + LOOP deck in one
   purchase. Metadata can't hold N line items with per-item config.
2. **A configured deck's chosen sequences** — the future approve/reject preview
   phase (`project_shop_preview_phase`) must persist ~54 chosen sequences, which
   the metadata cap can't hold.

Both need the same thing: **the order doc must exist BEFORE payment**, holding the
full order, with Stripe carrying only a reference to it.

## Non-goals (out of scope; later specs)

- **Approve/reject preview phase** — writes `sequenceIds` into the pending order
  doc before checkout. This spec reserves the field; it does not build the phase.
- **Global-nav cart badge** — deliberately excluded. Cart chrome lives only inside
  `/shop`. A cart on the app-wide landing over-commercializes the tool.
- **Poster size variants** — one size ships first.
- **Buyer-configured posters** — posters are a fixed catalog for now.
- **Server-side persistent cart** — cart stays client-side (`localStorage`) until
  checkout. No Firestore write per add-to-cart.

## Architecture: server-authoritative draft order

One new spine. The client **never writes `orders` directly**. A new callable
resolves prices server-side against `products/{id}`, writes a `pending` order doc,
and builds the Stripe session referencing it. This kills the metadata cap and the
client-trusts-price hole in one move.

### Flow

1. Cart lives in `localStorage` (guest + signed-in alike — zero Firestore writes).
2. Checkout → callable **`createCartCheckout({ items })`** where
   `items: Array<{ productId: string; qty: number; propType?: string; loopConfig?: LoopConfigRequest }>`.
3. Server:
   - For each item, load `products/{productId}`; assert `status === "active"`;
     read the authoritative `stripePriceId` + `price` from the doc.
   - Validate any `loopConfig` with the existing `validateLoopConfig` /
     `validateRecipe` (from `checkoutParams.ts` — factor them out so the callable
     and the legacy path share one copy).
   - Write `orders/{id}` with `status: "pending"`, the resolved `lineItems`,
     `subtotal`, `createdAt`, `expiresAt = now + 24h`.
   - Build a Stripe Checkout session with N `line_items`
     (`{ price: stripePriceId, quantity }` each), `metadata.orderRef = id`, and the
     unchanged `automatic_tax` / `shipping_address_collection` /
     `shipping_options` / `payment_method_types: ["card"]`.
   - Persist `stripeSessionId` onto the doc. Return `{ url }`.
4. Webhook `checkout.session.completed`:
   - If `metadata.orderRef` present → load `orders/{orderRef}`, set `status:"paid"`,
     attach `stripePaymentIntentId`, `customerEmail`, `shippingAddress`,
     `totalAmount`, `paidAt`.
   - Else → the **existing** metadata-reconstruction path, kept for any in-flight
     legacy sessions. Removed after cutover.

Single-buy surfaces (listing "Preorder now", `LoopDeckConfiguratorPage`,
`DeckArchitectPage`) migrate to `createCartCheckout` with a **one-item** array, so
every purchase rides the spine and the forward webhook path is single. The
existing `createMerchCheckout` callable stays until cutover is verified in
production, then retires.

## Data model

### `orders/{id}` (server-written only)

```ts
{
  status: "pending" | "paid" | "expired";
  lineItems: Array<
    | { kind: "sku"; productId: string; stripePriceId: string; name: string;
        unitPrice: number; qty: number }                     // poster / mug / guide / prebuilt deck
    | { kind: "loopDeck"; productId: string; stripePriceId: string; name: string;
        unitPrice: number; qty: 1;
        propType?: string;
        loopConfig: { pack?: string; recipe?: RecipeSlice[]; level?: string;
                      length?: string; flavor?: string; custom?: Record<string, unknown> };
        sequenceIds?: string[] }                             // reserved for approve/reject phase
  >;
  subtotal: number;                 // sum(unitPrice * qty), pre-shipping/tax
  createdAt: Timestamp;
  expiresAt: Timestamp;             // +24h; Firestore TTL policy sweeps abandoned pending docs
  stripeSessionId?: string;         // set at checkout
  // webhook fills on paid:
  stripePaymentIntentId?: string;
  customerEmail?: string;
  shippingAddress?: { name; line1; line2; city; state; postalCode; country } | null;
  totalAmount?: number;             // grand total incl. shipping + tax
  paidAt?: Timestamp;
}
```

Legacy orders (no `orderRef`, `items` array from metadata) remain valid — the
success page and any admin tooling must read both shapes during the overlap.

### Cart state — `src/lib/features/store/state/shop-cart.svelte.ts`

`localStorage`-backed `$state` array. Line shape = the client-side subset of a
`lineItem` (no server fields). API:

- `add(item)`, `remove(key)`, `setQty(key, n)`, `clear()`
- derived `count`, derived `subtotal`
- SKU items: `qty >= 1`; dedupe by `productId` (adding again bumps qty).
- `loopDeck` items: `qty` locked to `1` (each configured deck is unique); **never**
  deduped (distinct configs are distinct lines).
- Persist round-trips through `localStorage` under one key (e.g. `tka:shop:cart`).

## Posters

Fixed catalog. Each poster = a Stripe product + price authored in the dashboard,
mirrored to `products/{id}` by the existing `product.*` / `price.*` webhook sync.
One size (13×19 print area on 19×13 Mohawk Everyday Digital 100lb cover stock;
self-fulfilled). Shop grid and `ProductDetailPage` list posters with no change
beyond an **Add to cart** action. No draft-config path — a poster is a plain SKU
line. Fulfillment: paid order doc → printed by the operator.

## Components (all under `/shop`; none global)

- **`shop-cart.svelte.ts`** — state module above.
- **`CartDrawer.svelte`** — wraps existing `src/lib/shared/foundation/ui/Drawer.svelte`
  + `DrawerHeader.svelte`. Line list, qty steppers (button `+`/`−`, **no checkbox**
  per `no-checkboxes.md`), per-line remove, subtotal, Checkout button, empty state.
- **`CartButton.svelte`** — cart affordance + count badge, rendered **only** in
  `src/routes/(public)/shop/+layout.svelte` header. Not in app-wide navigation.
- **`AddToCartButton`** — extend existing `BuyButton.svelte` with a
  `mode: "buy" | "add"` prop rather than forking a parallel component
  (`never-hand-roll.md`). Buttons per `clickables-look-like-buttons.md`, 44px floor.
- Configurator / Architect: add a secondary **Add to cart**; keep primary
  **Preorder now** as a direct one-item checkout (the listing stays a conversion
  page — `project_shop_preview_phase` framing).

## Error handling

- Product inactive at checkout → callable throws `failed-precondition`; client
  toasts and flags the offending line in the cart.
- Price drift → server always uses the current `products/{id}` price. If it differs
  from the cart's last-known `unitPrice`, the cart shows a "price updated" note
  before checkout so the total is never a surprise.
- Stripe session failure → `internal` error → toast.
- Empty cart → Checkout disabled.
- Abandoned `pending` docs → `expiresAt` TTL policy on the `orders` collection.

## Security

- `orders`: **no client write** (Firestore rule denies client writes; only the
  callable's admin SDK writes). Read is gated — the success page resolves an order
  by Stripe session via a callable, not an open collection read.
- Client-supplied prices are never trusted; `stripePriceId` + `unitPrice` are read
  server-side from `products/{id}`.
- `loopConfig` re-validated server-side with the shared validators.
- Firestore TTL policy on `orders.expiresAt` must not delete `paid` docs — TTL only
  removes docs whose `expiresAt` is set AND still `pending`. (The webhook clears or
  ignores `expiresAt` on paid; verify TTL semantics in the plan — Firestore TTL
  deletes purely on timestamp, so clear `expiresAt` when flipping to `paid`.)

## Testing

- Unit: cart state — add / dedupe SKU / qty clamp / loopDeck qty locked to 1 /
  loopDeck never deduped / `localStorage` persist round-trip.
- Unit: cart Stripe params builder — N `line_items`, `metadata.orderRef` only, no
  per-item metadata cram; mirrors the existing `checkoutParams.test.ts` style.
- Unit: shared validators (`validateLoopConfig` / `validateRecipe`) still pass on
  pack / recipe / dials after extraction.
- Function: webhook with a completed session carrying `orderRef` flips
  `pending → paid` and attaches Stripe fields; legacy metadata path unchanged.
- Function: `createCartCheckout` writes the pending doc with the correct resolved
  `lineItems` + `subtotal`, rejects inactive products and invalid `loopConfig`.

## Rollout

1. Ship `createCartCheckout` + `orderRef` webhook branch alongside the existing
   path (no behavior change to live single-buy yet).
2. Migrate single-buy / configurator / architect to `createCartCheckout` one-item.
3. Ship cart + posters.
4. After production verification, retire `createMerchCheckout` and the legacy
   metadata reconstruction branch.

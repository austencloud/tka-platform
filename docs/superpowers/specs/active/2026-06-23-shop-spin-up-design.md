---
status: active
value: 5
effort: M
remaining: Full build — rename, gate, coming-soon/waitlist, admin Products editor
depends_on: ""
supersedes_context: docs/superpowers/specs/backlog/2026-04-01-physical-merch-store-design.md
tags: [revenue, shop, store, stripe]
last_triaged: 2026-06-23
---
# Shop Spin-Up — Design Spec

**Date:** 2026-06-23
**Status:** Phase A built + verified 2026-06-24 (rename → /shop, nav, gate, coming-soon
+ waitlist, /store→/shop redirects, webhook product-sync). Remaining: credentialed Stripe
config + first real product + deploy (Phase B4). `npm run check`, functions build, and a
full `npm run build` all green; routes verified (/shop 200, /store/* 308).

---

## Problem

The store is built end-to-end but invisible and unusable:

- Feature module `src/lib/features/store/` (StorePage, ProductDetailPage, ProductCard,
  BuyButton, OrderConfirmation, store-state, store-context, product-loader,
  merch-checkout-creator).
- Routes `(public)/store`, `(public)/store/[productId]`, `(public)/store/success`.
- Cloud functions `firebase-functions/src/merch/createMerchCheckout.ts` (Firestore
  product → Stripe Checkout Session) and `handleMerchWebhook.ts` (writes `orders/`).
- Firestore `products` + `orders` collections; product carries `stripePriceId`.

What's missing: it is linked from nowhere, has no nav, can't be reached by a human,
shows nothing (no products), and there is no way to author products inside the app.

Austen wants it **visible now with a "Coming Soon" placeholder** (public), **fully
usable by him** (admin) to play with and add products in dev, and unified under the
brand word **Shop** at `/shop`. This is the revenue path: guides, Choreo cards,
materials.

The already-built half is documented in
`docs/superpowers/specs/backlog/2026-04-01-physical-merch-store-design.md`. This spec
covers only the delta to spin it up.

## Locked Decisions (from brainstorming, 2026-06-23)

| Decision | Choice |
|---|---|
| Gate | Admin sees the live shop (incl. drafts); public sees Coming Soon. Same URL. |
| Brand + URL | Unify fully on **Shop** / `/shop`. Rename routes, feature folder, page components, and cloud-function redirect URLs. Add `/store → /shop` redirect. |
| Product authoring | **Stripe Dashboard is the product editor** (decision revised 2026-06-24 after audit + research — see Revision below). Products are authored in Stripe; a sync mirrors them into Firestore. No in-app CRUD editor. |
| Coming Soon | On-brand placeholder **with a "notify me" email capture** → Firestore waitlist. |

## Philosophy / Tone

The notation stays free; the object costs money ("play with everything, pay to take it
home"). Coming-soon and shop copy follow the **educational-resource tone, not sales
energy** (`feedback_landing_page_tone`), and the AI writing guide: no superlatives, no
"Whether you're…", no em dashes, vary sentence length.

---

## Architecture

### Phase A — Make it visible (ship first)

**A1. Rename store → shop (full unification).**

| From | To |
|---|---|
| `src/routes/(public)/store/` | `src/routes/(public)/shop/` (incl. `[productId]/`, `success/`) |
| `src/lib/features/store/` | `src/lib/features/shop/` |
| `StorePage.svelte` | `ShopPage.svelte` |
| `StoreHeader.svelte` | `ShopHeader.svelte` |
| `store-state.svelte.ts` | `shop-state.svelte.ts` |
| `store-context.ts` | `shop-context.ts` |
| `<title>Store \| …</title>`, hero "TKA Card Decks" copy | "Shop" branding |

Keep as-is (internal / generic, not store-branded): `ProductCard`, `BuyButton`,
`OrderConfirmation`, `CardMockupPreview`, `SampleCardCarousel`, `product.ts` model,
`product-loader`, `merch-checkout-creator`, the `createMerchCheckout` /
`handleMerchWebhook` function names, and the Firestore `products` / `orders`
collection names. Update every import path touched by the folder rename.

**A2. Cloud-function redirect URLs.** In `createMerchCheckout.ts`:
`success_url: ${baseUrl}/shop/success?session_id=…`, `cancel_url: ${baseUrl}/shop/${productId}`.
Requires a functions redeploy. Stripe Dashboard webhook endpoint is unchanged (same
function name), so no Stripe console reconfig.

**A3. `/store → /shop` redirect.** After A1 moves the folder, re-add a minimal
`(public)/store/` group containing only redirect loaders: `+page.ts` (and
`[productId]/+page.ts`, `success/+page.ts`) that `redirect(308, …)` to the `/shop`
equivalent, so any link already shared keeps working. 308 preserves the path/method.
These files hold no UI — just the redirect.

**A4. Nav.** Add to `SiteHeader.svelte` `NAV`:
`{ label: "Shop", href: "/shop", icon: "fa-bag-shopping" }`. Desktop + mobile render
from this array, so both update. Render `SiteHeader` on the `/shop` route group (it is
absent today, so the shop has no nav and no way back) — the same way `/about`, `/roots`,
`/support` mount it.

**A5. Gate.** The `/shop` page resolves admin via the existing `isAdmin()`
(`auth-state.svelte.ts`, backed by Firebase `claims.admin`). The page is already
`ssr:false` / client-only and loads Firestore, so loading auth here is consistent.
- `isAdmin()` → render `ShopPage` using a new admin loader `loadAllProducts()` (all
  statuses, ordered by `sortOrder`).
- otherwise → render `ShopComingSoon`.

`loadAllProducts()` is added to the existing pure-function `product-loader` module
(same `where`-less query, drops the `status == "active"` filter) and surfaced through
the existing `getProductLoader()` getter. Public buyers still hit `loadActiveProducts()`
once launched.

**A6. Coming Soon + waitlist.** New `ShopComingSoon.svelte` in the shop feature, built
from existing app primitives (text input + button; **no checkbox** per `no-checkboxes`).
Content: headline, one line naming what's coming (guides, Choreo cards, materials),
a "notify me" email field. **No secondary "back" link** — the page carries `SiteHeader`
(logo → home + full nav), so a footer back-link is redundant and dilutes the single
email action; a coming-soon page has one job (research 2026-06-24). On submit, write
`{ email, createdAt, source }` to Firestore `shop_waitlist/{autoId}` via the reusable
`joinWaitlist(email, source)` helper (the `source` tag lets one collection serve multiple
announce-me forms). Validate email client-side; show a confirmed state after submit
(reserve its space — `no-layout-shift`).

**A7. Security rules** (`firestore.rules`):
- `products`: public read, admin write (already specced; verify present).
- `orders`: admin read/write (already specced; verify present).
- `shop_waitlist`: `allow create` for anyone with a shape check
  (`request.resource.data.email is string` and size limits); `allow read` admin-only;
  no update/delete from clients.

### Phase B — Stripe Dashboard is the product editor (revised 2026-06-24)

**Why revised:** an audit + three research passes (commerce platform / SvelteKit forms /
storefront UI) concluded the in-app CRUD editor was the wrong build — it duplicates
Stripe's mature product catalog UI and creates two-system drift (a Firestore product
authored independently of Stripe, left with an empty/placeholder `stripePriceId`, is not
purchasable). Verified infra (ground-truth queries 2026-06-24):
- `firebase.json` already installs `stripe/firestore-stripe-payments@0.3.4` (powers
  premium subs via `customers/{uid}/subscriptions` + `ext-…-createPortalLink`).
- The `products` collection currently holds **one hand-seeded deck** with
  `stripePriceId: "price_placeholder"` (custom flat schema, not Stripe-synced, not
  purchasable).

So products get authored in the **Stripe Dashboard** (best-in-class editor, $0 extra,
keeps the existing public `createMerchCheckout` and lowest lock-in — see the design spec
`2026-06-23` research notes), and a sync mirrors them into Firestore for the storefront.

**B1. Product model** (`product.ts`). Keep the `type` extension to
`'physical-deck' | 'sampler-pack' | 'digital' | 'guide' | 'material'` and optional
`cardCount` (these now come from Stripe product **metadata**). `stripePriceId` is the
product's active Stripe price.

**B2. Sync: extend the existing webhook (chosen over the extension's product-sync).**
Add `product.created/updated`, `price.created/updated` handling to the **existing**
`firebase-functions/src/merch/handleMerchWebhook.ts` to upsert a flat Firestore `products`
doc from each Stripe product + its default price: `{ name, description, price (unit_amount),
stripePriceId, status (active→active / archived→draft), type/cardCount/deckId/sortOrder
from product metadata, coverImageUrl from product images }`.
- Rationale for extending the webhook rather than turning on the installed extension's
  product-sync: the extension keys products by Stripe id with a `prices` **subcollection**
  and its **checkout requires an auth'd user** (`customers/{uid}/checkout_sessions`) — which
  fights this store's deliberately **public, no-auth** `createMerchCheckout`. Extending the
  webhook keeps the flat schema + the public checkout **unchanged** (~40 lines, reuses the
  Stripe SDK + webhook already present). Stripe Dashboard is still the editor either way.

**B3. Storefront stays as-is.** `createMerchCheckout` already reads
`products/{id}.stripePriceId` — unchanged. `loadActiveProducts()` (public) /
`loadAllProducts()` (admin) unchanged. Delete the one placeholder seed once a real Stripe
product syncs in.

**B4. Credentialed steps (Austen / Firebase+Stripe access — physical blockers):**
1. In Stripe Dashboard, forward `product.created`, `product.updated`, `price.created`,
   `price.updated` events to the existing `handleMerchWebhook` endpoint (the
   `STRIPE_WEBHOOK_SECRET` is already set — subs work).
2. Create the first real product(s) in the Stripe Dashboard (name, price, images,
   metadata: `type`, `cardCount`, `deckId`, `sortOrder`). Or author via the Stripe MCP
   together. The webhook syncs them into Firestore; the admin shop view shows them.
3. Deploy: `firebase deploy --only functions:handleMerchWebhook,firestore:rules`.

---

## File Change List

**Rename / move (A1):** the `store/` route group and `features/store/` folder per the
table above, with import-path fixups across the codebase.

**Edit:**
- `src/lib/shared/landing/components/SiteHeader.svelte` — add Shop to `NAV`. *(reuse;
  array-driven nav already renders desktop+mobile)*
- `(public)/shop/+page.svelte` — admin gate (`isAdmin()` → ShopPage vs ShopComingSoon),
  mount `SiteHeader`.
- `src/lib/features/shop/services/product-loader.ts` — add `loadAllProducts()`. *(extend
  existing module)*
- `firebase-functions/src/merch/createMerchCheckout.ts` — `/store` → `/shop` URLs.
- `firebase-functions/src/merch/handleMerchWebhook.ts` — add `product.*`/`price.*` event
  handling to sync Stripe products → Firestore (B2). *(extend existing webhook)*
- `firestore.rules` — `shop_waitlist` rules (done); `products`/`orders` rules verified present.
- `src/lib/features/shop/domain/models/product.ts` — extend `type`, optional `cardCount` (done).

**Create (each justified — `never-hand-roll`):**
- `src/lib/features/shop/components/ShopComingSoon.svelte` — grep found no reusable
  coming-soon / waitlist primitive (only unrelated "coming soon" copy strings); built
  from existing input/button primitives. *(done)*
- `src/lib/features/shop/services/waitlist.ts` — `joinWaitlist(email, source)` Firestore
  write. *(done)*
- `(public)/store/+page.ts` (+ `[productId]`, `success`) — 308 redirect shims to `/shop`.

**Deleted (reversal of the in-app-editor approach, 2026-06-24):** the hand-rolled
`ProductForm.svelte`, `ProductManagement.svelte`, `product-admin.ts`,
`product-image-uploader.ts`, and the `upsertMerchProductPrice` function are NOT built —
Stripe Dashboard + the webhook sync replace them.

**`loadAllProducts()`** stays in `product-loader.ts` (admin store view of drafts). *(done)*

---

## Out of Scope

- Shopping cart (one product = direct checkout; unchanged).
- Buyer accounts, inventory tracking, international shipping (US only; unchanged).
- Live in-store card rendering (static images via the editor for now).
- Public launch flip (deleting the gate) — a later one-line change when products are ready.
- Templated order emails (Stripe Dashboard's built-in notification covers launch).
- Waitlist email *delivery* (collect now; the "notify them" send is a later task).

---

## Risks

| Risk | Mitigation |
|---|---|
| Folder rename breaks imports | Grep all `features/store` + `/store` references; `npm run check` green before commit. |
| Functions redeploy needed for `/shop` URLs | Bundle the URL edit with the rename; redeploy once; smoke-test a checkout in Stripe test mode. |
| Admin gate loads auth on a previously light page | `/shop` is already client-only and Firestore-bound; no landing-mode regression (the gate lives on the page, not in `SiteHeader`). |
| Stripe price function mis-scoped | Admin-only guard on the callable; never expose the Stripe secret client-side. |
| Public reaches a half-built shop | Gate defaults to Coming Soon for everyone except admins. |

---

## Success Criteria

1. "Shop" appears in the site nav (desktop + mobile) and routes to `/shop`.
2. A signed-out visitor at `/shop` sees the Coming Soon page and can submit an email that
   lands in `shop_waitlist`.
3. Austen (admin) at `/shop` sees the live `ShopPage` with all products including drafts.
4. Austen can create a product in the admin Products tab — including price and image —
   and it appears in the admin shop view; the Stripe Product/Price is created and its
   `stripePriceId` is stored.
5. `/store` (and sub-paths) 308-redirect to `/shop`.
6. `npm run check` is green; a Stripe test-mode checkout completes end-to-end against a
   `/shop` redirect URL.

---
status: backlog
value: 3
effort: L
remaining: Full build — Stripe + MakePlayingCards
depends_on: ""
plan_path: plans/backlog/2026-04-01-physical-merch-store.md
tags: []
last_triaged: 2026-04-26
---
# Physical Merch Store — Design Spec

**Date:** 2026-04-01
**Status:** Draft
**Feedback ID:** H3Tcpj6J0648gkIB886t

---

## Problem

TKA has no revenue path for physical products. The card rendering pipeline is fully built (print-ready PNGs at 822x1122px, 300 DPI, 36px bleed), deck data exists in Firestore, and the export tools produce MPC-compatible ZIP files. But there's no storefront, no checkout, and no way for someone to buy a physical deck.

## Philosophy

The notation is free. The object costs money. Anyone can print cards at home — that's encouraged. The physical product is a premium artifact: professional card stock, consistent quality, sleeve-compatible, tradeable, collectible. This aligns with the existing premium philosophy: "play with everything, pay to take it home."

QR codes and all features remain on user-exported cards. No artificial restrictions to push sales.

---

## Product Catalog

### Launch Products

**1. Full Card Decks (~128 cards each, poker size)**

Starting with two decks:
- **VTG Deck** — Per-hand timing/direction patterns
- **8-Count Quartered Rotated Loops** — 128 sequences, organized by hand-path family

Each card has:
- **Front:** Sequence pictograph (rendered by existing ImageComposer)
- **Back:** Card info — word, beat count, level, LOOP type, theme styling (rendered by CardBackCanvasRenderer)

Additional decks planned (up to 8-9 total), drawn from existing Firestore deck data.

**2. Sampler Packs (15 cards)**

Curated selection pulled from full deck bulk stock. Lower price point for impulse buyers.

**3. Digital Products (future)**

PDF codex poster, cheat sheets, ebooks. Instant delivery via Stripe. Not in initial build scope but the store UI should accommodate them.

### Pricing (Pending MPC Confirmation)

| Product | Price | Est. Cost | Est. Profit |
|---------|-------|-----------|-------------|
| Full 128-card deck | $50 | ~$29 | ~$21 |
| 15-card sampler pack | $15 | ~$8 | ~$7 |

Costs assume Keep Stock model (50 decks pre-ordered in bulk from MPC). Exact MPC pricing for 144-card tier at 50 units TBD — requires manual lookup in MPC design tool.

---

## Fulfillment Model

**Keep Stock via MPC + self-shipping.**

1. Pre-order 50 decks per product from MPC at bulk pricing (~$1,000 upfront per deck type)
2. MPC ships bulk order to Austen
3. Orders come in via Stripe → email notification
4. Austen packages and ships via USPS

Packaging: TBD (tuck box, cellophane + sticker, or kraft paper band). Decision is independent of code work.

**Why not MPC MarketPlace (fully automated)?**
- Print-on-demand cost for 128-card decks is ~$50/deck — leaves no margin at a $50 price point
- Keep Stock drops per-deck cost to ~$20, making $50 retail viable
- MPC MarketPlace remains an option if/when volume justifies higher base costs or if smaller (54-card) products are added later

**Why not full automation?**
- ADD-friendly compromise: orders are low-frequency (not dozens per day), shipping is simple (drop in mailbox), and the manual step is 5 minutes not 30
- If volume grows, MPC fulfillment service (spreadsheet upload, they ship direct) handles batching

---

## Architecture

### Public Store Route

The store lives at `/store` as a public route — no authentication required. This is critical: curious people who find TKA through a video or friend shouldn't hit a login wall before they can buy.

The store is NOT a module inside the authenticated app. It's a standalone public page, similar to the landing page.

### SvelteKit Route Structure

The store uses the `(public)` route group to bypass the authenticated root layout:

```
src/routes/(public)/store/+page.svelte              → /store (imports StorePage.svelte)
src/routes/(public)/store/[productId]/+page.svelte   → /store/[productId] (imports ProductDetailPage.svelte)
src/routes/(public)/store/success/+page.svelte       → /store/success (order confirmation)
```

Route files are thin wrappers that import components from `src/lib/features/store/`. The `(public)` group resets the layout chain so the store has its own layout without the app shell or auth gate.

### Store Page UI

**Product Listing (`/store`):**
- Grid of product cards
- Each card shows: deck name, card count, price, a rendered card preview (using existing card renderer)
- "View Deck" links to detail page
- Clean, minimal design — not cluttered

**Product Detail (`/store/[productId]`):**
- Hero section with rendered card mockup (front + back, angled/stacked presentation)
- Deck description, card count, what's included
- Scrollable preview of sample cards from the deck (rendered live via existing pipeline)
- Price + "Buy Now" button → Stripe Checkout
- "Or print at home" link → takes user to the app's export tools (requires auth)

### Card Preview Strategy

The store needs card images for product pages. Two approaches, used together:

**Primary: Pre-rendered static images.** A build script renders 5-10 sample cards per product as PNGs and uploads them to Cloud Storage. The store page loads these as static `<img>` tags. Fast, no DI container needed on the public route, works without JavaScript.

**Stretch goal: Live renderer.** If we want interactive card browsing (flip, zoom, carousel), we can initialize a minimal DI container subset on the store route with just the rendering services (no auth-dependent ones). This is optional and adds complexity.

For launch, static pre-rendered images are the right call. The card renderer pipeline already exists to generate them — we just need a script that renders the preview subset and uploads to storage. The `coverImageUrl` and `previewSequenceIds` fields in the Product model support both approaches.

### Stripe Integration

**One-time purchase checkout (not subscription). No authentication required.**

**Important:** The existing premium subscription uses the Firebase Stripe Extension, which writes checkout sessions under `customers/{uid}/checkout_sessions` — this requires a logged-in user. The merch store is public (no auth), so it uses a different pattern: a **callable HTTP Cloud Function** that creates Stripe Checkout Sessions directly via the Stripe SDK server-side.

Flow:
1. Buyer clicks "Buy Now"
2. Frontend calls `createMerchCheckout` HTTP Cloud Function with `{ productId, quantity: 1 }`
3. Cloud Function validates product, creates Stripe Checkout Session via Stripe SDK
4. Returns checkout URL → frontend redirects buyer to Stripe
5. Stripe Checkout handles: payment, shipping address collection
6. On success: Stripe redirects to `/store/success?session_id={CHECKOUT_SESSION_ID}`
7. Stripe webhook fires → Cloud Function writes order to Firestore + sends email notification
8. Austen ships the deck

Stripe Checkout Session config:
- `mode: 'payment'` (not 'subscription')
- `shipping_address_collection: { allowed_countries: ['US'] }` (expand later)
- `line_items`: product name, price, quantity (always 1 per checkout — no cart)
- `success_url`: `/store/success?session_id={CHECKOUT_SESSION_ID}`
- `cancel_url`: `/store/[productId]`

**Tax:** Stripe Tax is a separate paid feature. Not enabled at launch. Revisit if sales volume justifies it or if legally required.

**Email notification:** Use Stripe Dashboard's built-in email notifications for successful payments (zero code). Austen enables "Successful payments" email in Stripe Dashboard → Settings → Emails. Upgrade to SendGrid/Firebase Email if templated order emails are needed later.

### Data Model

**Firestore: `products/{productId}`**

```typescript
interface Product {
  id: string;
  name: string;                    // "8-Count Quartered Rotated Loops"
  description: string;
  type: 'physical-deck' | 'sampler-pack' | 'digital';
  price: number;                   // cents (5000 = $50.00)
  cardCount: number;               // 128
  deckId?: string;                 // Reference to decks/{deckId} for card rendering
  stripePriceId: string;           // Stripe Price object ID
  status: 'active' | 'draft' | 'sold-out';
  previewSequenceIds: string[];    // 5-10 sequence IDs to render as preview
  coverImageUrl?: string;          // Optional static fallback image
  sortOrder: number;
}
```

**Firestore: `orders/{orderId}`**

```typescript
interface Order {
  id: string;
  stripeSessionId: string;
  stripePaymentIntentId: string;
  customerEmail: string;
  shippingAddress: StripeShippingAddress;
  items: OrderItem[];
  totalAmount: number;             // cents
  status: 'paid' | 'shipped' | 'delivered';
  createdAt: Timestamp;
  shippedAt?: Timestamp;
  trackingNumber?: string;
}

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}
```

### Services (DI Container)

Frontend services only — order recording happens server-side in Cloud Functions, not in the frontend.

| Service | Interface | Purpose |
|---------|-----------|---------|
| `ProductLoader` | `IProductLoader` | Load products from Firestore `products/` collection |
| `MerchCheckoutCreator` | `IMerchCheckoutCreator` | Call Cloud Function to create Stripe Checkout session |

Registered in a new `store-container.ts` in the DI system. Minimal footprint — no auth dependencies.

### Cloud Functions

**`createMerchCheckout`** (HTTP callable)
- Called by frontend with `{ productId, quantity: 1 }`
- Validates product exists and is active in Firestore
- Creates Stripe Checkout Session via Stripe SDK (server-side, no auth required)
- Returns `{ url: checkoutUrl }`
- Does NOT use the Firebase Stripe Extension (that requires authenticated users)

**`handleMerchWebhook`** (HTTP endpoint for Stripe webhooks)
- Listens for `checkout.session.completed` events
- Verifies webhook signature
- Writes order record to `orders/` collection
- Stripe Dashboard handles email notification to Austen (no custom email code needed)

### Firestore Security Rules

```
// Products: publicly readable, admin-only write
match /products/{productId} {
  allow read: if true;
  allow write: if request.auth != null && request.auth.token.admin == true;
}

// Orders: admin-only read/write (Cloud Function uses Admin SDK, bypasses rules)
match /orders/{orderId} {
  allow read, write: if request.auth != null && request.auth.token.admin == true;
}
```

---

## File Structure

```
src/lib/features/store/
├── StorePage.svelte                          # Product listing
├── ProductDetailPage.svelte                  # Single product view
├── components/
│   ├── ProductCard.svelte                    # Grid card for listing
│   ├── CardMockupPreview.svelte              # Rendered card preview (front+back)
│   ├── SampleCardCarousel.svelte             # Scrollable card samples
│   ├── BuyButton.svelte                      # Stripe checkout trigger
│   └── OrderConfirmation.svelte              # Post-purchase page
├── services/
│   ├── contracts/
│   │   ├── IProductLoader.ts
│   │   └── IMerchCheckoutCreator.ts
│   └── implementations/
│       ├── ProductLoader.ts
│       └── MerchCheckoutCreator.ts
├── state/
│   └── store-state.svelte.ts                 # Reactive store page state
└── context/
    └── store-context.ts                      # Context distribution
```

---

## What's Out of Scope (Initial Build)

- Shopping cart (each product = direct checkout, no multi-item cart)
- User accounts for buyers (Stripe handles receipts)
- Inventory tracking (manual — you know how many decks you have)
- International shipping (US only at launch, expand via Stripe config later)
- Digital product delivery (future — just the store UI shell for now)
- Order management dashboard in-app (check Stripe Dashboard directly)
- MPC MarketPlace integration (revisit if adding smaller/cheaper deck products)

---

## Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| MPC 144-card pricing unknown | Manual lookup in MPC design tool before committing to pricing |
| Upfront inventory cost (~$1,000/deck type) | Start with one deck, validate demand before ordering second |
| Shipping burden with ADD | Keep process dead simple: pre-printed labels, USPS pickup, batch weekly |
| Low initial volume | Store doubles as marketing — live card previews drive app signups even if they don't buy |

---

## Success Criteria

1. A non-authenticated user can browse products and complete a purchase at `/store`
2. Austen receives Stripe email notification with shipping address on purchase
3. Product pages show pre-rendered card preview images
4. Order records persist in Firestore `orders/` collection
5. Firestore security rules allow public read on `products/`, restrict `orders/` to admin
6. At least one deck available for purchase within 2 weeks of build completion

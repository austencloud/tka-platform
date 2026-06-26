# Shop Operations & Go-Live Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the shop from "checkout works in test mode" to "ready to take real pre-orders" — Stripe Tax, a pre-order layer, a testable refactor of the merch functions, webhook activation, and the launch gate removal.

**Architecture:** Extract the two merch Cloud Functions' inline logic into pure, unit-tested builders (`buildMerchCheckoutParams`, `mapStripeProductToDoc`) so tax + pre-order behavior is verified without hitting Stripe. Pre-order is a thin two-field layer (`preorder`, `shipBy`) authored as Stripe product metadata, synced to Firestore, rendered as one conditional line on the card + detail page. Stripe Dashboard stays the product editor and the fulfillment console.

**Tech Stack:** SvelteKit 5 (runes), Firebase Cloud Functions (v1 `functions.https`, `defineString` params), Stripe Node SDK v21, jest + ts-jest (functions), Firestore.

**Spec:** `docs/superpowers/specs/active/2026-06-26-shop-operations-go-live-design.md`

**Conventions for every task:**
- Functions live in `firebase-functions/`. Run function tests with `cd firebase-functions && npx jest <path>`. Typecheck functions with `cd firebase-functions && npx tsc --noEmit -p tsconfig.json`.
- Frontend typecheck: `npm run check` (full — run once at a task boundary, not in a loop; see `.claude/rules/fast-iteration-loop.md`).
- Commit with an EXPLICIT pathspec (`git commit -m "…" -- <paths>`) — the index is shared with other agents (`.claude/rules/commit-only-your-own-changes.md`).
- Never echo or commit the Stripe key; it lives only in gitignored `firebase-functions/.env`.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `firebase-functions/src/merch/checkoutParams.ts` | Pure builder: `Product` + baseUrl → `Stripe.Checkout.SessionCreateParams` (tax, shipping, line items, urls). Owns `MERCH_SHIPPING_OPTIONS`. | Create |
| `firebase-functions/src/merch/checkoutParams.test.ts` | Unit tests for the builder (tax enabled, shipping, countries, urls). | Create |
| `firebase-functions/src/merch/createMerchCheckout.ts` | Thin handler: validate, load product, call builder, create session. | Modify |
| `firebase-functions/src/merch/productSync.ts` | Pure mapper: `Stripe.Product` → Firestore product doc (incl. `preorder`/`shipBy`). | Create |
| `firebase-functions/src/merch/productSync.test.ts` | Unit tests for the mapper. | Create |
| `firebase-functions/src/merch/handleMerchWebhook.ts` | Webhook handler: verify sig, write order, call mapper for product sync. | Modify |
| `src/lib/features/store/domain/models/product.ts` | Add `preorder?`, `shipBy?` to `Product`. | Modify |
| `src/lib/features/store/components/ProductCard.svelte` | Conditional pre-order line. | Modify |
| `src/lib/features/store/ProductDetailPage.svelte` | Pre-order line near Buy button. | Modify |
| `src/routes/(public)/shop/+page.svelte` | Gate removal one-liner (launch only). | Modify |

`product-loader.ts` is intentionally **not** modified — it spreads `...d.data()`, so the two new fields flow through once the model declares them and the webhook writes them.

---

## Task 1: Pre-order fields on the Product model

**Files:**
- Modify: `src/lib/features/store/domain/models/product.ts:12-27`

- [ ] **Step 1: Add the two optional fields to the `Product` interface**

In `product.ts`, inside `interface Product`, after the `coverImageUrl?` line (line 25) add:

```ts
  /** True when the deck is sold ahead of printing; pairs with shipBy. From Stripe metadata. */
  readonly preorder?: boolean;
  /** Human ship-by label shown on pre-order products, e.g. "September 2026". From Stripe metadata. */
  readonly shipBy?: string;
```

- [ ] **Step 2: Typecheck the frontend**

Run: `npm run check`
Expected: PASS (0 errors). The fields are optional, so no existing usage breaks.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/store/domain/models/product.ts
git commit -m "feat(shop): add preorder/shipBy fields to Product model" -- src/lib/features/store/domain/models/product.ts
```

---

## Task 2: Pure Stripe-product → Firestore mapper (with pre-order)

This extracts the inline product mapping from `handleMerchWebhook` into a pure function so the pre-order metadata mapping is unit-tested.

**Files:**
- Create: `firebase-functions/src/merch/productSync.ts`
- Create: `firebase-functions/src/merch/productSync.test.ts`
- Modify: `firebase-functions/src/merch/handleMerchWebhook.ts:78-95`

- [ ] **Step 1: Write the failing test**

Create `firebase-functions/src/merch/productSync.test.ts`:

```ts
import Stripe from "stripe";
import { mapStripeProductToDoc } from "./productSync";

function product(overrides: Partial<Stripe.Product>): Stripe.Product {
  return {
    id: "prod_123",
    name: "8-Count Quartered Rotated Loops",
    description: "A deck.",
    active: true,
    images: ["https://img/cover.png", "https://img/sample.png"],
    metadata: {},
    ...overrides,
  } as Stripe.Product;
}

describe("mapStripeProductToDoc", () => {
  it("maps core fields and images", () => {
    const doc = mapStripeProductToDoc(product({}));
    expect(doc.name).toBe("8-Count Quartered Rotated Loops");
    expect(doc.status).toBe("active");
    expect(doc.coverImageUrl).toBe("https://img/cover.png");
    expect(doc.previewImageUrls).toEqual(["https://img/cover.png", "https://img/sample.png"]);
    expect(doc.type).toBe("physical-deck");
  });

  it("maps archived (inactive) products to draft", () => {
    expect(mapStripeProductToDoc(product({ active: false })).status).toBe("draft");
  });

  it("reads preorder='true' metadata as boolean true and carries shipBy", () => {
    const doc = mapStripeProductToDoc(
      product({ metadata: { preorder: "true", shipBy: "September 2026" } })
    );
    expect(doc.preorder).toBe(true);
    expect(doc.shipBy).toBe("September 2026");
  });

  it("omits preorder/shipBy when metadata absent", () => {
    const doc = mapStripeProductToDoc(product({}));
    expect(doc.preorder).toBeUndefined();
    expect(doc.shipBy).toBeUndefined();
  });

  it("parses numeric metadata (cardCount, sortOrder) and deckId", () => {
    const doc = mapStripeProductToDoc(
      product({ metadata: { cardCount: "128", sortOrder: "2", deckId: "l1-x", type: "guide" } })
    );
    expect(doc.cardCount).toBe(128);
    expect(doc.sortOrder).toBe(2);
    expect(doc.deckId).toBe("l1-x");
    expect(doc.type).toBe("guide");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd firebase-functions && npx jest src/merch/productSync.test.ts`
Expected: FAIL — `Cannot find module './productSync'`.

- [ ] **Step 3: Implement the pure mapper**

Create `firebase-functions/src/merch/productSync.ts`:

```ts
import type Stripe from "stripe";

/**
 * Pure mapping from a Stripe Product (the Dashboard is the editor) to the flat
 * Firestore `products` doc the storefront reads. TKA-specific fields ride in
 * Stripe product metadata. Price/stripePriceId are set separately by price.* events,
 * so this object is merged (never overwrites them).
 */
export function mapStripeProductToDoc(product: Stripe.Product): Record<string, unknown> {
  const meta = product.metadata || {};
  const doc: Record<string, unknown> = {
    name: product.name,
    description: product.description ?? "",
    status: product.active ? "active" : "draft",
    coverImageUrl: product.images?.[0] ?? "",
    previewImageUrls: product.images ?? [],
    type: meta.type || "physical-deck",
    sortOrder: meta.sortOrder ? Number(meta.sortOrder) : 0,
  };
  if (meta.cardCount) doc.cardCount = Number(meta.cardCount);
  if (meta.deckId) doc.deckId = meta.deckId;
  if (meta.preorder === "true") doc.preorder = true;
  if (meta.shipBy) doc.shipBy = meta.shipBy;
  return doc;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd firebase-functions && npx jest src/merch/productSync.test.ts`
Expected: PASS (5 passed).

- [ ] **Step 5: Refactor the webhook to use the mapper**

In `handleMerchWebhook.ts`, add the import after line 4:

```ts
import { mapStripeProductToDoc } from "./productSync";
```

Replace the product-sync block (currently lines 78-95, the `if (event.type === "product.created" || event.type === "product.updated")` body that builds `doc` inline) with:

```ts
    if (event.type === "product.created" || event.type === "product.updated") {
      const product = event.data.object as Stripe.Product;
      // merge: preserve stripePriceId/price set by price.* events (any order).
      await admin
        .firestore()
        .collection("products")
        .doc(product.id)
        .set(mapStripeProductToDoc(product), { merge: true });
      console.log(`Synced product ${product.id} (${product.name})`);
    }
```

- [ ] **Step 6: Typecheck the functions**

Run: `cd firebase-functions && npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add firebase-functions/src/merch/productSync.ts firebase-functions/src/merch/productSync.test.ts firebase-functions/src/merch/handleMerchWebhook.ts
git commit -m "feat(merch): extract+test product->Firestore mapper, add preorder/shipBy sync" -- firebase-functions/src/merch/productSync.ts firebase-functions/src/merch/productSync.test.ts firebase-functions/src/merch/handleMerchWebhook.ts
```

---

## Task 3: Pure checkout-params builder with Stripe Tax

Extract the Checkout Session params from `createMerchCheckout` into a tested builder, and add `automatic_tax` + shipping `tax_behavior`.

**Files:**
- Create: `firebase-functions/src/merch/checkoutParams.ts`
- Create: `firebase-functions/src/merch/checkoutParams.test.ts`
- Modify: `firebase-functions/src/merch/createMerchCheckout.ts`

- [ ] **Step 1: Write the failing test**

Create `firebase-functions/src/merch/checkoutParams.test.ts`:

```ts
import { buildMerchCheckoutParams } from "./checkoutParams";

const PRODUCT = { name: "Deck", stripePriceId: "price_123" };

describe("buildMerchCheckoutParams", () => {
  const params = buildMerchCheckoutParams({
    product: PRODUCT,
    productId: "doc_1",
    baseUrl: "https://tkaflowarts.com",
  });

  it("enables Stripe automatic tax", () => {
    expect(params.automatic_tax).toEqual({ enabled: true });
  });

  it("uses the product's stripePriceId as the single line item", () => {
    expect(params.line_items).toEqual([{ price: "price_123", quantity: 1 }]);
  });

  it("collects worldwide shipping addresses", () => {
    const countries = params.shipping_address_collection?.allowed_countries ?? [];
    expect(countries).toContain("US");
    expect(countries).toContain("AU");
    expect(countries.length).toBeGreaterThan(100);
  });

  it("offers shipping rates that all declare a tax_behavior (required by automatic_tax)", () => {
    const opts = params.shipping_options ?? [];
    expect(opts.length).toBeGreaterThanOrEqual(3);
    for (const o of opts) {
      expect(o.shipping_rate_data?.tax_behavior).toBe("exclusive");
    }
  });

  it("builds /shop success + cancel urls from baseUrl", () => {
    expect(params.success_url).toBe(
      "https://tkaflowarts.com/shop/success?session_id={CHECKOUT_SESSION_ID}"
    );
    expect(params.cancel_url).toBe("https://tkaflowarts.com/shop/doc_1");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd firebase-functions && npx jest src/merch/checkoutParams.test.ts`
Expected: FAIL — `Cannot find module './checkoutParams'`.

- [ ] **Step 3: Implement the builder**

Create `firebase-functions/src/merch/checkoutParams.ts`:

```ts
import type Stripe from "stripe";
import { SHIPPING_COUNTRIES } from "./shippingCountries";

// PLACEHOLDER flat shipping rates (USD cents). The buyer selects one at checkout —
// Stripe does not auto-pick a rate by destination in a static session. Tune these
// once real package weight is measured (a ~128-card deck is <1lb: US ~$5, Canada
// ~$14, international ~$25). tax_behavior is required when automatic_tax is enabled.
const MERCH_SHIPPING_OPTIONS: Stripe.Checkout.SessionCreateParams.ShippingOption[] = [
  { shipping_rate_data: { type: "fixed_amount", display_name: "US shipping", tax_behavior: "exclusive", fixed_amount: { amount: 500, currency: "usd" } } },
  { shipping_rate_data: { type: "fixed_amount", display_name: "Canada shipping", tax_behavior: "exclusive", fixed_amount: { amount: 1400, currency: "usd" } } },
  { shipping_rate_data: { type: "fixed_amount", display_name: "International shipping", tax_behavior: "exclusive", fixed_amount: { amount: 2500, currency: "usd" } } },
];

export interface MerchCheckoutProduct {
  name: string;
  stripePriceId: string;
}

export function buildMerchCheckoutParams(opts: {
  product: MerchCheckoutProduct;
  productId: string;
  baseUrl: string;
}): Stripe.Checkout.SessionCreateParams {
  const { product, productId, baseUrl } = opts;
  return {
    mode: "payment",
    line_items: [{ price: product.stripePriceId, quantity: 1 }],
    automatic_tax: { enabled: true },
    shipping_address_collection: { allowed_countries: SHIPPING_COUNTRIES },
    shipping_options: MERCH_SHIPPING_OPTIONS,
    success_url: `${baseUrl}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/shop/${productId}`,
    metadata: { productId, productName: product.name },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd firebase-functions && npx jest src/merch/checkoutParams.test.ts`
Expected: PASS (5 passed).

- [ ] **Step 5: Refactor `createMerchCheckout` to use the builder**

In `createMerchCheckout.ts`: remove the now-moved `MERCH_SHIPPING_OPTIONS` const and the `SHIPPING_COUNTRIES` import (they live in `checkoutParams.ts` now). Add the import after the `defineString` import:

```ts
import { buildMerchCheckoutParams } from "./checkoutParams";
```

Replace the entire `const session = await stripe.checkout.sessions.create({ … });` call with:

```ts
    const session = await stripe.checkout.sessions.create(
      buildMerchCheckoutParams({ product: product as { name: string; stripePriceId: string }, productId, baseUrl })
    );
```

Leave the rest of the handler (productId validation, product load, `status !== "active"` guard, `!session.url` guard, return) unchanged.

- [ ] **Step 6: Typecheck the functions**

Run: `cd firebase-functions && npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 7: Run the full merch test suite**

Run: `cd firebase-functions && npx jest src/merch`
Expected: PASS (productSync + checkoutParams suites green).

- [ ] **Step 8: Commit**

```bash
git add firebase-functions/src/merch/checkoutParams.ts firebase-functions/src/merch/checkoutParams.test.ts firebase-functions/src/merch/createMerchCheckout.ts
git commit -m "feat(merch): extract+test checkout params builder, enable Stripe automatic_tax" -- firebase-functions/src/merch/checkoutParams.ts firebase-functions/src/merch/checkoutParams.test.ts firebase-functions/src/merch/createMerchCheckout.ts
```

---

## Task 4: Deploy the functions and verify tax against a tax-configured test product

> Account precondition: the test product's **price** must have a `tax_behavior` (set when creating the price in the Stripe Dashboard, or via an account default tax behavior), and Stripe Tax must be enabled in test mode with an origin address. Without it, `sessions.create` throws `You cannot use automatic_tax[enabled]=true … set a tax behavior`. This is the §2 / go-live-checklist account step — do it before this task's verification.

**Files:** none (deploy + runtime verification).

- [ ] **Step 1: Deploy both functions**

Run: `firebase deploy --only functions:createMerchCheckout,functions:handleMerchWebhook`
Expected: `Deploy complete!`, both "Successful update operation."

- [ ] **Step 2: Call the function and confirm a tax-bearing session is created**

Run:
```bash
curl -s -X POST https://us-central1-the-kinetic-alphabet.cloudfunctions.net/createMerchCheckout \
  -H "Content-Type: application/json" \
  -d '{"data":{"productId":"B8dDCYkEPunFCFVKiaBr"}}'
```
Expected: `{"result":{"url":"https://checkout.stripe.com/c/pay/cs_test_…"}}`.
If instead you get an error mentioning `automatic_tax` / `tax behavior`, the price isn't tax-configured — fix the price's `tax_behavior` in the Dashboard (account step) and re-run. If the error names a missing **shipping** tax code, add `tax_code: "txcd_92010001"` to each entry in `MERCH_SHIPPING_OPTIONS` (verify the code in Stripe Tax docs first), redeploy, re-run.

- [ ] **Step 3: (Manual, optional) eyeball the tax line**

Open the returned URL in a browser, enter a US address; Checkout shows a "Tax" line once a taxable address is entered. Record pass/fail. (No code change.)

No commit (deploy + verification only).

---

## Task 5: Pre-order line on ProductCard

Pre-order is static per product (set once from Stripe metadata), so it is a conditional line exactly like the existing `cardCount` line — no runtime toggle, no special slot reservation needed (`.claude/rules/no-layout-shift.md` targets runtime content changes).

**Files:**
- Modify: `src/lib/features/store/components/ProductCard.svelte:22-28` (markup) + style block

- [ ] **Step 1: Add the pre-order line to the card markup**

In `ProductCard.svelte`, inside `.card-info`, after the `card-price` paragraph (line 27), add:

```svelte
    {#if product.preorder}
      <p class="card-preorder">
        Pre-order{product.shipBy ? ` · ships ${product.shipBy}` : ""}
      </p>
    {/if}
```

- [ ] **Step 2: Add the style**

In the `<style>` block, after the `.card-price` rule, add:

```css
  .card-preorder {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    margin: 4px 0 0;
    color: var(--theme-warning, #f59e0b);
  }
```

- [ ] **Step 3: Typecheck**

Run: `npm run check`
Expected: PASS (0 errors).

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/store/components/ProductCard.svelte
git commit -m "feat(shop): pre-order line on product card" -- src/lib/features/store/components/ProductCard.svelte
```

---

## Task 6: Pre-order line on ProductDetailPage

**Files:**
- Modify: `src/lib/features/store/ProductDetailPage.svelte:57-66` (markup) + style block

- [ ] **Step 1: Add the pre-order line under the meta/price, above the Buy button**

In `ProductDetailPage.svelte`, in the `.info-column`, immediately before `<BuyButton productId={product.id} />` (line 63), add:

```svelte
          {#if product.preorder}
            <p class="preorder-note">
              Pre-order{product.shipBy ? ` — ships ${product.shipBy}` : ""}. You're charged now; it ships when printed.
            </p>
          {/if}
```

- [ ] **Step 2: Add the style**

In the `<style>` block, after the `.price` rule, add:

```css
  .preorder-note {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-warning, #f59e0b);
    margin: 0 0 16px;
  }
```

- [ ] **Step 3: Typecheck**

Run: `npm run check`
Expected: PASS (0 errors).

- [ ] **Step 4: Visual verification**

Set the test product to pre-order to see both lines render. In the Firebase MCP (or Dashboard) set `products/B8dDCYkEPunFCFVKiaBr` fields `preorder: true`, `shipBy: "September 2026"`. As admin, load:
- `https://localhost:5173/shop` → card shows "Pre-order · ships September 2026".
- `https://localhost:5173/shop/B8dDCYkEPunFCFVKiaBr` → detail shows the pre-order note above Buy.

Confirm both render and the page does not jump. Revert the test fields afterward if you don't want the test product flagged. (Per `.claude/rules/verification-protocol.md`, capture a screenshot or have Austen confirm.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/store/ProductDetailPage.svelte
git commit -m "feat(shop): pre-order note on product detail page" -- src/lib/features/store/ProductDetailPage.svelte
```

---

## Task 7: Activate the webhook (order capture + product sync)

Code already handles the events (Task 2 covers the product branch; the order + price branches already exist). This task registers the endpoint and wires the secret. Mostly account work; do it in **test mode** first.

**Files:** `firebase-functions/.env` (secret line only — never echoed or committed).

- [ ] **Step 1 (Austen): Register the webhook endpoint in the Stripe Dashboard (test mode)**

Endpoint URL: `https://us-central1-the-kinetic-alphabet.cloudfunctions.net/handleMerchWebhook`
Events: `checkout.session.completed`, `product.created`, `product.updated`, `price.created`, `price.updated`.
Copy the endpoint's **Signing secret** (`whsec_…`).

- [ ] **Step 2 (Austen): Put the signing secret in `.env`**

Edit `firebase-functions/.env`, set `STRIPE_WEBHOOK_SECRET=whsec_…`, save. Do not paste it in chat.

- [ ] **Step 3: Verify the secret line is clean (no value echoed)**

Run:
```bash
cd firebase-functions && v=$(grep '^STRIPE_WEBHOOK_SECRET=' .env | cut -d= -f2-) && echo "len ${#v} prefix ${v:0:6}"
```
Expected: a non-zero length and prefix `whsec_`.

- [ ] **Step 4: Redeploy the webhook**

Run: `firebase deploy --only functions:handleMerchWebhook`
Expected: `Deploy complete!`.

- [ ] **Step 5: Verify order capture end-to-end (test mode)**

Complete a test checkout: open a checkout URL from Task 4, pay with `4242 4242 4242 4242`, any future expiry, any CVC, a US address. Then confirm an order landed:

Run (Firebase MCP `firestore_query_collection` on `orders/`, or):
```bash
firebase firestore:get orders --limit 1 2>/dev/null || echo "use Firebase MCP firestore_query_collection on 'orders/'"
```
Expected: one `orders/` doc with `status: "paid"`, the shipping address, and the product item. Check `firebase functions:log --only handleMerchWebhook` shows `Order created for product …`.

- [ ] **Step 6: Verify product sync (test mode)**

In the Stripe Dashboard (test), edit the test product's metadata: add `preorder=true`, `shipBy=September 2026`. Confirm `products/<stripeProductId>` in Firestore gains `preorder: true`, `shipBy: "September 2026"` (Firebase MCP `firestore_get_document`), and `functions:log` shows `Synced product …`.

No commit (config + verification).

---

## Task 8: Product art (lean, non-blocking)

The storefront already renders a reserved-space placeholder ("Preview coming soon") when `coverImageUrl` is empty, so launch is **not** blocked on art. This task adds real art when ready; a polished full-card render belongs to `project_worker_pool_card_rendering`, not here. Use the proven single-pictograph render path.

**Files:**
- Create: `scripts/render-shop-art.mjs` (a thin one-off; deletable)
- Output: `static/shop-art/<deckId>/cover.png`, `sample-1.png`… (SvelteKit serves `static/` at `/`)

- [ ] **Step 1: Locate the proven render entry**

Run: `npx tsx --version >/dev/null 2>&1; grep -rl "pictograph-render.worker" src | head` and read the worker + its caller to find the single-pictograph render call (per `project_worker_pool_card_rendering`, single-pictograph render is proven; full-card fanout is not — do not depend on fanout).

- [ ] **Step 2: Render cover + 3 sample images for the hero deck**

Write `scripts/render-shop-art.mjs` that renders the deck's representative pictograph(s) at the proven settings to PNG and writes them to `static/shop-art/l1-quartered-strict-rotated-8beat/`. Keep it small; if the render path needs a browser/worker context unavailable in Node, instead capture the images from the deck's existing gallery render (read how the public gallery already produces card images) rather than building new render infra (`.claude/rules/never-hand-roll.md`).

- [ ] **Step 3: Set the URLs on the Stripe product (Austen, Dashboard)**

Upload `cover.png` + samples as the Stripe product's images (or host under `static/shop-art/` and reference the absolute `https://tkaflowarts.com/shop-art/…` URLs). The webhook (Task 2) syncs `product.images → coverImageUrl`/`previewImageUrls`. Confirm the card + detail page now show the art instead of the placeholder.

- [ ] **Step 4: Commit the art + script**

```bash
git add scripts/render-shop-art.mjs static/shop-art
git commit -m "feat(shop): rendered cover + sample art for the hero deck" -- scripts/render-shop-art.mjs static/shop-art
```

> If Step 2 reveals the render path is not Node-runnable and the gallery has no reusable image export, STOP and report — launch proceeds on the placeholder; do not hand-roll a renderer.

---

## Task 9: Go-Live Checklist (Austen-side, non-code) + gate removal

These are physical-blocker account steps from the spec runbook. Do them in order; the final gate removal is the only code change.

- [ ] **A. Clear the 3 past-due Stripe account-activation tasks** (identity/bank) so live charges are enabled.
- [ ] **B. Enable Stripe Tax** in live mode: origin address + Illinois registration; set the product price `tax_behavior` (or account default).
- [ ] **C. Register the live-mode webhook endpoint** (same URL + events as Task 7) → set the live `STRIPE_WEBHOOK_SECRET` in `.env`.
- [ ] **D. Create the real product in the Stripe Dashboard (live):** price (with tax behavior), metadata `type`, `cardCount`, `deckId`, `sortOrder`, `preorder=true`, `shipBy=<honest date>`, images. The webhook syncs it into Firestore.
- [ ] **E. Delete the placeholder seed** `products/B8dDCYkEPunFCFVKiaBr` (Firebase MCP `firestore_delete_document`) once the real product has synced.
- [ ] **F. Swap the key:** set `STRIPE_SECRET_KEY=rk_live_…` in `firebase-functions/.env` (Austen), then redeploy: `firebase deploy --only functions:createMerchCheckout,functions:handleMerchWebhook`.
- [ ] **G. Live smoke test:** buy with a real card (small order), confirm Stripe Tax line + chosen shipping + an `orders/` archive, then refund in the Dashboard.

- [ ] **H. Remove the gate (code).** In `src/routes/(public)/shop/+page.svelte`, the launch flip. Replace the gated render (lines 56-60):

```svelte
{#if ready && isAdmin}
  <StorePage showDrafts />
{:else}
  <ShopComingSoon />
{/if}
```

with the public storefront (drafts stay admin-only via the loader; non-admins simply get the active catalog):

```svelte
{#if ready}
  <StorePage showDrafts={isAdmin} />
{:else}
  <ShopComingSoon />
{/if}
```

Then run `npm run check` (expect PASS) and commit:

```bash
git add src/routes/(public)/shop/+page.svelte
git commit -m "feat(shop): public launch — open the shop to everyone" -- "src/routes/(public)/shop/+page.svelte"
```

---

## Final verification (before declaring the build-able arc done)

- [ ] `cd firebase-functions && npx jest src/merch` — all merch suites green.
- [ ] `cd firebase-functions && npx tsc --noEmit -p tsconfig.json` — exit 0.
- [ ] `npm run check` — 0 errors.
- [ ] `npm run build` — succeeds (pre-ship gate, per `.claude/rules/fast-iteration-loop.md`).
- [ ] Task 4 curl returns a `cs_test_` session; Task 7 produced an `orders/` doc and a synced product in test mode.

## Out of scope (deferred — do not build here)

In-app admin Orders view; digital-guide delivery; cart / multi-item / inventory; waitlist email blast; custom order emails; destination-aware auto shipping-rate selection. (See spec §7.)

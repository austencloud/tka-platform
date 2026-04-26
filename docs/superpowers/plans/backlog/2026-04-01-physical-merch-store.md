# Physical Merch Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public `/store` route where unauthenticated users can browse and purchase physical TKA card decks via Stripe Checkout.

**Architecture:** Public SvelteKit route in the `(public)` group (no auth). Products stored in Firestore `products/` collection. Stripe Checkout Sessions created server-side via HTTP callable Cloud Function (not the Firebase Stripe Extension, which requires auth). Orders recorded by Stripe webhook → Cloud Function → Firestore `orders/` collection.

**Tech Stack:** Svelte 5, TypeScript, Firebase (Firestore + Cloud Functions), Stripe SDK, ITI dependency injection.

**Spec:** `docs/superpowers/specs/2026-04-01-physical-merch-store-design.md`

---

## File Map

### New Files — Frontend

| File | Responsibility |
|------|---------------|
| `src/lib/features/store/domain/models/Product.ts` | Product and Order interfaces |
| `src/lib/features/store/services/contracts/IProductLoader.ts` | Product loading interface |
| `src/lib/features/store/services/contracts/IMerchCheckoutCreator.ts` | Checkout creation interface |
| `src/lib/features/store/services/implementations/ProductLoader.ts` | Load products from Firestore |
| `src/lib/features/store/services/implementations/MerchCheckoutCreator.ts` | Call Cloud Function for Stripe Checkout |
| `src/lib/features/store/state/store-state.svelte.ts` | Reactive store page state factory |
| `src/lib/features/store/context/store-context.ts` | Context distribution for store components |
| `src/lib/features/store/StorePage.svelte` | Product listing grid |
| `src/lib/features/store/ProductDetailPage.svelte` | Single product view with previews + buy button |
| `src/lib/features/store/components/ProductCard.svelte` | Card component for listing grid |
| `src/lib/features/store/components/CardMockupPreview.svelte` | Angled front+back card preview |
| `src/lib/features/store/components/SampleCardCarousel.svelte` | Scrollable sample card images |
| `src/lib/features/store/components/BuyButton.svelte` | Stripe checkout trigger |
| `src/lib/features/store/components/OrderConfirmation.svelte` | Post-purchase confirmation |
| `src/lib/features/store/components/StoreHeader.svelte` | Store page header with nav back to main site |
| `src/lib/shared/di/containers/store-container.ts` | DI container for store services |
| `src/routes/(public)/store/+page.svelte` | Route wrapper → StorePage |
| `src/routes/(public)/store/+page.ts` | Disable prerender and SSR for store routes |
| `src/routes/(public)/store/[productId]/+page.svelte` | Route wrapper → ProductDetailPage |
| `src/routes/(public)/store/success/+page.svelte` | Route wrapper → OrderConfirmation |

### New Files — Backend

| File | Responsibility |
|------|---------------|
| `firebase-functions/src/merch/createMerchCheckout.ts` | HTTP callable: create Stripe Checkout Session |
| `firebase-functions/src/merch/handleMerchWebhook.ts` | HTTP endpoint: Stripe webhook → write order |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/shared/di/container-types.ts` | Add StoreContainer type |
| `src/lib/shared/di/index.ts` | Wire store container |
| `firebase-functions/src/index.ts` | Export new merch functions |
| `firebase-functions/package.json` | Add `stripe` dependency (if not already present) |
| `firestore.rules` | Add `products/` and `orders/` rules |

### Test Files

| File | What it tests |
|------|--------------|
| `tests/unit/store/ProductLoader.test.ts` | Product loading + filtering by status |
| `tests/unit/store/MerchCheckoutCreator.test.ts` | Checkout session creation call |

---

## Task 1: Domain Models & Interfaces

**Files:**
- Create: `src/lib/features/store/domain/models/Product.ts`
- Create: `src/lib/features/store/services/contracts/IProductLoader.ts`
- Create: `src/lib/features/store/services/contracts/IMerchCheckoutCreator.ts`

- [ ] **Step 1: Create Product and Order interfaces**

```typescript
// src/lib/features/store/domain/models/Product.ts
import type { Timestamp } from "firebase/firestore";

export interface Product {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly type: "physical-deck" | "sampler-pack" | "digital";
  readonly price: number; // cents (5000 = $50.00)
  readonly cardCount: number;
  readonly deckId?: string;
  readonly stripePriceId: string;
  readonly status: "active" | "draft" | "sold-out";
  readonly previewImageUrls: string[];
  readonly coverImageUrl?: string;
  readonly sortOrder: number;
}

export interface Order {
  readonly id: string;
  readonly stripeSessionId: string;
  readonly stripePaymentIntentId: string;
  readonly customerEmail: string;
  readonly shippingAddress: ShippingAddress;
  readonly items: readonly OrderItem[];
  readonly totalAmount: number; // cents
  readonly status: "paid" | "shipped" | "delivered";
  readonly createdAt: Timestamp;
  readonly shippedAt?: Timestamp;
  readonly trackingNumber?: string;
}

export interface OrderItem {
  readonly productId: string;
  readonly productName: string;
  readonly quantity: number;
  readonly unitPrice: number;
}

export interface ShippingAddress {
  readonly name: string;
  readonly line1: string;
  readonly line2?: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly country: string;
}
```

- [ ] **Step 2: Create IProductLoader interface**

```typescript
// src/lib/features/store/services/contracts/IProductLoader.ts
import type { Product } from "../../domain/models/Product";

export interface IProductLoader {
  loadActiveProducts(): Promise<Product[]>;
  loadProduct(productId: string): Promise<Product | null>;
}
```

- [ ] **Step 3: Create IMerchCheckoutCreator interface**

```typescript
// src/lib/features/store/services/contracts/IMerchCheckoutCreator.ts
export interface IMerchCheckoutCreator {
  createCheckoutSession(productId: string): Promise<string>; // returns checkout URL
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/store/domain/ src/lib/features/store/services/contracts/
git commit -m "feat(store): add Product/Order domain models and service interfaces"
```

---

## Task 2: Service Implementations

**Files:**
- Create: `src/lib/features/store/services/implementations/ProductLoader.ts`
- Create: `src/lib/features/store/services/implementations/MerchCheckoutCreator.ts`

- [ ] **Step 1: Implement ProductLoader**

```typescript
// src/lib/features/store/services/implementations/ProductLoader.ts
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/firebase/firestore";
import type { IProductLoader } from "../contracts/IProductLoader";
import type { Product } from "../../domain/models/Product";

export class ProductLoader implements IProductLoader {
  async loadActiveProducts(): Promise<Product[]> {
    const firestore = await getFirestoreInstance();
    const productsRef = collection(firestore, "products");
    const q = query(
      productsRef,
      where("status", "==", "active"),
      orderBy("sortOrder", "asc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Product);
  }

  async loadProduct(productId: string): Promise<Product | null> {
    const firestore = await getFirestoreInstance();
    const docRef = doc(firestore, "products", productId);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() } as Product;
  }
}
```

- [ ] **Step 2: Implement MerchCheckoutCreator**

```typescript
// src/lib/features/store/services/implementations/MerchCheckoutCreator.ts
import { getFunctions, httpsCallable } from "firebase/functions";
import type { IMerchCheckoutCreator } from "../contracts/IMerchCheckoutCreator";

export class MerchCheckoutCreator implements IMerchCheckoutCreator {
  async createCheckoutSession(productId: string): Promise<string> {
    const functions = getFunctions();
    const createCheckout = httpsCallable<
      { productId: string },
      { url: string }
    >(functions, "createMerchCheckout");

    const result = await createCheckout({ productId });
    return result.data.url;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/store/services/implementations/
git commit -m "feat(store): implement ProductLoader and MerchCheckoutCreator"
```

---

## Task 3: DI Container Registration

**Files:**
- Create: `src/lib/shared/di/containers/store-container.ts`
- Modify: `src/lib/shared/di/container-types.ts`
- Modify: `src/lib/shared/di/index.ts`

- [ ] **Step 1: Create store container**

```typescript
// src/lib/shared/di/containers/store-container.ts
import { createContainer } from "iti";
import { ProductLoader } from "$lib/features/store/services/implementations/ProductLoader";
import { MerchCheckoutCreator } from "$lib/features/store/services/implementations/MerchCheckoutCreator";

export function createStoreContainer() {
  return createContainer().add({
    productLoader: () => new ProductLoader(),
    merchCheckoutCreator: () => new MerchCheckoutCreator(),
  });
}

export type StoreContainer = ReturnType<typeof createStoreContainer>;
```

- [ ] **Step 2: Add type to container-types.ts**

Add to the file:
```typescript
import type { StoreContainer } from "./containers/store-container";
type StoreItems = ItemsOf<StoreContainer>;
```

Add `StoreItems` to the `IAppContainerItems` intersection type.

- [ ] **Step 3: Wire into index.ts**

Add the import near the other container imports (around line 66):
```typescript
import { createStoreContainer } from "./containers/store-container";
```

Add the instantiation with other browser-only containers (around line 131):
```typescript
const storeContainer = typeof window !== "undefined"
  ? createStoreContainer()
  : (null as any);
```

Add to the merged container inside `buildAppContainer()` — find the chain of `c = c.add(...)` calls (around line 419) and add:
```typescript
  c = c.add(storeContainer.items);
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/di/containers/store-container.ts src/lib/shared/di/container-types.ts src/lib/shared/di/index.ts
git commit -m "feat(store): register store services in DI container"
```

---

## Task 4: State Factory & Context

**Files:**
- Create: `src/lib/features/store/state/store-state.svelte.ts`
- Create: `src/lib/features/store/context/store-context.ts`

- [ ] **Step 1: Create store state factory**

```typescript
// src/lib/features/store/state/store-state.svelte.ts
import type { IProductLoader } from "../services/contracts/IProductLoader";
import type { IMerchCheckoutCreator } from "../services/contracts/IMerchCheckoutCreator";
import type { Product } from "../domain/models/Product";

export function createStoreState(
  productLoader: IProductLoader,
  checkoutCreator: IMerchCheckoutCreator
) {
  let products = $state<Product[]>([]);
  let selectedProduct = $state<Product | null>(null);
  let isLoading = $state(false);
  let isCheckingOut = $state(false);
  let error = $state<string | null>(null);

  async function loadProducts() {
    isLoading = true;
    error = null;
    try {
      products = await productLoader.loadActiveProducts();
    } catch (e) {
      error = "Failed to load products. Please try again.";
      console.error("[Store] Failed to load products:", e);
    } finally {
      isLoading = false;
    }
  }

  async function loadProduct(productId: string) {
    isLoading = true;
    error = null;
    try {
      selectedProduct = await productLoader.loadProduct(productId);
      if (!selectedProduct) {
        error = "Product not found.";
      }
    } catch (e) {
      error = "Failed to load product. Please try again.";
      console.error("[Store] Failed to load product:", e);
    } finally {
      isLoading = false;
    }
  }

  async function startCheckout(productId: string) {
    isCheckingOut = true;
    error = null;
    try {
      const url = await checkoutCreator.createCheckoutSession(productId);
      window.location.href = url;
    } catch (e) {
      error = "Failed to start checkout. Please try again.";
      console.error("[Store] Checkout failed:", e);
      isCheckingOut = false;
    }
  }

  return {
    get products() { return products; },
    get selectedProduct() { return selectedProduct; },
    get isLoading() { return isLoading; },
    get isCheckingOut() { return isCheckingOut; },
    get error() { return error; },

    loadProducts,
    loadProduct,
    startCheckout,
  };
}

export type StoreState = ReturnType<typeof createStoreState>;
```

- [ ] **Step 2: Create store context**

```typescript
// src/lib/features/store/context/store-context.ts
import { getContext, setContext } from "svelte";
import type { StoreState } from "../state/store-state.svelte";

const STORE_CONTEXT_KEY = Symbol("store-context");

export interface StoreContext {
  state: StoreState;
}

export function setStoreContext(ctx: StoreContext) {
  setContext(STORE_CONTEXT_KEY, ctx);
}

export function getStoreContext(): StoreContext {
  return getContext<StoreContext>(STORE_CONTEXT_KEY);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/store/state/ src/lib/features/store/context/
git commit -m "feat(store): add store state factory and context"
```

---

## Task 5: Store Page Components

**Files:**
- Create: `src/lib/features/store/components/StoreHeader.svelte`
- Create: `src/lib/features/store/components/ProductCard.svelte`
- Create: `src/lib/features/store/components/CardMockupPreview.svelte`
- Create: `src/lib/features/store/components/BuyButton.svelte`
- Create: `src/lib/features/store/StorePage.svelte`

- [ ] **Step 1: Create StoreHeader**

Simple header with TKA branding and link back to main site. No auth UI.

```svelte
<!-- src/lib/features/store/components/StoreHeader.svelte -->
<script lang="ts">
</script>

<header class="store-header">
  <a href="/" class="logo-link">
    <span class="logo-text">The Kinetic Alphabet</span>
  </a>
  <nav class="store-nav">
    <span class="store-label">Store</span>
  </nav>
</header>

<style>
  .store-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .logo-link {
    text-decoration: none;
    color: inherit;
  }

  .logo-text {
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .store-label {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
</style>
```

- [ ] **Step 2: Create CardMockupPreview**

Static image preview with angled card presentation (front + back).

```svelte
<!-- src/lib/features/store/components/CardMockupPreview.svelte -->
<script lang="ts">
  interface Props {
    coverImageUrl?: string;
    productName: string;
  }

  let { coverImageUrl, productName }: Props = $props();
</script>

<div class="mockup-container">
  {#if coverImageUrl}
    <img
      src={coverImageUrl}
      alt="{productName} card preview"
      class="cover-image"
      loading="lazy"
    />
  {:else}
    <div class="placeholder">
      <i class="fas fa-cards" aria-hidden="true"></i>
      <span>Preview coming soon</span>
    </div>
  {/if}
</div>

<style>
  .mockup-container {
    aspect-ratio: 3 / 4;
    border-radius: 12px;
    overflow: hidden;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .cover-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    font-size: var(--font-size-min, 14px);
  }

  .placeholder i {
    font-size: 32px;
  }
</style>
```

- [ ] **Step 3: Create ProductCard**

```svelte
<!-- src/lib/features/store/components/ProductCard.svelte -->
<script lang="ts">
  import type { Product } from "../domain/models/Product";
  import CardMockupPreview from "./CardMockupPreview.svelte";

  interface Props {
    product: Product;
  }

  let { product }: Props = $props();

  let formattedPrice = $derived(
    `$${(product.price / 100).toFixed(2)}`
  );
</script>

<a href="/store/{product.id}" class="product-card">
  <CardMockupPreview
    coverImageUrl={product.coverImageUrl}
    productName={product.name}
  />
  <div class="card-info">
    <h3 class="card-name">{product.name}</h3>
    <p class="card-meta">{product.cardCount} cards</p>
    <p class="card-price">{formattedPrice}</p>
  </div>
</a>

<style>
  .product-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    text-decoration: none;
    color: inherit;
    border-radius: 16px;
    padding: 12px;
    transition: background 0.2s;
  }

  .product-card:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .card-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .card-name {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    margin: 0;
  }

  .card-meta {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    margin: 0;
  }

  .card-price {
    font-size: var(--font-size-lg, 18px);
    font-weight: 700;
    margin: 4px 0 0;
    color: var(--theme-accent, #60a5fa);
  }
</style>
```

- [ ] **Step 4: Create BuyButton**

```svelte
<!-- src/lib/features/store/components/BuyButton.svelte -->
<script lang="ts">
  import { getStoreContext } from "../context/store-context";

  interface Props {
    productId: string;
  }

  let { productId }: Props = $props();
  const { state } = getStoreContext();
</script>

<button
  class="buy-button"
  onclick={() => state.startCheckout(productId)}
  disabled={state.isCheckingOut}
>
  {#if state.isCheckingOut}
    Processing...
  {:else}
    Buy Now
  {/if}
</button>

<style>
  .buy-button {
    width: 100%;
    padding: 16px 32px;
    font-size: var(--font-size-lg, 18px);
    font-weight: 700;
    border: none;
    border-radius: 12px;
    background: var(--theme-accent, #60a5fa);
    color: #fff;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .buy-button:hover:not(:disabled) {
    opacity: 0.9;
  }

  .buy-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
```

- [ ] **Step 5: Create StorePage**

```svelte
<!-- src/lib/features/store/StorePage.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  import { container } from "$lib/shared/di";
  import { createStoreState } from "./state/store-state.svelte";
  import { setStoreContext } from "./context/store-context";
  import StoreHeader from "./components/StoreHeader.svelte";
  import ProductCard from "./components/ProductCard.svelte";

  const state = createStoreState(
    container.items.productLoader,
    container.items.merchCheckoutCreator
  );

  setStoreContext({ state });

  onMount(() => {
    state.loadProducts();
  });
</script>

<div class="store-page">
  <StoreHeader />

  <main class="store-content">
    <section class="hero">
      <h1>TKA Card Decks</h1>
      <p class="hero-subtitle">
        Professional printed cards. Sleeve-compatible. Tradeable. Collectible.
      </p>
      <p class="hero-note">
        You can always <a href="/">print your own for free</a>. These are the real deal.
      </p>
    </section>

    {#if state.isLoading}
      <div class="loading">Loading products...</div>
    {:else if state.error}
      <div class="error">{state.error}</div>
    {:else if state.products.length === 0}
      <div class="empty">No products available yet. Check back soon.</div>
    {:else}
      <div class="product-grid">
        {#each state.products as product (product.id)}
          <ProductCard {product} />
        {/each}
      </div>
    {/if}
  </main>
</div>

<style>
  .store-page {
    min-height: 100vh;
    background: var(--theme-panel-bg, #0a0a14);
    color: var(--theme-text, #ffffff);
  }

  .store-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 40px 24px;
  }

  .hero {
    text-align: center;
    margin-bottom: 48px;
  }

  .hero h1 {
    font-size: 2rem;
    font-weight: 700;
    margin: 0 0 12px;
  }

  .hero-subtitle {
    font-size: var(--font-size-lg, 18px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    margin: 0 0 8px;
  }

  .hero-note {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    margin: 0;
  }

  .hero-note a {
    color: var(--theme-accent, #60a5fa);
  }

  .product-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 24px;
  }

  .loading, .error, .empty {
    text-align: center;
    padding: 48px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .error {
    color: var(--semantic-error, #ef4444);
  }
</style>
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/store/components/ src/lib/features/store/StorePage.svelte
git commit -m "feat(store): add StorePage with product grid and components"
```

---

## Task 6: Product Detail Page

**Files:**
- Create: `src/lib/features/store/ProductDetailPage.svelte`
- Create: `src/lib/features/store/components/SampleCardCarousel.svelte`
- Create: `src/lib/features/store/components/OrderConfirmation.svelte`

- [ ] **Step 1: Create SampleCardCarousel**

Horizontally scrollable row of pre-rendered card preview images.

```svelte
<!-- src/lib/features/store/components/SampleCardCarousel.svelte -->
<script lang="ts">
  interface Props {
    imageUrls: string[];
    productName: string;
  }

  let { imageUrls, productName }: Props = $props();
</script>

{#if imageUrls.length > 0}
  <div class="carousel-wrapper">
    <h3 class="carousel-title">Sample Cards</h3>
    <div class="carousel themed-scrollbar">
      {#each imageUrls as url, i}
        <img
          src={url}
          alt="{productName} card {i + 1}"
          class="sample-card"
          loading="lazy"
        />
      {/each}
    </div>
  </div>
{/if}

<style>
  .carousel-wrapper {
    margin-top: 32px;
  }

  .carousel-title {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 16px;
  }

  .carousel {
    display: flex;
    gap: 16px;
    overflow-x: auto;
    padding-bottom: 12px;
    scroll-snap-type: x mandatory;
  }

  .sample-card {
    width: 180px;
    height: auto;
    border-radius: 8px;
    scroll-snap-align: start;
    flex-shrink: 0;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }
</style>
```

- [ ] **Step 2: Create OrderConfirmation**

```svelte
<!-- src/lib/features/store/components/OrderConfirmation.svelte -->
<script lang="ts">
  import StoreHeader from "./StoreHeader.svelte";
</script>

<div class="confirmation-page">
  <StoreHeader />
  <main class="confirmation-content">
    <div class="success-icon">
      <i class="fas fa-check-circle" aria-hidden="true"></i>
    </div>
    <h1>Order Confirmed</h1>
    <p>Your deck is on its way. You'll get a receipt from Stripe at the email you provided.</p>
    <p class="note">Orders are packed and shipped within a few business days.</p>
    <a href="/store" class="back-link">Back to Store</a>
  </main>
</div>

<style>
  .confirmation-page {
    min-height: 100vh;
    background: var(--theme-panel-bg, #0a0a14);
    color: var(--theme-text, #ffffff);
  }

  .confirmation-content {
    max-width: 600px;
    margin: 0 auto;
    padding: 80px 24px;
    text-align: center;
  }

  .success-icon {
    font-size: 64px;
    color: var(--semantic-success, #22c55e);
    margin-bottom: 24px;
  }

  h1 {
    font-size: 2rem;
    margin: 0 0 16px;
  }

  p {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    margin: 0 0 8px;
  }

  .note {
    font-size: var(--font-size-compact, 12px);
    margin-top: 16px;
  }

  .back-link {
    display: inline-block;
    margin-top: 32px;
    padding: 12px 24px;
    background: var(--theme-accent, #60a5fa);
    color: #fff;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
  }
</style>
```

- [ ] **Step 3: Create ProductDetailPage**

```svelte
<!-- src/lib/features/store/ProductDetailPage.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  import { container } from "$lib/shared/di";
  import { createStoreState } from "./state/store-state.svelte";
  import { setStoreContext } from "./context/store-context";
  import StoreHeader from "./components/StoreHeader.svelte";
  import CardMockupPreview from "./components/CardMockupPreview.svelte";
  import SampleCardCarousel from "./components/SampleCardCarousel.svelte";
  import BuyButton from "./components/BuyButton.svelte";

  interface Props {
    productId: string;
  }

  let { productId }: Props = $props();

  const state = createStoreState(
    container.items.productLoader,
    container.items.merchCheckoutCreator
  );

  setStoreContext({ state });

  let formattedPrice = $derived(
    state.selectedProduct
      ? `$${(state.selectedProduct.price / 100).toFixed(2)}`
      : ""
  );

  onMount(() => {
    state.loadProduct(productId);
  });
</script>

<div class="detail-page">
  <StoreHeader />

  <main class="detail-content">
    {#if state.isLoading}
      <div class="loading">Loading...</div>
    {:else if state.error}
      <div class="error">{state.error}</div>
    {:else if state.selectedProduct}
      {@const product = state.selectedProduct}
      <div class="detail-layout">
        <div class="preview-column">
          <CardMockupPreview
            coverImageUrl={product.coverImageUrl}
            productName={product.name}
          />
        </div>

        <div class="info-column">
          <a href="/store" class="back-link">
            <i class="fas fa-arrow-left" aria-hidden="true"></i> All Products
          </a>
          <h1>{product.name}</h1>
          <p class="meta">{product.cardCount} cards, poker size (2.5" x 3.5")</p>
          <p class="description">{product.description}</p>
          <p class="price">{formattedPrice}</p>
          <BuyButton productId={product.id} />
          <p class="print-note">
            Or <a href="/">sign in</a> and print your own for free.
          </p>
        </div>
      </div>

      <SampleCardCarousel
        imageUrls={product.previewImageUrls}
        productName={product.name}
      />
    {/if}
  </main>
</div>

<style>
  .detail-page {
    min-height: 100vh;
    background: var(--theme-panel-bg, #0a0a14);
    color: var(--theme-text, #ffffff);
  }

  .detail-content {
    max-width: 1000px;
    margin: 0 auto;
    padding: 40px 24px;
  }

  .detail-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 48px;
    align-items: start;
  }

  @media (max-width: 768px) {
    .detail-layout {
      grid-template-columns: 1fr;
      gap: 24px;
    }
  }

  .back-link {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    text-decoration: none;
    display: inline-block;
    margin-bottom: 16px;
  }

  .back-link:hover {
    color: var(--theme-text, #ffffff);
  }

  h1 {
    font-size: 1.75rem;
    font-weight: 700;
    margin: 0 0 8px;
  }

  .meta {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    margin: 0 0 16px;
  }

  .description {
    font-size: var(--font-size-min, 14px);
    line-height: 1.6;
    margin: 0 0 24px;
  }

  .price {
    font-size: 2rem;
    font-weight: 700;
    color: var(--theme-accent, #60a5fa);
    margin: 0 0 16px;
  }

  .print-note {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    margin-top: 12px;
    text-align: center;
  }

  .print-note a {
    color: var(--theme-accent, #60a5fa);
  }

  .loading, .error {
    text-align: center;
    padding: 48px;
  }

  .error {
    color: var(--semantic-error, #ef4444);
  }
</style>
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/store/ProductDetailPage.svelte src/lib/features/store/components/SampleCardCarousel.svelte src/lib/features/store/components/OrderConfirmation.svelte
git commit -m "feat(store): add ProductDetailPage with carousel and confirmation"
```

---

## Task 7: SvelteKit Routes

**Files:**
- Create: `src/routes/(public)/store/+page.svelte`
- Create: `src/routes/(public)/store/[productId]/+page.svelte`
- Create: `src/routes/(public)/store/success/+page.svelte`

- [ ] **Step 1: Create store page config (disable prerender + SSR)**

The `(public)` layout has `prerender = true` and `ssr = true`, but store pages fetch Firestore data dynamically and import the DI container (which is `null` during SSR). Override both.

```typescript
// src/routes/(public)/store/+page.ts
export const prerender = false;
export const ssr = false;
```

- [ ] **Step 2: Create store listing route**

```svelte
<!-- src/routes/(public)/store/+page.svelte -->
<script lang="ts">
  import StorePage from "$lib/features/store/StorePage.svelte";
</script>

<svelte:head>
  <title>Store | The Kinetic Alphabet</title>
  <meta name="description" content="Professional printed TKA card decks. Sleeve-compatible, tradeable, collectible." />
</svelte:head>

<StorePage />
```

- [ ] **Step 3: Create product detail route (with SSR/prerender override)**

```typescript
// src/routes/(public)/store/[productId]/+page.ts
export const prerender = false;
export const ssr = false;
```

```svelte
<!-- src/routes/(public)/store/[productId]/+page.svelte -->
<script lang="ts">
  import { page } from "$app/stores";
  import ProductDetailPage from "$lib/features/store/ProductDetailPage.svelte";

  let productId = $derived($page.params.productId);
</script>

<svelte:head>
  <title>Store | The Kinetic Alphabet</title>
</svelte:head>

<ProductDetailPage {productId} />
```

- [ ] **Step 4: Create success route**

```svelte
<!-- src/routes/(public)/store/success/+page.svelte -->
<script lang="ts">
  import OrderConfirmation from "$lib/features/store/components/OrderConfirmation.svelte";
</script>

<svelte:head>
  <title>Order Confirmed | The Kinetic Alphabet</title>
</svelte:head>

<OrderConfirmation />
```

- [ ] **Step 5: Run build to verify routes compile**

Run: `npm run build`
Expected: No errors related to store routes.

- [ ] **Step 6: Commit**

```bash
git add src/routes/\(public\)/store/
git commit -m "feat(store): add SvelteKit public routes for store pages"
```

---

## Task 8: Cloud Function — createMerchCheckout

**Files:**
- Create: `firebase-functions/src/merch/createMerchCheckout.ts`
- Modify: `firebase-functions/src/index.ts`
- Modify: `firebase-functions/package.json` (if stripe not present)

- [ ] **Step 1: Check if stripe is already in functions dependencies**

Run: `cat firebase-functions/package.json | grep stripe`

If not present:
Run: `cd firebase-functions && npm install stripe`

- [ ] **Step 2: Create createMerchCheckout function**

```typescript
// firebase-functions/src/merch/createMerchCheckout.ts
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";

const stripe = new Stripe(functions.config().stripe?.secret_key || process.env.STRIPE_SECRET_KEY || "", {
  // apiVersion omitted — uses SDK default for installed package version
});

interface CheckoutRequest {
  productId: string;
}

interface CheckoutResponse {
  url: string;
}

export const createMerchCheckout = functions.https.onCall(
  async (data: CheckoutRequest): Promise<CheckoutResponse> => {
    const { productId } = data;

    if (!productId || typeof productId !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "productId is required"
      );
    }

    // Load product from Firestore
    const productDoc = await admin
      .firestore()
      .collection("products")
      .doc(productId)
      .get();

    if (!productDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Product not found");
    }

    const product = productDoc.data()!;

    if (product.status !== "active") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Product is not available for purchase"
      );
    }

    // Create Stripe Checkout Session
    const baseUrl = functions.config().app?.base_url || "https://tkaflowarts.com";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price: product.stripePriceId,
          quantity: 1,
        },
      ],
      shipping_address_collection: {
        allowed_countries: ["US"],
      },
      success_url: `${baseUrl}/store/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/store/${productId}`,
      metadata: {
        productId,
        productName: product.name,
      },
    });

    if (!session.url) {
      throw new functions.https.HttpsError(
        "internal",
        "Failed to create checkout session"
      );
    }

    return { url: session.url };
  }
);
```

- [ ] **Step 3: Export from index.ts**

Add to `firebase-functions/src/index.ts`:
```typescript
export { createMerchCheckout } from "./merch/createMerchCheckout";
```

- [ ] **Step 4: Build functions to verify**

Run: `cd firebase-functions && npm run build`
Expected: No compilation errors.

- [ ] **Step 5: Commit**

```bash
git add firebase-functions/src/merch/ firebase-functions/src/index.ts firebase-functions/package.json firebase-functions/package-lock.json
git commit -m "feat(store): add createMerchCheckout Cloud Function"
```

---

## Task 9: Cloud Function — handleMerchWebhook

**Files:**
- Create: `firebase-functions/src/merch/handleMerchWebhook.ts`
- Modify: `firebase-functions/src/index.ts`

- [ ] **Step 1: Create webhook handler**

```typescript
// firebase-functions/src/merch/handleMerchWebhook.ts
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";

const stripe = new Stripe(functions.config().stripe?.secret_key || process.env.STRIPE_SECRET_KEY || "", {
  // apiVersion omitted — uses SDK default for installed package version
});

const endpointSecret = functions.config().stripe?.webhook_secret || process.env.STRIPE_WEBHOOK_SECRET || "";

export const handleMerchWebhook = functions.https.onRequest(
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const sig = req.headers["stripe-signature"];
    if (!sig) {
      res.status(400).send("Missing stripe-signature header");
      return;
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      res.status(400).send("Webhook signature verification failed");
      return;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // Only process merch checkouts (have productId metadata)
      if (!session.metadata?.productId) {
        res.status(200).send("Not a merch checkout, skipping");
        return;
      }

      const order = {
        stripeSessionId: session.id,
        stripePaymentIntentId: session.payment_intent as string,
        customerEmail: session.customer_details?.email || "",
        shippingAddress: session.shipping_details?.address
          ? {
              name: session.shipping_details.name || "",
              line1: session.shipping_details.address.line1 || "",
              line2: session.shipping_details.address.line2 || "",
              city: session.shipping_details.address.city || "",
              state: session.shipping_details.address.state || "",
              postalCode: session.shipping_details.address.postal_code || "",
              country: session.shipping_details.address.country || "",
            }
          : null,
        items: [
          {
            productId: session.metadata.productId,
            productName: session.metadata.productName || "",
            quantity: 1,
            unitPrice: session.amount_total || 0,
          },
        ],
        totalAmount: session.amount_total || 0,
        status: "paid",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await admin.firestore().collection("orders").add(order);
      console.log(`Order created for product ${session.metadata.productId}`);
    }

    res.status(200).send("OK");
  }
);
```

- [ ] **Step 2: Export from index.ts**

Add to `firebase-functions/src/index.ts`:
```typescript
export { handleMerchWebhook } from "./merch/handleMerchWebhook";
```

- [ ] **Step 3: Build functions to verify**

Run: `cd firebase-functions && npm run build`
Expected: No compilation errors.

- [ ] **Step 4: Commit**

```bash
git add firebase-functions/src/merch/handleMerchWebhook.ts firebase-functions/src/index.ts
git commit -m "feat(store): add Stripe webhook handler for order recording"
```

---

## Task 10: Firestore Security Rules

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Add products and orders rules**

Add these rules inside the `match /databases/{database}/documents` block:

```
    // ── STORE: PRODUCTS (public read) ──
    match /products/{productId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // ── STORE: ORDERS (admin only, Cloud Function uses Admin SDK) ──
    match /orders/{orderId} {
      allow read: if isAdmin();
      allow write: if isAdmin();
    }
```

- [ ] **Step 2: Commit**

```bash
git add firestore.rules
git commit -m "feat(store): add Firestore security rules for products and orders"
```

---

## Task 11: TypeScript Check & Build Verification

- [ ] **Step 1: Run type check**

Run: `npm run check`
Expected: No new errors introduced by store feature.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Clean build with store routes included.

- [ ] **Step 3: Run existing tests**

Run: `npm test`
Expected: All existing tests still pass.

- [ ] **Step 4: Fix any issues found in steps 1-3**

- [ ] **Step 5: Final commit if fixes were needed**

```bash
git add -A
git commit -m "fix(store): resolve build/type issues"
```

---

## Post-Implementation Checklist

These are manual steps for Austen (not code tasks):

- [ ] Create Stripe Products + Prices in Stripe Dashboard for each deck
- [ ] Set `stripe.secret_key` in Firebase Functions config: `firebase functions:config:set stripe.secret_key="sk_live_..."`
- [ ] Set `stripe.webhook_secret` in Firebase Functions config
- [ ] Set `app.base_url` in Firebase Functions config: `firebase functions:config:set app.base_url="https://tkaflowarts.com"`
- [ ] Deploy Cloud Functions: `firebase deploy --only functions:createMerchCheckout,handleMerchWebhook`
- [ ] Deploy Firestore rules: `firebase deploy --only firestore:rules`
- [ ] Register webhook endpoint in Stripe Dashboard: `https://us-central1-the-kinetic-alphabet.cloudfunctions.net/handleMerchWebhook`
- [ ] Enable "Successful payments" email notification in Stripe Dashboard
- [ ] Seed `products/` collection in Firestore with product documents
- [ ] Pre-render card preview images and upload to Cloud Storage
- [ ] Upload `coverImageUrl` values to product documents

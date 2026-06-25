<!-- src/lib/features/store/StorePage.svelte -->
<script lang="ts">

import { getMerchCheckoutCreator } from "$lib/features/store/get-merch-checkout-creator";
import { getProductLoader } from "$lib/features/store/get-product-loader";
  import { onMount } from "svelte";
  import { createStoreState } from "./state/store-state.svelte";
  import { setStoreContext } from "./context/store-context";
  import ProductCard from "./components/ProductCard.svelte";

  // showDrafts: the admin "play with it" view loads every product including
  // drafts and sold-out. Public buyers get active-only.
  let { showDrafts = false }: { showDrafts?: boolean } = $props();

  const state = createStoreState(
    getProductLoader(),
    getMerchCheckoutCreator()
  );

  setStoreContext({ state });

  onMount(() => {
    state.loadProducts(showDrafts);
  });
</script>

<div class="store-page">
  <main class="store-content">
    <section class="hero">
      <h1>Shop</h1>
      <p class="hero-subtitle">
        Printed Choreo card decks, guides, and flow props. Sleeve-compatible, tradeable, collectible.
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
    padding-top: 64px; /* clear the fixed SiteHeader */
    /* Transparent so the /shop cosmic BackgroundHost shows through. */
    background: transparent;
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

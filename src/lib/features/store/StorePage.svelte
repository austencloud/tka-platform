<!-- src/lib/features/store/StorePage.svelte -->
<script lang="ts">
  import { getMerchCheckoutCreator } from "$lib/features/store/get-merch-checkout-creator";
  import { getProductLoader } from "$lib/features/store/get-product-loader";
  import { createStoreState } from "./state/store-state.svelte";
  import { setStoreContext } from "./context/store-context";
  import ProductCard from "./components/ProductCard.svelte";
  import type { ProductType } from "./domain/models/product";

  // showDrafts: the admin "play with it" view loads every product including
  // drafts and sold-out. Public buyers get active-only.
  let { showDrafts = false }: { showDrafts?: boolean } = $props();

  const state = createStoreState(getProductLoader(), getMerchCheckoutCreator());

  setStoreContext({ state });

  // Prime synchronously (cache-first) so a back-navigation paints the grid on the
  // first frame — the view-transition reverse morph needs the target cards present
  // at the moment SvelteKit snapshots the new page. The first visit still fetches.
  state.loadProducts(showDrafts);

  // Product type -> section. Only non-empty groups render, in this order, so a
  // deck, a guide, and a mug never share one undifferentiated grid.
  const SECTIONS: { type: ProductType; label: string }[] = [
    { type: "physical-deck", label: "Choreo Card Decks" },
    { type: "sampler-pack", label: "Sampler Packs" },
    { type: "guide", label: "Guides" },
    { type: "material", label: "Props & Materials" },
    { type: "digital", label: "Digital" },
  ];

  const groups = $derived(
    SECTIONS.map((s) => ({
      ...s,
      items: state.products.filter((p) => p.type === s.type),
    })).filter((g) => g.items.length > 0)
  );
</script>

<div class="store-page">
  <main class="store-content">
    <section class="hero">
      <h1>Shop</h1>
      <p class="hero-subtitle">
        Printed decks, guides, and props from the Kinetic Alphabet.
      </p>
    </section>

    {#if state.isLoading}
      <div class="loading">Loading products...</div>
    {:else if state.error}
      <div class="error">{state.error}</div>
    {:else if state.products.length === 0}
      <div class="empty">No products available yet. Check back soon.</div>
    {:else}
      {#each groups as group (group.type)}
        <section class="product-section">
          <h2 class="section-title">{group.label}</h2>
          <div class="product-grid">
            {#each group.items as product, i (product.id)}
              <ProductCard {product} index={i} />
            {/each}
          </div>
        </section>
      {/each}
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
    /* Fill big screens intelligently: a wide fluid band (up to 2400px) instead of
       a 1200px column that miniaturized the grid on 4K. */
    max-width: min(2400px, 94vw);
    margin: 0 auto;
    padding: 40px clamp(24px, 4vw, 64px) 80px;
  }

  .hero {
    text-align: center;
    margin-bottom: 48px;
  }

  .hero h1 {
    font-size: clamp(2rem, 3vw, 3rem);
    font-weight: 700;
    margin: 0 0 12px;
  }

  .hero-subtitle {
    font-size: var(--font-size-lg, 18px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    margin: 0 0 8px;
  }

  .product-section {
    margin-bottom: 56px;
  }

  .section-title {
    font-size: var(--font-size-lg, 18px);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
    margin: 0 0 20px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .product-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 28px;
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

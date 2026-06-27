<!-- src/lib/features/store/ProductDetailPage.svelte -->
<script lang="ts">

import { getMerchCheckoutCreator } from "$lib/features/store/get-merch-checkout-creator";
import { getProductLoader } from "$lib/features/store/get-product-loader";
  import { onMount } from "svelte";
  import { createStoreState } from "./state/store-state.svelte";
  import { setStoreContext } from "./context/store-context";
  import CardMockupPreview from "./components/CardMockupPreview.svelte";
  import SampleCardCarousel from "./components/SampleCardCarousel.svelte";
  import BuyButton from "./components/BuyButton.svelte";

  interface Props {
    productId: string;
  }

  let { productId }: Props = $props();

  const state = createStoreState(
    getProductLoader(),
    getMerchCheckoutCreator()
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
  <main class="detail-content">
    {#if state.isLoading}
      <div class="loading">Loading product details...</div>
    {:else if state.error}
      <div class="error">{state.error}</div>
    {:else if state.selectedProduct}
      {@const product = state.selectedProduct}
      <a href="/shop" class="back-button">
        <i class="fas fa-arrow-left" aria-hidden="true"></i> All Products
      </a>

      <div class="detail-layout">
        <div class="preview-column">
          <CardMockupPreview
            coverImageUrl={product.coverImageUrl}
            productName={product.name}
            viewTransitionName={`product-${product.id}`}
          />
        </div>

        <div class="info-column">
          <h1>{product.name}</h1>
          {#if product.cardCount}
            <p class="meta">{product.cardCount} cards, poker size (2.5" x 3.5")</p>
          {/if}
          <p class="description">{product.description}</p>
          <p class="price">{formattedPrice}</p>
          {#if product.preorder}
            <p class="preorder-note">
              Pre-order.{product.shipBy ? ` Ships ${product.shipBy}.` : ""} You pay now and it ships once printed.
            </p>
          {/if}
          <BuyButton productId={product.id} />
          {#if state.checkoutError}
            <p class="checkout-error" role="alert">{state.checkoutError}</p>
          {/if}
        </div>
      </div>

      <SampleCardCarousel
        imageUrls={product.previewImageUrls}
        productName={product.name}
      />
    {:else}
      <div class="error">Product not found.</div>
    {/if}
  </main>
</div>

<style>
  .detail-page {
    min-height: 100vh;
    padding-top: 64px; /* clear the fixed SiteHeader */
    /* Transparent so the /shop cosmic background shows through (no dark panel). */
    background: transparent;
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

  .back-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 18px;
    margin-bottom: 24px;
    border-radius: 999px;
    border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.15));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #ffffff);
    text-decoration: none;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    transition: background 0.2s, border-color 0.2s;
  }

  .back-button:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-border-strong, rgba(255, 255, 255, 0.3));
  }

  @media (prefers-reduced-motion: reduce) {
    .back-button {
      transition: none;
    }
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

  .preorder-note {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-warning, #f59e0b);
    margin: 0 0 16px;
  }

  .checkout-error {
    margin-top: 12px;
    text-align: center;
    font-size: var(--font-size-sm, 14px);
    color: var(--semantic-error, #ef4444);
  }

  .loading, .error {
    text-align: center;
    padding: 48px;
  }

  .error {
    color: var(--semantic-error, #ef4444);
  }
</style>

<!-- src/lib/features/store/ProductDetailPage.svelte -->
<script lang="ts">

import { getMerchCheckoutCreator } from "$lib/features/store/get-merch-checkout-creator";
import { getProductLoader } from "$lib/features/store/get-product-loader";
  import { onMount } from "svelte";
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
  <StoreHeader />

  <main class="detail-content">
    {#if state.isLoading}
      <div class="loading">Loading product details...</div>
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
    {:else}
      <div class="error">Product not found.</div>
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

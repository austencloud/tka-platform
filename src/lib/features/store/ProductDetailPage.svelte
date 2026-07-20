<!-- src/lib/features/store/ProductDetailPage.svelte -->
<script lang="ts">

import * as singleBuyCheckoutCreator from "$lib/features/store/services/single-buy-checkout-creator";
import { getProductLoader } from "$lib/features/store/get-product-loader";
  import { onMount } from "svelte";
  import { createStoreState } from "./state/store-state.svelte";
  import { setStoreContext } from "./context/store-context";
  import BookCoverArt from "./components/BookCoverArt.svelte";
  import CardMockupPreview from "./components/CardMockupPreview.svelte";
  import SampleCardCarousel from "./components/SampleCardCarousel.svelte";
  import BuyButton from "./components/BuyButton.svelte";
  import LoopChips from "./components/LoopChips.svelte";
  import PropPicker from "./components/PropPicker.svelte";
  import PreorderPriceNote from "./components/PreorderPriceNote.svelte";
  import { captureMorphSource } from "./transitions/shop-morph";
  import { activePriceCents, preorderWindowOpen, formatUsd } from "./domain/preorder-pricing";
  import type { Product } from "./domain/models/product";
  import { DEFAULT_SHOP_PROP } from "./domain/shop-prop-options";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  interface Props {
    productId: string;
    /** Seeded by the route load() so the detail renders data-ready and the
        view-transition morph lands cleanly, with no loading-state flash. */
    initialProduct?: Product | null;
  }

  let { productId, initialProduct = null }: Props = $props();

  const store = createStoreState(
    getProductLoader(),
    singleBuyCheckoutCreator,
    initialProduct
  );

  setStoreContext({ state: store });

  let propType = $state<PropType>(DEFAULT_SHOP_PROP);

  // Read once at mount — the swap boundary is a fixed instant, no ticking needed.
  const now = Date.now();
  let formattedPrice = $derived(
    store.selectedProduct ? formatUsd(activePriceCents(store.selectedProduct, now)) : ""
  );

  onMount(() => {
    // Already seeded by the route load(); only fetch if we arrived without it.
    if (!initialProduct) store.loadProduct(productId);
  });
</script>

<div class="detail-page">
  <main class="detail-content">
    {#if store.isLoading}
      <div class="loading">Loading product details...</div>
    {:else if store.error}
      <div class="error">{store.error}</div>
    {:else if store.selectedProduct}
      {@const product = store.selectedProduct}
      <a
        href="/shop"
        class="back-button"
        onclick={() => captureMorphSource(product.id)}
      >
        <i class="fas fa-arrow-left" aria-hidden="true"></i> All Products
      </a>

      <div class="detail-layout">
        <div class="preview-column">
          {#if product.type === "guide"}
            <!-- The book has no card art; show its typographic cover instead of
                 an empty card-mockup box. -->
            <div class="book-preview">
              <BookCoverArt width="clamp(200px, 22vw, 300px)" />
            </div>
          {:else}
            <CardMockupPreview
              coverImageUrl={product.coverImageUrl}
              productName={product.name}
              morphId={product.id}
              coverSequence={product.coverSequence}
              coverCards={product.coverCards}
              deckId={product.deckId}
              {propType}
            />
          {/if}
        </div>

        <div class="info-column">
          <h1>{product.name}</h1>
          {#if product.loopComponents?.length}
            <LoopChips components={product.loopComponents} />
          {/if}
          {#if product.cardCount}
            <p class="meta">{product.cardCount} cards, poker size (2.5" x 3.5")</p>
          {/if}
          <p class="description">{product.description}</p>
          <p class="price">{formattedPrice}</p>
          {#if preorderWindowOpen(product, now)}
            <PreorderPriceNote {product} />
          {/if}
          {#if product.preorder}
            <p class="preorder-note">
              Pre-order.{product.shipBy ? ` Ships ${product.shipBy}.` : ""} You pay now and it ships once printed.
            </p>
          {/if}
          {#if product.type === "physical-deck"}
            <div class="prop-field">
              <span class="prop-field-label">Prop</span>
              <PropPicker value={propType} onchange={(p) => (propType = p)} />
            </div>
          {/if}
          <BuyButton
            {product}
            propType={product.type === "physical-deck" ? propType : undefined}
          />
          {#if product.stripePriceId}
            <BuyButton
              {product}
              propType={product.type === "physical-deck" ? propType : undefined}
              mode="add"
              label="Add to cart"
            />
          {/if}
          {#if store.checkoutError}
            <p class="checkout-error" role="alert">{store.checkoutError}</p>
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
    /* rem so the product page rides the lockstep root ramp (src/app.css) —
       /shop/* is a marketing route, so it ramps 1680→3840. Was a hard 1000px
       with no big-screen tier of any kind: a 1000px column stranded in a
       2350px window, on the page people actually buy from. 62.5rem is that
       same 1000px at a 16px root, 1500px at the 24px root. */
    max-width: 62.5rem;
    margin: 0 auto;
    padding: 40px 24px;
  }

  .detail-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 48px;
    align-items: start;
  }

  .book-preview {
    display: grid;
    place-items: center;
    min-height: 420px;
    border-radius: 16px;
    background: radial-gradient(
      circle at 50% 42%,
      rgba(255, 255, 255, 0.05),
      rgba(255, 255, 255, 0.015)
    );
  }

  @media (max-width: 768px) {
    .detail-layout {
      grid-template-columns: 1fr;
      gap: 24px;
    }
  }

  /* Choreographed reveal: the cover lands first (the view-transition morph), then
     the info column's children cascade in one after another — a staggered show,
     not a single block fade. Pure CSS so it needs no reactive state (the local
     `state` store would shadow the $state rune). Transform/opacity only —
     compositor, no layout shift. The stagger steps by DOM position; optional
     children (meta, pre-order note, checkout error) just take their slot's delay. */
  .info-column > * {
    animation: item-rise 460ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .info-column > :nth-child(1) {
    animation-delay: 200ms;
  }
  .info-column > :nth-child(2) {
    animation-delay: 260ms;
  }
  .info-column > :nth-child(3) {
    animation-delay: 320ms;
  }
  .info-column > :nth-child(4) {
    animation-delay: 380ms;
  }
  .info-column > :nth-child(5) {
    animation-delay: 440ms;
  }
  .info-column > :nth-child(6) {
    animation-delay: 500ms;
  }
  .info-column > :nth-child(n + 7) {
    animation-delay: 560ms;
  }

  @keyframes item-rise {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .info-column > * {
      animation: none;
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
    /* Leads the cascade: surfaces just before the info children (120ms). */
    animation: item-rise 460ms 120ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .back-button:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-border-strong, rgba(255, 255, 255, 0.3));
  }

  @media (prefers-reduced-motion: reduce) {
    .back-button {
      transition: none;
      animation: none;
    }
  }

  h1 {
    font-family: var(--page-title-font, "Fraunces", Georgia, serif);
    font-style: italic;
    font-weight: 700;
    font-variation-settings: "opsz" 144, "wght" 700, "SOFT" 0, "WONK" 1;
    font-size: 1.75rem;
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

  .prop-field {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0 0 20px;
  }

  .prop-field-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
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

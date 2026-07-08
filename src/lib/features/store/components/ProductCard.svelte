<!-- src/lib/features/store/components/ProductCard.svelte -->
<script lang="ts">
  import type { Product } from "../domain/models/product";
  import CardMockupPreview from "./CardMockupPreview.svelte";
  import { captureMorphSource } from "../transitions/shop-morph";

  interface Props {
    product: Product;
    /** Grid position, used to stagger the entrance animation. */
    index?: number;
  }

  let { product, index = 0 }: Props = $props();

  let formattedPrice = $derived(
    `$${(product.price / 100).toFixed(2)}`
  );
</script>

<a
  href="/shop/{product.id}"
  class="product-card"
  style:--enter-delay="{index * 40}ms"
  onclick={() => captureMorphSource(product.id)}
>
  <CardMockupPreview
    coverImageUrl={product.coverImageUrl}
    productName={product.name}
    morphId={product.id}
    coverSequence={product.coverSequence}
  />
  <div class="card-info">
    <h3 class="card-name">{product.name}</h3>
    {#if product.cardCount}
      <p class="card-meta">{product.cardCount} cards</p>
    {/if}
    <p class="card-price">{formattedPrice}</p>
    {#if product.preorder}
      <p class="card-preorder">
        Pre-order{product.shipBy ? ` · ships ${product.shipBy}` : ""}
      </p>
    {/if}
  </div>
</a>

<style>
  .product-card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 12px;
    text-decoration: none;
    color: inherit;
    border-radius: 16px;
    padding: 12px;
    /* Compositor-only: only transform animates per frame. Background is a cheap
       one-off paint on hover; the lift shadow is an opacity fade on ::after. */
    transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), background 0.2s;
    will-change: transform;
  }

  /* Lift shadow as an opacity-faded pseudo-element (box-shadow itself is paint, so
     we fade a pre-painted layer instead of animating the shadow). */
  .product-card::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 16px;
    box-shadow: 0 14px 32px rgba(0, 0, 0, 0.32);
    opacity: 0;
    transition: opacity 0.18s ease;
    pointer-events: none;
  }

  @keyframes card-enter {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .product-card:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    transform: translateY(-4px);
  }
  .product-card:hover::after {
    opacity: 1;
  }
  .product-card:active {
    transform: translateY(-1px) scale(0.985);
    transition-duration: 0.08s;
  }

  @media (prefers-reduced-motion: reduce) {
    .product-card,
    .product-card::after {
      transition: none;
    }
    .product-card:hover,
    .product-card:active {
      transform: none;
    }
    .card-info {
      animation: none;
    }
  }

  .card-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    /* The entrance animates the TEXT block only, never the cover above it: the
       cover carries view-transition-name and must sit still at its rest geometry
       when the reverse morph captures it, or the morph lands on a mid-fade target.
       --enter-delay (set on the parent <a>) staggers each card; it inherits here. */
    animation: card-enter 280ms cubic-bezier(0.16, 1, 0.3, 1) both;
    animation-delay: var(--enter-delay, 0ms);
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

  .card-preorder {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    margin: 4px 0 0;
    color: var(--theme-warning, #f59e0b);
  }
</style>

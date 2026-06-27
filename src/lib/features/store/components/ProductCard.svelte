<!-- src/lib/features/store/components/ProductCard.svelte -->
<script lang="ts">
  import type { Product } from "../domain/models/product";
  import CardMockupPreview from "./CardMockupPreview.svelte";

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
>
  <CardMockupPreview
    coverImageUrl={product.coverImageUrl}
    productName={product.name}
    viewTransitionName={`product-${product.id}`}
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
    display: flex;
    flex-direction: column;
    gap: 12px;
    text-decoration: none;
    color: inherit;
    border-radius: 16px;
    padding: 12px;
    transition: background 0.2s;
    animation: card-enter 280ms cubic-bezier(0.16, 1, 0.3, 1) both;
    animation-delay: var(--enter-delay, 0ms);
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
  }

  @media (prefers-reduced-motion: reduce) {
    .product-card {
      transition: none;
      animation: none;
    }
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

  .card-preorder {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    margin: 4px 0 0;
    color: var(--theme-warning, #f59e0b);
  }
</style>

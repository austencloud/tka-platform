<!-- src/lib/features/store/components/ProductCard.svelte -->
<script lang="ts">
  import type { Product } from "../domain/models/product";
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

  @media (prefers-reduced-motion: reduce) {
    .product-card {
      transition: none;
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
</style>

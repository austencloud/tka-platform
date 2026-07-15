<!--
  PreorderPriceNote — "Preorder price — goes to $45 on September 30."

  Shown on buy surfaces while the preorder window is open. Presence is decided by
  the parent (via preorderWindowOpen) at page load and does not toggle mid-session,
  so a plain conditional render is layout-shift-safe here.
-->
<script lang="ts">
  import type { Product } from "../domain/models/product";
  import { formatUsd, cutoffLabel } from "../domain/preorder-pricing";

  interface Props {
    product: Product;
  }
  let { product }: Props = $props();

  const regular = $derived(product.regularPrice != null ? formatUsd(product.regularPrice) : "");
  const when = $derived(cutoffLabel(product.preorderPriceCutoff));
</script>

{#if regular && when}
  <p class="preorder-price-note">
    <i class="fas fa-clock" aria-hidden="true"></i>
    <span>Preorder price — goes to {regular} on {when}.</span>
  </p>
{/if}

<style>
  .preorder-price-note {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-warning, #f59e0b);
    margin: 0 0 16px;
  }
</style>

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
    Opening checkout...
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
    color: var(--theme-text-on-accent, #fff);
    cursor: pointer;
    transition: opacity 0.2s;
  }

  @media (prefers-reduced-motion: reduce) {
    .buy-button {
      transition: none;
    }
  }

  .buy-button:hover:not(:disabled) {
    opacity: 0.9;
  }

  .buy-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>

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
    <span class="spinner" aria-hidden="true"></span>
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
    /* Compositor-only: only transform animates per interaction frame. */
    transition: transform 0.12s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s;
    will-change: transform;
  }

  .buy-button:hover:not(:disabled) {
    opacity: 0.95;
    transform: translateY(-2px);
  }

  .buy-button:active:not(:disabled) {
    transform: translateY(0) scale(0.98);
    transition-duration: 0.06s;
  }

  .buy-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinner {
    display: inline-block;
    width: 1em;
    height: 1em;
    margin-right: 0.5em;
    vertical-align: -0.15em;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .buy-button {
      transition: none;
    }
    .buy-button:hover:not(:disabled),
    .buy-button:active:not(:disabled) {
      transform: none;
    }
    .spinner {
      animation-duration: 1.4s;
    }
  }
</style>

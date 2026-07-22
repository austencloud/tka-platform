<!--
  CartButton — cart affordance + count badge. Rendered ONLY inside the /shop
  layout header, never in app-wide navigation (deliberate: no global commerce
  chrome — spec 2026-07-13-shop-cart-order-doc-design).
-->
<script lang="ts">
  import type { ShopCart } from "../state/shop-cart.svelte";
  import { trackCartOpened } from "../analytics/shop-funnel";
  interface Props { cart: ShopCart; onOpen: () => void; }
  let { cart, onOpen }: Props = $props();

  // Not a funnel step — it separates "opened the cart and left" from "never
  // opened it", which is the difference between a pricing problem and a
  // discovery problem.
  function open() {
    // Open first, measure second. Nothing about telling PostHog the cart was
    // opened should be able to stop the cart from opening.
    onOpen();
    trackCartOpened(cart.count, cart.subtotal);
  }
</script>

<button class="cart-button" aria-label="Open cart ({cart.count} items)" onclick={open}>
  <i class="fas fa-shopping-bag" aria-hidden="true"></i>
  {#if cart.count > 0}
    <span class="badge" aria-hidden="true">{cart.count}</span>
  {/if}
</button>

<style>
  .cart-button {
    position: relative; width: 44px; height: 44px; border-radius: 12px; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center; font-size: 18px;
    border: 1px solid var(--theme-stroke, rgba(255,255,255,0.14));
    background: var(--theme-card-bg, rgba(255,255,255,0.06));
    color: var(--theme-text, #fff);
  }
  .badge {
    position: absolute; top: -6px; right: -6px; min-width: 20px; height: 20px; padding: 0 5px;
    border-radius: 10px; display: inline-flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums;
    background: var(--theme-accent, #60a5fa); color: var(--theme-text-on-accent, #fff);
  }
</style>

<!--
  StickyPremiumCTA - Floating bottom CTA for mobile conversion
-->
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  interface Props {
    price: number;
    period: string;
    isLoading?: boolean;
    disabled?: boolean;
    onSubscribe: () => void;
  }

  let {
    price,
    period,
    isLoading = false,
    disabled = false,
    onSubscribe,
  }: Props = $props();
</script>

<div class="sticky-cta">
  <div class="price-info">
    <span class="price">{t('premium_sticky_price', { price, period })}</span>
  </div>
  <button
    class="cta-button"
    onclick={onSubscribe}
    disabled={isLoading || disabled}
  >
    {#if isLoading}
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
    {:else}
      <span>{t('premium_sticky_cta_button')}</span>
    {/if}
  </button>
</div>

<style>
  .sticky-cta {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-md, 16px);
    padding: var(--spacing-md, 16px);
    background: var(
      --gradient-primary,
      linear-gradient(
        135deg,
        var(--theme-accent) 0%,
        var(--theme-accent-strong) 100%
      )
    );
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(10px);
    z-index: var(--z-toast);
    box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.15);
  }

  .price-info {
    display: flex;
    flex-direction: column;
  }

  .price {
    font-size: var(--font-size-xl);
    font-weight: 700;
    color: white;
    line-height: 1;
  }

  .cta-button {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm, 8px);
    padding: 0 var(--spacing-xl, 32px);
    min-height: var(--min-touch-target, 48px);
    background: white;
    color: var(--theme-accent);
    border: none;
    border-radius: 24px;
    font-size: var(--font-size-base);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast, var(--duration-fast) ease);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .cta-button:active:not(:disabled) {
    transform: scale(0.97);
  }

  .cta-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Hide on desktop */
  @media (min-width: 768px) {
    .sticky-cta {
      display: none;
    }
  }
</style>

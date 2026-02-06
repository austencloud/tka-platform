<!--
  PriceHighlight - Quick price display for above the fold on mobile
-->
<script lang="ts">
  interface Props {
    price: number;
    period: string;
  }

  let { price, period }: Props = $props();
</script>

<div class="price-highlight">
  <div class="price-badge">
    <span class="amount">${price}</span>
    <span class="period">/{period}</span>
  </div>
  <p class="tagline">Create freely • Support TKA's growth</p>
</div>

<style>
  .price-highlight {
    text-align: center;
    padding: var(--spacing-lg, 24px) var(--spacing-md, 16px);
    background: var(
      --gradient-primary,
      linear-gradient(
        135deg,
        var(--theme-accent) 0%,
        var(--theme-accent-strong) 100%
      )
    );
    border-radius: 12px;
    margin-bottom: var(--spacing-lg, 24px);
  }

  .price-badge {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: var(--spacing-xs, 4px);
    margin-bottom: var(--spacing-sm, 8px);
  }

  .amount {
    font-size: clamp(36px, 10vw, 48px);
    font-weight: 700;
    color: white;
    line-height: 1;
  }

  .period {
    font-size: var(--font-size-lg);
    color: rgba(255, 255, 255, 0.8);
  }

  .tagline {
    font-size: var(--font-size-min);
    color: var(--theme-text);
    margin: 0;
  }

  /* Hide on desktop - desktop has full CTA */
  @media (min-width: 768px) {
    .price-highlight {
      display: none;
    }
  }
</style>

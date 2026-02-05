<!-- GuaranteeBadge - Money-back guarantee badge -->
<script lang="ts">
  interface Props {
    days?: number;
    link?: string;
  }

  let { days = 30, link = "/terms#refund-policy" }: Props = $props();
</script>

<div class="guarantee-badge">
  <div class="badge-icon">
    <i class="fas fa-shield-check" aria-hidden="true"></i>
  </div>
  <div class="badge-content">
    <div class="badge-title">{days}-Day Money-Back Guarantee</div>
    <div class="badge-description">
      Not satisfied? Get a full refund within {days} days, no questions asked.
    </div>
    {#if link}
      <a href={link} class="terms-link">View terms</a>
    {/if}
  </div>
</div>

<style>
  .guarantee-badge {
    display: flex;
    gap: var(--spacing-md, 16px);
    padding: var(--spacing-md, 16px);
    background: var(--theme-card-bg);
    border: 2px solid var(--semantic-success, var(--semantic-success));
    border-radius: 12px;
    margin: var(--spacing-md, 16px) 0;
  }

  .badge-icon {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--semantic-success, var(--semantic-success));
    border-radius: 50%;
  }

  .badge-icon i {
    font-size: var(--font-size-2xl);
    color: white;
  }

  .badge-content {
    flex: 1;
  }

  .badge-title {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--theme-text);
    margin-bottom: var(--spacing-xs, 4px);
  }

  .badge-description {
    font-size: var(--font-size-min);
    color: var(--theme-text-dim);
    line-height: 1.5;
  }

  .terms-link {
    display: inline-block;
    margin-top: var(--spacing-xs, 4px);
    font-size: var(--font-size-compact);
    color: var(--theme-accent, var(--theme-accent));
    text-decoration: none;
  }

  .terms-link:hover {
    text-decoration: underline;
  }
</style>

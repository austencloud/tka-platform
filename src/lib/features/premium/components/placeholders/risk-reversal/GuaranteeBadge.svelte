<!-- GuaranteeBadge - Money-back guarantee badge -->
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

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
    <div class="badge-title">{t('premium_guarantee_title', { days })}</div>
    <div class="badge-description">
      {t('premium_guarantee_description', { days })}
    </div>
    {#if link}
      <a href={link} class="terms-link">{t('premium_guarantee_view_terms')}</a>
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

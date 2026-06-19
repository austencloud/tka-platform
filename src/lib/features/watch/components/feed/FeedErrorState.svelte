<!--
  FeedErrorState

  Shown when the feed fails to load. Surfaces the error message and a retry
  affordance so a failed load no longer silently collapses to the empty state.
-->
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte";

  interface Props {
    /** Human-readable error message from the failed load. */
    message?: string | null;
    /** Invoked when the user taps Retry. */
    onRetry?: () => void;
  }

  const { message, onRetry }: Props = $props();
</script>

<div class="feed-error" role="alert">
  <div class="error-icon">
    <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
  </div>
  <p class="error-message">{message ?? t('watch_empty_message')}</p>
  {#if onRetry}
    <button type="button" class="retry-button" onclick={onRetry}>
      <i class="fas fa-rotate-right" aria-hidden="true"></i>
      <span>{t('action_retry')}</span>
    </button>
  {/if}
</div>

<style>
  .feed-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100dvh;
    padding: 48px 24px;
    text-align: center;
    gap: 16px;
  }

  @supports not (height: 100dvh) {
    .feed-error {
      height: var(--viewport-height, 100vh);
    }
  }

  .error-icon {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
  }

  .error-icon i {
    font-size: 32px;
    color: var(--semantic-warning, #f59e0b);
  }

  .error-message {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    max-width: 280px;
  }

  .retry-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
    padding: 10px 20px;
    border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.16));
    border-radius: var(--radius-pill, 999px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: background var(--duration-fast, 150ms) ease;
  }

  .retry-button:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.12));
  }

  @media (prefers-reduced-motion: reduce) {
    .retry-button {
      transition: none;
    }
  }
</style>

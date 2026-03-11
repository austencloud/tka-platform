<!--
  FeedEmptyState

  Shown when the feed has no content.
-->
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte";
</script>

<div class="feed-empty">
  <div class="empty-icon">
    <i class="fas fa-stream" aria-hidden="true"></i>
  </div>
  <h2 class="empty-title">{t('watch_empty_title')}</h2>
  <p class="empty-message">{t('watch_empty_message')}</p>
</div>

<style>
  .feed-empty {
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
    .feed-empty {
      height: var(--viewport-height, 100vh);
    }
  }

  .empty-icon {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
  }

  .empty-icon i {
    font-size: 32px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .empty-title {
    margin: 0;
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    color: var(--theme-text);
  }

  .empty-message {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    max-width: 280px;
  }
</style>

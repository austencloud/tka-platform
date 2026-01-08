<!--
  LibraryHeader.svelte - Personal Library Header

  Compact header showing library identity and key engagement metrics.
  Stats shown inline to avoid redundancy with filter bar counts.
-->
<script lang="ts">
  import type { LibrarySequence } from "../domain/models/LibrarySequence";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  interface Props {
    sequences: LibrarySequence[];
    onOrganize?: () => void;
    isOrganizing?: boolean;
  }

  let { sequences, onOrganize, isOrganizing = false }: Props = $props();

  // Compute stats from sequences
  const stats = $derived(() => {
    const total = sequences.length;
    const favorites = sequences.filter((s) => s.isFavorite).length;

    // Aggregate engagement metrics
    const totalViews = sequences.reduce((sum, s) => sum + (s.viewCount || 0), 0);
    const totalForks = sequences.reduce((sum, s) => sum + (s.forkCount || 0), 0);
    const totalStars = sequences.reduce((sum, s) => sum + (s.starCount || 0), 0);

    return {
      total,
      favorites,
      totalViews,
      totalForks,
      totalStars,
    };
  });

  // Format large numbers (e.g., 1234 -> 1.2K)
  function formatNumber(n: number): string {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  }
</script>

<header class="library-header">
  <div class="header-content">
    <div class="title-section">
      <h1 class="title">
        <i class="fas fa-layer-group" aria-hidden="true"></i>
        {t("library_my_library")}
      </h1>
      {#if stats().total > 0}
        <p class="subtitle">
          <!-- Engagement metrics inline -->
          {#if stats().totalViews > 0}
            <span class="metric">
              <i class="fas fa-eye" aria-hidden="true"></i>
              {formatNumber(stats().totalViews)}
            </span>
          {/if}
          {#if stats().totalForks > 0}
            <span class="metric">
              <i class="fas fa-code-branch" aria-hidden="true"></i>
              {formatNumber(stats().totalForks)}
            </span>
          {/if}
          {#if stats().totalStars > 0}
            <span class="metric">
              <i class="fas fa-star" aria-hidden="true"></i>
              {formatNumber(stats().totalStars)}
            </span>
          {/if}
          {#if stats().totalViews === 0 && stats().totalForks === 0 && stats().totalStars === 0}
            <span class="no-engagement">{t("library_no_engagement")}</span>
          {/if}
        </p>
      {/if}
    </div>

    {#if onOrganize && stats().total > 0}
      <button
        class="organize-btn"
        class:active={isOrganizing}
        onclick={onOrganize}
        aria-label={isOrganizing ? t("library_done_organizing") : t("library_organize_sequences")}
      >
        {#if isOrganizing}
          <i class="fas fa-check" aria-hidden="true"></i>
          <span>{t("action_done")}</span>
        {:else}
          <i class="fas fa-tasks" aria-hidden="true"></i>
          <span>{t("library_organize")}</span>
        {/if}
      </button>
    {/if}
  </div>
</header>

<style>
  .library-header {
    padding: var(--spacing-md) var(--spacing-md);
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--theme-accent) 6%, transparent) 0%,
      transparent 100%
    );
    border-bottom: 1px solid color-mix(in srgb, var(--theme-accent) 12%, transparent);
  }

  .header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-md);
  }

  .title-section {
    flex: 1;
    min-width: 0;
  }

  .title {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--theme-text);
    margin: 0;
  }

  .title i {
    color: var(--theme-accent);
    font-size: 1.1rem;
  }

  .subtitle {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    margin: var(--spacing-xs) 0 0 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim);
  }

  .metric {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .metric i {
    font-size: 0.75rem;
    opacity: 0.7;
  }

  .metric i.fa-star {
    color: rgba(250, 204, 21, 0.9);
  }

  .no-engagement {
    opacity: 0.6;
    font-style: italic;
  }

  .organize-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-md);
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 30%, transparent);
    border-radius: var(--radius-2026-sm, 10px);
    color: var(--theme-accent);
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    min-height: var(--min-touch-target);
  }

  .organize-btn:hover {
    background: color-mix(in srgb, var(--theme-accent) 25%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 50%, transparent);
  }

  .organize-btn.active {
    background: color-mix(in srgb, var(--theme-accent) 30%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 60%, transparent);
  }

  /* Mobile adjustments */
  @media (max-width: 480px) {
    .library-header {
      padding: var(--spacing-sm) var(--spacing-md);
    }

    .title {
      font-size: 1.1rem;
    }

    .organize-btn span {
      display: none;
    }

    .subtitle {
      gap: var(--spacing-sm);
    }
  }
</style>

<!--
  LibraryHeader.svelte - Personal Library Header

  Shows ownership identity and stats that differentiate Library from Gallery.
  This is the first thing users see - makes it clear "this is YOUR space".

  Features:
  - "My Library" branding
  - Quick stats: Total, Public, Private, Favorites
  - Publishing summary (total views, forks)
  - Organize button (enters select mode)
-->
<script lang="ts">
  import type { LibrarySequence } from "../domain/models/LibrarySequence";

  interface Props {
    sequences: LibrarySequence[];
    onOrganize?: () => void;
    isOrganizing?: boolean;
  }

  let { sequences, onOrganize, isOrganizing = false }: Props = $props();

  // Compute stats from sequences
  const stats = $derived(() => {
    const total = sequences.length;
    const publicCount = sequences.filter((s) => s.visibility === "public").length;
    const privateCount = sequences.filter((s) => s.visibility === "private").length;
    const favorites = sequences.filter((s) => s.isFavorite).length;

    // Aggregate engagement metrics
    const totalViews = sequences.reduce((sum, s) => sum + (s.viewCount || 0), 0);
    const totalForks = sequences.reduce((sum, s) => sum + (s.forkCount || 0), 0);
    const totalStars = sequences.reduce((sum, s) => sum + (s.starCount || 0), 0);

    return {
      total,
      publicCount,
      privateCount,
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
        My Library
      </h1>
      {#if stats().total > 0}
        <p class="subtitle">
          {stats().publicCount} published
          {#if stats().totalViews > 0}
            <span class="separator">·</span>
            {formatNumber(stats().totalViews)} views
          {/if}
          {#if stats().totalForks > 0}
            <span class="separator">·</span>
            {formatNumber(stats().totalForks)} forks
          {/if}
        </p>
      {/if}
    </div>

    {#if onOrganize && stats().total > 0}
      <button
        class="organize-btn"
        class:active={isOrganizing}
        onclick={onOrganize}
        aria-label={isOrganizing ? "Done organizing" : "Organize sequences"}
      >
        {#if isOrganizing}
          <i class="fas fa-check" aria-hidden="true"></i>
          <span>Done</span>
        {:else}
          <i class="fas fa-tasks" aria-hidden="true"></i>
          <span>Organize</span>
        {/if}
      </button>
    {/if}
  </div>

  <!-- Quick Stats Row -->
  {#if stats().total > 0}
    <div class="stats-row">
      <div class="stat-chip" title="Total sequences">
        <i class="fas fa-film" aria-hidden="true"></i>
        <span class="stat-value">{stats().total}</span>
        <span class="stat-label">Total</span>
      </div>

      <div class="stat-chip public" title="Published to Gallery">
        <i class="fas fa-globe" aria-hidden="true"></i>
        <span class="stat-value">{stats().publicCount}</span>
        <span class="stat-label">Public</span>
      </div>

      <div class="stat-chip private" title="Private sequences">
        <i class="fas fa-lock" aria-hidden="true"></i>
        <span class="stat-value">{stats().privateCount}</span>
        <span class="stat-label">Private</span>
      </div>

      <div class="stat-chip favorites" title="Your favorites">
        <i class="fas fa-star" aria-hidden="true"></i>
        <span class="stat-value">{stats().favorites}</span>
        <span class="stat-label">Favorites</span>
      </div>
    </div>
  {/if}
</header>

<style>
  .library-header {
    padding: var(--spacing-lg) var(--spacing-md);
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--theme-accent) 8%, transparent) 0%,
      color-mix(in srgb, var(--theme-accent) 2%, transparent) 100%
    );
    border-bottom: 1px solid color-mix(in srgb, var(--theme-accent) 15%, transparent);
  }

  .header-content {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-md);
  }

  .title-section {
    flex: 1;
    min-width: 0;
  }

  .title {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--theme-text);
    margin: 0;
  }

  .title i {
    color: var(--theme-accent);
    font-size: 1.25rem;
  }

  .subtitle {
    margin: var(--spacing-xs) 0 0 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim);
  }

  .separator {
    margin: 0 var(--spacing-xs);
    opacity: 0.5;
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

  /* Stats Row */
  .stats-row {
    display: flex;
    gap: var(--spacing-sm);
    flex-wrap: wrap;
  }

  .stat-chip {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 999px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim);
  }

  .stat-chip i {
    font-size: 0.75rem;
    opacity: 0.7;
  }

  .stat-value {
    font-weight: 600;
    color: var(--theme-text);
  }

  .stat-label {
    opacity: 0.7;
  }

  /* Stat chip variants */
  .stat-chip.public i {
    color: var(--semantic-success);
  }

  .stat-chip.private i {
    color: rgba(156, 163, 175, 0.9);
  }

  .stat-chip.favorites i {
    color: rgba(250, 204, 21, 0.9);
  }

  /* Mobile adjustments */
  @media (max-width: 480px) {
    .library-header {
      padding: var(--spacing-md);
    }

    .title {
      font-size: 1.25rem;
    }

    .organize-btn span {
      display: none;
    }

    .stat-label {
      display: none;
    }

    .stat-chip {
      padding: var(--spacing-xs) var(--spacing-sm);
    }
  }
</style>

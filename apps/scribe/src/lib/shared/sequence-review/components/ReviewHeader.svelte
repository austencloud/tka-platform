<script lang="ts">
  /**
   * Review Header
   *
   * Displays progress stats and filter controls for review workflows.
   */
  import type {
    ReviewStats,
    FilterOption,
  } from "../domain/models/review-models";
  import FontAwesomeIcon from "$lib/shared/foundation/ui/FontAwesomeIcon.svelte";
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    stats: ReviewStats;
    filterMode: string;
    filterOptions: FilterOption[];
    onFilterChange: (mode: string) => void;
    /** Slot for additional header actions */
    actions?: Snippet;
  }

  let {
    title,
    stats,
    filterMode,
    filterOptions,
    onFilterChange,
    actions,
  }: Props = $props();
</script>

<header class="review-header">
  <div class="header-left">
    <h1 class="header-title">{title}</h1>
    <div class="stats">
      <div class="stat">
        <span class="stat-value">{stats.reviewed}</span>
        <span class="stat-label">Reviewed</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat">
        <span class="stat-value">{stats.pending}</span>
        <span class="stat-label">Pending</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat progress">
        <span class="stat-value">{stats.percentComplete}%</span>
        <span class="stat-label">Complete</span>
      </div>
    </div>
  </div>

  <div class="header-center">
    <div class="filter-pills">
      {#each filterOptions as option}
        <button
          class="filter-pill"
          class:active={filterMode === option.id}
          onclick={() => onFilterChange(option.id)}
        >
          {#if option.icon}
            <FontAwesomeIcon icon={option.icon} size="0.85em" />
          {/if}
          {option.label}
          {#if option.count !== undefined}
            <span class="pill-count">{option.count}</span>
          {/if}
        </button>
      {/each}
    </div>
  </div>

  <div class="header-right">
    {#if actions}
      {@render actions()}
    {/if}
  </div>
</header>

<style>
  .review-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-lg);
    padding: var(--spacing-md) var(--spacing-lg);
    background: var(--surface-glass);
    border-bottom: 1px solid var(--theme-stroke);
    flex-shrink: 0;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--spacing-lg);
  }

  .header-title {
    margin: 0;
    font-size: var(--font-size-xl);
    font-weight: 700;
    white-space: nowrap;
  }

  .stats {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .stat-value {
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--foreground);
  }

  .stat-label {
    font-size: var(--font-size-xs);
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .stat.progress .stat-value {
    color: #4ade80;
  }

  .stat-divider {
    width: 1px;
    height: 32px;
    background: var(--theme-stroke);
  }

  .header-center {
    flex: 1;
    display: flex;
    justify-content: center;
  }

  .filter-pills {
    display: flex;
    gap: var(--spacing-xs);
    background: var(--surface-dark);
    padding: 4px;
    border-radius: 10px;
  }

  .filter-pill {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-md);
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--muted-foreground);
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .filter-pill:hover {
    background: var(--surface-color);
    color: var(--foreground);
  }

  .filter-pill.active {
    background: var(--gradient-primary);
    color: white;
  }

  .pill-count {
    padding: 0 6px;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    font-size: var(--font-size-xs);
  }

  .header-right {
    display: flex;
    gap: var(--spacing-sm);
  }

  @media (max-width: 1024px) {
    .review-header {
      flex-wrap: wrap;
    }

    .header-center {
      order: 3;
      width: 100%;
      justify-content: flex-start;
    }

    .stats {
      display: none;
    }
  }
</style>

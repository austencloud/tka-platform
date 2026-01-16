<!--
VariationGrid.svelte - Displays sequence variations as a selectable grid

Features:
- Virtualized grid with Intersection Observer for lazy rendering
- Score badge overlay on each thumbnail
- Click to select a variation
- Filter and sort controls
- Progress indicator during exploration
-->
<script lang="ts">
  import type {
    ScoredVariation,
    VariationSortOption,
  } from "../state/variation-state.svelte";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";

  // Props
  let {
    variations,
    progress,
    stats,
    selectedVariationId,
    sortBy,
    sortDescending,
    filters,
    onSelect,
    onToggleFilter,
    onSetSortBy,
    onCancel,
  }: {
    variations: ScoredVariation[];
    progress: {
      isExploring: boolean;
      totalExplored: number;
      uniqueFound: number;
      estimatedTotal: number;
      wasCancelled: boolean;
      error: string | null;
    };
    stats: {
      totalUnique: number;
      totalFiltered: number;
      bestScore: number;
      zeroReversalCount: number;
    };
    selectedVariationId: string | null;
    sortBy: VariationSortOption;
    sortDescending: boolean;
    filters: {
      noReversals: boolean;
      highContinuity: boolean;
      matchesMotionPreference: boolean;
    };
    onSelect: (id: string) => void;
    onToggleFilter: (
      key: "noReversals" | "highContinuity" | "matchesMotionPreference"
    ) => void;
    onSetSortBy: (option: VariationSortOption) => void;
    onCancel: () => void;
  } = $props();

  // Track visible items with Intersection Observer
  let visibleItems = $state(new Set<string>());
  let observer: IntersectionObserver | null = null;

  function setupObserver(node: HTMLElement) {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.getAttribute("data-variation-id");
          if (!id) return;

          if (entry.isIntersecting) {
            visibleItems = new Set([...visibleItems, id]);
          }
        });
      },
      {
        root: node,
        rootMargin: "100px",
        threshold: 0,
      }
    );

    return {
      destroy() {
        observer?.disconnect();
      },
    };
  }

  function observeItem(node: HTMLElement) {
    observer?.observe(node);
    return {
      destroy() {
        observer?.unobserve(node);
      },
    };
  }

  // Sort options with labels
  const sortOptions: { value: VariationSortOption; label: string }[] = [
    { value: "score", label: "Score" },
    { value: "reversals", label: "Reversals" },
    { value: "continuity", label: "Continuity" },
    { value: "motionType", label: "Motion" },
  ];

  // Get score display color based on ranking
  function getScoreColor(variation: ScoredVariation): string {
    if (variation.score.total >= stats.bestScore)
      return "var(--semantic-success)";
    if (variation.score.reversalCount === 0) return "var(--theme-accent)";
    return "var(--theme-text-muted)";
  }
</script>

<div class="variation-grid-container">
  <!-- Header with stats and controls -->
  <div class="grid-header">
    <div class="stats-row">
      {#if progress.isExploring}
        <span class="exploring-badge">
          <i class="fas fa-spinner fa-spin"></i>
          Exploring... {progress.uniqueFound} unique found
        </span>
        <button class="cancel-button" onclick={onCancel}>
          <i class="fas fa-times"></i>
          Cancel
        </button>
      {:else if progress.wasCancelled}
        <span class="cancelled-badge">
          Cancelled - {stats.totalUnique} variations found
        </span>
      {:else if progress.error}
        <span class="error-badge">
          <i class="fas fa-exclamation-triangle"></i>
          {progress.error}
        </span>
      {:else if stats.totalUnique > 0}
        <span class="stats-badge">
          {stats.totalFiltered} of {stats.totalUnique} shown
          {#if stats.zeroReversalCount > 0}
            • {stats.zeroReversalCount} with no reversals
          {/if}
        </span>
      {/if}
    </div>

    <!-- Sort controls -->
    {#if stats.totalUnique > 0}
      <div class="sort-controls">
        <span class="control-label">Sort:</span>
        {#each sortOptions as option}
          <button
            class="sort-chip"
            class:active={sortBy === option.value}
            onclick={() => onSetSortBy(option.value)}
          >
            {option.label}
            {#if sortBy === option.value}
              <i class="fas fa-chevron-{sortDescending ? 'down' : 'up'}"></i>
            {/if}
          </button>
        {/each}
      </div>

      <!-- Filter controls -->
      <div class="filter-controls">
        <span class="control-label">Filter:</span>
        <button
          class="filter-chip"
          class:active={filters.noReversals}
          onclick={() => onToggleFilter("noReversals")}
        >
          No Reversals
        </button>
        <button
          class="filter-chip"
          class:active={filters.highContinuity}
          onclick={() => onToggleFilter("highContinuity")}
        >
          High Flow
        </button>
        <button
          class="filter-chip"
          class:active={filters.matchesMotionPreference}
          onclick={() => onToggleFilter("matchesMotionPreference")}
        >
          Motion Match
        </button>
      </div>
    {/if}
  </div>

  <!-- Progress bar during exploration -->
  {#if progress.isExploring && progress.estimatedTotal > 0}
    <div class="progress-bar-container">
      <div
        class="progress-bar"
        style="width: {Math.min(
          100,
          (progress.totalExplored / progress.estimatedTotal) * 100
        )}%"
      ></div>
    </div>
  {/if}

  <!-- Variation grid -->
  {#if variations.length > 0}
    <div class="variation-grid" use:setupObserver>
      {#each variations as variation (variation.id)}
        <button
          class="variation-card"
          class:selected={selectedVariationId === variation.id}
          data-variation-id={variation.id}
          use:observeItem
          onclick={() => onSelect(variation.id)}
        >
          {#if visibleItems.has(variation.id)}
            <!-- Render first beat as thumbnail -->
            <div class="thumbnail">
              {#if variation.sequence.steps[0]}
                <PictographContainer
                  pictographData={variation.sequence.steps[0]}
                  disableTransitions={true}
                />
              {/if}
            </div>

            <!-- Score badge -->
            <div class="score-badge" style="color: {getScoreColor(variation)}">
              {variation.score.total >= 0 ? "+" : ""}{variation.score.total}
            </div>

            <!-- Reversal indicator -->
            {#if variation.score.reversalCount === 0}
              <div class="no-reversal-badge" title="No reversals">
                <i class="fas fa-check"></i>
              </div>
            {:else}
              <div
                class="reversal-count"
                title="{variation.score.reversalCount} reversals"
              >
                {variation.score.reversalCount}
              </div>
            {/if}
          {:else}
            <!-- Placeholder while not visible -->
            <div class="placeholder"></div>
          {/if}
        </button>
      {/each}
    </div>
  {:else if !progress.isExploring && stats.totalUnique === 0}
    <div class="empty-state">
      <i class="fas fa-layer-group"></i>
      <p>No variations to display</p>
      <p class="hint">
        Enter a word and click "Generate All" to explore variations
      </p>
    </div>
  {:else if !progress.isExploring && stats.totalFiltered === 0}
    <div class="empty-state">
      <i class="fas fa-filter"></i>
      <p>No variations match filters</p>
      <p class="hint">Try adjusting or clearing filters</p>
    </div>
  {/if}
</div>

<style>
  .variation-grid-container {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-sm, 8px);
    height: 100%;
    overflow: hidden;
  }

  .grid-header {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-xs, 4px);
    padding: var(--settings-spacing-sm, 8px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: var(--settings-radius-sm, 8px);
  }

  .stats-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--settings-spacing-sm, 8px);
  }

  .stats-badge,
  .exploring-badge,
  .cancelled-badge {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .exploring-badge {
    color: var(--theme-accent, #6366f1);
  }

  .cancelled-badge {
    color: var(--semantic-warning, #f59e0b);
  }

  .error-badge {
    color: var(--semantic-error, #ef4444);
    font-size: var(--font-size-compact, 12px);
  }

  .cancel-button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: var(--semantic-error, #ef4444);
    border: none;
    border-radius: 4px;
    color: white;
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
  }

  .sort-controls,
  .filter-controls {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--settings-spacing-xs, 4px);
  }

  .control-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    margin-right: 4px;
  }

  .sort-chip,
  .filter-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    min-height: 28px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 14px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .sort-chip:hover,
  .filter-chip:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #ffffff);
  }

  .sort-chip.active,
  .filter-chip.active {
    background: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
    color: white;
  }

  .progress-bar-container {
    height: 3px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-bar {
    height: 100%;
    background: var(--theme-accent, #6366f1);
    transition: width 0.2s ease;
  }

  .variation-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: var(--settings-spacing-sm, 8px);
    padding: var(--settings-spacing-sm, 8px);
    overflow-y: auto;
    flex: 1;
  }

  .variation-card {
    position: relative;
    aspect-ratio: 1;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-sm, 8px);
    overflow: hidden;
    cursor: pointer;
    transition: all 0.15s ease;
    padding: 0;
  }

  .variation-card:hover {
    border-color: var(--theme-accent, #6366f1);
    transform: scale(1.02);
  }

  .variation-card.selected {
    border-color: var(--theme-accent, #6366f1);
    box-shadow: 0 0 0 2px var(--theme-accent, #6366f1);
  }

  .thumbnail {
    width: 100%;
    height: 100%;
  }

  .placeholder {
    width: 100%;
    height: 100%;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  }

  .score-badge {
    position: absolute;
    top: 4px;
    left: 4px;
    padding: 2px 6px;
    background: rgba(0, 0, 0, 0.75);
    border-radius: 4px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
  }

  .no-reversal-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--semantic-success, #10b981);
    border-radius: 50%;
    color: white;
    font-size: 10px;
  }

  .reversal-count {
    position: absolute;
    top: 4px;
    right: 4px;
    padding: 2px 6px;
    background: var(--semantic-warning, #f59e0b);
    border-radius: 4px;
    color: white;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--settings-spacing-sm, 8px);
    padding: var(--settings-spacing-xl, 32px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    text-align: center;
  }

  .empty-state i {
    font-size: 32px;
    opacity: 0.5;
  }

  .empty-state p {
    margin: 0;
  }

  .empty-state .hint {
    font-size: var(--font-size-compact, 12px);
    opacity: 0.7;
  }

  /* Mobile adjustments */
  @media (max-width: 480px) {
    .variation-grid {
      grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
    }

    .score-badge,
    .reversal-count {
      font-size: 10px;
      padding: 1px 4px;
    }

    .no-reversal-badge {
      width: 14px;
      height: 14px;
      font-size: 8px;
    }
  }
</style>

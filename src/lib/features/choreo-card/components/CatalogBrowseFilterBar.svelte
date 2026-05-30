<script lang="ts">
  import type { CatalogBrowseState } from "../state/catalog-browse-state.svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import FilterChipRow from "$lib/features/browse/sequences/filtering/components/inline-filter/FilterChipRow.svelte";
  import { LOOP_TYPE_LABELS } from "$lib/shared/foundation/domain/models/generation/circular-models";
  import { TND_FAMILY_LABELS } from "../state/catalog-browse-types";

  interface Props {
    state: CatalogBrowseState;
  }

  const { state: catalogState }: Props = $props();

  let expanded = $state(true);

  function loopTypeLabel(type: string): string {
    return (LOOP_TYPE_LABELS as Record<string, string>)[type] ?? capitalize(type);
  }

  function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function formatTurn(turn: string): string {
    const m = turn.match(/^uniform[- ](\d+(?:\.\d+)?)t$/i);
    return m ? `${m[1]}T` : capitalize(turn.replace(/-/g, ' '));
  }

  const chipColor = $derived(catalogState.collection === 'TnD' ? '#b763cd' : '#63b7cd');

  const hasActiveFilters = $derived(
    catalogState.filters.loopTypes.length > 0 ||
    catalogState.filters.tndFamilies.length > 0 ||
    catalogState.filters.sliceTypes.length > 0 ||
    catalogState.filters.gridModes.length > 0 ||
    catalogState.filters.stepCounts.length > 0 ||
    catalogState.filters.turnPatterns.length > 0 ||
    catalogState.filters.reversalPatterns.length > 0
  );


</script>

<div class="filter-bar">
  <div class="filter-header">
    <div class="collection-toggle">
      <button
        class="collection-pill"
        class:active={catalogState.collection === 'LOOPs'}
        onclick={() => catalogState.setCollection('LOOPs')}
        type="button"
        aria-label="Browse LOOPs collection"
      >LOOPs</button>
      <button
        class="collection-pill tnd"
        class:active={catalogState.collection === 'TnD'}
        onclick={() => catalogState.setCollection('TnD')}
        type="button"
        aria-label="Browse TnD collection"
      >TnD</button>
    </div>

    {#if catalogState.collection === 'TnD'}
      <div class="tnd-view-toggle" role="radiogroup" aria-label="TnD view mode">
        <button
          class="view-pill"
          class:active={catalogState.tndViewMode === 'turns'}
          type="button"
          role="radio"
          aria-checked={catalogState.tndViewMode === 'turns'}
          onclick={() => catalogState.setTnDViewMode('turns')}
        >By Turns</button>
        <button
          class="view-pill"
          class:active={catalogState.tndViewMode === 'family'}
          type="button"
          role="radio"
          aria-checked={catalogState.tndViewMode === 'family'}
          onclick={() => catalogState.setTnDViewMode('family')}
        >By Family</button>
      </div>
    {/if}

    <span class="catalog-count">{catalogState.totalCount} catalogs</span>

    <button
      class="collapse-toggle mobile-only"
      onclick={() => { expanded = !expanded; }}
      type="button"
      aria-label={expanded ? 'Collapse filters' : 'Expand filters'}
    >
      <i class="fas fa-chevron-{expanded ? 'up' : 'down'}" aria-hidden="true"></i>
    </button>
  </div>

  {#if expanded && catalogState.collection === 'LOOPs'}
    <div class="filter-rows">
      <FilterChipRow>
        {#each catalogState.availableFilters.loopTypes as type (type)}
          <FilterChipBase
            label={loopTypeLabel(type)}
            active={catalogState.filters.loopTypes.includes(type)}
            mode="toggle"
            chipColor={chipColor}
            onclick={() => catalogState.toggleFilter('loopTypes', type)}
          />
        {/each}
      </FilterChipRow>

      <FilterChipRow>
        {#each catalogState.availableFilters.sliceTypes as slice (slice)}
          <FilterChipBase
            label={capitalize(slice)}
            active={catalogState.filters.sliceTypes.includes(slice)}
            mode="toggle"
            chipColor={chipColor}
            onclick={() => catalogState.toggleFilter('sliceTypes', slice)}
          />
        {/each}

        {#if catalogState.availableFilters.gridModes.length > 1}
          <span class="chip-divider" aria-hidden="true">·</span>
          {#each catalogState.availableFilters.gridModes as grid (grid)}
            <FilterChipBase
              label={capitalize(grid)}
              active={catalogState.filters.gridModes.includes(grid)}
              mode="toggle"
              chipColor={chipColor}
              onclick={() => catalogState.toggleFilter('gridModes', grid)}
            />
          {/each}
        {/if}

        {#if catalogState.availableFilters.stepCounts.length > 1}
          <span class="chip-divider" aria-hidden="true">·</span>
          {#each catalogState.availableFilters.stepCounts as count (count)}
            <FilterChipBase
              label={String(count)}
              active={catalogState.filters.stepCounts.includes(count)}
              mode="toggle"
              chipColor={chipColor}
              onclick={() => catalogState.toggleFilter('stepCounts', count)}
            />
          {/each}
        {/if}

        {#if catalogState.availableFilters.turnPatterns.length > 1}
          <span class="chip-divider" aria-hidden="true">·</span>
          {#each catalogState.availableFilters.turnPatterns as turn (turn)}
            <FilterChipBase
              label={formatTurn(turn)}
              active={catalogState.filters.turnPatterns.includes(turn)}
              mode="toggle"
              chipColor={chipColor}
              onclick={() => catalogState.toggleFilter('turnPatterns', turn)}
            />
          {/each}
        {/if}
      </FilterChipRow>

      {#if hasActiveFilters}
        <button class="clear-btn" onclick={() => catalogState.clearFilters()} type="button" aria-label="Clear all filters">
          <i class="fas fa-times" aria-hidden="true"></i> Clear filters
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .filter-bar {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px 24px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .filter-header {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .collection-toggle {
    display: flex;
  }

  .collection-pill {
    padding: 8px 18px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .collection-pill:first-child { border-radius: 8px 0 0 8px; }
  .collection-pill:last-child { border-radius: 0 8px 8px 0; border-left: 0; }

  .collection-pill.active {
    background: var(--loop-accent-bg, rgba(99, 183, 205, 0.15));
    border-color: var(--loop-accent-border, rgba(99, 183, 205, 0.4));
    color: var(--theme-text, #fff);
  }

  .collection-pill.tnd.active {
    background: var(--tnd-accent-bg, rgba(183, 99, 205, 0.15));
    border-color: var(--tnd-accent-border, rgba(183, 99, 205, 0.4));
  }

  .catalog-count {
    font-size: 13px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    margin-left: auto;
  }

  .filter-rows {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .chip-divider {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.2));
    font-size: 16px;
    padding: 0 4px;
    user-select: none;
  }

  .clear-btn {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font: inherit;
    font-size: 12px;
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease;
  }

  .clear-btn:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #fff);
  }

  .tnd-view-toggle {
    display: flex;
  }

  .view-pill {
    padding: 8px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font: inherit;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .view-pill:first-child { border-radius: 8px 0 0 8px; }
  .view-pill:last-child { border-radius: 0 8px 8px 0; border-left: 0; }

  .view-pill.active {
    background: var(--tnd-accent-bg, rgba(183, 99, 205, 0.15));
    border-color: var(--tnd-accent-border, rgba(183, 99, 205, 0.4));
    color: var(--theme-text, #fff);
  }

  .collapse-toggle { display: none; }

  @media (max-width: 768px) {
    .filter-bar { padding: 12px 16px; }
    .collapse-toggle.mobile-only { display: block; background: none; border: none; color: var(--theme-text-muted); font-size: 14px; cursor: pointer; padding: 8px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .collection-pill, .clear-btn { transition: none; }
  }
</style>

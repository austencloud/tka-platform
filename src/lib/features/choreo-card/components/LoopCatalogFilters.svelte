<script lang="ts">
  import type { Catalog } from "../domain/models/Catalog";

  interface Props {
    catalogs: Catalog[];
    activeSliceType: string;
    activeGridMode: string;
    filteredCount: number;
    onSliceTypeChange: (sliceType: string) => void;
    onGridModeChange: (gridMode: string) => void;
  }

  const {
    catalogs,
    activeSliceType,
    activeGridMode,
    filteredCount,
    onSliceTypeChange,
    onGridModeChange,
  }: Props = $props();

  const SLICE_TYPE_META: Record<string, { label: string; tooltip: string }> = {
    halved: { label: 'Halved', tooltip: '4-step seed repeated once' },
    quartered: { label: 'Quartered', tooltip: '2-step seed repeated 3 times' },
  };

  const GRID_MODE_META: Record<string, string> = {
    diamond: 'Diamond',
    box: 'Box',
  };

  // Derive available options from actual catalog data
  function getSliceType(d: Catalog): string | null {
    return d.sliceType ?? (d.id.includes('halved') ? 'halved' : d.id.includes('quartered') ? 'quartered' : null);
  }

  const availableSliceTypes = $derived<string[]>(
    [...new Set(
      catalogs.map(getSliceType).filter((s): s is string => s !== null)
    )].sort()
  );

  const availableGridModes = $derived<string[]>(
    [...new Set(catalogs.map(d => String(d.gridMode)))].sort()
  );

  const totalCount = $derived(catalogs.length);
</script>

<div class="loop-catalog-filters" role="toolbar" aria-label="Catalog filters">
  {#if availableSliceTypes.length > 1}
    <div class="filter-group" role="radiogroup" aria-label="Slice type">
      {#each availableSliceTypes as sliceType (sliceType)}
        {@const meta = SLICE_TYPE_META[sliceType]}
        <button
          type="button"
          role="radio"
          class="filter-pill"
          class:active={activeSliceType === sliceType}
          aria-checked={activeSliceType === sliceType}
          aria-label="Filter by {meta?.label ?? sliceType} slice type"
          title={meta?.tooltip ?? sliceType}
          onclick={() => onSliceTypeChange(sliceType)}
        >
          {meta?.label ?? sliceType}
        </button>
      {/each}
    </div>
  {/if}

  {#if availableGridModes.length > 1}
    <div class="filter-group" role="radiogroup" aria-label="Grid mode">
      {#each availableGridModes as gridMode (gridMode)}
        <button
          type="button"
          role="radio"
          class="filter-pill"
          class:active={activeGridMode === gridMode}
          aria-checked={activeGridMode === gridMode}
          aria-label="Filter by {GRID_MODE_META[gridMode] ?? gridMode} grid mode"
          onclick={() => onGridModeChange(gridMode)}
        >
          {GRID_MODE_META[gridMode] ?? gridMode}
        </button>
      {/each}
    </div>
  {/if}

  <span class="filter-count" aria-live="polite">
    {filteredCount} of {totalCount} {totalCount === 1 ? 'catalog' : 'catalogs'}
  </span>
</div>

<style>
  .loop-catalog-filters {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .filter-group {
    display: flex;
    gap: 0;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-lg, 12px);
    padding: 4px;
  }

  .filter-pill {
    padding: 5px 14px;
    border-radius: calc(var(--radius-lg, 12px) - 4px);
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: all 0.15s ease;
    border: none;
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    white-space: nowrap;
  }

  .filter-pill.active {
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, #ffffff);
  }

  .filter-pill:not(.active):hover {
    color: var(--theme-text, rgba(255, 255, 255, 0.8));
  }

  .filter-pill:focus-visible {
    outline: 2px solid var(--theme-accent, #63b3ed);
    outline-offset: 2px;
  }

  .filter-count {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    white-space: nowrap;
  }

  @media (prefers-reduced-motion: reduce) {
    .filter-pill {
      transition: none;
    }
  }
</style>

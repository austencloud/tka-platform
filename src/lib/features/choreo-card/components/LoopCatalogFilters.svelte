<script lang="ts">
  import type { Catalog } from "../domain/models/Catalog";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";

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

  const sliceTypeOptions = $derived(
    availableSliceTypes.map((s) => ({ value: s, label: SLICE_TYPE_META[s]?.label ?? s })),
  );
  const gridModeOptions = $derived(
    availableGridModes.map((g) => ({ value: g, label: GRID_MODE_META[g] ?? g })),
  );
</script>

<div class="loop-catalog-filters" role="toolbar" aria-label="Catalog filters">
  {#if availableSliceTypes.length > 1}
    <div class="filter-group-wrap" role="group" aria-label="Slice type">
      <SegmentedControl
        options={sliceTypeOptions}
        value={activeSliceType}
        onchange={onSliceTypeChange}
        color="accent"
        size="sm"
      />
    </div>
  {/if}

  {#if availableGridModes.length > 1}
    <div class="filter-group-wrap" role="group" aria-label="Grid mode">
      <SegmentedControl
        options={gridModeOptions}
        value={activeGridMode}
        onchange={onGridModeChange}
        color="accent"
        size="sm"
      />
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

  /* Each segmented control sized to its option labels; the toolbar wraps. */
  .filter-group-wrap {
    min-width: 180px;
  }

  .filter-count {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    white-space: nowrap;
  }
</style>

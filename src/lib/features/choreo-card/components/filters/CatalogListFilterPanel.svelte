<!--
  CatalogListFilterPanel.svelte - Filter bar for the collection page (Level 1).
  Composes FilterChipRow + individual chips from Browse module.
-->
<script lang="ts">
  import FilterChipRow from "$lib/features/browse/sequences/filtering/components/inline-filter/FilterChipRow.svelte";
  import LevelFilterChip from "$lib/shared/browse/components/filter-chips/LevelFilterChip.svelte";
  import GridModeFilterChip from "$lib/features/browse/sequences/filtering/components/inline-filter/chips/GridModeFilterChip.svelte";

  interface Props {
    isOpen: boolean;
    activeLevel: number | null;
    activeGridMode: string | null;
    onLevelChange: (level: number | null) => void;
    onGridModeChange: (gridMode: string | null) => void;
  }

  const { isOpen, activeLevel, activeGridMode, onLevelChange, onGridModeChange }: Props =
    $props();
</script>

{#if isOpen}
  <div class="catalog-list-filters">
    <FilterChipRow>
      {#snippet children()}
        <LevelFilterChip activeLevel={activeLevel} onSelect={onLevelChange} />
        <GridModeFilterChip activeGridMode={activeGridMode} onSelect={onGridModeChange} />
      {/snippet}
    </FilterChipRow>
  </div>
{/if}

<style>
  .catalog-list-filters {
    padding: 0 4px;
  }
</style>

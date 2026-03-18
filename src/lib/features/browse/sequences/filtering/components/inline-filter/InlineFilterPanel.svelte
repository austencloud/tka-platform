<!--
InlineFilterPanel.svelte - Collapsible inline filter panel.
Replaces the drawer-based BentoFilterPanel.
Orchestrates the chip row and active filter bar.
-->
<script lang="ts">
  import type { BrowseFilterValue } from "$lib/shared/persistence/domain/types/FilteringTypes";
  import type { BrowseFilterType } from "$lib/shared/persistence/domain/enums/FilteringEnums";
  import type { SequenceFilterType } from "../../../../shared/state/sequence-controls-state.svelte";
  import FilterChipRow from "./FilterChipRow.svelte";
  import LevelFilterChip from "./chips/LevelFilterChip.svelte";
  import FavoritesFilterChip from "./chips/FavoritesFilterChip.svelte";
  import LetterFilterChip from "./chips/LetterFilterChip.svelte";
  import LengthFilterChip from "./chips/LengthFilterChip.svelte";
  import PatternFilterChip from "./chips/PatternFilterChip.svelte";
  import PositionFilterChip from "./chips/PositionFilterChip.svelte";
  import GridModeFilterChip from "./chips/GridModeFilterChip.svelte";

  interface Props {
    isOpen: boolean;
    activeLevel: number | null;
    activeLetter: string | null;
    activeLength: number | null;
    activeLoopType: string | null;
    activeGridMode: string | null;
    isFavoritesActive: boolean;
    hasActivePositions: boolean;
    availableLengths: number[];
    loopTypeCounts: Record<string, number>;
    onFilterChange: (type: SequenceFilterType, value?: BrowseFilterValue) => void;
    onRemoveFilter: (type: string) => void;
    onOpenLetterSheet: () => void;
    onOpenOptionsSheet: () => void;
    getFilteredCount?: (candidateType: BrowseFilterType, candidateValue: BrowseFilterValue) => number;
  }

  let {
    isOpen,
    activeLevel,
    activeLetter,
    activeLength,
    activeLoopType,
    activeGridMode,
    isFavoritesActive,
    hasActivePositions,
    availableLengths,
    loopTypeCounts,
    onFilterChange,
    onRemoveFilter,
    onOpenLetterSheet,
    onOpenOptionsSheet,
    getFilteredCount,
  }: Props = $props();

  function handleLevelSelect(level: number | null) {
    if (level === null) {
      onRemoveFilter("difficulty");
    } else {
      onFilterChange("difficulty", level);
    }
  }

  function handleFavoritesToggle(active: boolean) {
    if (active) {
      onFilterChange("favorites");
    } else {
      onRemoveFilter("favorites");
    }
  }

  function handleLengthSelect(length: number | null) {
    if (length === null) {
      onRemoveFilter("length");
    } else {
      onFilterChange("length", length);
    }
  }

  function handlePatternSelect(value: string | null) {
    if (value === null) {
      onRemoveFilter("cap_type");
    } else {
      onFilterChange("cap_type", value);
    }
  }

  function handleGridModeSelect(gridMode: string | null) {
    if (gridMode === null) {
      onRemoveFilter("gridMode");
    } else {
      onFilterChange("gridMode", gridMode);
    }
  }
</script>

<div
  class="inline-filter-panel"
  class:open={isOpen}
  aria-hidden={!isOpen}
>
  <div class="panel-content">
    <FilterChipRow>
      <LevelFilterChip
        {activeLevel}
        onSelect={handleLevelSelect}
        {getFilteredCount}
      />
      <FavoritesFilterChip
        active={isFavoritesActive}
        onToggle={handleFavoritesToggle}
      />
      <LetterFilterChip
        {activeLetter}
        onOpenSheet={onOpenLetterSheet}
      />
      <LengthFilterChip
        {activeLength}
        {availableLengths}
        onSelect={handleLengthSelect}
        {getFilteredCount}
      />
      <PatternFilterChip
        activeValue={activeLoopType}
        {loopTypeCounts}
        onSelect={handlePatternSelect}
      />
      <GridModeFilterChip
        {activeGridMode}
        onSelect={handleGridModeSelect}
        {getFilteredCount}
      />
      <PositionFilterChip
        {hasActivePositions}
        onOpenSheet={onOpenOptionsSheet}
      />
    </FilterChipRow>
  </div>
</div>

<style>
  .inline-filter-panel {
    container-type: inline-size;
    container-name: inline-filter;
    overflow: hidden;
    max-height: 0;
    opacity: 0;
    transition:
      max-height var(--duration-emphasis, 300ms) cubic-bezier(0.4, 0, 0.2, 1),
      opacity var(--duration-fast, 150ms) ease;
    border-bottom: 1px solid transparent;
  }

  .inline-filter-panel.open {
    max-height: 160px;
    opacity: 1;
    border-bottom-color: var(--theme-stroke);
  }

  .panel-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 16px;
  }

  /* Wide screen: filters are inline in top bar, hide this panel */
  @container gallery (min-width: 900px) {
    .inline-filter-panel {
      display: none !important;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .inline-filter-panel {
      transition: none;
    }

    .inline-filter-panel.open {
      max-height: none;
    }
  }
</style>

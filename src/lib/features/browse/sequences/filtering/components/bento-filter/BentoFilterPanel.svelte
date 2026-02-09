<!--
BentoFilterPanel.svelte - Modern Bento box style filter panel
Displays filter cards in a responsive grid
Uses shared parameter cards from $lib/shared/components/parameter-cards
Includes grid size controls on mobile (zoom moved from toolbar)
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import type { BrowseFilterValue } from "$lib/shared/persistence/domain/types/FilteringTypes";
  import type { SequenceFilterType } from "../../../../shared/state/sequence-controls-state.svelte";
  import type { DifficultyLevel } from "$lib/shared/domain/models/sequence-parameters";

  // Shared parameter cards
  import LevelCard from "$lib/shared/components/parameter-cards/LevelCard.svelte";
  import LetterCard from "$lib/shared/components/parameter-cards/LetterCard.svelte";
  import LengthCard from "$lib/shared/components/parameter-cards/LengthCard.svelte";
  import FavoritesCard from "$lib/shared/components/parameter-cards/FavoritesCard.svelte";
  import OptionsCard from "$lib/shared/components/parameter-cards/OptionsCard.svelte";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";

  // Local filter cards
  import LOOPTypeFilterCard from "./LOOPTypeFilterCard.svelte";

  // Grid zoom state
  import { gridZoomManager } from "../../../../shared/state/grid-zoom-state.svelte";

  let {
    currentFilter = { type: "all", value: null },
    startPosition = null,
    endPosition = null,
    loopTypeCounts = {},
    onFilterChange = () => {},
    onOpenLetterSheet = () => {},
    onOpenOptionsSheet = () => {},
  } = $props<{
    currentFilter?: { type: SequenceFilterType; value: BrowseFilterValue };
    startPosition?: PictographData | null;
    endPosition?: PictographData | null;
    loopTypeCounts?: Record<string, number>;
    onFilterChange?: (type: SequenceFilterType, value?: BrowseFilterValue) => void;
    onOpenLetterSheet?: () => void;
    onOpenOptionsSheet?: () => void;
  }>();

  // Count active position options
  const activeOptionsCount = $derived(
    (startPosition !== null ? 1 : 0) + (endPosition !== null ? 1 : 0)
  );

  let hapticService: IHapticFeedback | null = null;

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  // Zoom state
  const currentColumns = $derived(gridZoomManager.columns);
  const canZoomIn = $derived(gridZoomManager.canZoomIn);
  const canZoomOut = $derived(gridZoomManager.canZoomOut);

  // Derived filter values
  const currentLevel = $derived(
    currentFilter.type === "difficulty"
      ? (currentFilter.value as DifficultyLevel)
      : null
  );
  const currentLetter = $derived(
    currentFilter.type === "startingLetter"
      ? (currentFilter.value as string)
      : null
  );
  const currentLength = $derived(
    currentFilter.type === "length" ? (currentFilter.value as number) : null
  );
  const isFavoritesActive = $derived(currentFilter.type === "favorites");
  const currentLoopType = $derived(
    currentFilter.type === "cap_type" ? (currentFilter.value as string) : null
  );

  // Handlers
  function handleLevelChange(level: DifficultyLevel | null) {
    if (level === null) {
      onFilterChange("all");
    } else {
      onFilterChange("difficulty", level);
    }
  }

  function handleFavoritesToggle(active: boolean) {
    if (active) {
      onFilterChange("favorites");
    } else {
      onFilterChange("all");
    }
  }

  function handleLengthChange(length: number | null) {
    if (length === null) {
      onFilterChange("all");
    } else {
      onFilterChange("length", length);
    }
  }

  function handleLoopTypeChange(value: string | null) {
    if (value === null) {
      onFilterChange("all");
    } else {
      onFilterChange("cap_type", value);
    }
  }

  function handleZoomIn() {
    hapticService?.trigger("selection");
    gridZoomManager.zoomIn();
  }

  function handleZoomOut() {
    hapticService?.trigger("selection");
    gridZoomManager.zoomOut();
  }
</script>

<div class="bento-filter-panel">
  <!-- Grid Size Control (mobile only — desktop has zoom in toolbar) -->
  <div class="grid-size-control">
    <span class="grid-size-label">Grid size</span>
    <div class="grid-size-buttons">
      <button
        class="grid-size-btn"
        onclick={handleZoomOut}
        disabled={!canZoomOut}
        type="button"
        aria-label="Fewer columns (larger cards)"
      >
        <i class="fas fa-minus" aria-hidden="true"></i>
      </button>
      <span class="grid-size-value">{currentColumns}</span>
      <button
        class="grid-size-btn"
        onclick={handleZoomIn}
        disabled={!canZoomIn}
        type="button"
        aria-label="More columns (smaller cards)"
      >
        <i class="fas fa-plus" aria-hidden="true"></i>
      </button>
    </div>
  </div>

  <!-- Filter Cards Grid -->
  <div class="cards-grid">
    <LevelCard
      value={currentLevel}
      allowNull={true}
      onChange={handleLevelChange}
      gridColumnSpan={2}
      cardIndex={0}
    />

    <OptionsCard
      activeCount={activeOptionsCount}
      onOpenSheet={onOpenOptionsSheet}
      gridColumnSpan={2}
      cardIndex={1}
    />

    <FavoritesCard
      isActive={isFavoritesActive}
      onToggle={handleFavoritesToggle}
      gridColumnSpan={2}
      cardIndex={2}
    />

    <LetterCard
      value={currentLetter}
      onOpenSheet={onOpenLetterSheet}
      gridColumnSpan={2}
      cardIndex={3}
    />

    <LengthCard
      value={currentLength}
      mode="stepper"
      allowNull={true}
      onChange={handleLengthChange}
      gridColumnSpan={2}
      cardIndex={4}
    />

    <LOOPTypeFilterCard
      currentValue={currentLoopType}
      onValueChange={handleLoopTypeChange}
      {loopTypeCounts}
      gridColumnSpan={2}
      cardIndex={5}
    />
  </div>
</div>

<style>
  .bento-filter-panel {
    display: flex;
    flex-direction: column;
    gap: clamp(12px, 3cqi, 20px);
    padding: clamp(12px, 3cqi, 20px);
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    container-type: inline-size;
    container-name: bento-filter;
    height: 100%;
    overflow-y: auto;
  }

  /* Grid Size Control — mobile only */
  .grid-size-control {
    display: none;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
  }

  .grid-size-label {
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    color: var(--theme-text-dim);
  }

  .grid-size-buttons {
    display: flex;
    align-items: center;
    gap: 4px;
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    padding: 3px;
  }

  .grid-size-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition:
      background var(--duration-fast, 150ms) ease,
      color var(--duration-fast, 150ms) ease,
      transform var(--duration-fast, 150ms) ease;
  }

  .grid-size-btn:hover:not(:disabled) {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
  }

  .grid-size-btn:active:not(:disabled) {
    transform: scale(0.92);
  }

  .grid-size-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .grid-size-value {
    min-width: 24px;
    text-align: center;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text);
    font-variant-numeric: tabular-nums;
  }

  /* Show grid size control on mobile */
  @media (max-width: 640px) {
    .grid-size-control {
      display: flex;
    }
  }

  /* Cards Grid - Default: 3 columns (6 sub-columns, cards span 2) */
  .cards-grid {
    container-type: inline-size;
    container-name: filter-cards;
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    /* Content-based rows with max height cap - prevents stretching in tall panels */
    grid-auto-rows: minmax(auto, 140px);
    gap: clamp(8px, 2cqi, 12px);
    /* Don't stretch to fill - let cards be natural size */
    align-content: start;
  }

  /* Narrow panel (< 320px): 2 columns */
  @container bento-filter (max-width: 320px) {
    .cards-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      grid-auto-rows: minmax(auto, 120px);
    }
  }

  /* Wide panel (mobile landscape / tablet): can use more height */
  @container bento-filter (min-width: 500px) {
    .cards-grid {
      grid-template-columns: repeat(6, minmax(0, 1fr));
      grid-auto-rows: minmax(auto, 160px);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .grid-size-btn {
      transition: none !important;
    }
  }
</style>

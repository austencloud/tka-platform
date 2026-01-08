<!--
BentoFilterPanel.svelte - Modern Bento box style filter panel
Displays filter cards in a responsive grid
Uses shared parameter cards from $lib/shared/components/parameter-cards
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { tryResolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import { onMount } from "svelte";
  import type { ExploreFilterValue } from "$lib/shared/persistence/domain/types/FilteringTypes";
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

  let {
    currentFilter = { type: "all", value: null },
    startPosition = null,
    endPosition = null,
    loopTypeCounts = {},
    onFilterChange = () => {},
    onOpenLetterSheet = () => {},
    onOpenOptionsSheet = () => {},
  } = $props<{
    currentFilter?: { type: string; value: ExploreFilterValue };
    startPosition?: PictographData | null;
    endPosition?: PictographData | null;
    loopTypeCounts?: Record<string, number>;
    onFilterChange?: (type: string, value?: ExploreFilterValue) => void;
    onOpenLetterSheet?: () => void;
    onOpenOptionsSheet?: () => void;
  }>();

  // Count active position options
  const activeOptionsCount = $derived(
    (startPosition !== null ? 1 : 0) + (endPosition !== null ? 1 : 0)
  );

  let hapticService: IHapticFeedback | null = null;

  onMount(() => {
    hapticService = tryResolve<IHapticFeedback>(TYPES.IHapticFeedback);
  });

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
</script>

<div class="bento-filter-panel">
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
    background: #1a1a24;
    container-type: inline-size;
    container-name: bento-filter;
    height: 100%;
    overflow-y: auto;
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
</style>

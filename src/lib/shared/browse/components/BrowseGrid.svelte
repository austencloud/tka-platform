<script lang="ts">
  import { onDestroy } from "svelte";
  import ChoreoCardThumbnail from "$lib/shared/browse/components/ChoreoCardThumbnail/ChoreoCardThumbnail.svelte";
  import SectionHeader from "$lib/shared/browse/components/SectionHeader.svelte";
  import VirtualizedSequenceGrid, {
    type VirtualGridApi,
  } from "$lib/shared/browse/components/VirtualizedSequenceGrid.svelte";
  import type { BrowseThumbnailProvider } from "$lib/shared/browse/services/BrowseThumbnailProvider";
  import { getVariationGrouper } from "$lib/shared/browse/getVariationGrouper";
  import { getSequenceDataProvider } from "$lib/shared/sequence-viewer/getSequenceDataProvider";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { isCatDogMode } from "$lib/shared/browse/utils/prop-mode-helpers";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { BrowseEngine } from "../engine/types";

  interface Props {
    engine: BrowseEngine;
    thumbnailService: BrowseThumbnailProvider | null;
    onAction?: (action: string, sequence: SequenceData, variations?: SequenceData[]) => void;
    disableVirtualization?: boolean;
    eager?: boolean;
    onGridReady?: (api: VirtualGridApi) => void;
  }

  const {
    engine,
    thumbnailService,
    onAction = () => {},
    disableVirtualization = false,
    eager = false,
    onGridReady,
  }: Props = $props();

  // Derived state from engine — sections take priority over virtualization
  const useVirtualization = $derived(
    !disableVirtualization &&
      !(engine.sectionsEnabled && engine.sections.length > 0) &&
      engine.sequences.length > 50
  );

  // Variation grouper
  const variationGrouper = getVariationGrouper();

  const variationMap = $derived.by(() => {
    return variationGrouper.buildVariationMap(engine.sequences as SequenceData[]);
  });

  function getVariationsForSequence(sequence: SequenceData): SequenceData[] {
    const word = sequence.word || sequence.name;
    if (!word) return [sequence];
    return variationMap.get(word.trim()) ?? [sequence];
  }

  const handPathMode = $derived(engine.viewMode.subject === "hands");
  const isSoloMode = $derived(engine.viewMode.granularity === "solo");

  // Motion visibility: in "combined" mode show both, in "solo" mode show only the selected color
  const showBlueMotion = $derived(
    engine.viewMode.granularity === "combined" || engine.viewMode.color === "blue"
  );
  const showRedMotion = $derived(
    engine.viewMode.granularity === "combined" || engine.viewMode.color === "red"
  );

  // Word/difficulty only meaningful with both props visible
  const addWord = $derived(!handPathMode && !isSoloMode);
  const addDifficultyLevel = $derived(!handPathMode && !isSoloMode);

  // Prop settings
  const propSettings = $derived({
    bluePropType: settingsService.settings.bluePropType,
    redPropType: settingsService.settings.redPropType,
    catDogMode: settingsService.settings.catDogMode,
  });

  const isCatDog = $derived(
    isCatDogMode(
      propSettings.bluePropType,
      propSettings.redPropType,
      propSettings.catDogMode
    )
  );

  // Light mode tracking via observer pattern
  const visibilityManager = getAnimationVisibilityManager();
  let lightMode = $state(!visibilityManager.isDarkMode());

  function handleVisibilityChange() {
    lightMode = !visibilityManager.isDarkMode();
  }

  visibilityManager.registerObserver(handleVisibilityChange);

  onDestroy(() => {
    visibilityManager.unregisterObserver(handleVisibilityChange);
  });

  // Hover prefetch
  const sequenceDataProvider = getSequenceDataProvider();

  function handleSequenceHover(seq: SequenceData) {
    sequenceDataProvider.prefetch(seq);
  }

  function handleSequenceAction(
    action: string,
    sequence: SequenceData,
    variations?: SequenceData[]
  ) {
    onAction(action, sequence, variations);
  }
</script>

{#if useVirtualization}
  <!-- Virtualized: large flat list with 50+ items -->
  <VirtualizedSequenceGrid
    sequences={engine.sequences as SequenceData[]}
    {thumbnailService}
    {onAction}
    pinchColumnOverride={engine.columnCount}
    {onGridReady}
    {handPathMode}
    {showBlueMotion}
    {showRedMotion}
    {addWord}
    {addDifficultyLevel}
  />
{:else if engine.sectionsEnabled && engine.sections.length > 0}
  <!-- Sectioned: group by section with headers -->
  <div class="sections-container">
    {#each engine.sections as section (section.id)}
      <div class="sequence-section" data-section={section.title}>
        <SectionHeader title={section.title} />

        {#if section.sequences.length > 0}
          <div
            class="sequences-grid grid-view"
            class:is-transitioning={engine.isTransitioning}
            style:grid-template-columns="repeat({engine.columnCount}, 1fr)"
          >
            {#each section.sequences as sequence (sequence.id)}
              {@const seqVariations = getVariationsForSequence(sequence)}
              <ChoreoCardThumbnail
                {sequence}
                variations={seqVariations}
                onPrimaryAction={(seq) => handleSequenceAction("view-detail", seq, seqVariations)}
                onHover={handleSequenceHover}
                bluePropType={propSettings.bluePropType}
                redPropType={propSettings.redPropType}
                catDogModeEnabled={isCatDog}
                {lightMode}
                {eager}
                {handPathMode}
                {showBlueMotion}
                {showRedMotion}
                {addWord}
                {addDifficultyLevel}
              />
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
{:else if engine.sequences.length > 0}
  <!-- Flat: simple grid fallback -->
  <div
    class="sequences-grid grid-view"
    class:is-transitioning={engine.isTransitioning}
    style:grid-template-columns="repeat({engine.columnCount}, 1fr)"
  >
    {#each engine.sequences as sequence (sequence.id)}
      {@const seqVariations = getVariationsForSequence(sequence)}
      <ChoreoCardThumbnail
        {sequence}
        variations={seqVariations}
        onPrimaryAction={(seq) => handleSequenceAction("view-detail", seq, seqVariations)}
        onHover={handleSequenceHover}
        bluePropType={propSettings.bluePropType}
        redPropType={propSettings.redPropType}
        catDogModeEnabled={isCatDog}
        {lightMode}
        {eager}
        {handPathMode}
        {showBlueMotion}
        {showRedMotion}
      />
    {/each}
  </div>
{/if}

<style>
  .sections-container {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .sequence-section {
    display: flex;
    flex-direction: column;
  }

  .sequences-grid.grid-view {
    display: grid;
    gap: var(--spacing-sm);
    align-items: start;
  }

  .sequences-grid.grid-view.is-transitioning {
    transition: gap 200ms ease-out;
  }

  @media (prefers-reduced-motion: reduce) {
    .sequences-grid.grid-view.is-transitioning {
      transition: none !important;
    }
  }
</style>

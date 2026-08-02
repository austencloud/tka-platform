<script lang="ts">
  import { onDestroy } from "svelte";
  import ChoreoCardThumbnail from "$lib/shared/browse/components/ChoreoCardThumbnail/ChoreoCardThumbnail.svelte";
  import VirtualizedSequenceGrid, {
    type VirtualGridApi,
  } from "$lib/shared/browse/components/VirtualizedSequenceGrid.svelte";
  import SectionedVirtualGrid, {
    type SectionedGridApi,
  } from "$lib/shared/browse/components/SectionedVirtualGrid.svelte";
  import type { BrowseThumbnailProvider } from "$lib/shared/browse/services/browse-thumbnail-provider";
  import {
    buildVariationMap,
    variationGroupKey,
  } from "$lib/shared/browse/services/variation-grouper";
  import { prefetch as prefetchSequenceData } from "$lib/shared/sequence-viewer/services/sequence-data-provider";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { isCatDogMode } from "$lib/shared/browse/utils/prop-mode-helpers";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { BrowseEngine } from "../engine/types";

  interface Props {
    engine: BrowseEngine;
    thumbnailService: BrowseThumbnailProvider | null;
    onAction?: (
      action: string,
      sequence: SequenceData,
      variations?: SequenceData[]
    ) => void;
    disableVirtualization?: boolean;
    eager?: boolean;
    onGridReady?: (api: VirtualGridApi) => void;
    /** Picker hosts: ids to render with the selected outline. */
    selectedIds?: ReadonlySet<string>;
    /** Personal-library batch selection. Long-press starts it; taps toggle
     * cards once active. */
    selectionMode?: boolean;
    onSelectionStart?: (sequence: SequenceData) => void;
    onSelectionToggle?: (sequence: SequenceData) => void;
    /** Shared external scroll element for the sectioned virtual grid
     * (BrowsePanel's `.panel-content`). */
    scrollElement?: HTMLElement | null;
    /** Sectioned virtual grid: imperative API for the sidebar's section jump. */
    onSectionGridReady?: (api: SectionedGridApi) => void;
    /** Sectioned virtual grid: reports the section at the top of the viewport. */
    onActiveSectionChange?: (title: string | undefined) => void;
  }

  const {
    engine,
    thumbnailService,
    onAction,
    disableVirtualization = false,
    eager = false,
    onGridReady,
    selectedIds,
    selectionMode = false,
    onSelectionStart,
    onSelectionToggle,
    scrollElement = null,
    onSectionGridReady,
    onActiveSectionChange,
  }: Props = $props();

  // Derived state from engine — sections take priority over virtualization
  const useVirtualization = $derived(
    !disableVirtualization &&
      !(engine.sectionsEnabled && engine.sections.length > 0) &&
      engine.sequences.length > 50
  );

  const variationMap = $derived.by(() => {
    return buildVariationMap(engine.sequences as SequenceData[]);
  });

  function getVariationsForSequence(sequence: SequenceData): SequenceData[] {
    const key = variationGroupKey(sequence);
    if (!key) return [sequence];
    return variationMap.get(key) ?? [sequence];
  }

  // One card per WORD — the variation pill + crossfade exist to cycle a word's
  // variations inside a single card (legacy counted "number of words" and drew
  // one thumbnail box per word). Rendering every variation as its own card
  // filled sections with near-identical duplicates. Keyed by the SIMPLIFIED
  // word (the label) so raw-word variants sharing a label collapse too.
  function dedupeByWord(seqs: SequenceData[]): SequenceData[] {
    const seen = new Set<string>();
    const out: SequenceData[] = [];
    for (const seq of seqs) {
      const key = variationGroupKey(seq) ?? seq.id;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(seq);
    }
    return out;
  }

  // The sectioned layout (level banners, letter subsections, word-collapsed
  // rows) is virtualized in SectionedVirtualGrid — the flat/small fallback
  // below still uses dedupeByWord + getVariationsForSequence.

  const handPathMode = $derived(engine.viewMode.subject === "hands");
  const isSoloMode = $derived(engine.viewMode.granularity === "solo");

  // Motion visibility: in "combined" mode show both, in "solo" mode show only the selected color
  const showBlueMotion = $derived(
    engine.viewMode.granularity === "combined" ||
      engine.viewMode.color === "blue"
  );
  const showRedMotion = $derived(
    engine.viewMode.granularity === "combined" ||
      engine.viewMode.color === "red"
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
  function handleSequenceHover(seq: SequenceData) {
    prefetchSequenceData(seq);
  }

  function handleSequenceAction(
    action: string,
    sequence: SequenceData,
    variations?: SequenceData[]
  ) {
    onAction?.(action, sequence, variations);
  }
</script>

{#if useVirtualization}
  <!-- Virtualized: large flat list with 50+ items -->
  <VirtualizedSequenceGrid
    sequences={dedupeByWord(engine.sequences as SequenceData[])}
    variationSource={engine.sequences as SequenceData[]}
    {thumbnailService}
    {onAction}
    pinchColumnOverride={engine.columnCount}
    {onGridReady}
    {handPathMode}
    {showBlueMotion}
    {showRedMotion}
    {addWord}
    {addDifficultyLevel}
    {selectedIds}
    {selectionMode}
    {onSelectionStart}
    {onSelectionToggle}
  />
{:else if engine.sectionsEnabled && engine.sections.length > 0}
  <!-- Sectioned: virtualized (level banners + letter headers + word rows) -->
  <SectionedVirtualGrid
    {engine}
    {thumbnailService}
    {scrollElement}
    {onAction}
    {eager}
    {handPathMode}
    {showBlueMotion}
    {showRedMotion}
    {addWord}
    {addDifficultyLevel}
    {selectedIds}
    {selectionMode}
    {onSelectionStart}
    {onSelectionToggle}
    onGridReady={onSectionGridReady}
    {onActiveSectionChange}
  />
{:else if engine.sequences.length > 0}
  <!-- Flat: simple grid fallback -->
  <div
    class="sequences-grid grid-view"
    class:is-transitioning={engine.isTransitioning}
    style:grid-template-columns="repeat({engine.columnCount}, 1fr)"
  >
    {#each dedupeByWord(engine.sequences as SequenceData[]) as sequence (sequence.id)}
      {@const seqVariations = getVariationsForSequence(sequence)}
      <ChoreoCardThumbnail
        {sequence}
        variations={seqVariations}
        onPrimaryAction={onAction
          ? (seq) => handleSequenceAction("view-detail", seq, seqVariations)
          : undefined}
        onHover={handleSequenceHover}
        bluePropType={propSettings.bluePropType}
        redPropType={propSettings.redPropType}
        catDogModeEnabled={isCatDog}
        {lightMode}
        {eager}
        {handPathMode}
        {showBlueMotion}
        {showRedMotion}
        {selectedIds}
        {selectionMode}
        {onSelectionStart}
        {onSelectionToggle}
      />
    {/each}
  </div>
{/if}

<style>
  /* Flat/small fallback grid only — the sectioned layout's styles live in
     SectionedVirtualGrid. */
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

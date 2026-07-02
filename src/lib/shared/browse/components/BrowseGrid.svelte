<script lang="ts">
  import { onDestroy } from "svelte";
  import ChoreoCardThumbnail from "$lib/shared/browse/components/ChoreoCardThumbnail/ChoreoCardThumbnail.svelte";
  import SectionHeader from "$lib/shared/browse/components/SectionHeader.svelte";
  import DifficultyBadge from "$lib/shared/components/DifficultyBadge.svelte";
  import type { SequenceSection } from "$lib/shared/browse/domain/models/browse-models";
  import VirtualizedSequenceGrid, {
    type VirtualGridApi,
  } from "$lib/shared/browse/components/VirtualizedSequenceGrid.svelte";
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
    onAction?: (action: string, sequence: SequenceData, variations?: SequenceData[]) => void;
    disableVirtualization?: boolean;
    eager?: boolean;
    onGridReady?: (api: VirtualGridApi) => void;
    /** Picker hosts: ids to render with the selected outline. */
    selectedIds?: ReadonlySet<string>;
  }

  const {
    engine,
    thumbnailService,
    onAction = () => {},
    disableVirtualization = false,
    eager = false,
    onGridReady,
    selectedIds,
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

  // With a length filter active every section shares the same step count —
  // repeating "(8 steps)" in each header is noise.
  const stepsRedundant = $derived(engine.activeFilters.has("length"));

  // Level-sorted sections render a colored "Level N" banner (blue/silver/gold)
  // with letter subsections beneath. Annotate each section with whether it
  // starts a new level and that level's total count.
  interface SectionRow {
    section: SequenceSection;
    /** Word-collapsed cards for this section (one per word, pill cycles the rest). */
    displaySequences: SequenceData[];
    isLevel: boolean;
    showBanner: boolean;
    level: number;
    levelTotal: number;
  }
  const sectionRows = $derived.by((): SectionRow[] => {
    const secs = engine.sections as SequenceSection[];
    const isLevel = secs.length > 0 && secs.every((s) => typeof s.level === "number");
    const totals = new Map<number, number>();
    if (isLevel) {
      for (const s of secs) totals.set(s.level!, (totals.get(s.level!) ?? 0) + s.count);
    }
    let prevLevel: number | undefined;
    const rows: SectionRow[] = [];
    for (const s of secs) {
      const showBanner = isLevel && s.level !== prevLevel;
      rows.push({
        section: s,
        displaySequences: dedupeByWord(s.sequences as SequenceData[]),
        isLevel,
        showBanner,
        level: s.level ?? 0,
        levelTotal: isLevel ? (totals.get(s.level!) ?? 0) : 0,
      });
      prevLevel = s.level;
    }
    return rows;
  });

  /** Strip the "Level N · " prefix so the per-letter sub-header shows just the letter. */
  function letterTitle(title: string): string {
    return title.replace(/^Level\s+\d+\s+·\s+/u, "");
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
  function handleSequenceHover(seq: SequenceData) {
    prefetchSequenceData(seq);
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
  />
{:else if engine.sectionsEnabled && engine.sections.length > 0}
  <!-- Sectioned: group by section with headers -->
  <div class="sections-container">
    {#each sectionRows as row (row.section.id)}
      {@const section = row.section}
      {#if row.showBanner}
        <div class="level-banner">
          <DifficultyBadge level={row.level} size="34px" />
          <span class="level-banner-title">Level {row.level}</span>
          <span class="level-banner-count">{row.levelTotal}</span>
          <div class="level-banner-divider"></div>
        </div>
      {/if}
      <div class="sequence-section" class:under-level={row.isLevel} data-section={section.title}>
        <SectionHeader
          title={row.isLevel ? letterTitle(section.title) : section.title}
          count={row.displaySequences.length}
          hideSteps={stepsRedundant}
        />

        {#if row.displaySequences.length > 0}
          <div
            class="sequences-grid grid-view"
            class:is-transitioning={engine.isTransitioning}
            style:grid-template-columns="repeat({engine.columnCount}, 1fr)"
          >
            {#each row.displaySequences as sequence (sequence.id)}
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
                {selectedIds}
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
    {#each dedupeByWord(engine.sequences as SequenceData[]) as sequence (sequence.id)}
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
        {selectedIds}
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

  /* Letter subsections sit slightly indented beneath their level banner. */
  .sequence-section.under-level {
    padding-left: var(--spacing-sm, 8px);
  }

  .level-banner {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
    margin-top: var(--spacing-lg, 20px);
    margin-bottom: var(--spacing-xs, 4px);
  }

  .level-banner:first-child {
    margin-top: 0;
  }

  .level-banner-title {
    font-size: var(--font-size-lg, 20px);
    font-weight: 800;
    color: var(--theme-text, #fff);
    letter-spacing: 0.01em;
    white-space: nowrap;
  }

  .level-banner-count {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
    background: rgba(255, 255, 255, 0.08);
    padding: 2px 10px;
    border-radius: 12px;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .level-banner-divider {
    flex: 1;
    height: 2px;
    border-radius: 2px;
    background: linear-gradient(
      to right,
      var(--theme-stroke, rgba(255, 255, 255, 0.12)) 0%,
      transparent 100%
    );
    min-width: 40px;
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

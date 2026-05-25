<script lang="ts">
  import type { Catalog } from "../domain/models/Catalog";
  import LoopStepGrid from "./LoopStepGrid.svelte";
  import LoopTurnsGrid from "./LoopTurnsGrid.svelte";
  import LoopReversalGrid from "./LoopReversalGrid.svelte";
  import LoopCatalogFilters from "./LoopCatalogFilters.svelte";
  import CatalogCard from "./CatalogCard.svelte";

  interface Props {
    catalogs: Catalog[];
    onSelectCatalog: (catalog: Catalog) => void;
  }

  const { catalogs, onSelectCatalog }: Props = $props();

  // Loop type pill bar state
  type LoopType = 'rotated' | 'mirrored' | 'swapped' | 'inverted' | 'rewound';

  const LOOP_TYPE_LABELS: { id: LoopType; label: string }[] = [
    { id: 'rotated', label: 'Rotated' },
    { id: 'mirrored', label: 'Mirrored' },
    { id: 'swapped', label: 'Swapped' },
    { id: 'inverted', label: 'Inverted' },
    { id: 'rewound', label: 'Rewound' },
  ];

  let activeLoopType = $state<LoopType>('rotated');

  // Slice type and grid mode filter state
  let activeSliceType = $state<string>('halved');
  let activeGridMode = $state<string>('diamond');

  // Axis toggle state
  type AxisView = 'beats' | 'turns' | 'reversal';
  let activeAxis = $state<AxisView>('beats');

  // Drill-down filter: when set, shows a filtered list of decks
  let drillFilter = $state<{ axis: AxisView; value: string | number } | null>(null);

  const populatedLoopTypes = $derived(
    new Set(catalogs.map(d => d.loopType))
  );

  const filteredCatalogs = $derived(
    catalogs.filter(d => d.loopType === activeLoopType)
  );

  // Count distinct values per axis to hide single-option tabs
  const distinctBeatCounts = $derived(new Set(filteredCatalogs.map(d => d.stepCount)).size);
  const distinctTurnCounts = $derived(new Set(filteredCatalogs.map(d => d.turnPattern)).size);
  const distinctReversalPatterns = $derived(new Set(filteredCatalogs.map(d => d.reversalPattern)).size);

  // Axes worth showing (more than one distinct value)
  type AxisDef = { id: AxisView; label: string };
  const visibleAxes = $derived<AxisDef[]>(
    ([
      { id: 'beats' as AxisView, label: 'By Beats', count: distinctBeatCounts },
      { id: 'turns' as AxisView, label: 'By Turns', count: distinctTurnCounts },
      { id: 'reversal' as AxisView, label: 'By Reversal', count: distinctReversalPatterns },
    ] as const).filter(a => a.count > 1).map(({ id, label }) => ({ id, label }))
  );

  // If current axis got hidden, fall back to the first visible one
  $effect(() => {
    if (visibleAxes.length > 0 && !visibleAxes.some(a => a.id === activeAxis)) {
      activeAxis = visibleAxes[0]!.id;
    }
  });

  // Apply slice type and grid mode filters on top of loop type
  const sliceAndGridFiltered = $derived(
    filteredCatalogs.filter(d => {
      const matchesSlice = d.sliceType === activeSliceType;
      const matchesGrid = d.gridMode === activeGridMode;
      return matchesSlice && matchesGrid;
    })
  );

  // Decks filtered by drill-down selection (uses sliceAndGridFiltered as base)
  const drilledCatalogs = $derived(
    drillFilter
      ? sliceAndGridFiltered.filter(d => {
          if (drillFilter!.axis === 'beats') return d.stepCount === drillFilter!.value;
          if (drillFilter!.axis === 'turns') return d.turnPattern === drillFilter!.value;
          if (drillFilter!.axis === 'reversal') return d.reversalPattern === drillFilter!.value;
          return true;
        })
      : []
  );

  const drillLabel = $derived(
    drillFilter
      ? drillFilter.axis === 'beats' ? `${drillFilter.value}-Beat`
        : drillFilter.axis === 'turns' ? `${drillFilter.value} turns`
        : String(drillFilter.value)
      : ''
  );

  function drillOrSelect(axis: AxisView, value: string | number, matchingCatalogs: Catalog[]): void {
    if (matchingCatalogs.length === 1) {
      onSelectCatalog(matchingCatalogs[0]!);
    } else {
      drillFilter = { axis, value };
    }
  }

  function handleSelectBeatCount(stepCount: number): void {
    const matching = sliceAndGridFiltered.filter(d => d.stepCount === stepCount);
    drillOrSelect('beats', stepCount, matching);
  }

  function handleSelectTurns(turns: string): void {
    const matching = sliceAndGridFiltered.filter(d => d.turnPattern === turns);
    drillOrSelect('turns', turns, matching);
  }

  function handleSelectPattern(patternId: string): void {
    const matching = sliceAndGridFiltered.filter(d => d.reversalPattern === patternId);
    drillOrSelect('reversal', patternId, matching);
  }

  function clearDrill(): void {
    drillFilter = null;
  }
</script>

<div class="loop-collection-view">
  <!-- Only show loop type pills when more than one type has decks -->
  {#if [...populatedLoopTypes].length > 1}
    <div class="pill-bar" role="tablist" aria-label="LOOP type filter">
      {#each LOOP_TYPE_LABELS as { id, label } (id)}
        {@const enabled = populatedLoopTypes.has(id)}
        {#if enabled}
          <button
            type="button"
            role="tab"
            class="loop-pill"
            class:active={activeLoopType === id}
            aria-selected={activeLoopType === id}
            aria-label="{label} LOOP type"
            onclick={() => { activeLoopType = id; }}
          >
            {label}
          </button>
        {/if}
      {/each}
    </div>
  {/if}

  <!-- Axis toggle - only show tabs with 2+ distinct values -->
  {#if visibleAxes.length > 1}
    <div class="axis-toggle" role="tablist" aria-label="Browse axis">
      {#each visibleAxes as axis (axis.id)}
        <button
          type="button"
          role="tab"
          class="axis-btn"
          class:active={activeAxis === axis.id}
          aria-selected={activeAxis === axis.id}
          aria-label="{axis.label}"
          onclick={() => (activeAxis = axis.id)}
        >
          {axis.label}
        </button>
      {/each}
    </div>
  {/if}

  <!-- Slice type + grid mode filter bar -->
  <LoopCatalogFilters
    catalogs={filteredCatalogs}
    {activeSliceType}
    {activeGridMode}
    filteredCount={sliceAndGridFiltered.length}
    onSliceTypeChange={(s) => activeSliceType = s}
    onGridModeChange={(g) => activeGridMode = g}
  />

  <!-- Grid content or drill-down list - vertically centered in remaining space -->
  <div class="grid-content">
    {#if drillFilter}
      <!-- Drill-down: filtered deck list -->
      <div class="drill-header">
        <button type="button" class="back-btn" aria-label="Go back to grid view" onclick={clearDrill}>
          <i class="fas fa-arrow-left" aria-hidden="true"></i>
          Back
        </button>
        <span class="drill-label">{drillLabel}</span>
        <span class="drill-count">{drilledCatalogs.length} {drilledCatalogs.length === 1 ? 'catalog' : 'catalogs'}</span>
      </div>
      <div class="catalog-grid">
        {#each drilledCatalogs as catalog (catalog.id)}
          <CatalogCard
            {catalog}
            tags=""
            onSelect={() => onSelectCatalog(catalog)}
          />
        {/each}
        {#if drilledCatalogs.length === 0}
          <div class="empty-state">No catalogs match this filter.</div>
        {/if}
      </div>
    {:else if activeAxis === 'beats'}
      <LoopStepGrid catalogs={sliceAndGridFiltered} onSelectBeatCount={handleSelectBeatCount} />
    {:else if activeAxis === 'turns'}
      <LoopTurnsGrid catalogs={sliceAndGridFiltered} onSelectTurns={handleSelectTurns} />
    {:else}
      <LoopReversalGrid catalogs={sliceAndGridFiltered} onSelectPattern={handleSelectPattern} />
    {/if}
  </div>
</div>

<style>
  .loop-collection-view {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }

  /* Loop type pill bar */
  .pill-bar {
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .loop-pill {
    padding: 6px 20px;
    border-radius: 20px;
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: all 0.15s ease;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .loop-pill.active {
    background: var(--loop-accent-bg, rgba(99, 183, 205, 0.2));
    border-color: var(--loop-accent-border, rgba(99, 183, 205, 0.4));
    color: var(--loop-accent, #63b7cd);
  }

  .loop-pill:not(.disabled):not(.active):hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.3));
    color: var(--theme-text, rgba(255, 255, 255, 0.8));
  }

  .loop-pill:focus-visible {
    outline: 2px solid var(--theme-accent, #63b3ed);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .loop-pill {
      transition: none;
    }
  }

  /* Axis toggle */
  .axis-toggle {
    display: flex;
    gap: 0;
    justify-content: center;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-lg, 12px);
    padding: 4px;
    width: fit-content;
    margin: 0 auto;
  }

  .axis-btn {
    padding: 6px 18px;
    border-radius: calc(var(--radius-lg, 12px) - 4px);
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: all 0.15s ease;
    border: none;
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .axis-btn.active {
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, #ffffff);
  }

  .axis-btn:not(.active):hover {
    color: var(--theme-text, rgba(255, 255, 255, 0.8));
  }

  .axis-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #63b3ed);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .axis-btn {
      transition: none;
    }
  }

  .grid-content {
    width: 100%;
    max-width: 960px;
  }

  /* Drill-down view */
  .drill-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .back-btn:hover {
    color: var(--theme-text, #ffffff);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .drill-label {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .drill-count {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .catalog-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px;
  }

  .empty-state {
    text-align: center;
    padding: 32px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
  }

  @media (prefers-reduced-motion: reduce) {
    .back-btn {
      transition: none;
    }
  }
</style>

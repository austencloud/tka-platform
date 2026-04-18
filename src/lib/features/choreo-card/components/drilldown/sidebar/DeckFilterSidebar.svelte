<script lang="ts">
  import type { DrillDownState } from '../../../state/deck-drilldown-state.svelte';
  import type { Deck } from '../../../domain/models/Deck';
  import CollectionSection from './CollectionSection.svelte';
  import ShapeSection from './ShapeSection.svelte';
  import CategorySection from './CategorySection.svelte';
  import StepCountSection from './StepCountSection.svelte';
  import TurnPatternSection from './TurnPatternSection.svelte';
  import ReversalSection from './ReversalSection.svelte';

  interface Props {
    state: DrillDownState;
    allDecks: Deck[];
  }

  let { state, allDecks }: Props = $props();

  const accentColor = $derived(
    state.selections.path === 'VTG' ? '#b763cd' : '#63b7cd'
  );

  const isLoops = $derived(state.selections.path === 'LOOPs');
  const isVtg = $derived(state.selections.path === 'VTG');
  const hasPath = $derived(state.selections.path !== null);

  const collectionDecks = $derived(
    hasPath ? allDecks.filter(d => d.collection === state.selections.path) : []
  );

  // Decks filtered by everything EXCEPT reversal — so the reversal section
  // can show all available options, not just the one already selected.
  const decksBeforeReversal = $derived.by(() => {
    let result = allDecks;
    const sel = state.selections;
    if (sel.path) result = result.filter(d => d.collection === sel.path);
    if (sel.shape) {
      const lowerTypes = sel.shape.loopTypes.map(t => t.toLowerCase());
      const sliceLower = sel.shape.sliceType.toLowerCase();
      const gridLower = sel.shape.gridMode.toLowerCase();
      result = result.filter(d =>
        lowerTypes.includes(d.loopType?.toLowerCase()) &&
        d.sliceType.toLowerCase() === sliceLower &&
        d.gridMode.toLowerCase() === gridLower
      );
    }
    if (sel.category) {
      const familyLower = sel.category.vtgFamily.toLowerCase();
      const gridLower = sel.category.gridMode.toLowerCase();
      result = result.filter(d =>
        d.families.some(f => f.id.toLowerCase().includes(familyLower)) &&
        d.gridMode.toLowerCase() === gridLower
      );
    }
    if (sel.stepCount !== null) result = result.filter(d => d.stepCount === sel.stepCount);
    if (sel.turnPattern !== null) {
      const selTurn = sel.turnPattern.toLowerCase().replace(/\s+/g, '-');
      result = result.filter(d => {
        const deckTurn = d.turnPattern.toLowerCase().replace(/\s+/g, '-');
        return deckTurn === selTurn || deckTurn === `uniform-${selTurn}`;
      });
    }
    // Deliberately NOT filtering by reversalPattern
    return result;
  });
</script>

<aside class="filter-sidebar" style="--accent: {accentColor}; --accent-rgb: {state.selections.path === 'VTG' ? '183,99,205' : '99,183,205'}">
  <div class="sidebar-header">
    <span class="sidebar-title">Filter Decks</span>
    {#if hasPath}
      <button class="clear-btn" onclick={state.reset} type="button">Clear all</button>
    {/if}
  </div>

  <CollectionSection
    selectedPath={state.selections.path}
    {accentColor}
    onSelectPath={state.selectPath}
  />

  {#if isLoops}
    <ShapeSection
      decks={collectionDecks}
      currentShape={state.selections.shape}
      {accentColor}
      onSelectShape={state.selectShape}
      onInitShape={state.initShapeDefaults}
    />

    <StepCountSection
      availableCounts={state.availableStepCounts}
      selectedCount={state.selections.stepCount}
      {accentColor}
      onSelectCount={state.selectStepCount}
    />
  {/if}

  {#if isVtg}
    <CategorySection
      currentCategory={state.selections.category}
      {accentColor}
      onSelectCategory={state.selectCategory}
    />
  {/if}

  {#if hasPath}
    <TurnPatternSection
      availablePatterns={state.availableTurnPatterns}
      selectedPattern={state.selections.turnPattern}
      {accentColor}
      onSelectPattern={state.selectTurnPattern}
    />

    <ReversalSection
      filteredDecks={decksBeforeReversal}
      selectedPattern={state.selections.reversalPattern}
      {accentColor}
      onSelectPattern={state.selectReversalPattern}
    />
  {/if}
</aside>

<style>
  .filter-sidebar {
    width: 280px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow-y: auto;
    max-height: calc(100vh - 120px);
    padding-right: 8px;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 4px;
  }

  .sidebar-title {
    font-size: 14px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.6);
  }

  .clear-btn {
    font-size: 12px;
    color: var(--accent, #63b7cd);
    background: none;
    border: none;
    cursor: pointer;
    font-family: inherit;
    padding: 4px 8px;
    border-radius: 4px;
    transition: background 0.15s ease;
  }

  .clear-btn:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  /* Compact DrillPills for sidebar — 36px min-height preserves pointer accessibility */
  .filter-sidebar :global(.drill-pill) {
    padding: 8px 16px;
    font-size: 13px;
    border-radius: 8px;
    min-height: 36px;
  }

  .filter-sidebar::-webkit-scrollbar {
    width: 4px;
  }

  .filter-sidebar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
  }

  .filter-sidebar::-webkit-scrollbar-track {
    background: transparent;
  }
</style>

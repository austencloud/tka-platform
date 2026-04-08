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
</script>

<aside class="filter-sidebar" style="--accent: {accentColor}; --accent-rgb: {state.selections.path === 'VTG' ? '183,99,205' : '99,183,205'}">
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
      filteredDecks={state.filteredDecks}
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
    gap: 12px;
    overflow-y: auto;
    max-height: calc(100vh - 120px);
    padding-right: 8px;
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

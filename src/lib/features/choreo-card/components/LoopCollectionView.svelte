<script lang="ts">
  import type { Deck } from "../domain/models/Deck";
  import LoopBeatGrid from "./LoopBeatGrid.svelte";
  import LoopTurnsGrid from "./LoopTurnsGrid.svelte";
  import LoopReversalGrid from "./LoopReversalGrid.svelte";
  import DeckCard from "./DeckCard.svelte";

  interface Props {
    decks: Deck[];
    onSelectDeck: (deck: Deck) => void;
  }

  const { decks, onSelectDeck }: Props = $props();

  // Loop type pill bar state
  type LoopType = 'strict_rotated' | 'mirrored' | 'swapped' | 'inverted' | 'rewound';

  const LOOP_TYPE_LABELS: { id: LoopType; label: string }[] = [
    { id: 'strict_rotated', label: 'Rotated' },
    { id: 'mirrored', label: 'Mirrored' },
    { id: 'swapped', label: 'Swapped' },
    { id: 'inverted', label: 'Inverted' },
    { id: 'rewound', label: 'Rewound' },
  ];

  let activeLoopType = $state<LoopType>('strict_rotated');

  // Axis toggle state
  type AxisView = 'beats' | 'turns' | 'reversal';
  let activeAxis = $state<AxisView>('beats');

  // Drill-down filter: when set, shows a filtered list of decks
  let drillFilter = $state<{ axis: AxisView; value: string | number } | null>(null);

  // Which loop types have any matching decks
  const populatedLoopTypes = $derived(
    new Set(decks.map(d => d.loopType || 'strict_rotated'))
  );

  // Decks filtered by active loop type
  const filteredDecks = $derived(
    decks.filter(d => (d.loopType || 'strict_rotated') === activeLoopType)
  );

  // Decks filtered by drill-down selection
  const drilledDecks = $derived(
    drillFilter
      ? filteredDecks.filter(d => {
          if (drillFilter!.axis === 'beats') return (d.beatCount || 0) === drillFilter!.value;
          if (drillFilter!.axis === 'turns') return (d.turns ?? 0) === drillFilter!.value;
          if (drillFilter!.axis === 'reversal') return (d.reversalPattern || 'continuous') === drillFilter!.value;
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

  function drillOrSelect(axis: AxisView, value: string | number, matchingDecks: Deck[]): void {
    if (matchingDecks.length === 1) {
      onSelectDeck(matchingDecks[0]!);
    } else {
      drillFilter = { axis, value };
    }
  }

  function handleSelectBeatCount(beatCount: number): void {
    const matching = filteredDecks.filter(d => (d.beatCount || 0) === beatCount);
    drillOrSelect('beats', beatCount, matching);
  }

  function handleSelectTurns(turns: number): void {
    const matching = filteredDecks.filter(d => (d.turns ?? 0) === turns);
    drillOrSelect('turns', turns, matching);
  }

  function handleSelectPattern(patternId: string): void {
    const matching = filteredDecks.filter(d => (d.reversalPattern || 'continuous') === patternId);
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
            onclick={() => { activeLoopType = id; }}
          >
            {label}
          </button>
        {/if}
      {/each}
    </div>
  {/if}

  <!-- Axis toggle -->
  <div class="axis-toggle" role="tablist" aria-label="Browse axis">
    <button
      type="button"
      role="tab"
      class="axis-btn"
      class:active={activeAxis === 'beats'}
      aria-selected={activeAxis === 'beats'}
      onclick={() => (activeAxis = 'beats')}
    >
      By Beats
    </button>
    <button
      type="button"
      role="tab"
      class="axis-btn"
      class:active={activeAxis === 'turns'}
      aria-selected={activeAxis === 'turns'}
      onclick={() => (activeAxis = 'turns')}
    >
      By Turns
    </button>
    <button
      type="button"
      role="tab"
      class="axis-btn"
      class:active={activeAxis === 'reversal'}
      aria-selected={activeAxis === 'reversal'}
      onclick={() => (activeAxis = 'reversal')}
    >
      By Reversal
    </button>
  </div>

  <!-- Grid content or drill-down list — vertically centered in remaining space -->
  <div class="grid-content">
    {#if drillFilter}
      <!-- Drill-down: filtered deck list -->
      <div class="drill-header">
        <button type="button" class="back-btn" onclick={clearDrill}>
          <i class="fas fa-arrow-left" aria-hidden="true"></i>
          Back
        </button>
        <span class="drill-label">{drillLabel}</span>
        <span class="drill-count">{drilledDecks.length} {drilledDecks.length === 1 ? 'deck' : 'decks'}</span>
      </div>
      <div class="deck-grid">
        {#each drilledDecks as deck (deck.id)}
          <DeckCard
            {deck}
            onSelect={() => onSelectDeck(deck)}
          />
        {/each}
        {#if drilledDecks.length === 0}
          <div class="empty-state">No decks match this filter.</div>
        {/if}
      </div>
    {:else if activeAxis === 'beats'}
      <LoopBeatGrid decks={filteredDecks} onSelectBeatCount={handleSelectBeatCount} />
    {:else if activeAxis === 'turns'}
      <LoopTurnsGrid decks={filteredDecks} onSelectTurns={handleSelectTurns} />
    {:else}
      <LoopReversalGrid decks={filteredDecks} onSelectPattern={handleSelectPattern} />
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
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: transparent;
    color: rgba(255, 255, 255, 0.5);
  }

  .loop-pill.active {
    background: rgba(99, 183, 205, 0.2);
    border-color: rgba(99, 183, 205, 0.4);
    color: #63b7cd;
  }

  .loop-pill.disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .loop-pill:not(.disabled):not(.active):hover {
    border-color: rgba(255, 255, 255, 0.3);
    color: rgba(255, 255, 255, 0.8);
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
    color: rgba(255, 255, 255, 0.5);
  }

  .axis-btn.active {
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, #ffffff);
  }

  .axis-btn:not(.active):hover {
    color: rgba(255, 255, 255, 0.8);
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

  .deck-grid {
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

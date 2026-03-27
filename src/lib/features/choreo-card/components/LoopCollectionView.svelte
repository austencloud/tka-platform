<script lang="ts">
  import type { Deck } from "../domain/models/Deck";
  import LoopBeatGrid from "./LoopBeatGrid.svelte";
  import LoopTurnsGrid from "./LoopTurnsGrid.svelte";
  import LoopReversalGrid from "./LoopReversalGrid.svelte";

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

  // Which loop types have any matching decks
  const populatedLoopTypes = $derived(
    new Set(decks.map(d => d.loopType || 'strict_rotated'))
  );

  // Decks filtered by active loop type
  const filteredDecks = $derived(
    decks.filter(d => (d.loopType || 'strict_rotated') === activeLoopType)
  );

  function handleSelectBeatCount(beatCount: number): void {
    console.log('Selected beat count:', beatCount);
  }

  function handleSelectTurns(turns: number): void {
    console.log('Selected turns:', turns);
  }

  function handleSelectPattern(patternId: string): void {
    console.log('Selected reversal pattern:', patternId);
  }
</script>

<div class="loop-collection-view">
  <!-- Loop type pill bar -->
  <div class="pill-bar" role="tablist" aria-label="LOOP type filter">
    {#each LOOP_TYPE_LABELS as { id, label } (id)}
      {@const enabled = populatedLoopTypes.has(id)}
      <button
        type="button"
        role="tab"
        class="loop-pill"
        class:active={activeLoopType === id}
        class:disabled={!enabled}
        disabled={!enabled}
        aria-selected={activeLoopType === id}
        aria-disabled={!enabled}
        onclick={() => { if (enabled) activeLoopType = id; }}
      >
        {label}
      </button>
    {/each}
  </div>

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

  <!-- Grid content -->
  <div class="grid-content">
    {#if activeAxis === 'beats'}
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
    gap: 24px;
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
    background: var(--theme-accent, #63b3ed);
    border-color: var(--theme-accent, #63b3ed);
    color: var(--theme-text, #ffffff);
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
  }
</style>

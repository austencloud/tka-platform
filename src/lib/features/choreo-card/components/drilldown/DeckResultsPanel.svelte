<script lang="ts">
  import type { Deck } from '../../domain/models/Deck';

  interface Props {
    decks: Deck[];
    onSelectDeck: (deck: Deck) => void;
  }

  let { decks, onSelectDeck }: Props = $props();

  function formatCount(n: number): string {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }

  function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // Build a short label showing only what differentiates this deck from siblings.
  // The sidebar already shows collection/shape/grid/steps, so the card only needs
  // the parts that vary across the result set: step count, turn pattern, reversal.
  function shortLabel(deck: Deck): string {
    const parts: string[] = [];

    // Include step count if the result set has multiple
    const stepCounts = new Set(decks.map(d => d.stepCount));
    if (stepCounts.size > 1) parts.push(`${deck.stepCount}-Step`);

    // Turn pattern — format "uniform-0t" → "0T", others capitalize
    const turn = deck.turnPattern;
    const uniformMatch = turn.match(/^uniform[- ](\d+(?:\.\d+)?)t$/i);
    if (uniformMatch) {
      parts.push(`${uniformMatch[1]}T`);
    } else {
      parts.push(capitalize(turn.replace(/-/g, ' ')));
    }

    // Reversal pattern
    parts.push(capitalize(deck.reversalPattern.replace(/-/g, ' ')));

    // Slice type if mixed
    const sliceTypes = new Set(decks.map(d => d.sliceType));
    if (sliceTypes.size > 1) parts.push(capitalize(deck.sliceType));

    // Grid mode if mixed
    const gridModes = new Set(decks.map(d => d.gridMode));
    if (gridModes.size > 1) parts.push(capitalize(deck.gridMode));

    return parts.join(' · ');
  }
</script>

<div class="results-panel">
  <div class="results-header">
    {#if decks.length === 0}
      <span>No decks match</span>
    {:else if decks.length === 1}
      <span>1 deck — click to open</span>
    {:else}
      <span>{decks.length} decks match</span>
    {/if}
  </div>

  <div class="deck-grid">
    {#each decks as deck, i (deck.id)}
      <button
        class="deck-card"
        style="animation-delay: {Math.min(i * 30, 300)}ms"
        onclick={() => onSelectDeck(deck)}
        aria-label="Open {deck.canonicalName ?? deck.name} with {deck.totalSequences} sequences"
      >
        <span class="deck-name">{shortLabel(deck)}</span>
        <div class="deck-meta">
          <span>{formatCount(deck.totalSequences)} seq</span>
          <span>{deck.families.length} families</span>
        </div>
      </button>
    {/each}
  </div>
</div>

<style>
  .results-panel {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .results-header {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.4);
    margin-bottom: 16px;
  }

  .deck-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 14px;
    align-content: start;
    flex: 1;
    overflow-y: auto;
  }

  .deck-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 24px 16px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    cursor: pointer;
    font-family: inherit;
    color: var(--theme-text, #ffffff);
    text-align: center;
    min-height: 100px;
    animation: card-enter 0.25s ease-out both;
    transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
  }

  .deck-card:hover {
    border-color: rgba(255, 255, 255, 0.15);
    transform: translateY(-3px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  }

  .deck-card:focus-visible {
    outline: 2px solid var(--accent, #63b7cd);
    outline-offset: 2px;
  }

  .deck-name {
    font-size: 13px;
    font-weight: 600;
    line-height: 1.3;
  }

  .deck-meta {
    display: flex;
    gap: 10px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.35);
  }

  @keyframes card-enter {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .deck-card { animation: none; transition: none; }
    .deck-card:hover { transform: none; }
  }
</style>

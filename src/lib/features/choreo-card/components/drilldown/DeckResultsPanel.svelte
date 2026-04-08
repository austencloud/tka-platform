<script lang="ts">
  import type { Deck } from '../../domain/models/Deck';

  interface Props {
    decks: Deck[];
    onSelectDeck: (deck: Deck) => void;
  }

  let { decks, onSelectDeck }: Props = $props();

  const MAX_COMFORTABLE = 24;

  const totalSequences = $derived(
    decks.reduce((sum, d) => sum + d.totalSequences, 0)
  );

  function formatCount(n: number): string {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }

  function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // Some decks encode the turn ratio in the ID (e.g., "...-8beat-2to1" = 0.5T)
  // Map ratio suffixes to human-readable turn values
  const RATIO_TO_TURN: Record<string, string> = {
    '': '0T', '2to1': '0.5T', '3to1': '1T', '4to1': '1.5T',
    '5to1': '2T', '6to1': '2.5T', '7to1': '3T',
  };

  function extractRatioLabel(deck: Deck): string | null {
    const m = deck.id.match(/(\d+to\d+)$/);
    if (m && RATIO_TO_TURN[m[1]]) return RATIO_TO_TURN[m[1]]!;
    // No ratio suffix = base deck (0T)
    if (decks.some(d => d.id !== deck.id && d.id.match(/\d+to\d+$/))) {
      return '0T';
    }
    return null;
  }

  function formatTurn(turn: string): string {
    const m = turn.match(/^uniform[- ](\d+(?:\.\d+)?)t$/i);
    return m ? `${m[1]}T` : capitalize(turn.replace(/-/g, ' '));
  }

  // Only show the axes that actually vary across the current result set.
  // If every card shares the same turn pattern, don't show it — the sidebar
  // already told you. Only label what distinguishes THIS card from its siblings.
  const varyingAxes = $derived.by(() => {
    if (decks.length <= 1) return { stepCount: false, turn: false, reversal: false, slice: false, grid: false };
    return {
      stepCount: new Set(decks.map(d => d.stepCount)).size > 1,
      turn: new Set(decks.map(d => d.turnPattern)).size > 1,
      reversal: new Set(decks.map(d => d.reversalPattern)).size > 1,
      slice: new Set(decks.map(d => d.sliceType)).size > 1,
      grid: new Set(decks.map(d => d.gridMode)).size > 1,
    };
  });

  function shortLabel(deck: Deck): string {
    const parts: string[] = [];
    const v = varyingAxes;

    if (v.stepCount) parts.push(`${deck.stepCount}-Step`);
    if (v.slice) parts.push(capitalize(deck.sliceType));
    if (v.turn) parts.push(formatTurn(deck.turnPattern));
    if (v.reversal) parts.push(capitalize(deck.reversalPattern.replace(/-/g, ' ')));
    if (v.grid) parts.push(capitalize(deck.gridMode));

    // If nothing varies by field, the decks differ by turn ratio embedded in the ID
    // (e.g., "...-8beat-2to1" vs "...-8beat-3to1" which are 0.5T vs 1T)
    if (parts.length === 0) {
      const ratioLabel = extractRatioLabel(deck);
      if (ratioLabel) {
        parts.push(ratioLabel);
      } else {
        parts.push(formatTurn(deck.turnPattern));
      }
      parts.push(capitalize(deck.reversalPattern.replace(/-/g, ' ')));
    }

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
      <span>{decks.length} decks</span>
    {/if}
  </div>

  {#if decks.length > MAX_COMFORTABLE}
    <div class="narrow-prompt">
      <p class="narrow-title">Too many decks to browse</p>
      <p class="narrow-hint">Use the filters to narrow down. Try selecting a step count or turn pattern.</p>
      <p class="narrow-count">{decks.length} decks across {formatCount(totalSequences)} sequences</p>
    </div>
  {:else}
    <div class="deck-grid">
      {#each decks as deck, i (deck.id)}
        <button
          class="deck-card"
          style="animation-delay: {Math.min(i * 30, 300)}ms"
          onclick={() => onSelectDeck(deck)}
          aria-label="Open {shortLabel(deck)} with {deck.totalSequences} sequences"
        >
          <span class="deck-name">{shortLabel(deck)}</span>
          <div class="deck-meta">
            <span>{formatCount(deck.totalSequences)} seq</span>
            <span>{deck.families.length} families</span>
          </div>
        </button>
      {/each}
    </div>
  {/if}
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
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
    align-content: start;
    flex: 1;
    overflow-y: auto;
  }

  .deck-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 32px 20px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    cursor: pointer;
    font-family: inherit;
    color: var(--theme-text, #ffffff);
    text-align: center;
    min-height: 120px;
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
    font-size: 16px;
    font-weight: 600;
    line-height: 1.3;
  }

  .deck-meta {
    display: flex;
    gap: 10px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.35);
  }

  .narrow-prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    flex: 1;
    text-align: center;
    padding: 48px 24px;
  }

  .narrow-title {
    font-size: 18px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.5);
  }

  .narrow-hint {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.35);
    max-width: 320px;
    line-height: 1.5;
  }

  .narrow-count {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.2);
    margin-top: 8px;
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

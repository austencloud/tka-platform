<script lang="ts">
  import type { Deck } from "../domain/models/Deck";
  import { getReversalPattern } from "../domain/reversal-patterns";

  interface Props {
    deck: Deck;
    onSelect: () => void;
  }

  const { deck, onSelect }: Props = $props();

  const patternDef = $derived(
    deck.reversalPattern ? getReversalPattern(deck.reversalPattern) : null
  );

  const displayLabel = $derived(patternDef?.label ?? "Continuous");
  const displayDescription = $derived(
    patternDef?.description ?? "No reversals. Props maintain rotation direction throughout."
  );

  const displaySymbols = $derived(
    patternDef
      ? patternDef.sequence.slice(0, Math.min(8, patternDef.period)).split("")
      : ["-", "-", "-", "-"]
  );

  const showEllipsis = $derived(patternDef ? patternDef.period > 8 : false);

  function getDotPair(symbol: string): [boolean, boolean] {
    switch (symbol) {
      case "P": return [true, true];
      case "R": return [true, false];
      case "B": return [false, true];
      default:  return [false, false];
    }
  }

  function formatCount(n: number): string {
    if (n >= 1000) {
      return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    }
    return String(n);
  }
</script>

<button
  type="button"
  class="deck-card"
  aria-label="Open {displayLabel} deck with {deck.totalSequences} sequences"
  onclick={onSelect}
>
  <div class="dots-row">
    {#each displaySymbols as symbol}
      {@const [redDot, blueDot] = getDotPair(symbol)}
      <div class="dot-pair">
        <div class="dot" class:red={redDot} class:empty={!redDot} aria-hidden="true"></div>
        <div class="dot" class:blue={blueDot} class:empty={!blueDot} aria-hidden="true"></div>
      </div>
    {/each}
    {#if showEllipsis}
      <span class="ellipsis">...</span>
    {/if}
  </div>

  <span class="card-label">{displayLabel}</span>
  <span class="card-description">{displayDescription}</span>

  <div class="card-footer">
    <span class="card-count">{formatCount(deck.totalSequences)} sequences</span>
    <span class="card-families">{deck.families.length} families</span>
  </div>
</button>

<style>
  .deck-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 24px 20px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 14px;
    cursor: pointer;
    color: var(--theme-text, #ffffff);
    transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
    text-align: center;
    min-height: 140px;
  }

  .deck-card:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    transform: translateY(-4px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
  }

  .deck-card:focus-visible {
    outline: 2px solid var(--theme-accent, #6c8ee8);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .deck-card {
      transition: none;
    }
    .deck-card:hover {
      transform: none;
    }
  }

  .dots-row {
    display: flex;
    align-items: center;
    gap: 5px;
    justify-content: center;
  }

  .dot-pair {
    display: flex;
    flex-direction: column;
    gap: 2px;
    align-items: center;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .dot.red {
    background-color: var(--prop-red, #e74c3c);
  }

  .dot.blue {
    background-color: var(--prop-blue, #3498db);
  }

  .dot.empty {
    background-color: rgba(255, 255, 255, 0.08);
  }

  .ellipsis {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .card-label {
    font-size: 16px;
    font-weight: 600;
    line-height: 1.2;
  }

  .card-description {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    line-height: 1.4;
    max-width: 220px;
  }

  .card-footer {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-top: 4px;
  }

  .card-count,
  .card-families {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }
</style>

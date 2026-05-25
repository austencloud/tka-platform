<script lang="ts">
  import type { Deck } from "../domain/models/Deck";
  import { getReversalPattern } from "../domain/reversal-patterns";

  interface Props {
    deck: Deck;
    tags: string;
    onSelect: () => void;
  }

  const { deck, tags, onSelect }: Props = $props();

  const patternDef = $derived(
    deck.reversalPattern ? getReversalPattern(deck.reversalPattern) : null
  );

  const displayLabel = $derived(patternDef?.label ?? "Continuous");

  const displaySymbols = $derived(
    patternDef
      ? patternDef.sequence.slice(0, Math.min(8, patternDef.period)).split("")
      : ["-", "-", "-", "-"]
  );

  function getDotPair(symbol: string): [boolean, boolean] {
    switch (symbol) {
      case "P": return [true, true];
      case "R": return [true, false];
      case "B": return [false, true];
      default:  return [false, false];
    }
  }

  function formatCount(n: number): string {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    return String(n);
  }
</script>

<button
  type="button"
  class="deck-card"
  aria-label="Open {displayLabel} deck with {deck.totalSequences} sequences"
  onclick={onSelect}
>
  <div class="card-picto" aria-hidden="true">
    <svg viewBox="0 0 36 36" width="36" height="36">
      <circle cx="18" cy="4" r="3" fill="rgba(255,255,255,0.15)" />
      <circle cx="32" cy="18" r="3" fill="rgba(255,255,255,0.15)" />
      <circle cx="18" cy="32" r="3" fill="rgba(255,255,255,0.15)" />
      <circle cx="4" cy="18" r="3" fill="rgba(255,255,255,0.15)" />
    </svg>
  </div>

  <div class="card-center">
    <span class="card-name">{displayLabel}</span>
    <span class="card-meta">
      {formatCount(deck.totalSequences)} seq · {deck.stepCount}-step{#if tags} · {tags}{/if}
    </span>
  </div>

  <div class="card-dots">
    {#each displaySymbols as symbol}
      {@const [redDot, blueDot] = getDotPair(symbol)}
      <div class="dot-col">
        <div class="dot" class:red={redDot} class:empty={!redDot}></div>
        <div class="dot" class:blue={blueDot} class:empty={!blueDot}></div>
      </div>
    {/each}
  </div>
</button>

<style>
  .deck-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    cursor: pointer;
    color: var(--theme-text, #fff);
    text-align: left;
    width: 100%;
    font: inherit;
    transition: border-color 0.15s ease;
  }

  .deck-card:hover {
    border-color: var(--accent, #63b7cd);
  }

  .deck-card:focus-visible {
    outline: 2px solid var(--accent, #63b7cd);
    outline-offset: 2px;
  }

  .card-picto {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
  }

  .card-center {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .card-name {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-meta {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    line-height: 1.3;
  }

  .card-dots {
    display: flex;
    gap: 3px;
    flex-shrink: 0;
  }

  .dot-col {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 2px;
  }

  .dot.red { background: var(--prop-red, #e74c3c); }
  .dot.blue { background: var(--prop-blue, #3498db); }
  .dot.empty { background: var(--theme-card-bg, rgba(255, 255, 255, 0.08)); }

  @media (max-width: 768px) {
    .card-picto { width: 28px; height: 28px; }
    .card-picto :global(svg) { width: 28px; height: 28px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .deck-card { transition: none; }
  }
</style>

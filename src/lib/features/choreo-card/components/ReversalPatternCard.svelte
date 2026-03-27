<script lang="ts">
  import type { ReversalPatternDef } from "../domain/reversal-patterns";

  interface Props {
    pattern: ReversalPatternDef;
    sequenceCount: number;
    onclick: () => void;
  }

  const { pattern, sequenceCount, onclick }: Props = $props();

  const displaySymbols = $derived(
    pattern.sequence.slice(0, Math.min(8, pattern.period)).split("")
  );

  const showEllipsis = $derived(pattern.period > 8);

  function getDotPair(symbol: string): [boolean, boolean] {
    switch (symbol) {
      case "P": return [true, true];
      case "R": return [true, false];
      case "B": return [false, true];
      default:  return [false, false];
    }
  }
</script>

<button
  type="button"
  class="reversal-card"
  aria-label="Open {pattern.label} reversal pattern"
  {onclick}
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

  <span class="card-label">{pattern.label}</span>
  <span class="card-description">{pattern.description}</span>
  <span class="card-count">{sequenceCount} sequences</span>
</button>

<style>
  .reversal-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 24px 20px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-lg, 12px);
    cursor: pointer;
    color: var(--theme-text, #ffffff);
    transition: border-color 0.15s ease;
    text-align: center;
    min-height: 140px;
  }

  .reversal-card:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .reversal-card:focus-visible {
    outline: 2px solid var(--theme-accent, #6c8ee8);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .reversal-card {
      transition: none;
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
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    line-height: 1.2;
  }

  .card-description {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    line-height: 1.4;
    max-width: 200px;
  }

  .card-count {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }
</style>

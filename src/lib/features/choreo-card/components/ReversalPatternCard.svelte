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

  /**
   * Map a symbol to its dot representation.
   * Returns an array of [redDot, blueDot] booleans.
   *
   * P symbol = red dot + blue dot (both true)
   * R symbol = red dot + empty dot (red true, blue false)
   * B symbol = empty dot + blue dot (red false, blue true)
   * '-' symbol = empty dot + empty dot (both false)
   */
  function getDotPair(symbol: string): [boolean, boolean] {
    switch (symbol) {
      case "P":
        return [true, true];
      case "R":
        return [true, false];
      case "B":
        return [false, true];
      case "-":
        return [false, false];
      default:
        return [false, false];
    }
  }
</script>

<button
  type="button"
  class="reversal-pattern-card"
  aria-label="Open {pattern.label} reversal pattern"
  {onclick}
>
  <div class="dots-row">
    {#each displaySymbols as symbol}
      {@const [redDot, blueDot] = getDotPair(symbol)}
      <div class="dot-pair">
        <div
          class="dot red-dot"
          class:filled={redDot}
          aria-hidden="true"
        ></div>
        <div
          class="dot blue-dot"
          class:filled={blueDot}
          aria-hidden="true"
        ></div>
      </div>
    {/each}
    {#if showEllipsis}
      <span class="ellipsis">...</span>
    {/if}
  </div>

  <span class="pattern-label">{pattern.label}</span>

  <div class="footer">
    <span class="stat">{sequenceCount} sequences</span>
  </div>
</button>

<style>
  .reversal-pattern-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 16px;
    min-width: 140px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-lg, 12px);
    cursor: pointer;
    color: var(--theme-text, #ffffff);
    transition: border-color 0.15s ease;
  }

  .reversal-pattern-card:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .reversal-pattern-card:focus-visible {
    outline: 2px solid var(--theme-accent, #6c8ee8);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .reversal-pattern-card {
      transition: none;
    }
  }

  .dots-row {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 20px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .dot-pair {
    display: flex;
    flex-direction: column;
    gap: 2px;
    align-items: center;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .red-dot {
    background-color: rgba(255, 255, 255, 0.08);
  }

  .red-dot.filled {
    background-color: var(--prop-red, #e74c3c);
  }

  .blue-dot {
    background-color: rgba(255, 255, 255, 0.08);
  }

  .blue-dot.filled {
    background-color: var(--prop-blue, #3498db);
  }

  .ellipsis {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .pattern-label {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    text-align: center;
    line-height: 1.2;
  }

  .footer {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    justify-content: center;
  }

  .stat {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }
</style>

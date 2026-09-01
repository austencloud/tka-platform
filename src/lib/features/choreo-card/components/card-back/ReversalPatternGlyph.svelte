<!--
  ReversalPatternGlyph - Tiny dot-pair columns showing the reversal pattern.
  Period-compressed: shows only one period of the pattern.
  Used on card backs to identify which reversal pattern deck a card belongs to.
-->
<script lang="ts">
  interface Props {
    sequence: string;  // e.g., "PPPP", "RBRB", "----"
    period: number;    // Number of columns to show
  }

  const { sequence, period }: Props = $props();

  // Show one period, capped at 8
  const symbols = $derived(
    sequence.slice(0, Math.min(8, period)).split('')
  );

  function getDots(symbol: string): { right: boolean; left: boolean } {
    switch (symbol) {
      case 'P': return { right: true, left: true };
      case 'R': return { right: true, left: false };
      case 'B': return { right: false, left: true };
      default:  return { right: false, left: false };
    }
  }
</script>

<div class="reversal-glyph">
  {#each symbols as symbol}
    {@const dots = getDots(symbol)}
    <div class="dot-col">
      <div class="dot" class:red={dots.right} class:empty={!dots.right}></div>
      <div class="dot" class:blue={dots.left} class:empty={!dots.left}></div>
    </div>
  {/each}
</div>

<style>
  .reversal-glyph {
    display: flex;
    gap: 0.6cqi;
    align-items: center;
  }

  .dot-col {
    display: flex;
    flex-direction: column;
    gap: 0.3cqi;
  }

  .dot {
    width: 1.8cqi;
    height: 1.8cqi;
    border-radius: 50%;
  }

  .dot.red { background: var(--tka-red-hand, #e74c3c); }
  .dot.blue { background: var(--tka-blue-hand, #3498db); }
  .dot.empty {
    background: var(--card-text-muted, rgba(255, 255, 255, 0.18));
    opacity: 0.4;
  }
</style>

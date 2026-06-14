<!--
  ArenaWinLossChart.svelte - SVG donut chart for win/loss ratio

  Two arcs (green wins, red losses) with count in center.
  Pure SVG, no external library.
-->
<script lang="ts">
  let {
    wins,
    losses,
    size = 80,
  }: {
    wins: number;
    losses: number;
    size?: number;
  } = $props();

  const total = $derived(wins + losses);
  const winFraction = $derived(total > 0 ? wins / total : 0);
  const cx = $derived(size / 2);
  const cy = $derived(size / 2);
  const radius = $derived(size / 2 - 6);
  const circumference = $derived(2 * Math.PI * radius);
  const winDash = $derived(circumference * winFraction);
  const lossDash = $derived(circumference * (1 - winFraction));
</script>

<div class="chart-container" style="width: {size}px; height: {size}px;">
  <svg viewBox="0 0 {size} {size}" width={size} height={size} aria-hidden="true">
    <!-- Loss arc (background) -->
    <circle
      {cx}
      {cy}
      r={radius}
      fill="none"
      stroke="var(--semantic-error, #ef4444)"
      stroke-width="8"
      opacity="0.6"
    />
    <!-- Win arc (foreground) -->
    {#if total > 0}
      <circle
        {cx}
        {cy}
        r={radius}
        fill="none"
        stroke="var(--semantic-success, #22c55e)"
        stroke-width="8"
        stroke-dasharray="{winDash} {lossDash}"
        stroke-linecap="round"
        transform="rotate(-90 {cx} {cy})"
      />
    {/if}
  </svg>
  <div class="chart-center">
    <span class="chart-total">{total}</span>
  </div>
</div>

<style>
  .chart-container {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .chart-container svg {
    position: absolute;
    inset: 0;
  }

  .chart-center {
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .chart-total {
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--theme-text, #fff);
    font-variant-numeric: tabular-nums;
  }
</style>

<!--
  ArenaRatingHistory.svelte - Rating over time line chart

  SVG polyline with gradient fill beneath. Shows recent rating trend.
  Pure SVG, no external library.
-->
<script lang="ts">
  import { ARENA_COLOR } from "../../domain/constants/arena-constants";

  let {
    dataPoints = [],
    width = 300,
    height = 120,
  }: {
    dataPoints: { date: Date; rating: number }[];
    width?: number;
    height?: number;
  } = $props();

  const padding = 8;
  const chartWidth = $derived(width - padding * 2);
  const chartHeight = $derived(height - padding * 2);

  const points = $derived(() => {
    if (dataPoints.length < 2) return "";
    const minR = Math.min(...dataPoints.map((d) => d.rating));
    const maxR = Math.max(...dataPoints.map((d) => d.rating));
    const range = maxR - minR || 1;

    return dataPoints
      .map((d, i) => {
        const x = padding + (i / (dataPoints.length - 1)) * chartWidth;
        const y = padding + chartHeight - ((d.rating - minR) / range) * chartHeight;
        return `${x},${y}`;
      })
      .join(" ");
  });

  const areaPath = $derived(() => {
    if (dataPoints.length < 2) return "";
    const minR = Math.min(...dataPoints.map((d) => d.rating));
    const maxR = Math.max(...dataPoints.map((d) => d.rating));
    const range = maxR - minR || 1;
    const bottom = padding + chartHeight;

    const pts = dataPoints.map((d, i) => {
      const x = padding + (i / (dataPoints.length - 1)) * chartWidth;
      const y = padding + chartHeight - ((d.rating - minR) / range) * chartHeight;
      return { x, y };
    });

    const first = pts[0]!;
    const last = pts[pts.length - 1]!;
    let path = `M ${first.x},${bottom}`;
    for (const p of pts) {
      path += ` L ${p.x},${p.y}`;
    }
    path += ` L ${last.x},${bottom} Z`;
    return path;
  });
</script>

<div class="rating-history">
  {#if dataPoints.length >= 2}
    <svg viewBox="0 0 {width} {height}" {width} {height} aria-label="Rating history chart">
      <defs>
        <linearGradient id="rating-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color={ARENA_COLOR} stop-opacity="0.3" />
          <stop offset="100%" stop-color={ARENA_COLOR} stop-opacity="0.02" />
        </linearGradient>
      </defs>
      <!-- Area fill -->
      <path d={areaPath()} fill="url(#rating-fill)" />
      <!-- Line -->
      <polyline
        points={points()}
        fill="none"
        stroke={ARENA_COLOR}
        stroke-width="2"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
    </svg>
  {:else}
    <div class="no-data">
      <span>Not enough data for a chart yet</span>
    </div>
  {/if}
</div>

<style>
  .rating-history {
    width: 100%;
  }

  .rating-history svg {
    width: 100%;
    height: auto;
  }

  .no-data {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 80px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
    font-size: var(--font-size-compact, 12px);
  }
</style>

<!--
  SequenceAnalyticsBadge.svelte - Analytics Overlay for Library Cards

  Shows engagement metrics (views, forks, stars) directly on sequence cards.
  This is a key differentiator from Gallery - only YOUR sequences show these.

  Features:
  - Compact overlay design (corner positioned)
  - Only shows non-zero values
  - Tooltip on hover
-->
<script lang="ts">
  interface Props {
    viewCount?: number;
    forkCount?: number;
    starCount?: number;
  }

  let { viewCount = 0, forkCount = 0, starCount = 0 }: Props = $props();

  // Only show metrics that have values
  const hasMetrics = $derived(viewCount > 0 || forkCount > 0 || starCount > 0);

  // Format numbers compactly
  function formatNumber(n: number): string {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 10000) return `${(n / 1000).toFixed(0)}K`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  }
</script>

{#if hasMetrics}
  <div class="analytics-badge" role="group" aria-label="Sequence engagement metrics">
    {#if viewCount > 0}
      <span class="metric views" title="{viewCount} views">
        <i class="fas fa-eye" aria-hidden="true"></i>
        <span class="value">{formatNumber(viewCount)}</span>
      </span>
    {/if}

    {#if forkCount > 0}
      <span class="metric forks" title="{forkCount} forks">
        <i class="fas fa-code-branch" aria-hidden="true"></i>
        <span class="value">{formatNumber(forkCount)}</span>
      </span>
    {/if}

    {#if starCount > 0}
      <span class="metric stars" title="{starCount} stars">
        <i class="fas fa-star" aria-hidden="true"></i>
        <span class="value">{formatNumber(starCount)}</span>
      </span>
    {/if}
  </div>
{/if}

<style>
  .analytics-badge {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: 3px 6px;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    border-radius: var(--radius-2026-sm, 8px);
    pointer-events: auto;
  }

  .metric {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.9);
    cursor: default;
  }

  .metric i {
    font-size: 9px;
    opacity: 0.8;
  }

  .value {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  /* Metric variants */
  .metric.views i {
    color: rgba(96, 165, 250, 0.95);
  }

  .metric.forks i {
    color: var(--semantic-success);
  }

  .metric.stars i {
    color: rgba(250, 204, 21, 0.95);
  }
</style>

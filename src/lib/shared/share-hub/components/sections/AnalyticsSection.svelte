<!--
  AnalyticsSection.svelte - Sequence Analytics Display

  Shows views, forks, and stars for published sequences.
  Only visible in Library mode or Discover mode (for owned sequences).
  Only renders if at least one metric > 0.
-->
<script lang="ts">
  interface Props {
    viewCount: number;
    forkCount: number;
    starCount: number;
  }

  let { viewCount = 0, forkCount = 0, starCount = 0 }: Props = $props();

  const hasAnalytics = $derived(viewCount > 0 || forkCount > 0 || starCount > 0);
</script>

{#if hasAnalytics}
  <div class="analytics-section">
    <h3 class="section-title">
      <i class="fas fa-chart-line" aria-hidden="true"></i>
      Analytics
    </h3>
    <div class="analytics-grid">
      <div class="analytics-card views">
        <div class="analytics-value">{viewCount}</div>
        <div class="analytics-label">
          <i class="fas fa-eye" aria-hidden="true"></i>
          Views
        </div>
      </div>
      <div class="analytics-card forks">
        <div class="analytics-value">{forkCount}</div>
        <div class="analytics-label">
          <i class="fas fa-code-branch" aria-hidden="true"></i>
          Forks
        </div>
      </div>
      <div class="analytics-card stars">
        <div class="analytics-value">{starCount}</div>
        <div class="analytics-label">
          <i class="fas fa-star" aria-hidden="true"></i>
          Stars
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .analytics-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .section-title i {
    color: var(--theme-accent);
  }

  .analytics-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .analytics-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 16px 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-md, 14px);
    text-align: center;
  }

  .analytics-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--theme-text);
    font-variant-numeric: tabular-nums;
  }

  .analytics-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim);
  }

  .analytics-label i {
    font-size: 10px;
  }

  .analytics-card.views .analytics-label i {
    color: rgba(96, 165, 250, 0.95);
  }

  .analytics-card.forks .analytics-label i {
    color: var(--semantic-success);
  }

  .analytics-card.stars .analytics-label i {
    color: rgba(250, 204, 21, 0.95);
  }
</style>

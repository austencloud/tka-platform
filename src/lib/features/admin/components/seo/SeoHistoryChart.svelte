<script lang="ts">
  import type { SeoHistoryPoint } from "$lib/features/admin/domain/models/seo-dashboard-model";
  import { formatDate, formatInteger } from "./seo-dashboard-format";

  let { history }: { history: SeoHistoryPoint[] } = $props();

  const maxImpressions = $derived(
    Math.max(1, ...history.map((point) => point.treatmentImpressions))
  );

  function barHeight(point: SeoHistoryPoint): number {
    if (point.treatmentImpressions === 0) return 4;
    return Math.max(8, (point.treatmentImpressions / maxImpressions) * 100);
  }
</script>

<section class="panel" aria-labelledby="history-title">
  <div class="panel-heading">
    <div>
      <span class="panel-kicker">Daily scorecards</span>
      <h3 id="history-title">Evidence trail</h3>
    </div>
    <span class="run-count"
      >{history.length} run{history.length === 1 ? "" : "s"}</span
    >
  </div>
  {#if history.length === 0}
    <div class="empty-history">
      <i class="fas fa-chart-column" aria-hidden="true"></i>
      <span>The first daily snapshot will start this trail.</span>
    </div>
  {:else}
    <div
      class="history-chart"
      role="img"
      aria-label={`Treatment impressions across ${history.length} daily SEO scorecards`}
    >
      {#each history as point (point.generatedDate)}
        <div
          class="history-column"
          title={`${formatDate(point.generatedDate)}: ${formatInteger(point.treatmentImpressions)} impressions`}
        >
          <span class="history-bar" style:height={`${barHeight(point)}%`}
          ></span>
          <span class="history-date">{point.generatedDate.slice(5)}</span>
        </div>
      {/each}
    </div>
  {/if}
</section>

<style>
  .panel {
    padding: clamp(14px, 1.6vw, 22px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 14px;
    background: var(--theme-card-bg, rgba(15, 23, 42, 0.74));
  }

  .panel-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }

  .panel-kicker {
    color: var(--semantic-seo-accent);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  h3 {
    margin: 3px 0 0;
    font-size: clamp(1rem, 0.92rem + 0.4vw, 1.25rem);
  }

  .run-count {
    min-width: 2.4rem;
    padding: 5px 9px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--theme-text, #fff) 7%, transparent);
    text-align: center;
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
  }

  .empty-history {
    display: flex;
    height: 150px;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: var(--theme-text-dim, rgba(248, 250, 252, 0.58));
    font-size: var(--font-size-min, 0.875rem);
  }

  .empty-history i {
    color: var(--semantic-seo-accent);
  }

  .history-chart {
    display: flex;
    height: 150px;
    align-items: flex-end;
    gap: clamp(4px, 0.7vw, 10px);
    padding: 12px 4px 0;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
  }

  .history-column {
    display: grid;
    min-width: 12px;
    height: 100%;
    flex: 1;
    grid-template-rows: 1fr 20px;
    align-items: end;
    gap: 5px;
  }

  .history-bar {
    display: block;
    width: 100%;
    min-height: 4px;
    border-radius: 5px 5px 2px 2px;
    background: linear-gradient(
      180deg,
      var(--semantic-seo-accent),
      var(--semantic-seo-accent-deep)
    );
    box-shadow: 0 0 12px
      color-mix(in srgb, var(--semantic-seo-accent) 20%, transparent);
  }

  .history-date {
    overflow: hidden;
    color: var(--theme-text-dim, rgba(248, 250, 252, 0.46));
    font-size: var(--font-size-compact, 0.75rem);
    text-align: center;
    text-overflow: clip;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 520px) {
    .panel-heading {
      align-items: stretch;
      flex-direction: column;
    }
  }
</style>

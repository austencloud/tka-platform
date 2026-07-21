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

  function barStyle(point: SeoHistoryPoint): string {
    return "height: " + barHeight(point) + "%";
  }

  function pointLabel(point: SeoHistoryPoint): string {
    return (
      formatDate(point.generatedDate) +
      ": " +
      formatInteger(point.treatmentImpressions) +
      " Google appearances"
    );
  }
</script>

<section class="panel" aria-labelledby="history-title">
  <div class="panel-heading">
    <div>
      <span class="panel-kicker">Growth line</span>
      <h3 id="history-title">Google appearances over time</h3>
    </div>
    <span class="run-count">
      {history.length} check{history.length === 1 ? "" : "s"}
    </span>
  </div>
  <p class="panel-explanation">
    Each check records how often the tracked pages appeared in Google.
  </p>

  {#if history.length === 0}
    <div class="empty-history">
      <i class="fas fa-chart-column" aria-hidden="true"></i>
      <div>
        <strong>No growth line yet.</strong>
        <span>The first measurement check will place the starting point.</span>
      </div>
    </div>
  {:else if history.length === 1}
    <div class="single-history">
      <span class="single-value">
        {formatInteger(history[0]?.treatmentImpressions)}
      </span>
      <div>
        <strong>Starting point recorded</strong>
        <span>
          More checks will show whether Google visibility is rising or falling.
        </span>
      </div>
    </div>
  {:else}
    <div
      class="history-chart"
      role="img"
      aria-label={"Google appearances across " +
        history.length +
        " measurement checks"}
    >
      {#each history as point (point.generatedDate)}
        <div class="history-column" title={pointLabel(point)}>
          <span class="history-bar" style={barStyle(point)}></span>
          <span class="history-date">{point.generatedDate.slice(5)}</span>
        </div>
      {/each}
    </div>
  {/if}
</section>

<style>
  .panel {
    height: 100%;
    padding: clamp(14px, 1.2vw, 20px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 14px;
    background: var(--theme-card-bg, rgba(15, 23, 42, 0.74));
  }

  .panel-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
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
    font-size: clamp(1rem, 0.92rem + 0.35vw, 1.25rem);
  }

  .run-count {
    min-width: 4.2rem;
    padding: 5px 9px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--theme-text, #fff) 7%, transparent);
    text-align: center;
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
  }

  .panel-explanation {
    margin: 10px 0 13px;
    color: var(--theme-text-dim, rgba(248, 250, 252, 0.62));
    font-size: var(--font-size-compact, 0.75rem);
    line-height: 1.4;
  }

  .empty-history,
  .single-history {
    display: flex;
    min-height: 174px;
    align-items: center;
    justify-content: center;
    gap: 13px;
    padding: 20px;
    border-radius: 11px;
    background: color-mix(in srgb, var(--theme-text, #fff) 3%, transparent);
  }

  .empty-history > i {
    color: var(--semantic-seo-accent);
    font-size: 1.35rem;
  }

  .empty-history > div,
  .single-history > div {
    display: flex;
    max-width: 23rem;
    flex-direction: column;
    gap: 5px;
  }

  .empty-history span,
  .single-history span:not(.single-value) {
    color: var(--theme-text-dim, rgba(248, 250, 252, 0.6));
    font-size: var(--font-size-compact, 0.75rem);
    line-height: 1.4;
  }

  .single-value {
    color: var(--semantic-seo-accent);
    font-size: clamp(2.25rem, 1.75rem + 1.2vw, 3.25rem);
    font-weight: 800;
    letter-spacing: -0.04em;
    font-variant-numeric: tabular-nums;
  }

  .history-chart {
    display: flex;
    height: 174px;
    align-items: flex-end;
    gap: clamp(4px, 0.45vw, 9px);
    padding: 12px 4px 0;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
  }

  .history-column {
    display: grid;
    min-width: 10px;
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
      flex-direction: column;
    }
  }
</style>

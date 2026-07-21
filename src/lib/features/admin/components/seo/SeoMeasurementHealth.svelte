<script lang="ts">
  import type { SeoDashboardSnapshot } from "$lib/features/admin/domain/models/seo-dashboard-model";

  let { snapshot }: { snapshot: SeoDashboardSnapshot } = $props();
</script>

<section class="health-grid" aria-label="Measurement health">
  <article
    class="health-card"
    class:healthy={snapshot.dataQuality.searchDataComplete}
  >
    <span class="health-dot" aria-hidden="true"></span>
    <div>
      <strong>Search Console</strong>
      <span>
        {snapshot.dataQuality.collectedSearchDays}/{snapshot.dataQuality
          .expectedSearchDays} finalized days
      </span>
    </div>
  </article>
  <article
    class="health-card"
    class:healthy={snapshot.dataQuality.postHogDataComplete}
  >
    <span class="health-dot" aria-hidden="true"></span>
    <div>
      <strong>PostHog</strong>
      <span>
        {snapshot.dataQuality.collectedPostHogDays}/{snapshot.dataQuality
          .expectedPostHogDays} session days
      </span>
    </div>
  </article>
  <article
    class="health-card"
    class:healthy={snapshot.indexability.sampleComplete}
  >
    <span class="health-dot" aria-hidden="true"></span>
    <div>
      <strong>URL inspection</strong>
      <span>
        {snapshot.indexability.inspected}/{snapshot.indexability.expected} sampled
        URLs
      </span>
    </div>
  </article>
  <article class="health-card" class:healthy={snapshot.cohorts.frozen}>
    <span class="health-dot" aria-hidden="true"></span>
    <div>
      <strong>Matched controls</strong>
      <span>
        {snapshot.cohorts.frozen
          ? `${snapshot.cohorts.frozenControlCount} locked before launch`
          : "Freeze before deployment"}
      </span>
    </div>
  </article>
</section>

<style>
  .health-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
    gap: 9px;
  }

  .health-card {
    display: flex;
    min-height: 68px;
    align-items: center;
    gap: 11px;
    padding: 12px 14px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    background: var(--theme-card-bg, rgba(15, 23, 42, 0.68));
  }

  .health-dot {
    width: 8px;
    height: 8px;
    flex: 0 0 auto;
    border-radius: 50%;
    background: var(--semantic-warning, #f59e0b);
  }

  .health-card.healthy .health-dot {
    background: var(--semantic-success, #22c55e);
    box-shadow: 0 0 9px
      color-mix(in srgb, var(--semantic-success, #22c55e) 55%, transparent);
  }

  .health-card > div {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 3px;
  }

  .health-card strong {
    font-size: var(--font-size-min, 0.875rem);
  }

  .health-card span:not(.health-dot) {
    overflow: hidden;
    color: var(--theme-text-dim, rgba(248, 250, 252, 0.58));
    font-size: var(--font-size-compact, 0.75rem);
    text-overflow: ellipsis;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 520px) {
    .health-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

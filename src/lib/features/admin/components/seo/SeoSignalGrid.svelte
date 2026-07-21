<script lang="ts">
  import type { SeoDashboardSnapshot } from "$lib/features/admin/domain/models/seo-dashboard-model";
  import {
    formatInteger,
    formatLift,
    formatPercent,
    formatPosition,
  } from "./seo-dashboard-format";

  let { snapshot }: { snapshot: SeoDashboardSnapshot } = $props();

  const activeSearch = $derived(
    snapshot.search.current ?? snapshot.search.baseline
  );
  const activeHeadTerm = $derived(
    snapshot.headTerm.current ?? snapshot.headTerm.baseline
  );
  const activeAcquisition = $derived(
    snapshot.acquisition.current ?? snapshot.acquisition.baseline
  );
  const activeAudit = $derived(
    snapshot.aiOverview.current.auditDate
      ? snapshot.aiOverview.current
      : snapshot.aiOverview.baseline
  );
</script>

<section class="signal-grid" aria-label="Current SEO signals">
  <article class="signal-card head-term-card">
    <div class="signal-icon">
      <i class="fas fa-crosshairs" aria-hidden="true"></i>
    </div>
    <div class="signal-copy">
      <span class="signal-label">“flow arts software”</span>
      <strong>{formatPosition(activeHeadTerm.position)}</strong>
      <span class="signal-note">Google average position</span>
    </div>
  </article>

  <article class="signal-card">
    <div class="signal-icon">
      <i class="fas fa-eye" aria-hidden="true"></i>
    </div>
    <div class="signal-copy">
      <span class="signal-label">Search impressions</span>
      <strong>{formatInteger(activeSearch.impressions)}</strong>
      <span class="signal-note">
        {formatLift(snapshot.search.controlAdjusted?.impressionLift)}
      </span>
    </div>
  </article>

  <article class="signal-card">
    <div class="signal-icon">
      <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>
    </div>
    <div class="signal-copy">
      <span class="signal-label">Organic activation</span>
      <strong>{formatPercent(activeAcquisition.activationRate)}</strong>
      <span class="signal-note">
        {formatInteger(activeAcquisition.activatedSessions)} activated sessions
      </span>
    </div>
  </article>

  <article class="signal-card">
    <div class="signal-icon">
      <i class="fas fa-link" aria-hidden="true"></i>
    </div>
    <div class="signal-copy">
      <span class="signal-label">Indexed sample</span>
      <strong>{formatPercent(snapshot.indexability.indexedRate)}</strong>
      <span class="signal-note">
        {snapshot.indexability.indexed} of {snapshot.indexability.expected} URLs
      </span>
    </div>
  </article>

  <article class="signal-card ai-card">
    <div class="signal-icon">
      <i class="fas fa-robot" aria-hidden="true"></i>
    </div>
    <div class="signal-copy">
      <span class="signal-label">AI Overview citations</span>
      <strong>{formatPercent(activeAudit.citationRate)}</strong>
      <span class="signal-note">
        {activeAudit.citedTka} citations across {activeAudit.auditedQueries} checks
      </span>
    </div>
  </article>
</section>

<style>
  .signal-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
    gap: 10px;
  }

  .signal-card {
    position: relative;
    display: flex;
    min-height: 132px;
    gap: 12px;
    padding: clamp(14px, 1.5vw, 20px);
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 14px;
    background: var(--theme-card-bg, rgba(15, 23, 42, 0.74));
  }

  .signal-card::after {
    position: absolute;
    inset: auto -28px -48px auto;
    width: 110px;
    height: 110px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--semantic-seo-accent) 9%, transparent);
    content: "";
  }

  .head-term-card {
    border-color: color-mix(
      in srgb,
      var(--semantic-seo-accent) 42%,
      transparent
    );
  }

  .ai-card {
    border-color: color-mix(
      in srgb,
      var(--semantic-seo-violet) 34%,
      transparent
    );
  }

  .signal-icon {
    display: grid;
    width: 34px;
    height: 34px;
    flex: 0 0 auto;
    place-items: center;
    border-radius: 10px;
    background: color-mix(in srgb, var(--semantic-seo-accent) 13%, transparent);
    color: var(--semantic-seo-accent);
  }

  .ai-card .signal-icon {
    background: color-mix(in srgb, var(--semantic-seo-violet) 14%, transparent);
    color: var(--semantic-seo-violet);
  }

  .signal-copy {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 5px;
  }

  .signal-label {
    min-height: 2.4em;
    color: var(--theme-text-dim, rgba(248, 250, 252, 0.68));
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.2;
  }

  .signal-copy strong {
    font-size: clamp(1.55rem, 1.15rem + 1.2vw, 2.25rem);
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .signal-note {
    color: var(--theme-text-dim, rgba(248, 250, 252, 0.56));
    font-size: var(--font-size-compact, 0.75rem);
  }

  @media (max-width: 520px) {
    .signal-grid {
      grid-template-columns: 1fr;
    }

    .signal-card {
      min-height: 112px;
    }
  }
</style>

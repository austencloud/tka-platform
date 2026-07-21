<script lang="ts">
  import type { SeoDashboardSnapshot } from "$lib/features/admin/domain/models/seo-dashboard-model";
  import {
    formatInteger,
    formatPercent,
    formatPosition,
    getSeoGrowthStory,
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
  const growth = $derived(getSeoGrowthStory(snapshot));
</script>

<section class="signal-grid" aria-label="SEO growth summary">
  <article class="growth-card growth-{growth.tone}">
    <div class="growth-heading">
      <span class="growth-icon" aria-hidden="true">
        <i class="fas fa-arrow-trend-up"></i>
      </span>
      <span>Growth since the SEO changes</span>
    </div>
    <strong class="growth-value">{growth.value}</strong>
    <div class="growth-copy">
      <b>{growth.headline}</b>
      <span>{growth.explanation}</span>
    </div>
    <p class="next-step">{growth.nextStep}</p>
  </article>

  <div class="support-signals">
    <article class="signal-card rank-card">
      <div class="signal-icon">
        <i class="fas fa-crosshairs" aria-hidden="true"></i>
      </div>
      <span class="signal-label">Google rank</span>
      <strong>{formatPosition(activeHeadTerm.position)}</strong>
      <span class="signal-note">For “flow arts software”</span>
    </article>

    <article class="signal-card">
      <div class="signal-icon">
        <i class="fas fa-eye" aria-hidden="true"></i>
      </div>
      <span class="signal-label">Google appearances</span>
      <strong>{formatInteger(activeSearch.impressions)}</strong>
      <span class="signal-note">Times tracked pages appeared in results</span>
    </article>

    <article class="signal-card">
      <div class="signal-icon">
        <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>
      </div>
      <span class="signal-label">Search visitors who start creating</span>
      <strong>{formatPercent(activeAcquisition.activationRate)}</strong>
      <span class="signal-note">
        {formatInteger(activeAcquisition.activatedSessions)} activated sessions
      </span>
    </article>

    <article class="signal-card">
      <div class="signal-icon">
        <i class="fas fa-link" aria-hidden="true"></i>
      </div>
      <span class="signal-label">Pages Google can show</span>
      <strong>{formatPercent(snapshot.indexability.indexedRate)}</strong>
      <span class="signal-note">
        {snapshot.indexability.indexed} of {snapshot.indexability.expected}
        sample pages indexed
      </span>
    </article>

    <article class="signal-card ai-card">
      <div class="signal-icon">
        <i class="fas fa-robot" aria-hidden="true"></i>
      </div>
      <span class="signal-label">AI answers mentioning TKA</span>
      <strong>{formatPercent(activeAudit.citationRate)}</strong>
      <span class="signal-note">
        {activeAudit.citedTka} mentions across {activeAudit.auditedQueries}
        checks
      </span>
    </article>
  </div>
</section>

<style>
  .signal-grid {
    display: grid;
    grid-template-columns: minmax(310px, 0.9fr) minmax(0, 2.1fr);
    gap: 10px;
  }

  .growth-card,
  .signal-card {
    position: relative;
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 14px;
    background: var(--theme-card-bg, rgba(15, 23, 42, 0.78));
  }

  .growth-card {
    display: grid;
    min-height: 172px;
    grid-template-columns: auto minmax(0, 1fr);
    align-content: start;
    gap: 7px 18px;
    padding: clamp(16px, 1.4vw, 22px);
    border-color: color-mix(
      in srgb,
      var(--semantic-seo-accent) 44%,
      transparent
    );
    background:
      linear-gradient(
        135deg,
        color-mix(in srgb, var(--semantic-seo-accent) 12%, transparent),
        transparent 58%
      ),
      var(--theme-card-bg, rgba(15, 23, 42, 0.82));
  }

  .growth-card::after,
  .signal-card::after {
    position: absolute;
    inset: auto -28px -48px auto;
    width: 110px;
    height: 110px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--semantic-seo-accent) 8%, transparent);
    content: "";
  }

  .growth-positive {
    border-color: color-mix(
      in srgb,
      var(--semantic-success, #22c55e) 55%,
      transparent
    );
  }

  .growth-negative {
    border-color: color-mix(
      in srgb,
      var(--semantic-error, #ef4444) 55%,
      transparent
    );
  }

  .growth-heading {
    display: flex;
    grid-column: 1 / -1;
    align-items: center;
    gap: 9px;
    color: var(--theme-text-dim, rgba(248, 250, 252, 0.7));
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 700;
  }

  .growth-icon,
  .signal-icon {
    display: grid;
    width: 32px;
    height: 32px;
    flex: 0 0 auto;
    place-items: center;
    border-radius: 9px;
    background: color-mix(in srgb, var(--semantic-seo-accent) 13%, transparent);
    color: var(--semantic-seo-accent);
  }

  .growth-value {
    align-self: center;
    font-size: clamp(2rem, 1.45rem + 1.65vw, 3.25rem);
    line-height: 0.95;
    letter-spacing: -0.04em;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .growth-copy {
    display: flex;
    min-width: 0;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
  }

  .growth-copy b {
    font-size: var(--font-size-min, 0.875rem);
  }

  .growth-copy span,
  .next-step {
    color: var(--theme-text-dim, rgba(248, 250, 252, 0.62));
    font-size: var(--font-size-compact, 0.75rem);
    line-height: 1.35;
  }

  .next-step {
    grid-column: 1 / -1;
    margin: 3px 0 0;
    padding-top: 9px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--semantic-seo-accent);
    font-weight: 700;
  }

  .support-signals {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
  }

  .signal-card {
    display: flex;
    min-height: 172px;
    flex-direction: column;
    gap: 7px;
    padding: clamp(13px, 1vw, 17px);
  }

  .rank-card {
    border-color: color-mix(
      in srgb,
      var(--semantic-seo-accent) 34%,
      transparent
    );
  }

  .ai-card {
    border-color: color-mix(
      in srgb,
      var(--semantic-seo-violet) 32%,
      transparent
    );
  }

  .ai-card .signal-icon {
    background: color-mix(in srgb, var(--semantic-seo-violet) 14%, transparent);
    color: var(--semantic-seo-violet);
  }

  .signal-label {
    min-height: 2.35em;
    color: var(--theme-text-dim, rgba(248, 250, 252, 0.7));
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 700;
    line-height: 1.18;
  }

  .signal-card strong {
    margin-top: auto;
    font-size: clamp(1.45rem, 1.15rem + 0.8vw, 2.15rem);
    line-height: 1;
    letter-spacing: -0.025em;
    font-variant-numeric: tabular-nums;
  }

  .signal-note {
    min-height: 2.6em;
    color: var(--theme-text-dim, rgba(248, 250, 252, 0.52));
    font-size: var(--font-size-compact, 0.75rem);
    line-height: 1.3;
  }

  @container seo-center (max-width: 1320px) {
    .signal-grid {
      grid-template-columns: 1fr;
    }
  }

  @container seo-center (max-width: 860px) {
    .support-signals {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .signal-card:last-child {
      grid-column: 1 / -1;
    }
  }

  @container seo-center (max-width: 520px) {
    .growth-card {
      grid-template-columns: 1fr;
    }

    .growth-heading,
    .next-step {
      grid-column: 1;
    }

    .support-signals {
      grid-template-columns: 1fr;
    }

    .signal-card:last-child {
      grid-column: auto;
    }
  }
</style>

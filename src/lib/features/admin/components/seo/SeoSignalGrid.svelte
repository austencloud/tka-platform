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
  const rankValue = $derived(
    activeHeadTerm.position === null
      ? "Not found yet"
      : `#${formatPosition(activeHeadTerm.position)}`
  );
  const visitorValue = $derived(
    activeAcquisition.organicComposerSessions === 0
      ? "No visitors yet"
      : formatPercent(activeAcquisition.activationRate)
  );
  const aiValue = $derived(
    activeAudit.auditedQueries === 0
      ? "Not checked"
      : `${activeAudit.citedTka} of ${activeAudit.auditedQueries}`
  );
  const nextLabel = $derived(
    snapshot.phase === "confirmed" ? "Result" : "Next move"
  );
  const metricsContext = $derived(
    snapshot.phase === "baseline"
      ? "These are the starting numbers. They are not a growth result."
      : "The latest readings from search, site visits, and saved AI checks."
  );
</script>

<section class="signal-grid" aria-label="SEO growth summary">
  <article class="answer-card growth-{growth.tone}">
    <div class="card-heading">
      <span class="heading-icon" aria-hidden="true">
        <i class="fas fa-compass"></i>
      </span>
      <span>The answer</span>
    </div>

    <div class="answer-main">
      <strong class="answer-value">{growth.value}</strong>
      <div class="answer-copy">
        <b>{growth.headline}</b>
        <span>{growth.explanation}</span>
      </div>
    </div>

    <div class="next-move">
      <span class="next-icon" aria-hidden="true">
        <i
          class="fas {snapshot.phase === 'confirmed'
            ? 'fa-check'
            : 'fa-arrow-right'}"
        ></i>
      </span>
      <div>
        <span>{nextLabel}</span>
        <strong>{growth.nextStep}</strong>
      </div>
    </div>
  </article>

  <article class="metrics-panel">
    <div class="metrics-heading">
      <div>
        <span class="panel-kicker">Latest numbers</span>
        <h3>What is happening right now</h3>
      </div>
      <p>{metricsContext}</p>
    </div>

    <div class="metric-strip">
      <div class="metric-cell rank-metric">
        <span class="metric-icon" aria-hidden="true">
          <i class="fas fa-crosshairs"></i>
        </span>
        <span class="metric-label">Rank for “flow arts software”</span>
        <strong class="metric-value">{rankValue}</strong>
        <span class="metric-note">#1 is the top result.</span>
      </div>

      <div class="metric-cell">
        <span class="metric-icon" aria-hidden="true">
          <i class="fas fa-eye"></i>
        </span>
        <span class="metric-label">Google appearances</span>
        <strong class="metric-value">
          {formatInteger(activeSearch.impressions)}
        </strong>
        <span class="metric-note">Times a tracked page was shown.</span>
      </div>

      <div class="metric-cell">
        <span class="metric-icon" aria-hidden="true">
          <i class="fas fa-link"></i>
        </span>
        <span class="metric-label">Pages found by Google</span>
        <strong class="metric-value">
          {snapshot.indexability.indexed} of {snapshot.indexability.expected}
        </strong>
        <span class="metric-note">Sample pages that can appear in search.</span>
      </div>

      <div class="metric-cell">
        <span class="metric-icon" aria-hidden="true">
          <i class="fas fa-wand-magic-sparkles"></i>
        </span>
        <span class="metric-label">Search visitors who created</span>
        <strong class="metric-value">{visitorValue}</strong>
        <span class="metric-note">
          {formatInteger(activeAcquisition.activatedSessions)} people so far.
        </span>
      </div>

      <div class="metric-cell ai-metric">
        <span class="metric-icon" aria-hidden="true">
          <i class="fas fa-robot"></i>
        </span>
        <span class="metric-label">AI answers mentioning TKA</span>
        <strong class="metric-value">{aiValue}</strong>
        <span class="metric-note">Saved AI searches that mentioned TKA.</span>
      </div>
    </div>
  </article>
</section>

<style>
  .signal-grid {
    display: grid;
    height: 100%;
    grid-template-columns: minmax(470px, 0.95fr) minmax(0, 1.55fr);
    gap: 10px;
  }

  .answer-card,
  .metrics-panel {
    position: relative;
    height: 100%;
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 14px;
    background: var(--theme-card-bg, rgba(15, 23, 42, 0.78));
  }

  .answer-card {
    display: flex;
    min-height: 230px;
    flex-direction: column;
    gap: 12px;
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

  .answer-card::after {
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

  .card-heading {
    display: flex;
    align-items: center;
    gap: 9px;
    color: var(--theme-text-dim, rgba(248, 250, 252, 0.7));
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 700;
  }

  .heading-icon,
  .metric-icon {
    display: grid;
    width: 32px;
    height: 32px;
    flex: 0 0 auto;
    place-items: center;
    border-radius: 9px;
    background: color-mix(in srgb, var(--semantic-seo-accent) 13%, transparent);
    color: var(--semantic-seo-accent);
  }

  .answer-main {
    display: grid;
    min-height: 0;
    flex: 1;
    grid-template-columns: minmax(230px, auto) minmax(0, 1fr);
    align-items: center;
    gap: clamp(18px, 1.4vw, 30px);
  }

  .answer-value {
    display: flex;
    min-height: 2em;
    align-items: center;
    font-size: clamp(2.25rem, 1.5rem + 1.7vw, 3.75rem);
    line-height: 0.95;
    letter-spacing: -0.04em;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .answer-copy {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 7px;
  }

  .answer-copy b {
    font-size: clamp(0.95rem, 0.86rem + 0.25vw, 1.15rem);
  }

  .answer-copy span {
    color: var(--theme-text-dim, rgba(248, 250, 252, 0.62));
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.45;
  }

  .next-move {
    display: grid;
    min-height: 58px;
    grid-template-columns: 34px minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    border: 1px solid
      color-mix(in srgb, var(--semantic-seo-accent) 24%, transparent);
    border-radius: 10px;
    background: color-mix(in srgb, var(--semantic-seo-accent) 7%, transparent);
  }

  .next-icon {
    display: grid;
    width: 30px;
    height: 30px;
    place-items: center;
    border-radius: 50%;
    background: color-mix(in srgb, var(--semantic-seo-accent) 16%, transparent);
    color: var(--semantic-seo-accent);
  }

  .next-move > div {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 2px;
  }

  .next-move span {
    color: var(--semantic-seo-accent);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .next-move strong {
    font-size: var(--font-size-min, 0.875rem);
  }

  .metrics-panel {
    display: flex;
    min-height: 230px;
    flex-direction: column;
    padding: clamp(16px, 1.4vw, 22px);
  }

  .metrics-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18px;
  }

  .panel-kicker {
    color: var(--semantic-seo-accent);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .metrics-heading h3 {
    margin: 3px 0 0;
    font-size: clamp(1.05rem, 0.95rem + 0.35vw, 1.3rem);
  }

  .metrics-heading p {
    max-width: 27rem;
    margin: 2px 0 0;
    color: var(--theme-text-dim, rgba(248, 250, 252, 0.58));
    font-size: var(--font-size-compact, 0.75rem);
    line-height: 1.4;
    text-align: right;
  }

  .metric-strip {
    display: grid;
    height: 100%;
    min-height: 0;
    flex: 1;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    margin-top: 13px;
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.09));
    border-radius: 11px;
    background: color-mix(in srgb, var(--theme-text, #fff) 2%, transparent);
  }

  .metric-cell {
    display: flex;
    min-width: 0;
    flex-direction: column;
    justify-content: center;
    gap: 6px;
    padding: clamp(11px, 0.8vw, 16px);
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .metric-cell:first-child {
    border-left: 0;
  }

  .metric-icon {
    width: 28px;
    height: 28px;
    border-radius: 8px;
  }

  .ai-metric .metric-icon {
    background: color-mix(in srgb, var(--semantic-seo-violet) 14%, transparent);
    color: var(--semantic-seo-violet);
  }

  .metric-label {
    min-height: 2.35em;
    color: var(--theme-text-dim, rgba(248, 250, 252, 0.7));
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 700;
    line-height: 1.18;
  }

  .metric-value {
    display: flex;
    min-height: 1.9em;
    align-items: flex-end;
    font-size: clamp(1.4rem, 1rem + 0.75vw, 2.1rem);
    line-height: 1;
    letter-spacing: -0.025em;
    font-variant-numeric: tabular-nums;
  }

  .metric-note {
    min-height: 2.6em;
    color: var(--theme-text-dim, rgba(248, 250, 252, 0.52));
    font-size: var(--font-size-compact, 0.75rem);
    line-height: 1.3;
  }

  @container seo-center (max-width: 1500px) {
    .signal-grid {
      grid-template-columns: 1fr;
      height: auto;
    }

    .answer-card,
    .metrics-panel {
      height: auto;
    }
  }

  @container seo-center (max-width: 860px) {
    .answer-main {
      grid-template-columns: 1fr;
    }

    .metrics-heading {
      flex-direction: column;
      gap: 6px;
    }

    .metrics-heading p {
      text-align: left;
    }

    .metric-strip {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .metric-cell {
      border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    }

    .metric-cell:nth-child(odd) {
      border-left: 0;
    }

    .metric-cell:nth-child(-n + 2) {
      border-top: 0;
    }

    .metric-cell:last-child {
      grid-column: 1 / -1;
    }
  }

  @container seo-center (max-width: 520px) {
    .metric-strip {
      grid-template-columns: 1fr;
    }

    .metric-cell,
    .metric-cell:nth-child(-n + 2) {
      border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
      border-left: 0;
    }

    .metric-cell:first-child {
      border-top: 0;
    }

    .metric-cell:last-child {
      grid-column: auto;
    }
  }
</style>

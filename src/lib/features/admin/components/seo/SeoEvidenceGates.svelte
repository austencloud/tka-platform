<script lang="ts">
  import type { SeoDashboardSnapshot } from "$lib/features/admin/domain/models/seo-dashboard-model";
  import {
    formatCriterion,
    formatInteger,
    formatPercent,
  } from "./seo-dashboard-format";

  const PLAIN_LABELS: Record<string, string> = {
    treatment_impressions: "Enough Google appearances",
    adjusted_impression_lift: "Visibility grew against comparison pages",
    adjusted_click_lift: "Google visits grew against comparison pages",
    head_term_position: "“Flow arts software” moved high enough",
    indexed_sample_rate: "Google indexed enough sample pages",
    organic_activation_rate: "Enough search visitors started creating",
    head_term_ai_citation_rank: "TKA ranked high enough in the AI answer",
    ai_overview_citation_rate: "Enough AI answers mentioned TKA",
  };

  let { snapshot }: { snapshot: SeoDashboardSnapshot } = $props();

  const passCount = $derived(
    snapshot.decision.criteria.filter(
      (criterion) => criterion.status === "pass"
    ).length
  );

  function targetText(
    criterion: SeoDashboardSnapshot["decision"]["criteria"][number]
  ): string {
    if (criterion.unit === "ratio") {
      return "Goal: " + formatPercent(criterion.target);
    }
    if (criterion.unit === "position") {
      return "Goal: position " + criterion.target + " or better";
    }
    return "Goal: " + formatInteger(criterion.target);
  }
</script>

<section class="panel" aria-labelledby="gates-title">
  <div class="panel-heading">
    <div>
      <span class="panel-kicker">The verdict</span>
      <h3 id="gates-title">What counts as a win</h3>
    </div>
    {#if snapshot.decision.criteria.length > 0}
      <span class="gate-count">
        {passCount}/{snapshot.decision.criteria.length} passed
      </span>
    {/if}
  </div>
  <p class="panel-explanation">
    These checks prevent one exciting number from being mistaken for proven
    growth.
  </p>

  {#if snapshot.decision.criteria.length === 0}
    <div class="not-due">
      <i class="fas fa-hourglass-half" aria-hidden="true"></i>
      <div>
        <strong>No pass or fail yet.</strong>
        <p>
          The first verdict opens after the SEO changes are live and Google
          indexing is confirmed.
        </p>
      </div>
    </div>
  {:else}
    <ul class="criteria-list">
      {#each snapshot.decision.criteria as criterion (criterion.id)}
        <li class="criterion criterion-{criterion.status}">
          <span class="criterion-mark" aria-hidden="true">
            <i
              class="fas {criterion.status === 'pass'
                ? 'fa-check'
                : criterion.status === 'fail'
                  ? 'fa-xmark'
                  : 'fa-ellipsis'}"
            ></i>
          </span>
          <div class="criterion-copy">
            <strong>{PLAIN_LABELS[criterion.id] ?? criterion.label}</strong>
            <span>{targetText(criterion)}</span>
          </div>
          <span class="criterion-value">{formatCriterion(criterion)}</span>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .panel {
    display: flex;
    height: 100%;
    min-height: 0;
    flex-direction: column;
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

  .gate-count {
    min-width: 5.5rem;
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

  .not-due {
    display: flex;
    min-height: 174px;
    flex: 1;
    align-items: center;
    justify-content: center;
    gap: 13px;
    padding: 20px;
    border-radius: 11px;
    background: color-mix(in srgb, var(--theme-text, #fff) 3%, transparent);
  }

  .not-due > i {
    color: var(--semantic-seo-violet);
    font-size: 1.35rem;
  }

  .not-due > div {
    display: flex;
    max-width: 25rem;
    flex-direction: column;
    gap: 5px;
  }

  .not-due p {
    margin: 0;
    color: var(--theme-text-dim, rgba(248, 250, 252, 0.62));
    font-size: var(--font-size-compact, 0.75rem);
    line-height: 1.4;
  }

  .criteria-list {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    list-style: none;
  }

  .criterion {
    display: grid;
    grid-template-columns: 26px minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border-radius: 9px;
    background: color-mix(in srgb, var(--theme-text, #fff) 4%, transparent);
  }

  .criterion-mark {
    display: grid;
    width: 24px;
    height: 24px;
    place-items: center;
    border-radius: 50%;
    background: color-mix(in srgb, var(--theme-text, #fff) 7%, transparent);
    font-size: var(--font-size-compact, 0.75rem);
  }

  .criterion-pass .criterion-mark {
    color: var(--semantic-success, #22c55e);
  }

  .criterion-fail .criterion-mark {
    color: var(--semantic-error, #ef4444);
  }

  .criterion-copy {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 2px;
  }

  .criterion-copy strong {
    font-size: var(--font-size-compact, 0.75rem);
  }

  .criterion-copy span,
  .criterion-value {
    color: var(--theme-text-dim, rgba(248, 250, 252, 0.56));
    font-size: var(--font-size-compact, 0.75rem);
  }

  .criterion-value {
    min-width: 7ch;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 520px) {
    .panel-heading {
      flex-direction: column;
    }
  }
</style>

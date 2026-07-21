<script lang="ts">
  import type { SeoDashboardSnapshot } from "$lib/features/admin/domain/models/seo-dashboard-model";
  import { formatCriterion, formatPercent } from "./seo-dashboard-format";

  let { snapshot }: { snapshot: SeoDashboardSnapshot } = $props();
</script>

<section class="panel" aria-labelledby="gates-title">
  <div class="panel-heading">
    <div>
      <span class="panel-kicker">Registered targets</span>
      <h3 id="gates-title">Evidence gates</h3>
    </div>
    <span class="gate-count">{snapshot.decision.criteria.length}</span>
  </div>
  {#if snapshot.decision.criteria.length === 0}
    <div class="not-due">
      <i class="fas fa-hourglass-half" aria-hidden="true"></i>
      <p>
        No gates are due. The first decision window opens after deployment and
        confirmed indexing.
      </p>
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
            <strong>{criterion.label}</strong>
            <span>
              Target {criterion.unit === "ratio"
                ? formatPercent(criterion.target)
                : criterion.target}
            </span>
          </div>
          <span class="criterion-value">{formatCriterion(criterion)}</span>
        </li>
      {/each}
    </ul>
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

  .gate-count {
    min-width: 2.4rem;
    padding: 5px 9px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--theme-text, #fff) 7%, transparent);
    text-align: center;
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
  }

  .not-due {
    display: flex;
    min-height: 188px;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 24px;
    text-align: center;
  }

  .not-due i {
    color: var(--semantic-seo-violet);
    font-size: 1.5rem;
  }

  .not-due p {
    max-width: 25rem;
    margin: 0;
    color: var(--theme-text-dim, rgba(248, 250, 252, 0.64));
    font-size: var(--font-size-min, 0.875rem);
  }

  .criteria-list {
    display: flex;
    flex-direction: column;
    gap: 7px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .criterion {
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr) auto;
    align-items: center;
    gap: 9px;
    padding: 9px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--theme-text, #fff) 4%, transparent);
  }

  .criterion-mark {
    display: grid;
    width: 26px;
    height: 26px;
    place-items: center;
    border-radius: 50%;
    background: color-mix(in srgb, var(--theme-text, #fff) 7%, transparent);
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
    font-size: var(--font-size-min, 0.875rem);
  }

  .criterion-copy span,
  .criterion-value {
    color: var(--theme-text-dim, rgba(248, 250, 252, 0.58));
    font-size: var(--font-size-compact, 0.75rem);
  }

  .criterion-value {
    min-width: 7ch;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 520px) {
    .panel-heading {
      align-items: stretch;
      flex-direction: column;
    }
  }
</style>

<script lang="ts">
  import type { SeoDashboardSnapshot } from "$lib/features/admin/domain/models/seo-dashboard-model";
  import { formatDate } from "./seo-dashboard-format";

  const DECISION_LABELS: Record<
    SeoDashboardSnapshot["decision"]["status"],
    string
  > = {
    baseline: "Building the baseline",
    awaiting_indexing: "Waiting for confirmed indexing",
    collecting: "Evidence still collecting",
    incomplete_evidence: "Evidence has gaps",
    below_target: "Below the registered target",
    primary_target_met: "Primary target met",
    confirmed_target_met: "Win confirmed",
  };

  let { snapshot }: { snapshot: SeoDashboardSnapshot } = $props();
</script>

<section class="panel" aria-labelledby="experiment-title">
  <div class="panel-heading">
    <div>
      <span class="panel-kicker">Experiment clock</span>
      <h3 id="experiment-title">{DECISION_LABELS[snapshot.decision.status]}</h3>
    </div>
    <span class="decision-status">
      {snapshot.decision.status.replaceAll("_", " ")}
    </span>
  </div>

  <div class="timeline" aria-label="SEO experiment windows">
    <div class="timeline-step active">
      <span class="step-index">01</span>
      <div>
        <strong>Baseline</strong>
        <span>
          {formatDate(snapshot.windows.baseline.start)} to {formatDate(
            snapshot.windows.baseline.end
          )}
        </span>
      </div>
      <span class="step-state">
        {snapshot.windows.baseline.complete
          ? "Complete"
          : `${snapshot.windows.baseline.days} days`}
      </span>
    </div>
    <div class="timeline-step" class:active={snapshot.windows.primary !== null}>
      <span class="step-index">02</span>
      <div>
        <strong>Primary</strong>
        <span>
          {snapshot.windows.primary
            ? `${formatDate(snapshot.windows.primary.start)} to ${formatDate(snapshot.windows.primary.end)}`
            : "Opens after indexing"}
        </span>
      </div>
      <span class="step-state">
        {snapshot.windows.primary
          ? `${snapshot.windows.primary.days} days`
          : "Pending"}
      </span>
    </div>
    <div
      class="timeline-step"
      class:active={snapshot.windows.confirmation !== null}
    >
      <span class="step-index">03</span>
      <div>
        <strong>Confirmation</strong>
        <span>
          {snapshot.windows.confirmation
            ? `${formatDate(snapshot.windows.confirmation.start)} to ${formatDate(snapshot.windows.confirmation.end)}`
            : "Second independent window"}
        </span>
      </div>
      <span class="step-state">
        {snapshot.windows.confirmation
          ? `${snapshot.windows.confirmation.days} days`
          : "Pending"}
      </span>
    </div>
  </div>

  <div class="experiment-dates">
    <div>
      <span>Deploy</span>
      <strong>{formatDate(snapshot.experimentDates.deploymentDate)}</strong>
    </div>
    <div>
      <span>Indexed</span>
      <strong>{formatDate(snapshot.experimentDates.indexedDate)}</strong>
    </div>
    <div>
      <span>Controls</span>
      <strong>
        {snapshot.cohorts.frozen
          ? `${snapshot.cohorts.frozenControlCount} frozen`
          : "Not frozen"}
      </strong>
    </div>
  </div>
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

  .decision-status {
    display: inline-flex;
    min-width: 12rem;
    min-height: 32px;
    align-items: center;
    justify-content: center;
    padding: 6px 12px;
    border: 1px solid
      color-mix(in srgb, var(--semantic-seo-accent) 42%, transparent);
    border-radius: 999px;
    background: color-mix(
      in srgb,
      var(--semantic-seo-accent) 10%,
      var(--theme-card-bg, #111827)
    );
    color: var(--semantic-seo-accent);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .timeline {
    display: flex;
    flex-direction: column;
  }

  .timeline-step {
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    min-height: 62px;
    padding: 8px 0;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-dim, rgba(248, 250, 252, 0.48));
  }

  .timeline-step:last-child {
    border-bottom: 0;
  }

  .timeline-step.active {
    color: var(--theme-text, #f8fafc);
  }

  .step-index {
    color: var(--semantic-seo-accent);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .timeline-step > div {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 3px;
  }

  .timeline-step > div span,
  .step-state {
    font-size: var(--font-size-compact, 0.75rem);
  }

  .step-state {
    font-variant-numeric: tabular-nums;
  }

  .experiment-dates {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-top: 14px;
  }

  .experiment-dates > div {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 4px;
    padding: 10px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--theme-text, #fff) 4%, transparent);
  }

  .experiment-dates span {
    color: var(--theme-text-dim, rgba(248, 250, 252, 0.55));
    font-size: var(--font-size-compact, 0.75rem);
    text-transform: uppercase;
  }

  .experiment-dates strong {
    overflow: hidden;
    font-size: var(--font-size-min, 0.875rem);
    text-overflow: ellipsis;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 520px) {
    .panel-heading {
      align-items: stretch;
      flex-direction: column;
    }

    .decision-status {
      width: 100%;
    }

    .timeline-step {
      grid-template-columns: 30px minmax(0, 1fr);
    }

    .step-state {
      grid-column: 2;
    }

    .experiment-dates {
      grid-template-columns: 1fr;
    }
  }
</style>

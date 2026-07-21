<script lang="ts">
  import type { SeoDashboardSnapshot } from "$lib/features/admin/domain/models/seo-dashboard-model";
  import { formatDate } from "./seo-dashboard-format";

  const DECISION_LABELS: Record<
    SeoDashboardSnapshot["decision"]["status"],
    string
  > = {
    baseline: "The starting point is being recorded.",
    awaiting_indexing: "Google indexing is the next step.",
    collecting: "The first growth check is running.",
    incomplete_evidence: "Some evidence is missing.",
    below_target: "Growth has not cleared the target.",
    primary_target_met: "The first growth check passed.",
    confirmed_target_met: "Growth passed twice.",
  };

  const PHASE_EXPLANATIONS: Record<SeoDashboardSnapshot["phase"], string> = {
    baseline:
      "The first growth check starts after the SEO changes are registered as live and a measurement run confirms Google indexing.",
    awaiting_indexing:
      "Each measurement run checks the sample pages. The first growth check starts when Google indexing is confirmed.",
    primary_collecting:
      "Google appearances are now being compared with similar pages that did not receive the SEO update.",
    primary_complete:
      "The first check is complete. A fresh window is testing whether the result happens again.",
    confirmed:
      "Both measurement windows are complete. The result now has a before picture and an independent proof check.",
  };

  const PHASE_BADGES: Record<SeoDashboardSnapshot["phase"], string> = {
    baseline: "Before",
    awaiting_indexing: "Waiting",
    primary_collecting: "Measuring",
    primary_complete: "Proof check",
    confirmed: "Complete",
  };

  let { snapshot }: { snapshot: SeoDashboardSnapshot } = $props();

  function primaryState(): string {
    if (
      snapshot.phase === "baseline" ||
      snapshot.phase === "awaiting_indexing"
    ) {
      return "Waiting";
    }
    if (snapshot.phase === "primary_collecting") return "Now";
    return "Done";
  }

  function confirmationState(): string {
    if (snapshot.phase === "confirmed") return "Done";
    if (snapshot.phase === "primary_complete") return "Now";
    return "Later";
  }

  function formatWindow(
    window: { start: string; end: string } | null,
    fallback: string
  ): string {
    if (!window) return fallback;
    return formatDate(window.start) + " to " + formatDate(window.end);
  }
</script>

<section class="panel" aria-labelledby="experiment-title">
  <div class="panel-heading">
    <div>
      <span class="panel-kicker">What happens next</span>
      <h3 id="experiment-title">{DECISION_LABELS[snapshot.decision.status]}</h3>
    </div>
    <span class="decision-status">{PHASE_BADGES[snapshot.phase]}</span>
  </div>

  <p class="plain-explanation">{PHASE_EXPLANATIONS[snapshot.phase]}</p>

  <div class="timeline" aria-label="Three SEO measurement steps">
    <article
      class="timeline-step"
      class:current={snapshot.phase === "baseline"}
      class:complete={snapshot.phase !== "baseline"}
    >
      <div class="step-topline">
        <span class="step-index">1</span>
        <span class="step-state">
          {snapshot.phase === "baseline" ? "Now" : "Done"}
        </span>
      </div>
      <strong>Before picture</strong>
      <span>{formatWindow(snapshot.windows.baseline, "")}</span>
    </article>

    <article
      class="timeline-step"
      class:current={snapshot.phase === "primary_collecting"}
      class:complete={snapshot.phase === "primary_complete" ||
        snapshot.phase === "confirmed"}
    >
      <div class="step-topline">
        <span class="step-index">2</span>
        <span class="step-state">{primaryState()}</span>
      </div>
      <strong>First growth check</strong>
      <span>
        {formatWindow(snapshot.windows.primary, "Starts after Google indexing")}
      </span>
    </article>

    <article
      class="timeline-step"
      class:current={snapshot.phase === "primary_complete"}
      class:complete={snapshot.phase === "confirmed"}
    >
      <div class="step-topline">
        <span class="step-index">3</span>
        <span class="step-state">{confirmationState()}</span>
      </div>
      <strong>Proof check</strong>
      <span>
        {formatWindow(
          snapshot.windows.confirmation,
          "Repeats the test with fresh dates"
        )}
      </span>
    </article>
  </div>

  <div class="experiment-dates">
    <div>
      <span>SEO changes live</span>
      <strong>
        {snapshot.experimentDates.deploymentDate
          ? formatDate(snapshot.experimentDates.deploymentDate)
          : "Not registered"}
      </strong>
    </div>
    <div>
      <span>Google indexing</span>
      <strong>
        {snapshot.experimentDates.indexedDate
          ? formatDate(snapshot.experimentDates.indexedDate)
          : "Not confirmed"}
      </strong>
    </div>
    <div>
      <span>Comparison pages</span>
      <strong>
        {snapshot.cohorts.frozen
          ? snapshot.cohorts.frozenControlCount + " locked"
          : "Not locked"}
      </strong>
    </div>
  </div>
</section>

<style>
  .panel {
    container-type: inline-size;
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

  .decision-status {
    display: inline-flex;
    min-height: 30px;
    align-items: center;
    justify-content: center;
    padding: 5px 11px;
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
    white-space: nowrap;
  }

  .plain-explanation {
    max-width: 62rem;
    margin: 10px 0 13px;
    color: var(--theme-text-dim, rgba(248, 250, 252, 0.64));
    font-size: var(--font-size-compact, 0.75rem);
    line-height: 1.4;
  }

  .timeline {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .timeline-step {
    display: flex;
    min-width: 0;
    min-height: 82px;
    flex-direction: column;
    gap: 4px;
    padding: 10px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 10px;
    background: color-mix(in srgb, var(--theme-text, #fff) 3%, transparent);
    color: var(--theme-text-dim, rgba(248, 250, 252, 0.46));
  }

  .timeline-step.current {
    border-color: color-mix(
      in srgb,
      var(--semantic-seo-accent) 42%,
      transparent
    );
    color: var(--theme-text, #f8fafc);
    background: color-mix(in srgb, var(--semantic-seo-accent) 7%, transparent);
  }

  .timeline-step.complete {
    color: var(--theme-text, #f8fafc);
  }

  .step-topline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .step-index {
    display: grid;
    width: 22px;
    height: 22px;
    place-items: center;
    border-radius: 50%;
    background: color-mix(in srgb, var(--semantic-seo-accent) 15%, transparent);
    color: var(--semantic-seo-accent);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 800;
  }

  .step-state,
  .timeline-step > span {
    font-size: var(--font-size-compact, 0.75rem);
    line-height: 1.25;
  }

  .step-state {
    font-weight: 700;
  }

  .timeline-step > strong {
    font-size: var(--font-size-min, 0.875rem);
  }

  .experiment-dates {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin-top: 8px;
  }

  .experiment-dates > div {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 3px;
    padding: 8px 10px;
    border-radius: 9px;
    background: color-mix(in srgb, var(--theme-text, #fff) 3%, transparent);
  }

  .experiment-dates span {
    color: var(--theme-text-dim, rgba(248, 250, 252, 0.52));
    font-size: var(--font-size-compact, 0.75rem);
  }

  .experiment-dates strong {
    overflow: hidden;
    font-size: var(--font-size-compact, 0.75rem);
    text-overflow: ellipsis;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  @container (max-width: 560px) {
    .panel-heading {
      flex-direction: column;
    }

    .timeline,
    .experiment-dates {
      grid-template-columns: 1fr;
    }
  }
</style>

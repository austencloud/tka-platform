<script lang="ts">
  import { onMount } from "svelte";
  import { auth } from "$lib/shared/auth/firebase";
  import { getErrorHandler } from "$lib/shared/application/get-error-handler";
  import {
    parseSeoHistoryRows,
    seoDashboardSnapshotSchema,
    type SeoDashboardSnapshot,
    type SeoHistoryPoint,
  } from "$lib/features/admin/domain/models/seo-dashboard-model";
  import SeoEvidenceGates from "./SeoEvidenceGates.svelte";
  import SeoExperimentClock from "./SeoExperimentClock.svelte";
  import SeoHistoryChart from "./SeoHistoryChart.svelte";
  import SeoMeasurementHealth from "./SeoMeasurementHealth.svelte";
  import SeoQueryGroups from "./SeoQueryGroups.svelte";
  import SeoSignalGrid from "./SeoSignalGrid.svelte";
  import SeoSourceActions from "./SeoSourceActions.svelte";
  import { formatDate } from "./seo-dashboard-format";

  const POSTHOG_URL = "https://us.posthog.com/project/299320/dashboard";
  const PHASE_LABELS: Record<SeoDashboardSnapshot["phase"], string> = {
    baseline: "Recording the before picture",
    awaiting_indexing: "Waiting for Google",
    primary_collecting: "Measuring growth",
    primary_complete: "Running the proof check",
    confirmed: "Measurement complete",
  };

  let loading = $state(true);
  let refreshing = $state(false);
  let loadError = $state<string | null>(null);
  let snapshot = $state<SeoDashboardSnapshot | null>(null);
  let history = $state<SeoHistoryPoint[]>([]);
  let refreshedAt = $state<Date | null>(null);

  async function analyticsQuery(type: string): Promise<unknown[][]> {
    const user = auth.currentUser;
    if (!user) throw new Error("Sign in as an admin to read SEO evidence.");
    const token = await user.getIdToken();
    const response = await fetch("/api/admin/analytics", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type }),
    });
    const body = (await response.json().catch(() => null)) as {
      success?: boolean;
      results?: unknown[][];
      message?: string;
    } | null;
    if (!response.ok) {
      throw new Error(
        body?.message ??
          "SEO evidence request failed (" + response.status + ")."
      );
    }
    if (!body?.success) throw new Error(body?.message ?? "SEO query failed.");
    return body.results ?? [];
  }

  async function loadEvidence(): Promise<void> {
    refreshing = snapshot !== null;
    loadError = null;
    try {
      const [scorecardRows, historyRows] = await Promise.all([
        analyticsQuery("seo-scorecard"),
        analyticsQuery("seo-history"),
      ]);
      const encodedSnapshot = scorecardRows[0]?.[1];
      if (typeof encodedSnapshot !== "string" || !encodedSnapshot) {
        snapshot = null;
        history = [];
        return;
      }
      snapshot = seoDashboardSnapshotSchema.parse(JSON.parse(encodedSnapshot));
      history = parseSeoHistoryRows(historyRows);
      refreshedAt = new Date();
    } catch (caught) {
      const failure =
        caught instanceof Error ? caught : new Error(String(caught));
      console.error("Failed to load SEO evidence:", failure);
      getErrorHandler().showUserError({
        message: "SEO evidence could not load.",
        technicalDetails: failure.message,
        error: failure,
        severity: "error",
        context: { module: "admin", tab: "seo", action: "loadEvidence" },
      });
      loadError = failure.message;
    } finally {
      loading = false;
      refreshing = false;
    }
  }

  onMount(() => {
    void loadEvidence();
  });
</script>

<div class="seo-command-center themed-scrollbar">
  {#if loading}
    <div class="state-block" aria-live="polite">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      <p>Reading the search evidence...</p>
    </div>
  {:else if loadError && !snapshot}
    <div class="state-block error" role="alert">
      <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
      <p>{loadError}</p>
      <button class="command-button" onclick={loadEvidence}>Try again</button>
    </div>
  {:else if !snapshot}
    <div class="state-block empty-state">
      <i class="fas fa-satellite-dish" aria-hidden="true"></i>
      <h2>No scorecard snapshot yet</h2>
      <p>The next SEO measurement run will publish the starting point.</p>
      <a
        class="command-button"
        href={POSTHOG_URL}
        target="_blank"
        rel="noreferrer"
      >
        Open visitor behavior data
      </a>
    </div>
  {:else}
    <header class="command-header">
      <div class="title-block">
        <div class="eyebrow">SEO command center</div>
        <h2>Flow Arts Software SEO</h2>
        <p>One answer first: is Google visibility growing?</p>
      </div>
      <div class="header-status">
        <span class="phase-badge">
          <span class="status-dot" aria-hidden="true"></span>
          {PHASE_LABELS[snapshot.phase]}
        </span>
        <span class="data-date">
          Data through {formatDate(snapshot.dataThrough)}
        </span>
      </div>
    </header>

    <SeoSignalGrid {snapshot} />

    <div class="overview-grid">
      <div class="clock-slot">
        <SeoExperimentClock {snapshot} />
      </div>
      <SeoEvidenceGates {snapshot} />
      <SeoHistoryChart {history} />
    </div>

    <details class="measurement-details">
      <summary>
        <span class="summary-icon" aria-hidden="true">
          <i class="fas fa-sliders"></i>
        </span>
        <span class="summary-copy">
          <strong>Numbers and data sources</strong>
          <small>
            Search topics, collection health, source links, and refresh controls
          </small>
        </span>
        <i class="fas fa-chevron-down summary-chevron" aria-hidden="true"></i>
      </summary>
      <div class="details-content">
        <SeoQueryGroups {snapshot} />
        <div class="details-side">
          <section class="data-health" aria-labelledby="data-health-title">
            <div class="detail-heading">
              <span>Data plumbing</span>
              <h3 id="data-health-title">Are the data feeds ready?</h3>
            </div>
            <p>
              Green means that source supplied everything expected for this
              measurement window.
            </p>
            <SeoMeasurementHealth {snapshot} />
          </section>
          <SeoSourceActions
            {refreshedAt}
            {refreshing}
            onRefresh={loadEvidence}
          />
        </div>
      </div>
    </details>

    {#if loadError}
      <p class="inline-error" role="alert">{loadError}</p>
    {/if}
  {/if}
</div>

<style>
  .seo-command-center {
    --semantic-seo-accent: #2dd4bf;
    --semantic-seo-accent-deep: #0f766e;
    --semantic-seo-violet: #a78bfa;
    container-name: seo-center;
    container-type: inline-size;
    display: flex;
    height: 100%;
    flex-direction: column;
    gap: clamp(10px, 0.8vw, 14px);
    padding: clamp(12px, 1.2vw, 22px);
    overflow-y: auto;
    color: var(--theme-text, #f8fafc);
    background:
      radial-gradient(
        circle at 8% 0%,
        color-mix(in srgb, var(--semantic-seo-accent) 12%, transparent),
        transparent 30rem
      ),
      radial-gradient(
        circle at 92% 12%,
        color-mix(in srgb, var(--semantic-seo-violet) 10%, transparent),
        transparent 26rem
      );
  }

  .state-block {
    display: flex;
    min-height: 100%;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    text-align: center;
  }

  .state-block > i {
    color: var(--semantic-seo-accent);
    font-size: 2rem;
  }

  .state-block h2,
  .state-block p {
    margin: 0;
  }

  .state-block p {
    max-width: 34rem;
    color: var(--theme-text-dim, rgba(248, 250, 252, 0.68));
  }

  .state-block.error > i,
  .inline-error {
    color: var(--semantic-error, #ef4444);
  }

  .command-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 18px;
  }

  .eyebrow,
  .data-date {
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .eyebrow {
    color: var(--semantic-seo-accent);
  }

  .title-block h2 {
    margin: 2px 0 0;
    font-size: clamp(1.65rem, 1.3rem + 1.2vw, 2.6rem);
    line-height: 1;
    letter-spacing: -0.04em;
  }

  .title-block p {
    margin: 6px 0 0;
    color: var(--theme-text-dim, rgba(248, 250, 252, 0.65));
    font-size: var(--font-size-min, 0.875rem);
  }

  .header-status {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 7px;
  }

  .phase-badge {
    display: inline-flex;
    min-height: 30px;
    align-items: center;
    gap: 8px;
    padding: 5px 11px;
    border: 1px solid
      color-mix(in srgb, var(--semantic-seo-accent) 42%, transparent);
    border-radius: 999px;
    background: color-mix(
      in srgb,
      var(--semantic-seo-accent) 10%,
      var(--theme-card-bg, #111827)
    );
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 800;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    flex: 0 0 auto;
    border-radius: 50%;
    background: var(--semantic-seo-accent);
    box-shadow: 0 0 10px
      color-mix(in srgb, var(--semantic-seo-accent) 80%, transparent);
  }

  .data-date {
    color: var(--theme-text-dim, rgba(248, 250, 252, 0.58));
    font-variant-numeric: tabular-nums;
  }

  .overview-grid {
    display: grid;
    grid-template-columns:
      minmax(520px, 1.35fr)
      minmax(300px, 0.82fr)
      minmax(300px, 0.82fr);
    align-items: stretch;
    gap: 10px;
  }

  .clock-slot {
    min-width: 0;
  }

  .measurement-details {
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 14px;
    background: var(--theme-card-bg, rgba(15, 23, 42, 0.72));
  }

  .measurement-details > summary {
    display: flex;
    min-height: 60px;
    align-items: center;
    gap: 12px;
    padding: 9px 14px;
    border-radius: 14px;
    cursor: pointer;
    list-style: none;
    transition:
      border-color var(--duration-fast, 150ms) ease,
      background var(--duration-fast, 150ms) ease;
  }

  .measurement-details > summary::-webkit-details-marker {
    display: none;
  }

  .measurement-details > summary:hover {
    background: color-mix(in srgb, var(--semantic-seo-accent) 6%, transparent);
  }

  .measurement-details > summary:focus-visible {
    outline: 2px solid var(--semantic-seo-accent);
    outline-offset: 2px;
  }

  .summary-icon {
    display: grid;
    width: 34px;
    height: 34px;
    flex: 0 0 auto;
    place-items: center;
    border-radius: 10px;
    background: color-mix(in srgb, var(--semantic-seo-accent) 13%, transparent);
    color: var(--semantic-seo-accent);
  }

  .summary-copy {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    gap: 2px;
  }

  .summary-copy strong {
    font-size: var(--font-size-min, 0.875rem);
  }

  .summary-copy small {
    overflow: hidden;
    color: var(--theme-text-dim, rgba(248, 250, 252, 0.56));
    font-size: var(--font-size-compact, 0.75rem);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .summary-chevron {
    color: var(--theme-text-dim, rgba(248, 250, 252, 0.56));
    transition: transform var(--duration-fast, 150ms) ease;
  }

  .measurement-details[open] .summary-chevron {
    transform: rotate(180deg);
  }

  .details-content {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(380px, 0.75fr);
    gap: 10px;
    padding: 0 10px 10px;
  }

  .details-side {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 10px;
  }

  .data-health {
    padding: clamp(14px, 1.2vw, 20px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 14px;
    background: var(--theme-card-bg, rgba(15, 23, 42, 0.74));
  }

  .detail-heading > span {
    color: var(--semantic-seo-accent);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .detail-heading h3 {
    margin: 3px 0 0;
    font-size: clamp(1rem, 0.92rem + 0.35vw, 1.25rem);
  }

  .data-health > p {
    margin: 8px 0 12px;
    color: var(--theme-text-dim, rgba(248, 250, 252, 0.6));
    font-size: var(--font-size-compact, 0.75rem);
  }

  .command-button {
    display: inline-flex;
    min-height: var(--min-touch-target, 44px);
    align-items: center;
    justify-content: center;
    padding: 9px 14px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(15, 23, 42, 0.78));
    color: var(--theme-text, #f8fafc);
    font: inherit;
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
  }

  .inline-error {
    margin: 0;
    text-align: right;
    font-size: var(--font-size-min, 0.875rem);
  }

  @container seo-center (max-width: 1240px) {
    .overview-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .clock-slot {
      grid-column: 1 / -1;
    }
  }

  @container seo-center (max-width: 860px) {
    .command-header {
      align-items: stretch;
      flex-direction: column;
    }

    .header-status {
      align-items: flex-start;
    }

    .overview-grid,
    .details-content {
      grid-template-columns: 1fr;
    }

    .clock-slot {
      grid-column: auto;
    }
  }

  @container seo-center (max-width: 520px) {
    .seo-command-center {
      padding: 12px;
    }

    .summary-copy small {
      white-space: normal;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .measurement-details > summary,
    .summary-chevron {
      transition: none;
    }
  }
</style>

<script lang="ts">
  import { onMount } from "svelte";
  import { auth } from "$lib/shared/auth/firebase";
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
    baseline: "Baseline",
    awaiting_indexing: "Waiting for crawl",
    primary_collecting: "Primary window",
    primary_complete: "Primary readout",
    confirmed: "Confirmed",
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
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type }),
    });
    if (!response.ok) {
      throw new Error(`SEO evidence request failed (${response.status}).`);
    }
    const body = (await response.json()) as {
      success?: boolean;
      results?: unknown[][];
      message?: string;
    };
    if (!body.success) throw new Error(body.message ?? "SEO query failed.");
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
    } catch (error) {
      console.error("Failed to load SEO evidence:", error);
      loadError =
        error instanceof Error
          ? error.message
          : "SEO evidence could not be read.";
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
      <p>The next SEO Measurement run will publish the first readout.</p>
      <a
        class="command-button"
        href={POSTHOG_URL}
        target="_blank"
        rel="noreferrer"
      >
        Open PostHog
      </a>
    </div>
  {:else}
    <header class="command-header">
      <div class="title-block">
        <div class="eyebrow">SEO command center</div>
        <h2>Flow Arts Software</h2>
        <p>Search evidence, from crawl to conversion.</p>
      </div>
      <div class="header-status">
        <span class="phase-badge">
          <span class="status-dot" aria-hidden="true"></span>
          {PHASE_LABELS[snapshot.phase]}
        </span>
        <span class="data-date"
          >Data through {formatDate(snapshot.dataThrough)}</span
        >
      </div>
    </header>

    <SeoSignalGrid {snapshot} />

    <div class="command-grid">
      <SeoExperimentClock {snapshot} />
      <SeoEvidenceGates {snapshot} />
    </div>

    <SeoQueryGroups {snapshot} />
    <SeoHistoryChart {history} />
    <SeoMeasurementHealth {snapshot} />
    <SeoSourceActions {refreshedAt} {refreshing} onRefresh={loadEvidence} />

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
    display: flex;
    height: 100%;
    flex-direction: column;
    gap: clamp(12px, 1.5vw, 20px);
    padding: clamp(12px, 2vw, 24px);
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
    font-size: clamp(1.75rem, 1.3rem + 1.8vw, 3rem);
    line-height: 1;
    letter-spacing: -0.04em;
  }

  .title-block p {
    margin: 8px 0 0;
    color: var(--theme-text-dim, rgba(248, 250, 252, 0.65));
    font-size: var(--font-size-min, 0.875rem);
  }

  .header-status {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
  }

  .phase-badge {
    display: inline-flex;
    min-height: 32px;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
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
    letter-spacing: 0.05em;
    text-transform: uppercase;
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

  .command-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(280px, 0.75fr);
    align-items: stretch;
    gap: 12px;
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

  @media (max-width: 520px) {
    .seo-command-center {
      padding: 12px;
    }

    .command-header {
      align-items: stretch;
      flex-direction: column;
    }

    .header-status {
      align-items: flex-start;
    }

    .command-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

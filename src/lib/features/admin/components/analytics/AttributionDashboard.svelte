<script lang="ts">
  /**
   * Attribution Dashboard
   *
   * Admin view of where users discovered TKA Composer. Combines:
   *  - Self-reported answers from the deferred attribution prompt
   *  - First-touch referrer category (search / social / video / direct)
   *  - UTM source breakdown
   *  - Time-to-convert (days between first visit and signup)
   *  - Recent self-reported answers with free-text follow-ups
   */

  import { onMount } from "svelte";
  import { getSystemStateManager } from "$lib/features/admin/getSystemStateManager";
  import type {
    ISystemStateManager,
    CachedUserMetadata,
  } from "../../services/contracts/ISystemStateManager";
  import type {
    ReferrerCategory,
    SelfReportedSource,
    SignupMethod,
  } from "$lib/shared/attribution/domain/types";

  let isLoading = $state(true);
  let cacheAge = $state("");
  let errorMessage = $state<string | null>(null);

  // Totals
  let totalUsers = $state(0);
  let usersWithAttribution = $state(0);
  let usersWithSelfReported = $state(0);

  // Breakdowns
  let bySelfReported = $state<Record<SelfReportedSource, number>>({
    search_engine: 0,
    social_media: 0,
    youtube_video: 0,
    friend_or_colleague: 0,
    flow_event_or_festival: 0,
    online_community: 0,
    other: 0,
  });

  let byReferrerCategory = $state<Record<ReferrerCategory, number>>({
    search: 0,
    social: 0,
    video: 0,
    email: 0,
    referral: 0,
    direct: 0,
  });

  let byUtmSource = $state<Array<{ source: string; count: number }>>([]);
  let bySignupMethod = $state<Record<SignupMethod, number>>({
    google: 0,
    apple: 0,
    email: 0,
  });

  // Conversion metrics
  let avgDaysToConvert = $state(0);
  let avgSessionsToConvert = $state(0);

  // Recent self-reported answers (with follow-up text when present)
  let recentSelfReports = $state<
    Array<{
      userId: string;
      displayName: string;
      email: string | null;
      source: SelfReportedSource;
      timestamp: string;
      detail?: string;
    }>
  >([]);

  // Friendly labels
  const SELF_REPORTED_LABELS: Record<SelfReportedSource, { label: string; icon: string; color: string }> = {
    search_engine:          { label: "Search Engine",      icon: "fa-magnifying-glass", color: "#3b82f6" },
    social_media:           { label: "Social Media",        icon: "fa-hashtag",          color: "#ec4899" },
    youtube_video:          { label: "YouTube Video",       icon: "fa-play",             color: "#ef4444" },
    friend_or_colleague:    { label: "Friend / Colleague",  icon: "fa-user-group",       color: "#f59e0b" },
    flow_event_or_festival: { label: "Event / Festival",    icon: "fa-fire",             color: "#f97316" },
    online_community:       { label: "Online Community",    icon: "fa-comments",         color: "#8b5cf6" },
    other:                  { label: "Other",               icon: "fa-ellipsis",         color: "#64748b" },
  };

  const REFERRER_LABELS: Record<ReferrerCategory, { label: string; icon: string; color: string }> = {
    search:   { label: "Search",    icon: "fa-magnifying-glass", color: "#3b82f6" },
    social:   { label: "Social",    icon: "fa-hashtag",          color: "#ec4899" },
    video:    { label: "Video",     icon: "fa-play",             color: "#ef4444" },
    email:    { label: "Email",     icon: "fa-envelope",         color: "#22c55e" },
    referral: { label: "Referral",  icon: "fa-arrow-up-right-from-square", color: "#8b5cf6" },
    direct:   { label: "Direct",    icon: "fa-bookmark",         color: "#64748b" },
  };

  onMount(async () => {
    try {
      const systemStateService: ISystemStateManager = getSystemStateManager();
      const state = await systemStateService.getSystemState();
      const users = state.users;

      totalUsers = users.length;

      let daysSum = 0;
      let sessionsSum = 0;
      let convertedCount = 0;
      const utmSourceMap = new Map<string, number>();

      const recent: typeof recentSelfReports = [];

      for (const u of users) {
        if (!u.attribution) continue;
        usersWithAttribution++;

        // Referrer category from first touch
        const refCat = u.attribution.firstTouch?.referrer?.category;
        if (refCat && refCat in byReferrerCategory) {
          byReferrerCategory[refCat]++;
        }

        // UTM source (from first touch, if any)
        const utmSource = u.attribution.firstTouch?.utm?.source;
        if (utmSource) {
          utmSourceMap.set(utmSource, (utmSourceMap.get(utmSource) ?? 0) + 1);
        }

        // Signup method
        const method = u.attribution.signup?.method;
        if (method && method in bySignupMethod) {
          bySignupMethod[method]++;
        }

        // Conversion averages
        if (typeof u.attribution.daysSinceFirstVisit === "number") {
          daysSum += u.attribution.daysSinceFirstVisit;
          sessionsSum += u.attribution.sessionCount ?? 1;
          convertedCount++;
        }

        // Self-reported
        const self = u.attribution.selfReported;
        if (self) {
          usersWithSelfReported++;
          if (self.source in bySelfReported) {
            bySelfReported[self.source]++;
          }
          const detail =
            self.personName ?? self.eventName ?? self.details ?? undefined;
          recent.push({
            userId: u.id,
            displayName: u.displayName,
            email: u.email,
            source: self.source,
            timestamp: self.timestamp,
            detail,
          });
        }
      }

      avgDaysToConvert = convertedCount > 0 ? Math.round((daysSum / convertedCount) * 10) / 10 : 0;
      avgSessionsToConvert = convertedCount > 0 ? Math.round((sessionsSum / convertedCount) * 10) / 10 : 0;

      byUtmSource = Array.from(utmSourceMap.entries())
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      recentSelfReports = recent
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, 20);

      const ageMs = Date.now() - state.loadedAt;
      cacheAge = ageMs < 60000 ? "just now" : `${Math.round(ageMs / 60000)}m ago`;
    } catch (err) {
      console.error("[AttributionDashboard] Failed to load:", err);
      errorMessage = err instanceof Error ? err.message : "Failed to load attribution data";
    } finally {
      isLoading = false;
    }
  });

  const selfReportedEntries = $derived(
    (Object.keys(bySelfReported) as SelfReportedSource[])
      .map((key) => ({ key, count: bySelfReported[key], ...SELF_REPORTED_LABELS[key] }))
      .sort((a, b) => b.count - a.count)
  );

  const referrerEntries = $derived(
    (Object.keys(byReferrerCategory) as ReferrerCategory[])
      .map((key) => ({ key, count: byReferrerCategory[key], ...REFERRER_LABELS[key] }))
      .sort((a, b) => b.count - a.count)
  );

  const signupMethodEntries = $derived(
    (Object.keys(bySignupMethod) as SignupMethod[])
      .map((key) => ({ key, count: bySignupMethod[key] }))
      .filter((e) => e.count > 0)
      .sort((a, b) => b.count - a.count)
  );

  function pct(n: number, total: number): string {
    if (total === 0) return "0%";
    return `${Math.round((n / total) * 100)}%`;
  }

  function formatRelativeTime(iso: string): string {
    const t = new Date(iso).getTime();
    if (isNaN(t)) return iso;
    const diffMs = Date.now() - t;
    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (days === 0) return "today";
    if (days === 1) return "1d ago";
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
  }

  function exportCsv() {
    const rows = [
      ["userId", "displayName", "email", "source", "timestamp", "detail"].join(","),
      ...recentSelfReports.map((r) =>
        [
          r.userId,
          JSON.stringify(r.displayName ?? ""),
          JSON.stringify(r.email ?? ""),
          r.source,
          r.timestamp,
          JSON.stringify(r.detail ?? ""),
        ].join(",")
      ),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attribution-self-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="attribution-dashboard">
  <header class="dashboard-header">
    <div class="header-content">
      <h2>
        <i class="fas fa-compass" aria-hidden="true"></i>
        Attribution
      </h2>
      <span class="beta-badge">Where users come from</span>
    </div>
    {#if cacheAge}
      <span class="cache-indicator" title="Data from SystemState cache">
        <i class="fas fa-database" aria-hidden="true"></i>
        {cacheAge}
      </span>
    {/if}
  </header>

  {#if isLoading}
    <div class="loading-state">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      <p>Loading attribution data...</p>
    </div>
  {:else if errorMessage}
    <div class="error-state">
      <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
      <p>{errorMessage}</p>
    </div>
  {:else}
    <!-- Top-line coverage -->
    <section class="section" aria-labelledby="coverage-title">
      <h3 id="coverage-title" class="section-title">
        <i class="fas fa-bolt" aria-hidden="true"></i>
        Coverage
      </h3>
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-value">{totalUsers}</div>
          <div class="metric-label">Total Users</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">{usersWithAttribution}</div>
          <div class="metric-label">With Attribution</div>
          <div class="metric-sub">{pct(usersWithAttribution, totalUsers)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">{usersWithSelfReported}</div>
          <div class="metric-label">Self-Reported</div>
          <div class="metric-sub">{pct(usersWithSelfReported, totalUsers)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">{avgDaysToConvert}</div>
          <div class="metric-label">Avg Days to Convert</div>
          <div class="metric-sub">{avgSessionsToConvert} sessions avg</div>
        </div>
      </div>
    </section>

    <!-- Self-reported breakdown -->
    <section class="section" aria-labelledby="self-reported-title">
      <h3 id="self-reported-title" class="section-title">
        <i class="fas fa-hand-holding-heart" aria-hidden="true"></i>
        Self-Reported Source
        <span class="section-subtitle">from the "how did you hear about us?" prompt</span>
      </h3>
      {#if usersWithSelfReported === 0}
        <p class="empty">No self-reported answers yet.</p>
      {:else}
        <div class="bars">
          {#each selfReportedEntries as entry (entry.key)}
            <div class="bar-row">
              <div class="bar-label">
                <i class="fas {entry.icon}" style="color:{entry.color}" aria-hidden="true"></i>
                <span>{entry.label}</span>
              </div>
              <div class="bar-track">
                <div
                  class="bar-fill"
                  style="width: {pct(entry.count, usersWithSelfReported)}; background: {entry.color};"
                ></div>
              </div>
              <div class="bar-count">
                <strong>{entry.count}</strong>
                <span class="muted">{pct(entry.count, usersWithSelfReported)}</span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <!-- First-touch referrer category -->
    <section class="section" aria-labelledby="referrer-title">
      <h3 id="referrer-title" class="section-title">
        <i class="fas fa-route" aria-hidden="true"></i>
        First-Touch Referrer
        <span class="section-subtitle">auto-detected on first visit</span>
      </h3>
      {#if usersWithAttribution === 0}
        <p class="empty">No attribution records yet.</p>
      {:else}
        <div class="bars">
          {#each referrerEntries as entry (entry.key)}
            <div class="bar-row">
              <div class="bar-label">
                <i class="fas {entry.icon}" style="color:{entry.color}" aria-hidden="true"></i>
                <span>{entry.label}</span>
              </div>
              <div class="bar-track">
                <div
                  class="bar-fill"
                  style="width: {pct(entry.count, usersWithAttribution)}; background: {entry.color};"
                ></div>
              </div>
              <div class="bar-count">
                <strong>{entry.count}</strong>
                <span class="muted">{pct(entry.count, usersWithAttribution)}</span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <!-- UTM sources -->
    {#if byUtmSource.length > 0}
      <section class="section" aria-labelledby="utm-title">
        <h3 id="utm-title" class="section-title">
          <i class="fas fa-link" aria-hidden="true"></i>
          Top UTM Sources
          <span class="section-subtitle">from marketing links (top 10)</span>
        </h3>
        <ul class="list">
          {#each byUtmSource as entry (entry.source)}
            <li class="list-row">
              <span class="list-label">
                <i class="fas fa-tag" aria-hidden="true"></i>
                {entry.source}
              </span>
              <span class="list-count">{entry.count}</span>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <!-- Signup method -->
    {#if signupMethodEntries.length > 0}
      <section class="section" aria-labelledby="signup-title">
        <h3 id="signup-title" class="section-title">
          <i class="fas fa-right-to-bracket" aria-hidden="true"></i>
          Signup Method
        </h3>
        <div class="chip-row">
          {#each signupMethodEntries as entry (entry.key)}
            <div class="chip">
              <span class="chip-label">{entry.key}</span>
              <span class="chip-count">{entry.count}</span>
            </div>
          {/each}
        </div>
      </section>
    {/if}

    <!-- Recent self-reports with free-text details -->
    <section class="section" aria-labelledby="recent-title">
      <div class="section-title-row">
        <h3 id="recent-title" class="section-title">
          <i class="fas fa-list" aria-hidden="true"></i>
          Recent Self-Reports
          <span class="section-subtitle">last 20</span>
        </h3>
        <button
          class="export-button"
          onclick={exportCsv}
          disabled={recentSelfReports.length === 0}
          type="button"
        >
          <i class="fas fa-file-csv" aria-hidden="true"></i>
          Export CSV
        </button>
      </div>
      {#if recentSelfReports.length === 0}
        <p class="empty">No self-reported answers yet.</p>
      {:else}
        <ul class="report-list">
          {#each recentSelfReports as report (report.userId + report.timestamp)}
            <li class="report-row">
              <span
                class="report-icon"
                style="color: {SELF_REPORTED_LABELS[report.source].color};"
              >
                <i
                  class="fas {SELF_REPORTED_LABELS[report.source].icon}"
                  aria-hidden="true"
                ></i>
              </span>
              <div class="report-content">
                <div class="report-top">
                  <strong>{report.displayName}</strong>
                  <span class="muted">{report.email ?? ""}</span>
                </div>
                <div class="report-mid">
                  <span class="report-source">
                    {SELF_REPORTED_LABELS[report.source].label}
                  </span>
                  {#if report.detail}
                    <span class="report-detail">"{report.detail}"</span>
                  {/if}
                </div>
              </div>
              <span class="report-time" title={report.timestamp}>
                {formatRelativeTime(report.timestamp)}
              </span>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {/if}
</div>

<style>
  .attribution-dashboard {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .dashboard-header h2 {
    margin: 0;
    font-size: var(--font-size-2xl);
    font-weight: 600;
    color: var(--theme-text);
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .dashboard-header h2 i {
    color: #8b5cf6;
  }

  .beta-badge {
    font-size: var(--font-size-xs);
    font-weight: 600;
    padding: 4px 8px;
    border-radius: 4px;
    background: linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%);
    color: white;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .cache-indicator {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 240px;
    gap: 14px;
    color: var(--theme-text-dim);
    background: var(--theme-card-bg);
    border: 1px dashed var(--theme-stroke);
    border-radius: 12px;
  }

  .error-state {
    color: #ef4444;
  }

  .loading-state i,
  .error-state i {
    font-size: 2.25rem;
  }

  .section {
    background: var(--theme-card-bg);
    border-radius: 12px;
    padding: 20px;
    border: 1px solid var(--theme-stroke);
  }

  .section-title {
    margin: 0 0 16px 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--theme-text);
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .section-title i {
    color: var(--theme-text-dim);
  }

  .section-subtitle {
    font-size: var(--font-size-compact);
    font-weight: 400;
    color: var(--theme-text-dim);
  }

  .section-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .section-title-row .section-title {
    margin: 0;
  }

  .export-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    min-height: var(--min-touch-target);
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    color: var(--theme-text);
    font-size: var(--font-size-compact);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .export-button:hover:not(:disabled) {
    background: color-mix(in srgb, #8b5cf6 15%, var(--theme-panel-bg));
    border-color: #8b5cf6;
  }

  .export-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
  }

  .metric-card {
    background: var(--theme-panel-bg);
    border-radius: 10px;
    padding: 16px;
    text-align: center;
  }

  .metric-value {
    font-size: var(--font-size-3xl);
    font-weight: 700;
    color: var(--theme-text);
    line-height: 1;
    margin-bottom: 6px;
  }

  .metric-label {
    font-size: var(--font-size-min);
    font-weight: 500;
    color: var(--theme-text-dim);
  }

  .metric-sub {
    font-size: var(--font-size-xs);
    color: var(--theme-text-dim);
    margin-top: 4px;
    opacity: 0.8;
  }

  /* Bar chart */
  .bars {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .bar-row {
    display: grid;
    grid-template-columns: 180px 1fr 110px;
    align-items: center;
    gap: 12px;
  }

  .bar-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-min);
    color: var(--theme-text);
  }

  .bar-track {
    height: 10px;
    background: var(--theme-panel-bg);
    border-radius: 999px;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    border-radius: 999px;
    transition: width 0.3s ease;
    min-width: 2px;
  }

  .bar-count {
    display: flex;
    justify-content: flex-end;
    align-items: baseline;
    gap: 6px;
    font-size: var(--font-size-min);
    color: var(--theme-text);
  }

  .muted {
    color: var(--theme-text-dim);
    font-size: var(--font-size-xs);
  }

  /* List (UTM) */
  .list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .list-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    background: var(--theme-panel-bg);
    border-radius: 8px;
    font-size: var(--font-size-min);
  }

  .list-label {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--theme-text);
  }

  .list-label i {
    color: var(--theme-text-dim);
  }

  .list-count {
    font-weight: 600;
    color: var(--theme-text);
  }

  /* Chips */
  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 999px;
    font-size: var(--font-size-min);
  }

  .chip-label {
    color: var(--theme-text);
    text-transform: capitalize;
  }

  .chip-count {
    color: var(--theme-text-dim);
    font-weight: 600;
  }

  /* Report list */
  .report-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .report-row {
    display: grid;
    grid-template-columns: 32px 1fr auto;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: var(--theme-panel-bg);
    border-radius: 8px;
  }

  .report-icon {
    font-size: 1.1rem;
    text-align: center;
  }

  .report-content {
    min-width: 0;
  }

  .report-top {
    display: flex;
    gap: 8px;
    align-items: baseline;
    font-size: var(--font-size-min);
    color: var(--theme-text);
  }

  .report-top strong {
    font-weight: 600;
  }

  .report-mid {
    display: flex;
    gap: 8px;
    align-items: baseline;
    margin-top: 2px;
    font-size: var(--font-size-xs);
    flex-wrap: wrap;
  }

  .report-source {
    color: var(--theme-text-dim);
  }

  .report-detail {
    color: var(--theme-text);
    font-style: italic;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 460px;
  }

  .report-time {
    font-size: var(--font-size-xs);
    color: var(--theme-text-dim);
    white-space: nowrap;
  }

  .empty {
    color: var(--theme-text-dim);
    font-size: var(--font-size-min);
    margin: 0;
    padding: 16px 0;
    text-align: center;
  }

  @media (max-width: 768px) {
    .attribution-dashboard {
      padding: 16px;
      gap: 16px;
    }

    .dashboard-header h2 {
      font-size: var(--font-size-xl);
    }

    .metrics-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .bar-row {
      grid-template-columns: 120px 1fr 80px;
      gap: 8px;
    }

    .bar-label span {
      font-size: var(--font-size-xs);
    }

    .report-detail {
      max-width: 220px;
    }
  }

  @media (max-width: 400px) {
    .metrics-grid {
      grid-template-columns: 1fr;
    }

    .bar-row {
      grid-template-columns: 100px 1fr 70px;
    }
  }
</style>

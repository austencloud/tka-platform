<!--
  UserActivityAnalytics.svelte

  Displays aggregated PostHog analytics for a user in the admin detail modal.
  Shows engagement summary, activity breakdown, content metrics, and recent sessions.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { getPostHogUserAnalytics } from "$lib/features/admin/get-post-hog-user-analytics";
  import type { UserEngagementSummary, ModuleActivityBreakdown, ContentMetrics, PostHogSessionSummary, TimePeriod } from "../services/types";
import type { PostHogUserAnalytics } from "../services/post-hog-user-analytics";

  interface Props {
    userId: string;
    compact?: boolean;
  }

  let { userId, compact = false }: Props = $props();

  // Service
  let analyticsService: PostHogUserAnalytics | null = null;

  // Data state
  let engagement = $state<UserEngagementSummary | null>(null);
  let activityBreakdown = $state<ModuleActivityBreakdown[]>([]);
  let contentMetrics = $state<ContentMetrics | null>(null);
  let recentSessions = $state<PostHogSessionSummary[]>([]);

  // Loading states
  let isLoadingEngagement = $state(true);
  let isLoadingActivity = $state(true);
  let isLoadingContent = $state(true);
  let isLoadingSessions = $state(true);

  // UI state
  let selectedPeriod = $state<TimePeriod>("week");
  let isApiAvailable = $state(false);

  // Load all data when component mounts or userId changes
  $effect(() => {
    if (userId) {
      loadAllData(userId);
    }
  });

  async function loadAllData(uid: string) {
    analyticsService = getPostHogUserAnalytics();

    if (!analyticsService) {
      isLoadingEngagement = false;
      isLoadingActivity = false;
      isLoadingContent = false;
      isLoadingSessions = false;
      return;
    }

    // Load all data in parallel, then check if the API was reachable
    await Promise.all([
      loadEngagement(uid),
      loadActivityBreakdown(uid, selectedPeriod),
      loadContentMetrics(uid),
      loadRecentSessions(uid),
    ]);

    // Update banner after queries complete (service tracks whether API responded)
    isApiAvailable = analyticsService.isAvailable();
  }

  async function loadEngagement(uid: string) {
    isLoadingEngagement = true;
    try {
      engagement = await analyticsService!.getEngagementSummary(uid);
    } catch (error) {
      console.error("[UserActivityAnalytics] Failed to load engagement:", error);
      engagement = null;
    } finally {
      isLoadingEngagement = false;
    }
  }

  async function loadActivityBreakdown(uid: string, period: TimePeriod) {
    isLoadingActivity = true;
    try {
      activityBreakdown = await analyticsService!.getActivityBreakdown(uid, period);
    } catch (error) {
      console.error("[UserActivityAnalytics] Failed to load activity:", error);
      activityBreakdown = [];
    } finally {
      isLoadingActivity = false;
    }
  }

  async function loadContentMetrics(uid: string) {
    isLoadingContent = true;
    try {
      contentMetrics = await analyticsService!.getContentMetrics(uid);
    } catch (error) {
      console.error("[UserActivityAnalytics] Failed to load content metrics:", error);
      contentMetrics = null;
    } finally {
      isLoadingContent = false;
    }
  }

  async function loadRecentSessions(uid: string) {
    isLoadingSessions = true;
    try {
      recentSessions = await analyticsService!.getRecentSessions(uid, compact ? 3 : 5);
    } catch (error) {
      console.error("[UserActivityAnalytics] Failed to load sessions:", error);
      recentSessions = [];
    } finally {
      isLoadingSessions = false;
    }
  }

  async function handlePeriodChange(period: TimePeriod) {
    selectedPeriod = period;
    if (analyticsService && userId) {
      await loadActivityBreakdown(userId, period);
    }
  }

  function openSessionReplay(session: PostHogSessionSummary) {
    if (session.replayUrl) {
      window.open(session.replayUrl, "_blank", "noopener,noreferrer");
    }
  }

  // Format helpers
  function formatRelativeTime(isoString: string | null): string {
    if (!isoString) return "Never";

    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;
  }

  function formatMemberDuration(isoString: string | null): string {
    if (!isoString) return "Unknown";

    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffMonths / 12);

    if (diffYears > 0) return `${diffYears} year${diffYears > 1 ? "s" : ""}`;
    if (diffMonths > 0) return `${diffMonths} month${diffMonths > 1 ? "s" : ""}`;
    return `${diffDays} day${diffDays > 1 ? "s" : ""}`;
  }

  function formatDuration(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes} min`;
  }

  function formatSessionTime(date: Date): string {
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeStr = date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });

    if (isToday) return `Today ${timeStr}`;
    if (isYesterday) return `Yesterday ${timeStr}`;

    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    }) + " " + timeStr;
  }

  function getModuleColor(module: string): string {
    const colors: Record<string, string> = {
      browse: "#3b82f6",
      create: "#22c55e",
      learn: "#f59e0b",
      train: "#ec4899",
      compose: "#8b5cf6",
      settings: "#6b7280",
    };
    return colors[module] || "#64748b";
  }

  function getPeriodLabel(period: TimePeriod): string {
    switch (period) {
      case "today":
        return "Today";
      case "week":
        return "This Week";
      case "month":
        return "This Month";
      case "all":
        return "All Time";
    }
  }
</script>

<div class="analytics-container" class:compact>
  <!-- API Status Banner (only show if using mock data) -->
  {#if !isApiAvailable}
    <div class="api-status-banner">
      <i class="fas fa-info-circle" aria-hidden="true"></i>
      <span>Using sample data. Connect PostHog API for live metrics.</span>
    </div>
  {/if}

  <!-- Engagement Summary -->
  <section class="analytics-section engagement-section">
    <h4 class="section-title">
      <i class="fas fa-chart-line" aria-hidden="true"></i>
      Engagement Summary
    </h4>
    {#if isLoadingEngagement}
      <div class="loading-placeholder">
        <div class="skeleton-row"></div>
        <div class="skeleton-row"></div>
      </div>
    {:else if engagement}
      <div class="engagement-grid">
        <div class="engagement-item">
          <span class="engagement-label">Last active</span>
          <span class="engagement-value">{formatRelativeTime(engagement.lastActiveAt)}</span>
        </div>
        <div class="engagement-item">
          <span class="engagement-label">Member for</span>
          <span class="engagement-value">{formatMemberDuration(engagement.memberSince)}</span>
        </div>
        <div class="engagement-item">
          <span class="engagement-label">Sessions (30d)</span>
          <span class="engagement-value">{engagement.sessionsCount}</span>
        </div>
        <div class="engagement-item">
          <span class="engagement-label">Avg session</span>
          <span class="engagement-value">{formatDuration(engagement.avgSessionDuration)}</span>
        </div>
      </div>
    {:else}
      <div class="empty-state-inline">
        <span>No engagement data available</span>
      </div>
    {/if}
  </section>

  <!-- Activity Breakdown -->
  <section class="analytics-section activity-section">
    <div class="section-header">
      <h4 class="section-title">
        <i class="fas fa-chart-pie" aria-hidden="true"></i>
        Activity Breakdown
      </h4>
      <select
        class="period-select"
        bind:value={selectedPeriod}
        onchange={() => handlePeriodChange(selectedPeriod)}
      >
        <option value="today">Today</option>
        <option value="week">This Week</option>
        <option value="month">This Month</option>
        <option value="all">All Time</option>
      </select>
    </div>
    {#if isLoadingActivity}
      <div class="loading-placeholder">
        <div class="skeleton-bar"></div>
        <div class="skeleton-bar"></div>
        <div class="skeleton-bar"></div>
      </div>
    {:else if activityBreakdown.length > 0}
      <div class="activity-bars">
        {#each activityBreakdown as activity}
          <div class="activity-row">
            <span class="activity-module">{activity.module}</span>
            <div class="activity-bar-container">
              <div
                class="activity-bar"
                style="width: {activity.percentage}%; background-color: {getModuleColor(activity.module)}"
              ></div>
            </div>
            <span class="activity-percent">{activity.percentage}%</span>
          </div>
        {/each}
      </div>
    {:else}
      <div class="empty-state-inline">
        <span>No activity in {getPeriodLabel(selectedPeriod).toLowerCase()}</span>
      </div>
    {/if}
  </section>

  <!-- Content Metrics -->
  {#if !compact}
    <section class="analytics-section content-section">
      <h4 class="section-title">
        <i class="fas fa-layer-group" aria-hidden="true"></i>
        Content Metrics
      </h4>
      {#if isLoadingContent}
        <div class="loading-placeholder">
          <div class="skeleton-row"></div>
          <div class="skeleton-row"></div>
        </div>
      {:else if contentMetrics}
        <div class="content-grid">
          <div class="content-item">
            <span class="content-value">{contentMetrics.sequencesCreated}</span>
            <span class="content-label">Created</span>
          </div>
          <div class="content-item">
            <span class="content-value">{contentMetrics.sequencesSaved}</span>
            <span class="content-label">Saved</span>
          </div>
          <div class="content-item">
            <span class="content-value">{contentMetrics.sequencesExported}</span>
            <span class="content-label">Exported</span>
          </div>
          <div class="content-item">
            <span class="content-value">{contentMetrics.collectionsCreated}</span>
            <span class="content-label">Collections</span>
          </div>
        </div>
      {:else}
        <div class="empty-state-inline">
          <span>No content metrics available</span>
        </div>
      {/if}
    </section>
  {/if}

  <!-- Recent Sessions -->
  <section class="analytics-section sessions-section">
    <h4 class="section-title">
      <i class="fas fa-history" aria-hidden="true"></i>
      Recent Sessions
    </h4>
    {#if isLoadingSessions}
      <div class="loading-placeholder">
        <div class="skeleton-session"></div>
        <div class="skeleton-session"></div>
      </div>
    {:else if recentSessions.length > 0}
      <div class="sessions-list">
        {#each recentSessions as session}
          <div class="session-item">
            <div class="session-info">
              <span class="session-time">{formatSessionTime(session.startedAt)}</span>
              <span class="session-duration">{formatDuration(session.duration)}</span>
              <span class="session-modules">
                {session.modules.slice(0, 3).join(", ")}
                {#if session.modules.length > 3}
                  +{session.modules.length - 3}
                {/if}
              </span>
            </div>
            {#if session.hasRecording}
              <button
                class="replay-btn"
                onclick={() => openSessionReplay(session)}
                title="Watch session replay in PostHog"
              >
                <i class="fas fa-play" aria-hidden="true"></i>
                <span class="replay-label">Replay</span>
              </button>
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <div class="empty-state-inline">
        <i class="fas fa-clock" aria-hidden="true"></i>
        <span>No recent sessions</span>
      </div>
    {/if}
  </section>
</div>

<style>
  .analytics-container {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .analytics-container.compact {
    gap: 16px;
  }

  /* API Status Banner */
  .api-status-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: color-mix(in srgb, var(--semantic-info) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-info) 30%, transparent);
    border-radius: 8px;
    font-size: var(--font-size-sm);
    color: var(--semantic-info);
  }

  .api-status-banner i {
    font-size: 14px;
  }

  /* Section Styling */
  .analytics-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .section-title i {
    font-size: 14px;
    color: var(--theme-accent);
  }

  /* Period Select */
  .period-select {
    padding: 4px 8px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 6px;
    font-size: var(--font-size-sm);
    color: var(--theme-text);
    cursor: pointer;
  }

  .period-select:hover {
    border-color: var(--theme-stroke-strong);
  }

  .period-select:focus {
    outline: 2px solid var(--theme-accent);
    outline-offset: 1px;
  }

  /* Engagement Grid */
  .engagement-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .engagement-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 10px;
  }

  .engagement-label {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
  }

  .engagement-value {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--theme-text);
  }

  /* Activity Bars */
  .activity-bars {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .activity-row {
    display: grid;
    grid-template-columns: 80px 1fr 40px;
    align-items: center;
    gap: 10px;
  }

  .activity-module {
    font-size: var(--font-size-sm);
    color: var(--theme-text);
    text-transform: capitalize;
  }

  .activity-bar-container {
    height: 20px;
    background: var(--theme-card-bg);
    border-radius: 10px;
    overflow: hidden;
  }

  .activity-bar {
    height: 100%;
    border-radius: 10px;
    transition: width 0.3s ease;
  }

  .activity-percent {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--theme-text-dim);
    text-align: right;
  }

  /* Content Grid */
  .content-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }

  .content-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 10px;
  }

  .content-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--theme-text);
  }

  .content-label {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
  }

  /* Sessions List */
  .sessions-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .session-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 10px;
    transition: border-color var(--duration-fast) ease;
  }

  .session-item:hover {
    border-color: var(--theme-stroke-strong);
  }

  .session-info {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
  }

  .session-time {
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--theme-text);
  }

  .session-duration {
    font-size: var(--font-size-sm);
    color: var(--theme-accent);
    font-weight: 600;
    padding: 2px 8px;
    background: var(--theme-accent-bg);
    border-radius: 6px;
  }

  .session-modules {
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim);
  }

  .replay-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--theme-accent-bg);
    border: 1px solid var(--theme-accent);
    border-radius: 8px;
    color: var(--theme-accent);
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    white-space: nowrap;
  }

  .replay-btn:hover {
    background: var(--theme-accent);
    color: white;
  }

  .replay-btn:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .replay-btn i {
    font-size: 10px;
  }

  /* Loading States */
  .loading-placeholder {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .skeleton-row {
    height: 48px;
    background: linear-gradient(
      90deg,
      var(--theme-card-bg) 0%,
      var(--theme-card-hover-bg) 50%,
      var(--theme-card-bg) 100%
    );
    background-size: 200% 100%;
    border-radius: 8px;
    animation: shimmer 1.5s infinite;
  }

  .skeleton-bar {
    height: 20px;
    background: linear-gradient(
      90deg,
      var(--theme-card-bg) 0%,
      var(--theme-card-hover-bg) 50%,
      var(--theme-card-bg) 100%
    );
    background-size: 200% 100%;
    border-radius: 10px;
    animation: shimmer 1.5s infinite;
  }

  .skeleton-session {
    height: 52px;
    background: linear-gradient(
      90deg,
      var(--theme-card-bg) 0%,
      var(--theme-card-hover-bg) 50%,
      var(--theme-card-bg) 100%
    );
    background-size: 200% 100%;
    border-radius: 10px;
    animation: shimmer 1.5s infinite;
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  /* Empty States */
  .empty-state-inline {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 20px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm);
  }

  .empty-state-inline i {
    font-size: 16px;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .engagement-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .content-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .activity-row {
      grid-template-columns: 60px 1fr 36px;
    }

    .replay-label {
      display: none;
    }

    .replay-btn {
      padding: 8px;
    }
  }

  @media (max-width: 480px) {
    .session-info {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .skeleton-row,
    .skeleton-bar,
    .skeleton-session {
      animation: none;
    }

    .activity-bar {
      transition: none;
    }
  }
</style>

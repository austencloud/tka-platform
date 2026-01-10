<!-- UserActivityDetail.svelte - Admin drill-down into user activity -->
<script lang="ts">
  import { onMount } from "svelte";
  import { container } from "$lib/shared/di";
  import type {
    IUserActivityTracker,
    SessionSummary,
  } from "../../services/contracts/IUserActivityTracker";
  import type { ActivityEvent } from "$lib/shared/analytics/domain/models/ActivityEvent";

  interface Props {
    userId: string;
    onClose: () => void;
  }

  let { userId, onClose }: Props = $props();

  // State
  let sessions = $state<SessionSummary[]>([]);
  let selectedSession = $state<SessionSummary | null>(null);
  let sessionEvents = $state<ActivityEvent[]>([]);
  let isLoading = $state(true);
  let isLoadingEvents = $state(false);

  onMount(async () => {
    try {
      const service = container.items.userActivityTracker;
      sessions = await service.getUserSessions(userId, 20);
    } catch (e) {
      console.error("Failed to load user sessions:", e);
    } finally {
      isLoading = false;
    }
  });

  async function selectSession(session: SessionSummary) {
    if (selectedSession?.sessionId === session.sessionId) {
      selectedSession = null;
      sessionEvents = [];
      return;
    }

    selectedSession = session;
    isLoadingEvents = true;

    try {
      const service = container.items.userActivityTracker;
      sessionEvents = await service.getSessionActivity(
        userId,
        session.sessionId
      );
    } catch (e) {
      console.error("Failed to load session events:", e);
      sessionEvents = [];
    } finally {
      isLoadingEvents = false;
    }
  }

  function formatDuration(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatDate(date: Date): string {
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getEventIcon(category: string): string {
    switch (category) {
      case "navigation":
        return "fa-compass";
      case "creation":
        return "fa-plus";
      case "session":
        return "fa-clock";
      case "interaction":
        return "fa-hand-pointer";
      default:
        return "fa-circle";
    }
  }
</script>

<div class="activity-detail">
  <header class="detail-header">
    <h3>User Activity</h3>
    <button class="close-btn" onclick={onClose} aria-label="Close">
      <i class="fas fa-times" aria-hidden="true"></i>
    </button>
  </header>

  <div class="detail-content">
    {#if isLoading}
      <div class="loading" role="status" aria-live="polite" aria-busy="true">
        <div class="spinner" aria-hidden="true"></div>
        <span>Loading sessions...</span>
      </div>
    {:else if sessions.length === 0}
      <div class="empty">
        <i class="fas fa-history" aria-hidden="true"></i>
        <span>No sessions found</span>
      </div>
    {:else}
      <div class="sessions-list">
        <h4>Sessions ({sessions.length})</h4>

        {#each sessions as session}
          <button
            class="session-card"
            class:selected={selectedSession?.sessionId === session.sessionId}
            onclick={() => selectSession(session)}
          >
            <div class="session-header">
              <span class="session-date">{formatDate(session.startedAt)}</span>
              <span class="session-duration"
                >{formatDuration(session.duration)}</span
              >
            </div>
            <div class="session-meta">
              <span class="event-count">
                <i class="fas fa-list" aria-hidden="true"></i>
                {session.eventCount} events
              </span>
              {#if session.modules.length > 0}
                <span class="modules">
                  {session.modules.slice(0, 3).join(", ")}
                  {#if session.modules.length > 3}
                    +{session.modules.length - 3}
                  {/if}
                </span>
              {/if}
            </div>
          </button>

          {#if selectedSession?.sessionId === session.sessionId}
            <div class="session-events">
              {#if isLoadingEvents}
                <div
                  class="loading-inline"
                  role="status"
                  aria-live="polite"
                  aria-busy="true"
                >
                  <div class="spinner-small" aria-hidden="true"></div>
                </div>
              {:else if sessionEvents.length === 0}
                <p class="no-events">No events recorded</p>
              {:else}
                <div class="events-timeline">
                  {#each sessionEvents as event}
                    <div class="event-item">
                      <i
                        class="fas {getEventIcon(event.category)}"
                        aria-hidden="true"
                      ></i>
                      <div class="event-info">
                        <span class="event-type">{event.eventType}</span>
                        <span class="event-time"
                          >{formatTime(event.timestamp)}</span
                        >
                      </div>
                      {#if event.metadata?.module}
                        <span class="event-module">{event.metadata.module}</span
                        >
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .activity-detail {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--theme-panel-bg);
  }

  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--theme-stroke);
  }

  .detail-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--theme-text);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px; /* WCAG AAA touch target */
    height: 48px;
    background: transparent;
    border: none;
    border-radius: 0.25rem;
    color: var(--theme-text-secondary, var(--theme-text-dim));
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .close-btn:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
  }

  .close-btn:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .detail-content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 1rem;
  }

  .loading,
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    height: 100%;
    color: var(--theme-text-secondary, var(--theme-text-dim));
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--theme-stroke);
    border-top-color: var(--theme-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner,
    .spinner-small {
      animation: none;
      border-top-color: var(--theme-accent);
      border-right-color: var(--theme-accent);
    }
  }

  .sessions-list h4 {
    margin: 0 0 0.75rem;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .session-card {
    display: block;
    width: 100%;
    min-height: 44px; /* WCAG AA touch target minimum */
    padding: 0.75rem;
    margin-bottom: 0.5rem;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 0.375rem;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
  }

  .session-card:hover {
    background: var(--theme-card-hover-bg);
  }

  .session-card:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .session-card.selected {
    background: var(--theme-accent-bg);
    border-color: var(--theme-accent);
  }

  .session-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.25rem;
  }

  .session-date {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--theme-text);
  }

  .session-duration {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-accent);
    font-weight: 500;
  }

  .session-meta {
    display: flex;
    gap: 0.75rem;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim);
  }

  .event-count {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .modules {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .session-events {
    margin-bottom: 0.75rem;
    padding: 0.75rem;
    background: var(--theme-panel-bg);
    border-radius: 0.25rem;
  }

  .loading-inline {
    display: flex;
    justify-content: center;
    padding: 0.5rem;
  }

  .spinner-small {
    width: 16px;
    height: 16px;
    border: 2px solid var(--theme-stroke);
    border-top-color: var(--theme-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .no-events {
    margin: 0;
    text-align: center;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim);
  }

  .events-timeline {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 200px;
    overflow-y: auto;
  }

  .event-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim);
  }

  .event-item i {
    width: 14px;
    color: var(--theme-accent);
    opacity: 0.7;
  }

  .event-info {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .event-type {
    color: var(--theme-text);
  }

  .event-time {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
  }

  .event-module {
    font-size: var(--font-size-compact, 12px);
    padding: 0.125rem 0.375rem;
    background: var(--theme-accent-bg);
    border-radius: 0.25rem;
    color: var(--theme-accent);
  }
</style>

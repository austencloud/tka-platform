<!--
  SessionDetailView - Expanded view of a single voice session

  Shows stats summary, event timeline with tier badges and latency,
  "Copy for AI" and "Delete" actions.
-->
<script lang="ts">
  import type { VoiceSession, VoiceSessionEvent, ResolutionTier } from "$lib/shared/voice-control/domain/voice-session-types";
  import type { IVoiceSessionFormatter } from "$lib/features/voice-sessions/services/contracts/IVoiceSessionFormatter";

  let {
    session,
    formatter,
    onClose,
    onDelete,
  }: {
    session: VoiceSession;
    formatter: IVoiceSessionFormatter;
    onClose: () => void;
    onDelete: () => void;
  } = $props();

  let copySuccess = $state(false);

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const secs = Math.floor(ms / 1000);
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  }

  function successRate(): string {
    if (session.stats.totalEvents === 0) return "0%";
    return `${Math.round((session.stats.successCount / session.stats.totalEvents) * 100)}%`;
  }

  async function copyForAI() {
    const markdown = formatter.formatForAnalysis(session);
    try {
      await navigator.clipboard.writeText(markdown);
      copySuccess = true;
      setTimeout(() => { copySuccess = false; }, 2000);
    } catch {
      // Clipboard API may fail in some contexts
    }
  }

  function formatEventOffset(ms: number): string {
    const secs = Math.floor(ms / 1000);
    if (secs < 60) return `+${secs}s`;
    return `+${Math.floor(secs / 60)}m${secs % 60}s`;
  }

  function eventIcon(event: VoiceSessionEvent): string {
    if (event.tier === "unresolved") return "fa-question-circle";
    if (event.dispatchResult?.success === false) return "fa-times-circle";
    return "fa-check-circle";
  }

  function eventColor(event: VoiceSessionEvent): string {
    if (event.tier === "unresolved") return "#f59e0b";
    if (event.dispatchResult?.success === false) return "#ef4444";
    return "#22c55e";
  }

  const tierColors: Record<ResolutionTier, string> = {
    tier1_regex: "#22c55e",
    tier2_llm: "#3b82f6",
    tier3_chat: "#f59e0b",
    unresolved: "#ef4444",
  };

  const tierLabels: Record<ResolutionTier, string> = {
    tier1_regex: "Regex",
    tier2_llm: "LLM",
    tier3_chat: "Chat",
    unresolved: "None",
  };
</script>

<div class="detail-view">
  <div class="detail-header">
    <button class="back-btn" onclick={onClose} aria-label="Back to session list">
      <i class="fas fa-arrow-left" aria-hidden="true"></i>
      Back
    </button>
    <span class="detail-title">
      {session.startedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })} at {session.startedAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
    </span>
  </div>

  <!-- Stats Summary -->
  <div class="stats-grid">
    <div class="stat-cell">
      <span class="stat-value">{session.stats.totalEvents}</span>
      <span class="stat-label">Events</span>
    </div>
    <div class="stat-cell">
      <span class="stat-value" style="color: #22c55e">{successRate()}</span>
      <span class="stat-label">Success</span>
    </div>
    <div class="stat-cell">
      <span class="stat-value">{formatDuration(session.durationMs)}</span>
      <span class="stat-label">Duration</span>
    </div>
    <div class="stat-cell">
      <span class="stat-value">{Math.round(session.stats.avgLatencyMs)}ms</span>
      <span class="stat-label">Avg Latency</span>
    </div>
  </div>

  <!-- Tier Breakdown -->
  <div class="tier-breakdown">
    {#each Object.entries(session.stats.tierBreakdown) as [tier, count]}
      {#if count > 0}
        <div class="tier-row">
          <span class="tier-badge" style="background: {tierColors[tier as ResolutionTier]}">{tierLabels[tier as ResolutionTier]}</span>
          <span class="tier-count">{count}</span>
          {#if session.stats.avgLatencyByTier[tier as ResolutionTier]}
            <span class="tier-latency">{Math.round(session.stats.avgLatencyByTier[tier as ResolutionTier]!)}ms avg</span>
          {/if}
        </div>
      {/if}
    {/each}
  </div>

  <!-- Event Timeline -->
  <div class="timeline-header">
    <h3>Events</h3>
  </div>
  <div class="timeline themed-scrollbar">
    {#each session.events as event}
      <div class="timeline-event">
        <div class="event-header">
          <i class="fas {eventIcon(event)}" style="color: {eventColor(event)}" aria-hidden="true"></i>
          <span class="event-transcript">"{event.transcript}"</span>
          <span class="event-offset">{formatEventOffset(event.offsetMs)}</span>
        </div>
        <div class="event-details">
          <span class="tier-badge small" style="background: {tierColors[event.tier]}">{tierLabels[event.tier]}</span>
          {#if event.interpretedCommand}
            <span class="event-command">{event.interpretedCommand.category}:{event.interpretedCommand.action}</span>
          {/if}
          <span class="event-latency">{event.latencyMs}ms</span>
        </div>
        {#if event.dispatchResult?.message}
          <div class="event-result">{event.dispatchResult.message}</div>
        {/if}
      </div>
    {/each}
    {#if session.events.length === 0}
      <div class="empty-timeline">No events in this session.</div>
    {/if}
  </div>

  <!-- Actions -->
  <div class="detail-actions">
    <button class="action-btn copy" onclick={copyForAI} disabled={copySuccess}>
      <i class="fas {copySuccess ? 'fa-check' : 'fa-copy'}" aria-hidden="true"></i>
      {copySuccess ? "Copied" : "Copy for AI"}
    </button>
    <button class="action-btn delete" onclick={onDelete}>
      <i class="fas fa-trash" aria-hidden="true"></i>
      Delete
    </button>
  </div>
</div>

<style>
  .detail-view {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .detail-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 6px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .back-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: var(--theme-text, white);
  }

  .detail-title {
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    color: var(--theme-text, white);
  }

  /* Stats Grid */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }

  .stat-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 10px 8px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 6px;
  }

  .stat-value {
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--theme-text, white);
    font-family: monospace;
  }

  .stat-label {
    font-size: 10px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  /* Tier Breakdown */
  .tier-breakdown {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .tier-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
  }

  .tier-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 3px;
    color: rgba(0, 0, 0, 0.8);
    min-width: 40px;
    text-align: center;
  }

  .tier-badge.small {
    font-size: 9px;
    padding: 1px 4px;
    min-width: 32px;
  }

  .tier-count {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text, white);
    font-family: monospace;
  }

  .tier-latency {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-family: monospace;
  }

  /* Timeline */
  .timeline-header h3 {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0;
  }

  .timeline {
    max-height: 300px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .timeline-event {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 10px;
    background: rgba(0, 0, 0, 0.15);
    border-radius: 6px;
  }

  .event-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .event-transcript {
    flex: 1;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text, white);
    font-family: monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .event-offset {
    font-size: 10px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    font-family: monospace;
    flex-shrink: 0;
  }

  .event-details {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-left: 22px;
  }

  .event-command {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-family: monospace;
  }

  .event-latency {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-family: monospace;
    margin-left: auto;
  }

  .event-result {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    padding-left: 22px;
  }

  .empty-timeline {
    text-align: center;
    padding: 16px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    font-size: var(--font-size-compact, 12px);
  }

  /* Actions */
  .detail-actions {
    display: flex;
    gap: 8px;
    padding-top: 4px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    min-height: 40px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 8px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .action-btn.copy {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, white);
  }

  .action-btn.copy:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.25);
  }

  .action-btn.copy:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .action-btn.delete {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .action-btn.delete:hover {
    background: rgba(239, 68, 68, 0.2);
  }

  @media (max-width: 600px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .detail-actions {
      flex-direction: column;
    }

    .action-btn {
      justify-content: center;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .back-btn,
    .action-btn {
      transition: none;
    }
  }
</style>

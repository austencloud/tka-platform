<!--
SessionList.svelte

Displays a list of capture sessions stored in IndexedDB.
Allows viewing, continuing, or deleting sessions.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { getMLTrainingStorage } from "../services/MLTrainingStorageManager";
  import type { CaptureSession, DatasetStats } from "../domain/models";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";

  interface Props {
    onSessionSelect?: (session: CaptureSession) => void;
    onStartLabeling?: (session: CaptureSession) => void;
  }

  let { onSessionSelect, onStartLabeling }: Props = $props();

  const storage = getMLTrainingStorage();

  let sessions = $state<CaptureSession[]>([]);
  let sessionStats = $state<Map<string, DatasetStats>>(new Map());
  let isLoading = $state(true);
  let selectedSessionId = $state<string | null>(null);
  let deleteConfirmId = $state<string | null>(null);

  async function loadSessions() {
    isLoading = true;
    try {
      await storage.initialize();
      sessions = await storage.getSessions();

      // Sort by creation date (newest first)
      sessions.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Load stats for each session
      for (const session of sessions) {
        const stats = await storage.getSessionStats(session.id);
        sessionStats.set(session.id, stats);
      }
      sessionStats = new Map(sessionStats); // Trigger reactivity
    } catch (error) {
      console.error("Failed to load sessions:", error);
    } finally {
      isLoading = false;
    }
  }

  async function deleteSession(sessionId: string) {
    try {
      await storage.deleteSession(sessionId);
      sessions = sessions.filter((s) => s.id !== sessionId);
      sessionStats.delete(sessionId);
      sessionStats = new Map(sessionStats);
      deleteConfirmId = null;
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  }

  function selectSession(session: CaptureSession) {
    selectedSessionId = session.id;
    onSessionSelect?.(session);
  }

  function formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getProgressPercent(stats: DatasetStats | undefined): number {
    if (!stats || stats.totalFrames === 0) return 0;
    return Math.round((stats.labeledFrames / stats.totalFrames) * 100);
  }

  onMount(() => {
    loadSessions();
  });
</script>

<div class="session-list">
  <div class="header">
    <h2>Capture Sessions</h2>
    <button
      class="btn-refresh"
      onclick={loadSessions}
      disabled={isLoading}
      aria-label="Refresh sessions"
    >
      <i class="fa fa-refresh {isLoading ? 'fa-spin' : ''}" aria-hidden="true"
      ></i>
    </button>
  </div>

  {#if isLoading}
    <div class="loading" role="status" aria-live="polite" aria-busy="true">
      <ProgressRing percent={-1} size={32} strokeWidth={3} />
      <p>Loading sessions...</p>
    </div>
  {:else if sessions.length === 0}
    <div class="empty-state">
      <i class="fa fa-video-camera" aria-hidden="true"></i>
      <p>No capture sessions yet</p>
      <p class="hint">
        Start a new capture session to begin collecting training data.
      </p>
    </div>
  {:else}
    <div class="sessions">
      {#each sessions as session (session.id)}
        {@const stats = sessionStats.get(session.id)}
        {@const progress = getProgressPercent(stats)}
        <div
          class="session-card"
          class:selected={selectedSessionId === session.id}
          onclick={() => selectSession(session)}
          onkeydown={(e) => e.key === "Enter" && selectSession(session)}
          role="button"
          tabindex="0"
          aria-label="Select session {session.name}"
        >
          <div class="session-header">
            <span class="prop-badge {session.propType}">{session.propType}</span
            >
            <span class="session-date">{formatDate(session.createdAt)}</span>
          </div>

          <h3 class="session-name">{session.name}</h3>

          <div class="session-stats">
            <div class="stat">
              <i class="fa fa-image" aria-hidden="true"></i>
              <span>{session.frameCount} frames</span>
            </div>
            <div class="stat">
              <i class="fa fa-clock-o" aria-hidden="true"></i>
              <span>{session.fps} fps</span>
            </div>
            <div class="stat">
              <i class="fa fa-expand" aria-hidden="true"></i>
              <span>{session.resolution.width}×{session.resolution.height}</span
              >
            </div>
          </div>

          {#if stats}
            <div class="progress-section">
              <div class="progress-bar">
                <div class="progress-fill" style="width: {progress}%"></div>
              </div>
              <span class="progress-text">
                {stats.labeledFrames}/{stats.totalFrames} labeled ({progress}%)
              </span>
            </div>
          {/if}

          <div class="session-actions">
            {#if onStartLabeling}
              <button
                class="btn-label"
                onclick={(e) => {
                  e.stopPropagation();
                  onStartLabeling(session);
                }}
              >
                <i class="fa fa-tag" aria-hidden="true"></i>
                Label
              </button>
            {/if}

            {#if deleteConfirmId === session.id}
              <div class="delete-confirm">
                <span>Delete?</span>
                <button
                  class="btn-confirm-delete"
                  onclick={(e) => {
                    e.stopPropagation();
                    deleteSession(session.id);
                  }}
                >
                  Yes
                </button>
                <button
                  class="btn-cancel-delete"
                  onclick={(e) => {
                    e.stopPropagation();
                    deleteConfirmId = null;
                  }}
                >
                  No
                </button>
              </div>
            {:else}
              <button
                class="btn-delete"
                onclick={(e) => {
                  e.stopPropagation();
                  deleteConfirmId = session.id;
                }}
                aria-label="Delete session"
              >
                <i class="fa fa-trash" aria-hidden="true"></i>
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .session-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    height: 100%;
    overflow: hidden;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header h2 {
    margin: 0;
    font-size: 1.25rem;
  }

  .btn-refresh {
    padding: 0.5rem;
    background: transparent;
    border: 1px solid var(--theme-stroke);
    border-radius: 6px;
    color: inherit;
    cursor: pointer;
    transition: all var(--duration-normal);
  }

  .btn-refresh:hover {
    background: var(--theme-stroke);
  }

  .loading,
  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    opacity: 0.7;
  }

  .empty-state i {
    font-size: 3rem;
    opacity: 0.5;
  }

  .empty-state .hint {
    font-size: 0.85rem;
    opacity: 0.6;
  }

  @media (prefers-reduced-motion: reduce) {
    .btn-refresh .fa-spin {
      animation: none;
    }
  }

  .sessions {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .session-card {
    padding: 1rem;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 10px;
    cursor: pointer;
    transition: all var(--duration-normal);
  }

  .session-card:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
  }

  .session-card.selected {
    border-color: var(--theme-accent, var(--theme-accent));
    background: color-mix(in srgb, var(--theme-accent) 10%, transparent);
  }

  .session-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .prop-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .prop-badge.club {
    background: var(--semantic-error, var(--semantic-error));
  }

  .prop-badge.staff {
    background: var(--semantic-info, var(--semantic-info));
  }

  .prop-badge.fan {
    background: var(--semantic-success, var(--semantic-success));
  }

  .prop-badge.hoop {
    background: var(--semantic-warning, var(--semantic-warning));
  }

  .prop-badge.buugeng {
    background: var(--theme-accent-strong, var(--theme-accent-strong));
  }

  .session-date {
    font-size: 0.8rem;
    opacity: 0.6;
  }

  .session-name {
    margin: 0 0 0.75rem;
    font-size: 1rem;
  }

  .session-stats {
    display: flex;
    gap: 1rem;
    font-size: 0.85rem;
    opacity: 0.7;
    margin-bottom: 0.75rem;
  }

  .stat {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .progress-section {
    margin-bottom: 0.75rem;
  }

  .progress-bar {
    height: 6px;
    background: var(--theme-stroke);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 0.35rem;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(
      90deg,
      var(--semantic-success, var(--semantic-success)),
      color-mix(
        in srgb,
        var(--semantic-success, var(--semantic-success)) 80%,
        white
      )
    );
    border-radius: 3px;
    transition: width var(--duration-emphasis) ease;
  }

  .progress-text {
    font-size: 0.75rem;
    opacity: 0.6;
  }

  .session-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .session-actions button {
    padding: 0.4rem 0.75rem;
    border: none;
    border-radius: 6px;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all var(--duration-normal);
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .btn-label {
    background: var(--semantic-info, var(--semantic-info));
    color: white;
  }

  .btn-label:hover {
    background: var(--theme-accent);
  }

  .btn-delete {
    background: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 20%,
      transparent
    );
    color: var(--semantic-error, var(--semantic-error));
  }

  .btn-delete:hover {
    background: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 30%,
      transparent
    );
  }

  .delete-confirm {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
  }

  .btn-confirm-delete {
    background: var(--semantic-error, var(--semantic-error));
    color: white;
  }

  .btn-cancel-delete {
    background: var(--theme-stroke);
    color: inherit;
  }
</style>

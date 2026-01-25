<script lang="ts">
  /**
   * ActivityWidget - Dashboard Activity Summary
   * Shows meaningful creative stats for flow artists
   */

  import { onMount } from "svelte";
  import { container } from "$lib/shared/di";
  import type { ISessionTracker } from "$lib/shared/analytics/services/contracts/ISessionTracker";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { libraryState } from "$lib/features/library/state/library-state.svelte";
  import { showSettingsDialog } from "$lib/shared/application/state/ui/ui-state.svelte";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";

  // State
  let sessionDuration = $state(0);

  // Services
  let sessionService: ISessionTracker | null = null;

  // Use library's loading state directly
  const isLoading = $derived(libraryState.isLoading);

  // Derived from library state - these are meaningful to users!
  const totalSequences = $derived(libraryState.sequences.length);

  // Get recently created sequences (last 7 days)
  const recentSequences = $derived.by(() => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return libraryState.sequences.filter((s) => {
      const createdAt =
        s.createdAt instanceof Date ? s.createdAt : new Date(s.createdAt);
      return createdAt > weekAgo;
    });
  });

  // "On This Day" style revisit - find sequences from 1 week, 1 month, or 1 year ago
  const revisitSequence = $derived.by(() => {
    if (libraryState.sequences.length === 0) return null;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Check for sequences created around these anniversaries (with tolerance)
    const timeframes = [
      { label: "1 year ago", days: 365, tolerance: 3 },
      { label: "1 month ago", days: 30, tolerance: 2 },
      { label: "1 week ago", days: 7, tolerance: 1 },
    ];

    for (const { label, days, tolerance } of timeframes) {
      const targetDate = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
      const minDate = new Date(
        targetDate.getTime() - tolerance * 24 * 60 * 60 * 1000
      );
      const maxDate = new Date(
        targetDate.getTime() + tolerance * 24 * 60 * 60 * 1000
      );

      const match = libraryState.sequences.find((s) => {
        const createdAt =
          s.createdAt instanceof Date ? s.createdAt : new Date(s.createdAt);
        return createdAt >= minDate && createdAt <= maxDate;
      });

      if (match) {
        return { sequence: match, label };
      }
    }

    return null;
  });

  // Most recent sequence for "continue" feature
  const mostRecentSequence = $derived.by(() => {
    if (libraryState.sequences.length === 0) return null;
    return [...libraryState.sequences].sort((a, b) => {
      const aDate =
        a.updatedAt instanceof Date ? a.updatedAt : new Date(a.updatedAt);
      const bDate =
        b.updatedAt instanceof Date ? b.updatedAt : new Date(b.updatedAt);
      return bDate.getTime() - aDate.getTime();
    })[0];
  });

  onMount(() => {
    sessionService = container.items.sessionTracker;

    // Ensure library sequences are loaded
    if (
      authState.isAuthenticated &&
      libraryState.sequences.length === 0 &&
      !libraryState.isLoading
    ) {
      libraryState.loadSequences();
    }

    // Update session duration every second
    const interval = setInterval(() => {
      if (sessionService) {
        sessionDuration = sessionService.getSessionDuration();
      }
    }, 1000);

    return () => clearInterval(interval);
  });

  function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m`;
    }
    return `${seconds}s`;
  }

  function viewFullActivity() {
    showSettingsDialog();
  }

  async function continueSequence() {
    if (mostRecentSequence) {
      // Navigate to browse/gallery where they can open their sequence
      await handleModuleChange("browse", "gallery");
    }
  }

  async function revisitOldSequence() {
    if (revisitSequence) {
      // Navigate to browse/gallery where they can find the sequence
      await handleModuleChange("browse", "gallery");
    }
  }

  async function createNew() {
    await handleModuleChange("create", "constructor");
  }

  // Get thumbnail URL from sequence with fallback
  function getThumbnailUrl(sequence: typeof mostRecentSequence): string | null {
    if (!sequence) return null;
    // Check thumbnails array first (SequenceData standard)
    if (sequence.thumbnails && sequence.thumbnails.length > 0) {
      return sequence.thumbnails[0] ?? null;
    }
    // Fall back to thumbnailUrl field (backward compatibility)
    return (sequence as any).thumbnailUrl ?? null;
  }
</script>

<div class="activity-widget">
  <div class="widget-header">
    <div class="header-icon">
      <i class="fas fa-layer-group" aria-hidden="true"></i>
    </div>
    <h3>Your Creations</h3>
  </div>

  <div class="widget-content">
    {#if isLoading}
      <div class="loading-state">
        <div class="skeleton"></div>
      </div>
    {:else if !authState.isAuthenticated}
      <div class="empty-state">
        <i class="fas fa-user-circle" aria-hidden="true"></i>
        <p>Sign in to track your creations</p>
      </div>
    {:else if totalSequences === 0}
      <div class="empty-state">
        <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>
        <p>No sequences yet</p>
        <span class="empty-hint">Create your first sequence!</span>
      </div>
    {:else}
      <div class="activity-stats">
        <!-- Library Stats -->
        <div class="stat-row">
          <div class="stat-item library">
            <div class="stat-value">{totalSequences}</div>
            <div class="stat-label">
              {totalSequences === 1 ? "sequence" : "sequences"}
            </div>
          </div>
          {#if recentSequences.length > 0}
            <div class="stat-item recent">
              <div class="stat-value">{recentSequences.length}</div>
              <div class="stat-label">this week</div>
            </div>
          {/if}
        </div>

        <!-- Sequence Cards Row -->
        <div class="sequence-cards">
          <!-- Most Recent / Continue -->
          {#if mostRecentSequence}
            {@const thumbnailUrl = getThumbnailUrl(mostRecentSequence)}
            <button class="sequence-card" onclick={continueSequence}>
              <div class="card-thumbnail">
                {#if thumbnailUrl}
                  <img src={thumbnailUrl} alt="Continue sequence" />
                {:else}
                  <div class="thumbnail-placeholder">
                    <i class="fas fa-layer-group" aria-hidden="true"></i>
                  </div>
                {/if}
              </div>
              <div class="card-label">
                <i class="fas fa-play" aria-hidden="true"></i>
                <span>Continue</span>
              </div>
            </button>
          {/if}

          <!-- "On This Day" Revisit -->
          {#if revisitSequence}
            {@const revisitThumbnailUrl = getThumbnailUrl(
              revisitSequence.sequence
            )}
            <button class="sequence-card revisit" onclick={revisitOldSequence}>
              <div class="card-thumbnail">
                {#if revisitThumbnailUrl}
                  <img src={revisitThumbnailUrl} alt="Revisit sequence" />
                {:else}
                  <div class="thumbnail-placeholder revisit">
                    <i class="fas fa-clock-rotate-left" aria-hidden="true"></i>
                  </div>
                {/if}
              </div>
              <div class="card-label revisit">
                <i class="fas fa-clock-rotate-left" aria-hidden="true"></i>
                <span>{revisitSequence.label}</span>
              </div>
            </button>
          {/if}
        </div>

        <!-- Current Session (subtle) -->
        {#if sessionDuration > 60000}
          <div class="session-note">
            <span class="live-dot"></span>
            <span>Session: {formatDuration(sessionDuration)}</span>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  {#if authState.isAuthenticated && totalSequences === 0}
    <button class="view-all-btn create" onclick={createNew}>
      <span>Create Your First</span>
      <i class="fas fa-plus" aria-hidden="true"></i>
    </button>
  {:else}
    <button class="view-all-btn" onclick={viewFullActivity}>
      <span>View Activity Log</span>
      <i class="fas fa-arrow-right" aria-hidden="true"></i>
    </button>
  {/if}
</div>

<style>
  .activity-widget {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 24px;
    background: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 10%,
      transparent
    );
    border: 1px solid
      color-mix(
        in srgb,
        var(--theme-accent, var(--theme-accent)) 22%,
        transparent
      );
    border-radius: 24px;
  }

  .widget-header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 20px;
  }

  .header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    background: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 15%,
      transparent
    );
    border-radius: 14px;
    color: var(--theme-accent, var(--theme-accent));
    font-size: var(--font-size-lg);
  }

  .widget-header h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--theme-text);
  }

  .widget-content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 80px;
  }

  .loading-state {
    width: 100%;
  }

  .skeleton {
    width: 100%;
    height: 80px;
    background: linear-gradient(
      90deg,
      color-mix(
          in srgb,
          var(--theme-accent, var(--theme-accent)) 8%,
          transparent
        )
        25%,
      color-mix(
          in srgb,
          var(--theme-accent, var(--theme-accent)) 15%,
          transparent
        )
        50%,
      color-mix(
          in srgb,
          var(--theme-accent, var(--theme-accent)) 8%,
          transparent
        )
        75%
    );
    background-size: 200% 100%;
    animation: shimmer 2s infinite ease-in-out;
    border-radius: 14px;
  }

  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-align: center;
    padding: 20px;
  }

  .empty-state i {
    font-size: var(--font-size-3xl);
    color: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 40%,
      transparent
    );
  }

  .empty-state p {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--theme-text, var(--theme-text));
  }

  .empty-hint {
    font-size: 0.8125rem;
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  /* Activity Stats */
  .activity-stats {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .stat-row {
    display: flex;
    gap: 8px;
    justify-content: center;
  }

  .stat-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 12px 8px;
    background: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 8%,
      transparent
    );
    border-radius: 12px;
    max-width: 100px;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--theme-accent, var(--theme-accent));
    line-height: 1;
  }

  .stat-label {
    font-size: 0.6875rem;
    color: var(--theme-text-dim, var(--theme-text-dim));
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .stat-item.recent .stat-value {
    color: var(--semantic-success, var(--semantic-success));
  }

  /* Sequence Cards - Thumbnail-first design */
  .sequence-cards {
    display: flex;
    gap: 16px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .sequence-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 10px;
    background: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 8%,
      transparent
    );
    border: 1px solid
      color-mix(
        in srgb,
        var(--theme-accent, var(--theme-accent)) 15%,
        transparent
      );
    border-radius: 16px;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    flex: 1;
    min-width: 140px;
    max-width: 220px;
  }

  .sequence-card:hover {
    background: color-mix(in srgb, var(--theme-accent) 14%, transparent);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .sequence-card.revisit {
    background: color-mix(
      in srgb,
      var(--semantic-warning, var(--semantic-warning)) 8%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--semantic-warning, var(--semantic-warning)) 15%,
      transparent
    );
  }

  .sequence-card.revisit:hover {
    background: color-mix(
      in srgb,
      var(--semantic-warning, var(--semantic-warning)) 14%,
      transparent
    );
  }

  .card-thumbnail {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 12px;
    overflow: hidden;
    background: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 10%,
      transparent
    );
  }

  .card-thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .thumbnail-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 15%,
      transparent
    );
    color: var(--theme-accent, var(--theme-accent));
    font-size: var(--font-size-3xl);
  }

  .thumbnail-placeholder.revisit {
    background: color-mix(
      in srgb,
      var(--semantic-warning, var(--semantic-warning)) 15%,
      transparent
    );
    color: var(--semantic-warning, var(--semantic-warning));
  }

  .card-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--theme-accent, var(--theme-accent));
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .card-label.revisit {
    color: var(--semantic-warning, var(--semantic-warning));
  }

  .card-label i {
    font-size: var(--font-size-compact);
  }

  /* Session Note */
  .session-note {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 0.75rem;
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .live-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--semantic-success, var(--semantic-success));
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .view-all-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: var(--min-touch-target);
    padding: 14px 20px;
    background: linear-gradient(
      135deg,
      var(--theme-accent, var(--theme-accent)) 0%,
      color-mix(in srgb, var(--theme-accent, var(--theme-accent)) 80%, black)
        100%
    );
    border: none;
    border-radius: 14px;
    color: white;
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    margin-top: auto;
  }

  .view-all-btn.create {
    background: linear-gradient(
      135deg,
      var(--semantic-success, var(--semantic-success)) 0%,
      color-mix(
          in srgb,
          var(--semantic-success, var(--semantic-success)) 80%,
          black
        )
        100%
    );
  }

  .view-all-btn:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }

  .view-all-btn i {
    font-size: var(--font-size-sm);
  }

  @media (max-width: 768px) {
    .activity-widget {
      padding: 20px;
      border-radius: 20px;
    }

    .header-icon {
      width: 40px;
      height: 40px;
      font-size: var(--font-size-base);
    }

    .widget-header h3 {
      font-size: 1rem;
    }

    .stat-value {
      font-size: 1.25rem;
    }

    .sequence-card {
      min-width: 120px;
      max-width: 180px;
    }

    .view-all-btn {
      min-height: 44px;
      padding: 12px 16px;
      font-size: 0.875rem;
    }
  }

  @media (max-width: 480px) {
    .sequence-cards {
      gap: 12px;
    }

    .sequence-card {
      padding: 8px;
      min-width: 100px;
      max-width: 160px;
    }

    .card-label {
      font-size: 0.6875rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton {
      animation: none;
      background: rgba(99, 102, 241, 0.1);
    }

    .live-dot {
      animation: none;
    }

    .view-all-btn,
    .sequence-card {
      transition: none;
    }

    .view-all-btn:hover,
    .sequence-card:hover {
      transform: none;
    }
  }
</style>

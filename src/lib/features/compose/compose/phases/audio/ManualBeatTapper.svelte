<!--
  ManualBeatTapper.svelte

  Manual beat tapping interface for recordings with imperfect timing.
  Allows users to tap along with audio/video to mark beat positions.

  Features:
  - Tap button to mark steps at current time
  - Keyboard shortcut (B key) for tapping
  - Calculates average BPM from taps
  - Shows tap history with timestamps
  - Clear all to start over
-->
<script lang="ts">
  import type { BeatMarker } from "../../state/composition-state.svelte";

  let {
    currentTime = 0,
    duration = 0,
    isPlaying = false,
    beatMarkers = [],
    onAddMarker,
    onRemoveMarker,
    onClearAll,
  }: {
    currentTime?: number;
    duration?: number;
    isPlaying?: boolean;
    beatMarkers?: BeatMarker[];
    onAddMarker?: (marker: BeatMarker) => void;
    onRemoveMarker?: (id: string) => void;
    onClearAll?: () => void;
  } = $props();

  let isTapMode = $state(false);
  let lastTapTime = $state<number | null>(null);
  let tapFeedback = $state(false);

  // Calculate average BPM from beat markers
  const averageBpm = $derived(() => {
    if (beatMarkers.length < 2) return null;

    // Sort markers by time
    const sorted = [...beatMarkers].sort((a, b) => a.time - b.time);

    // Calculate intervals between consecutive steps
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const interval = (sorted[i]?.time ?? 0) - (sorted[i - 1]?.time ?? 0);
      if (interval > 0 && interval < 5) {
        // Ignore intervals > 5 seconds (likely mistakes)
        intervals.push(interval);
      }
    }

    if (intervals.length === 0) return null;

    // Average interval in seconds
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    // Convert to BPM
    return Math.round(60 / avgInterval);
  });

  // Handle tap
  function handleTap() {
    if (duration <= 0) return;

    const marker: BeatMarker = {
      id: `tap-${Date.now()}`,
      beat: beatMarkers.length + 1,
      time: currentTime,
    };

    onAddMarker?.(marker);
    lastTapTime = currentTime;

    // Visual feedback
    tapFeedback = true;
    setTimeout(() => (tapFeedback = false), 100);
  }

  // Keyboard handler
  function handleKeydown(e: KeyboardEvent) {
    if (!isTapMode) return;

    if (e.key === "b" || e.key === "B" || e.key === " ") {
      e.preventDefault();
      handleTap();
    }
  }

  // Format time for display
  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  }

  // Remove last tap
  function removeLast() {
    if (beatMarkers.length === 0) return;
    const sorted = [...beatMarkers].sort((a, b) => b.time - a.time);
    const lastMarker = sorted[0];
    if (lastMarker) {
      onRemoveMarker?.(lastMarker.id);
    }
  }

  // Clear all taps
  function clearAllTaps() {
    onClearAll?.();
    lastTapTime = null;
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="manual-beat-tapper" class:active={isTapMode}>
  <div class="tapper-header">
    <div class="header-left">
      <i class="fas fa-hand-pointer" aria-hidden="true"></i>
      <span class="title">Manual Beat Tapping</span>
    </div>
    <label class="tap-mode-toggle">
      <input
        type="checkbox"
        bind:checked={isTapMode}
        aria-label="Enable manual beat tap mode"
      />
      <span class="toggle-track"></span>
      <span class="toggle-label">{isTapMode ? "Active" : "Inactive"}</span>
    </label>
  </div>

  {#if isTapMode}
    <div class="tapper-content">
      <!-- Tap button area -->
      <div class="tap-area">
        <button
          class="tap-button"
          class:feedback={tapFeedback}
          onclick={handleTap}
          disabled={duration <= 0}
        >
          <i class="fas fa-drum" aria-hidden="true"></i>
          <span>TAP</span>
        </button>
        <div class="tap-hint">
          Press <kbd>B</kbd> or <kbd>Space</kbd> to tap
        </div>
      </div>

      <!-- Stats -->
      <div class="tap-stats">
        <div class="stat">
          <span class="stat-label">Taps</span>
          <span class="stat-value">{beatMarkers.length}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Avg BPM</span>
          <span class="stat-value">{averageBpm() ?? "—"}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Last Tap</span>
          <span class="stat-value">
            {lastTapTime !== null ? formatTime(lastTapTime) : "—"}
          </span>
        </div>
      </div>

      <!-- Recent taps list -->
      {#if beatMarkers.length > 0}
        <div class="recent-taps">
          <div class="recent-header">
            <span>Recent Taps</span>
            <div class="recent-actions">
              <button
                class="action-btn"
                onclick={removeLast}
                title="Remove last tap"
                aria-label="Remove last tap"
              >
                <i class="fas fa-undo" aria-hidden="true"></i>
              </button>
              <button
                class="action-btn danger"
                onclick={clearAllTaps}
                title="Clear all taps"
                aria-label="Clear all taps"
              >
                <i class="fas fa-trash" aria-hidden="true"></i>
              </button>
            </div>
          </div>
          <div class="tap-list">
            {#each [...beatMarkers]
              .sort((a, b) => b.time - a.time)
              .slice(0, 5) as marker}
              <div class="tap-item">
                <span class="tap-beat">Beat {marker.beat}</span>
                <span class="tap-time">{formatTime(marker.time)}</span>
                <button
                  class="tap-remove"
                  onclick={() => onRemoveMarker?.(marker.id)}
                  title="Remove this tap"
                  aria-label="Remove this tap"
                >
                  <i class="fas fa-times" aria-hidden="true"></i>
                </button>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Instructions -->
      <div class="instructions">
        <p>
          <i class="fas fa-info-circle" aria-hidden="true"></i>
          Play the audio and tap along with the beats. The average BPM will be calculated
          from your taps.
        </p>
      </div>
    </div>
  {:else}
    <div class="inactive-message">
      <p>Enable tap mode to manually mark steps while listening.</p>
      <p class="hint">Useful for recordings with variable or unclear timing.</p>
    </div>
  {/if}
</div>

<style>
  .manual-beat-tapper {
    display: flex;
    flex-direction: column;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    overflow: hidden;
    transition: border-color var(--duration-normal) ease;
  }

  .manual-beat-tapper.active {
    border-color: rgba(251, 191, 36, 0.4);
  }

  .tapper-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    background: rgba(0, 0, 0, 0.3);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: rgba(255, 255, 255, 0.8);
  }

  .header-left i {
    color: rgba(251, 191, 36, 0.7);
  }

  .title {
    font-size: 0.85rem;
    font-weight: 500;
  }

  /* Toggle */
  .tap-mode-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .tap-mode-toggle input {
    display: none;
  }

  .toggle-track {
    width: 36px;
    height: 20px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    position: relative;
    transition: background var(--duration-normal) ease;
  }

  .toggle-track::after {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    background: white;
    border-radius: 50%;
    transition: transform var(--duration-normal) ease;
  }

  .tap-mode-toggle input:checked + .toggle-track {
    background: rgba(251, 191, 36, 0.6);
  }

  .tap-mode-toggle input:checked + .toggle-track::after {
    transform: translateX(16px);
  }

  .toggle-label {
    font-size: 0.75rem;
    color: var(--theme-text-dim);
  }

  /* Tapper content */
  .tapper-content {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem;
  }

  /* Tap area */
  .tap-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    background: rgba(251, 191, 36, 0.08);
    border-radius: 8px;
    border: 1px solid rgba(251, 191, 36, 0.15);
  }

  .tap-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
    background: linear-gradient(
      135deg,
      rgba(251, 191, 36, 0.5) 0%,
      rgba(245, 158, 11, 0.5) 100%
    );
    border: 2px solid rgba(251, 191, 36, 0.6);
    border-radius: 50%;
    color: white;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .tap-button i {
    font-size: 1.5rem;
    margin-bottom: 0.25rem;
  }

  .tap-button:hover:not(:disabled) {
    transform: scale(1.05);
    border-color: rgba(251, 191, 36, 0.8);
  }

  .tap-button:active:not(:disabled),
  .tap-button.feedback {
    transform: scale(0.95);
    background: linear-gradient(
      135deg,
      rgba(251, 191, 36, 0.5) 0%,
      rgba(245, 158, 11, 0.5) 100%
    );
  }

  .tap-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .tap-hint {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: var(--font-size-compact);
    color: rgba(255, 255, 255, 0.75);
  }

  .tap-hint kbd {
    padding: 0.15rem 0.35rem;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    font-family: monospace;
    font-size: 0.65rem;
  }

  /* Stats */
  .tap-stats {
    display: flex;
    gap: 1rem;
    justify-content: center;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.5rem 1rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 6px;
  }

  .stat-label {
    font-size: var(--font-size-compact);
    color: rgba(255, 255, 255, 0.75);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .stat-value {
    font-size: 1rem;
    font-weight: 600;
    color: var(--theme-text);
    font-family: monospace;
  }

  /* Recent taps */
  .recent-taps {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .recent-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: var(--font-size-compact);
    color: rgba(255, 255, 255, 0.75);
  }

  .recent-actions {
    display: flex;
    gap: 0.35rem;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 4px;
    color: var(--theme-text-dim);
    font-size: 0.7rem;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .action-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--theme-text);
  }

  .action-btn.danger:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.3);
    color: rgba(248, 113, 113, 0.9);
  }

  .tap-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    max-height: 120px;
    overflow-y: auto;
  }

  .tap-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.5rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
    font-size: 0.75rem;
  }

  .tap-beat {
    color: white;
    font-weight: 500;
    min-width: 50px;
  }

  .tap-time {
    color: rgba(255, 255, 255, 0.75);
    font-family: monospace;
    flex: 1;
  }

  .tap-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    background: transparent;
    border: none;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    cursor: pointer;
    opacity: 0;
    transition: all var(--duration-normal) ease;
  }

  .tap-item:hover .tap-remove {
    opacity: 1;
  }

  .tap-remove:hover {
    color: rgba(248, 113, 113, 0.9);
  }

  /* Instructions */
  .instructions {
    padding: 0.5rem;
    background: rgba(139, 92, 246, 0.1);
    border-radius: 6px;
  }

  .instructions p {
    margin: 0;
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    font-size: var(--font-size-compact);
    color: rgba(255, 255, 255, 0.75);
  }

  .instructions i {
    color: rgba(139, 92, 246, 0.7);
    margin-top: 0.1rem;
  }

  /* Inactive message */
  .inactive-message {
    padding: 1rem 0.75rem;
    text-align: center;
  }

  .inactive-message p {
    margin: 0;
    font-size: var(--font-size-min);
    color: rgba(255, 255, 255, 0.75);
  }

  .inactive-message .hint {
    margin-top: 0.25rem;
    font-size: var(--font-size-compact);
    color: rgba(255, 255, 255, 0.75);
  }
</style>

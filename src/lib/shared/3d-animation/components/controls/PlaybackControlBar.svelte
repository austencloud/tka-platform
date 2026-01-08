<script lang="ts">
  /**
   * PlaybackControlBar - Playback controls for animation
   *
   * Handles: beat navigation, play/pause, progress, loop toggle.
   * Designed for reuse across 3D animation contexts.
   */

  interface Props {
    /** Current playback state */
    isPlaying: boolean;
    /** Progress 0-1 */
    progress: number;
    /** Whether loop is enabled */
    loop: boolean;
    /** Current beat index (for sequence mode) */
    currentBeatIndex?: number;
    /** Total beats (for sequence mode) */
    totalBeats?: number;
    /** Whether in sequence mode */
    hasSequence?: boolean;

    // Callbacks
    onPlay: () => void;
    onPause: () => void;
    onTogglePlay: () => void;
    onReset: () => void;
    onProgressChange: (value: number) => void;
    onLoopChange: (value: boolean) => void;
    onPrevBeat?: () => void;
    onNextBeat?: () => void;
  }

  let {
    isPlaying,
    progress,
    loop,
    currentBeatIndex = 0,
    totalBeats = 0,
    hasSequence = false,
    onPlay,
    onPause,
    onTogglePlay,
    onReset,
    onProgressChange,
    onLoopChange,
    onPrevBeat,
    onNextBeat,
  }: Props = $props();

  const progressPercent = $derived(Math.round(progress * 100));
  const canGoPrev = $derived(currentBeatIndex > 0);
  const canGoNext = $derived(currentBeatIndex < totalBeats - 1);
</script>

<div class="playback-controls">
  <!-- Beat navigation (sequence mode only) -->
  {#if hasSequence && totalBeats > 0}
    <button
      class="play-btn"
      onclick={() => onPrevBeat?.()}
      disabled={!canGoPrev}
      aria-label="Previous beat"
    >
      <i class="fas fa-step-backward" aria-hidden="true"></i>
    </button>

    <span class="beat-indicator">
      {currentBeatIndex + 1} / {totalBeats}
    </span>

    <button
      class="play-btn"
      onclick={() => onNextBeat?.()}
      disabled={!canGoNext}
      aria-label="Next beat"
    >
      <i class="fas fa-step-forward" aria-hidden="true"></i>
    </button>

    <div class="divider"></div>
  {/if}

  <button class="play-btn" onclick={onReset} aria-label="Reset">
    <i class="fas fa-undo" aria-hidden="true"></i>
  </button>

  <button
    class="play-btn primary"
    onclick={onTogglePlay}
    aria-label={isPlaying ? "Pause" : "Play"}
  >
    <i
      class="fas"
      class:fa-pause={isPlaying}
      class:fa-play={!isPlaying}
      aria-hidden="true"
    ></i>
  </button>

  <input
    type="range"
    min="0"
    max="1"
    step="0.01"
    value={progress}
    oninput={(e) => onProgressChange(parseFloat(e.currentTarget.value))}
    class="progress-slider"
    aria-label="Progress"
  />

  <span class="progress-label">{progressPercent}%</span>

  <button
    class="play-btn"
    class:active={loop}
    onclick={() => onLoopChange(!loop)}
    aria-label={loop ? "Disable loop" : "Enable loop"}
  >
    <i class="fas fa-sync" aria-hidden="true"></i>
  </button>
</div>

<style>
  .playback-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 16px;
    padding: 0.5rem;
  }

  .beat-indicator {
    min-width: 4rem;
    text-align: center;
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--theme-accent, var(--theme-accent-strong));
  }

  .divider {
    width: 1px;
    height: 32px;
    background: var(--theme-stroke);
    margin: 0 0.25rem;
  }

  .play-btn {
    width: 48px;
    height: 48px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: none;
    border-radius: 12px;
    color: var(--theme-text);
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .play-btn:hover:not(:disabled) {
    background: var(--theme-card-hover-bg);
    color: white;
  }

  .play-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .play-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .play-btn.primary {
    width: 56px;
    height: 56px;
    background: var(--theme-accent, var(--theme-accent-strong));
    color: white;
    border-radius: 50%;
  }

  .play-btn.primary:hover {
    background: var(--theme-accent-strong, #7c3aed);
  }

  .play-btn.active {
    background: rgba(139, 92, 246, 0.4);
    color: #a78bfa;
  }

  .progress-slider {
    flex: 1;
    min-width: 80px;
    max-width: 200px;
    height: 48px;
    accent-color: var(--theme-accent, var(--theme-accent-strong));
  }

  .progress-slider:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .progress-label {
    min-width: 3rem;
    font-size: var(--font-size-sm, 0.875rem);
    font-variant-numeric: tabular-nums;
    color: var(--theme-text-dim, var(--theme-text-dim));
    text-align: center;
  }

  @media (max-width: 600px) {
    .playback-controls {
      padding: 0.35rem;
      gap: 0.35rem;
      flex-wrap: wrap;
      justify-content: center;
    }

    /* Touch targets remain 48px for WCAG AAA */
    .play-btn.primary {
      width: 52px;
      height: 52px;
    }

    .progress-label {
      display: none;
    }
  }
</style>

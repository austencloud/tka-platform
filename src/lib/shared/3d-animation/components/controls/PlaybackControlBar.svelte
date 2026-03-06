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
    currentStepIndex?: number;
    /** Total steps (for sequence mode) */
    totalSteps?: number;
    /** Whether in sequence mode */
    hasSequence?: boolean;

    // Callbacks
    onPlay: () => void;
    onPause: () => void;
    onTogglePlay: () => void;
    onReset: () => void;
    onProgressChange: (value: number) => void;
    onLoopChange: (value: boolean) => void;
    onPrevStep?: () => void;
    onNextStep?: () => void;
  }

  let {
    isPlaying,
    progress,
    loop,
    currentStepIndex = 0,
    totalSteps = 0,
    hasSequence = false,
    onPlay,
    onPause,
    onTogglePlay,
    onReset,
    onProgressChange,
    onLoopChange,
    onPrevStep,
    onNextStep,
  }: Props = $props();

  const progressPercent = $derived(Math.round(progress * 100));
  const canGoPrev = $derived(currentStepIndex > 0);
  const canGoNext = $derived(currentStepIndex < totalSteps - 1);
</script>

<div class="playback-controls">
  <!-- Beat navigation (sequence mode only) -->
  {#if hasSequence && totalSteps > 0}
    <button
      class="play-btn"
      onclick={() => onPrevStep?.()}
      disabled={!canGoPrev}
      aria-label="Previous beat"
    >
      <i class="fas fa-step-backward" aria-hidden="true"></i>
    </button>

    <span class="beat-indicator">
      {currentStepIndex + 1} / {totalSteps}
    </span>

    <button
      class="play-btn"
      onclick={() => onNextStep?.()}
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
    width: var(--min-touch-target);
    height: var(--min-touch-target);
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
    transition: all var(--duration-fast);
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
    background: color-mix(in srgb, var(--theme-accent) 40%, transparent);
    color: var(--theme-accent);
  }

  .progress-slider {
    flex: 1;
    min-width: 80px;
    max-width: 200px;
    height: var(--min-touch-target);
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

    /* Touch targets use var(--min-touch-target) for WCAG AA */
    .play-btn.primary {
      width: 52px;
      height: 52px;
    }

    .progress-label {
      display: none;
    }
  }
</style>

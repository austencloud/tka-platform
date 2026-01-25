<!--
  PlaybackBar.svelte

  Simple horizontal playback controls:
  - Play/Pause button
  - Stop button
  - Beat counter (current/total)
-->
<script lang="ts">
  let {
    isPlaying,
    currentBeat,
    totalBeats,
    onPlayPause,
    onStop,
  }: {
    isPlaying: boolean;
    currentBeat: number;
    totalBeats: number;
    onPlayPause: () => void;
    onStop: () => void;
  } = $props();

  const canStop = $derived(isPlaying || currentBeat > 0);
</script>

<div class="playback-bar">
  <div class="controls">
    <button
      class="control-btn play-btn"
      class:playing={isPlaying}
      onclick={onPlayPause}
      aria-label={isPlaying ? "Pause" : "Play"}
    >
      <i class="fas {isPlaying ? 'fa-pause' : 'fa-play'}" aria-hidden="true"></i>
    </button>

    <button
      class="control-btn stop-btn"
      onclick={onStop}
      disabled={!canStop}
      aria-label="Stop"
    >
      <i class="fas fa-stop" aria-hidden="true"></i>
    </button>
  </div>

  <div class="beat-display">
    <span class="current">{currentBeat + 1}</span>
    <span class="separator">/</span>
    <span class="total">{totalBeats}</span>
    <span class="label">beats</span>
  </div>
</div>

<style>
  .playback-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md);
    margin-top: auto;
  }

  .controls {
    display: flex;
    gap: var(--spacing-sm);
  }

  .control-btn {
    width: var(--min-touch-target, 48px);
    height: var(--min-touch-target, 48px);
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: var(--border-radius-md);
    color: white;
    font-size: 1rem;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .control-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .control-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .control-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  /* Play button styling */
  .play-btn {
    background: rgba(16, 185, 129, 0.2);
    border-color: rgba(16, 185, 129, 0.4);
  }

  .play-btn:hover:not(:disabled) {
    background: rgba(16, 185, 129, 0.4);
    border-color: rgba(16, 185, 129, 0.6);
  }

  .play-btn.playing {
    background: rgba(245, 158, 11, 0.2);
    border-color: rgba(245, 158, 11, 0.4);
  }

  .play-btn.playing:hover:not(:disabled) {
    background: rgba(245, 158, 11, 0.4);
    border-color: rgba(245, 158, 11, 0.6);
  }

  /* Beat display */
  .beat-display {
    display: flex;
    align-items: baseline;
    gap: 2px;
    font-family: var(--font-mono, monospace);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
  }

  .current {
    color: var(--theme-text, white);
    font-weight: 600;
    font-size: 1.25rem;
  }

  .separator {
    opacity: 0.5;
    margin: 0 2px;
  }

  .total {
    font-weight: 500;
  }

  .label {
    margin-left: var(--spacing-xs);
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .control-btn {
      transition: none;
    }
  }
</style>

<!--
  PlaybackControls.svelte

  Bottom control bar with play/pause, stop, speed, and loop controls.
-->
<script lang="ts">
  import type {
    PlaybackMode,
    StepPlaybackStepSize,
  } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";

  let {
    isPlaying,
    speed,
    shouldLoop,
    playbackMode,
    stepPlaybackStepSize,
    stepPlaybackPauseMs,
    onPlay,
    onPause,
    onStop,
    onSpeedChange,
    onLoopToggle,
    onPlaybackModeChange,
    onStepPlaybackStepSizeChange,
    onStepPlaybackPauseMsChange,
  }: {
    isPlaying: boolean;
    speed: number;
    shouldLoop: boolean;
    playbackMode: PlaybackMode;
    stepPlaybackStepSize: StepPlaybackStepSize;
    stepPlaybackPauseMs: number;
    onPlay: () => void;
    onPause: () => void;
    onStop: () => void;
    onSpeedChange: (speed: number) => void;
    onLoopToggle: (loop: boolean) => void;
    onPlaybackModeChange: (mode: PlaybackMode) => void;
    onStepPlaybackStepSizeChange: (stepSize: StepPlaybackStepSize) => void;
    onStepPlaybackPauseMsChange: (pauseMs: number) => void;
  } = $props();

  // Speed presets
  const speedPresets = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0];

  function handlePlayPause() {
    if (isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  }

  function handleSpeedClick(preset: number) {
    onSpeedChange(preset);
  }

  function handleLoopClick() {
    onLoopToggle(!shouldLoop);
  }

  function toggleStepMode() {
    onPlaybackModeChange(playbackMode === "step" ? "continuous" : "step");
  }
</script>

<div class="playback-controls">
  <!-- Left: Transport controls -->
  <div class="controls-left">
    <button
      class="control-btn play-pause-btn"
      onclick={handlePlayPause}
      aria-label={isPlaying ? "Pause" : "Play"}
    >
      <i class="fas fa-{isPlaying ? 'pause' : 'play'}" aria-hidden="true"></i>
    </button>

    <button class="control-btn stop-btn" onclick={onStop} aria-label="Stop">
      <i class="fas fa-stop" aria-hidden="true"></i>
    </button>
  </div>

  <!-- Center: Speed controls -->
  <div class="controls-center">
    <span class="speed-label">Speed</span>
    <div class="speed-presets">
      {#each speedPresets as preset}
        <button
          class="speed-btn"
          class:active={Math.abs(speed - preset) < 0.01}
          onclick={() => handleSpeedClick(preset)}
          aria-label="Speed {preset}x"
        >
          {preset}x
        </button>
      {/each}
    </div>
  </div>

  <!-- Right: Loop toggle -->
  <div class="controls-right">
    <button
      class="control-btn mode-btn"
      class:active={playbackMode === "step"}
      onclick={toggleStepMode}
      disabled={isPlaying}
      aria-label={playbackMode === "step"
        ? "Disable step mode"
        : "Enable step mode"}
      title={isPlaying ? "Pause playback to change mode" : "Toggle step mode"}
    >
      <i class="fas fa-shoe-prints" aria-hidden="true"></i>
      <span class="mode-label">Step</span>
    </button>

    <div
      class="step-settings"
      class:disabled={playbackMode !== "step" || isPlaying}
    >
      <span class="step-size-label">Size:</span>
      <div class="step-size">
        <button
          class="mini-btn"
          class:active={stepPlaybackStepSize === 1}
          onclick={() => onStepPlaybackStepSizeChange(1)}
          disabled={playbackMode !== "step" || isPlaying}
          aria-label="Step by full steps"
        >
          Beat
        </button>
        <button
          class="mini-btn"
          class:active={stepPlaybackStepSize === 0.5}
          onclick={() => onStepPlaybackStepSizeChange(0.5)}
          disabled={playbackMode !== "step" || isPlaying}
          aria-label="Step by half steps"
        >
          Half
        </button>
      </div>
    </div>

    <button
      class="control-btn loop-btn"
      class:active={shouldLoop}
      onclick={handleLoopClick}
      aria-label={shouldLoop ? "Disable loop" : "Enable loop"}
    >
      <i class="fas fa-repeat" aria-hidden="true"></i>
      <span class="loop-label">Loop</span>
    </button>
  </div>
</div>

<style>
  .playback-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    padding: 1rem 1.25rem;
    background: var(--theme-panel-bg);
    border-top: 1px solid var(--theme-stroke);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    position: sticky;
    bottom: 0;
    z-index: 20;
  }

  .controls-left,
  .controls-center,
  .controls-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .controls-center {
    flex: 1;
    justify-content: center;
    flex-wrap: wrap;
  }

  .control-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-width: var(--min-touch-target);
    height: var(--min-touch-target);
    padding: 0 1rem;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.85); /* WCAG AAA */
    font-size: 1rem;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .control-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.95);
  }

  .control-btn:active {
    transform: scale(0.95);
  }

  .play-pause-btn {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.3);
    color: rgba(167, 139, 250, 1);
    font-size: 1.1rem;
  }

  .play-pause-btn:hover {
    background: rgba(139, 92, 246, 0.3);
    border-color: rgba(139, 92, 246, 0.5);
    color: rgba(196, 181, 253, 1);
  }

  .loop-btn.active {
    background: rgba(6, 182, 212, 0.2);
    border-color: rgba(6, 182, 212, 0.4);
    color: rgba(34, 211, 238, 1);
  }

  .mode-btn.active {
    background: rgba(251, 191, 36, 0.16);
    border-color: rgba(251, 191, 36, 0.35);
    color: rgba(252, 211, 77, 1);
  }

  .mode-label {
    font-size: 0.85rem;
    font-weight: 500;
  }

  .step-settings {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.75rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
  }

  .step-settings.disabled {
    opacity: 0.45; /* WCAG AAA */
  }

  .step-size-label {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--theme-text-dim);
  }

  .step-size {
    display: flex;
    gap: 0.35rem;
  }

  .mini-btn {
    height: var(--min-touch-target);
    padding: 0 0.65rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    color: rgba(255, 255, 255, 0.75); /* WCAG AAA */
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .mini-btn:hover:enabled {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
  }

  .mini-btn.active {
    background: rgba(251, 191, 36, 0.14);
    border-color: rgba(251, 191, 36, 0.35);
    color: rgba(252, 211, 77, 1);
  }

  .speed-label {
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--theme-text-dim);
    margin-right: 0.5rem;
  }

  .speed-presets {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .speed-btn {
    min-width: var(--min-touch-target);
    min-height: var(--min-touch-target); /* WCAG AAA touch target */
    padding: 0 0.75rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: var(--theme-text-dim); /* WCAG AAA */
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .speed-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
  }

  .speed-btn.active {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.4);
    color: rgba(167, 139, 250, 1);
    font-weight: 600;
  }

  .speed-btn:active {
    transform: scale(0.95);
  }

  .loop-label {
    font-size: 0.85rem;
    font-weight: 500;
  }

  /* Mobile - compact layout */
  @media (max-width: 768px) {
    .playback-controls {
      padding: 0.75rem 1rem;
      gap: 1rem;
    }

    .step-settings {
      padding: 0.3rem 0.5rem;
      gap: 0.4rem;
    }

    .mini-btn {
      height: var(--min-touch-target);
    }

    .speed-label {
      display: none;
    }

    .speed-presets {
      gap: 0.4rem;
    }

    .speed-btn {
      /* Touch target remains 48px for WCAG AAA */
      font-size: 0.75rem;
    }

    .loop-label {
      display: none;
    }

    .control-btn {
      /* Touch target remains 48px for WCAG AAA */
      padding: 0 0.75rem;
    }
  }

  /* Extra small mobile - minimal layout */
  @media (max-width: 480px) {
    .playback-controls {
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .controls-center {
      order: 3;
      width: 100%;
      justify-content: flex-start;
      padding-top: 0.5rem;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
    }

    .speed-btn {
      /* Touch target remains 48px for WCAG AAA */
      font-size: 0.7rem;
    }
  }

  /* Safe area for mobile */
  @supports (padding-bottom: env(safe-area-inset-bottom)) {
    .playback-controls {
      padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));
    }
  }
</style>

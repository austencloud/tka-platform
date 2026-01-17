<!--
  PlaybackStyleRow.svelte

  Clear, labeled toggle between Continuous and Step-by-Step playback modes.
  Replaces the icon-only PlaybackModeToggle with explicit labels.

  Can be modified during playback - no restrictions.
-->
<script lang="ts">
  import type { PlaybackMode } from "../../state/animation-panel-state.svelte";

  let {
    playbackMode = "continuous",
    isPlaying = false,
    onPlaybackModeChange = () => {},
    onPlaybackToggle = () => {},
  }: {
    playbackMode?: PlaybackMode;
    isPlaying?: boolean;
    onPlaybackModeChange?: (mode: PlaybackMode) => void;
    onPlaybackToggle?: () => void;
  } = $props();

  function handleModeChange(mode: PlaybackMode) {
    if (mode === playbackMode) return;

    // Allow changing mode during playback - just pause, switch, resume
    const wasPlaying = isPlaying;
    if (wasPlaying) {
      onPlaybackToggle();
    }
    onPlaybackModeChange(mode);
    if (wasPlaying) {
      setTimeout(() => onPlaybackToggle(), 0);
    }
  }
</script>

<div class="style-row">
  <span class="style-label">STYLE</span>
  <div class="style-buttons">
    <button
      class="style-btn"
      class:active={playbackMode === "continuous"}
      onclick={() => handleModeChange("continuous")}
      type="button"
      aria-pressed={playbackMode === "continuous"}
    >
      <i class="fas fa-play" aria-hidden="true"></i>
      <span>Continuous</span>
    </button>
    <button
      class="style-btn"
      class:active={playbackMode === "step"}
      onclick={() => handleModeChange("step")}
      type="button"
      aria-pressed={playbackMode === "step"}
    >
      <i class="fas fa-shoe-prints" aria-hidden="true"></i>
      <span>Step-by-Step</span>
    </button>
  </div>
</div>

<style>
  .style-row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
  }

  .style-label {
    font-size: var(--font-size-compact);
    font-weight: 600;
    color: var(--theme-text-dim, var(--theme-text-dim));
    letter-spacing: 0.05em;
    text-transform: uppercase;
    flex-shrink: 0;
    min-width: 44px;
  }

  .style-buttons {
    display: flex;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }

  .style-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: var(--touch-target-min, 44px);
    padding: 8px 12px;
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 10px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1);
    -webkit-tap-highlight-color: transparent;
  }

  .style-btn i {
    font-size: var(--font-size-compact);
    flex-shrink: 0;
  }

  .style-btn span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .style-btn.active {
    background: rgba(251, 191, 36, 0.15);
    border-color: rgba(251, 191, 36, 0.4);
    color: rgba(252, 211, 77, 1);
    box-shadow:
      0 0 12px rgba(251, 191, 36, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }

  .style-btn.active i {
    color: rgba(252, 211, 77, 0.9);
  }

  @media (hover: hover) and (pointer: fine) {
    .style-btn:hover:not(.active) {
      background: var(--theme-card-hover-bg);
      border-color: var(--theme-stroke-strong);
      color: var(--theme-text);
    }
  }

  .style-btn:active {
    transform: scale(0.98);
  }

  /* Responsive - smaller screens */
  @media (max-width: 400px) {
    .style-row {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
    }

    .style-label {
      min-width: unset;
    }

    .style-btn {
      padding: 10px 8px;
      font-size: var(--font-size-compact);
      gap: 6px;
    }

    .style-btn i {
      font-size: var(--font-size-compact);
    }
  }
</style>

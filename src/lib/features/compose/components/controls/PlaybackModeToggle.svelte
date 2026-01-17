<!--
  PlaybackModeToggle.svelte

  Labeled toggle between Continuous and Step playback modes.
  Used in settings sheets and panels.
-->
<script lang="ts">
  import type { PlaybackMode } from "../../state/animation-panel-state.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

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

<div class="mode-toggle">
  <button
    class="mode-btn"
    class:active={playbackMode === "continuous"}
    onclick={() => handleModeChange("continuous")}
    type="button"
    aria-pressed={playbackMode === "continuous"}
  >
    <i class="fas fa-play" aria-hidden="true"></i>
    <span>{t("compose_continuous")}</span>
  </button>
  <button
    class="mode-btn"
    class:active={playbackMode === "step"}
    onclick={() => handleModeChange("step")}
    type="button"
    aria-pressed={playbackMode === "step"}
  >
    <i class="fas fa-shoe-prints" aria-hidden="true"></i>
    <span>{t("compose_step_by_step")}</span>
  </button>
</div>

<style>
  .mode-toggle {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
  }

  .mode-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 36px;
    padding: 6px 10px;
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 8px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1);
    -webkit-tap-highlight-color: transparent;
  }

  .mode-btn i {
    font-size: var(--font-size-compact);
    flex-shrink: 0;
  }

  .mode-btn span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .mode-btn.active {
    background: rgba(251, 191, 36, 0.15);
    border-color: rgba(251, 191, 36, 0.4);
    color: rgba(252, 211, 77, 1);
    box-shadow:
      0 0 12px rgba(251, 191, 36, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }

  .mode-btn.active i {
    color: rgba(252, 211, 77, 0.9);
  }

  @media (hover: hover) and (pointer: fine) {
    .mode-btn:hover:not(.active) {
      background: var(--theme-card-hover-bg);
      border-color: var(--theme-stroke-strong);
      color: var(--theme-text);
    }
  }

  .mode-btn:active {
    transform: scale(0.98);
  }

  .mode-btn:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .mode-btn {
      transition: none;
    }
  }
</style>

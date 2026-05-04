<!--
  PlaybackModeToggle.svelte

  Labeled toggle between Continuous and Step playback modes.
  Used in settings sheets and panels.
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import type { PlaybackMode } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
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

  let nextTickTimer: ReturnType<typeof setTimeout> | null = null;

  function handleModeChange(mode: PlaybackMode) {
    if (mode === playbackMode) return;

    const wasPlaying = isPlaying;
    if (wasPlaying) {
      onPlaybackToggle();
    }
    onPlaybackModeChange(mode);
    if (wasPlaying) {
      if (nextTickTimer !== null) clearTimeout(nextTickTimer);
      nextTickTimer = setTimeout(() => {
        onPlaybackToggle();
        nextTickTimer = null;
      }, 0);
    }
  }

  onDestroy(() => {
    if (nextTickTimer !== null) clearTimeout(nextTickTimer);
  });
</script>

<div class="mode-toggle">
  <button
    class="mode-btn"
    class:active={playbackMode === "continuous"}
    onclick={() => handleModeChange("continuous")}
    type="button"
    aria-pressed={playbackMode === "continuous"}
    aria-label="Continuous playback mode"
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
    aria-label="Step-by-step playback mode"
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
    font-size: var(--font-size-compact, 12px);
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
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 40%, transparent);
    color: var(--theme-accent);
    box-shadow:
      0 0 12px color-mix(in srgb, var(--theme-accent) 12%, transparent),
      inset 0 1px 0 var(--theme-stroke);
  }

  .mode-btn.active i {
    color: var(--theme-accent);
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

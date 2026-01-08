<!--
  PlayPauseButton.svelte

  Large, touch-friendly play/pause toggle button.
  Primary action for animation playback control.
-->
<script lang="ts">
  import * as m from "$lib/paraglide/messages.js";

  let {
    isPlaying = $bindable(false),
    onToggle,
    size = "default",
  }: {
    isPlaying: boolean;
    onToggle?: (playing: boolean) => void;
    size?: "default" | "large";
  } = $props();

  function handleClick() {
    isPlaying = !isPlaying;
    onToggle?.(isPlaying);
  }
</script>

<button
  class="play-pause-button"
  class:playing={isPlaying}
  class:large={size === "large"}
  onclick={handleClick}
  aria-label={isPlaying ? m.compose_pause_animation() : m.compose_play_animation()}
  aria-pressed={isPlaying}
>
  <i class="fas {isPlaying ? 'fa-pause' : 'fa-play'}" aria-hidden="true"></i>
</button>

<style>
  .play-pause-button {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    border: 2px solid rgba(34, 197, 94, 0.5);
    background: linear-gradient(
      135deg,
      rgba(34, 197, 94, 0.35) 0%,
      rgba(22, 163, 74, 0.35) 100%
    );
    color: rgba(255, 255, 255, 0.95);
    font-size: 1.2rem;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    -webkit-tap-highlight-color: transparent;
    box-shadow: 0 4px 12px rgba(34, 197, 94, 0.2);
  }

  .play-pause-button.large {
    width: 64px;
    height: 64px;
    font-size: 1.4rem;
  }

  .play-pause-button:hover {
    background: linear-gradient(
      135deg,
      rgba(34, 197, 94, 0.45) 0%,
      rgba(22, 163, 74, 0.45) 100%
    );
    border-color: rgba(34, 197, 94, 0.7);
    box-shadow: 0 6px 16px rgba(34, 197, 94, 0.3);
    transform: scale(1.02);
  }

  .play-pause-button:active {
    transform: scale(0.95);
  }

  /* Playing state - amber/orange color */
  .play-pause-button.playing {
    background: linear-gradient(
      135deg,
      rgba(251, 191, 36, 0.4) 0%,
      rgba(245, 158, 11, 0.4) 100%
    );
    border-color: rgba(251, 191, 36, 0.6);
    box-shadow: 0 4px 12px rgba(251, 191, 36, 0.25);
  }

  .play-pause-button.playing:hover {
    background: linear-gradient(
      135deg,
      rgba(251, 191, 36, 0.5) 0%,
      rgba(245, 158, 11, 0.5) 100%
    );
    border-color: rgba(251, 191, 36, 0.8);
    box-shadow: 0 6px 16px rgba(251, 191, 36, 0.35);
  }

  .play-pause-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  /* Play icon needs slight offset for optical center */
  .play-pause-button i.fa-play {
    margin-left: 3px;
  }

  /* Responsive: Smaller screens */
  @media (max-width: 480px) {
    .play-pause-button {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      font-size: 1rem;
    }

    .play-pause-button.large {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      font-size: 1.1rem;
    }

    .play-pause-button i.fa-play {
      margin-left: 2px;
    }
  }

  /* Very small screens */
  @media (max-width: 360px) {
    /* Keep 48px minimum for accessibility */
    .play-pause-button {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      min-width: var(--min-touch-target);
      min-height: var(--min-touch-target);
      font-size: 0.9rem;
    }

    .play-pause-button.large {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      min-width: var(--min-touch-target);
      min-height: var(--min-touch-target);
      font-size: 1rem;
    }

    .play-pause-button i.fa-play {
      margin-left: 2px;
    }
  }
</style>

<!--
  MobilePlaybackToolbar.svelte

  Mobile toolbar for playback panel.
  Layout: [View Toggle] ... [Play Button] ... [Close Button]
-->
<script lang="ts">
  import type { MobileToolView } from "../state/playback-state.svelte";
  import MobileToolViewToggle from "../../../components/inputs/MobileToolViewToggle.svelte";

  let {
    isPlaying = false,
    activeView = "controls" as MobileToolView,
    onPlayPause,
    onToggleView,
    onClose,
  }: {
    isPlaying: boolean;
    activeView: MobileToolView;
    onPlayPause: () => void;
    onToggleView: () => void;
    onClose: () => void;
  } = $props();
</script>

<div class="mobile-toolbar">
  <div class="toolbar-left">
    <MobileToolViewToggle {activeView} onToggle={onToggleView} />
  </div>

  <div class="toolbar-center">
    <button
      class="play-btn"
      class:playing={isPlaying}
      onclick={onPlayPause}
      aria-label={isPlaying ? "Pause" : "Play"}
    >
      <i class="fas fa-{isPlaying ? 'pause' : 'play'}" aria-hidden="true"></i>
    </button>
  </div>

  <div class="toolbar-right">
    <button class="close-btn" onclick={onClose} aria-label="Close playback">
      <i class="fas fa-chevron-down" aria-hidden="true"></i>
    </button>
  </div>
</div>

<style>
  .mobile-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: rgba(0, 0, 0, 0.5);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .toolbar-left,
  .toolbar-center,
  .toolbar-right {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toolbar-left,
  .toolbar-right {
    flex: 1;
  }

  .toolbar-left {
    justify-content: flex-start;
  }

  .toolbar-right {
    justify-content: flex-end;
  }

  .toolbar-center {
    flex: 0 0 auto;
  }

  .play-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: linear-gradient(
      135deg,
      rgba(139, 92, 246, 0.3) 0%,
      rgba(124, 58, 237, 0.25) 100%
    );
    border: 2px solid rgba(139, 92, 246, 0.5);
    color: rgba(196, 181, 253, 1);
    font-size: 1.25rem;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .play-btn:hover {
    background: linear-gradient(
      135deg,
      rgba(139, 92, 246, 0.4) 0%,
      rgba(124, 58, 237, 0.35) 100%
    );
    border-color: rgba(139, 92, 246, 0.7);
    transform: scale(1.05);
  }

  .play-btn:active {
    transform: scale(0.95);
  }

  .play-btn.playing {
    background: linear-gradient(
      135deg,
      rgba(34, 197, 94, 0.3) 0%,
      rgba(22, 163, 74, 0.25) 100%
    );
    border-color: rgba(34, 197, 94, 0.6);
    color: rgba(134, 239, 172, 1);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border-radius: 50%;
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke-strong);
    color: var(--theme-text-dim);
    font-size: 1rem;
    cursor: pointer;
    transition: all var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1);
    -webkit-tap-highlight-color: transparent;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.25);
    color: var(--theme-text);
    transform: scale(1.05);
  }

  .close-btn:active {
    transform: scale(0.95);
  }

  /* Safe area support */
  @supports (padding-top: env(safe-area-inset-top)) {
    .mobile-toolbar {
      padding-top: calc(0.75rem + env(safe-area-inset-top));
    }
  }
</style>

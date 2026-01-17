<!--
  CompactMobileRow.svelte

  Compact control row for mobile devices showing:
  - View toggle (left)
  - Play/pause button (center)
  - Expand toggle (right)
-->
<script lang="ts">
  import MobileToolViewToggle from "../inputs/MobileToolViewToggle.svelte";
  import ExpandToggleButton from "../inputs/ExpandToggleButton.svelte";

  type MobileToolView = "controls" | "beat-grid";

  let {
    mobileToolView = "controls",
    isPlaying = false,
    isExpanded = false,
    onToggleToolView = () => {},
    onPlaybackToggle = () => {},
    onToggleExpanded = () => {},
  }: {
    mobileToolView?: MobileToolView;
    isPlaying?: boolean;
    isExpanded?: boolean;
    onToggleToolView?: () => void;
    onPlaybackToggle?: () => void;
    onToggleExpanded?: () => void;
  } = $props();
</script>

<div class="compact-row">
  <!-- Left: View Toggle -->
  <MobileToolViewToggle
    activeView={mobileToolView}
    onToggle={onToggleToolView}
  />

  <!-- Center: Play button -->
  <button
    class="play-pause-btn center-play"
    class:playing={isPlaying}
    onclick={onPlaybackToggle}
    aria-label={isPlaying ? "Pause animation" : "Play animation"}
    type="button"
  >
    <i class="fas {isPlaying ? 'fa-pause' : 'fa-play'}" aria-hidden="true"></i>
  </button>

  <!-- Right: Expand Toggle -->
  <ExpandToggleButton {isExpanded} onToggle={onToggleExpanded} />
</div>

<style>
  /* Compact mode row - layout: toggle (left), play (center), expand (right) */
  .compact-row {
    display: flex;
    flex-wrap: nowrap;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    position: relative;
  }

  .compact-row .center-play {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
  }

  /* Play/Pause Button */
  .play-pause-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    flex-shrink: 0;
    background: linear-gradient(
      135deg,
      rgba(34, 197, 94, 0.25) 0%,
      rgba(22, 163, 74, 0.2) 100%
    );
    border: 1.5px solid rgba(34, 197, 94, 0.4);
    border-radius: 50%;
    color: rgba(134, 239, 172, 1);
    cursor: pointer;
    transition: all var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow:
      0 2px 8px rgba(34, 197, 94, 0.15),
      0 0 16px rgba(34, 197, 94, 0.1),
      inset 0 1px 0 var(--theme-stroke);
    -webkit-tap-highlight-color: transparent;
    font-size: var(--font-size-base);
  }

  .play-pause-btn.playing {
    background: linear-gradient(
      135deg,
      rgba(239, 68, 68, 0.25) 0%,
      rgba(220, 38, 38, 0.2) 100%
    );
    border-color: rgba(239, 68, 68, 0.4);
    color: rgba(254, 202, 202, 1);
    box-shadow:
      0 2px 8px rgba(239, 68, 68, 0.15),
      0 0 16px rgba(239, 68, 68, 0.1),
      inset 0 1px 0 var(--theme-stroke);
  }

  @media (hover: hover) and (pointer: fine) {
    .play-pause-btn:hover {
      transform: translateX(-50%) scale(1.05);
      background: linear-gradient(
        135deg,
        rgba(34, 197, 94, 0.35) 0%,
        rgba(22, 163, 74, 0.3) 100%
      );
      border-color: rgba(34, 197, 94, 0.6);
      box-shadow:
        0 4px 14px rgba(34, 197, 94, 0.25),
        0 0 20px rgba(34, 197, 94, 0.15),
        inset 0 1px 0 var(--theme-card-hover-bg);
    }

    .play-pause-btn.playing:hover {
      background: linear-gradient(
        135deg,
        rgba(239, 68, 68, 0.35) 0%,
        rgba(220, 38, 38, 0.3) 100%
      );
      border-color: rgba(239, 68, 68, 0.6);
      box-shadow:
        0 4px 14px rgba(239, 68, 68, 0.25),
        0 0 20px rgba(239, 68, 68, 0.15),
        inset 0 1px 0 var(--theme-card-hover-bg);
    }
  }

  .play-pause-btn:active {
    transform: translateX(-50%) scale(0.96);
  }

  /* Responsive adjustments */
  @media (max-width: 480px) {
    .play-pause-btn {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      font-size: var(--font-size-sm);
    }
  }

  @media (max-width: 375px) and (max-height: 670px) {
    .play-pause-btn {
      width: 44px;
      height: 44px;
      font-size: var(--font-size-sm);
    }
  }
</style>

<script lang="ts">
  import { getVideoTrailsContext } from "../context/video-trails-context";

  const { state: trailsState } = getVideoTrailsContext();

  const speedOptions = [0.25, 0.5, 1, 1.5, 2];

  function handleKeydown(e: KeyboardEvent) {
    if (e.target !== document.body) return;

    switch (e.key) {
      case " ":
        e.preventDefault();
        trailsState.togglePlayback();
        break;
      case "ArrowLeft":
        trailsState.setCurrentFrame(Math.max(0, trailsState.currentFrame - (e.shiftKey ? 10 : 1)));
        break;
      case "ArrowRight":
        trailsState.setCurrentFrame(Math.min(trailsState.totalFrames - 1, trailsState.currentFrame + (e.shiftKey ? 10 : 1)));
        break;
    }
  }

  function handleSeek(e: Event) {
    const input = e.target as HTMLInputElement;
    trailsState.setCurrentFrame(Number(input.value));
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="playback-controls">
  <button class="play-btn" onclick={() => trailsState.togglePlayback()} aria-label={trailsState.isPlaying ? "Pause" : "Play"}>
    <i class="fas {trailsState.isPlaying ? 'fa-pause' : 'fa-play'}" aria-hidden="true"></i>
  </button>

  <input
    type="range"
    class="seek-bar"
    min="0"
    max={Math.max(0, trailsState.totalFrames - 1)}
    value={trailsState.currentFrame}
    oninput={handleSeek}
    aria-label="Seek"
  />

  <span class="frame-counter">
    {trailsState.currentFrame} / {trailsState.totalFrames}
  </span>

  <div class="speed-pills">
    {#each speedOptions as speed}
      <button
        class="speed-pill"
        class:active={trailsState.playbackSpeed === speed}
        onclick={() => trailsState.setPlaybackSpeed(speed)}
      >
        {speed}x
      </button>
    {/each}
  </div>
</div>

<style>
  .playback-controls {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 8px;
  }

  .play-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 50%;
    background: var(--theme-accent, #f43f5e);
    color: white;
    cursor: pointer;
    font-size: 14px;
    flex-shrink: 0;
  }

  .play-btn:hover { filter: brightness(1.1); }


  .seek-bar {
    -webkit-appearance: none;
    appearance: none;
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.15));
    outline: none;
  }

  .seek-bar::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--theme-accent, #f43f5e);
    cursor: pointer;
    border: 2px solid var(--theme-panel-bg, #121220);
  }

  .seek-bar::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--theme-accent, #f43f5e);
    cursor: pointer;
    border: 2px solid var(--theme-panel-bg, #121220);
  }

  .frame-counter {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    white-space: nowrap;
    min-width: 80px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }


  .speed-pills {
    display: flex;
    gap: 2px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 6px;
    padding: 2px;
    flex-shrink: 0;
  }

  .speed-pill {
    padding: 4px 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    white-space: nowrap;
  }

  .speed-pill:hover {
    color: var(--theme-text, #ffffff);
  }

  .speed-pill.active {
    background: var(--theme-accent, #f43f5e);
    color: white;
  }
</style>

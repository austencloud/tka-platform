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

  <select
    class="speed-select"
    value={trailsState.playbackSpeed}
    onchange={(e) => trailsState.setPlaybackSpeed(Number((e.target as HTMLSelectElement).value))}
    aria-label="Playback speed"
  >
    {#each speedOptions as speed}
      <option value={speed}>{speed}x</option>
    {/each}
  </select>
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
    flex: 1;
    height: 4px;
    accent-color: var(--theme-accent, #f43f5e);
  }

  .frame-counter {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    white-space: nowrap;
    min-width: 80px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .speed-select {
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 4px;
    color: var(--theme-text, #ffffff);
    padding: 4px 8px;
    font-size: var(--font-size-compact, 12px);
  }
</style>

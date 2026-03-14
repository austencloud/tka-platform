<script lang="ts">
  import { getVideoTrailsContext } from "../context/video-trails-context";

  const { state } = getVideoTrailsContext();

  const speedOptions = [0.25, 0.5, 1, 1.5, 2];

  function handleKeydown(e: KeyboardEvent) {
    if (e.target !== document.body) return;

    switch (e.key) {
      case " ":
        e.preventDefault();
        state.togglePlayback();
        break;
      case "ArrowLeft":
        state.setCurrentFrame(Math.max(0, state.currentFrame - (e.shiftKey ? 10 : 1)));
        break;
      case "ArrowRight":
        state.setCurrentFrame(Math.min(state.totalFrames - 1, state.currentFrame + (e.shiftKey ? 10 : 1)));
        break;
    }
  }

  function handleSeek(e: Event) {
    const input = e.target as HTMLInputElement;
    state.setCurrentFrame(Number(input.value));
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="playback-controls">
  <button class="play-btn" onclick={() => state.togglePlayback()} aria-label={state.isPlaying ? "Pause" : "Play"}>
    <i class="fas {state.isPlaying ? 'fa-pause' : 'fa-play'}" aria-hidden="true"></i>
  </button>

  <input
    type="range"
    class="seek-bar"
    min="0"
    max={Math.max(0, state.totalFrames - 1)}
    value={state.currentFrame}
    oninput={handleSeek}
    aria-label="Seek"
  />

  <span class="frame-counter">
    {state.currentFrame} / {state.totalFrames}
  </span>

  <select
    class="speed-select"
    value={state.playbackSpeed}
    onchange={(e) => state.setPlaybackSpeed(Number((e.target as HTMLSelectElement).value))}
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

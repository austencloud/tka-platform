<script lang="ts">
  import type { UnifiedPlaybackContext } from "./unified-playback-context";
  import { formatTime } from "$lib/shared/sequence-viewer/utils/format-time";

  let {
    playback,
    visible = true,
  }: {
    playback: UnifiedPlaybackContext;
    visible?: boolean;
  } = $props();

  const currentTimeLabel = $derived(formatTime(playback.elapsed));
  const totalTimeLabel = $derived(formatTime(playback.duration));

  const beatMarkers = $derived(
    playback.totalBeats > 1
      ? Array.from(
          { length: playback.totalBeats - 1 },
          (_, i) => (i + 1) / playback.totalBeats,
        )
      : ([] as number[]),
  );

  let scrubberEl: HTMLDivElement | undefined = $state();
  let isDragging = $state(false);

  function seekFromPointer(e: PointerEvent) {
    if (!scrubberEl) return;
    const rect = scrubberEl.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    playback.seek(ratio);
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    isDragging = true;
    scrubberEl?.setPointerCapture(e.pointerId);
    seekFromPointer(e);
  }

  function onPointerMove(e: PointerEvent) {
    if (!isDragging) return;
    seekFromPointer(e);
  }

  function onPointerUp(e: PointerEvent) {
    if (!isDragging) return;
    isDragging = false;
    scrubberEl?.releasePointerCapture(e.pointerId);
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      playback.togglePlay();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const step = 1 / Math.max(1, playback.totalBeats);
      playback.seek(Math.min(1, playback.overallProgress + step));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const step = 1 / Math.max(1, playback.totalBeats);
      playback.seek(Math.max(0, playback.overallProgress - step));
    }
  }
</script>

{#if visible && playback.totalBeats > 0}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="unified-timeline" role="group" aria-label="Playback transport" onkeydown={onKeydown}>
    <div class="transport-pill">
      <button
        class="pill-play"
        onclick={(e) => { e.stopPropagation(); playback.togglePlay(); }}
        aria-label={playback.isPlaying ? "Pause" : "Play"}
      >
        <i class="fas {playback.isPlaying ? 'fa-pause' : 'fa-play'}"></i>
      </button>

      <span class="pill-time">
        {currentTimeLabel} / {totalTimeLabel}
      </span>

      <div
        class="pill-track"
        bind:this={scrubberEl}
        onpointerdown={onPointerDown}
        onpointermove={onPointerMove}
        onpointerup={onPointerUp}
        onpointercancel={onPointerUp}
        role="slider"
        tabindex="0"
        aria-label="Playback progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(playback.overallProgress * 100)}
      >
        <div class="pill-fill" style:width="{playback.overallProgress * 100}%"></div>
        {#each beatMarkers as pct (pct)}
          <div class="pill-beat-marker" style:left="{pct * 100}%"></div>
        {/each}
        <div class="pill-knob" style:left="{playback.overallProgress * 100}%"></div>
      </div>

      {#if playback.isLooping !== undefined}
        <button
          class="pill-loop"
          aria-pressed={playback.isLooping}
          aria-label="Loop {playback.isLooping ? 'on' : 'off'}"
          onclick={(e) => { e.stopPropagation(); playback.toggleLoop(); }}
        >
          <i class="fas fa-sync"></i>
        </button>
      {/if}
    </div>

    <div class="pill-context">
      beat {playback.currentBeat} of {playback.totalBeats}
    </div>
  </div>
{/if}

<style>
  .unified-timeline {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 12px 4px;
    box-sizing: border-box;
  }

  .transport-pill {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 14px;
    width: 100%;
    max-width: 720px;
    box-sizing: border-box;
    background: rgba(20, 22, 32, 0.78);
    backdrop-filter: blur(24px) saturate(150%);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 999px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .pill-play {
    width: 36px;
    height: 36px;
    min-width: 36px;
    min-height: 36px;
    border-radius: 50%;
    background: #6366f1;
    border: 1px solid color-mix(in srgb, #6366f1 70%, white);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    flex-shrink: 0;
    padding: 0;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);
    transition: transform 120ms ease, background 150ms ease;
  }

  .pill-play::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: 48px;
    height: 48px;
    transform: translate(-50%, -50%);
  }

  .pill-play:hover {
    transform: scale(1.08);
    background: color-mix(in srgb, #6366f1 90%, white 10%);
  }

  .pill-play:active {
    transform: scale(0.94);
  }

  .pill-play:has(> .fa-play) i {
    margin-left: 1.5px;
  }

  .pill-time {
    font-size: 11px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.55);
    font-variant-numeric: tabular-nums;
    min-width: 80px;
    text-align: center;
    white-space: nowrap;
    user-select: none;
  }

  .pill-track {
    flex: 1;
    height: 6px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    position: relative;
    cursor: pointer;
    min-width: 120px;
    touch-action: none;
  }

  .pill-fill {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    background: #6366f1;
    border-radius: 999px;
    pointer-events: none;
  }

  .pill-knob {
    position: absolute;
    top: 50%;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: white;
    transform: translate(-50%, -50%);
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
    pointer-events: none;
  }

  .pill-beat-marker {
    position: absolute;
    top: -2px;
    width: 1.5px;
    height: 10px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 1px;
    transform: translateX(-50%);
    pointer-events: none;
  }

  .pill-loop {
    width: 32px;
    height: 32px;
    min-width: 32px;
    min-height: 32px;
    border-radius: 50%;
    background: rgba(99, 102, 241, 0.15);
    border: 1px solid rgba(99, 102, 241, 0.4);
    color: #818cf8;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    flex-shrink: 0;
    padding: 0;
    transition: background 150ms ease;
  }

  .pill-loop[aria-pressed="false"] {
    background: transparent;
    color: rgba(255, 255, 255, 0.35);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .pill-loop:hover {
    background: rgba(99, 102, 241, 0.25);
  }

  .pill-context {
    font-size: 9px;
    color: rgba(255, 255, 255, 0.25);
    letter-spacing: 1px;
    text-transform: uppercase;
    text-align: center;
    margin-top: 6px;
    user-select: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .pill-play,
    .pill-loop {
      transition: none;
    }
    .pill-play:hover {
      transform: none;
    }
  }
</style>

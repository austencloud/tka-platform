<script module lang="ts">
  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
</script>

<!--
  WaveformTimeline.svelte

  Wavesurfer.js wrapper for audio waveform visualization.
  Displays waveform, handles playback, zoom, and keyboard controls.

  Controls:
  - Click: Seek to position
  - Space: Play/pause
  - Arrow Left/Right: Seek ±5 seconds
  - Ctrl+Wheel: Zoom in/out
  - Home/End: Jump to start/end
-->
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import { onMount, onDestroy } from "svelte";
  import WaveSurfer from "wavesurfer.js";
  import WaveformMinimap from "./WaveformMinimap.svelte";

  let {
    audioUrl,
    isPlaying = false,
    currentTime = 0,
    onReady,
    onTimeUpdate,
    onDurationChange,
    onSeek,
    onPlayPause,
    onZoomChange,
  }: {
    audioUrl: string;
    isPlaying?: boolean;
    currentTime?: number;
    onReady?: () => void;
    onTimeUpdate?: (time: number) => void;
    onDurationChange?: (duration: number) => void;
    onSeek?: (time: number) => void;
    onPlayPause?: (playing: boolean) => void;
    onZoomChange?: (zoom: number) => void;
  } = $props();

  let containerEl: HTMLDivElement;
  let wavesurfer: WaveSurfer | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let isReady = $state(false);
  let duration = $state(0);
  let internalTime = $state(0);
  let isFocused = $state(false);

  // Zoom state (pixels per second)
  const MIN_ZOOM = 20;
  const MAX_ZOOM = 500;
  const DEFAULT_ZOOM = 50;
  let zoomLevel = $state(DEFAULT_ZOOM);

  // Viewport tracking for minimap
  let viewportStart = $state(0); // Start time of visible region
  let containerWidth = $state(0); // Width of the waveform container

  // Sync external isPlaying prop with wavesurfer
  $effect(() => {
    if (!wavesurfer || !isReady) return;

    if (isPlaying && !wavesurfer.isPlaying()) {
      wavesurfer.play();
    } else if (!isPlaying && wavesurfer.isPlaying()) {
      wavesurfer.pause();
    }
  });

  // Sync external currentTime with wavesurfer (for seeking)
  $effect(() => {
    if (!wavesurfer || !isReady) return;

    // Only seek if the difference is significant (avoid feedback loops)
    const diff = Math.abs(currentTime - internalTime);
    if (diff > 0.1) {
      wavesurfer.seekTo(currentTime / duration);
    }
  });

  // Apply zoom level changes
  function applyZoom(level: number) {
    if (!wavesurfer || !isReady) return;

    // Call zoom method
    wavesurfer.zoom(level);

    // Update viewport after zoom
    requestAnimationFrame(() => {
      updateViewport();
    });

    onZoomChange?.(level);
  }

  // Update viewport tracking for minimap
  function updateViewport() {
    if (!containerEl || zoomLevel <= 0) return;
    viewportStart = containerEl.scrollLeft / zoomLevel;
  }

  // Handle seek from minimap (clicking on the track)
  function handleMinimapSeek(time: number) {
    if (!wavesurfer || !isReady || duration <= 0) return;
    wavesurfer.seekTo(time / duration);
  }

  // Handle scroll from minimap (dragging the viewport)
  function handleMinimapScroll(startTime: number) {
    if (!wavesurfer || !isReady) return;

    // Use wavesurfer's native setScrollTime method (v7 API)
    // This scrolls the waveform to show the specified time at the left edge
    wavesurfer.setScrollTime(startTime);
    viewportStart = startTime;
  }

  onMount(() => {
    if (!containerEl) return;

    wavesurfer = WaveSurfer.create({
      container: containerEl,
      waveColor: "rgba(139, 92, 246, 0.4)",
      progressColor: "rgba(167, 139, 250, 0.8)",
      cursorColor: "rgba(255, 255, 255, 0.8)",
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 120,
      normalize: true,
      backend: "WebAudio",
      minPxPerSec: DEFAULT_ZOOM,
      // Zoom/scroll configuration
      fillParent: false, // Allow waveform to expand when zoomed
      autoScroll: true, // Auto-scroll to keep cursor visible
      autoCenter: true, // Center cursor during playback
      hideScrollbar: true, // Hide scrollbar - minimap handles navigation
    });

    // Listen for zoom events
    wavesurfer.on("zoom", (pxPerSec: number) => {
      updateViewport();
    });

    // Track scroll position for minimap
    // Wavesurfer v7 scroll event passes the scroll position
    wavesurfer.on("scroll", (visibleStartTime: number) => {
      // In v7, the scroll event passes the visible start time directly
      viewportStart = visibleStartTime;
    });

    // Load audio
    wavesurfer.load(audioUrl);

    // Track container width
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        containerWidth = entry.contentRect.width;
        updateViewport();
      }
    });
    resizeObserver.observe(containerEl);

    // Event handlers
    wavesurfer.on("ready", () => {
      isReady = true;
      duration = wavesurfer?.getDuration() ?? 0;
      onDurationChange?.(duration);
      onReady?.();
      // Wavesurfer's scroll event handles viewport sync - see above
    });

    wavesurfer.on("audioprocess", (time: number) => {
      internalTime = time;
      onTimeUpdate?.(time);
    });

    wavesurfer.on("seeking", (time: number) => {
      internalTime = time;
      onSeek?.(time);
    });

    wavesurfer.on("play", () => {
      onPlayPause?.(true);
    });

    wavesurfer.on("pause", () => {
      onPlayPause?.(false);
    });

    wavesurfer.on("finish", () => {
      onPlayPause?.(false);
    });

    // Click behavior: seek to position (no toggle)
    wavesurfer.on("interaction", () => {
      // The interaction event already seeks, we just don't toggle play
    });
  });

  onDestroy(() => {
    wavesurfer?.destroy();
    wavesurfer = null;
    resizeObserver?.disconnect();
    resizeObserver = null;
  });

  // Keyboard controls
  function handleKeydown(e: KeyboardEvent) {
    if (!wavesurfer || !isReady || !isFocused) return;

    switch (e.key) {
      case " ":
        e.preventDefault();
        wavesurfer.playPause();
        break;
      case "ArrowLeft":
        e.preventDefault();
        seekRelative(-5);
        break;
      case "ArrowRight":
        e.preventDefault();
        seekRelative(5);
        break;
      case "Home":
        e.preventDefault();
        wavesurfer.seekTo(0);
        break;
      case "End":
        e.preventDefault();
        wavesurfer.seekTo(1);
        break;
    }
  }

  // Wheel zoom (Ctrl+wheel)
  function handleWheel(e: WheelEvent) {
    if (!e.ctrlKey && !e.metaKey) return;

    e.preventDefault();
    const delta = e.deltaY > 0 ? -10 : 10;
    const newLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel + delta));
    zoomLevel = newLevel;
    applyZoom(newLevel);
  }

  // Seek relative to current position
  function seekRelative(seconds: number) {
    if (!wavesurfer || duration <= 0) return;
    const newTime = Math.max(0, Math.min(duration, internalTime + seconds));
    wavesurfer.seekTo(newTime / duration);
  }

  // Zoom slider handler
  function handleZoomChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const newLevel = parseInt(input.value, 10);
    zoomLevel = newLevel;
    applyZoom(newLevel);
  }

  // Reset zoom
  function resetZoom() {
    zoomLevel = DEFAULT_ZOOM;
    applyZoom(DEFAULT_ZOOM);
  }

  // Expose methods for parent control
  export function play() {
    wavesurfer?.play();
  }

  export function pause() {
    wavesurfer?.pause();
  }

  export function seekTo(time: number) {
    if (wavesurfer && duration > 0) {
      wavesurfer.seekTo(time / duration);
    }
  }

  export function getDuration(): number {
    return duration;
  }

  export function setZoom(level: number) {
    const newLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level));
    zoomLevel = newLevel;
    applyZoom(newLevel);
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="waveform-wrapper">
  <!-- Minimap overview bar -->
  {#if isReady && duration > 0}
    <WaveformMinimap
      {duration}
      currentTime={internalTime}
      {viewportStart}
      {zoomLevel}
      {containerWidth}
      onSeek={handleMinimapSeek}
      onScroll={handleMinimapScroll}
    />
  {/if}

  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    class="waveform-timeline"
    class:focused={isFocused}
    onfocus={() => (isFocused = true)}
    onblur={() => (isFocused = false)}
    onwheel={handleWheel}
    tabindex="0"
    role="application"
    aria-label="Audio waveform timeline"
  >
    <!-- Wavesurfer container - wavesurfer handles its own scroll via Shadow DOM -->
    <div class="waveform-container" bind:this={containerEl}></div>

    {#if !isReady}
      <div class="loading-overlay">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        <span>{t("loading_waveform")}</span>
      </div>
    {/if}

    <!-- Controls bar -->
    <div class="controls-bar">
      <!-- Playback controls -->
      <div class="playback-controls">
        <button
          class="control-btn"
          onclick={() => wavesurfer?.playPause()}
          disabled={!isReady}
          title={isPlaying ? "Pause (Space)" : "Play (Space)"}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          <i class="fas {isPlaying ? 'fa-pause' : 'fa-play'}" aria-hidden="true"
          ></i>
        </button>
        <button
          class="control-btn"
          onclick={() => wavesurfer?.stop()}
          disabled={!isReady}
          title="Stop"
          aria-label="Stop"
        >
          <i class="fas fa-stop" aria-hidden="true"></i>
        </button>
      </div>

      <!-- Time display -->
      <div class="time-display">
        <span class="current">{formatTime(internalTime)}</span>
        <span class="separator">/</span>
        <span class="total">{formatTime(duration)}</span>
      </div>

      <!-- Zoom controls -->
      <div class="zoom-controls">
        <button
          class="control-btn small"
          onclick={() => {
            zoomLevel = Math.max(MIN_ZOOM, zoomLevel - 20);
            applyZoom(zoomLevel);
          }}
          disabled={!isReady || zoomLevel <= MIN_ZOOM}
          title="Zoom out"
          aria-label="Zoom out"
        >
          <i class="fas fa-search-minus" aria-hidden="true"></i>
        </button>
        <input
          type="range"
          class="zoom-slider"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          value={zoomLevel}
          oninput={handleZoomChange}
          disabled={!isReady}
          title="Zoom level: {zoomLevel}px/s"
        />
        <button
          class="control-btn small"
          onclick={() => {
            zoomLevel = Math.min(MAX_ZOOM, zoomLevel + 20);
            applyZoom(zoomLevel);
          }}
          disabled={!isReady || zoomLevel >= MAX_ZOOM}
          title="Zoom in"
          aria-label="Zoom in"
        >
          <i class="fas fa-search-plus" aria-hidden="true"></i>
        </button>
        <button
          class="control-btn small"
          onclick={resetZoom}
          disabled={!isReady || zoomLevel === DEFAULT_ZOOM}
          title="Reset zoom"
          aria-label="Reset zoom"
        >
          <i class="fas fa-compress-arrows-alt" aria-hidden="true"></i>
        </button>
      </div>
    </div>

    <!-- Keyboard hints (shown when focused) -->
    {#if isFocused && isReady}
      <div class="keyboard-hints">
        <span><kbd>Space</kbd> Play/Pause</span>
        <span><kbd>←</kbd><kbd>→</kbd> Seek ±5s</span>
        <span><kbd>Ctrl</kbd>+<kbd>Scroll</kbd> Zoom</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .waveform-wrapper {
    display: flex;
    flex-direction: column;
  }

  .waveform-timeline {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    background: rgba(0, 0, 0, 0.6);
    border-radius: 8px;
    outline: none;
    border: 1px solid var(--theme-stroke-strong);
    transition: border-color var(--duration-normal) ease;
    overflow: hidden;
  }

  .waveform-timeline.focused {
    border-color: rgba(139, 92, 246, 0.5);
  }

  /* Waveform container - scrollable but hide scrollbar (minimap handles navigation) */
  .waveform-container {
    min-height: 120px;
    cursor: pointer;
    overflow-x: auto;
    overflow-y: hidden;
    /* Hide scrollbar - minimap provides better navigation */
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE/Edge */
  }

  .waveform-container::-webkit-scrollbar {
    display: none; /* Chrome/Safari/Opera */
  }

  .loading-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    background: rgba(0, 0, 0, 0.5);
    color: var(--theme-text-dim);
    font-size: 0.9rem;
  }

  .loading-overlay i {
    font-size: 1.5rem;
    color: rgba(139, 92, 246, 0.8);
  }

  /* Controls bar */
  .controls-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.5rem 0.75rem;
    background: rgba(0, 0, 0, 0.3);
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .playback-controls {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .control-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.8); /* WCAG AAA */
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .control-btn.small {
    width: 26px;
    height: 26px;
    font-size: 0.75rem;
  }

  .control-btn:hover:not(:disabled) {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.3);
  }

  .control-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .time-display {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
    font-size: 0.8rem;
    font-family: monospace;
    color: var(--theme-text);
  }

  .separator {
    color: rgba(255, 255, 255, 0.75); /* WCAG AAA */
  }

  .total {
    color: var(--theme-text-dim);
  }

  /* Zoom controls */
  .zoom-controls {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .zoom-slider {
    width: 80px;
    height: 4px;
    appearance: none;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    cursor: pointer;
  }

  .zoom-slider::-webkit-slider-thumb {
    appearance: none;
    width: 12px;
    height: 12px;
    background: rgba(139, 92, 246, 0.8);
    border-radius: 50%;
    cursor: pointer;
    transition: transform var(--duration-instant) ease;
  }

  .zoom-slider::-webkit-slider-thumb:hover {
    transform: scale(1.2);
  }

  .zoom-slider:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Keyboard hints */
  .keyboard-hints {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 0.75rem;
    padding: 0.35rem 0.5rem;
    background: rgba(0, 0, 0, 0.7);
    border-radius: 4px;
    font-size: 0.65rem;
    color: var(--theme-text-dim);
    pointer-events: none;
  }

  .keyboard-hints span {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .keyboard-hints kbd {
    padding: 0.1rem 0.3rem;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    font-family: monospace;
    font-size: 0.6rem;
  }

  /* Hide hints on small screens */
  @media (max-width: 600px) {
    .keyboard-hints {
      display: none;
    }

    .zoom-slider {
      width: 50px;
    }
  }

  /*
   * Note: Wavesurfer v7 uses Shadow DOM so scrollbar styling
   * must be done via ::part() selectors. The scrollbar is internal
   * to wavesurfer's shadow root.
   */
</style>

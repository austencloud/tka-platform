<!--
  WaveformMinimap.svelte

  Overview bar showing the full song with viewport indicator.
  Helps users orient themselves when zoomed in on the waveform.

  Features:
  - Shows full duration as a thin bar
  - Viewport rectangle shows currently visible region
  - Playhead indicator
  - Click to jump to position
  - Drag viewport to scroll
-->
<script lang="ts">
  let {
    duration,
    currentTime = 0,
    viewportStart = 0,
    viewportEnd,
    zoomLevel,
    containerWidth = 0,
    onSeek,
    onScroll,
  }: {
    duration: number;
    currentTime?: number;
    viewportStart?: number;
    viewportEnd?: number;
    zoomLevel: number;
    containerWidth?: number;
    onSeek?: (time: number) => void;
    onScroll?: (startTime: number) => void;
  } = $props();

  let minimapEl: HTMLDivElement;
  let isDragging = $state(false);
  let dragStartX = $state(0);
  let dragStartViewport = $state(0);

  // Calculate viewport as percentage of total duration
  const viewportStartPercent = $derived(
    duration > 0 ? (viewportStart / duration) * 100 : 0
  );

  // Calculate viewport width based on zoom level and container
  const viewportWidthPercent = $derived(() => {
    if (duration <= 0 || zoomLevel <= 0) return 100;

    // At default zoom (50px/s), we see containerWidth/50 seconds
    // At higher zoom, we see less of the song
    const visibleDuration = containerWidth / zoomLevel;
    const percent = (visibleDuration / duration) * 100;
    return Math.min(100, Math.max(2, percent)); // Min 2% so it's always visible
  });

  // Playhead position as percentage
  const playheadPercent = $derived(
    duration > 0 ? (currentTime / duration) * 100 : 0
  );

  // Handle click/tap on minimap to seek
  function handleClick(e: MouseEvent) {
    if (isDragging) return;

    const rect = minimapEl.getBoundingClientRect();
    const clickPercent = (e.clientX - rect.left) / rect.width;
    const seekTime = clickPercent * duration;
    onSeek?.(Math.max(0, Math.min(duration, seekTime)));
  }

  // Handle touch tap on minimap to seek (for mobile)
  function handleTouchTap(e: TouchEvent) {
    if (isDragging) return;

    const touch = e.changedTouches[0];
    if (!touch) return;

    const rect = minimapEl.getBoundingClientRect();
    const tapPercent = (touch.clientX - rect.left) / rect.width;
    const seekTime = tapPercent * duration;
    onSeek?.(Math.max(0, Math.min(duration, seekTime)));
  }

  // Calculate visible duration based on zoom
  const visibleDuration = $derived(
    containerWidth > 0 && zoomLevel > 0 ? containerWidth / zoomLevel : duration
  );

  // Start drag (mouse or touch)
  function startDrag(clientX: number) {
    isDragging = true;
    dragStartX = clientX;
    dragStartViewport = viewportStart;
  }

  // Update drag position
  function updateDrag(clientX: number) {
    if (!isDragging || !minimapEl) return;

    const rect = minimapEl.getBoundingClientRect();
    const deltaX = clientX - dragStartX;
    const deltaPercent = deltaX / rect.width;
    const deltaTime = deltaPercent * duration;

    // Calculate new scroll position, clamped to valid range
    const maxScroll = Math.max(0, duration - visibleDuration);
    const newScrollTime = Math.max(
      0,
      Math.min(maxScroll, dragStartViewport + deltaTime)
    );

    // Use onScroll for dragging viewport (scrolls waveform)
    onScroll?.(newScrollTime);
  }

  // End drag
  function endDrag() {
    isDragging = false;
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
    window.removeEventListener("touchmove", handleTouchMove);
    window.removeEventListener("touchend", handleTouchEnd);
  }

  // Mouse events
  function handleViewportMouseDown(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    startDrag(e.clientX);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  function handleMouseMove(e: MouseEvent) {
    updateDrag(e.clientX);
  }

  function handleMouseUp() {
    endDrag();
  }

  // Touch events
  function handleViewportTouchStart(e: TouchEvent) {
    e.stopPropagation();
    e.preventDefault();
    const touch = e.touches[0];
    if (touch) {
      startDrag(touch.clientX);
      window.addEventListener("touchmove", handleTouchMove, { passive: false });
      window.addEventListener("touchend", handleTouchEnd);
    }
  }

  function handleTouchMove(e: TouchEvent) {
    e.preventDefault(); // Prevent scroll while dragging
    const touch = e.touches[0];
    if (touch) {
      updateDrag(touch.clientX);
    }
  }

  function handleTouchEnd() {
    endDrag();
  }

  // Keyboard handler for accessibility
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const clickEvent = new MouseEvent("click", {
        clientX:
          minimapEl.getBoundingClientRect().left + minimapEl.offsetWidth / 2,
      });
      handleClick(clickEvent as any);
    }
  }
</script>

<div
  class="waveform-minimap"
  bind:this={minimapEl}
  onclick={handleClick}
  onkeydown={handleKeyDown}
  ontouchend={handleTouchTap}
  role="slider"
  aria-label="Song overview - click to seek"
  aria-valuemin={0}
  aria-valuemax={duration}
  aria-valuenow={currentTime}
  tabindex="0"
>
  <!-- Track background with gradient -->
  <div class="minimap-track">
    <!-- Simple waveform representation -->
    <div class="minimap-waveform"></div>

    <!-- Viewport indicator (what's currently visible) -->
    <div
      class="viewport-indicator"
      class:dragging={isDragging}
      style="left: {viewportStartPercent}%; width: {viewportWidthPercent()}%;"
      onmousedown={handleViewportMouseDown}
      ontouchstart={handleViewportTouchStart}
      role="button"
      aria-label="Visible region - drag to scroll"
      tabindex="-1"
    >
      <!-- Left edge handle -->
      <div class="viewport-edge left"></div>
      <!-- Right edge handle -->
      <div class="viewport-edge right"></div>
    </div>

    <!-- Playhead -->
    <div class="minimap-playhead" style="left: {playheadPercent}%;"></div>
  </div>
</div>

<style>
  .waveform-minimap {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.5rem 0.75rem;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid var(--theme-stroke);
    border-radius: 6px;
    cursor: pointer;
    user-select: none;
  }

  .minimap-track {
    position: relative;
    height: 24px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 3px;
    overflow: hidden;
  }

  .minimap-waveform {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      transparent 0%,
      rgba(139, 92, 246, 0.15) 30%,
      rgba(139, 92, 246, 0.25) 50%,
      rgba(139, 92, 246, 0.15) 70%,
      transparent 100%
    );
  }

  .viewport-indicator {
    position: absolute;
    top: 0;
    bottom: 0;
    background: rgba(139, 92, 246, 0.25);
    border: 1px solid rgba(139, 92, 246, 0.6);
    border-radius: 2px;
    cursor: grab;
    transition:
      background 0.15s ease,
      border-color 0.15s ease;
    min-width: 8px;
  }

  .viewport-indicator:hover {
    background: rgba(139, 92, 246, 0.35);
    border-color: rgba(139, 92, 246, 0.8);
  }

  .viewport-indicator.dragging {
    cursor: grabbing;
    background: rgba(139, 92, 246, 0.4);
    border-color: rgba(167, 139, 250, 1);
  }

  .viewport-edge {
    position: absolute;
    top: 2px;
    bottom: 2px;
    width: 3px;
    background: rgba(167, 139, 250, 0.6);
    border-radius: 1px;
    opacity: 0;
    transition: opacity var(--duration-fast, 100ms) ease;
  }

  .viewport-edge.left {
    left: 1px;
  }

  .viewport-edge.right {
    right: 1px;
  }

  .viewport-indicator:hover .viewport-edge,
  .viewport-indicator.dragging .viewport-edge {
    opacity: 1;
  }

  .minimap-playhead {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 0 4px rgba(255, 255, 255, 0.5);
    pointer-events: none;
    z-index: 2;
    transform: translateX(-50%);
  }

  @media (pointer: coarse) {
    .minimap-track {
      height: 32px;
    }

    .viewport-indicator {
      min-width: 24px;
    }

    .viewport-edge {
      width: 6px;
      opacity: 0.6;
    }
  }
</style>

<script lang="ts">
  import { getVideoTrailsContext } from "../context/video-trails-context";
  import type { DetectedEndpoint } from "../domain/types";

  interface Props {
    videoElement: HTMLVideoElement | null;
    width: number;
    height: number;
  }

  const { videoElement, width, height }: Props = $props();
  const { state: trailsState } = getVideoTrailsContext();

  const PROP_COLORS = ["#4a90d9", "#d94a4a"] as const;
  const ENDPOINT_RADIUS = 10;
  const HIT_RADIUS = 16;

  let canvasEl: HTMLCanvasElement | undefined = $state();
  let selectedIdx = $state(-1);

  // Drag state
  let dragging = $state(false);
  let dragIdx = $state(-1);
  let dragPos = $state<{ x: number; y: number } | null>(null);

  // Redraw whenever frame, endpoints, drag, or selection changes
  $effect(() => {
    const _frame = trailsState.currentFrame;
    const _endpoints = trailsState.currentEndpoints;
    const _drag = dragPos;
    const _sel = selectedIdx;
    const _w = width;
    const _h = height;
    const _video = videoElement;

    draw();
  });

  function draw(): void {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // Draw video frame as background
    if (videoElement && videoElement.readyState >= 2) {
      ctx.drawImage(videoElement, 0, 0, width, height);
    } else {
      ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
      ctx.fillRect(0, 0, width, height);
    }

    // Draw each endpoint
    const endpoints = trailsState.currentEndpoints;
    for (let i = 0; i < endpoints.length; i++) {
      const ep = endpoints[i];
      const x = dragging && dragIdx === i && dragPos ? dragPos.x : ep.x;
      const y = dragging && dragIdx === i && dragPos ? dragPos.y : ep.y;
      const isSelected = i === selectedIdx;

      drawEndpoint(ctx, x, y, ep, isSelected);
    }
  }

  function drawEndpoint(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    ep: DetectedEndpoint,
    isSelected: boolean,
  ): void {
    const color = PROP_COLORS[ep.propIndex];
    const radius = ENDPOINT_RADIUS;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);

    if (ep.confidence > 0.8) {
      // High confidence: solid fill
      ctx.fillStyle = color;
      ctx.fill();
    } else if (ep.confidence > 0.4) {
      // Medium confidence: half-opacity fill
      ctx.fillStyle = color + "80";
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      // Low confidence: outline only
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Selected ring
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Tip index label
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(ep.tipIndex), x, y);
  }

  function findEndpointAtPosition(
    px: number,
    py: number,
  ): number {
    const endpoints = trailsState.currentEndpoints;
    // Search in reverse so topmost (last drawn) is hit first
    for (let i = endpoints.length - 1; i >= 0; i--) {
      const ep = endpoints[i];
      const dx = px - ep.x;
      const dy = py - ep.y;
      if (dx * dx + dy * dy <= HIT_RADIUS * HIT_RADIUS) return i;
    }
    return -1;
  }

  function canvasCoords(e: PointerEvent): { x: number; y: number } {
    if (!canvasEl) return { x: 0, y: 0 };
    const rect = canvasEl.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * width,
      y: ((e.clientY - rect.top) / rect.height) * height,
    };
  }

  function handlePointerDown(e: PointerEvent): void {
    const pos = canvasCoords(e);
    const idx = findEndpointAtPosition(pos.x, pos.y);

    if (idx >= 0) {
      selectedIdx = idx;
      dragging = true;
      dragIdx = idx;
      dragPos = pos;
      canvasEl?.setPointerCapture(e.pointerId);
    } else {
      selectedIdx = -1;
    }
  }

  function handlePointerMove(e: PointerEvent): void {
    if (!dragging) return;
    dragPos = canvasCoords(e);
  }

  function handlePointerUp(e: PointerEvent): void {
    if (!dragging || dragIdx < 0 || !dragPos) {
      dragging = false;
      dragIdx = -1;
      dragPos = null;
      return;
    }

    const ep = trailsState.currentEndpoints[dragIdx];
    if (ep) {
      trailsState.correctEndpoint(trailsState.currentFrame, {
        propIndex: ep.propIndex,
        tipIndex: ep.tipIndex,
        detected: { x: ep.x, y: ep.y, confidence: ep.confidence },
        corrected: { x: dragPos.x, y: dragPos.y },
        status: "corrected",
      });
    }

    canvasEl?.releasePointerCapture(e.pointerId);
    dragging = false;
    dragIdx = -1;
    dragPos = null;
  }

  function handleKeydown(e: KeyboardEvent): void {
    const endpoints = trailsState.currentEndpoints;
    if (endpoints.length === 0) return;

    if (e.key === "Tab") {
      e.preventDefault();
      if (endpoints.length > 0) {
        selectedIdx = (selectedIdx + 1) % endpoints.length;
      }
      return;
    }

    if (selectedIdx < 0 || selectedIdx >= endpoints.length) return;
    const ep = endpoints[selectedIdx];

    const nudge = e.shiftKey ? 5 : 1;

    if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowLeft") dx = -nudge;
      if (e.key === "ArrowRight") dx = nudge;
      if (e.key === "ArrowUp") dy = -nudge;
      if (e.key === "ArrowDown") dy = nudge;

      trailsState.correctEndpoint(trailsState.currentFrame, {
        propIndex: ep.propIndex,
        tipIndex: ep.tipIndex,
        detected: { x: ep.x, y: ep.y, confidence: ep.confidence },
        corrected: { x: ep.x + dx, y: ep.y + dy },
        status: "corrected",
      });
      return;
    }

    if (e.key === "o" || e.key === "O") {
      e.preventDefault();
      trailsState.markOccluded(
        trailsState.currentFrame,
        ep.propIndex,
        ep.tipIndex,
      );
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      // Accept current endpoint and advance to next frame
      trailsState.correctEndpoint(trailsState.currentFrame, {
        propIndex: ep.propIndex,
        tipIndex: ep.tipIndex,
        detected: { x: ep.x, y: ep.y, confidence: ep.confidence },
        corrected: null,
        status: "accepted",
      });
      if (trailsState.currentFrame < trailsState.totalFrames - 1) {
        trailsState.setCurrentFrame(trailsState.currentFrame + 1);
      }
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="endpoint-editor"
  onkeydown={handleKeydown}
  tabindex="0"
  role="application"
  aria-label="Endpoint editor canvas. Tab to cycle endpoints, arrows to nudge, O to mark occluded, Enter to accept."
>
  <canvas
    bind:this={canvasEl}
    {width}
    {height}
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
  ></canvas>

  <div class="editor-hints">
    <span class="hint">Tab: cycle</span>
    <span class="hint">Arrows: nudge</span>
    <span class="hint">O: occluded</span>
    <span class="hint">Enter: accept + next</span>
  </div>
</div>

<style>
  .endpoint-editor {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .endpoint-editor:focus-visible {
    outline: 2px solid var(--theme-accent, #f43f5e);
    outline-offset: 2px;
    border-radius: 4px;
  }

  canvas {
    display: block;
    border-radius: 6px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    pointer-events: auto;
    touch-action: none;
    max-width: 100%;
    height: auto;
  }

  .editor-hints {
    display: flex;
    gap: 10px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .hint {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    padding: 2px 6px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 3px;
    white-space: nowrap;
  }
</style>

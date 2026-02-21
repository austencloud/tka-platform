<!--
  FirePointSvgCanvas.svelte

  Interactive SVG viewer: renders the prop shape, displays fire point
  markers, supports click-to-add and drag-to-reposition.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { PROP_DIMENSIONS, DEFAULT_PROP_DIMENSIONS, type PropDimensions } from "$lib/shared/animation-engine/services/contracts/IPropTextureLoader";
  import type { FirePointEditorState } from "../state/fire-point-editor-state.svelte";

  interface Props {
    editorState: FirePointEditorState;
  }

  const { editorState }: Props = $props();

  let svgEl: SVGSVGElement | undefined = $state();
  let propSvgContent = $state("");
  let hoverCoords = $state<{ dx: number; dy: number } | null>(null);

  // Drag origin for shift-constraint axis locking
  let dragOrigin = $state<{ dx: number; dy: number } | null>(null);
  let constraintAxis = $state<"h" | "v" | null>(null);

  const PADDING = 60;
  const POINT_MIN_RADIUS = 8;
  const POINT_MAX_RADIUS = 20;
  /** Pixels of drag before axis lock engages */
  const AXIS_LOCK_THRESHOLD = 5;
  /** Arrow key nudge amount (prop-local units) */
  const NUDGE_STEP = 1;
  /** Shift+Arrow nudge amount (larger steps) */
  const NUDGE_STEP_LARGE = 10;

  let dims = $derived<PropDimensions>(
    PROP_DIMENSIONS[editorState.selectedPropType.toLowerCase()] ?? DEFAULT_PROP_DIMENSIONS
  );

  let viewBoxWidth = $derived(dims.width + PADDING * 2);
  let viewBoxHeight = $derived(dims.height + PADDING * 2);

  // Load the prop SVG inline when prop type changes
  $effect(() => {
    const propType = editorState.selectedPropType;
    loadPropSvg(propType);
  });

  async function loadPropSvg(propType: string) {
    try {
      const resp = await fetch(`/images/props/animated/${propType}.svg`);
      if (!resp.ok) {
        propSvgContent = "";
        return;
      }
      const text = await resp.text();
      // Extract inner SVG content (strip outer <svg> wrapper)
      const match = text.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
      propSvgContent = match?.[1] ?? text;
    } catch {
      propSvgContent = "";
    }
  }

  function svgPointFromEvent(e: MouseEvent): { dx: number; dy: number } | null {
    if (!svgEl) return null;
    const ctm = svgEl.getScreenCTM();
    if (!ctm) return null;
    const inv = ctm.inverse();
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(inv);
    // Convert from viewBox coords (prop centered in viewBox) to prop-local coords
    const centerX = viewBoxWidth / 2;
    const centerY = viewBoxHeight / 2;
    const dx = Math.round((pt.x - centerX) * 10) / 10;
    const dy = Math.round((pt.y - centerY) * 10) / 10;
    return { dx, dy };
  }

  function handleCanvasClick(e: MouseEvent) {
    if (editorState.isDragging) return;
    const target = e.target as Element;
    // Don't add point if clicking on an existing point marker
    if (target.closest(".fire-point-marker")) return;
    const coords = svgPointFromEvent(e);
    if (!coords) return;
    editorState.addPoint(coords.dx, coords.dy);
  }

  function handlePointMouseDown(e: MouseEvent, index: number) {
    e.preventDefault();
    e.stopPropagation();
    editorState.beginDrag(index);

    // Anchor to the point's actual position, not where the mouse landed
    const point = editorState.points[index];
    if (!point) return;
    const origin = { dx: point.dx, dy: point.dy };
    dragOrigin = origin;
    constraintAxis = null;

    // Track mouse origin separately for computing drag delta
    const mouseOrigin = svgPointFromEvent(e);

    const onMove = (moveEvent: MouseEvent) => {
      const coords = svgPointFromEvent(moveEvent);
      if (!coords || !mouseOrigin) return;

      // Shift-constrained drag: lock to dominant axis
      if (moveEvent.shiftKey) {
        const deltaX = Math.abs(coords.dx - mouseOrigin.dx);
        const deltaY = Math.abs(coords.dy - mouseOrigin.dy);

        // Determine axis once mouse drag exceeds threshold
        if (!constraintAxis && (deltaX > AXIS_LOCK_THRESHOLD || deltaY > AXIS_LOCK_THRESHOLD)) {
          constraintAxis = deltaX >= deltaY ? "h" : "v";
        }

        // Freeze the point until axis is determined (no drift)
        if (!constraintAxis) return;

        // Apply mouse delta to point's original position along the unlocked axis only
        const mouseDx = coords.dx - mouseOrigin.dx;
        const mouseDy = coords.dy - mouseOrigin.dy;

        if (constraintAxis === "h") {
          editorState.updatePointPosition(index, origin.dx + mouseDx, origin.dy);
        } else {
          editorState.updatePointPosition(index, origin.dx, origin.dy + mouseDy);
        }
      } else {
        // Unconstrained: apply mouse delta to point's original position
        constraintAxis = null;
        const mouseDx = coords.dx - mouseOrigin.dx;
        const mouseDy = coords.dy - mouseOrigin.dy;
        editorState.updatePointPosition(index, origin.dx + mouseDx, origin.dy + mouseDy);
      }
    };

    const onUp = () => {
      editorState.endDrag();
      dragOrigin = null;
      constraintAxis = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleCanvasMouseMove(e: MouseEvent) {
    const coords = svgPointFromEvent(e);
    hoverCoords = coords;
  }

  function handleCanvasMouseLeave() {
    hoverCoords = null;
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (editorState.selectedPointIndex < 0) return;
    const idx = editorState.selectedPointIndex;
    const point = editorState.points[idx];
    if (!point) return;

    const step = e.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP;
    let dx = point.dx;
    let dy = point.dy;
    let handled = false;

    switch (e.key) {
      case "ArrowLeft":
        dx -= step;
        handled = true;
        break;
      case "ArrowRight":
        dx += step;
        handled = true;
        break;
      case "ArrowUp":
        dy -= step;
        handled = true;
        break;
      case "ArrowDown":
        dy += step;
        handled = true;
        break;
    }

    if (handled) {
      e.preventDefault();
      // Round to 1 decimal place to avoid float drift
      dx = Math.round(dx * 10) / 10;
      dy = Math.round(dy * 10) / 10;
      editorState.updatePoint(idx, { dx, dy });
    }
  }

  function pointRadius(flameScale: number): number {
    return Math.max(POINT_MIN_RADIUS, Math.min(POINT_MAX_RADIUS, flameScale * 12));
  }

  onMount(() => {
    loadPropSvg(editorState.selectedPropType);
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="svg-canvas-wrapper" tabindex="0" onkeydown={handleKeyDown}>
  <svg
    bind:this={svgEl}
    class="editor-svg"
    viewBox="0 0 {viewBoxWidth} {viewBoxHeight}"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Fire point editor canvas for {editorState.selectedPropType}"
    onclick={handleCanvasClick}
    onmousemove={handleCanvasMouseMove}
    onmouseleave={handleCanvasMouseLeave}
  >
    <!-- Background grid -->
    <defs>
      <pattern id="editor-grid" width="50" height="50" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="0" y2="50" stroke="rgba(255,255,255,0.04)" stroke-width="0.5" />
        <line x1="0" y1="0" x2="50" y2="0" stroke="rgba(255,255,255,0.04)" stroke-width="0.5" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#editor-grid)" />

    <!-- Origin crosshair -->
    <g class="origin-crosshair" transform="translate({viewBoxWidth / 2}, {viewBoxHeight / 2})">
      <line x1="-20" y1="0" x2="20" y2="0" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="4,3" />
      <line x1="0" y1="-20" x2="0" y2="20" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="4,3" />
      <circle r="3" fill="rgba(255,255,255,0.2)" />
    </g>

    <!-- Prop shape (centered in viewBox) -->
    <g
      class="prop-shape"
      transform="translate({(viewBoxWidth - dims.width) / 2}, {(viewBoxHeight - dims.height) / 2})"
      opacity="0.6"
    >
      {@html propSvgContent}
    </g>

    <!-- Fire point markers -->
    {#each editorState.points as point, i (i)}
      {@const cx = viewBoxWidth / 2 + point.dx}
      {@const cy = viewBoxHeight / 2 + point.dy}
      {@const r = pointRadius(point.flameScale)}
      {@const isSelected = editorState.selectedPointIndex === i}
      <g
        class="fire-point-marker"
        class:selected={isSelected}
        transform="translate({cx}, {cy})"
        onmousedown={(e) => handlePointMouseDown(e, i)}
        onclick={(e) => { e.stopPropagation(); editorState.selectedPointIndex = i; }}
        role="button"
        tabindex="0"
        aria-label="Fire point {i + 1}: dx={point.dx}, dy={point.dy}, scale={point.flameScale}"
      >
        <!-- Glow ring for selected -->
        {#if isSelected}
          <circle r={r + 4} fill="none" stroke="#f97316" stroke-width="2" opacity="0.5" />
        {/if}
        <!-- Main circle -->
        <circle r={r} fill="rgba(249, 115, 22, 0.4)" stroke="#f97316" stroke-width="1.5" />
        <!-- Inner dot -->
        <circle r="2.5" fill="#f97316" />
        <!-- Point number -->
        <text
          y={-r - 8}
          text-anchor="middle"
          fill="rgba(255,255,255,0.8)"
          font-size="14"
          font-weight="600"
        >
          {i + 1}
        </text>
      </g>
    {/each}
  </svg>

  <!-- Coordinate readout -->
  {#if hoverCoords}
    <div class="coord-readout">
      dx: {hoverCoords.dx.toFixed(1)}, dy: {hoverCoords.dy.toFixed(1)}
    </div>
  {/if}

  <div class="canvas-hint">
    Click to add. Drag to move. Shift+drag to constrain axis. Arrow keys to nudge.
  </div>
</div>

<style>
  .svg-canvas-wrapper {
    position: relative;
    flex: 1;
    min-height: 0;
    background: #0a0a0f;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-lg, 12px);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .svg-canvas-wrapper:focus {
    outline: 2px solid rgba(249, 115, 22, 0.5);
    outline-offset: -2px;
  }

  .editor-svg {
    width: 100%;
    height: 100%;
    cursor: crosshair;
  }

  .fire-point-marker {
    cursor: grab;
  }

  .fire-point-marker:active {
    cursor: grabbing;
  }

  .coord-readout {
    position: absolute;
    top: 10px;
    right: 10px;
    padding: 6px 12px;
    background: rgba(0, 0, 0, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: var(--border-radius-md, 8px);
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    pointer-events: none;
  }

  .canvas-hint {
    position: absolute;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
    padding: 6px 16px;
    background: rgba(0, 0, 0, 0.65);
    border-radius: 9999px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    pointer-events: none;
    white-space: nowrap;
  }

  /* Prop SVG shapes should be white/light for dark background */
  .prop-shape :global(path),
  .prop-shape :global(rect),
  .prop-shape :global(ellipse),
  .prop-shape :global(circle),
  .prop-shape :global(polygon) {
    fill: rgba(255, 255, 255, 0.3);
    stroke: rgba(255, 255, 255, 0.5);
    stroke-width: 1;
  }
</style>

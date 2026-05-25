<script lang="ts">
  import { getContext, onMount } from "svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import type {
    MandalaElement,
    TransformedElement,
    Point,
  } from "../../domain/models/mandala-element";
  import type { MandalaConfig } from "../../domain/models/mandala-config";
  import { generateKaleidoscopePattern } from "../../services/mandala-transformer";
  import {
    CANVAS_SIZE,
    CANVAS_CENTER,
  } from "../../domain/constants/symmetry-constants";
  import { mandalaState } from "../../state/mandala-state.svelte";
  import GridDotOverlay from "./GridDotOverlay.svelte";
  import MandalaElementView from "./MandalaElementView.svelte";

  interface Props {
    onElementSelect?: (id: string | null) => void;
    onElementMove?: (id: string, position: Point) => void;
    onCanvasClick?: (position: Point) => void;
  }

  let { onElementSelect, onElementMove, onCanvasClick }: Props = $props();

  let canvasContainer: HTMLDivElement;
  let isDragging = false;
  let dragElementId: string | null = null;
  let dragOffset: Point = { x: 0, y: 0 };

  // External drop preview state
  let isExternalDragOver = $state(false);
  let externalDragPosition = $state<Point | null>(null);
  let externalDragData = $state<{
    type: string;
    motionType: string;
    turns: number | null;
    color: string;
    path: string;
  } | null>(null);

  // State bindings
  const elements = $derived(mandalaState.elements);
  const config = $derived(mandalaState.config);
  const selectedElementId = $derived(mandalaState.selectedElementId);
  const hoveredElementId = $derived(mandalaState.hoveredElementId);

  // Compute transformed elements (symmetry copies)
  const transformedElements = $derived.by(() => {
    if (elements.length === 0) return [];

    const allTransformed: TransformedElement[] = [];
    for (const element of elements) {
      const transformed = generateKaleidoscopePattern(element, config);
      // Skip the original (foldIndex 0, not mirrored) - we render source elements separately
      const copies = transformed.filter((t) => t.foldIndex > 0 || t.isMirrored);
      allTransformed.push(...copies);
    }
    return allTransformed;
  });

  // Convert screen coordinates to SVG coordinates
  function screenToSvg(clientX: number, clientY: number): Point {
    if (!canvasContainer) return { x: 0, y: 0 };

    const rect = canvasContainer.getBoundingClientRect();
    const scaleX = CANVAS_SIZE / rect.width;
    const scaleY = CANVAS_SIZE / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  function handleCanvasClick(event: MouseEvent) {
    if (isDragging) return;

    // Check if we clicked on empty space
    const target = event.target as Element;
    if (target.closest(".mandala-element")) return;

    const position = screenToSvg(event.clientX, event.clientY);
    onCanvasClick?.(position);

    // Deselect if clicking empty space
    onElementSelect?.(null);
    mandalaState.setSelectedElementId(null);
  }

  function handleElementSelect(id: string) {
    onElementSelect?.(id);
    mandalaState.setSelectedElementId(id);
  }

  function handleElementHover(id: string | null) {
    mandalaState.setHoveredElementId(id);
  }

  function handleDragStart(id: string, event: PointerEvent) {
    const element = elements.find((e) => e.id === id);
    if (!element) return;

    isDragging = true;
    dragElementId = id;
    mandalaState.setDragMode("move");

    const svgPos = screenToSvg(event.clientX, event.clientY);
    dragOffset = {
      x: svgPos.x - element.position.x,
      y: svgPos.y - element.position.y,
    };

    // Capture pointer for smooth dragging
    (event.target as Element).setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent) {
    if (!isDragging || !dragElementId) return;

    const position = screenToSvg(event.clientX, event.clientY);
    const newPosition = {
      x: position.x - dragOffset.x,
      y: position.y - dragOffset.y,
    };

    onElementMove?.(dragElementId, newPosition);
    mandalaState.updateElement(dragElementId, { position: newPosition });
  }

  function handlePointerUp(event: PointerEvent) {
    if (isDragging) {
      // Commit to history when drag ends
      mandalaState.pushHistory();
    }

    isDragging = false;
    dragElementId = null;
    mandalaState.setDragMode("none");

    (event.target as Element).releasePointerCapture?.(event.pointerId);
  }

  // External drag and drop handlers (from asset library)
  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    event.dataTransfer!.dropEffect = "copy";

    isExternalDragOver = true;
    externalDragPosition = screenToSvg(event.clientX, event.clientY);

    // Try to parse the drag data for preview
    if (!externalDragData) {
      try {
        const jsonData = event.dataTransfer?.types.includes("application/json");
        if (jsonData) {
          // We can't read the data during dragover, just show generic preview
        }
      } catch (e) {
        // Ignore
      }
    }
  }

  function handleDragLeave(event: DragEvent) {
    // Only clear if we're actually leaving the container
    const relatedTarget = event.relatedTarget as Element | null;
    if (!canvasContainer?.contains(relatedTarget)) {
      isExternalDragOver = false;
      externalDragPosition = null;
      externalDragData = null;
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isExternalDragOver = false;

    const dropPosition = screenToSvg(event.clientX, event.clientY);

    try {
      const jsonStr = event.dataTransfer?.getData("application/json");
      if (jsonStr) {
        const data = JSON.parse(jsonStr);
        if (data.type === "arrow") {
          // Add the arrow element with SVG content from drag data
          mandalaState.addElement({
            id: crypto.randomUUID(),
            type: "arrow",
            arrowSpec: {
              motionType: data.motionType,
              turns: data.turns,
            },
            position: dropPosition,
            rotation: 0,
            scale: 1,
            color: data.color,
            zIndex: mandalaState.elements.length,
            // Include SVG data for proper rendering
            svgContent: data.svgContent,
            viewBox: data.viewBox,
            center: data.center,
          });
        } else if (data.type === "staff") {
          mandalaState.addElement({
            id: crypto.randomUUID(),
            type: "staff",
            staffSpec: {
              variant: "simple",
            },
            position: dropPosition,
            rotation: 0,
            scale: 1,
            color: data.color,
            zIndex: mandalaState.elements.length,
            // Include SVG data for proper rendering
            svgContent: data.svgContent,
            viewBox: data.viewBox,
            center: data.center,
          });
        }
      }
    } catch (e) {
      console.error("Failed to parse drop data:", e);
    }

    externalDragPosition = null;
    externalDragData = null;
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<!-- Mandala Canvas: ARIA "application" role widget - requires tabindex & event handlers per WAI-ARIA spec -->
<div
  class="mandala-canvas-container"
  class:drag-over={isExternalDragOver}
  bind:this={canvasContainer}
  onclick={handleCanvasClick}
  onkeydown={(e) => {
    if (e.key === "Escape") {
      onElementSelect?.(null);
      mandalaState.setSelectedElementId(null);
    }
  }}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerUp}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  role="application"
  tabindex="0"
  aria-label={t('mandala_canvas_aria')}
>
  <svg
    class="mandala-canvas"
    viewBox="0 0 {CANVAS_SIZE} {CANVAS_SIZE}"
    aria-hidden="true"
  >
    <!-- Background -->
    <rect
      x="0"
      y="0"
      width={CANVAS_SIZE}
      height={CANVAS_SIZE}
      fill="var(--theme-panel-bg, #0a0a14)"
    />

    <!-- Symmetry guide lines (subtle) -->
    <g class="symmetry-guides" opacity="0.1">
      {#each Array(config.foldCount) as _, i}
        {@const angle = (360 / config.foldCount) * i}
        <line
          x1={CANVAS_CENTER.x}
          y1={CANVAS_CENTER.y}
          x2={CANVAS_CENTER.x +
            Math.cos(((angle - 90) * Math.PI) / 180) * (CANVAS_SIZE / 2)}
          y2={CANVAS_CENTER.y +
            Math.sin(((angle - 90) * Math.PI) / 180) * (CANVAS_SIZE / 2)}
          stroke="var(--theme-text, white)"
          stroke-width="1"
        />
      {/each}
    </g>

    <!-- Grid dots overlay -->
    {#if config.showGridDots}
      <GridDotOverlay
        showIntercardinal={true}
        dotColor="var(--theme-text, white)"
        dotOpacity={0.2}
      />
    {/if}

    <!-- Transformed elements (symmetry copies - rendered as ghosts) -->
    {#each transformedElements as transformed (transformed.sourceId + "-" + transformed.foldIndex + "-" + transformed.isMirrored)}
      <MandalaElementView
        element={{
          id: `${transformed.sourceId}-copy-${transformed.foldIndex}-${transformed.isMirrored}`,
          type: "arrow",
          position: transformed.position,
          rotation: transformed.rotation,
          scale: transformed.scale,
          color:
            elements.find((e) => e.id === transformed.sourceId)?.color ??
            "#ffffff",
          svgContent: transformed.svgContent,
          zIndex: 0,
        }}
        isGhost={true}
      />
    {/each}

    <!-- Source elements (user-placed, interactive) -->
    {#each elements as element (element.id)}
      <MandalaElementView
        {element}
        isSelected={selectedElementId === element.id}
        isHovered={hoveredElementId === element.id}
        onSelect={handleElementSelect}
        onHover={handleElementHover}
        onDragStart={handleDragStart}
      />
    {/each}

    <!-- Drop preview indicator -->
    {#if isExternalDragOver && externalDragPosition}
      <g class="drop-preview" pointer-events="none">
        <!-- Crosshair indicator showing exact drop position -->
        <circle
          cx={externalDragPosition.x}
          cy={externalDragPosition.y}
          r="30"
          fill="var(--theme-accent, #4a9eff)"
          fill-opacity="0.2"
          stroke="var(--theme-accent, #4a9eff)"
          stroke-width="2"
          stroke-dasharray="5,5"
        />
        <line
          x1={externalDragPosition.x - 20}
          y1={externalDragPosition.y}
          x2={externalDragPosition.x + 20}
          y2={externalDragPosition.y}
          stroke="var(--theme-accent, #4a9eff)"
          stroke-width="1.5"
        />
        <line
          x1={externalDragPosition.x}
          y1={externalDragPosition.y - 20}
          x2={externalDragPosition.x}
          y2={externalDragPosition.y + 20}
          stroke="var(--theme-accent, #4a9eff)"
          stroke-width="1.5"
        />
      </g>
    {/if}
  </svg>

  <!-- Canvas info overlay -->
  <div class="canvas-info">
    <span class="info-label">{t('mandala_n_fold', { count: String(config.foldCount) })}</span>
    {#if config.enableMirror}
      <span class="info-label">{t('mandala_mirror_label', { axis: config.mirrorAxis })}</span>
    {/if}
    <span class="info-label">{t('mandala_element_count', { count: String(elements.length) })}</span>
  </div>
</div>

<style>
  .mandala-canvas-container {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    background: var(--theme-panel-bg, #0a0a14);
    border-radius: var(--settings-radius-md, 8px);
    overflow: hidden;
    touch-action: none;
    border: 2px solid transparent;
    transition: border-color var(--duration-fast) ease;
  }

  .mandala-canvas-container.drag-over {
    border-color: var(--theme-accent, #4a9eff);
  }

  .mandala-canvas {
    display: block;
    width: 100%;
    height: 100%;
  }

  .symmetry-guides {
    pointer-events: none;
  }

  .canvas-info {
    position: absolute;
    bottom: 8px;
    left: 8px;
    display: flex;
    gap: 8px;
    pointer-events: none;
  }

  .info-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    background: rgba(0, 0, 0, 0.4);
    padding: 2px 6px;
    border-radius: 4px;
  }

  /* Drop preview animation */
  .drop-preview circle {
    animation: pulse-ring 1s ease-in-out infinite;
  }

  @keyframes pulse-ring {
    0%,
    100% {
      r: 30;
      fill-opacity: 0.2;
    }
    50% {
      r: 35;
      fill-opacity: 0.3;
    }
  }

</style>

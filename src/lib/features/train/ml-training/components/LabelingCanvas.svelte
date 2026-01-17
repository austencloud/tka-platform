<!--
LabelingCanvas.svelte

Interactive canvas for labeling props in captured frames.
Supports:
- Bounding box drawing
- Head direction selection (8-way)
- Hand assignment (left=blue, right=red)
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type {
    BoundingBox,
    Point,
    PropAnnotation,
    HeadDirection,
    PropHand,
    PropType,
  } from "../domain/models";

  interface Props {
    imageUrl: string;
    frameId: string;
    propType: PropType;
    existingAnnotations?: PropAnnotation[];
    onAnnotationChange?: (annotations: PropAnnotation[]) => void;
  }

  let {
    imageUrl,
    frameId,
    propType,
    existingAnnotations = [],
    onAnnotationChange,
  }: Props = $props();

  // Canvas refs
  let containerRef: HTMLDivElement;
  let canvasRef: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;

  // Image state
  let image: HTMLImageElement | null = $state(null);
  let imageLoaded = $state(false);
  let canvasWidth = $state(640);
  let canvasHeight = $state(480);

  // Drawing state
  type DrawingMode = "idle" | "drawing-box" | "selecting-direction";
  let mode = $state<DrawingMode>("idle");
  let isDrawing = $state(false);
  let startPoint = $state<Point | null>(null);
  let currentPoint = $state<Point | null>(null);
  let currentBox = $state<BoundingBox | null>(null);

  // Annotation state - initialized empty, synced from existingAnnotations via $effect below
  let annotations = $state<PropAnnotation[]>([]);
  let selectedAnnotationId = $state<string | null>(null);
  let pendingHand = $state<PropHand>("left"); // Default hand for new annotations

  // Direction picker state
  let directionPickerPos = $state<{ x: number; y: number } | null>(null);
  let pendingBox = $state<BoundingBox | null>(null);

  // Direction angles (for drawing arrows)
  const DIRECTIONS: { dir: HeadDirection; angle: number }[] = [
    { dir: "N", angle: -90 },
    { dir: "NE", angle: -45 },
    { dir: "E", angle: 0 },
    { dir: "SE", angle: 45 },
    { dir: "S", angle: 90 },
    { dir: "SW", angle: 135 },
    { dir: "W", angle: 180 },
    { dir: "NW", angle: -135 },
  ];

  function generateId(): string {
    return `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Convert canvas coordinates to normalized (0-1)
  function toNormalized(x: number, y: number): Point {
    return {
      x: x / canvasWidth,
      y: y / canvasHeight,
    };
  }

  // Convert normalized coordinates to canvas
  function toCanvas(p: Point): { x: number; y: number } {
    return {
      x: p.x * canvasWidth,
      y: p.y * canvasHeight,
    };
  }

  // Convert normalized bbox to canvas
  function bboxToCanvas(box: BoundingBox): {
    x: number;
    y: number;
    w: number;
    h: number;
  } {
    return {
      x: box.x * canvasWidth,
      y: box.y * canvasHeight,
      w: box.width * canvasWidth,
      h: box.height * canvasHeight,
    };
  }

  function loadImage() {
    image = new Image();
    image.onload = () => {
      imageLoaded = true;
      redraw();
    };
    image.src = imageUrl;
  }

  function redraw() {
    if (!ctx || !image || !imageLoaded) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Draw image
    ctx.drawImage(image, 0, 0, canvasWidth, canvasHeight);

    // Draw existing annotations
    for (const ann of annotations) {
      drawAnnotation(ann, ann.id === selectedAnnotationId);
    }

    // Draw current drawing box
    if (isDrawing && currentBox) {
      drawBox(currentBox, "#fff", true);
    }
  }

  function drawAnnotation(ann: PropAnnotation, selected: boolean) {
    if (!ctx) return;

    const color =
      ann.hand === "left" ? "var(--semantic-info)" : "var(--semantic-error)"; // Blue for left, red for right (hardcoded for canvas)
    const box = bboxToCanvas(ann.boundingBox);

    // Draw bounding box
    ctx.strokeStyle = color;
    ctx.lineWidth = selected ? 3 : 2;
    ctx.setLineDash(selected ? [] : [5, 5]);
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    ctx.setLineDash([]);

    // Draw hand label
    ctx.fillStyle = color;
    ctx.font = "bold 14px sans-serif";
    const label = ann.hand === "left" ? "L (Blue)" : "R (Red)";
    ctx.fillText(label, box.x + 4, box.y - 6);

    // Draw direction arrow
    const centerX = box.x + box.w / 2;
    const centerY = box.y + box.h / 2;
    const arrowLength = Math.min(box.w, box.h) * 0.3;

    const dirInfo = DIRECTIONS.find((d) => d.dir === ann.headDirection);
    if (dirInfo) {
      const angle = (dirInfo.angle * Math.PI) / 180;
      const endX = centerX + Math.cos(angle) * arrowLength;
      const endY = centerY + Math.sin(angle) * arrowLength;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Arrow head
      const headLength = 10;
      const headAngle = Math.PI / 6;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - headLength * Math.cos(angle - headAngle),
        endY - headLength * Math.sin(angle - headAngle)
      );
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - headLength * Math.cos(angle + headAngle),
        endY - headLength * Math.sin(angle + headAngle)
      );
      ctx.stroke();

      // Direction label
      ctx.fillStyle = "#fff";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText(ann.headDirection, endX + 8, endY + 5);
    }
  }

  function drawBox(box: BoundingBox, color: string, dashed: boolean = false) {
    if (!ctx) return;

    const b = bboxToCanvas(box);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    if (dashed) ctx.setLineDash([5, 5]);
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.setLineDash([]);
  }

  function handleMouseDown(e: MouseEvent) {
    if (mode === "selecting-direction") return;

    const rect = canvasRef.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const normalized = toNormalized(x, y);

    // Check if clicking on existing annotation
    const clicked = findAnnotationAt(normalized);
    if (clicked) {
      selectedAnnotationId = clicked.id;
      redraw();
      return;
    }

    // Start drawing new box
    selectedAnnotationId = null;
    isDrawing = true;
    startPoint = normalized;
    currentPoint = normalized;
    mode = "drawing-box";
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDrawing || mode !== "drawing-box") return;

    const rect = canvasRef.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    currentPoint = toNormalized(x, y);

    if (startPoint && currentPoint) {
      currentBox = {
        x: Math.min(startPoint.x, currentPoint.x),
        y: Math.min(startPoint.y, currentPoint.y),
        width: Math.abs(currentPoint.x - startPoint.x),
        height: Math.abs(currentPoint.y - startPoint.y),
      };
    }

    redraw();
  }

  function handleMouseUp(e: MouseEvent) {
    if (!isDrawing || !currentBox) {
      isDrawing = false;
      return;
    }

    // Minimum size check
    if (currentBox.width < 0.02 || currentBox.height < 0.02) {
      isDrawing = false;
      currentBox = null;
      mode = "idle";
      redraw();
      return;
    }

    isDrawing = false;

    // Show direction picker
    const rect = canvasRef.getBoundingClientRect();
    const boxCanvas = bboxToCanvas(currentBox);
    directionPickerPos = {
      x: rect.left + boxCanvas.x + boxCanvas.w / 2,
      y: rect.top + boxCanvas.y + boxCanvas.h / 2,
    };
    pendingBox = currentBox;
    currentBox = null;
    mode = "selecting-direction";

    redraw();
  }

  function selectDirection(dir: HeadDirection) {
    if (!pendingBox) return;

    const newAnnotation: PropAnnotation = {
      id: generateId(),
      frameId,
      boundingBox: pendingBox,
      propType,
      hand: pendingHand,
      headDirection: dir,
      verified: false,
    };

    annotations = [...annotations, newAnnotation];
    onAnnotationChange?.(annotations);

    // Toggle hand for next annotation
    pendingHand = pendingHand === "left" ? "right" : "left";

    // Reset state
    directionPickerPos = null;
    pendingBox = null;
    mode = "idle";

    redraw();
  }

  function cancelDirectionPicker() {
    directionPickerPos = null;
    pendingBox = null;
    mode = "idle";
    redraw();
  }

  function findAnnotationAt(p: Point): PropAnnotation | null {
    // Find annotation that contains point (reverse order for top-most)
    for (let i = annotations.length - 1; i >= 0; i--) {
      const ann = annotations[i];
      if (!ann) continue;
      const box = ann.boundingBox;
      if (
        p.x >= box.x &&
        p.x <= box.x + box.width &&
        p.y >= box.y &&
        p.y <= box.y + box.height
      ) {
        return ann;
      }
    }
    return null;
  }

  function deleteSelectedAnnotation() {
    if (!selectedAnnotationId) return;

    annotations = annotations.filter((a) => a.id !== selectedAnnotationId);
    selectedAnnotationId = null;
    onAnnotationChange?.(annotations);
    redraw();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Delete" || e.key === "Backspace") {
      deleteSelectedAnnotation();
    } else if (e.key === "Escape") {
      if (mode === "selecting-direction") {
        cancelDirectionPicker();
      } else {
        selectedAnnotationId = null;
        redraw();
      }
    }
  }

  // Update annotations when prop changes
  $effect(() => {
    annotations = [...existingAnnotations];
    redraw();
  });

  // Redraw when image URL changes
  $effect(() => {
    if (imageUrl) {
      imageLoaded = false;
      loadImage();
    }
  });

  onMount(() => {
    ctx = canvasRef.getContext("2d");

    // Size canvas to container
    const updateSize = () => {
      if (containerRef) {
        const rect = containerRef.getBoundingClientRect();
        // Maintain 4:3 aspect ratio
        const aspectRatio = 4 / 3;
        let width = rect.width;
        let height = width / aspectRatio;

        if (height > rect.height) {
          height = rect.height;
          width = height * aspectRatio;
        }

        canvasWidth = Math.floor(width);
        canvasHeight = Math.floor(height);
        redraw();
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);

    loadImage();

    return () => {
      window.removeEventListener("resize", updateSize);
    };
  });
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="labeling-canvas" bind:this={containerRef}>
  <canvas
    bind:this={canvasRef}
    width={canvasWidth}
    height={canvasHeight}
    onmousedown={handleMouseDown}
    onmousemove={handleMouseMove}
    onmouseup={handleMouseUp}
    onmouseleave={() => {
      if (isDrawing) handleMouseUp(new MouseEvent("mouseup"));
    }}
  ></canvas>

  <!-- Direction Picker Popup -->
  {#if mode === "selecting-direction" && directionPickerPos}
    <div
      class="direction-picker"
      style="left: {directionPickerPos.x}px; top: {directionPickerPos.y}px;"
    >
      <div class="picker-title">
        <span>Head Direction</span>
        <span class="hand-indicator {pendingHand}">
          {pendingHand === "left" ? "🔵 Left" : "🔴 Right"}
        </span>
      </div>
      <div class="direction-grid">
        {#each DIRECTIONS as { dir }}
          <button
            class="direction-btn"
            onclick={() => selectDirection(dir)}
            title={dir}
          >
            {dir}
          </button>
        {/each}
      </div>
      <div class="picker-actions">
        <button
          class="btn-toggle-hand"
          onclick={() =>
            (pendingHand = pendingHand === "left" ? "right" : "left")}
        >
          Toggle Hand
        </button>
        <button class="btn-cancel" onclick={cancelDirectionPicker}
          >Cancel</button
        >
      </div>
    </div>
  {/if}

  <!-- Toolbar -->
  <div class="toolbar">
    <div class="tool-group">
      <span class="hand-selector">
        Next hand:
        <button
          class="hand-btn {pendingHand === 'left' ? 'active' : ''}"
          onclick={() => (pendingHand = "left")}
        >
          🔵 Left
        </button>
        <button
          class="hand-btn {pendingHand === 'right' ? 'active' : ''}"
          onclick={() => (pendingHand = "right")}
        >
          🔴 Right
        </button>
      </span>
    </div>
    <div class="tool-group">
      <span class="annotation-count">
        {annotations.length} annotation{annotations.length !== 1 ? "s" : ""}
      </span>
      {#if selectedAnnotationId}
        <button class="btn-delete" onclick={deleteSelectedAnnotation}>
          <i class="fa fa-trash" aria-hidden="true"></i> Delete
        </button>
      {/if}
    </div>
  </div>

  <!-- Instructions -->
  <div class="instructions">
    {#if mode === "idle"}
      <p>Click and drag to draw a bounding box around a prop</p>
    {:else if mode === "drawing-box"}
      <p>Release to finish drawing</p>
    {:else if mode === "selecting-direction"}
      <p>Select the direction the prop HEAD is pointing</p>
    {/if}
  </div>
</div>

<style>
  .labeling-canvas {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: #000;
  }

  canvas {
    cursor: crosshair;
    border-radius: 8px;
  }

  .toolbar {
    position: absolute;
    top: 0.5rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 1rem;
    padding: 0.5rem 1rem;
    background: rgba(0, 0, 0, 0.8);
    border-radius: 8px;
    align-items: center;
  }

  .tool-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .hand-selector {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
  }

  .hand-btn {
    padding: 0.25rem 0.5rem;
    border: none;
    border-radius: 4px;
    background: var(--theme-stroke);
    color: white;
    cursor: pointer;
    font-size: 0.8rem;
  }

  .hand-btn.active {
    background: var(--theme-stroke-strong);
  }

  .annotation-count {
    font-size: 0.85rem;
    opacity: 0.8;
  }

  .btn-delete {
    padding: 0.25rem 0.5rem;
    background: var(--semantic-error);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .instructions {
    position: absolute;
    bottom: 0.5rem;
    left: 50%;
    transform: translateX(-50%);
    padding: 0.5rem 1rem;
    background: rgba(0, 0, 0, 0.8);
    border-radius: 8px;
    font-size: 0.85rem;
    opacity: 0.8;
  }

  .instructions p {
    margin: 0;
  }

  .direction-picker {
    position: fixed;
    transform: translate(-50%, -50%);
    background: rgba(20, 20, 30, 0.95);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    padding: 1rem;
    z-index: 100;
    box-shadow: 0 8px 32px var(--theme-shadow);
  }

  .picker-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
    font-weight: bold;
  }

  .hand-indicator {
    font-size: 0.85rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }

  .hand-indicator.left {
    background: color-mix(
      in srgb,
      var(--semantic-info, var(--semantic-info)) 30%,
      transparent
    );
  }

  .hand-indicator.right {
    background: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 30%,
      transparent
    );
  }

  .direction-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  /* Position buttons in compass layout */
  .direction-grid .direction-btn:nth-child(1) {
    grid-column: 2;
  } /* N */
  .direction-grid .direction-btn:nth-child(2) {
    grid-column: 3;
  } /* NE */
  .direction-grid .direction-btn:nth-child(3) {
    grid-column: 3;
  } /* E */
  .direction-grid .direction-btn:nth-child(4) {
    grid-column: 3;
  } /* SE */
  .direction-grid .direction-btn:nth-child(5) {
    grid-column: 2;
  } /* S */
  .direction-grid .direction-btn:nth-child(6) {
    grid-column: 1;
  } /* SW */
  .direction-grid .direction-btn:nth-child(7) {
    grid-column: 1;
  } /* W */
  .direction-grid .direction-btn:nth-child(8) {
    grid-column: 1;
  } /* NW */

  .direction-btn {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border: 1px solid var(--theme-stroke-strong);
    border-radius: 8px;
    background: var(--theme-stroke);
    color: white;
    font-weight: bold;
    cursor: pointer;
    transition: all var(--duration-normal);
  }

  .direction-btn:hover {
    background: color-mix(in srgb, var(--theme-accent) 50%, transparent);
    border-color: var(--theme-accent, var(--theme-accent));
    transform: scale(1.05);
  }

  .picker-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
  }

  .btn-toggle-hand,
  .btn-cancel {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .btn-toggle-hand {
    background: var(--semantic-info, var(--semantic-info));
    color: white;
  }

  .btn-cancel {
    background: var(--theme-stroke);
    color: white;
  }
</style>

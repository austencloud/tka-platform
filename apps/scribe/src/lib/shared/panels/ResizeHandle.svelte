<!--
  ResizeHandle - Primitive draggable divider

  The most basic building block of the panel system.
  Just a draggable line that emits delta values.

  Props:
  - direction: "horizontal" | "vertical" - which way the handle moves
  - onDragStart: callback when drag begins
  - onDrag: callback with delta pixels during drag
  - onDragEnd: callback when drag ends

  The handle itself is just presentation + drag behavior.
  It knows nothing about panels or sizing logic.
-->
<script lang="ts">
  import { onDestroy } from "svelte";

  interface Props {
    /** Direction the handle can be dragged */
    direction: "horizontal" | "vertical";
    /** Called when drag starts */
    onDragStart?: () => void;
    /** Called during drag with pixel delta from start */
    onDrag?: (delta: number) => void;
    /** Called when drag ends */
    onDragEnd?: () => void;
    /** Visual size of the handle in pixels */
    size?: number;
    /** Whether handle is disabled */
    disabled?: boolean;
  }

  let {
    direction,
    onDragStart,
    onDrag,
    onDragEnd,
    size = 6,
    disabled = false,
  }: Props = $props();

  let isDragging = $state(false);
  let startPos = $state(0);

  function handlePointerDown(e: PointerEvent) {
    if (disabled) return;

    e.preventDefault();
    isDragging = true;
    startPos = direction === "horizontal" ? e.clientX : e.clientY;

    onDragStart?.();

    // Capture pointer for reliable tracking
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isDragging) return;

    const currentPos = direction === "horizontal" ? e.clientX : e.clientY;
    const delta = currentPos - startPos;

    onDrag?.(delta);
  }

  function handlePointerUp(e: PointerEvent) {
    if (!isDragging) return;

    isDragging = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    onDragEnd?.();
  }

  // Cleanup on unmount
  onDestroy(() => {
    isDragging = false;
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="resize-handle"
  class:horizontal={direction === "horizontal"}
  class:vertical={direction === "vertical"}
  class:dragging={isDragging}
  class:disabled
  style:--handle-size="{size}px"
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerUp}
  role="separator"
  aria-orientation={direction}
  aria-disabled={disabled}
  tabindex={disabled ? -1 : 0}
>
  <div class="handle-visual"></div>
</div>

<style>
  .resize-handle {
    position: relative;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    user-select: none;
    touch-action: none;
    z-index: 10;
  }

  /* Horizontal = divides left/right, moves left-right */
  .resize-handle.horizontal {
    width: var(--handle-size);
    height: 100%;
    cursor: col-resize;
  }

  /* Vertical = divides top/bottom, moves up-down */
  .resize-handle.vertical {
    width: 100%;
    height: var(--handle-size);
    cursor: row-resize;
  }

  .handle-visual {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    transition:
      background 0.15s ease,
      transform 0.15s ease;
  }

  .horizontal .handle-visual {
    width: 2px;
    height: 40px;
    max-height: 60%;
  }

  .vertical .handle-visual {
    height: 2px;
    width: 40px;
    max-width: 60%;
  }

  .resize-handle:hover .handle-visual {
    background: rgba(255, 255, 255, 0.25);
  }

  .resize-handle.dragging .handle-visual {
    background: var(--theme-accent);
    transform: scale(1.2);
  }

  .resize-handle.disabled {
    cursor: default;
    pointer-events: none;
  }

  .resize-handle.disabled .handle-visual {
    opacity: 0.3;
  }

  /* Expand hit area for easier grabbing */
  .resize-handle::before {
    content: "";
    position: absolute;
    inset: -4px;
  }
</style>

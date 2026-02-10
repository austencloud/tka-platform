<!-- DurationResizeHandle - Draggable right-edge handle for duration resize -->
<script lang="ts">
  import { onDestroy } from "svelte";

  interface Props {
    onDragStart: () => void;
    onDrag: (pixelDelta: number) => void;
    onDragEnd: () => void;
  }

  let { onDragStart, onDrag, onDragEnd }: Props = $props();

  let isDragging = $state(false);
  let startX = $state(0);

  function handlePointerDown(e: PointerEvent) {
    e.preventDefault();
    e.stopPropagation();

    isDragging = true;
    startX = e.clientX;

    onDragStart();

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isDragging) return;

    const delta = e.clientX - startX;
    onDrag(delta);
  }

  function handlePointerUp(e: PointerEvent) {
    if (!isDragging) return;

    isDragging = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    onDragEnd();
  }

  onDestroy(() => {
    isDragging = false;
  });
</script>

<div
  class="duration-resize-handle"
  class:dragging={isDragging}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerUp}
  role="separator"
  aria-orientation="vertical"
  aria-label="Drag to resize duration"
  tabindex={-1}
>
  <div class="handle-line"></div>
</div>

<style>
  .duration-resize-handle {
    position: absolute;
    right: -3px;
    top: 0;
    bottom: 0;
    width: 6px;
    cursor: col-resize;
    touch-action: none;
    user-select: none;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Expand hit area to 48px for WCAG AAA touch target */
  .duration-resize-handle::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: -21px;
    right: -21px;
  }

  .handle-line {
    width: 2px;
    height: 40%;
    min-height: 12px;
    max-height: 32px;
    border-radius: 1px;
    background: rgba(255, 255, 255, 0.15);
    transition: background 0.15s ease, transform 0.15s ease;
  }

  .duration-resize-handle:hover .handle-line {
    background: rgba(255, 255, 255, 0.4);
  }

  .duration-resize-handle.dragging .handle-line {
    background: var(--theme-accent, rgba(139, 92, 246, 0.8));
    transform: scaleY(1.3);
  }

  @media (prefers-reduced-motion: reduce) {
    .handle-line {
      transition: none;
    }
  }
</style>

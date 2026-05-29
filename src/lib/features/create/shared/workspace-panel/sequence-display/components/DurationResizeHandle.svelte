<!-- DurationResizeHandle - Draggable right-edge handle for duration resize -->
<script lang="ts">
  import { onDestroy } from "svelte";
  import {
    MIN_DURATION,
    MAX_DURATION,
    DURATION_STEP_FINE,
    DURATION_STEP_COARSE,
  } from "../../../services/step-operations/duration-handler";

  interface Props {
    currentDuration: number;
    onDragStart: () => void;
    onDrag: (pixelDelta: number) => void;
    onDragEnd: () => void;
    onStepAdjust: (newDuration: number) => void;
  }

  let { currentDuration, onDragStart, onDrag, onDragEnd, onStepAdjust }: Props =
    $props();

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

  function handleKeyDown(e: KeyboardEvent) {
    let newDuration: number | null = null;

    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      const step = e.shiftKey ? DURATION_STEP_COARSE : DURATION_STEP_FINE;
      newDuration = Math.min(MAX_DURATION, currentDuration + step);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      const step = e.shiftKey ? DURATION_STEP_COARSE : DURATION_STEP_FINE;
      newDuration = Math.max(MIN_DURATION, currentDuration - step);
    } else if (e.key === "Home") {
      e.preventDefault();
      newDuration = MIN_DURATION;
    } else if (e.key === "End") {
      e.preventDefault();
      newDuration = MAX_DURATION;
    }

    if (newDuration !== null && newDuration !== currentDuration) {
      onStepAdjust(newDuration);
    }
  }

  onDestroy(() => {
    isDragging = false;
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class="duration-resize-handle"
  class:dragging={isDragging}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerUp}
  onkeydown={handleKeyDown}
  role="separator"
  aria-orientation="vertical"
  aria-roledescription="duration resize handle"
  aria-label="Resize duration: {currentDuration} beats"
  aria-valuenow={currentDuration}
  aria-valuemin={MIN_DURATION}
  aria-valuemax={MAX_DURATION}
  tabindex={0}
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
    background: var(--theme-stroke, rgba(255, 255, 255, 0.15));
    transition: background 0.15s ease, transform 0.15s ease;
  }

  .duration-resize-handle:hover .handle-line,
  .duration-resize-handle:focus-visible .handle-line {
    background: var(--theme-stroke-strong, rgba(255, 255, 255, 0.4));
  }

  .duration-resize-handle.dragging .handle-line {
    background: var(--theme-accent, rgba(139, 92, 246, 0.8));
    transform: scaleY(1.3);
  }

  .duration-resize-handle:focus-visible {
    outline: 2px solid var(--theme-accent, rgba(139, 92, 246, 0.8));
    outline-offset: 2px;
    border-radius: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .handle-line {
      transition: none;
    }
  }
</style>

<!--
  CellResizeHandles.svelte

  Invisible hit areas on cell edges and corner that initiate drag-to-resize.
  - Right edge: ew-resize cursor, changes colSpan
  - Bottom edge: ns-resize cursor, changes rowSpan
  - Corner: nwse-resize cursor, changes both
-->
<script lang="ts">
  let {
    cellId,
    canResizeLeft,
    canResizeRight,
    canResizeTop,
    canResizeBottom,
    onResizeStart,
  }: {
    cellId: string;
    canResizeLeft: boolean;
    canResizeRight: boolean;
    canResizeTop: boolean;
    canResizeBottom: boolean;
    onResizeStart: (
      cellId: string,
      direction: "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right",
      e: PointerEvent
    ) => void;
  } = $props();

  function handlePointerDown(
    direction: "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right",
    e: PointerEvent
  ) {
    e.stopPropagation();
    e.preventDefault();
    onResizeStart(cellId, direction, e);
  }
</script>

<!-- Edge handles (pointer-only - keyboard users resize via presets) -->
{#if canResizeLeft}
  <div
    class="handle left"
    aria-hidden="true"
    onpointerdown={(e) => handlePointerDown("left", e)}
  ></div>
{/if}

{#if canResizeRight}
  <div
    class="handle right"
    aria-hidden="true"
    onpointerdown={(e) => handlePointerDown("right", e)}
  ></div>
{/if}

{#if canResizeTop}
  <div
    class="handle top"
    aria-hidden="true"
    onpointerdown={(e) => handlePointerDown("top", e)}
  ></div>
{/if}

{#if canResizeBottom}
  <div
    class="handle bottom"
    aria-hidden="true"
    onpointerdown={(e) => handlePointerDown("bottom", e)}
  ></div>
{/if}

<!-- Corner handles -->
{#if canResizeTop && canResizeLeft}
  <div
    class="handle corner top-left"
    aria-hidden="true"
    onpointerdown={(e) => handlePointerDown("top-left", e)}
  ></div>
{/if}

{#if canResizeTop && canResizeRight}
  <div
    class="handle corner top-right"
    aria-hidden="true"
    onpointerdown={(e) => handlePointerDown("top-right", e)}
  ></div>
{/if}

{#if canResizeBottom && canResizeLeft}
  <div
    class="handle corner bottom-left"
    aria-hidden="true"
    onpointerdown={(e) => handlePointerDown("bottom-left", e)}
  ></div>
{/if}

{#if canResizeBottom && canResizeRight}
  <div
    class="handle corner bottom-right"
    aria-hidden="true"
    onpointerdown={(e) => handlePointerDown("bottom-right", e)}
  ></div>
{/if}

<style>
  .handle {
    position: absolute;
    z-index: 20;
    background: transparent;
    transition: background 0.15s ease;
  }

  /* Horizontal edge handles */
  .handle.left {
    left: 0;
    top: 24px;
    bottom: 24px;
    width: 20px;
    cursor: ew-resize;
  }

  .handle.right {
    right: 0;
    top: 24px;
    bottom: 24px;
    width: 20px;
    cursor: ew-resize;
  }

  /* Vertical edge handles */
  .handle.top {
    top: 0;
    left: 24px;
    right: 24px;
    height: 20px;
    cursor: ns-resize;
  }

  .handle.bottom {
    bottom: 0;
    left: 24px;
    right: 24px;
    height: 20px;
    cursor: ns-resize;
  }

  /* Corner handles */
  .handle.corner {
    width: 24px;
    height: 24px;
  }

  .handle.corner.top-left {
    top: 0;
    left: 0;
    cursor: nwse-resize;
  }

  .handle.corner.top-right {
    top: 0;
    right: 0;
    cursor: nesw-resize;
  }

  .handle.corner.bottom-left {
    bottom: 0;
    left: 0;
    cursor: nesw-resize;
  }

  .handle.corner.bottom-right {
    bottom: 0;
    right: 0;
    cursor: nwse-resize;
  }

  /* Hover effects for edge handles */
  .handle.left:hover {
    background: linear-gradient(to right, color-mix(in srgb, var(--theme-accent, #8b5cf6) 30%, transparent) 0%, transparent 100%);
  }

  .handle.right:hover {
    background: linear-gradient(to left, color-mix(in srgb, var(--theme-accent, #8b5cf6) 30%, transparent) 0%, transparent 100%);
  }

  .handle.top:hover {
    background: linear-gradient(to bottom, color-mix(in srgb, var(--theme-accent, #8b5cf6) 30%, transparent) 0%, transparent 100%);
  }

  .handle.bottom:hover {
    background: linear-gradient(to top, color-mix(in srgb, var(--theme-accent, #8b5cf6) 30%, transparent) 0%, transparent 100%);
  }

  /* Hover effects for corner handles */
  .handle.corner.top-left:hover {
    background: radial-gradient(circle at top left, color-mix(in srgb, var(--theme-accent, #8b5cf6) 40%, transparent) 0%, transparent 70%);
  }

  .handle.corner.top-right:hover {
    background: radial-gradient(circle at top right, color-mix(in srgb, var(--theme-accent, #8b5cf6) 40%, transparent) 0%, transparent 70%);
  }

  .handle.corner.bottom-left:hover {
    background: radial-gradient(circle at bottom left, color-mix(in srgb, var(--theme-accent, #8b5cf6) 40%, transparent) 0%, transparent 70%);
  }

  .handle.corner.bottom-right:hover {
    background: radial-gradient(circle at bottom right, color-mix(in srgb, var(--theme-accent, #8b5cf6) 40%, transparent) 0%, transparent 70%);
  }

  /* Visual indicator on hover */
  .handle:hover::after {
    content: "";
    position: absolute;
    background: var(--theme-accent, #8b5cf6);
    border-radius: 2px;
  }

  .handle.left:hover::after {
    left: 4px;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 40px;
  }

  .handle.right:hover::after {
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 40px;
  }

  .handle.top:hover::after {
    top: 4px;
    left: 50%;
    transform: translateX(-50%);
    width: 40px;
    height: 4px;
  }

  .handle.bottom:hover::after {
    bottom: 4px;
    left: 50%;
    transform: translateX(-50%);
    width: 40px;
    height: 4px;
  }

  .handle.corner:hover::after {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .handle.corner.top-left:hover::after {
    top: 4px;
    left: 4px;
  }

  .handle.corner.top-right:hover::after {
    top: 4px;
    right: 4px;
  }

  .handle.corner.bottom-left:hover::after {
    bottom: 4px;
    left: 4px;
  }

  .handle.corner.bottom-right:hover::after {
    bottom: 4px;
    right: 4px;
  }

  @media (prefers-reduced-motion: reduce) {
    .handle {
      transition: none;
    }
  }
</style>

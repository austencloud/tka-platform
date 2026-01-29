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
    canExpandRight,
    canExpandDown,
    onResizeStart,
  }: {
    cellId: string;
    canExpandRight: boolean;
    canExpandDown: boolean;
    onResizeStart: (
      cellId: string,
      direction: "horizontal" | "vertical" | "both",
      e: PointerEvent
    ) => void;
  } = $props();

  function handlePointerDown(
    direction: "horizontal" | "vertical" | "both",
    e: PointerEvent
  ) {
    e.stopPropagation();
    e.preventDefault();
    onResizeStart(cellId, direction, e);
  }
</script>

{#if canExpandRight}
  <div
    class="handle right"
    role="slider"
    aria-label="Resize cell width"
    aria-orientation="horizontal"
    tabindex="0"
    onpointerdown={(e) => handlePointerDown("horizontal", e)}
  ></div>
{/if}

{#if canExpandDown}
  <div
    class="handle bottom"
    role="slider"
    aria-label="Resize cell height"
    aria-orientation="vertical"
    tabindex="0"
    onpointerdown={(e) => handlePointerDown("vertical", e)}
  ></div>
{/if}

{#if canExpandRight && canExpandDown}
  <div
    class="handle corner"
    role="slider"
    aria-label="Resize cell width and height"
    tabindex="0"
    onpointerdown={(e) => handlePointerDown("both", e)}
  ></div>
{/if}

<style>
  .handle {
    position: absolute;
    z-index: 20;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .handle:hover,
  .handle:focus-visible {
    opacity: 1;
  }

  .handle:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: -2px;
  }

  /* Right edge handle */
  .handle.right {
    right: -8px;
    top: 16px;
    bottom: 16px;
    width: 16px;
    cursor: ew-resize;
    background: linear-gradient(
      to right,
      transparent 0%,
      transparent 40%,
      var(--theme-accent, #8b5cf6) 40%,
      var(--theme-accent, #8b5cf6) 60%,
      transparent 60%
    );
    border-radius: 4px;
  }

  /* Bottom edge handle */
  .handle.bottom {
    bottom: -8px;
    left: 16px;
    right: 16px;
    height: 16px;
    cursor: ns-resize;
    background: linear-gradient(
      to bottom,
      transparent 0%,
      transparent 40%,
      var(--theme-accent, #8b5cf6) 40%,
      var(--theme-accent, #8b5cf6) 60%,
      transparent 60%
    );
    border-radius: 4px;
  }

  /* Corner handle */
  .handle.corner {
    right: -8px;
    bottom: -8px;
    width: 16px;
    height: 16px;
    cursor: nwse-resize;
    background: var(--theme-accent, #8b5cf6);
    border-radius: 50%;
  }

  /* When cell is hovered, show handles more visibly */
  :global(.cell-wrapper:hover) .handle {
    opacity: 0.5;
  }

  :global(.cell-wrapper:hover) .handle:hover {
    opacity: 1;
  }
</style>

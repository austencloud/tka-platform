<!--
  RetroSplitter - Horizontal or vertical split pane with draggable divider

  Renders two panes separated by a 4px draggable gray bar. In horizontal
  mode (default), left/right panes are side by side. In vertical mode,
  top/bottom panes are stacked. The divider changes cursor to col-resize
  or row-resize and tracks mouse movement for live resizing.

  Uses snippet slots for left/right (or top/bottom) content.
-->
<script lang="ts">
  import { untrack } from "svelte";
  import type { Snippet } from "svelte";

  let {
    direction = "horizontal",
    initialSplit = 30,
    left,
    right,
  }: {
    direction?: "horizontal" | "vertical";
    initialSplit?: number;
    left?: Snippet;
    right?: Snippet;
  } = $props();

  let splitPercent = $state(untrack(() => initialSplit));
  let isDragging = $state(false);
  let containerEl: HTMLDivElement | undefined = $state(undefined);

  const isHorizontal = $derived(direction === "horizontal");

  function handleDividerMouseDown(event: MouseEvent) {
    isDragging = true;
    event.preventDefault();
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }

  function handleMouseMove(event: MouseEvent) {
    if (!isDragging || !containerEl) return;

    const rect = containerEl.getBoundingClientRect();

    if (isHorizontal) {
      const offset = event.clientX - rect.left;
      splitPercent = Math.max(10, Math.min(90, (offset / rect.width) * 100));
    } else {
      const offset = event.clientY - rect.top;
      splitPercent = Math.max(10, Math.min(90, (offset / rect.height) * 100));
    }
  }

  function handleMouseUp() {
    isDragging = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  }

  const KEYBOARD_STEP = 2;

  function handleDividerKeydown(event: KeyboardEvent) {
    const isH = isHorizontal;
    let handled = false;

    if ((isH && event.key === "ArrowLeft") || (!isH && event.key === "ArrowUp")) {
      splitPercent = Math.max(10, splitPercent - KEYBOARD_STEP);
      handled = true;
    } else if ((isH && event.key === "ArrowRight") || (!isH && event.key === "ArrowDown")) {
      splitPercent = Math.min(90, splitPercent + KEYBOARD_STEP);
      handled = true;
    } else if (event.key === "Home") {
      splitPercent = 10;
      handled = true;
    } else if (event.key === "End") {
      splitPercent = 90;
      handled = true;
    }

    if (handled) event.preventDefault();
  }

  /** Cleanup listeners on destroy. */
  $effect(() => {
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  });
</script>

<div
  class="retro-splitter"
  class:horizontal={isHorizontal}
  class:vertical={!isHorizontal}
  class:dragging={isDragging}
  bind:this={containerEl}
>
  <!-- First pane (left or top) -->
  <div
    class="retro-splitter-pane"
    style={isHorizontal
      ? `width: ${splitPercent}%;`
      : `height: ${splitPercent}%;`}
  >
    {#if left}
      {@render left()}
    {/if}
  </div>

  <!-- Draggable divider -->
  <div
    class="retro-splitter-divider"
    onmousedown={handleDividerMouseDown}
    onkeydown={handleDividerKeydown}
    role="slider"
    aria-orientation={isHorizontal ? "vertical" : "horizontal"}
    aria-valuenow={Math.round(splitPercent)}
    aria-valuemin={10}
    aria-valuemax={90}
    aria-label="Resize panes"
    tabindex="0"
  ></div>

  <!-- Second pane (right or bottom) -->
  <div class="retro-splitter-pane retro-splitter-pane-fill">
    {#if right}
      {@render right()}
    {/if}
  </div>
</div>

<style>
  .retro-splitter {
    display: flex;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .retro-splitter.horizontal {
    flex-direction: row;
  }

  .retro-splitter.vertical {
    flex-direction: column;
  }

  /* Prevent text selection during drag */
  .retro-splitter.dragging {
    user-select: none;
  }

  /* Panes                                                               */
  .retro-splitter-pane {
    overflow: auto;
    min-width: 0;
    min-height: 0;
  }

  .retro-splitter-pane-fill {
    flex: 1;
    min-width: 0;
    min-height: 0;
  }

  /* Divider bar                                                         */
  .retro-splitter-divider {
    flex-shrink: 0;
    background: var(--retro-button-face, #c0c0c0);
    border: 1px solid var(--retro-button-shadow, #808080);
    position: relative;
  }

  .horizontal > .retro-splitter-divider {
    width: 4px;
    cursor: col-resize;
    border-top: none;
    border-bottom: none;
    border-left: 1px solid var(--retro-button-highlight, #fff);
    border-right: 1px solid var(--retro-button-dark-shadow, #000);
  }

  .vertical > .retro-splitter-divider {
    height: 4px;
    cursor: row-resize;
    border-left: none;
    border-right: none;
    border-top: 1px solid var(--retro-button-highlight, #fff);
    border-bottom: 1px solid var(--retro-button-dark-shadow, #000);
  }

  .retro-splitter-divider:focus-visible {
    outline: 1px dotted var(--retro-black, #000);
    outline-offset: -1px;
  }
</style>

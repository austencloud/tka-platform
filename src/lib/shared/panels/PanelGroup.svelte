<!--
  PanelGroup - Container that manages panel sizes with drag handles

  Orchestrates multiple children with ResizeHandle components between them.
  Children are passed as an array of snippets for full control.

  Props:
  - direction: "horizontal" | "vertical"
  - panels: Array of { content: Snippet, defaultSize?: number, minSize?: number, maxSize?: number }
  - sizes: Current sizes as flex ratios (bindable)

  Key insight: We need explicit panel definitions rather than slots
  because we need to insert ResizeHandles between them and track sizes.
-->
<script module lang="ts">
  import type { Snippet } from "svelte";

  export interface PanelDefinition {
    /** Panel content */
    content: Snippet;
    /** Default flex size (default: 1) */
    defaultSize?: number;
    /** Minimum size in pixels */
    minSize?: number;
    /** Maximum size in pixels (0 = no max) */
    maxSize?: number;
    /**
     * Hold this panel at a CSS length while keeping its normal flex size for
     * later. A collapsed dock can therefore reopen at the exact size the user
     * left its editor instead of resetting the workspace.
     */
    fixedSize?: string;
    /** Whether the handle after this panel is available (default: true). */
    resizable?: boolean;
    /** Panel ID for tracking */
    id?: string;
  }
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import ResizeHandle from "./ResizeHandle.svelte";

  interface Props {
    /** Layout direction */
    direction: "horizontal" | "vertical";
    /** Panel definitions */
    panels: PanelDefinition[];
    /** Current sizes as flex values (bindable) */
    sizes?: number[];
    /** Called when sizes change */
    onSizesChange?: (sizes: number[]) => void;
    /** Gap size for handles */
    gap?: number;
    /**
     * Keep the panel contents but remove the split-pane wrappers and handles.
     * Useful when a compact layout presents one panel at a time.
     */
    flattened?: boolean;
  }

  let {
    direction,
    panels,
    sizes = $bindable([]),
    onSizesChange,
    gap = 6,
    flattened = false,
  }: Props = $props();

  let containerRef = $state<HTMLDivElement | null>(null);
  let dragStartSizes = $state<number[]>([]);
  let activeDragIndex = $state<number | null>(null);

  // Initialize sizes from panel defaults - only when panel count changes
  // Use untrack to prevent reactive cascade when sizes is bindable
  $effect(() => {
    const panelCount = panels.length;
    untrack(() => {
      if (sizes.length !== panelCount) {
        sizes = panels.map((p) => p.defaultSize ?? 1);
      }
    });
  });

  // Handle resize start
  function handleDragStart(index: number) {
    dragStartSizes = [...sizes];
    activeDragIndex = index;
  }

  // Handle resize drag
  function handleDrag(index: number, delta: number) {
    if (!containerRef || dragStartSizes.length === 0) return;

    const containerSize =
      direction === "horizontal"
        ? containerRef.clientWidth
        : containerRef.clientHeight;

    // Account for gaps
    const totalGaps = (panels.length - 1) * gap;
    const availableSize = containerSize - totalGaps;

    // Total flex units
    const totalFlex = dragStartSizes.reduce((a, b) => a + b, 0);

    // Convert delta pixels to flex units
    const pixelsPerFlex = availableSize / totalFlex;
    const deltaFlex = delta / pixelsPerFlex;

    // Get constraints
    const panel1 = panels[index];
    const panel2 = panels[index + 1];
    const startSize1 = dragStartSizes[index];
    const startSize2 = dragStartSizes[index + 1];

    if (
      !panel1 ||
      !panel2 ||
      startSize1 === undefined ||
      startSize2 === undefined
    )
      return;

    const minFlex1 = panel1.minSize ? panel1.minSize / pixelsPerFlex : 0.1;
    const minFlex2 = panel2.minSize ? panel2.minSize / pixelsPerFlex : 0.1;
    const maxFlex1 = panel1.maxSize ? panel1.maxSize / pixelsPerFlex : Infinity;
    const maxFlex2 = panel2.maxSize ? panel2.maxSize / pixelsPerFlex : Infinity;

    // Calculate new sizes with constraints
    let newSize1 = startSize1 + deltaFlex;
    let newSize2 = startSize2 - deltaFlex;

    // Apply min constraints
    if (newSize1 < minFlex1) {
      const diff = minFlex1 - newSize1;
      newSize1 = minFlex1;
      newSize2 -= diff;
    }
    if (newSize2 < minFlex2) {
      const diff = minFlex2 - newSize2;
      newSize2 = minFlex2;
      newSize1 -= diff;
    }

    // Apply max constraints
    if (newSize1 > maxFlex1) {
      const diff = newSize1 - maxFlex1;
      newSize1 = maxFlex1;
      newSize2 += diff;
    }
    if (newSize2 > maxFlex2) {
      const diff = newSize2 - maxFlex2;
      newSize2 = maxFlex2;
      newSize1 += diff;
    }

    const newSizes = [...sizes];
    newSizes[index] = Math.max(0.1, newSize1);
    newSizes[index + 1] = Math.max(0.1, newSize2);

    sizes = newSizes;
    onSizesChange?.(newSizes);
  }

  // Handle resize end
  function handleDragEnd() {
    dragStartSizes = [];
    activeDragIndex = null;
  }

  function handleKeydown(index: number, event: KeyboardEvent): void {
    const decreaseKey = direction === "horizontal" ? "ArrowLeft" : "ArrowUp";
    const increaseKey = direction === "horizontal" ? "ArrowRight" : "ArrowDown";
    if (event.key !== decreaseKey && event.key !== increaseKey) return;

    event.preventDefault();
    event.stopPropagation();
    dragStartSizes = [...sizes];
    const step = event.shiftKey ? 48 : 16;
    handleDrag(index, event.key === decreaseKey ? -step : step);
    handleDragEnd();
  }

  function handleValue(index: number): number {
    const leading = sizes[index] ?? 1;
    const trailing = sizes[index + 1] ?? 1;
    return (leading / (leading + trailing)) * 100;
  }

  // Get flex style for a panel
  function getFlexStyle(index: number): string {
    const fixedSize = panels[index]?.fixedSize;
    return fixedSize ? `flex: 0 0 ${fixedSize}` : `flex: ${sizes[index] ?? 1}`;
  }
</script>

<div
  class="panel-group"
  class:horizontal={direction === "horizontal"}
  class:vertical={direction === "vertical"}
  class:dragging={activeDragIndex !== null}
  class:flattened
  style:--panel-gap="{gap}px"
  bind:this={containerRef}
>
  {#each panels as panel, i (panel.id ?? i)}
    <!-- Panel wrapper with flex sizing -->
    <div
      class="panel-wrapper"
      style={getFlexStyle(i)}
      data-min-size={panel.minSize}
      data-max-size={panel.maxSize}
    >
      {@render panel.content()}
    </div>

    <!-- Resize handle between panels -->
    {#if !flattened && i < panels.length - 1 && panel.resizable !== false}
      <ResizeHandle
        direction={direction === "horizontal" ? "horizontal" : "vertical"}
        size={gap}
        onDragStart={() => handleDragStart(i)}
        onDrag={(delta) => handleDrag(i, delta)}
        onDragEnd={handleDragEnd}
        onKeydown={(event) => handleKeydown(i, event)}
        ariaLabel={`Resize ${panel.id ?? `panel ${i + 1}`} and ${panels[i + 1]?.id ?? `panel ${i + 2}`}`}
        ariaValueNow={handleValue(i)}
      />
    {/if}
  {/each}
</div>

<style>
  .panel-group {
    display: flex;
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .panel-group.horizontal {
    flex-direction: row;
  }

  .panel-group.vertical {
    flex-direction: column;
  }

  .panel-group.flattened,
  .panel-group.flattened .panel-wrapper {
    display: contents;
  }

  .panel-wrapper {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .panel-wrapper > :global(*) {
    flex: 1;
    min-width: 0;
    min-height: 0;
  }

  /* During drag, prevent interactions with panel content */
  .panel-group.dragging {
    user-select: none;
  }

  .panel-group.dragging .panel-wrapper {
    pointer-events: none;
  }
</style>

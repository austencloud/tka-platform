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
    /**
     * Start at a CSS length while leaving the resize handle active. The first
     * drag turns that preferred allocation into the user's saved flex sizes.
     */
    preferredSize?: string;
    /** Whether the handle after this panel is available (default: true). */
    resizable?: boolean;
    /** Accessible name for the handle after this panel. */
    resizeLabel?: string;
    /** Panel ID for tracking */
    id?: string;
  }
</script>

<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { flexPresence, growFade } from "$lib/shared/transitions/motion";
  import { DURATION } from "$lib/shared/transitions/transitions";
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
  let manuallySizedPanels = $state<Set<string | number>>(new Set());
  let handleValues = $state<number[]>([]);

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

  onMount(() => {
    if (!containerRef) return;

    let scheduledFrame = 0;
    const scheduleRefresh = () => {
      if (scheduledFrame) return;
      scheduledFrame = requestAnimationFrame(() => {
        scheduledFrame = 0;
        refreshHandleValues();
      });
    };
    const resizeObserver = new ResizeObserver(scheduleRefresh);
    const observePanels = () => {
      if (!containerRef) return;
      resizeObserver.disconnect();
      resizeObserver.observe(containerRef);
      for (const panel of containerRef.querySelectorAll(":scope > .panel-wrapper")) {
        resizeObserver.observe(panel);
      }
      scheduleRefresh();
    };
    const panelObserver = new MutationObserver(observePanels);
    panelObserver.observe(containerRef, { childList: true });
    observePanels();

    return () => {
      if (scheduledFrame) cancelAnimationFrame(scheduledFrame);
      panelObserver.disconnect();
      resizeObserver.disconnect();
    };
  });

  $effect(() => {
    void panels;
    void direction;
    void gap;

    const firstFrame = requestAnimationFrame(refreshHandleValues);
    const settledTimer = setTimeout(refreshHandleValues, DURATION.emphasis);
    return () => {
      cancelAnimationFrame(firstFrame);
      clearTimeout(settledTimer);
    };
  });

  // Handle resize start
  function handleDragStart(index: number) {
    const renderedSizes = containerRef
      ? Array.from(
          containerRef.querySelectorAll<HTMLElement>(":scope > .panel-wrapper")
        ).map((panel) =>
          direction === "horizontal" ? panel.clientWidth : panel.clientHeight
        )
      : [];

    // A preferred panel begins at content height, not at its stored flex
    // ratio. Starting the drag from the rendered pixels prevents the first
    // pointer movement from snapping it back to that stale ratio.
    dragStartSizes =
      renderedSizes.length === panels.length ? renderedSizes : [...sizes];
    sizes = [...dragStartSizes];

    const nextManuallySizedPanels = new Set(manuallySizedPanels);
    for (const panelIndex of [index, index + 1]) {
      if (panels[panelIndex]?.preferredSize) {
        nextManuallySizedPanels.add(panels[panelIndex]?.id ?? panelIndex);
      }
    }
    manuallySizedPanels = nextManuallySizedPanels;
    activeDragIndex = index;
    refreshHandleValues();
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
    const total = newSize1 + newSize2;
    handleValues[index] = total > 0 ? (newSize1 / total) * 100 : 50;
    onSizesChange?.(newSizes);
  }

  // Handle resize end
  function handleDragEnd() {
    dragStartSizes = [];
    activeDragIndex = null;
    requestAnimationFrame(refreshHandleValues);
  }

  function handleKeydown(index: number, event: KeyboardEvent): void {
    const decreaseKey = direction === "horizontal" ? "ArrowLeft" : "ArrowUp";
    const increaseKey = direction === "horizontal" ? "ArrowRight" : "ArrowDown";
    if (event.key !== decreaseKey && event.key !== increaseKey) return;

    event.preventDefault();
    event.stopPropagation();
    handleDragStart(index);
    const step = event.shiftKey ? 48 : 16;
    handleDrag(index, event.key === decreaseKey ? -step : step);
    handleDragEnd();
  }

  function measureHandleValue(index: number): number {
    const renderedPanels = containerRef
      ? Array.from(
          containerRef.querySelectorAll<HTMLElement>(":scope > .panel-wrapper")
        )
      : [];
    const leadingPanel = renderedPanels[index];
    const trailingPanel = renderedPanels[index + 1];
    const leading = leadingPanel
      ? direction === "horizontal"
        ? leadingPanel.clientWidth
        : leadingPanel.clientHeight
      : (sizes[index] ?? 1);
    const trailing = trailingPanel
      ? direction === "horizontal"
        ? trailingPanel.clientWidth
        : trailingPanel.clientHeight
      : (sizes[index + 1] ?? 1);
    return (leading / (leading + trailing)) * 100;
  }

  function refreshHandleValues(): void {
    handleValues = panels.slice(0, -1).map((_, index) =>
      measureHandleValue(index)
    );
  }

  // Get flex style for a panel
  function getFlexStyle(panel: PanelDefinition, index: number): string {
    // A keyed panel keeps its captured definition while its outro runs. Reading
    // `panels[index]` here used the next array instead, so a departing fixed or
    // content-sized dock briefly became `flex: 1` and starved its neighbour.
    const fixedSize = panel.fixedSize;
    if (fixedSize) {
      return `flex-grow: 0; flex-shrink: 0; flex-basis: ${fixedSize}`;
    }

    const panelKey = panel.id ?? index;
    const preferredSize = panel.preferredSize;
    if (preferredSize && !manuallySizedPanels.has(panelKey)) {
      return `flex-grow: 0; flex-shrink: 0; flex-basis: ${preferredSize}`;
    }

    return `flex-grow: ${sizes[index] ?? panel.defaultSize ?? 1}; flex-shrink: 1; flex-basis: 0px`;
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
      style={getFlexStyle(panel, i)}
      data-panel-id={panel.id}
      data-min-size={panel.minSize}
      data-max-size={panel.maxSize}
      data-manually-sized={manuallySizedPanels.has(panel.id ?? i) || undefined}
      transition:flexPresence={{
        duration: DURATION.emphasis,
        axis: direction === "horizontal" ? "x" : "y",
      }}
    >
      {@render panel.content()}
    </div>

    <!-- Resize handle between panels -->
    {#if !flattened && i < panels.length - 1 && panel.resizable !== false}
      <div
        class="resize-handle-slot"
        class:horizontal={direction === "horizontal"}
        class:vertical={direction === "vertical"}
        transition:growFade={{
          duration: DURATION.fast,
          axis: direction === "horizontal" ? "x" : "y",
        }}
      >
        <ResizeHandle
          direction={direction === "horizontal" ? "horizontal" : "vertical"}
          size={gap}
          onDragStart={() => handleDragStart(i)}
          onDrag={(delta) => handleDrag(i, delta)}
          onDragEnd={handleDragEnd}
          onKeydown={(event) => handleKeydown(i, event)}
          ariaLabel={panel.resizeLabel ??
            `Resize ${panel.id ?? `panel ${i + 1}`} and ${panels[i + 1]?.id ?? `panel ${i + 2}`}`}
          ariaValueNow={handleValues[i] ?? measureHandleValue(i)}
        />
      </div>
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
    transition:
      flex-grow var(--transition-emphasis),
      flex-basis var(--transition-emphasis);
  }

  .panel-wrapper > :global(*) {
    flex: 1;
    min-width: 0;
    min-height: 0;
  }

  .resize-handle-slot {
    display: flex;
    flex: none;
    min-width: 0;
    min-height: 0;
  }

  .resize-handle-slot.horizontal {
    width: var(--panel-gap);
    height: 100%;
  }

  .resize-handle-slot.vertical {
    width: 100%;
    height: var(--panel-gap);
  }

  .resize-handle-slot > :global(*) {
    flex: 1;
  }

  /* During drag, prevent interactions with panel content */
  .panel-group.dragging {
    user-select: none;
  }

  .panel-group.dragging .panel-wrapper {
    pointer-events: none;
    transition: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .panel-wrapper {
      transition: none;
    }
  }
</style>

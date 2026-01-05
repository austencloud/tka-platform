<script lang="ts">
  import type { MandalaElement } from "../../domain/models/mandala-element";

  interface Props {
    element: MandalaElement;
    isSelected?: boolean;
    isHovered?: boolean;
    isGhost?: boolean;
    onSelect?: (id: string) => void;
    onHover?: (id: string | null) => void;
    onDragStart?: (id: string, event: PointerEvent) => void;
  }

  let {
    element,
    isSelected = false,
    isHovered = false,
    isGhost = false,
    onSelect,
    onHover,
    onDragStart,
  }: Props = $props();

  // Transform string for positioning
  const transform = $derived(
    `translate(${element.position.x}, ${element.position.y}) rotate(${element.rotation}) scale(${element.scale})`
  );

  // Selection ring radius based on element type
  const selectionRadius = $derived(element.type === "gridDot" ? 15 : 40);

  function handlePointerDown(event: PointerEvent) {
    if (isGhost) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect?.(element.id);
    onDragStart?.(element.id, event);
  }

  function handlePointerEnter() {
    if (!isGhost) {
      onHover?.(element.id);
    }
  }

  function handlePointerLeave() {
    if (!isGhost) {
      onHover?.(null);
    }
  }
</script>

<g
  class="mandala-element"
  class:selected={isSelected}
  class:hovered={isHovered}
  class:ghost={isGhost}
  {transform}
  onpointerdown={handlePointerDown}
  onpointerenter={handlePointerEnter}
  onpointerleave={handlePointerLeave}
  role="button"
  tabindex={isGhost ? -1 : 0}
>
  <!-- Selection/hover ring -->
  {#if (isSelected || isHovered) && !isGhost}
    <circle
      r={selectionRadius}
      fill="none"
      stroke={isSelected
        ? "var(--theme-accent, #4a9eff)"
        : "var(--theme-stroke, rgba(255,255,255,0.3))"}
      stroke-width={isSelected ? 2 : 1}
      stroke-dasharray={isSelected ? "none" : "4 2"}
    />
  {/if}

  <!-- Element content -->
  {#if element.type === "gridDot"}
    <circle r="8" fill={element.color} />
  {:else if element.svgContent}
    <!-- Render SVG content -->
    <g class="svg-content" style:color={element.color}>
      {@html element.svgContent}
    </g>
  {:else}
    <!-- Placeholder for elements without SVG -->
    <rect
      x="-25"
      y="-25"
      width="50"
      height="50"
      fill={element.color}
      opacity="0.5"
      rx="4"
    />
    <text
      text-anchor="middle"
      dominant-baseline="middle"
      font-size="10"
      fill="white"
    >
      {element.type === "arrow" ? "A" : "S"}
    </text>
  {/if}
</g>

<style>
  .mandala-element {
    cursor: grab;
    transition: opacity 0.15s ease;
  }

  .mandala-element:active {
    cursor: grabbing;
  }

  .mandala-element.ghost {
    opacity: 0.4;
    pointer-events: none;
    cursor: default;
  }

  .mandala-element.selected {
    filter: drop-shadow(0 0 4px var(--theme-accent, #4a9eff));
  }

  /* SVG content inherits color */
  .svg-content :global(svg) {
    overflow: visible;
  }

  /* Center the SVG within the transform group */
  .svg-content :global(svg) {
    transform: translate(-50%, -50%);
  }
</style>

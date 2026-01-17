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

  // Get center point for proper centering
  // Use stored center if available, otherwise calculate from viewBox
  const centerX = $derived(
    element.center?.x ?? (element.viewBox?.width ?? 100) / 2
  );
  const centerY = $derived(
    element.center?.y ?? (element.viewBox?.height ?? 100) / 2
  );

  // Transform string for positioning - position at element location
  const transform = $derived(
    `translate(${element.position.x}, ${element.position.y}) rotate(${element.rotation}) scale(${element.scale})`
  );

  // Selection ring radius based on element dimensions or type
  const selectionRadius = $derived.by(() => {
    if (element.type === "gridDot") return 15;
    if (element.viewBox) {
      // Use larger dimension for selection ring
      const maxDim = Math.max(element.viewBox.width, element.viewBox.height);
      return Math.min(maxDim / 2, 150); // Cap at reasonable size
    }
    return 60; // Default for arrows
  });

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
    <!-- Render SVG content with proper centering -->
    <!-- Translate by negative center to align SVG's center point with position -->
    <g class="svg-content" transform="translate({-centerX}, {-centerY})">
      {@html element.svgContent}
    </g>
  {:else}
    <!-- Loading placeholder - show spinner while SVG loads -->
    <g class="loading-placeholder">
      <circle
        r="30"
        fill="none"
        stroke={element.color}
        stroke-width="3"
        stroke-dasharray="20 10"
        opacity="0.5"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0"
          to="360"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>
      <text
        text-anchor="middle"
        dominant-baseline="middle"
        font-size="14"
        fill={element.color}
        opacity="0.7"
      >
        {element.type === "arrow" ? "↻" : "⊛"}
      </text>
    </g>
  {/if}
</g>

<style>
  .mandala-element {
    cursor: grab;
    transition: opacity var(--duration-fast) ease;
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

  /* SVG content styling */
  .svg-content :global(svg) {
    overflow: visible;
  }

  .loading-placeholder {
    pointer-events: none;
  }
</style>

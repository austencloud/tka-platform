<script lang="ts">
  import {
    CARDINAL_GRID_DOTS,
    INTERCARDINAL_GRID_DOTS,
    CANVAS_CENTER,
  } from "../../domain/constants/symmetry-constants";

  interface Props {
    showIntercardinal?: boolean;
    dotRadius?: number;
    dotColor?: string;
    dotOpacity?: number;
  }

  let {
    showIntercardinal = true,
    dotRadius = 6,
    dotColor = "currentColor",
    dotOpacity = 0.3,
  }: Props = $props();

  const allDots = $derived(
    showIntercardinal
      ? [...CARDINAL_GRID_DOTS, ...INTERCARDINAL_GRID_DOTS]
      : CARDINAL_GRID_DOTS
  );
</script>

<g class="grid-dot-overlay">
  <!-- Center dot (larger) -->
  <circle
    cx={CANVAS_CENTER.x}
    cy={CANVAS_CENTER.y}
    r={dotRadius * 1.5}
    fill={dotColor}
    opacity={dotOpacity * 1.2}
  />

  <!-- Grid dots -->
  {#each allDots as dot (dot.id)}
    <circle
      cx={dot.x}
      cy={dot.y}
      r={dotRadius}
      fill={dotColor}
      opacity={dotOpacity}
    />
  {/each}
</g>

<style>
  .grid-dot-overlay {
    pointer-events: none;
  }
</style>

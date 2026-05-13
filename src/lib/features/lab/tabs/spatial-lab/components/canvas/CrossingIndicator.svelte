<svelte:options namespace="svg" />

<script lang="ts">
  import type { Point2D } from "../../services/body-rotation-solver";

  interface Props {
    crossing: Point2D | null;
    visible: boolean;
  }

  let { crossing, visible }: Props = $props();
</script>

{#if visible && crossing}
  <circle
    cx={crossing.x} cy={crossing.y} r={7}
    fill="#ffcc00" opacity="0.8" filter="url(#glow)"
  >
    <animate attributeName="r" values="5;9;5" dur="1.5s" repeatCount="indefinite" />
  </circle>
  <text
    x={crossing.x} y={crossing.y - 16}
    text-anchor="middle" fill="#ffcc00" font-size="9" font-family="system-ui" opacity="0.7"
  >CROSSING</text>
{/if}

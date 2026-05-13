<svelte:options namespace="svg" />

<script lang="ts">
  import { PLANE_1_Y, PLANE_2_Y, GRID_POINTS_P1, GRID_POINTS_P2 } from "../../state/spatial-lab-constants";

  interface Props {
    planeSplitActive: boolean;
  }

  let { planeSplitActive }: Props = $props();
</script>

<!-- Plane 1 -->
<line
  x1={80} y1={PLANE_1_Y} x2={520} y2={PLANE_1_Y}
  stroke={planeSplitActive ? "#4a9eff" : "#ffcc00"}
  stroke-width="2"
  opacity="0.5"
/>
<text
  x={535} y={PLANE_1_Y + 4}
  fill={planeSplitActive ? "#4a9eff" : "#ffcc00"}
  font-size="10" opacity="0.5" font-family="system-ui"
>{planeSplitActive ? "plane 1" : "wall plane"}</text>

{#each GRID_POINTS_P1 as pt}
  <circle cx={pt.x} cy={pt.y} r={5} fill="#444" />
  <text x={pt.x} y={pt.y - 12} text-anchor="middle" fill="#555" font-size="10" font-family="system-ui">{pt.name}</text>
{/each}

<!-- Plane 2 -->
{#if planeSplitActive}
  <line
    x1={80} y1={PLANE_2_Y} x2={520} y2={PLANE_2_Y}
    stroke="#ff4a4a" stroke-width="2" opacity="0.5"
    style="transition: opacity 0.3s"
  />
  <text
    x={535} y={PLANE_2_Y + 4}
    fill="#ff4a4a" font-size="10" opacity="0.5" font-family="system-ui"
  >plane 2</text>
  {#each GRID_POINTS_P2 as pt}
    <circle cx={pt.x} cy={pt.y} r={5} fill="#443030" />
    <text x={pt.x} y={pt.y + 16} text-anchor="middle" fill="#664444" font-size="10" font-family="system-ui">{pt.name}</text>
  {/each}
{/if}

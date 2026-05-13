<svelte:options namespace="svg" />

<script lang="ts">
  import type { ProjectedGridPoint } from "../../services/projection";

  interface Props {
    gridPoints: ProjectedGridPoint[];
    planeSplitActive: boolean;
  }

  let { gridPoints, planeSplitActive }: Props = $props();

  let plane1Points = $derived(gridPoints.filter((p) => !p.name.includes("P2")));
  let plane2Points = $derived(gridPoints.filter((p) => p.name.includes("P2")));

  function avgY(pts: ProjectedGridPoint[]): number {
    if (pts.length === 0) return 330;
    return pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
  }

  let p1Y = $derived(avgY(plane1Points));
  let p2Y = $derived(avgY(plane2Points));
</script>

<line
  x1={80} y1={p1Y} x2={520} y2={p1Y}
  stroke={planeSplitActive ? "#4a9eff" : "#ffcc00"}
  stroke-width="2"
  opacity="0.5"
/>
<text
  x={535} y={p1Y + 4}
  fill={planeSplitActive ? "#4a9eff" : "#ffcc00"}
  font-size="10" opacity="0.5" font-family="system-ui"
>{planeSplitActive ? "plane 1" : "wall plane"}</text>

{#each plane1Points as pt}
  <circle cx={pt.x} cy={pt.y} r={5} fill="#444" />
  <text x={pt.x} y={pt.y - 12} text-anchor="middle" fill="#555" font-size="10" font-family="system-ui">{pt.name}</text>
{/each}

{#if planeSplitActive}
  <line
    x1={80} y1={p2Y} x2={520} y2={p2Y}
    stroke="#ff4a4a" stroke-width="2" opacity="0.5"
    style="transition: opacity 0.3s"
  />
  <text
    x={535} y={p2Y + 4}
    fill="#ff4a4a" font-size="10" opacity="0.5" font-family="system-ui"
  >plane 2</text>
  {#each plane2Points as pt}
    <circle cx={pt.x} cy={pt.y} r={5} fill="#443030" />
    <text x={pt.x} y={pt.y + 16} text-anchor="middle" fill="#664444" font-size="10" font-family="system-ui">{pt.name.replace("·P2", "")}</text>
  {/each}
{/if}

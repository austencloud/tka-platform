<script lang="ts">
  import type { PerformerPose } from "../domain/stage-types";

  interface Props {
    from: PerformerPose;
    to: PerformerPose;
    color: string;
    stageWidth: number;
    stageDepth: number;
    canvasWidth: number;
    canvasHeight: number;
  }

  let { from, to, color, stageWidth, stageDepth, canvasWidth, canvasHeight }: Props = $props();

  const margin = 40;
  const x1 = $derived(margin + (from.x / stageWidth) * (canvasWidth - margin * 2));
  const y1 = $derived(margin + (from.z / stageDepth) * (canvasHeight - margin * 2));
  const x2 = $derived(margin + (to.x / stageWidth) * (canvasWidth - margin * 2));
  const y2 = $derived(margin + (to.z / stageDepth) * (canvasHeight - margin * 2));
</script>

<line
  {x1} {y1} {x2} {y2}
  stroke="{color}88"
  stroke-width="1.5"
  stroke-dasharray="4 6"
  marker-end="url(#arrowhead-{color.slice(1)})"
/>

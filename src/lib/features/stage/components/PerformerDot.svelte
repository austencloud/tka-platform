<script lang="ts">
  import type { PerformerPose } from "../domain/stage-types";

  interface Props {
    pose: PerformerPose;
    color: string;
    index: number;
    stageWidth: number;
    stageDepth: number;
    canvasWidth: number;
    canvasHeight: number;
    isSelected: boolean;
    onDrag: (x: number, z: number) => void;
    onSelect: () => void;
  }

  let { pose, color, index, stageWidth, stageDepth, canvasWidth, canvasHeight, isSelected, onDrag, onSelect }: Props = $props();

  const margin = 40;

  const cx = $derived(margin + (pose.x / stageWidth) * (canvasWidth - margin * 2));
  const cy = $derived(margin + (pose.z / stageDepth) * (canvasHeight - margin * 2));

  let isDragging = $state(false);

  function handlePointerDown(e: PointerEvent) {
    isDragging = true;
    onSelect();
    (e.target as SVGElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isDragging) return;
    const svg = (e.target as SVGElement).closest("svg")!;
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const x = ((mouseX - margin) / (canvasWidth - margin * 2)) * stageWidth;
    const z = ((mouseY - margin) / (canvasHeight - margin * 2)) * stageDepth;
    onDrag(x, z);
  }

  function handlePointerUp() {
    isDragging = false;
  }
</script>

<g
  class="performer-dot"
  class:selected={isSelected}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  role="button"
  tabindex="0"
>
  <circle cx={cx} cy={cy} r={18} fill="{color}22" />
  <circle cx={cx} cy={cy} r={14} fill={color} stroke={isSelected ? "#fff" : "#ffffff44"} stroke-width={isSelected ? 2.5 : 1.5} />
  <text x={cx} y={cy} text-anchor="middle" dominant-baseline="central" fill="#000" font-size="11" font-weight="bold">
    {index + 1}
  </text>
</g>

<style>
  .performer-dot {
    cursor: grab;
  }
  .performer-dot:active {
    cursor: grabbing;
  }
</style>

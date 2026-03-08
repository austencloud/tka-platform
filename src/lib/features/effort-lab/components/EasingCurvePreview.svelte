<script lang="ts">
  import type { EffortQuality } from "../domain/effort-qualities";
  import type { EffortParams } from "../domain/effort-easing";
  import { sampleEasingCurve } from "../domain/effort-easing";

  interface Props {
    quality: EffortQuality;
    color: string;
    params?: EffortParams;
    width?: number;
    height?: number;
  }

  const { quality, color, params, width = 120, height = 40 }: Props = $props();

  const padding = 4;
  const innerW = $derived(width - padding * 2);
  const innerH = $derived(height - padding * 2);

  const samples = $derived(sampleEasingCurve(quality, 48, params));

  const yExtent = $derived.by(() => {
    let min = 0;
    let max = 1;
    for (const s of samples) {
      if (s.value < min) min = s.value;
      if (s.value > max) max = s.value;
    }
    return { min, max };
  });

  const curvePath = $derived.by(() => {
    const { min, max } = yExtent;
    const range = max - min || 1;

    return samples
      .map((s, i) => {
        const x = padding + s.t * innerW;
        const y = padding + innerH - ((s.value - min) / range) * innerH;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  });

  const referenceLine = $derived.by(() => {
    const { min, max } = yExtent;
    const range = max - min || 1;

    const x1 = padding;
    const y1 = padding + innerH - ((0 - min) / range) * innerH;
    const x2 = padding + innerW;
    const y2 = padding + innerH - ((1 - min) / range) * innerH;

    return `M${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)}`;
  });
</script>

<svg
  {width}
  {height}
  viewBox="0 0 {width} {height}"
  role="img"
  aria-label="{quality} easing curve"
  class="easing-curve-preview"
>
  <rect
    x="0"
    y="0"
    {width}
    {height}
    rx="6"
    ry="6"
    fill="rgba(0,0,0,0.2)"
  />

  <path
    d={referenceLine}
    fill="none"
    stroke="rgba(255,255,255,0.15)"
    stroke-width="1"
    stroke-dasharray="3,3"
  />

  <path
    d={curvePath}
    fill="none"
    stroke={color}
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>

<style>
  .easing-curve-preview {
    display: block;
    flex-shrink: 0;
  }
</style>

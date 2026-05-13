<svelte:options namespace="svg" />

<script lang="ts">
  interface Props {
    cx: number;
    cy: number;
    radius: number;
    gradientId: string;
    color: string;
    visible: boolean;
  }

  let { cx, cy, radius, gradientId, color, visible }: Props = $props();
</script>

{#if visible}
  <circle {cx} {cy} r={radius} fill="url(#{gradientId})" />
  <circle {cx} {cy} r={radius} fill="none" stroke={color} stroke-width="1" stroke-dasharray="4,6" opacity="0.3" />
{/if}

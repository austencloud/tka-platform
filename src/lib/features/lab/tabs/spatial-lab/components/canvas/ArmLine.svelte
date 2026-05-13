<svelte:options namespace="svg" />

<script lang="ts">
  interface Props {
    shoulderX: number;
    shoulderY: number;
    propX: number;
    propY: number;
    color: string;
    visible: boolean;
  }

  let { shoulderX, shoulderY, propX, propY, color, visible }: Props = $props();
</script>

{#if visible}
  <line
    x1={shoulderX} y1={shoulderY}
    x2={propX} y2={propY}
    stroke={color} stroke-width="1.5" stroke-dasharray="6,4" opacity="0.5"
  />
{/if}

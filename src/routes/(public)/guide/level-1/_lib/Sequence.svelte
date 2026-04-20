<script lang="ts">
  interface Props {
    columns?: number;
    gap?: string;
    children?: import('svelte').Snippet;
  }
  let { columns, gap = '0', children }: Props = $props();
</script>

<div
  class="sequence"
  style:--cols={columns ?? 'auto-fit'}
  style:--gap={gap}
>
  {@render children?.()}
</div>

<style>
  .sequence {
    display: grid;
    grid-template-columns: repeat(var(--cols, auto-fit), minmax(0, 1fr));
    gap: var(--gap);
    align-items: center;
    justify-items: center;
  }
</style>

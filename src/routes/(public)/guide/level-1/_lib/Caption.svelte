<script lang="ts">
  interface Props {
    children?: import('svelte').Snippet;
    align?: 'center' | 'left';
  }
  let { children, align = 'center' }: Props = $props();
</script>

<p class="caption" style:text-align={align}>
  {@render children?.()}
</p>

<style>
  .caption {
    font-style: italic;
    font-size: 1.25rem;
    margin: 0.7rem 0 0.2rem;
  }
</style>

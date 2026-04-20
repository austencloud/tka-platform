<script lang="ts">
  interface Props {
    pageNumber: number;
    title?: string;
    children?: import('svelte').Snippet;
  }
  let { pageNumber, title, children }: Props = $props();
</script>

<article class="text-page" data-page={pageNumber}>
  {#if title}<h1 class="title">{title}</h1>{/if}
  <div class="body">
    {@render children?.()}
  </div>
</article>

<style>
  .text-page {
    width: 8.5in;
    min-height: 11in;
    max-width: 100%;
    margin: 0 auto 2rem;
    padding: 1in 0.9in;
    background: white;
    color: #1a1a1a;
    box-shadow: 0 4px 24px rgba(0,0,0,0.12);
    box-sizing: border-box;
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: 17px;
    line-height: 1.45;
  }
  .title {
    font-style: italic;
    font-weight: 500;
    font-size: 3rem;
    text-align: center;
    margin: 0 0 1.5rem;
  }
  .body :global(p) {
    margin: 0 0 1em;
  }
  .body :global(p.center) { text-align: center; }
  .body :global(p.lead) { font-size: 1.15rem; text-align: center; }
</style>

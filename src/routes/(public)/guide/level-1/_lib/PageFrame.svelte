<script lang="ts">
  interface Props {
    pageNumber: number;
    title?: string;
    children?: import('svelte').Snippet;
  }
  let { pageNumber, title, children }: Props = $props();
</script>

<article class="page" data-page={pageNumber}>
  {#if title}
    <h1 class="page-title">{title}</h1>
  {/if}
  {@render children?.()}
</article>

<style>
  .page {
    /* Approximate US Letter at screen scale; tune later for print */
    width: 8.5in;
    min-height: 11in;
    max-width: 100%;
    margin: 0 auto 2rem;
    padding: 0.6in 0.75in;
    background: white;
    color: #1a1a1a;
    box-shadow: 0 4px 24px rgba(0,0,0,0.12);
    box-sizing: border-box;
    font-family: Cambria, 'Hoefler Text', 'Liberation Serif', Georgia, serif;
    font-size: 16px;
    line-height: 1.35;
  }

  .page-title {
    font-family: 'Monotype Corsiva', 'Apple Chancery', 'Snell Roundhand', 'URW Chancery L', cursive;
    font-style: italic;
    font-weight: 400;
    font-size: 3rem;
    text-align: center;
    margin: 0 0 0.4em;
    letter-spacing: 0.005em;
  }
</style>

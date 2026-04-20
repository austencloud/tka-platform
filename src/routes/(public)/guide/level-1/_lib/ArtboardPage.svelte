<script lang="ts">
  interface Props {
    src: string;
    pageNumber: number;
    label?: string;
  }
  let { src, pageNumber, label }: Props = $props();
</script>

<article class="artboard-page" data-page={pageNumber}>
  <img class="artboard" {src} alt={label ?? `Page ${pageNumber}`} loading="lazy" />
</article>

<style>
  .artboard-page {
    width: 8.5in;
    max-width: 100%;
    margin: 0 auto 2rem;
    background: white;
    box-shadow: 0 4px 24px rgba(0,0,0,0.12);
  }

  .artboard {
    display: block;
    width: 100%;
    height: auto;
  }
</style>

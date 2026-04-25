<script lang="ts">
  let {
    src,
    alt,
    caption,
    maxWidth = "500px",
  }: {
    src: string;
    alt: string;
    caption?: string;
    maxWidth?: string;
  } = $props();
</script>

<figure class="guide-diagram">
  <img {src} {alt} style:max-width={maxWidth} loading="lazy" />
  {#if caption}
    <figcaption>{caption}</figcaption>
  {/if}
</figure>

<script lang="ts">
  interface Props {
    src: string;
    alt?: string;
    size?: 'sm' | 'md' | 'lg';
  }
  let { src, alt = '', size = 'md' }: Props = $props();
</script>

<img class="pictograph {size}" {src} {alt} loading="lazy" />

<style>
  .pictograph {
    display: block;
    width: 100%;
    height: auto;
    object-fit: contain;
    /* Pictographs in the source PNGs already include the bordered grid */
  }
  .sm { max-width: 90px; }
  .md { max-width: 140px; }
  .lg { max-width: 200px; }
</style>

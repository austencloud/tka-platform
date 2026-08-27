<script lang="ts">
  interface Props {
    imageUrls: string[];
    productName: string;
  }

  let { imageUrls, productName }: Props = $props();
</script>

{#if imageUrls.length > 0}
  <div class="carousel-wrapper">
    <h3 class="carousel-title">Sample Cards</h3>
    <div class="carousel themed-scrollbar">
      {#each imageUrls as url, i}
        <img
          src={url}
          alt="{productName} card {i + 1}"
          class="sample-card"
          loading="lazy"
        />
      {/each}
    </div>
  </div>
{/if}

<style>
  .carousel-wrapper {
    margin-top: 32px;
  }

  .carousel-title {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 16px;
  }

  .carousel {
    display: flex;
    gap: 16px;
    overflow-x: auto;
    padding-bottom: 12px;
    scroll-snap-type: x mandatory;
  }

  .sample-card {
    width: 180px;
    height: auto;
    border-radius: 8px;
    scroll-snap-align: start;
    flex-shrink: 0;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }
</style>

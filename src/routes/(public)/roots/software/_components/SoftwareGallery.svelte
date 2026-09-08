<script lang="ts">
  interface Screenshot {
    src: string;
    alt: string;
    caption: string;
    width: number;
    height: number;
    shape?: "phone" | "wide";
  }

  interface Props {
    label: string;
    images: Screenshot[];
    variant: "phone" | "wide" | "mixed";
  }

  let { label, images, variant }: Props = $props();
</script>

<div
  class="gallery-shell"
  class:two={images.length === 2}
  class:four={images.length === 4}
>
  {#if images.length > 1 && variant !== "mixed"}
    <p class="gallery-hint">Swipe through the screenshots</p>
  {/if}

  <!-- svelte-ignore a11y_no_noninteractive_tabindex (The labeled scroll region needs keyboard focus so arrow keys can pan it.) -->
  <div
    class="gallery-rail themed-scrollbar"
    class:phone={variant === "phone"}
    class:wide={variant === "wide"}
    class:mixed={variant === "mixed"}
    role="region"
    aria-label={label}
    tabindex={images.length > 1 && variant !== "mixed" ? 0 : undefined}
  >
    {#each images as image (image.src)}
      <figure class:phone-shot={image.shape === "phone"}>
        <img
          src={image.src}
          alt={image.alt}
          loading="lazy"
          width={image.width}
          height={image.height}
        />
        <figcaption>{image.caption}</figcaption>
      </figure>
    {/each}
  </div>
</div>

<style>
  .gallery-shell {
    width: 100%;
    min-width: 0;
    container-type: inline-size;
  }

  .gallery-hint {
    margin: 0 0 0.65rem;
    color: var(--theme-text-dim, #a7a8b5);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 620;
    letter-spacing: 0.02em;
  }

  .gallery-rail {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: min(84cqw, 21rem);
    gap: var(--spacing-md, 1rem);
    align-items: start;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: inline proximity;
    scroll-padding-inline: 1px;
    scrollbar-gutter: stable;
    padding: 1px 0 var(--spacing-sm, 0.75rem);
  }

  .gallery-rail.wide {
    grid-auto-columns: min(90cqw, 68.75rem);
  }

  .gallery-rail.mixed {
    grid-auto-flow: row;
    grid-template-columns: minmax(0, 1fr);
    overflow: visible;
  }

  figure {
    min-width: 0;
    margin: 0;
    scroll-snap-align: start;
  }

  .mixed .phone-shot {
    width: min(64cqw, 15rem);
    justify-self: center;
  }

  img {
    display: block;
    width: 100%;
    height: auto;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: var(--radius-2026-lg, 18px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    box-shadow: 0 18px 52px rgba(5, 6, 14, 0.24);
  }

  figcaption {
    margin-top: 0.55rem;
    color: var(--theme-text-dim, #a7a8b5);
    font-size: var(--font-size-compact, 0.75rem);
    line-height: 1.4;
    text-align: center;
  }

  @container (min-width: 44rem) {
    .gallery-hint {
      display: none;
    }

    .gallery-rail {
      grid-auto-flow: row;
      grid-auto-columns: initial;
      grid-template-columns: repeat(2, minmax(0, 17rem));
      justify-content: start;
      overflow: visible;
      padding-bottom: 0;
    }

    .gallery-rail.wide {
      grid-template-columns: minmax(0, 68.75rem);
    }

    .gallery-rail.mixed {
      grid-template-columns: minmax(12rem, 16rem) minmax(0, 48rem);
      gap: clamp(1.25rem, 2.4cqw, 2.25rem);
    }

    .mixed .phone-shot {
      width: auto;
      justify-self: stretch;
    }
  }

  @container (min-width: 62rem) {
    .four .gallery-rail.phone {
      grid-template-columns: repeat(4, minmax(0, 15.5rem));
    }

    .two .gallery-rail.phone {
      grid-template-columns: repeat(2, minmax(0, 18rem));
    }
  }
</style>

<!--
SequenceCardMedia - Media display component for SequenceCard

Displays:
1. Image thumbnail (if coverUrl provided)
2. Letter placeholder (fallback)

Ultra-minimal design: Clean display with responsive images.
-->
<script lang="ts">
  import {
    generateSrcset,
    generateSizes,
  } from "$lib/shared/components/thumbnail/srcset-utils";

  const {
    coverUrl = undefined,
    word,
    width = undefined,
    height = undefined,
  } = $props<{
    coverUrl?: string | undefined;
    word: string;
    width?: number | undefined;
    height?: number | undefined;
  }>();

  // Generate responsive srcset for gallery images
  const imageSrcset = $derived(generateSrcset(coverUrl));
  const imageSizes = $derived(generateSizes("grid"));
</script>

<div class="media">
  <div class="media-content">
    <div class="media-wrapper">
      {#if coverUrl}
        <img
          src={coverUrl}
          srcset={imageSrcset}
          sizes={imageSizes}
          alt={`Preview of ${word}`}
          {width}
          {height}
          loading="lazy"
          decoding="async"
        />
      {:else}
        <div class="media-placeholder" aria-label="Sequence preview missing">
          <span>{word?.slice(0, 1) ?? "?"}</span>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .media {
    position: relative;
    width: 100%;
    background: var(--theme-card-bg, var(--theme-card-bg));
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .media-content {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .media-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .media img {
    width: 100%;
    height: auto;
    display: block;
    max-width: 100%;
  }

  .media-placeholder {
    width: 100%;
    aspect-ratio: 4 / 3;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(
      135deg,
      var(--theme-card-hover-bg),
      var(--theme-panel-bg)
    );
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: 4rem;
    font-weight: 700;
  }

  /* Container query responsive sizing */
  @container sequence-card (max-width: 249px) {
    .media-placeholder {
      font-size: 2.5rem;
    }
  }

  @container sequence-card (min-width: 252px) and (max-width: 299px) {
    .media-placeholder {
      font-size: 3.25rem;
    }
  }
</style>

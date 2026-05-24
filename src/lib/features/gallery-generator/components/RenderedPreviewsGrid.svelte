<!--
  Rendered Previews Grid

  Right column showing rendered image previews.
  Shows blob URLs directly (not PropAwareThumbnail which would fetch from cloud).
-->
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import { galleryGeneratorState } from "../state/gallery-generator-state.svelte";

  const state = galleryGeneratorState;

  function handleCardClick(img: { name: string; imageUrl: string }) {
    if (img.imageUrl) {
      state.setViewingImage({ name: img.name, url: img.imageUrl });
    }
  }

  function closeLightbox() {
    state.setViewingImage(null);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && state.viewingImage) {
      closeLightbox();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="column preview-column">
  <h2>{t('gallery_gen_rendered_heading', { count: String(state.renderedImages.length) })}</h2>

  {#if state.renderedImages.length === 0}
    <p class="empty-message">{t('gallery_gen_rendered_empty')}</p>
  {:else}
    <div class="preview-grid">
      {#each state.renderedImages as img (img.name)}
        <button
          class="preview-card"
          class:written={img.written}
          onclick={() => handleCardClick(img)}
        >
          <img src={img.imageUrl} alt={img.name} loading="lazy" />
          <span class="card-label">{img.name}</span>
          <span class="status-badge" class:written={img.written}>
            {img.written ? t('gallery_gen_written') : t('gallery_gen_preview')}
          </span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<!-- Simple lightbox for full-size image viewing -->
{#if state.viewingImage}
  <button
    class="lightbox-overlay"
    onclick={closeLightbox}
    aria-label={t('gallery_gen_close_lightbox')}
  >
    <div class="lightbox-content" onclick={(e) => e.stopPropagation()} role="presentation">
      <img src={state.viewingImage.url} alt={state.viewingImage.name} />
      <p class="lightbox-title">{state.viewingImage.name}</p>
      <span class="lightbox-close" aria-hidden="true">×</span>
    </div>
  </button>
{/if}

<style>
  .column {
    background: var(--theme-panel-bg, #18181b);
    border-radius: 10px;
    padding: 1rem;
  }

  .column h2 {
    margin: 0 0 0.75rem 0;
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 600;
    color: var(--theme-text-dim, #a1a1aa);
  }

  .preview-column {
    max-height: 75vh;
    overflow-y: auto;
  }

  .preview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.5rem;
  }

  .preview-card {
    position: relative;
    border-radius: 8px;
    border: 2px solid var(--semantic-warning, #f59e0b);
    background: #1a1a2e;
    padding: 0;
    cursor: pointer;
    overflow: hidden;
    transition: transform var(--duration-fast) ease;
  }

  .preview-card:hover {
    transform: scale(1.02);
  }

  .preview-card.written {
    border-color: var(--semantic-success, #22c55e);
  }

  .preview-card img {
    width: 100%;
    aspect-ratio: 4 / 3;
    object-fit: contain;
    display: block;
    background: #1a1a2e;
  }

  .card-label {
    display: block;
    padding: 0.25rem 0.5rem;
    font-size: 0.7rem;
    color: #a1a1aa;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .status-badge {
    position: absolute;
    bottom: 1.75rem;
    right: 0.25rem;
    font-size: 0.65rem;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    font-weight: 500;
    background: rgba(245, 158, 11, 0.9);
    color: #000;
  }

  .status-badge.written {
    background: rgba(34, 197, 94, 0.9);
    color: #000;
  }

  .empty-message {
    color: var(--theme-text-dim, #52525b);
    padding: 3rem 2rem;
    text-align: center;
    font-size: var(--font-size-sm, 0.875rem);
  }

  /* Lightbox styles */
  .lightbox-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--z-modal);
    border: none;
    padding: 0;
    cursor: pointer;
  }

  .lightbox-content {
    position: relative;
    max-width: 90vw;
    max-height: 90vh;
    cursor: default;
  }

  .lightbox-content img {
    max-width: 100%;
    max-height: 85vh;
    object-fit: contain;
    border-radius: 8px;
  }

  .lightbox-title {
    text-align: center;
    color: #e4e4e7;
    margin: 0.5rem 0 0;
    font-size: 0.875rem;
  }

  .lightbox-close {
    position: absolute;
    top: -2rem;
    right: -1rem;
    width: 2rem;
    height: 2rem;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    font-size: 1.5rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }
</style>

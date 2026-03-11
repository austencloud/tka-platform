<!--
  ShowcaseTab.svelte

  Displays curated Instagram showcase videos.
  Uses VideoCuratorLoader to fetch videos from Firestore.
  Supports category filtering.
-->
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import { onMount } from "svelte";
  import { container } from "$lib/shared/di";
  import type { ShowcaseVideo, VideoCategory } from "$lib/features/landing-preview/types";

  interface Props {
    onVideoClick?: (video: ShowcaseVideo) => void;
  }

  const { onVideoClick }: Props = $props();

  let videos = $state<ShowcaseVideo[]>([]);
  let categories = $state<VideoCategory[]>([]);
  let selectedCategory = $state<string | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Filter to approved, non-excluded videos
  const displayedVideos = $derived(() => {
    let filtered = videos.filter((v) => v.approved && !v.excluded);
    if (selectedCategory) {
      filtered = filtered.filter((v) => v.category === selectedCategory);
    }
    return filtered;
  });

  onMount(() => {
    loadShowcase();
  });

  async function loadShowcase() {
    const loader = container.items.videoCuratorLoader;
    if (!loader) {
      error = t('watch_showcase_curator_unavailable');
      loading = false;
      return;
    }

    loading = true;
    error = null;

    try {
      const [loadedVideos, loadedCategories] = await Promise.all([
        loader.loadVideos(),
        loader.loadCategories(),
      ]);
      videos = loadedVideos;
      categories = loadedCategories;
    } catch (e) {
      console.error("Failed to load showcase videos:", e);
      error = e instanceof Error ? e.message : t('watch_showcase_load_error');
    } finally {
      loading = false;
    }
  }

  function selectCategory(categoryId: string | null) {
    selectedCategory = selectedCategory === categoryId ? null : categoryId;
  }

  function formatDate(date: Date | null): string {
    if (!date) return "";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  }
</script>

<div class="showcase-tab">
  {#if loading}
    <div class="loading-state">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      <span>{t('watch_showcase_loading')}</span>
    </div>
  {:else if error}
    <div class="error-state">
      <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
      <span>{error}</span>
      <button class="retry-btn" onclick={loadShowcase}>
        <i class="fas fa-redo" aria-hidden="true"></i>
        {t('watch_showcase_retry')}
      </button>
    </div>
  {:else}
    <!-- Category Filter -->
    {#if categories.length > 0}
      <div class="category-filter">
        <button
          class="category-chip"
          class:active={selectedCategory === null}
          onclick={() => selectCategory(null)}
        >
          {t('watch_showcase_all')}
        </button>
        {#each categories as category}
          <button
            class="category-chip"
            class:active={selectedCategory === category.id}
            style="--chip-color: {category.color}"
            onclick={() => selectCategory(category.id)}
          >
            {category.label}
          </button>
        {/each}
      </div>
    {/if}

    <!-- Videos Grid -->
    {#if displayedVideos().length === 0}
      <div class="empty-state">
        <i class="fas fa-star" aria-hidden="true"></i>
        <span>{t('watch_showcase_empty')}</span>
        <p class="empty-hint">{t('watch_showcase_empty_hint')}</p>
      </div>
    {:else}
      <div class="videos-grid">
        {#each displayedVideos() as video (video.shortcode)}
          <button
            class="video-card"
            onclick={() => onVideoClick?.(video)}
            type="button"
          >
            <div class="thumbnail">
              <video
                src={video.videoUrl}
                preload="metadata"
                muted
                playsinline
              ></video>
              {#if video.featured}
                <span class="featured-badge">
                  <i class="fas fa-star" aria-hidden="true"></i>
                  {t('watch_showcase_featured')}
                </span>
              {/if}
              <div class="play-overlay">
                <i class="fas fa-play" aria-hidden="true"></i>
              </div>
            </div>

            <div class="info">
              {#if video.title || video.sequenceWord}
                <span class="title">{video.title || video.sequenceWord}</span>
              {/if}
              <div class="meta">
                {#if video.performers.length > 0}
                  <span class="performer">
                    {video.performers.map((p) => p.displayName).join(", ")}
                  </span>
                {/if}
                {#if video.instagramDate}
                  <span class="date">{formatDate(video.instagramDate)}</span>
                {/if}
              </div>
              {#if video.category}
                {@const cat = categories.find((c) => c.id === video.category)}
                {#if cat}
                  <span
                    class="category-badge"
                    style="--cat-color: {cat.color}"
                  >
                    {cat.label}
                  </span>
                {/if}
              {/if}
            </div>
          </button>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .showcase-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
  }

  .loading-state,
  .error-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 4rem 1rem;
    text-align: center;
    color: var(--theme-text-dim, var(--text-secondary));
  }

  .loading-state i,
  .error-state i,
  .empty-state i {
    font-size: 2.5rem;
    opacity: 0.4;
  }

  .error-state {
    color: var(--semantic-error);
  }

  .empty-hint {
    font-size: var(--font-size-compact, 12px);
    opacity: 0.6;
    margin-top: 0.5rem;
  }

  .retry-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 1rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text-dim, var(--text-secondary));
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    transition: all var(--duration-normal, 150ms) ease;
  }

  .retry-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--theme-text, var(--text-primary));
  }

  /* Category Filter */
  .category-filter {
    display: flex;
    gap: 0.5rem;
    padding: 1rem;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .category-filter::-webkit-scrollbar {
    display: none;
  }

  .category-chip {
    flex-shrink: 0;
    padding: 0.5rem 1rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 20px;
    color: var(--theme-text-dim, var(--text-secondary));
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    transition: all var(--duration-normal, 150ms) ease;
  }

  .category-chip:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--theme-text, var(--text-primary));
  }

  .category-chip.active {
    background: var(--chip-color, var(--theme-accent));
    border-color: var(--chip-color, var(--theme-accent));
    color: white;
  }

  /* Videos Grid */
  .videos-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
    padding: 1rem;
  }

  .video-card {
    position: relative;
    display: flex;
    flex-direction: column;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
    border-radius: 12px;
    overflow: hidden;
    cursor: pointer;
    transition: all var(--duration-normal, 150ms) ease;
    text-align: left;
    padding: 0;
  }

  .video-card:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    transform: translateY(-2px);
    box-shadow: 0 8px 24px var(--theme-shadow, rgba(0, 0, 0, 0.3));
  }

  .video-card:hover .play-overlay {
    opacity: 1;
  }

  .thumbnail {
    position: relative;
    width: 100%;
    aspect-ratio: 9/16;
    background: rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }

  .thumbnail video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .featured-badge {
    position: absolute;
    top: 8px;
    left: 8px;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 600;
    color: black;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .play-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.4);
    opacity: 0;
    transition: opacity var(--duration-normal, 150ms) ease;
  }

  .play-overlay i {
    font-size: 2rem;
    color: white;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
  }

  .info {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 0.75rem;
  }

  .title {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text, var(--text-primary));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, var(--text-secondary));
  }

  .performer {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .date {
    flex-shrink: 0;
    opacity: 0.7;
  }

  .category-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    background: color-mix(in srgb, var(--cat-color) 20%, transparent);
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--cat-color);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  @media (max-width: 640px) {
    .category-filter {
      padding: 0.75rem;
    }

    .videos-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 0.75rem;
      padding: 0.75rem;
    }

    .thumbnail {
      aspect-ratio: 9/16;
    }
  }

  @media (max-width: 400px) {
    .videos-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

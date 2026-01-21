<!--
  FeedTab.svelte

  Public video feed with infinite scroll.
  Displays videos from the community using CollaborativeVideoCard.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { container } from "$lib/shared/di";
  import CollaborativeVideoCard from "$lib/shared/video-collaboration/components/CollaborativeVideoCard.svelte";
  import type { CollaborativeVideo } from "$lib/shared/video-collaboration/domain/CollaborativeVideo";
  import { createFeedState } from "../../state/feed-state.svelte";

  interface Props {
    onVideoClick?: (video: CollaborativeVideo) => void;
  }

  const { onVideoClick }: Props = $props();

  const feedState = createFeedState();

  onMount(() => {
    loadVideos();
  });

  async function loadVideos() {
    const videoManager = container.items.collaborativeVideoManager;
    if (!videoManager) {
      feedState.setError("Video service unavailable");
      return;
    }

    feedState.setLoading();

    try {
      const videos = await videoManager.getPublicVideos(20);
      feedState.setVideos(videos, null, videos.length >= 20);
    } catch (e) {
      console.error("Failed to load public videos:", e);
      feedState.setError(e instanceof Error ? e.message : "Failed to load videos");
    }
  }
</script>

<div class="feed-tab">
  {#if feedState.isLoading && feedState.videos.length === 0}
    <div class="loading-state">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      <span>Loading videos...</span>
    </div>
  {:else if feedState.error}
    <div class="error-state">
      <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
      <span>{feedState.error}</span>
      <button class="retry-btn" onclick={loadVideos}>
        <i class="fas fa-redo" aria-hidden="true"></i>
        Retry
      </button>
    </div>
  {:else if feedState.isEmpty}
    <div class="empty-state">
      <i class="fas fa-video-slash" aria-hidden="true"></i>
      <span>No public videos yet</span>
      <p class="empty-hint">Be the first to share a video with the community!</p>
    </div>
  {:else}
    <div class="videos-grid">
      {#each feedState.videos as video (video.id)}
        <CollaborativeVideoCard
          {video}
          onclick={() => onVideoClick?.(video)}
        />
      {/each}
    </div>

    {#if feedState.isLoading}
      <div class="loading-more">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        <span>Loading more...</span>
      </div>
    {/if}
  {/if}
</div>

<style>
  .feed-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 1rem;
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

  .videos-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  .loading-more {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1.5rem;
    color: var(--theme-text-dim, var(--text-secondary));
    font-size: var(--font-size-sm, 14px);
  }

  @media (max-width: 640px) {
    .feed-tab {
      padding: 0.75rem;
    }

    .videos-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

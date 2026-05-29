<!--
  SequenceVideosSection.svelte

  Compact section showing collaborative videos for a sequence.
  Designed to be embedded in sequence detail panels.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { getVideosForSequence } from "$lib/shared/video-collaboration/services/collaborative-video-manager";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import type { CollaborativeVideo } from "../domain/CollaborativeVideo";
  import { onMount } from "svelte";
  import CollaboratorAvatars from "./CollaboratorAvatars.svelte";

  const {
    sequenceId,
    onVideoClick,
    onUploadClick,
  }: {
    sequenceId: string;
    onVideoClick?: (video: CollaborativeVideo) => void;
    onUploadClick?: () => void;
  } = $props();

  const hapticService = getHapticFeedback();
  let videos = $state<CollaborativeVideo[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(() => {
    loadVideos();
  });

  async function loadVideos() {
    try {
      videos = await getVideosForSequence(sequenceId);
    } catch (e) {
      console.error("Failed to load videos:", e);
      error = e instanceof Error ? e.message : "Failed to load";
    } finally {
      loading = false;
    }
  }

  function handleVideoClick(video: CollaborativeVideo) {
    hapticService?.trigger("selection");
    onVideoClick?.(video);
  }

  function handleUploadClick() {
    hapticService?.trigger("selection");
    onUploadClick?.();
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  const hasVideos = $derived(videos.length > 0);
</script>

<div class="videos-section">
  <div class="section-header">
    <h3>
      <i class="fas fa-video" aria-hidden="true"></i>
      Videos
      {#if hasVideos}
        <span class="count">({videos.length})</span>
      {/if}
    </h3>
    {#if onUploadClick}
      <button class="upload-btn" onclick={handleUploadClick}>
        <i class="fas fa-plus" aria-hidden="true"></i>
        <span>Add</span>
      </button>
    {/if}
  </div>

  <div class="section-content">
    {#if loading}
      <div class="loading">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      </div>
    {:else if error}
      <div class="error">
        <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
        <span>{error}</span>
      </div>
    {:else if !hasVideos}
      <div class="empty">
        <p>No videos yet</p>
        {#if onUploadClick}
          <button class="empty-upload-btn" onclick={handleUploadClick}>
            <i class="fas fa-video" aria-hidden="true"></i>
            Record your performance
          </button>
        {/if}
      </div>
    {:else}
      <div class="videos-list">
        {#each videos as video (video.id)}
          <button class="video-item" onclick={() => handleVideoClick(video)}>
            <div class="video-thumbnail">
              {#if video.thumbnailUrl}
                <img src={video.thumbnailUrl} alt="" />
              {:else}
                <div class="thumbnail-placeholder">
                  <i class="fas fa-play" aria-hidden="true"></i>
                </div>
              {/if}
              <span class="duration">{formatDuration(video.duration)}</span>
            </div>
            <div class="video-info">
              <CollaboratorAvatars
                collaborators={video.collaborators}
                size="sm"
                maxVisible={2}
              />
              {#if video.collaborators.length > 1}
                <span class="collab-label">Collab</span>
              {/if}
            </div>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .videos-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .section-header h3 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .section-header h3 i {
    color: var(--text-secondary);
  }

  .count {
    color: var(--text-secondary);
    font-weight: 400;
  }

  .upload-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    background: rgba(59, 130, 246, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 6px;
    color: var(--semantic-info);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .upload-btn:hover {
    background: rgba(59, 130, 246, 0.25);
    border-color: rgba(59, 130, 246, 0.5);
  }

  .section-content {
    min-height: 60px;
  }

  .loading,
  .error,
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1rem;
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.85rem;
  }

  .error {
    color: var(--semantic-error);
  }

  .empty p {
    margin: 0;
  }

  .empty-upload-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    background: linear-gradient(135deg, var(--semantic-info) 0%, #2563eb 100%);
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .empty-upload-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  }

  .videos-list {
    display: flex;
    gap: 0.75rem;
    overflow-x: auto;
    padding-bottom: 0.25rem;
    scrollbar-width: thin;
  }

  .video-item {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0;
    background: none;
    border: none;
    cursor: pointer;
    transition: transform var(--duration-normal) ease;
  }

  .video-item:hover {
    transform: scale(1.02);
  }

  .video-thumbnail {
    position: relative;
    width: 100px;
    height: 56px;
    border-radius: 8px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.3);
  }

  .video-thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .thumbnail-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(
      135deg,
      rgba(59, 130, 246, 0.2) 0%,
      rgba(139, 92, 246, 0.2) 100%
    );
    color: white;
    font-size: 1.25rem;
  }

  .duration {
    position: absolute;
    bottom: 4px;
    right: 4px;
    padding: 0.125rem 0.375rem;
    background: rgba(0, 0, 0, 0.75);
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 600;
    color: white;
  }

  .video-info {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .collab-label {
    font-size: 0.65rem;
    font-weight: 600;
    color: var(--theme-accent-strong);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
</style>

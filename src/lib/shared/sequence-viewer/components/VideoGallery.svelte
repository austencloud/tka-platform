<script lang="ts">
  import { fade } from 'svelte/transition';
  import {
    getVideosForSequence,
    deleteVideo,
  } from '$lib/shared/video-collaboration/services/collaborative-video-manager';
  import type { CollaborativeVideo } from '$lib/shared/video-collaboration/domain/collaborative-video';
  import type { SequenceData } from '$lib/shared/foundation/domain/models/sequence-data';
  import { authState } from '$lib/shared/auth/state/auth-state.svelte';

  interface Props {
    sequence: SequenceData;
    isOwned: boolean;
    isLoggedIn?: boolean;
    onUpload?: () => void;
  }

  let { sequence, isOwned, isLoggedIn = false, onUpload }: Props = $props();

  let videos = $state<CollaborativeVideo[]>([]);
  let loading = $state(true);
  let playingId = $state<string | null>(null);

  /** Get creator display name from the collaborators list */
  function getCreatorName(video: CollaborativeVideo): string {
    const creator = video.collaborators.find(c => c.role === 'creator');
    return creator?.displayName || 'Anonymous';
  }

  $effect(() => {
    const seqId = sequence?.id;
    if (!seqId) {
      videos = [];
      loading = false;
      return;
    }
    loading = true;
    getVideosForSequence(seqId)
      .then((v) => { videos = v; })
      .catch(() => { videos = []; })
      .finally(() => { loading = false; });
  });

  function handlePlay(id: string) {
    playingId = playingId === id ? null : id;
  }

  async function handleDelete(id: string) {
    await deleteVideo(id);
    videos = videos.filter((v) => v.id !== id);
  }
</script>

<div class="video-gallery" in:fade={{ duration: 200 }}>
  {#if loading}
    <div class="gallery-empty">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      <span>Loading videos...</span>
    </div>
  {:else if videos.length === 0}
    <div class="gallery-empty">
      <i class="fas fa-video" aria-hidden="true"></i>
      <span>No videos yet</span>
      {#if isLoggedIn && onUpload}
        <button type="button" class="upload-btn" onclick={onUpload}>
          <i class="fas fa-upload" aria-hidden="true"></i>
          Record your performance
        </button>
      {:else if !isLoggedIn}
        <span class="sign-in-hint">Sign in to upload performances</span>
      {/if}
    </div>
  {:else}
    <div class="gallery-header">
      <span class="gallery-count">{videos.length} video{videos.length !== 1 ? 's' : ''}</span>
      {#if onUpload}
        <button type="button" class="upload-btn-sm" onclick={onUpload}>
          <i class="fas fa-plus" aria-hidden="true"></i>
          Upload
        </button>
      {/if}
    </div>
    <div class="gallery-grid">
      {#each videos as video (video.id)}
        <div class="video-card">
          {#if playingId === video.id}
            <!-- svelte-ignore a11y_media_has_caption -->
            <video
              src={video.videoUrl}
              class="video-player"
              controls
              autoplay
              onended={() => { playingId = null; }}
            ></video>
          {:else}
            <button
              type="button"
              class="video-thumb"
              onclick={() => handlePlay(video.id)}
              aria-label="Play video by {getCreatorName(video)}"
            >
              {#if video.thumbnailUrl}
                <img src={video.thumbnailUrl} alt="" class="thumb-img" />
              {:else}
                <div class="thumb-placeholder">
                  <i class="fas fa-play" aria-hidden="true"></i>
                </div>
              {/if}
              <div class="thumb-overlay">
                <i class="fas fa-play" aria-hidden="true"></i>
              </div>
            </button>
          {/if}
          <div class="video-meta">
            <span class="video-uploader">{getCreatorName(video)}</span>
            {#if isOwned && video.creatorId === authState.user?.uid}
              <button
                type="button"
                class="video-delete"
                onclick={() => handleDelete(video.id)}
                aria-label="Delete video"
              >
                <i class="fas fa-trash-alt" aria-hidden="true"></i>
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .video-gallery {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 16px;
    overflow-y: auto;
  }

  .gallery-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-size: var(--font-size-sm, 14px);
  }

  .gallery-empty i {
    font-size: 32px;
    opacity: 0.5;
  }

  .sign-in-hint {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.35));
    font-size: var(--font-size-xs, 12px);
  }

  .upload-btn {
    margin-top: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border-radius: 8px;
    background: var(--theme-accent, #6366f1);
    border: none;
    color: white;
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: opacity 120ms ease;
  }

  .upload-btn:hover {
    opacity: 0.85;
  }

  .gallery-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .gallery-count {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .upload-btn-sm {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-xs, 12px);
    cursor: pointer;
    transition: background 100ms ease;
  }

  .upload-btn-sm:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .gallery-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
  }

  .video-card {
    border-radius: 8px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .video-thumb {
    position: relative;
    width: 100%;
    aspect-ratio: 16/9;
    background: black;
    border: none;
    padding: 0;
    cursor: pointer;
    display: block;
  }

  .thumb-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .thumb-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.3);
    font-size: 24px;
  }

  .thumb-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.3);
    color: white;
    font-size: 24px;
    opacity: 0;
    transition: opacity 150ms ease;
  }

  .video-thumb:hover .thumb-overlay {
    opacity: 1;
  }

  .video-player {
    width: 100%;
    aspect-ratio: 16/9;
    background: black;
  }

  .video-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
  }

  .video-uploader {
    font-size: var(--font-size-xs, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .video-delete {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.3);
    cursor: pointer;
    padding: 4px;
    font-size: 12px;
    transition: color 100ms ease;
  }

  .video-delete:hover {
    color: var(--semantic-error, #f87171);
  }
</style>

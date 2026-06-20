<script lang="ts">
  /**
   * VideoFocusGallery
   *
   * One large featured video with thumbnail strip below.
   * Click thumbnail to switch the main video.
   * This is the "not overwhelming" option - shows one video prominently.
   */
  import { onMount, onDestroy } from "svelte";

  interface Video {
    url: string;
    word: string;
  }

  interface Props {
    videos: Video[];
    showThumbnails?: boolean;
  }

  let { videos, showThumbnails = true }: Props = $props();

  let activeIndex = $state(0);
  let mainVideoRef: HTMLVideoElement | null = $state(null);
  let thumbnailVideos: HTMLVideoElement[] = $state([]);
  let playTimeout: ReturnType<typeof setTimeout> | null = null;

  const activeVideo = $derived.by(() => {
    const video = videos[activeIndex] ?? videos[0];
    if (!video) {
      return { url: '', word: '' };
    }
    return video;
  });

  onMount(() => {
    // Start playing main video
    mainVideoRef?.play().catch(() => {});
  });

  function selectVideo(index: number) {
    if (index === activeIndex) return;
    activeIndex = index;
    // Play the new main video after DOM updates
    if (playTimeout) clearTimeout(playTimeout);
    playTimeout = setTimeout(() => {
      mainVideoRef?.play().catch(() => {});
    }, 50);
  }

  // Cancel a pending deferred play() if the component unmounts in the window.
  onDestroy(() => {
    if (playTimeout) {
      clearTimeout(playTimeout);
      playTimeout = null;
    }
  });

  // Action to set up thumbnail video refs
  function thumbnailRef(el: HTMLVideoElement, index: number) {
    thumbnailVideos[index] = el;
    el.currentTime = 1;
  }
</script>

<div class="focus-gallery">
  <!-- Main video -->
  <div class="main-video-container">
    {#key activeIndex}
      <video
        bind:this={mainVideoRef}
        muted
        playsinline
        loop
        controls
        preload="auto"
        aria-label="Performance video of {activeVideo.word}"
      >
        <source src={activeVideo.url} type="video/mp4" />
      </video>
    {/key}
    <div class="main-caption">
      <span class="word-label">Word:</span>
      <span class="word-value">{activeVideo.word}</span>
    </div>
  </div>

  <!-- Thumbnail strip -->
  {#if showThumbnails && videos.length > 1}
    <div class="thumbnail-strip" role="listbox" aria-label="Video selection">
      {#each videos as video, i}
        <button
          class="thumbnail"
          class:active={i === activeIndex}
          onclick={() => selectVideo(i)}
          role="option"
          aria-selected={i === activeIndex}
          aria-label="Select video: {video.word}"
        >
          <video
            use:thumbnailRef={i}
            muted
            playsinline
            preload="metadata"
          >
            <source src={video.url} type="video/mp4" />
          </video>
          <span class="thumb-label">{video.word}</span>
          {#if i === activeIndex}
            <div class="active-indicator">
              <i class="fas fa-play" aria-hidden="true"></i>
            </div>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .focus-gallery {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 600px;
    margin: 0 auto;
  }

  /* Main video */
  .main-video-container {
    position: relative;
    border-radius: 16px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.3);
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
  }

  .main-video-container video {
    width: 100%;
    aspect-ratio: 9 / 16;
    object-fit: cover;
    display: block;
  }

  .main-caption {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.6));
    position: absolute;
    bottom: 40px; /* Above video controls */
    left: 0;
    right: 0;
  }

  .word-label {
    font-size: var(--font-size-sm, 14px);
    color: rgba(255, 255, 255, 0.7);
  }

  .word-value {
    font-family: Georgia, serif;
    font-size: var(--font-size-xl, 24px);
    font-weight: 600;
    color: var(--theme-accent, #6366f1);
  }

  /* Thumbnail strip */
  .thumbnail-strip {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .thumbnail {
    position: relative;
    width: 80px;
    border-radius: 8px;
    overflow: hidden;
    border: 2px solid transparent;
    background: rgba(0, 0, 0, 0.3);
    cursor: pointer;
    transition: all 0.2s ease;
    padding: 0;
  }

  .thumbnail:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.3));
    transform: scale(1.05);
  }

  .thumbnail.active {
    border-color: var(--theme-accent, #6366f1);
  }

  .thumbnail video {
    width: 100%;
    aspect-ratio: 9 / 16;
    object-fit: cover;
    display: block;
    pointer-events: none;
  }

  .thumb-label {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 4px;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
    font-size: 10px;
    color: white;
    text-align: center;
    font-family: Georgia, serif;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .active-indicator {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(99, 102, 241, 0.3);
    color: white;
    font-size: 16px;
  }

  @media (max-width: 500px) {
    .thumbnail {
      width: 60px;
    }

    .thumb-label {
      font-size: var(--font-size-compact, 12px);
    }
  }
</style>

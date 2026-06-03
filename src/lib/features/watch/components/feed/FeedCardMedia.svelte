<!--
  FeedCardMedia

  Handles rendering of video, animation, or pictograph content.
  - Videos: HTML5 video with autoplay (controlled by VideoPlaybackController)
  - Animations: Animated WebP/GIF image
  - Pictographs: PropAwareThumbnail with user's prop settings

  The displayType prop controls which media to show, independent of what
  media types are available on the item.
-->
<script lang="ts">

import { getVideoPlaybackController } from "$lib/features/watch/get-video-playback-controller";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import { onMount, onDestroy } from "svelte";
  import type { FeedContentType, FeedItem } from "../../domain/models/feed-models";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import PropAwareThumbnail from "$lib/shared/browse/components/PropAwareThumbnail.svelte";
  import type { VideoPlaybackController } from "../../services/video-playback-controller";

  interface Props {
    item: FeedItem;
    displayType: FeedContentType; // Which media type to display
    bluePropType?: PropType;
    redPropType?: PropType;
    catDogModeEnabled?: boolean;
    isMuted?: boolean;
    preloadPriority?: "high" | "low";
    onMuteToggle?: (muted: boolean) => void;
  }

  const {
    item,
    displayType,
    bluePropType,
    redPropType,
    catDogModeEnabled = false,
    isMuted = true,
    preloadPriority = "low",
    onMuteToggle,
  }: Props = $props();

  let videoRef = $state<HTMLVideoElement | null>(null);
  let playbackController: VideoPlaybackController | null = null;

  // Derived sequence data for PropAwareThumbnail
  const sequenceForThumbnail = $derived.by(() => {
    if (item.sequenceId) {
      // Create minimal sequence object for PropAwareThumbnail
      return {
        id: item.sequenceId,
        name: item.title,
        word: item.word || item.title,
        steps: [],
        thumbnails: [item.thumbnailUrl],
        isFavorite: false,
        isCircular: false,
        tags: item.tags || [],
        metadata: {},
        ownerId: item.creatorId,
        ownerDisplayName: item.creatorName,
        ownerAvatarUrl: item.creatorAvatarUrl,
      };
    }
    return null;
  });

  // Check what's actually available
  const canShowVideo = $derived(!!item.videoUrl);
  const canShowAnimation = $derived(!!item.animationUrl);
  const canShowPictograph = $derived(!!item.thumbnailUrl);

  onMount(() => {
    // Get playback controller from container
    try {
      playbackController = getVideoPlaybackController();
    } catch {
      // Controller not registered yet
    }

    // Register video with playback controller
    if (videoRef && playbackController) {
      playbackController.register(item.id, videoRef);
    }
  });

  onDestroy(() => {
    // Unregister video from playback controller
    if (playbackController) {
      playbackController.unregister(item.id);
    }
  });

  // Update video ref when it changes
  $effect(() => {
    if (videoRef && playbackController) {
      playbackController.register(item.id, videoRef);
    }
  });

  function handleMuteToggle(e: Event) {
    e.stopPropagation();
    if (videoRef) {
      videoRef.muted = !videoRef.muted;
      onMuteToggle?.(!videoRef.muted);
    }
  }

  function formatDuration(seconds?: number): string {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
</script>

<div class="feed-card-media" class:video={displayType === "video"}>
  {#if displayType === "video" && canShowVideo}
    <!-- Video content -->
    <video
      bind:this={videoRef}
      src={item.videoUrl}
      poster={item.thumbnailUrl}
      muted={isMuted}
      loop={item.duration ? item.duration < 15 : true}
      playsinline
      preload={preloadPriority === "high" ? "auto" : "metadata"}
      data-preload-priority={preloadPriority}
    >
      <track kind="captions" />
    </video>

    <!-- Mute toggle button -->
    <button
      class="mute-toggle"
      onclick={handleMuteToggle}
      type="button"
      aria-label={t(isMuted ? 'watch_media_unmute' : 'watch_media_mute')}
    >
      <i class="fas {isMuted ? 'fa-volume-mute' : 'fa-volume-up'}" aria-hidden="true"></i>
    </button>

    <!-- Duration badge -->
    {#if item.duration}
      <div class="duration-badge">
        {formatDuration(item.duration)}
      </div>
    {/if}
  {:else if displayType === "animation" && canShowAnimation}
    <!-- Animated sequence (WebP/GIF) -->
    <img
      src={item.animationUrl}
      alt={item.title}
      loading="lazy"
      class="animation-img"
    />
  {:else if displayType === "pictograph" && sequenceForThumbnail}
    <!-- Pictograph grid with user's prop settings -->
    <PropAwareThumbnail
      sequence={sequenceForThumbnail}
      {bluePropType}
      {redPropType}
      {catDogModeEnabled}
      variant="gallery"
    />
  {:else if canShowPictograph}
    <!-- Fallback thumbnail -->
    <img
      src={item.thumbnailUrl}
      alt={item.title}
      loading="lazy"
      class="fallback-img"
    />
  {/if}
</div>

<style>
  .feed-card-media {
    position: relative;
    width: 100%;
    flex: 1; /* Fill available space in card */
    min-height: 0; /* Allow shrinking */
    background: #000;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Video styling */
  video {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: #000;
  }

  /* Animation styling */
  .animation-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  /* Fallback image */
  .fallback-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  /* Mute toggle button */
  .mute-toggle {
    position: absolute;
    bottom: 12px;
    right: 12px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    border: none;
    color: white;
    font-size: var(--font-size-sm, 13px);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background var(--duration-fast, 150ms) ease;
    backdrop-filter: blur(4px);
  }

  .mute-toggle:hover {
    background: rgba(0, 0, 0, 0.8);
  }

  .mute-toggle:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }

  /* Duration badge */
  .duration-badge {
    position: absolute;
    bottom: 12px;
    left: 12px;
    padding: 4px 8px;
    background: rgba(0, 0, 0, 0.7);
    border-radius: 4px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: white;
    font-variant-numeric: tabular-nums;
  }

  /* PropAwareThumbnail container adjustment */
  .feed-card-media :global(.thumbnail-container) {
    width: 100%;
    height: 100%;
  }
</style>

<script lang="ts">
  /**
   * EndlessVideoPlayer
   *
   * Plays an array of videos in an endless loop with smooth crossfades.
   * Two video elements alternate - as one fades out, the next fades in.
   * Inspired by the endless spinner concept.
   *
   * Memory management: Uses VideoCache for blob URL management and releases
   * video memory when swapping to prevent accumulation during long sessions.
   */
  import { onMount, onDestroy } from "svelte";
  import { getVideoCache } from "$lib/shared/video";

  interface VideoItem {
    src: string;
    title?: string;
    description?: string;
  }

  let {
    videos = [],
    crossfadeDuration = 1000,
    showInfo = true,
  } = $props<{
    videos: VideoItem[];
    crossfadeDuration?: number;
    showInfo?: boolean;
  }>();

  const videoCache = getVideoCache();

  // Track which original URLs are currently loaded in each player
  // so we can release them when swapping
  let loadedUrlA = $state<string | null>(null);
  let loadedUrlB = $state<string | null>(null);

  // Two video elements for crossfading
  let videoA = $state<HTMLVideoElement | null>(null);
  let videoB = $state<HTMLVideoElement | null>(null);

  // Track which video is active (true = A, false = B)
  let isVideoAActive = $state(true);
  let currentIndex = $state(0);
  let isTransitioning = $state(false);
  let isPaused = $state(false);

  // Current video info for display
  const currentVideo = $derived(videos[currentIndex] || null);

  /**
   * Load a video into a player element, releasing the previous video's blob URL
   */
  async function loadVideoIntoPlayer(
    player: HTMLVideoElement,
    originalUrl: string,
    isPlayerA: boolean
  ): Promise<void> {
    // Release the previous video's blob URL if any
    const previousUrl = isPlayerA ? loadedUrlA : loadedUrlB;
    if (previousUrl && previousUrl !== originalUrl) {
      videoCache.releaseVideo(previousUrl);
    }

    // Get cached URL (creates blob URL if cached, returns original if not)
    const playbackUrl = await videoCache.getVideoUrl(originalUrl, {
      cacheIfMissing: true,
      priority: 5,
    });

    // Track what's loaded
    if (isPlayerA) {
      loadedUrlA = originalUrl;
    } else {
      loadedUrlB = originalUrl;
    }

    player.src = playbackUrl;
  }

  // Opacity states for crossfade
  let opacityA = $state(1);
  let opacityB = $state(0);

  function getNextIndex(current: number): number {
    return (current + 1) % videos.length;
  }

  function getPrevIndex(current: number): number {
    return (current - 1 + videos.length) % videos.length;
  }

  /**
   * Preload the next video into the inactive player
   */
  async function preloadNext() {
    const nextIndex = getNextIndex(currentIndex);
    const nextVideo = videos[nextIndex];
    if (!nextVideo) return;

    const inactivePlayer = isVideoAActive ? videoB : videoA;
    const isPlayerA = !isVideoAActive;
    const currentLoadedUrl = isPlayerA ? loadedUrlA : loadedUrlB;

    if (inactivePlayer && currentLoadedUrl !== nextVideo.src) {
      await loadVideoIntoPlayer(inactivePlayer, nextVideo.src, isPlayerA);
      inactivePlayer.load();
    }
  }

  /**
   * Crossfade to the next video
   */
  async function crossfadeToNext() {
    if (isTransitioning || videos.length <= 1) return;
    isTransitioning = true;

    const nextIndex = getNextIndex(currentIndex);
    const activePlayer = isVideoAActive ? videoA : videoB;
    const inactivePlayer = isVideoAActive ? videoB : videoA;
    const inactiveIsPlayerA = !isVideoAActive;

    if (!activePlayer || !inactivePlayer) {
      isTransitioning = false;
      return;
    }

    // Ensure next video is loaded
    const nextVideo = videos[nextIndex];
    const currentLoadedUrl = inactiveIsPlayerA ? loadedUrlA : loadedUrlB;

    if (currentLoadedUrl !== nextVideo.src) {
      await loadVideoIntoPlayer(inactivePlayer, nextVideo.src, inactiveIsPlayerA);
      // Clear any previous handler before assigning new one
      inactivePlayer.onloadeddata = null;
      await new Promise((resolve) => {
        inactivePlayer.onloadeddata = () => {
          inactivePlayer.onloadeddata = null; // Clean up after firing
          resolve(undefined);
        };
        inactivePlayer.load();
      });
    }

    // Start playing the incoming video (muted, will fade in)
    inactivePlayer.currentTime = 0;
    inactivePlayer.play().catch(() => {});

    // Animate the crossfade
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / crossfadeDuration, 1);

      // Ease in-out curve
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      if (isVideoAActive) {
        opacityA = 1 - eased;
        opacityB = eased;
      } else {
        opacityA = eased;
        opacityB = 1 - eased;
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Crossfade complete
        activePlayer.pause();
        isVideoAActive = !isVideoAActive;
        currentIndex = nextIndex;
        isTransitioning = false;
        preloadNext();
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Handle video ending - trigger crossfade
   */
  function handleVideoEnded() {
    if (!isPaused) {
      crossfadeToNext();
    }
  }

  /**
   * Manual navigation
   */
  function goToNext() {
    if (!isTransitioning) {
      crossfadeToNext();
    }
  }

  async function goToPrev() {
    if (isTransitioning || videos.length <= 1) return;
    // For prev, we need to adjust the logic
    isTransitioning = true;

    const prevIndex = getPrevIndex(currentIndex);
    const activePlayer = isVideoAActive ? videoA : videoB;
    const inactivePlayer = isVideoAActive ? videoB : videoA;
    const inactiveIsPlayerA = !isVideoAActive;

    if (!activePlayer || !inactivePlayer) {
      isTransitioning = false;
      return;
    }

    const prevVideo = videos[prevIndex];
    await loadVideoIntoPlayer(inactivePlayer, prevVideo.src, inactiveIsPlayerA);
    // Clear any previous handler before assigning new one
    inactivePlayer.onloadeddata = null;
    inactivePlayer.load();

    inactivePlayer.onloadeddata = () => {
      inactivePlayer.onloadeddata = null; // Clean up after firing
      inactivePlayer.currentTime = 0;
      inactivePlayer.play().catch(() => {});

      const startTime = performance.now();
      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / crossfadeDuration, 1);
        const eased = progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        if (isVideoAActive) {
          opacityA = 1 - eased;
          opacityB = eased;
        } else {
          opacityA = eased;
          opacityB = 1 - eased;
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          activePlayer.pause();
          isVideoAActive = !isVideoAActive;
          currentIndex = prevIndex;
          isTransitioning = false;
          preloadNext();
        }
      };

      requestAnimationFrame(animate);
    };
  }

  function togglePause() {
    isPaused = !isPaused;
    const activePlayer = isVideoAActive ? videoA : videoB;
    if (activePlayer) {
      if (isPaused) {
        activePlayer.pause();
      } else {
        activePlayer.play().catch(() => {});
      }
    }
  }

  /**
   * Jump directly to a specific video index
   */
  async function jumpToVideo(targetIndex: number) {
    if (targetIndex === currentIndex || isTransitioning) return;

    const activePlayer = isVideoAActive ? videoA : videoB;
    const inactivePlayer = isVideoAActive ? videoB : videoA;
    const inactiveIsPlayerA = !isVideoAActive;

    if (!inactivePlayer) return;

    await loadVideoIntoPlayer(inactivePlayer, videos[targetIndex].src, inactiveIsPlayerA);
    // Clear any previous handler before assigning new one
    inactivePlayer.onloadeddata = null;
    inactivePlayer.load();

    inactivePlayer.onloadeddata = () => {
      inactivePlayer.onloadeddata = null; // Clean up after firing
      isTransitioning = true;
      inactivePlayer.currentTime = 0;
      inactivePlayer.play().catch(() => {});

      const startTime = performance.now();
      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / crossfadeDuration, 1);
        const eased =
          progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        if (isVideoAActive) {
          opacityA = 1 - eased;
          opacityB = eased;
        } else {
          opacityA = eased;
          opacityB = 1 - eased;
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          activePlayer?.pause();
          isVideoAActive = !isVideoAActive;
          currentIndex = targetIndex;
          isTransitioning = false;
          preloadNext();
        }
      };
      requestAnimationFrame(animate);
    };
  }

  onMount(async () => {
    if (videos.length === 0) return;

    // Initialize first video
    const firstVideo = videos[0];
    if (videoA && firstVideo) {
      await loadVideoIntoPlayer(videoA, firstVideo.src, true);
      videoA.load();
      videoA.play().catch(() => {});
    }

    // Preload second video
    if (videos.length > 1) {
      preloadNext();
    }
  });

  onDestroy(() => {
    // Cleanup - pause videos and clear event handlers to prevent memory leaks
    if (videoA) {
      videoA.pause();
      videoA.onloadeddata = null;
      videoA.src = ""; // Release video buffer
    }
    if (videoB) {
      videoB.pause();
      videoB.onloadeddata = null;
      videoB.src = ""; // Release video buffer
    }

    // Release blob URLs for loaded videos to free memory
    // Videos stay cached in IndexedDB for fast reload
    if (loadedUrlA) {
      videoCache.releaseVideo(loadedUrlA);
    }
    if (loadedUrlB) {
      videoCache.releaseVideo(loadedUrlB);
    }
  });
</script>

<div class="endless-video-player">
  {#if videos.length === 0}
    <div class="empty-state">
      <i class="fas fa-film" aria-hidden="true"></i>
      <span>No videos to display</span>
    </div>
  {:else}
    <!-- Video layers -->
    <div class="video-container">
      <video
        bind:this={videoA}
        class="video-layer"
        style="opacity: {opacityA};"
        muted
        playsinline
        onended={handleVideoEnded}
      >
        <track kind="captions" />
      </video>
      <video
        bind:this={videoB}
        class="video-layer"
        style="opacity: {opacityB};"
        muted
        playsinline
        onended={handleVideoEnded}
      >
        <track kind="captions" />
      </video>
    </div>

    <!-- Controls overlay -->
    <div class="controls-overlay">
      <!-- Navigation arrows -->
      <button
        class="nav-button prev"
        onclick={goToPrev}
        disabled={isTransitioning}
        aria-label="Previous video"
      >
        <i class="fas fa-chevron-left" aria-hidden="true"></i>
      </button>

      <button
        class="nav-button next"
        onclick={goToNext}
        disabled={isTransitioning}
        aria-label="Next video"
      >
        <i class="fas fa-chevron-right" aria-hidden="true"></i>
      </button>

      <!-- Center play/pause -->
      <button
        class="play-pause-button"
        onclick={togglePause}
        aria-label={isPaused ? "Play" : "Pause"}
      >
        <i class="fas {isPaused ? 'fa-play' : 'fa-pause'}" aria-hidden="true"></i>
      </button>

      <!-- Progress dots -->
      <div class="progress-dots">
        {#each videos as _, i}
          <button
            class="dot"
            class:active={i === currentIndex}
            class:transitioning={isTransitioning && i === getNextIndex(currentIndex)}
            onclick={() => jumpToVideo(i)}
            aria-label="Go to video {i + 1}"
          ></button>
        {/each}
      </div>
    </div>

    <!-- Video info -->
    {#if showInfo && currentVideo}
      <div class="video-info" class:hidden={isTransitioning}>
        {#if currentVideo.title}
          <h3 class="video-title">{currentVideo.title}</h3>
        {/if}
        {#if currentVideo.description}
          <p class="video-description">{currentVideo.description}</p>
        {/if}
        <span class="video-counter">{currentIndex + 1} / {videos.length}</span>
      </div>
    {/if}
  {/if}
</div>

<style>
  .endless-video-player {
    position: relative;
    width: 100%;
    aspect-ratio: 9 / 16;
    max-height: 80vh;
    background: #000;
    border-radius: 16px;
    overflow: hidden;
  }

  .video-container {
    position: absolute;
    inset: 0;
  }

  .video-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: opacity 0.05s linear; /* Smooth sub-frame transitions handled by JS */
  }

  /* Controls overlay */
  .controls-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .endless-video-player:hover .controls-overlay {
    opacity: 1;
  }

  .nav-button {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    backdrop-filter: blur(8px);
  }

  .nav-button:hover:not(:disabled) {
    background: rgba(0, 0, 0, 0.7);
    border-color: rgba(255, 255, 255, 0.4);
    transform: scale(1.1);
  }

  .nav-button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .play-pause-button {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    border: 2px solid rgba(255, 255, 255, 0.3);
    color: white;
    font-size: 24px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    backdrop-filter: blur(8px);
  }

  .play-pause-button:hover {
    background: rgba(0, 0, 0, 0.8);
    border-color: rgba(255, 255, 255, 0.5);
    transform: translate(-50%, -50%) scale(1.1);
  }

  /* Progress dots */
  .progress-dots {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.4);
    border: none;
    cursor: pointer;
    transition: all 0.3s ease;
    padding: 0;
  }

  .dot:hover {
    background: rgba(255, 255, 255, 0.7);
    transform: scale(1.3);
  }

  .dot.active {
    background: white;
    transform: scale(1.2);
  }

  .dot.transitioning {
    animation: pulse 0.5s ease infinite;
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.4); }
  }

  /* Video info */
  .video-info {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 48px 20px 20px;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, transparent 100%);
    color: white;
    transition: opacity 0.3s ease;
  }

  .video-info.hidden {
    opacity: 0.5;
  }

  .video-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 4px 0;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  }

  .video-description {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.8);
    margin: 0 0 8px 0;
  }

  .video-counter {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
  }

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .empty-state i {
    font-size: 48px;
    opacity: 0.5;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .video-layer,
    .controls-overlay,
    .nav-button,
    .play-pause-button,
    .dot,
    .video-info {
      transition: none;
    }

    .dot.transitioning {
      animation: none;
    }
  }
</style>

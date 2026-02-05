<!--
  EndlessVideoPlayer.svelte (Landing - standalone)

  Plays an array of videos in an endless loop with smooth crossfades.
  Two video elements alternate - as one fades out, the next fades in.

  Simplified from scribe version: no VideoCache dependency,
  uses video URLs directly (videos are on Firebase Storage CDN).
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";

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

  let videoA = $state<HTMLVideoElement | null>(null);
  let videoB = $state<HTMLVideoElement | null>(null);

  let isVideoAActive = $state(true);
  let currentIndex = $state(0);
  let isTransitioning = $state(false);
  let isPaused = $state(false);

  let opacityA = $state(1);
  let opacityB = $state(0);

  const currentVideo = $derived(videos[currentIndex] || null);

  function getNextIndex(current: number): number {
    return (current + 1) % videos.length;
  }

  function getPrevIndex(current: number): number {
    return (current - 1 + videos.length) % videos.length;
  }

  async function preloadNext() {
    const nextIndex = getNextIndex(currentIndex);
    const nextVideo = videos[nextIndex];
    if (!nextVideo) return;

    const inactivePlayer = isVideoAActive ? videoB : videoA;
    if (inactivePlayer && inactivePlayer.src !== nextVideo.src) {
      inactivePlayer.src = nextVideo.src;
      inactivePlayer.load();
    }
  }

  async function crossfadeToNext() {
    if (isTransitioning || videos.length <= 1) return;
    isTransitioning = true;

    const nextIndex = getNextIndex(currentIndex);
    const activePlayer = isVideoAActive ? videoA : videoB;
    const inactivePlayer = isVideoAActive ? videoB : videoA;

    if (!activePlayer || !inactivePlayer) {
      isTransitioning = false;
      return;
    }

    const nextVideo = videos[nextIndex];
    if (inactivePlayer.src !== nextVideo.src) {
      inactivePlayer.src = nextVideo.src;
      inactivePlayer.onloadeddata = null;
      await new Promise<void>((resolve) => {
        inactivePlayer.onloadeddata = () => {
          inactivePlayer.onloadeddata = null;
          resolve();
        };
        inactivePlayer.load();
      });
    }

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
        currentIndex = nextIndex;
        isTransitioning = false;
        preloadNext();
      }
    };

    requestAnimationFrame(animate);
  }

  async function crossfadeToPrev() {
    if (isTransitioning || videos.length <= 1) return;
    isTransitioning = true;

    const prevIndex = getPrevIndex(currentIndex);
    const activePlayer = isVideoAActive ? videoA : videoB;
    const inactivePlayer = isVideoAActive ? videoB : videoA;

    if (!activePlayer || !inactivePlayer) {
      isTransitioning = false;
      return;
    }

    const prevVideo = videos[prevIndex];
    inactivePlayer.src = prevVideo.src;
    inactivePlayer.onloadeddata = null;
    inactivePlayer.load();

    inactivePlayer.onloadeddata = () => {
      inactivePlayer.onloadeddata = null;
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

  function handleVideoEnded() {
    if (!isPaused) {
      crossfadeToNext();
    }
  }

  function goToNext() {
    if (!isTransitioning) crossfadeToNext();
  }

  function goToPrev() {
    if (!isTransitioning) crossfadeToPrev();
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

  async function jumpToVideo(targetIndex: number) {
    if (targetIndex === currentIndex || isTransitioning) return;

    const activePlayer = isVideoAActive ? videoA : videoB;
    const inactivePlayer = isVideoAActive ? videoB : videoA;

    if (!inactivePlayer) return;

    inactivePlayer.src = videos[targetIndex].src;
    inactivePlayer.onloadeddata = null;
    inactivePlayer.load();

    inactivePlayer.onloadeddata = () => {
      inactivePlayer.onloadeddata = null;
      isTransitioning = true;
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

    const firstVideo = videos[0];
    if (videoA && firstVideo) {
      videoA.src = firstVideo.src;
      videoA.load();
      videoA.play().catch(() => {});
    }

    if (videos.length > 1) {
      preloadNext();
    }
  });

  onDestroy(() => {
    if (videoA) {
      videoA.pause();
      videoA.onloadeddata = null;
      videoA.src = "";
    }
    if (videoB) {
      videoB.pause();
      videoB.onloadeddata = null;
      videoB.src = "";
    }
  });
</script>

<div class="endless-video-player">
  {#if videos.length === 0}
    <div class="empty-state">
      <span>No videos to display</span>
    </div>
  {:else}
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

    <div class="controls-overlay">
      <button
        class="nav-button prev"
        onclick={goToPrev}
        disabled={isTransitioning}
        aria-label="Previous video"
      >
        &#x2039;
      </button>

      <button
        class="nav-button next"
        onclick={goToNext}
        disabled={isTransitioning}
        aria-label="Next video"
      >
        &#x203A;
      </button>

      <button
        class="play-pause-button"
        onclick={togglePause}
        aria-label={isPaused ? "Play" : "Pause"}
      >
        {isPaused ? "\u25B6" : "\u23F8"}
      </button>

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
    transition: opacity 0.05s linear;
  }

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
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    font-size: 24px;
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

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
    color: rgba(255, 255, 255, 0.5);
  }

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

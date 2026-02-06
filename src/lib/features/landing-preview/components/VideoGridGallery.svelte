<script lang="ts">
  /**
   * VideoGridGallery
   *
   * CSS Grid layout showing multiple videos simultaneously.
   * Uses Intersection Observer to autoplay videos when visible.
   */
  import { onMount } from "svelte";

  interface Video {
    url: string;
    word: string;
  }

  interface Props {
    videos: Video[];
    columns?: number;
  }

  let { videos, columns = 2 }: Props = $props();

  let videoRefs: HTMLVideoElement[] = $state([]);
  let observer: IntersectionObserver | null = null;

  onMount(() => {
    // Create Intersection Observer for autoplay
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target as HTMLVideoElement;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            video.play().catch(() => {
              // Autoplay blocked - that's fine, user can click
            });
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.5 }
    );

    // Observe all video elements
    videoRefs.forEach((video) => {
      if (video) observer?.observe(video);
    });

    return () => {
      observer?.disconnect();
    };
  });

  function handleVideoRef(el: HTMLVideoElement, index: number) {
    videoRefs[index] = el;
    observer?.observe(el);

    return {
      destroy() {
        observer?.unobserve(el);
      }
    };
  }
</script>

<div
  class="video-grid"
  style:--columns={columns}
  role="list"
  aria-label="Video gallery"
>
  {#each videos as video, i}
    <div class="video-item" role="listitem">
      <video
        use:handleVideoRef={i}
        muted
        playsinline
        loop
        preload="metadata"
        aria-label="Performance video of {video.word}"
      >
        <source src={video.url} type="video/mp4" />
      </video>
      <div class="video-caption">
        <span class="word">{video.word}</span>
      </div>
    </div>
  {/each}
</div>

<style>
  .video-grid {
    display: grid;
    grid-template-columns: repeat(var(--columns, 2), 1fr);
    gap: 16px;
  }

  .video-item {
    position: relative;
    border-radius: 12px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.3);
  }

  video {
    width: 100%;
    aspect-ratio: 9 / 16;
    object-fit: cover;
    display: block;
  }

  .video-caption {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 12px;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
  }

  .word {
    font-family: Georgia, serif;
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    color: white;
  }

  @media (max-width: 600px) {
    .video-grid {
      grid-template-columns: repeat(min(var(--columns, 2), 2), 1fr);
      gap: 12px;
    }
  }
</style>

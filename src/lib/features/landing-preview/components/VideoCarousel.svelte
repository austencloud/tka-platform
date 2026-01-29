<script lang="ts">
  /**
   * VideoCarousel
   *
   * Swipeable carousel for browsing videos one at a time.
   * Pure CSS scroll-snap + native touch gestures.
   */
  import { onMount } from "svelte";

  interface Video {
    url: string;
    word: string;
  }

  interface Props {
    videos: Video[];
  }

  let { videos }: Props = $props();

  let carouselRef: HTMLDivElement | null = $state(null);
  let currentIndex = $state(0);
  let videoRefs: HTMLVideoElement[] = $state([]);

  onMount(() => {
    if (!carouselRef) return;

    // Track scroll position to update current index
    const handleScroll = () => {
      if (!carouselRef) return;
      const scrollLeft = carouselRef.scrollLeft;
      const itemWidth = carouselRef.offsetWidth;
      const newIndex = Math.round(scrollLeft / itemWidth);
      if (newIndex !== currentIndex) {
        currentIndex = newIndex;
        // Pause all videos except current
        videoRefs.forEach((video, i) => {
          if (video) {
            if (i === newIndex) {
              video.play().catch(() => {});
            } else {
              video.pause();
            }
          }
        });
      }
    };

    carouselRef.addEventListener("scroll", handleScroll, { passive: true });

    // Start playing first video
    if (videoRefs[0]) {
      videoRefs[0].play().catch(() => {});
    }

    return () => {
      carouselRef?.removeEventListener("scroll", handleScroll);
    };
  });

  function goToSlide(index: number) {
    if (!carouselRef) return;
    const itemWidth = carouselRef.offsetWidth;
    carouselRef.scrollTo({ left: index * itemWidth, behavior: "smooth" });
  }

  function handleVideoRef(el: HTMLVideoElement, index: number) {
    videoRefs[index] = el;
  }
</script>

<div class="carousel-container">
  <div class="carousel" bind:this={carouselRef} role="region" aria-label="Video carousel">
    {#each videos as video, i}
      <div class="carousel-slide">
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

  <!-- Navigation dots -->
  <div class="carousel-dots" role="tablist" aria-label="Carousel navigation">
    {#each videos as _, i}
      <button
        class="dot"
        class:active={i === currentIndex}
        onclick={() => goToSlide(i)}
        role="tab"
        aria-selected={i === currentIndex}
        aria-label="Go to video {i + 1}"
      ></button>
    {/each}
  </div>

  <!-- Arrow navigation -->
  {#if currentIndex > 0}
    <button
      class="nav-arrow prev"
      onclick={() => goToSlide(currentIndex - 1)}
      aria-label="Previous video"
    >
      <i class="fas fa-chevron-left" aria-hidden="true"></i>
    </button>
  {/if}
  {#if currentIndex < videos.length - 1}
    <button
      class="nav-arrow next"
      onclick={() => goToSlide(currentIndex + 1)}
      aria-label="Next video"
    >
      <i class="fas fa-chevron-right" aria-hidden="true"></i>
    </button>
  {/if}
</div>

<style>
  .carousel-container {
    position: relative;
    max-width: 400px;
    margin: 0 auto;
  }

  .carousel {
    display: flex;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    border-radius: 16px;
  }

  .carousel::-webkit-scrollbar {
    display: none;
  }

  .carousel-slide {
    flex: 0 0 100%;
    scroll-snap-align: center;
    position: relative;
  }

  video {
    width: 100%;
    aspect-ratio: 9 / 16;
    object-fit: cover;
    display: block;
    border-radius: 16px;
  }

  .video-caption {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 16px;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
    border-radius: 0 0 16px 16px;
    text-align: center;
  }

  .word {
    font-family: Georgia, serif;
    font-size: var(--font-size-xl, 24px);
    font-weight: 600;
    color: white;
  }

  /* Navigation dots */
  .carousel-dots {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-top: 16px;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: none;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.3));
    cursor: pointer;
    transition: all 0.2s ease;
    padding: 0;
  }

  .dot:hover {
    background: var(--theme-stroke-strong, rgba(255, 255, 255, 0.5));
  }

  .dot.active {
    background: var(--theme-accent, #6366f1);
    transform: scale(1.2);
  }

  /* Arrow navigation */
  .nav-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: none;
    background: rgba(0, 0, 0, 0.5);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .nav-arrow:hover {
    background: rgba(0, 0, 0, 0.7);
  }

  .nav-arrow.prev {
    left: -22px;
  }

  .nav-arrow.next {
    right: -22px;
  }

  @media (max-width: 500px) {
    .nav-arrow {
      display: none;
    }
  }
</style>

<script lang="ts">
  /**
   * HeroCarouselSection
   *
   * The landing page hero: title and subtitle above a 4:5 portrait video carousel.
   * Videos are loaded from Firestore's showcaseVideos collection (featured + approved),
   * with a crossfade every 5 seconds. Manual nav resets the timer.
   *
   * Performer credit + prop type are shown below the carousel frame.
   */
  import { onMount, onDestroy } from "svelte";
  import { getFirestoreInstance } from "$lib/shared/auth/firebase";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import type { ShowcaseVideo } from "$lib/features/landing-preview/types";
  import { LANDING_VIDEOS } from "../landing-videos";

  // ─── Internal video shape used by this component ─────────────────────────────

  interface CarouselEntry {
    src: string;
    performer: string;
    prop: string;
  }

  // ─── State ───────────────────────────────────────────────────────────────────

  let entries = $state<CarouselEntry[]>([]);
  let loading = $state(true);
  let loadError = $state(false);

  // Which entry is currently "front" (fully visible)
  let currentIndex = $state(0);
  let isTransitioning = $state(false);

  // Two video elements for crossfading - A is front, B is back
  let videoA = $state<HTMLVideoElement | null>(null);
  let videoB = $state<HTMLVideoElement | null>(null);
  let opacityA = $state(1);
  let opacityB = $state(0);
  // true means A is the visible layer
  let isAFront = $state(true);
  // Track whether the first video frame is actually ready to display
  let firstVideoReady = $state(false);

  const CROSSFADE_DURATION = 800; // ms
  const AUTO_ADVANCE_INTERVAL = 5000; // ms

  let autoTimer: ReturnType<typeof setInterval> | null = null;
  let rafHandle: number | null = null;

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const currentEntry = $derived(entries[currentIndex] ?? null);

  // ─── Firestore loading ────────────────────────────────────────────────────────

  function shuffleArray<T>(arr: T[]): T[] {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = out[i] as T;
      out[i] = out[j] as T;
      out[j] = tmp;
    }
    return out;
  }

  async function loadFromFirestore(): Promise<CarouselEntry[]> {
    const { collection, getDocs, query, where, orderBy, limit } = await import(
      "firebase/firestore"
    );
    const db = await getFirestoreInstance();

    const q = query(
      collection(db, "showcaseVideos"),
      where("featured", "==", true),
      where("approved", "==", true),
      orderBy("instagramDate", "desc"),
      limit(20)
    );

    const snapshot = await getDocs(q);
    const docs = snapshot.docs
      .map((doc) => {
        const d = doc.data() as Partial<ShowcaseVideo & Record<string, unknown>>;
        return {
          shortcode: doc.id,
          videoUrl: d.videoUrl as string | undefined,
          performers: (d.performers ?? []) as ShowcaseVideo["performers"],
          excluded: (d.excluded ?? false) as boolean,
          // tags may encode the prop type - fall back to "staves" if absent
          tags: (d.tags ?? []) as string[],
        };
      })
      .filter((v) => !v.excluded && v.videoUrl);

    return shuffleArray(
      docs.map((v) => ({
        src: v.videoUrl!,
        performer: v.performers[0]?.displayName ?? "TKA Performer",
        // Use the first tag that looks like a prop name, otherwise "staves"
        prop: deriveProFromTags(v.tags),
      }))
    );
  }

  function deriveProFromTags(tags: string[]): string {
    const propKeywords = ["staff", "stave", "fan", "club", "hoop", "poi", "buugeng"];
    for (const tag of tags) {
      const lower = tag.toLowerCase();
      for (const kw of propKeywords) {
        if (lower.includes(kw)) return tag;
      }
    }
    return "staves";
  }

  // ─── Crossfade engine ─────────────────────────────────────────────────────────

  function getNextIndex(from: number): number {
    return (from + 1) % entries.length;
  }

  function getPrevIndex(from: number): number {
    return (from - 1 + entries.length) % entries.length;
  }

  function cancelRaf() {
    if (rafHandle !== null) {
      cancelAnimationFrame(rafHandle);
      rafHandle = null;
    }
  }

  /**
   * Load a URL into the inactive player and resolve when data is ready.
   */
  async function loadIntoInactive(url: string): Promise<void> {
    const inactive = isAFront ? videoB : videoA;
    if (!inactive) return;
    inactive.src = url;
    return new Promise<void>((resolve) => {
      const onReady = () => {
        inactive.removeEventListener("loadeddata", onReady);
        resolve();
      };
      inactive.addEventListener("loadeddata", onReady);
      inactive.load();
    });
  }

  async function crossfadeTo(targetIndex: number): Promise<void> {
    if (isTransitioning || entries.length <= 1) return;
    if (targetIndex === currentIndex) return;

    isTransitioning = true;
    cancelRaf();

    const target = entries[targetIndex];
    if (!target) {
      isTransitioning = false;
      return;
    }

    await loadIntoInactive(target.src);

    const inactive = isAFront ? videoB : videoA;
    if (inactive) {
      inactive.currentTime = 0;
      inactive.play().catch(() => {});
    }

    const startTime = performance.now();

    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / CROSSFADE_DURATION, 1);
      // Ease in-out
      const eased =
        progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      if (isAFront) {
        opacityA = 1 - eased;
        opacityB = eased;
      } else {
        opacityA = eased;
        opacityB = 1 - eased;
      }

      if (progress < 1) {
        rafHandle = requestAnimationFrame(animate);
      } else {
        // Snap to final state
        opacityA = isAFront ? 0 : 1;
        opacityB = isAFront ? 1 : 0;

        const active = isAFront ? videoA : videoB;
        active?.pause();

        isAFront = !isAFront;
        currentIndex = targetIndex;
        isTransitioning = false;
        rafHandle = null;
      }
    };

    rafHandle = requestAnimationFrame(animate);
  }

  function advanceAuto() {
    crossfadeTo(getNextIndex(currentIndex));
  }

  function startAutoTimer() {
    stopAutoTimer();
    autoTimer = setInterval(advanceAuto, AUTO_ADVANCE_INTERVAL);
  }

  function stopAutoTimer() {
    if (autoTimer !== null) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
  }

  function resetTimer() {
    startAutoTimer();
  }

  // ─── Navigation ───────────────────────────────────────────────────────────────

  async function goNext() {
    await crossfadeTo(getNextIndex(currentIndex));
    resetTimer();
  }

  async function goPrev() {
    await crossfadeTo(getPrevIndex(currentIndex));
    resetTimer();
  }

  async function jumpTo(index: number) {
    if (index === currentIndex) return;
    await crossfadeTo(index);
    resetTimer();
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────────

  // Watch for videoA becoming available and seed the first video into it.
  // This handles the race condition where entries are ready before the
  // video element renders (loading state gates the template).
  $effect(() => {
    if (videoA && entries.length > 0 && !firstVideoReady) {
      const first = entries[0]!;
      // Only seed if not already loaded
      if (!videoA.src || videoA.src === "") {
        videoA.src = first.src;
        videoA.load();
        videoA.play().catch(() => {});
      }

      // Dismiss buffering overlay once video is actually rendering frames.
      const dismiss = () => { firstVideoReady = true; };
      videoA.addEventListener("playing", dismiss, { once: true });
      videoA.addEventListener("timeupdate", dismiss, { once: true });

      // Failsafe: if events somehow don't fire, check readyState after 3s
      setTimeout(() => {
        if (!firstVideoReady && videoA && !videoA.paused) {
          firstVideoReady = true;
        }
      }, 3000);
    }
  });

  onMount(async () => {
    try {
      const firestoreEntries = await loadFromFirestore();
      entries = firestoreEntries.length > 0 ? firestoreEntries : LANDING_VIDEOS;
    } catch (e) {
      console.error("[HeroCarouselSection] Failed to load videos:", e);
      entries = LANDING_VIDEOS;
      if (entries.length === 0) {
        loadError = true;
      }
    } finally {
      loading = false;
    }

    if (entries.length === 0) return;

    if (entries.length > 1) {
      startAutoTimer();
    }
  });

  onDestroy(() => {
    stopAutoTimer();
    cancelRaf();

    if (videoA) {
      videoA.pause();
      videoA.src = "";
    }
    if (videoB) {
      videoB.pause();
      videoB.src = "";
    }
  });
</script>

<section class="hero-carousel" aria-label="TKA hero introduction">
  <!-- Title block -->
  <div class="title-block">
    <h1>
      <span class="sparkle-text">
        The Kinetic Alphabet
        <span class="glint glint-1"></span>
        <span class="glint glint-2"></span>
        <span class="glint glint-3"></span>
        <span class="glint glint-4"></span>
      </span>
    </h1>
    <p class="hero-tagline">Notation for flow arts.</p>
  </div>

  <!-- Video + CTA row -->
  <div class="hero-body">

  <!-- Video + dots/credit column -->
  <div class="carousel-column">

  <!-- Video frame -->
  <div class="carousel-stage">
    {#if loading}
      <div class="placeholder" aria-label="Loading videos">
        <ProgressRing percent={-1} size={32} strokeWidth={3} />
        <span>Loading videos...</span>
      </div>
    {:else if loadError || entries.length === 0}
      <div class="placeholder error">
        <i class="fas fa-film" aria-hidden="true"></i>
        <span>No videos available</span>
      </div>
    {:else}
      <!-- Crossfade layers -->
      <div class="video-layers">
        <video
          bind:this={videoA}
          class="video-layer"
          style="opacity: {opacityA};"
          muted
          autoplay
          loop
          playsinline
          aria-hidden="true"
        >
          <track kind="captions" />
        </video>
        <video
          bind:this={videoB}
          class="video-layer"
          style="opacity: {opacityB};"
          muted
          autoplay
          loop
          playsinline
          aria-hidden="true"
        >
          <track kind="captions" />
        </video>

        <!-- Shimmer overlay while first video buffers -->
        {#if !firstVideoReady}
          <div class="video-buffering" aria-label="Video loading">
            <div class="buffering-shimmer"></div>
            <div class="buffering-content">
              <i class="fas fa-play-circle" aria-hidden="true"></i>
            </div>
          </div>
        {/if}
      </div>

      <!-- Prev / Next -->
      <button
        class="nav-btn prev"
        onclick={goPrev}
        disabled={isTransitioning || entries.length <= 1}
        aria-label="Previous video"
      >
        <i class="fas fa-chevron-left" aria-hidden="true"></i>
      </button>
      <button
        class="nav-btn next"
        onclick={goNext}
        disabled={isTransitioning || entries.length <= 1}
        aria-label="Next video"
      >
        <i class="fas fa-chevron-right" aria-hidden="true"></i>
      </button>
    {/if}
  </div>

  <!-- Dots + credit - directly under the video -->
  {#if !loading && entries.length > 0}
    <div class="carousel-footer">
      {#if entries.length > 1}
        <div class="dots" role="tablist" aria-label="Video indicators">
          {#each entries as _, i}
            <button
              class="dot"
              class:active={i === currentIndex}
              onclick={() => jumpTo(i)}
              role="tab"
              aria-selected={i === currentIndex}
              aria-label="Video {i + 1} of {entries.length}"
            ></button>
          {/each}
        </div>
      {/if}

      {#if currentEntry}
        <p class="credit" aria-live="polite">
          <span class="performer">{currentEntry.performer}</span>
          <span class="separator" aria-hidden="true">·</span>
          <span class="prop">{currentEntry.prop}</span>
        </p>
      {/if}
    </div>
  {/if}

  </div><!-- /.carousel-column -->

  <!-- CTA panel beside the video -->
  <div class="hero-cta">
    <a href="/create" class="cta-btn cta-primary" data-sveltekit-reload>
      <i class="fas fa-pen-nib" aria-hidden="true"></i>
      Open composer
    </a>

    <button class="cta-btn cta-tertiary" onclick={() => {
      document.getElementById('main-content')?.scrollIntoView({ behavior: 'smooth' });
    }}>
      <i class="fas fa-chevron-down" aria-hidden="true"></i>
      See how it works
    </button>
  </div>

  </div><!-- /.hero-body -->
</section>

<style>
  .hero-carousel {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0;
    height: 100vh;
    box-sizing: border-box;
    padding: 40px 24px 24px;
    text-align: center;
    overflow: hidden;
  }

  /* ── Title block ────────────────────────────────────────────────────────────── */

  .title-block {
    margin-bottom: clamp(16px, 3vw, 32px);
    max-width: 680px;
    flex-shrink: 0;
    animation: fade-up 0.7s ease both;
    animation-delay: 0.1s;
  }

  h1 {
    font-family: var(--landing-heading-font, "Playfair Display", Georgia, serif);
    font-size: clamp(2.4rem, 6vw, 4.5rem);
    font-weight: 400;
    line-height: 1.05;
    color: var(--theme-text, #fff);
    letter-spacing: -0.02em;
    margin: 0;
  }

  /* Sparkle glint container */
  .sparkle-text {
    position: relative;
    display: inline-block;
  }

  /* Individual glint - a 4-pointed star that fades in/out at different times */
  .glint {
    position: absolute;
    width: 6px;
    height: 6px;
    pointer-events: none;
    opacity: 0;
  }

  .glint::before,
  .glint::after {
    content: "";
    position: absolute;
    background: rgba(255, 240, 200, 0.9);
    border-radius: 1px;
  }

  /* Vertical bar of the cross */
  .glint::before {
    width: 2px;
    height: 100%;
    left: 50%;
    top: 0;
    transform: translateX(-50%);
  }

  /* Horizontal bar of the cross */
  .glint::after {
    width: 100%;
    height: 2px;
    top: 50%;
    left: 0;
    transform: translateY(-50%);
  }

  .hero-tagline {
    font-family: var(--landing-heading-font, "Playfair Display", Georgia, serif);
    font-size: clamp(1.1rem, 2vw, 1.5rem);
    font-weight: 400;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
    margin: clamp(8px, 1.5vw, 14px) 0 0;
    line-height: 1.3;
  }

  .glint-1 { top: 15%; left: 8%; animation: glint-flash 3.5s ease-in-out 0.5s infinite; }
  .glint-2 { top: 25%; right: 5%; animation: glint-flash 4s ease-in-out 1.8s infinite; }
  .glint-3 { bottom: 20%; left: 42%; animation: glint-flash 3.8s ease-in-out 3s infinite; }
  .glint-4 { top: 10%; left: 65%; animation: glint-flash 4.2s ease-in-out 0s infinite; }

  @keyframes glint-flash {
    0%, 85%, 100% { opacity: 0; transform: scale(0.5); }
    90% { opacity: 1; transform: scale(1.2); }
    95% { opacity: 0.6; transform: scale(0.8); }
  }

  /* ── Hero body: video + CTA side by side on desktop ────────────────────────── */

  .hero-body {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(24px, 4vw, 48px);
    width: 100%;
    max-width: 1400px;
    flex: 1 1 auto;
    min-height: 0;
  }

  /* ── CTA panel ──────────────────────────────────────────────────────────── */

  .hero-cta {
    display: flex;
    flex-direction: column;
    gap: 16px;
    flex-shrink: 0;
    max-width: 300px;
    animation: fade-up 0.7s ease both;
    animation-delay: 0.5s;
  }

  .cta-btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 14px 24px;
    border-radius: 12px;
    font-family: var(--font-body, system-ui, sans-serif);
    font-size: 0.95rem;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    white-space: nowrap;
  }

  .cta-btn:hover {
    transform: translateY(-1px);
  }

  .cta-primary {
    background: var(--theme-accent, #d4813a);
    color: #fff;
    box-shadow: 0 4px 20px rgba(212, 129, 58, 0.35);
  }

  .cta-primary:hover {
    box-shadow: 0 6px 28px rgba(212, 129, 58, 0.5);
  }

  .cta-tertiary {
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    border: 1px dashed rgba(255, 255, 255, 0.15);
  }

  .cta-tertiary:hover {
    color: var(--theme-text, #fff);
    border-color: rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.04);
  }

  .cta-tertiary i {
    animation: bounce-down 2s ease-in-out infinite;
  }

  @keyframes bounce-down {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(3px); }
  }

  /* ── Carousel column (video + dots stacked) ─────────────────────────────────── */

  .carousel-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1 1 0;
    min-width: 0;
    min-height: 0;
    max-height: 100%;
  }

  /* ── Carousel stage ─────────────────────────────────────────────────────────── */

  .carousel-stage {
    position: relative;
    width: 100%;
    max-width: min(50vw, 55vh / 0.8);
    max-height: calc(100vh - 220px);
    aspect-ratio: 4 / 5;
    border-radius: 16px;
    overflow: hidden;
    background: #0a0a0f;
    box-shadow:
      0 24px 80px rgba(0, 0, 0, 0.6),
      0 0 0 1px rgba(255, 255, 255, 0.05);
    animation: fade-up 0.7s ease both;
    animation-delay: 0.3s;
  }

  /* ── Video layers ───────────────────────────────────────────────────────────── */

  .video-layers {
    position: absolute;
    inset: 0;
  }

  .video-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    /* Sub-frame opacity handled by JS rAF; transition here smooths any micro-gaps */
    transition: opacity 0.05s linear;
  }

  /* ── Video buffering overlay ─────────────────────────────────────────────── */

  .video-buffering {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(
      135deg,
      rgba(15, 15, 25, 0.95) 0%,
      rgba(25, 20, 40, 0.95) 50%,
      rgba(15, 15, 25, 0.95) 100%
    );
    transition: opacity 0.5s ease;
  }

  .buffering-shimmer {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.03) 40%,
      rgba(255, 255, 255, 0.06) 50%,
      rgba(255, 255, 255, 0.03) 60%,
      transparent 100%
    );
    animation: shimmer-slide 2s ease-in-out infinite;
  }

  .buffering-content {
    position: relative;
    z-index: 1;
    color: rgba(255, 255, 255, 0.25);
    font-size: 48px;
    animation: pulse-icon 2s ease-in-out infinite;
  }

  @keyframes shimmer-slide {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }

  @keyframes pulse-icon {
    0%, 100% { opacity: 0.3; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(1.05); }
  }

  /* ── Placeholder / error ────────────────────────────────────────────────────── */

  .placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-size: var(--font-size-sm, 0.875rem);
  }

  .placeholder.error i {
    font-size: 32px;
    opacity: 0.4;
  }

  /* ── Nav buttons ────────────────────────────────────────────────────────────── */

  .nav-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.45);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #fff;
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      background 0.2s ease,
      border-color 0.2s ease,
      opacity 0.2s ease;
    opacity: 0;
    backdrop-filter: blur(6px);
    z-index: 2;
  }

  /* Show nav on hover over the stage */
  .carousel-stage:hover .nav-btn {
    opacity: 1;
  }

  .nav-btn.prev {
    left: 16px;
  }

  .nav-btn.next {
    right: 16px;
  }

  .nav-btn:hover:not(:disabled) {
    background: rgba(0, 0, 0, 0.7);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .nav-btn:disabled {
    opacity: 0;
    cursor: default;
    pointer-events: none;
  }

  /* ── Carousel footer ────────────────────────────────────────────────────────── */

  .carousel-footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    margin-top: 18px;
    animation: fade-up 0.7s ease both;
    animation-delay: 0.5s;
  }

  /* ── Dots ───────────────────────────────────────────────────────────────────── */

  .dots {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .dot {
    width: 8px;
    height: 8px;
    min-width: 8px;
    min-height: 8px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    padding: 0;
    box-sizing: content-box;
    background: rgba(255, 255, 255, 0.25);
    transition:
      background 0.25s ease,
      transform 0.25s ease;
  }

  .dot:hover {
    background: rgba(255, 255, 255, 0.55);
    transform: scale(1.25);
  }

  .dot.active {
    background: var(--theme-accent, #d4813a);
    transform: scale(1.15);
  }

  /* ── Credit line ─────────────────────────────────────────────────────────────── */

  .credit {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    margin: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    letter-spacing: 0.01em;
    transition: opacity 0.3s ease;
  }

  .separator {
    opacity: 0.4;
  }

  /* ── Entrance animation ─────────────────────────────────────────────────────── */

  @keyframes fade-up {
    from {
      opacity: 0;
      transform: translateY(16px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* ── Responsive ─────────────────────────────────────────────────────────────── */

  @media (max-width: 768px) {
    .hero-carousel {
      padding: 60px 16px 48px;
    }

    .hero-body {
      flex-direction: column;
    }

    .hero-cta {
      max-width: 100%;
      text-align: center;
      align-items: center;
      flex-direction: row;
      justify-content: center;
      flex-wrap: wrap;
    }

    .carousel-stage {
      border-radius: 12px;
    }

    /* Always show nav buttons on touch devices - no hover */
    .nav-btn {
      opacity: 1;
      width: 38px;
      height: 38px;
      font-size: 14px;
    }

    .nav-btn:disabled {
      opacity: 0;
    }
  }

  @media (max-width: 480px) {
    .hero-carousel {
      padding: 48px 12px 40px;
    }

    .carousel-stage {
      border-radius: 10px;
    }
  }

  /* ── Reduced motion ─────────────────────────────────────────────────────────── */

  @media (prefers-reduced-motion: reduce) {
    .title-block,
    .carousel-stage,
    .carousel-footer {
      animation: none;
      opacity: 1;
      transform: none;
    }

    .video-layer {
      transition: none;
    }

    .glint {
      display: none;
    }

    .dot,
    .nav-btn {
      transition: none;
    }

    .credit {
      transition: none;
    }

    .buffering-shimmer {
      animation: none;
    }

    .buffering-content {
      animation: none;
      opacity: 0.4;
    }
  }
</style>

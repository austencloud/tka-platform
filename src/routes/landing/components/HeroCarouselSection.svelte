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

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link
    href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@1,9..144,400..900&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<section class="hero-carousel" aria-label="TKA hero introduction">
  <!-- Title block — header now shows the compact "TKA", so the hero carries the
       full name (Fraunces) as the centrepiece, with the tagline beneath. -->
  <div class="title-block">
    <h1 class="hero-title">The Kinetic Alphabet</h1>
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

  <!-- Hero quick links -->
  <nav class="hero-links" aria-label="Get started">
    <a class="hero-link" href="/guide/level-1">
      <i class="fas fa-book-open" aria-hidden="true"></i>
      <span>Open the guide</span>
    </a>
    <a class="hero-link primary" href="/create" data-sveltekit-reload>
      <i class="fas fa-rocket" aria-hidden="true"></i>
      <span>Open the app</span>
    </a>
    <a class="hero-link" href="/support">
      <i class="fas fa-heart" aria-hidden="true"></i>
      <span>Support</span>
    </a>
  </nav>

  </div><!-- /.carousel-column -->

  <!-- CTA removed: the sticky header's "Open the app" is the single primary
       action, which lets the video centre. -->

  </div><!-- /.hero-body -->
</section>

<style>
  .hero-carousel {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0;
    min-height: 100vh;
    box-sizing: border-box;
    /* Top padding clears the fixed SiteHeader (64px) so the tagline isn't hidden. */
    padding: clamp(84px, 11vh, 108px) 24px 40px;
    text-align: center;
  }

  /* Hero centrepiece — same Fraunces wonky italic as the guide cover. */
  .hero-title {
    font-family: "Fraunces", Georgia, serif;
    font-style: italic;
    font-weight: 640;
    font-variation-settings: "opsz" 144, "wght" 640, "SOFT" 0, "WONK" 1;
    font-size: clamp(2.4rem, 5.5vw, 4rem);
    line-height: 1.02;
    letter-spacing: -0.015em;
    color: #fff;
    margin: 0;
  }

  /* ── Title block ────────────────────────────────────────────────────────────── */

  .title-block {
    margin-bottom: clamp(16px, 3vw, 32px);
    max-width: 680px;
    flex-shrink: 0;
    animation: fade-up 0.7s ease both;
    animation-delay: 0.1s;
  }

  /* Subtitle beneath the title — quieter, lets the name lead. */
  .hero-tagline {
    font-family: "Fraunces", Georgia, serif;
    font-style: italic;
    font-weight: 400;
    font-size: clamp(1rem, 1.8vw, 1.35rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    margin: clamp(6px, 1vw, 12px) 0 0;
    line-height: 1.3;
  }

  /* ── Hero body: centred video ──────────────────────────────────────────────── */

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
    max-width: min(30vw, 34vh / 0.8);
    max-height: calc(100vh - 200px);
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

  /* ── Hero quick links ───────────────────────────────────────────────────────── */

  .hero-links {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
    margin-top: 22px;
    animation: fade-up 0.7s ease both;
    animation-delay: 0.6s;
  }

  .hero-link {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    padding: 12px 22px;
    border-radius: 999px;
    font-family: var(--font-body, system-ui, sans-serif);
    font-size: 0.95rem;
    font-weight: 600;
    text-decoration: none;
    color: #e8e6f4;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.14);
    cursor: pointer;
    transition:
      transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1),
      box-shadow 0.18s ease,
      background 0.18s ease,
      border-color 0.18s ease;
  }

  .hero-link i {
    font-size: 0.9rem;
    transition: transform 0.18s ease;
  }

  .hero-link:hover,
  .hero-link:focus-visible {
    transform: translateY(-3px);
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.28);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    color: #fff;
    outline: none;
  }

  .hero-link:hover i,
  .hero-link:focus-visible i {
    transform: scale(1.15) rotate(-4deg);
  }

  .hero-link:active {
    transform: translateY(-1px);
  }

  /* Primary = Open the app */
  .hero-link.primary {
    color: #fff;
    background: linear-gradient(135deg, #6f8cff, #8b6cff);
    border-color: transparent;
    box-shadow: 0 4px 18px rgba(111, 140, 255, 0.4);
  }

  .hero-link.primary:hover,
  .hero-link.primary:focus-visible {
    box-shadow: 0 10px 30px rgba(111, 140, 255, 0.55);
    filter: brightness(1.06);
  }

  .hero-link.primary i {
    color: #fff;
  }

  /* Support heart hint */
  .hero-link:last-child:hover i {
    color: #ff8fbf;
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
      padding: 76px 16px 40px; /* clear the 56px mobile header */
    }

    .hero-body {
      flex-direction: column;
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
      padding: 72px 12px 36px;
    }

    .carousel-stage {
      border-radius: 10px;
    }
  }

  /* ── Reduced motion ─────────────────────────────────────────────────────────── */

  @media (prefers-reduced-motion: reduce) {
    .title-block,
    .carousel-stage,
    .carousel-footer,
    .hero-links {
      animation: none;
      opacity: 1;
      transform: none;
    }

    .hero-link,
    .hero-link i {
      transition: none;
    }

    .video-layer {
      transition: none;
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

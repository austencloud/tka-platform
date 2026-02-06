<script lang="ts">
  /**
   * VideoGalleryPrototypes
   *
   * Shows multiple video gallery layout options side by side for comparison.
   * Uses Intersection Observer for autoplay when videos scroll into view.
   */
  import VideoGridGallery from "./VideoGridGallery.svelte";
  import VideoCarousel from "./VideoCarousel.svelte";
  import VideoFocusGallery from "./VideoFocusGallery.svelte";
  import EndlessVideoPlayer from "./EndlessVideoPlayer.svelte";

  // Sample videos - we have 4 downloaded
  const SAMPLE_VIDEOS = [
    {
      url: "https://storage.googleapis.com/the-kinetic-alphabet.firebasestorage.app/users/PBp3GSBO6igCKPwJyLZNmVEmamI3/recordings/X-BΦ-θ-/1768875548469.mp4",
      word: "X-BΦ-Θ-",
    },
    // Local videos (these would need to be uploaded to Firebase)
    // For now, we'll duplicate the one we have to show layouts
    {
      url: "https://storage.googleapis.com/the-kinetic-alphabet.firebasestorage.app/users/PBp3GSBO6igCKPwJyLZNmVEmamI3/recordings/X-BΦ-θ-/1768875548469.mp4",
      word: "ΩΛ-XJ",
    },
    {
      url: "https://storage.googleapis.com/the-kinetic-alphabet.firebasestorage.app/users/PBp3GSBO6igCKPwJyLZNmVEmamI3/recordings/X-BΦ-θ-/1768875548469.mp4",
      word: "ECKΨ-",
    },
    {
      url: "https://storage.googleapis.com/the-kinetic-alphabet.firebasestorage.app/users/PBp3GSBO6igCKPwJyLZNmVEmamI3/recordings/X-BΦ-θ-/1768875548469.mp4",
      word: "GΩWL",
    },
  ];

  // Transform for EndlessVideoPlayer format
  const ENDLESS_VIDEOS = SAMPLE_VIDEOS.map(v => ({
    src: v.url,
    title: v.word,
    description: "TKA sequence demonstration",
  }));

  type LayoutType = "endless" | "grid-2x2" | "grid-3" | "carousel" | "focus" | "single";
  let activeLayout = $state<LayoutType>("endless");

  const layouts: { id: LayoutType; label: string; description: string }[] = [
    { id: "endless", label: "Endless", description: "Crossfading loop (recommended)" },
    { id: "single", label: "Single", description: "One featured video" },
    { id: "focus", label: "Focus", description: "One large + thumbnails" },
    { id: "carousel", label: "Carousel", description: "Swipe through videos" },
    { id: "grid-2x2", label: "Grid 2×2", description: "Four videos visible" },
    { id: "grid-3", label: "Grid Row", description: "Three in a row" },
  ];
</script>

<div class="prototypes-container">
  <header class="prototypes-header">
    <h1>Video Gallery Prototypes</h1>
    <p>Compare different layouts for the landing page video showcase</p>
  </header>

  <!-- Layout selector -->
  <nav class="layout-selector" aria-label="Gallery layout options">
    {#each layouts as layout}
      <button
        class="layout-option"
        class:active={activeLayout === layout.id}
        onclick={() => activeLayout = layout.id}
        aria-pressed={activeLayout === layout.id}
      >
        <span class="layout-label">{layout.label}</span>
        <span class="layout-desc">{layout.description}</span>
      </button>
    {/each}
  </nav>

  <!-- Active layout preview -->
  <section class="layout-preview" aria-live="polite">
    <h2 class="preview-title">
      {layouts.find(l => l.id === activeLayout)?.label} Layout
    </h2>

    <div class="preview-container">
      {#if activeLayout === "endless"}
        <div class="endless-container">
          <EndlessVideoPlayer videos={ENDLESS_VIDEOS} crossfadeDuration={800} />
        </div>
      {:else if activeLayout === "single"}
        <div class="single-video">
          <VideoFocusGallery videos={SAMPLE_VIDEOS.slice(0, 1)} showThumbnails={false} />
        </div>
      {:else if activeLayout === "focus"}
        <VideoFocusGallery videos={SAMPLE_VIDEOS} />
      {:else if activeLayout === "carousel"}
        <VideoCarousel videos={SAMPLE_VIDEOS} />
      {:else if activeLayout === "grid-2x2"}
        <VideoGridGallery videos={SAMPLE_VIDEOS} columns={2} />
      {:else if activeLayout === "grid-3"}
        <VideoGridGallery videos={SAMPLE_VIDEOS.slice(0, 3)} columns={3} />
      {/if}
    </div>
  </section>

  <!-- Notes section -->
  <section class="notes">
    <h3>Implementation Notes</h3>
    <ul>
      <li><strong>Endless (Recommended):</strong> Two video elements crossfade seamlessly, creating an infinite loop</li>
      <li><strong>Autoplay:</strong> Videos autoplay when scrolled into view (muted, per browser policy)</li>
      <li><strong>Performance:</strong> Uses requestAnimationFrame for smooth crossfades, Intersection Observer elsewhere</li>
      <li><strong>Accessibility:</strong> All videos have captions showing the TKA word</li>
      <li><strong>Mobile:</strong> Touch-friendly with swipe support on carousel</li>
      <li><strong>Future-proof:</strong> Pure CSS + native APIs, no external dependencies</li>
    </ul>
  </section>
</div>

<style>
  .prototypes-container {
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .prototypes-header {
    text-align: center;
    margin-bottom: 32px;
  }

  .prototypes-header h1 {
    font-size: clamp(1.5rem, 4vw, 2.5rem);
    font-weight: 600;
    margin: 0 0 8px 0;
  }

  .prototypes-header p {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    margin: 0;
  }

  /* Layout selector */
  .layout-selector {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
    margin-bottom: 32px;
  }

  .layout-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 20px;
    border-radius: 12px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    color: var(--theme-text, white);
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 100px;
  }

  .layout-option:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
  }

  .layout-option.active {
    background: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
  }

  .layout-label {
    font-weight: 600;
    font-size: var(--font-size-base, 14px);
  }

  .layout-desc {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .layout-option.active .layout-desc {
    color: rgba(255, 255, 255, 0.8);
  }

  /* Preview area */
  .layout-preview {
    margin-bottom: 48px;
  }

  .preview-title {
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    margin: 0 0 16px 0;
    text-align: center;
  }

  .preview-container {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border-radius: 16px;
    padding: 24px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .single-video {
    max-width: 600px;
    margin: 0 auto;
  }

  .endless-container {
    max-width: 400px;
    margin: 0 auto;
  }

  /* Notes */
  .notes {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border-radius: 12px;
    padding: 20px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .notes h3 {
    margin: 0 0 12px 0;
    font-size: var(--font-size-base, 14px);
    font-weight: 600;
  }

  .notes ul {
    margin: 0;
    padding-left: 20px;
  }

  .notes li {
    margin-bottom: 8px;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }

  .notes li strong {
    color: var(--theme-text, white);
  }

  @media (max-width: 600px) {
    .prototypes-container {
      padding: 16px;
    }

    .layout-selector {
      gap: 8px;
    }

    .layout-option {
      padding: 10px 14px;
      min-width: 80px;
    }

    .preview-container {
      padding: 16px;
    }
  }
</style>

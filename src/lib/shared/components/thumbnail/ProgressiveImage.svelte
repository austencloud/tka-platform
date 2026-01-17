<script lang="ts">
  import { generateSrcset, generateSizes } from "./srcset-utils";

  /**
   * ProgressiveImage - Image component with blur-up LQIP effect
   *
   * 🚀 PERFORMANCE: Shows a blurred placeholder while the full image loads,
   * then smoothly transitions to the sharp image.
   *
   * Uses CSS object-fit and opacity transitions for smooth effect.
   */

  const {
    src,
    alt,
    width = undefined,
    height = undefined,
    context = "grid",
    class: className = "",
  } = $props<{
    src: string | undefined;
    alt: string;
    width?: number;
    height?: number;
    context?: "grid" | "detail" | "fullscreen";
    class?: string;
  }>();

  // Image loading state
  let isLoaded = $state(false);
  let hasError = $state(false);

  // Generate responsive attributes
  const imageSrcset = $derived(generateSrcset(src));
  const imageSizes = $derived(generateSizes(context));

  // Generate tiny placeholder color based on first letter of alt text
  // This provides a consistent but varied background while loading
  const placeholderColor = $derived.by(() => {
    if (!alt) return "rgba(99, 102, 241, 0.3)"; // Default indigo
    const charCode = alt.charCodeAt(0) % 360;
    return `hsla(${charCode}, 50%, 30%, 0.5)`;
  });

  function handleLoad() {
    isLoaded = true;
  }

  function handleError() {
    hasError = true;
  }
</script>

<div
  class="progressive-image {className}"
  style:--placeholder-color={placeholderColor}
>
  {#if src && !hasError}
    <!-- Placeholder layer - blurred version or color -->
    <div class="placeholder" class:hidden={isLoaded} aria-hidden="true">
      <!-- Use smallest variant as blur source if available -->
      <img
        src={src.replace(/(\.[^.]+)$/, "_small$1")}
        alt=""
        class="blur-placeholder"
        loading="eager"
        onerror={(e) => {
          // Hide placeholder img if small variant doesn't exist
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    </div>

    <!-- Main image - fades in when loaded -->
    <img
      {src}
      srcset={imageSrcset}
      sizes={imageSizes}
      {alt}
      {width}
      {height}
      loading="lazy"
      decoding="async"
      class="main-image"
      class:loaded={isLoaded}
      onload={handleLoad}
      onerror={handleError}
    />
  {:else}
    <!-- Fallback placeholder -->
    <div class="fallback-placeholder">
      <span class="fallback-letter">{alt?.slice(0, 1) ?? "?"}</span>
    </div>
  {/if}
</div>

<style>
  .progressive-image {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--placeholder-color, rgba(99, 102, 241, 0.3));
  }

  /* Placeholder layer - shows blurred small variant */
  .placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity var(--duration-emphasis) ease-out;
  }

  .placeholder.hidden {
    opacity: 0;
    pointer-events: none;
  }

  .blur-placeholder {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: blur(20px);
    transform: scale(1.1); /* Prevent blur edges from showing */
  }

  /* Main image - fades in */
  .main-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    transition: opacity var(--duration-emphasis) ease-out;
  }

  .main-image.loaded {
    opacity: 1;
  }

  /* Fallback when no image available */
  .fallback-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(
      135deg,
      var(--theme-card-hover-bg),
      var(--theme-panel-bg)
    );
  }

  .fallback-letter {
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: 3rem;
    font-weight: 700;
  }

  /* Reduced motion: Skip animations */
  @media (prefers-reduced-motion: reduce) {
    .placeholder,
    .main-image {
      transition: none !important;
    }

    .main-image {
      opacity: 1; /* Show immediately */
    }

    .placeholder {
      display: none;
    }
  }
</style>

<!-- SpotlightImage.svelte - Image display and navigation for fullscreen viewer (Refactored) -->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { resolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import { onMount } from "svelte";
  import type { SpotlightState } from "../state/SpotlightState.svelte";

  // ✅ PURE RUNES: Props using modern Svelte 5 runes
  const { spotlightState, onImageLoaded = () => {} } = $props<{
    spotlightState: SpotlightState;
    onImageLoaded?: () => void;
  }>();

  let hapticService: IHapticFeedback;

  onMount(() => {
    hapticService = resolve<IHapticFeedback>(TYPES.IHapticFeedback);
  });

  // Track current and previous image URLs for crossfade effect
  let currentImageUrl = $state<string>("");
  let previousImageUrl = $state<string>("");
  let isTransitioning = $state<boolean>(false);

  // Watch for image URL changes and trigger scale + fade transition
  $effect(() => {
    const newUrl = spotlightState.currentImageUrl;
    if (newUrl && newUrl !== currentImageUrl) {
      // Start scale + fade transition
      previousImageUrl = currentImageUrl;
      currentImageUrl = newUrl;
      isTransitioning = true;

      // End transition after animation completes
      setTimeout(() => {
        isTransitioning = false;
        previousImageUrl = "";
      }, 500); // Match the CSS transition duration
    }
  });

  function handleImageLoad() {
    spotlightState.onImageLoaded();
    onImageLoaded();
  }

  function handleImageError() {
    spotlightState.onImageError();
  }

  function retryImageLoad() {
    hapticService?.trigger("selection");
    // Force image reload by updating state
    if (spotlightState.currentSequence) {
      spotlightState.goToVariation(spotlightState.currentVariationIndex);
    }
  }

  function goToPreviousVariation() {
    hapticService?.trigger("selection");
    spotlightState.goToPreviousVariation();
  }

  function goToNextVariation() {
    hapticService?.trigger("selection");
    spotlightState.goToNextVariation();
  }

  function goToVariation(index: number) {
    hapticService?.trigger("selection");
    spotlightState.goToVariation(index);
  }
</script>

<div class="image-viewer">
  <div class="image-container">
    {#if spotlightState.imageError}
      <div class="error-state" role="alert" aria-live="assertive">
        <div class="error-icon">⚠️</div>
        <p>Failed to load image</p>
        <button class="retry-button" onclick={retryImageLoad}>Retry</button>
      </div>
    {:else}
      {#if spotlightState.isImageLoading && !isTransitioning}
        <div
          class="loading-spinner"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div class="spinner" aria-hidden="true"></div>
          <p>Loading image...</p>
        </div>
      {/if}

      <!-- Image crossfade container -->
      <div class="image-crossfade-container">
        <!-- Previous image (fading out) -->
        {#if isTransitioning && previousImageUrl}
          <img
            src={previousImageUrl}
            alt="Previous sequence"
            class="sequence-image previous-image"
          />
        {/if}

        <!-- Current image (fading in) -->
        {#if currentImageUrl}
          <img
            src={currentImageUrl}
            alt={spotlightState.currentSequence?.word || "Sequence"}
            class="sequence-image current-image"
            class:loading={spotlightState.isImageLoading && !isTransitioning}
            class:transitioning={isTransitioning}
            onload={handleImageLoad}
            onerror={handleImageError}
          />
        {/if}
      </div>
    {/if}

    <!-- Navigation arrows -->
    {#if spotlightState.hasMultipleVariations}
      <button
        class="nav-arrow prev"
        onclick={goToPreviousVariation}
        aria-label="Previous variation"
      >
        <span class="arrow-icon">‹</span>
      </button>

      <button
        class="nav-arrow next"
        onclick={goToNextVariation}
        aria-label="Next variation"
      >
        <span class="arrow-icon">›</span>
      </button>
    {/if}
  </div>

  <!-- Variation indicator -->
  {#if spotlightState.hasMultipleVariations && spotlightState.variationInfo}
    <div class="variation-indicator">
      <span class="variation-text">
        Variation {spotlightState.variationInfo.current} of {spotlightState
          .variationInfo.total}
      </span>
      <div class="variation-dots">
        {#each { length: spotlightState.totalVariations } as _, index}
          <button
            class="variation-dot"
            class:active={index === spotlightState.currentVariationIndex}
            onclick={() => goToVariation(index)}
            aria-label={`Go to variation ${index + 1}`}
          ></button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .image-viewer {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    min-height: 0;
    width: 100%;
  }

  .image-container {
    position: relative;
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 80vh;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
  }

  .image-crossfade-container {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .sequence-image {
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 8px;
    box-shadow: 0 8px 32px var(--theme-shadow);
  }

  /* Previous image scales down and fades out */
  .sequence-image.previous-image {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    opacity: 1;
    animation: scaleOutFade 500ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
    z-index: 1;
  }

  /* Current image scales up and fades in */
  .sequence-image.current-image {
    position: relative;
    opacity: 1;
    z-index: 2;
  }

  .sequence-image.current-image.transitioning {
    animation: scaleInFade 500ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }

  .sequence-image.loading {
    opacity: 0;
  }

  @keyframes scaleOutFade {
    from {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
    to {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.85);
    }
  }

  @keyframes scaleInFade {
    from {
      opacity: 0;
      transform: scale(0.85);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .loading-spinner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    color: white;
    animation: spinnerFadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }

  @keyframes spinnerFadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .spinner {
    width: 3rem;
    height: 3rem;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top: 3px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    color: white;
    text-align: center;
  }

  .error-icon {
    font-size: 3rem;
  }

  .retry-button {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .retry-button:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .nav-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(0, 0, 0, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    z-index: 10;
  }

  .nav-arrow:hover:not(.disabled) {
    background: rgba(0, 0, 0, 0.9);
    border-color: rgba(255, 255, 255, 0.4);
    transform: translateY(-50%) scale(1.1);
  }

  .nav-arrow.prev {
    left: -4rem;
  }

  .nav-arrow.next {
    right: -4rem;
  }

  .arrow-icon {
    font-size: 1.5rem;
    font-weight: bold;
  }

  .variation-indicator {
    margin-top: 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    color: white;
  }

  .variation-text {
    font-size: 0.875rem;
    opacity: 0.8;
  }

  .variation-dots {
    display: flex;
    gap: 0.5rem;
  }

  .variation-dot {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.1);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .variation-dot:hover {
    background: rgba(255, 255, 255, 0.3);
    border-color: var(--theme-text-dim);
  }

  .variation-dot.active {
    background: white;
    border-color: white;
  }

  /* Mobile adjustments */
  @media (max-width: 768px) {
    .image-viewer {
      padding: 1rem;
      max-width: none;
    }

    .image-container {
      max-height: 60vh;
    }

    .nav-arrow {
      width: 2.5rem;
      height: 2.5rem;
    }

    .nav-arrow.prev {
      left: -3rem;
    }

    .nav-arrow.next {
      right: -3rem;
    }

    .arrow-icon {
      font-size: 1.25rem;
    }
  }
</style>

<!--
  PropAwareThumbnail

  Thin presentation component for sequence thumbnails.
  All logic delegated to services:
  - IThumbnailKeyDeriver: Cache key derivation
  - IThumbnailRenderOrchestrator: Cache check → queue → render → upload

  Features:
  - Lazy loading via IntersectionObserver
  - Single hash comparison for change detection (replaces 13 prev* variables)
  - Throttled rendering (max 3 concurrent via queue)
  - Cloud caching for instant subsequent loads
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import type { ThumbnailVariant } from "../services/contracts/ICloudThumbnailCache";
  import { getContainerInstance } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import type {
    IThumbnailRenderOrchestrator,
    ThumbnailLoadStatus,
  } from "../services/contracts/IThumbnailRenderOrchestrator";
  import type {
    IThumbnailKeyDeriver,
    ThumbnailRenderInput,
  } from "../services/contracts/IThumbnailKeyDeriver";
  import type { ICloudThumbnailCache } from "../services/contracts/ICloudThumbnailCache";

  interface Props {
    sequence: SequenceData;
    bluePropType?: PropType;
    redPropType?: PropType;
    catDogModeEnabled?: boolean;
    lightMode?: boolean;
    variant?: ThumbnailVariant;
    // Composition overrides
    addWord?: boolean;
    addBeatNumbers?: boolean;
    includeStartPosition?: boolean;
    addDifficultyLevel?: boolean;
    addUserInfo?: boolean;
    userName?: string;
    showCreatorName?: boolean;
    showNotes?: boolean;
    showBirthday?: boolean;
    customNotesText?: string;
  }

  const {
    sequence,
    bluePropType,
    redPropType,
    catDogModeEnabled = false,
    lightMode = false,
    variant = "gallery",
    addWord,
    addBeatNumbers,
    includeStartPosition,
    addDifficultyLevel,
    addUserInfo,
    userName,
    showCreatorName,
    showNotes,
    showBirthday,
    customNotesText,
  }: Props = $props();

  // State
  let containerRef = $state<HTMLDivElement | null>(null);
  let thumbnailUrl = $state<string | null>(null);
  let status = $state<ThumbnailLoadStatus>({ state: "idle" });
  let isVisible = $state(false);
  let currentKeyHash = $state<string | null>(null);

  // Non-reactive flag to skip cache after 404 (avoids $effect dependency loop)
  let skipCacheOnNextRequest = false;
  // Debounce error handling to prevent rapid re-triggers
  let errorDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Services (resolved once on mount)
  let orchestrator: IThumbnailRenderOrchestrator | null = null;
  let keyDeriver: IThumbnailKeyDeriver | null = null;
  let cloudCache: ICloudThumbnailCache | null = null;
  let servicesReady = $state(false);

  // Derived: sequence name
  const sequenceName = $derived(sequence.word || sequence.name || "");

  // Derived: Build render input from props
  const renderInput = $derived<ThumbnailRenderInput>({
    sequenceName,
    bluePropType,
    redPropType,
    catDogModeEnabled,
    lightMode,
    variant,
    addWord,
    addBeatNumbers,
    includeStartPosition,
    addDifficultyLevel,
    addUserInfo,
    userName,
    showCreatorName,
    showNotes,
    showBirthday,
    customNotesText,
  });

  // Intersection observer for lazy loading
  let observer: IntersectionObserver | null = null;

  onMount(async () => {
    // Resolve services
    const container = await getContainerInstance();
    orchestrator = container.get<IThumbnailRenderOrchestrator>(
      TYPES.IThumbnailRenderOrchestrator
    );
    keyDeriver = container.get<IThumbnailKeyDeriver>(TYPES.IThumbnailKeyDeriver);
    cloudCache = container.get<ICloudThumbnailCache>(TYPES.ICloudThumbnailCache);
    servicesReady = true;

    // Set up intersection observer
    if (containerRef) {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting && !isVisible) {
            isVisible = true;
          }
        },
        { rootMargin: "50px", threshold: 0.01 }
      );
      observer.observe(containerRef);
    }
  });

  onDestroy(() => {
    observer?.disconnect();

    // Clear any pending error debounce
    if (errorDebounceTimer) {
      clearTimeout(errorDebounceTimer);
    }

    // Cancel any pending render
    if (currentKeyHash && orchestrator) {
      orchestrator.cancel({ hash: currentKeyHash });
    }

    // Revoke blob URL to prevent memory leak
    if (thumbnailUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(thumbnailUrl);
    }
  });

  /**
   * Handle successful image load
   */
  function handleImageLoad() {
    const urlType = thumbnailUrl?.startsWith("blob:") ? "blob" : "cloud";
    console.log(`[Thumbnail] "${sequenceName}" - img onload SUCCESS (${urlType})`);
  }

  /**
   * Handle image load error (e.g., 404 from stale cloud URL).
   * Invalidates the cached URL and forces a fresh render (skipping cache).
   * Debounced to prevent rapid re-triggers from multiple error events.
   */
  function handleImageError() {
    // Debounce: if we already have a pending error handler, skip
    if (errorDebounceTimer) return;

    const urlType = thumbnailUrl?.startsWith("blob:") ? "blob" : "cloud";
    console.warn(`[Thumbnail] "${sequenceName}" - img ERROR (${urlType}) - will re-render`);

    if (!keyDeriver || !cloudCache || !orchestrator) return;

    const key = keyDeriver.deriveKey(renderInput);

    // Invalidate the stale cloud URL
    if (key.usesDefaults) {
      cloudCache.invalidateUrl({
        sequenceName: key.inputs.sequenceName,
        propType: key.propKey as PropType,
        lightMode: key.inputs.lightMode,
        variant: key.inputs.variant,
      });
    }

    // Set flag to skip cache on next request (prevents infinite loop)
    skipCacheOnNextRequest = true;

    // Debounce the state reset to prevent rapid cycling
    errorDebounceTimer = setTimeout(() => {
      errorDebounceTimer = null;
      // Clear current state to force re-fetch
      thumbnailUrl = null;
      currentKeyHash = null; // This will trigger the $effect to re-run
      status = { state: "idle" };
    }, 100);
  }

  // React to visibility + input changes
  // Single effect replaces 13 prev* variable comparisons
  $effect(() => {
    if (!isVisible || !servicesReady || !orchestrator || !keyDeriver || !sequenceName) {
      return;
    }

    const key = keyDeriver.deriveKey(renderInput);

    // Skip if key hasn't changed
    if (key.hash === currentKeyHash) {
      return;
    }

    // DEBUG: Log when effect fires and why
    const reason = currentKeyHash === null ? "initial" : "hash-changed";
    console.log(`[Thumbnail] "${sequenceName}" - $effect fired (${reason}), lightMode=${lightMode}`);

    // Cancel previous render
    if (currentKeyHash) {
      orchestrator.cancel({ hash: currentKeyHash });
    }
    currentKeyHash = key.hash;

    // Revoke old blob URL
    if (thumbnailUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(thumbnailUrl);
      thumbnailUrl = null;
    }

    // Capture and reset the skipCache flag
    const shouldSkipCache = skipCacheOnNextRequest;
    skipCacheOnNextRequest = false;

    // Calculate priority based on Y position (lower = closer to top = higher priority)
    const priority = containerRef?.getBoundingClientRect().top ?? Infinity;

    // Request thumbnail (cache check → queue → render → upload)
    orchestrator
      .getThumbnail({
        sequence,
        input: renderInput,
        skipCache: shouldSkipCache,
        priority,
        onStatusChange: (s) => {
          status = s;
        },
      })
      .then((result) => {
        // Only apply if still current
        if (key.hash === currentKeyHash) {
          thumbnailUrl = result.url;
          // DEBUG: Log what URL type we got
          const urlType = result.url.startsWith("blob:") ? "blob" : "cloud";
          console.log(`[Thumbnail] "${sequenceName}" - loaded (${urlType}, fromCache=${result.fromCache})`);
        }
      })
      .catch((err) => {
        // Only show error if still current and not cancelled
        if (key.hash === currentKeyHash && err.message !== "Cancelled") {
          status = { state: "error", error: err };
        }
      });
  });

  // Derive display states
  const isLoading = $derived(
    status.state === "checking-cache" ||
    status.state === "queued" ||
    status.state === "rendering" ||
    status.state === "uploading"
  );
  const hasError = $derived(status.state === "error");
  // Simplified loading text - just show spinner, no distracting text
  const loadingText = $derived(
    status.state === "rendering" ? "Rendering" : ""
  );
</script>

<div class="prop-thumbnail" data-variant={variant} bind:this={containerRef}>
  {#if thumbnailUrl && !hasError}
    <img
      src={thumbnailUrl}
      alt={`Preview of ${sequenceName}`}
      loading="lazy"
      decoding="async"
      draggable="false"
      onload={handleImageLoad}
      onerror={handleImageError}
    />
    <!-- Loading overlay during re-renders -->
    {#if isLoading && loadingText}
      <div class="loading-overlay" aria-label="Re-rendering thumbnail">
        <div class="spinner"></div>
        <span class="loading-status" aria-live="polite">{loadingText}</span>
      </div>
    {/if}
  {:else if isLoading}
    <div class="loading-placeholder" aria-label="Loading thumbnail">
      <div class="spinner"></div>
      {#if loadingText}
        <span class="loading-status" aria-live="polite">{loadingText}</span>
      {/if}
    </div>
  {:else if hasError}
    <div class="error-placeholder" aria-label="Failed to load">
      <span class="error-icon">!</span>
    </div>
  {:else}
    <div class="empty-placeholder" aria-label="Sequence preview">
      <span class="letter">{sequenceName?.slice(0, 1) ?? "?"}</span>
    </div>
  {/if}
</div>

<style>
  .prop-thumbnail {
    width: 100%;
    max-width: 100%;
    max-height: 100%;
    aspect-ratio: 4 / 3;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg);
    overflow: hidden;
    position: relative;
    box-sizing: border-box;
    flex-shrink: 1;
  }

  /* Container query adaptive sizing */
  @container image-container (aspect-ratio > 4/3) {
    .prop-thumbnail {
      width: auto;
      height: 100cqh;
      max-height: 100%;
    }
  }

  @container image-container (aspect-ratio <= 4/3) {
    .prop-thumbnail {
      width: 100cqw;
      height: auto;
      max-width: 100%;
    }
  }

  /* Word cards use natural image dimensions */
  .prop-thumbnail[data-variant="wordcard"] {
    aspect-ratio: unset;
  }

  .prop-thumbnail[data-variant="wordcard"] img {
    width: 100%;
    height: auto;
    object-fit: fill;
  }

  .prop-thumbnail img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: contain;
    max-width: 100%;
    max-height: 100%;
    -webkit-user-drag: none;
    user-select: none;
    pointer-events: none;
  }

  .loading-placeholder,
  .empty-placeholder,
  .error-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: linear-gradient(
      135deg,
      var(--theme-card-hover-bg),
      var(--theme-panel-bg)
    );
    color: var(--theme-text-dim);
  }

  .error-placeholder {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--semantic-error) 10%, transparent),
      var(--theme-panel-bg)
    );
  }

  .error-icon {
    font-size: 2rem;
    font-weight: 700;
    color: var(--semantic-error);
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--theme-stroke);
    border-top-color: var(--theme-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .loading-status {
    font-size: 10px;
    opacity: 0.7;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .letter {
    font-size: 3rem;
    font-weight: 700;
    opacity: 0.5;
  }

  /* Loading overlay on top of existing image */
  .loading-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(2px);
    z-index: 10;
  }

  .loading-overlay .spinner {
    width: 28px;
    height: 28px;
    border-width: 3px;
  }

  .loading-overlay .loading-status {
    color: white;
    font-size: 11px;
    opacity: 0.9;
  }

  /* Container query responsive sizing */
  @container sequence-card (max-width: 249px) {
    .letter {
      font-size: 2rem;
    }
    .spinner {
      width: 16px;
      height: 16px;
    }
    .loading-status {
      display: none;
    }
    .loading-overlay .spinner {
      width: 20px;
      height: 20px;
    }
  }
</style>

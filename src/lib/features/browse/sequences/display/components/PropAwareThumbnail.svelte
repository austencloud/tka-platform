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
  import { container } from "$lib/shared/di";
  import type {
    IThumbnailRenderOrchestrator,
    ThumbnailLoadStatus,
  } from "../services/contracts/IThumbnailRenderOrchestrator";
  import type {
    IThumbnailKeyDeriver,
    ThumbnailRenderInput,
    ThumbnailVisibilitySettings,
  } from "../services/contracts/IThumbnailKeyDeriver";
  import type { ICloudThumbnailCache } from "../services/contracts/ICloudThumbnailCache";
  import { layoutCalculator } from "$lib/shared/render/services/implementations/LayoutCalculator";
  import { simplifyRepeatedWord } from "$lib/features/create/shared/workspace-panel/shared/utils/word-simplifier";

  interface Props {
    sequence: SequenceData;
    bluePropType?: PropType;
    redPropType?: PropType;
    catDogModeEnabled?: boolean;
    lightMode?: boolean;
    variant?: ThumbnailVariant;
    // Composition overrides
    addWord?: boolean;
    addStepNumbers?: boolean;
    includeStartPosition?: boolean;
    addDifficultyLevel?: boolean;
    addUserInfo?: boolean;
    userName?: string;
    showCreatorName?: boolean;
    showNotes?: boolean;
    showBirthday?: boolean;
    customNotesText?: string;
    // Visibility overrides (grid, hand points, glyphs)
    visibility?: ThumbnailVisibilitySettings;
  }

  const {
    sequence,
    bluePropType,
    redPropType,
    catDogModeEnabled = false,
    lightMode = false,
    variant = "gallery",
    addWord,
    addStepNumbers,
    includeStartPosition,
    addDifficultyLevel,
    addUserInfo,
    userName,
    showCreatorName,
    showNotes,
    showBirthday,
    customNotesText,
    visibility,
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

  // Layout calculator resolved synchronously (direct import for instant HMR)

  // Derived: sequence name (raw)
  const sequenceName = $derived(sequence.word || sequence.name || "");

  // Derived: simplified display name (removes repeated patterns like "ABCABC" → "ABC")
  const displayName = $derived(simplifyRepeatedWord(sequenceName));

  // Derived: beat count for aspect ratio calculation
  // Priority: steps array length (if not empty) > sequenceLength field > fallback to 4
  // NOTE: Use || not ?? because steps is often [] (empty array) for Community sequences,
  // and [].length is 0 which ?? treats as valid (only null/undefined fall through)
  const stepCount = $derived(
    sequence.steps?.length || sequence.sequenceLength || 4
  );

  // Derived: aspect ratio based on beat count and variant
  // Gallery variant has header + footer, wordcard uses natural aspect ratio
  const aspectRatio = $derived.by(() => {
    if (variant === "wordcard") {
      return undefined; // Wordcard uses natural image aspect ratio
    }
    return layoutCalculator.calculateGalleryAspectRatio(stepCount);
  });

  // Derived: Build render input from props
  const renderInput = $derived<ThumbnailRenderInput>({
    sequenceName,
    bluePropType,
    redPropType,
    catDogModeEnabled,
    lightMode,
    variant,
    addWord,
    addStepNumbers,
    includeStartPosition,
    addDifficultyLevel,
    addUserInfo,
    userName,
    showCreatorName,
    showNotes,
    showBirthday,
    customNotesText,
    visibility,
  });

  // Intersection observer for lazy loading
  let observer: IntersectionObserver | null = null;

  onMount(async () => {
    // Resolve services
    orchestrator = container.items.thumbnailRenderOrchestrator;
    keyDeriver = container.items.thumbnailKeyDeriver;
    cloudCache = container.items.cloudThumbnailCache;
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
    // Image loaded successfully
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
      // Revoke blob URL before clearing to prevent memory leak
      if (thumbnailUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(thumbnailUrl);
      }
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

    // Cancel previous render
    if (currentKeyHash) {
      orchestrator.cancel({ hash: currentKeyHash });
    }
    currentKeyHash = key.hash;

    // Clear old thumbnail - don't show stale image while loading new one
    if (thumbnailUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(thumbnailUrl);
    }
    thumbnailUrl = null; // Always clear so we show loading placeholder, not old image

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

  // Derive progress percentage from status state
  // Maps to where time is ACTUALLY spent:
  // - Waiting (cache/queue): 0% - no work started yet
  // - Rendering steps: 0-98% of bar (all the real work)
  // - Finalize: instant → 98-100% of bar
  const progressPercent = $derived.by(() => {
    switch (status.state) {
      case "idle":
      case "checking-cache":
      case "queued":
        // No progress until rendering actually starts
        return 0;
      case "rendering": {
        // Rendering gets 98% of the bar since it's virtually all the work
        if (status.progress) {
          const { current, total } = status.progress;
          if (total > 0) {
            // Scale beat progress to 0-98% range
            const stepProgress = (current / total) * 98;
            return Math.round(stepProgress);
          }
        }
        // Fallback when no progress data yet (just started)
        return 0;
      }
      case "uploading":
        return 99;
      case "complete":
        return 100;
      case "error":
        return 0;
      default:
        return 0;
    }
  });

  // Status label for accessibility
  // Uses stepCount (defined above) for display instead of progress.total which includes start position
  const statusLabel = $derived.by(() => {
    switch (status.state) {
      case "checking-cache":
        return "Checking";
      case "queued":
        return "Queued";
      case "rendering": {
        if (status.progress && status.progress.total > 0) {
          // Show progress relative to beat count, not total (which includes start position)
          // current starts at 1 for start position, so subtract 1 for beat-only display
          const currentStep = Math.max(0, status.progress.current - (status.progress.total - stepCount));
          return `${currentStep}/${stepCount}`;
        }
        return "Rendering";
      }
      case "uploading":
        return "Saving";
      default:
        return "Loading";
    }
  });
</script>

<div
  class="prop-thumbnail"
  data-variant={variant}
  bind:this={containerRef}
  style:aspect-ratio={aspectRatio}
>
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
    <!-- Loading overlay during re-renders (e.g., prop change) -->
    {#if isLoading}
      <div class="loading-overlay" aria-label={statusLabel}>
        <div class="overlay-content">
          <div class="spinner"></div>
          <span class="overlay-status">{statusLabel}</span>
        </div>
        <div
          class="progress-bar"
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div class="progress-fill" style:width="{progressPercent}%"></div>
        </div>
      </div>
    {/if}
  {:else if hasError}
    <div class="error-placeholder" aria-label="Failed to load">
      <span class="error-icon">!</span>
      <span class="placeholder-word">{displayName}</span>
    </div>
  {:else}
    <!-- Unified placeholder: always shows word, conditionally shows loading indicators -->
    <div class="loading-placeholder" aria-label={isLoading ? statusLabel : "Waiting to load"}>
      <span class="placeholder-word">{displayName}</span>
      {#if isLoading}
        <div class="loading-indicator">
          <div class="spinner"></div>
          <span class="loading-status">{statusLabel}</span>
        </div>
        <div
          class="progress-bar"
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={statusLabel}
        >
          <div class="progress-fill" style:width="{progressPercent}%"></div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .prop-thumbnail {
    width: 100%;
    max-width: 100%;
    max-height: 100%;
    /* aspect-ratio is set dynamically via inline style based on beat count */
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
  .error-placeholder {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 12px;
    background: linear-gradient(
      135deg,
      var(--theme-card-hover-bg),
      var(--theme-panel-bg)
    );
    color: var(--theme-text-dim);
    box-sizing: border-box;
  }

  .placeholder-word {
    /* Scale with container - larger base, scales down for small containers */
    font-size: clamp(16px, 6cqi, 28px);
    font-weight: 600;
    color: var(--theme-text, white);
    text-align: center;
    max-width: 95%;
    line-height: 1.15;
    opacity: 0.95;
    /* Allow wrapping for long words, but break anywhere if needed */
    word-break: break-word;
    overflow-wrap: anywhere;
  }

  .loading-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .loading-status {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    text-transform: capitalize;
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

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Progress bar */
  .progress-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--theme-accent, #6366f1);
    transition: width var(--duration-emphasis) ease-out;
    border-radius: 0 2px 2px 0;
  }

  /* Loading overlay on top of existing image */
  .loading-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    z-index: 10;
  }

  .overlay-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .overlay-status {
    font-size: var(--font-size-compact, 12px);
    color: white;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    opacity: 0.9;
  }

  .loading-overlay .spinner {
    width: 28px;
    height: 28px;
    border-width: 3px;
  }

  .loading-overlay .progress-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 6px;
    background: rgba(255, 255, 255, 0.2);
  }

  .loading-overlay .progress-fill {
    background: var(--theme-accent, #6366f1);
    box-shadow: 0 0 8px var(--theme-accent, #6366f1);
  }

  /* Container query responsive sizing */
  @container sequence-card (max-width: 249px) {
    .placeholder-word {
      font-size: clamp(12px, 5cqi, 18px);
    }
    .loading-indicator {
      gap: 4px;
    }
    .loading-status {
      font-size: 10px;
    }
    .spinner {
      width: 16px;
      height: 16px;
    }
    .progress-bar {
      height: 3px;
    }
    .overlay-status {
      font-size: 10px;
    }
    .loading-overlay .spinner {
      width: 20px;
      height: 20px;
    }
    .loading-overlay .progress-bar {
      height: 4px;
    }
  }

  /* Very small cards - hide some elements */
  @container sequence-card (max-width: 149px) {
    .placeholder-word {
      font-size: clamp(10px, 4cqi, 14px);
    }
    .loading-status {
      display: none;
    }
    .loading-indicator {
      gap: 0;
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
  }
</style>

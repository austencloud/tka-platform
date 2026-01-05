<!--
  PropAwareThumbnail

  Displays sequence thumbnails based on user's prop configuration.
  Uses a multi-tier caching strategy:

  1. Check Firebase Storage (cloud cache) - shared across all users
  2. If not found, render locally on this device
  3. Upload rendered image to Firebase Storage for future users
  4. Cache locally in IndexedDB for offline access

  This enables "crowd-sourced rendering" - the first user to view a
  prop combination pays the rendering cost, all subsequent users get instant loading.

  For single-prop mode with staff (the default):
    - Pre-rendered images should exist in Firebase Storage
    - Instant loading for most users

  For other props or cat-dog mode:
    - First viewer renders and uploads
    - All subsequent viewers get cached version
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { getContainerInstance } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import type { IDiscoverThumbnailCache } from "../services/contracts/IDiscoverThumbnailCache";
  import type { ICloudThumbnailCache } from "../services/contracts/ICloudThumbnailCache";
  import type { ISequenceRenderer } from "$lib/shared/render/services/contracts/ISequenceRenderer";
  import type { IDiscoverLoader } from "../services/contracts/IDiscoverLoader";
  import type { IStartPositionDeriver } from "$lib/shared/pictograph/shared/services/contracts/IStartPositionDeriver";
  import { isCatDogMode } from "../services/implementations/DiscoverThumbnailCache";

  interface Props {
    sequence: SequenceData;
    bluePropType?: PropType;
    redPropType?: PropType;
    catDogModeEnabled?: boolean;
    lightMode?: boolean;
    // Image composition settings - when provided, skips cloud caching and renders fresh
    // This enables the sequence viewer to show customized export previews
    addWord?: boolean;
    addBeatNumbers?: boolean;
    includeStartPosition?: boolean;
    addDifficultyLevel?: boolean;
    addUserInfo?: boolean;
    userName?: string;
  }

  const {
    sequence,
    bluePropType,
    redPropType,
    catDogModeEnabled = false,
    lightMode = false,
    // Image composition settings - undefined means use defaults
    addWord,
    addBeatNumbers,
    includeStartPosition,
    addDifficultyLevel,
    addUserInfo,
    userName,
  }: Props = $props();

  // When custom settings are provided, we render fresh (no caching)
  const hasCustomSettings = $derived(
    addWord !== undefined ||
      addBeatNumbers !== undefined ||
      includeStartPosition !== undefined ||
      addDifficultyLevel !== undefined ||
      addUserInfo !== undefined
  );

  // State
  let containerRef = $state<HTMLDivElement | null>(null);
  let thumbnailUrl = $state<string | null>(null);
  let isLoading = $state(false);
  let hasError = $state(false);
  let isVisible = $state(false);
  let loadingStatus = $state<string>("");

  // Derived
  const sequenceName = $derived(sequence.word || sequence.name);
  const isCatDog = $derived(
    isCatDogMode(bluePropType, redPropType, catDogModeEnabled)
  );

  // For single-prop mode, use the blue prop (or red if blue isn't set, or default to staff)
  const effectivePropType = $derived(
    isCatDog ? null : bluePropType || redPropType || PropType.STAFF
  );

  // Intersection Observer for lazy loading
  let observer: IntersectionObserver | null = null;

  // Track previous prop values to detect actual changes
  let prevBlueProp = $state<PropType | undefined>(undefined);
  let prevRedProp = $state<PropType | undefined>(undefined);
  let prevCatDogMode = $state(false);
  let prevLightMode = $state(false);
  // Track previous image composition settings
  let prevAddWord = $state<boolean | undefined>(undefined);
  let prevAddBeatNumbers = $state<boolean | undefined>(undefined);
  let prevIncludeStartPosition = $state<boolean | undefined>(undefined);
  let prevAddDifficultyLevel = $state<boolean | undefined>(undefined);
  let prevAddUserInfo = $state<boolean | undefined>(undefined);
  let hasInitiallyLoaded = $state(false);

  onMount(() => {
    if (!containerRef) return;

    // Set up intersection observer for lazy loading
    observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && !isVisible) {
          isVisible = true;
          loadThumbnail();
        }
      },
      {
        rootMargin: "200px", // Start loading well before visible
        threshold: 0.1,
      }
    );

    observer.observe(containerRef);
  });

  onDestroy(() => {
    observer?.disconnect();
    // Revoke blob URL if we created one
    if (thumbnailUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(thumbnailUrl);
    }
  });

  /**
   * Main thumbnail loading function
   * Tries cloud cache first, then renders locally and uploads
   * When custom settings are provided, skips caching entirely
   */
  async function loadThumbnail() {
    if (isLoading || thumbnailUrl) return;

    isLoading = true;
    hasError = false;

    try {
      // When custom settings are provided, skip cloud caching entirely
      // This is used by the sequence viewer to show customized export previews
      if (hasCustomSettings) {
        loadingStatus = "Rendering...";
        const blob = await renderThumbnail();
        thumbnailUrl = URL.createObjectURL(blob);
        hasInitiallyLoaded = true;
        loadingStatus = "";
        return;
      }

      // Standard flow: try cloud cache first
      loadingStatus = "Checking cache...";
      const container = await getContainerInstance();
      const cloudCache = container.get<ICloudThumbnailCache>(
        TYPES.ICloudThumbnailCache
      );

      // Determine the cloud cache key based on mode
      const cloudKey = isCatDog ? getCatDogCloudKey() : getSinglePropCloudKey();

      if (!cloudKey) {
        throw new Error("Could not determine prop configuration");
      }

      // DEBUG: Log what prop type we're requesting
      console.log(`[PropAwareThumbnail] Loading ${sequenceName} with props:`, {
        isCatDog,
        effectivePropType,
        bluePropType,
        redPropType,
        cloudKey,
      });

      // Step 1: Check Firebase Storage (cloud cache)
      loadingStatus = "Checking cloud...";
      const cloudUrl = await cloudCache.getUrl(cloudKey);

      if (cloudUrl) {
        // Found in cloud! Use directly (no blob URL needed)
        console.log(`[PropAwareThumbnail] Found in cloud: ${cloudUrl}`);
        thumbnailUrl = cloudUrl;
        hasInitiallyLoaded = true;
        loadingStatus = "";
        return;
      }

      // Step 2: Not in cloud - render locally
      console.log(`[PropAwareThumbnail] Not in cloud, rendering locally...`);
      loadingStatus = "Rendering...";
      const blob = await renderThumbnail();

      // Step 3: Create URL for immediate display
      thumbnailUrl = URL.createObjectURL(blob);
      hasInitiallyLoaded = true;
      loadingStatus = "Uploading...";

      // Step 4: Upload to Firebase Storage (async, don't block display)
      cloudCache.upload(cloudKey, blob).catch((error) => {
        // Non-fatal - image is displayed, just couldn't upload for others
        console.warn(
          `Failed to upload thumbnail to cloud for ${sequenceName}:`,
          error
        );
      });

      // Step 5: Also cache locally in IndexedDB (for offline access)
      if (isCatDog) {
        const localCache = container.get<IDiscoverThumbnailCache>(
          TYPES.IDiscoverThumbnailCache
        );
        const localKey = {
          sequenceName,
          bluePropType: bluePropType!,
          redPropType: redPropType!,
          lightMode,
        };
        localCache.set(localKey, blob).catch((error) => {
          console.warn(`Failed to cache thumbnail locally:`, error);
        });
      }

      loadingStatus = "";
    } catch (error) {
      console.error(`Failed to load thumbnail for ${sequenceName}:`, error);
      hasError = true;
      loadingStatus = "";
    } finally {
      isLoading = false;
    }
  }

  /**
   * Get cloud cache key for single-prop mode
   */
  function getSinglePropCloudKey() {
    if (!effectivePropType) return null;
    return {
      sequenceName,
      propType: effectivePropType,
      lightMode,
    };
  }

  /**
   * Get cloud cache key for cat-dog mode
   * Uses a combined prop type identifier with position preserved
   * Blue = left hand, Red = right hand - order matters!
   */
  function getCatDogCloudKey() {
    if (!bluePropType || !redPropType) return null;
    // For cat-dog, preserve hand positions: blue (left) first, red (right) second
    // staff_club ≠ club_staff - they're different configurations
    const combinedProp = `catdog_${bluePropType}_${redPropType}` as PropType;
    return {
      sequenceName,
      propType: combinedProp,
      lightMode,
    };
  }

  /**
   * Render the thumbnail locally
   */
  async function renderThumbnail(): Promise<Blob> {
    const container = await getContainerInstance();
    const renderer = container.get<ISequenceRenderer>(TYPES.ISequenceRenderer);
    const startPositionDeriver = container.get<IStartPositionDeriver>(
      TYPES.IStartPositionDeriver
    );

    // Use the sequence prop directly if it has beat data (Library sequences)
    // Otherwise fall back to loading from the Gallery index
    let fullSequence = sequence;

    const hasBeats = sequence.beats && sequence.beats.length > 0;
    if (!hasBeats) {
      // No beat data in prop - try loading from Gallery index
      const loader = container.get<IDiscoverLoader>(TYPES.IDiscoverLoader);
      const loadedSequence = await loader.loadFullSequenceData(sequenceName);
      if (!loadedSequence) {
        throw new Error(`Sequence not found: ${sequenceName}`);
      }
      fullSequence = loadedSequence;
    }

    // Derive start position from first beat if not present or invalid
    // Start positions are no longer stored - they're derived dynamically
    const firstBeat = fullSequence.beats?.[0];
    const existingStartPos = fullSequence.startPosition;
    const hasValidStartPosition =
      existingStartPos &&
      existingStartPos.motions?.blue &&
      existingStartPos.motions?.red;

    const firstBeatHasValidMotions =
      firstBeat?.motions?.blue?.startLocation &&
      firstBeat?.motions?.red?.startLocation;

    if (!hasValidStartPosition && firstBeat && firstBeatHasValidMotions) {
      try {
        const derivedStartPos =
          startPositionDeriver.deriveFromFirstBeat(firstBeat);
        fullSequence = {
          ...fullSequence,
          startPosition: derivedStartPos,
        };
      } catch (err) {
        console.warn(
          `Failed to derive start position for ${sequenceName}:`,
          err
        );
      }
    }

    // Render with appropriate props
    // Use custom settings if provided, otherwise use defaults
    const renderOptions = {
      beatSize: 240,
      format: "WebP" as const,
      quality: 0.9,
      includeStartPosition: includeStartPosition ?? true,
      addBeatNumbers: addBeatNumbers ?? true,
      addWord: addWord ?? true,
      addDifficultyLevel: addDifficultyLevel ?? true,
      addUserInfo: addUserInfo ?? false,
      userName: userName ?? "",
      addReversalSymbols: true,
      backgroundColor: lightMode ? "#ffffff" : "#1a1a2e",
      // For single-prop mode, override all props to the selected type
      propTypeOverride: isCatDog ? undefined : (effectivePropType ?? undefined),
      // For cat-dog mode, override each color independently
      bluePropTypeOverride: isCatDog ? bluePropType : undefined,
      redPropTypeOverride: isCatDog ? redPropType : undefined,
      visibilityOverrides: {
        showTKA: true,
        showVTG: false,
        showElemental: false,
        showPositions: false,
        showReversals: true,
        showTurnNumbers: true,
        darkMode: !lightMode,
      },
    };

    console.log(
      `[PropAwareThumbnail] Rendering ${sequenceName} with options:`,
      {
        propTypeOverride: renderOptions.propTypeOverride,
        bluePropTypeOverride: renderOptions.bluePropTypeOverride,
        redPropTypeOverride: renderOptions.redPropTypeOverride,
        sequenceHasBeats: fullSequence.beats.length,
        sequenceHasStartPosition: !!fullSequence.startPosition,
        startPositionGridPos:
          fullSequence.startPosition &&
          "gridPosition" in fullSequence.startPosition
            ? fullSequence.startPosition.gridPosition
            : "none",
      }
    );

    const blob = await renderer.renderSequenceToBlob(
      fullSequence,
      renderOptions
    );

    return blob;
  }

  // React to prop changes - reload if props change while visible
  $effect(() => {
    // Read current values
    const currentBlue = bluePropType;
    const currentRed = redPropType;
    const currentCatDog = catDogModeEnabled;
    const currentLight = lightMode;
    // Read image composition settings
    const currentAddWord = addWord;
    const currentAddBeatNumbers = addBeatNumbers;
    const currentIncludeStartPosition = includeStartPosition;
    const currentAddDifficultyLevel = addDifficultyLevel;
    const currentAddUserInfo = addUserInfo;

    // Check if props actually changed (not just initial render)
    const propsChanged =
      hasInitiallyLoaded &&
      (currentBlue !== prevBlueProp ||
        currentRed !== prevRedProp ||
        currentCatDog !== prevCatDogMode ||
        currentLight !== prevLightMode ||
        currentAddWord !== prevAddWord ||
        currentAddBeatNumbers !== prevAddBeatNumbers ||
        currentIncludeStartPosition !== prevIncludeStartPosition ||
        currentAddDifficultyLevel !== prevAddDifficultyLevel ||
        currentAddUserInfo !== prevAddUserInfo);

    // Update previous values
    prevBlueProp = currentBlue;
    prevRedProp = currentRed;
    prevCatDogMode = currentCatDog;
    prevLightMode = currentLight;
    prevAddWord = currentAddWord;
    prevAddBeatNumbers = currentAddBeatNumbers;
    prevIncludeStartPosition = currentIncludeStartPosition;
    prevAddDifficultyLevel = currentAddDifficultyLevel;
    prevAddUserInfo = currentAddUserInfo;

    // Only reload if props actually changed while visible
    if (propsChanged && isVisible && !isLoading) {
      if (thumbnailUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(thumbnailUrl);
      }
      thumbnailUrl = null;
      loadThumbnail();
    }
  });
</script>

<div class="prop-thumbnail" bind:this={containerRef}>
  {#if thumbnailUrl}
    <img
      src={thumbnailUrl}
      alt={`Preview of ${sequenceName}`}
      loading="lazy"
      decoding="async"
    />
  {:else if isLoading}
    <div class="loading-placeholder" aria-label="Loading thumbnail">
      <div class="spinner"></div>
      {#if loadingStatus}
        <span class="loading-status">{loadingStatus}</span>
      {/if}
    </div>
  {:else if hasError}
    <div class="error-placeholder" aria-label="Failed to load thumbnail">
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
    /* Default: fill width, maintain aspect ratio */
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
    /* Allow shrinking to fit container */
    flex-shrink: 1;
  }

  /* Container query adaptive sizing - when inside SequenceMediaViewerUnified's image-container */
  @container image-container (aspect-ratio > 4/3) {
    /* Container is wider than 4:3 - constrain by height to fit */
    .prop-thumbnail {
      width: auto;
      height: 100cqh;
      max-height: 100%;
    }
  }

  @container image-container (aspect-ratio <= 4/3) {
    /* Container is taller than 4:3 - constrain by width to fit */
    .prop-thumbnail {
      width: 100cqw;
      height: auto;
      max-width: 100%;
    }
  }

  .prop-thumbnail img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: contain;
    /* Prevent image from exceeding thumbnail bounds */
    max-width: 100%;
    max-height: 100%;
  }

  .loading-placeholder,
  .error-placeholder,
  .empty-placeholder {
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

  .error-icon {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--semantic-error);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 1.25rem;
  }

  .letter {
    font-size: 3rem;
    font-weight: 700;
    opacity: 0.5;
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
  }
</style>

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
  import type { ICloudThumbnailCache, ThumbnailVariant } from "../services/contracts/ICloudThumbnailCache";
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
    /**
     * Cache variant determines what metadata is baked into the image:
     * - 'gallery': No user data footer (default, for Discover browsing)
     * - 'wordcard': With user data footer (for print cards)
     */
    variant?: ThumbnailVariant;
    // Image composition settings - when provided, skips cloud caching and renders fresh
    // This enables the sequence viewer to show customized export previews
    addWord?: boolean;
    addBeatNumbers?: boolean;
    includeStartPosition?: boolean;
    addDifficultyLevel?: boolean;
    addUserInfo?: boolean;
    userName?: string;
    // Granular footer controls
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
    // Image composition settings - undefined means use defaults
    addWord,
    addBeatNumbers,
    includeStartPosition,
    addDifficultyLevel,
    addUserInfo,
    userName,
    // Granular footer controls
    showCreatorName,
    showNotes,
    showBirthday,
    customNotesText,
  }: Props = $props();

  // Variant-specific cache defaults
  // Gallery: No user data footer (for Discover browsing)
  // WordCard: With user data footer (for print cards)
  const GALLERY_DEFAULTS = {
    addWord: true,
    addBeatNumbers: true,
    includeStartPosition: true,
    addDifficultyLevel: true,
    addUserInfo: false,
    showCreatorName: true,
    showNotes: true,
    showBirthday: true,
  };

  const WORDCARD_DEFAULTS = {
    addWord: true,
    addBeatNumbers: true,
    includeStartPosition: true,
    addDifficultyLevel: true,
    addUserInfo: true,  // Word cards always include user data
    showCreatorName: true,
    showNotes: true,
    showBirthday: true,
  };

  // Get the appropriate defaults based on variant
  const cacheDefaults = $derived(variant === "wordcard" ? WORDCARD_DEFAULTS : GALLERY_DEFAULTS);

  // Check if current settings differ from cloud cache defaults for this variant
  // If they match (or are undefined), we can use the cached version
  const settingsDifferFromDefaults = $derived(() => {
    const defaults = cacheDefaults;
    // If setting is undefined, it uses the default (no difference)
    // If setting is defined but matches default, no difference
    // If setting is defined and differs from default, must re-render
    if (addWord !== undefined && addWord !== defaults.addWord) return true;
    if (addBeatNumbers !== undefined && addBeatNumbers !== defaults.addBeatNumbers) return true;
    if (includeStartPosition !== undefined && includeStartPosition !== defaults.includeStartPosition) return true;
    if (addDifficultyLevel !== undefined && addDifficultyLevel !== defaults.addDifficultyLevel) return true;
    if (addUserInfo !== undefined && addUserInfo !== defaults.addUserInfo) return true;
    // Granular footer controls
    if (showCreatorName !== undefined && showCreatorName !== defaults.showCreatorName) return true;
    if (showNotes !== undefined && showNotes !== defaults.showNotes) return true;
    if (showBirthday !== undefined && showBirthday !== defaults.showBirthday) return true;
    if (customNotesText !== undefined) return true; // Any custom text differs from default
    return false;
  });

  // State
  let containerRef = $state<HTMLDivElement | null>(null);
  let thumbnailUrl = $state<string | null>(null);
  let isLoading = $state(false);
  let hasError = $state(false);
  let isVisible = $state(false);
  let loadingStatus = $state<string>("");

  // Render queue management - when props change mid-render, we need to re-render
  let pendingRerender = $state(false);
  let currentRenderVersion = $state(0); // Increments each time we start a render

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
  // Track previous granular footer settings
  let prevShowCreatorName = $state<boolean | undefined>(undefined);
  let prevShowNotes = $state<boolean | undefined>(undefined);
  let prevShowBirthday = $state<boolean | undefined>(undefined);
  let prevCustomNotesText = $state<string | undefined>(undefined);
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
   * Reload thumbnail when props change - INSTANT swap if cached, otherwise render
   *
   * AGGRESSIVE CANCELLATION: When props change, we immediately:
   * 1. Increment renderVersion to invalidate any in-progress renders
   * 2. Check cloud cache for new props (instant if hit)
   * 3. If cache miss, show loading state and render fresh
   *
   * Old renders are abandoned - they check renderVersion and abort.
   */
  async function reloadThumbnail() {
    // AGGRESSIVE: Always bump version to cancel any in-progress renders
    const renderVersion = ++currentRenderVersion;
    console.log(`[PropAwareThumbnail] ${sequenceName}: Starting reload v${renderVersion}`);

    // Clear pending flag - we're handling the change now
    pendingRerender = false;
    hasError = false;

    // Snapshot current props IMMEDIATELY
    const snapshotProps = {
      bluePropType,
      redPropType,
      catDogModeEnabled,
      lightMode,
      isCatDog,
      effectivePropType,
      sequenceName,
    };

    // STEP 1: Try cloud cache FIRST for instant swap
    try {
      const container = await getContainerInstance();
      const cloudCache = container.get<ICloudThumbnailCache>(
        TYPES.ICloudThumbnailCache
      );

      // Check if stale before cache lookup
      if (currentRenderVersion !== renderVersion) {
        console.log(`[PropAwareThumbnail] ${sequenceName}: Stale before cache check, aborting`);
        return;
      }

      const cloudKey = snapshotProps.isCatDog
        ? getCatDogCloudKeyWithProps(snapshotProps)
        : getSinglePropCloudKeyWithProps(snapshotProps);

      if (cloudKey) {
        const cloudUrl = await cloudCache.getUrl(cloudKey);

        // Check if stale after cache lookup
        if (currentRenderVersion !== renderVersion) {
          console.log(`[PropAwareThumbnail] ${sequenceName}: Stale after cache check, aborting`);
          return;
        }

        if (cloudUrl) {
          // INSTANT SWAP from cache!
          console.log(`[PropAwareThumbnail] ${sequenceName}: Cache hit! Instant swap`);
          const oldUrl = thumbnailUrl;
          thumbnailUrl = cloudUrl;
          if (oldUrl?.startsWith("blob:")) {
            URL.revokeObjectURL(oldUrl);
          }
          return; // Done - no render needed
        }
      }
    } catch (error) {
      console.warn(`[PropAwareThumbnail] ${sequenceName}: Cache check failed:`, error);
      // Continue to render
    }

    // Check if stale before starting render
    if (currentRenderVersion !== renderVersion) {
      console.log(`[PropAwareThumbnail] ${sequenceName}: Stale before render, aborting`);
      return;
    }

    // STEP 2: Cache miss - need to render
    // Show loading state immediately so user knows something is happening
    isLoading = true;
    loadingStatus = "Rendering...";

    try {
      const blob = await renderThumbnailWithProps(snapshotProps);

      // Check if stale after render - if so, discard completely
      if (currentRenderVersion !== renderVersion) {
        console.log(`[PropAwareThumbnail] ${sequenceName}: Render v${renderVersion} stale (now v${currentRenderVersion}), discarding`);
        return; // Just abandon - don't trigger another render
      }

      // Create new blob URL
      const newUrl = URL.createObjectURL(blob);

      // Preload to prevent flash
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to preload"));
        img.src = newUrl;
      });

      // Final stale check before swap
      if (currentRenderVersion !== renderVersion) {
        URL.revokeObjectURL(newUrl);
        return;
      }

      // Swap
      const oldUrl = thumbnailUrl;
      thumbnailUrl = newUrl;
      if (oldUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(oldUrl);
      }

      // Upload to cloud for next time (async, don't wait)
      const container = await getContainerInstance();
      const cloudCache = container.get<ICloudThumbnailCache>(
        TYPES.ICloudThumbnailCache
      );
      const cloudKey = snapshotProps.isCatDog
        ? getCatDogCloudKeyWithProps(snapshotProps)
        : getSinglePropCloudKeyWithProps(snapshotProps);
      if (cloudKey) {
        cloudCache.upload(cloudKey, blob).catch(() => {});
      }
    } catch (error) {
      // Only show error if this render is still current
      if (currentRenderVersion === renderVersion) {
        console.error(`[PropAwareThumbnail] ${sequenceName}: Render failed:`, error);
        // Keep old image on error
      }
    } finally {
      // Only clear loading if we're still the current render
      if (currentRenderVersion === renderVersion) {
        isLoading = false;
        loadingStatus = "";
      }
    }
  }

  /**
   * Main thumbnail loading function
   * Tries cloud cache first, then renders locally and uploads
   * When custom settings are provided, skips caching entirely
   *
   * IMPORTANT: We snapshot prop values at the start and pass them explicitly
   * to avoid race conditions where props change during async rendering.
   *
   * QUEUE MANAGEMENT: If props change during initial load, we schedule a
   * reload after this load completes to ensure we render with correct props.
   */
  async function loadThumbnail() {
    if (isLoading || thumbnailUrl) return;

    // Track this render's version to detect if it's stale
    const renderVersion = ++currentRenderVersion;

    // Early validation: need a usable sequence name
    if (!sequenceName) {
      console.warn(
        "[PropAwareThumbnail] Cannot load thumbnail: sequence has no word or name"
      );
      hasError = true;
      return;
    }

    // Early validation: need either beat data OR IDiscoverLoader
    const hasBeats = sequence.beats && sequence.beats.length > 0;
    if (!hasBeats) {
      const container = await getContainerInstance();
      if (!container.isBound(TYPES.IDiscoverLoader)) {
        console.warn(
          `[PropAwareThumbnail] Cannot render "${sequenceName}": no beat data and IDiscoverLoader unavailable`
        );
        hasError = true;
        return;
      }
    }

    isLoading = true;
    hasError = false;

    // CRITICAL: Snapshot prop values at the START to prevent race conditions.
    // If props change during async rendering, we'll detect it and abort.
    const snapshotProps = {
      bluePropType,
      redPropType,
      catDogModeEnabled,
      lightMode,
      isCatDog,
      effectivePropType,
      sequenceName,
    };

    try {
      // Only skip cloud cache if settings differ from the cached defaults
      // This allows the drawer to use cached images when settings match
      if (settingsDifferFromDefaults()) {
        loadingStatus = "Rendering...";
        const blob = await renderThumbnailWithProps(snapshotProps);

        // Check if props changed during render - if so, discard and schedule reload
        if (currentRenderVersion !== renderVersion || propsChangedSince(snapshotProps)) {
          console.log(
            `[PropAwareThumbnail] ${sequenceName}: Props changed during render, scheduling reload`
          );
          hasInitiallyLoaded = true; // Mark loaded so effect can trigger reload
          pendingRerender = true;
          return; // Will trigger reload in finally block
        }

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

      // Determine the cloud cache key based on snapshotted props
      const cloudKey = snapshotProps.isCatDog
        ? getCatDogCloudKeyWithProps(snapshotProps)
        : getSinglePropCloudKeyWithProps(snapshotProps);

      if (!cloudKey) {
        throw new Error("Could not determine prop configuration");
      }

      // DEBUG: Log what prop type we're requesting
      console.log(`[PropAwareThumbnail] Loading ${sequenceName} with props:`, {
        isCatDog: snapshotProps.isCatDog,
        effectivePropType: snapshotProps.effectivePropType,
        bluePropType: snapshotProps.bluePropType,
        redPropType: snapshotProps.redPropType,
        cloudKey,
      });

      // Step 1: Check Firebase Storage (cloud cache)
      loadingStatus = "Checking cloud...";
      const cloudUrl = await cloudCache.getUrl(cloudKey);

      // Check if props changed during cache check
      if (currentRenderVersion !== renderVersion || propsChangedSince(snapshotProps)) {
        console.log(
          `[PropAwareThumbnail] ${sequenceName}: Props changed during cache check, scheduling reload`
        );
        hasInitiallyLoaded = true;
        pendingRerender = true;
        return; // Will trigger reload in finally block
      }

      if (cloudUrl) {
        // Check if stale before using cloud URL
        if (currentRenderVersion !== renderVersion) {
          console.log(`[PropAwareThumbnail] ${sequenceName}: Stale after cloud hit, aborting`);
          return;
        }
        // Found in cloud! Use directly (no blob URL needed)
        console.log(`[PropAwareThumbnail] ${sequenceName}: Found in cloud: ${cloudUrl}`);
        thumbnailUrl = cloudUrl;
        hasInitiallyLoaded = true;
        loadingStatus = "";
        return;
      }

      // Step 2: Not in cloud - render locally with snapshotted props
      console.log(`[PropAwareThumbnail] Not in cloud, rendering locally...`);
      loadingStatus = "Rendering...";
      const blob = await renderThumbnailWithProps(snapshotProps);

      // CRITICAL: Check if props changed during render - if so, discard result
      // This prevents caching images with wrong props
      if (currentRenderVersion !== renderVersion || propsChangedSince(snapshotProps)) {
        console.log(
          `[PropAwareThumbnail] ${sequenceName}: Props changed during render, scheduling reload`
        );
        hasInitiallyLoaded = true;
        pendingRerender = true;
        return; // Will trigger reload in finally block
      }

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
      if (snapshotProps.isCatDog) {
        const localCache = container.get<IDiscoverThumbnailCache>(
          TYPES.IDiscoverThumbnailCache
        );
        const localKey = {
          sequenceName: snapshotProps.sequenceName,
          bluePropType: snapshotProps.bluePropType!,
          redPropType: snapshotProps.redPropType!,
          lightMode: snapshotProps.lightMode,
        };
        localCache.set(localKey, blob).catch((error) => {
          console.warn(`Failed to cache thumbnail locally:`, error);
        });
      }

      loadingStatus = "";
    } catch (error) {
      // Only show error if this render is still current
      if (currentRenderVersion === renderVersion) {
        console.error(`Failed to load thumbnail for ${sequenceName}:`, error);
        hasError = true;
      }
    } finally {
      // Only clear loading state if we're still the current render
      // If props changed, a new render is already running
      if (currentRenderVersion === renderVersion) {
        isLoading = false;
        loadingStatus = "";
      }
    }
  }

  // Type for prop snapshot to prevent race conditions
  type SnapshotProps = {
    bluePropType: PropType | undefined;
    redPropType: PropType | undefined;
    catDogModeEnabled: boolean;
    lightMode: boolean;
    isCatDog: boolean;
    effectivePropType: PropType | null;
    sequenceName: string;
  };

  /**
   * Check if props have changed since the snapshot was taken
   */
  function propsChangedSince(snapshot: SnapshotProps): boolean {
    return (
      bluePropType !== snapshot.bluePropType ||
      redPropType !== snapshot.redPropType ||
      catDogModeEnabled !== snapshot.catDogModeEnabled ||
      lightMode !== snapshot.lightMode
    );
  }

  /**
   * Get cloud cache key for single-prop mode (using snapshotted props)
   */
  function getSinglePropCloudKeyWithProps(props: SnapshotProps) {
    if (!props.effectivePropType) return null;
    return {
      sequenceName: props.sequenceName,
      propType: props.effectivePropType,
      lightMode: props.lightMode,
      variant,  // Include variant to separate gallery/wordcard caches
    };
  }

  /**
   * Get cloud cache key for cat-dog mode (using snapshotted props)
   * Uses a combined prop type identifier with position preserved
   * Blue = left hand, Red = right hand - order matters!
   */
  function getCatDogCloudKeyWithProps(props: SnapshotProps) {
    if (!props.bluePropType || !props.redPropType) return null;
    // For cat-dog, preserve hand positions: blue (left) first, red (right) second
    // staff_club ≠ club_staff - they're different configurations
    const combinedProp =
      `catdog_${props.bluePropType}_${props.redPropType}` as PropType;
    return {
      sequenceName: props.sequenceName,
      propType: combinedProp,
      lightMode: props.lightMode,
      variant,  // Include variant to separate gallery/wordcard caches
    };
  }

  /**
   * Render the thumbnail locally using SNAPSHOTTED props
   * This prevents race conditions where props change mid-render
   */
  async function renderThumbnailWithProps(
    props: SnapshotProps
  ): Promise<Blob> {
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
      // IDiscoverLoader may not be available outside of Discover module context
      if (!container.isBound(TYPES.IDiscoverLoader)) {
        throw new Error(
          `Cannot render thumbnail for "${props.sequenceName}": sequence has no beat data and IDiscoverLoader is not available in this context.`
        );
      }
      const loader = container.get<IDiscoverLoader>(TYPES.IDiscoverLoader);
      const loadedSequence = await loader.loadFullSequenceData(
        props.sequenceName
      );
      if (!loadedSequence) {
        throw new Error(`Sequence not found: ${props.sequenceName}`);
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
          `Failed to derive start position for ${props.sequenceName}:`,
          err
        );
      }
    }

    // Render with appropriate props - USING SNAPSHOTTED VALUES
    // Use custom settings if provided, otherwise use variant-specific defaults
    const defaults = cacheDefaults;
    const renderOptions = {
      beatSize: 240,
      format: "WebP" as const,
      quality: 0.9,
      includeStartPosition: includeStartPosition ?? defaults.includeStartPosition,
      addBeatNumbers: addBeatNumbers ?? defaults.addBeatNumbers,
      addWord: addWord ?? defaults.addWord,
      addDifficultyLevel: addDifficultyLevel ?? defaults.addDifficultyLevel,
      addUserInfo: addUserInfo ?? defaults.addUserInfo,
      userName: userName ?? "",
      // Granular footer controls - use variant-specific defaults
      showCreatorName: showCreatorName ?? defaults.showCreatorName,
      showNotes: showNotes ?? defaults.showNotes,
      showBirthday: showBirthday ?? defaults.showBirthday,
      customNotesText: customNotesText,
      addReversalSymbols: true,
      backgroundColor: props.lightMode ? "#ffffff" : "#1a1a2e",
      // For single-prop mode, override all props to the selected type
      // CRITICAL: Use snapshotted props, not reactive state
      propTypeOverride: props.isCatDog
        ? undefined
        : (props.effectivePropType ?? undefined),
      // For cat-dog mode, override each color independently
      bluePropTypeOverride: props.isCatDog ? props.bluePropType : undefined,
      redPropTypeOverride: props.isCatDog ? props.redPropType : undefined,
      visibilityOverrides: {
        showTKA: true,
        showVTG: false,
        showElemental: false,
        showPositions: false,
        showReversals: true,
        showTurnNumbers: true,
        darkMode: !props.lightMode,
      },
    };

    console.log(
      `[PropAwareThumbnail] Rendering ${props.sequenceName} with options:`,
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
    // Read granular footer settings
    const currentShowCreatorName = showCreatorName;
    const currentShowNotes = showNotes;
    const currentShowBirthday = showBirthday;
    const currentCustomNotesText = customNotesText;

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
        currentAddUserInfo !== prevAddUserInfo ||
        currentShowCreatorName !== prevShowCreatorName ||
        currentShowNotes !== prevShowNotes ||
        currentShowBirthday !== prevShowBirthday ||
        currentCustomNotesText !== prevCustomNotesText);

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
    prevShowCreatorName = currentShowCreatorName;
    prevShowNotes = currentShowNotes;
    prevShowBirthday = currentShowBirthday;
    prevCustomNotesText = currentCustomNotesText;

    // Reload if props changed while visible
    // AGGRESSIVE: Always trigger reload - it will bump version and cancel any in-progress renders
    // The reload checks cloud cache first for instant swap
    if (propsChanged && isVisible) {
      console.log(`[PropAwareThumbnail] ${sequenceName}: Props changed, triggering reload`);
      reloadThumbnail();
    }
  });
</script>

<div class="prop-thumbnail" data-variant={variant} bind:this={containerRef}>
  {#if thumbnailUrl}
    <img
      src={thumbnailUrl}
      alt={`Preview of ${sequenceName}`}
      loading="lazy"
      decoding="async"
      draggable="false"
    />
    <!-- Loading overlay - shows on TOP of existing image during re-renders -->
    {#if isLoading && loadingStatus}
      <div class="loading-overlay" aria-label="Re-rendering thumbnail">
        <div class="spinner"></div>
        <span class="loading-status">{loadingStatus}</span>
      </div>
    {/if}
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

  /* Container query adaptive sizing - when inside SequenceViewer's image-container */
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

  /* Word cards use natural image dimensions (no forced aspect ratio) */
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
    /* Prevent image from exceeding thumbnail bounds */
    max-width: 100%;
    max-height: 100%;
    /* Prevent drag-and-drop on desktop */
    -webkit-user-drag: none;
    user-select: none;
    pointer-events: none;
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

  /* Loading overlay - shows on TOP of existing image during re-renders */
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

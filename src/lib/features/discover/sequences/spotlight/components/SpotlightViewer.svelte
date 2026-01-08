<!-- SpotlightViewer.svelte - Fullscreen viewer for images or beat grids -->
<script lang="ts">
  import { browser } from "$app/environment";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { IDiscoverThumbnailProvider } from "../../display/services/contracts/IDiscoverThumbnailProvider";
  import type { SpotlightDisplayMode } from "$lib/shared/application/state/ui/ui-state.svelte";
  import BeatGrid from "$lib/features/create/shared/workspace-panel/sequence-display/components/BeatGrid.svelte";

  // ✅ PURE RUNES: Props using modern Svelte 5 runes
  const {
    show = false,
    sequence,
    thumbnailService,
    displayMode = "image",
    onClose = () => {},
  } = $props<{
    show?: boolean;
    sequence?: SequenceData;
    thumbnailService?: IDiscoverThumbnailProvider;
    displayMode?: SpotlightDisplayMode;
    onClose?: () => void;
  }>();

  // State
  let isVisible = $state(false);
  let isClosing = $state(false);
  let imageUrl = $state<string>("");
  let imageElement = $state<HTMLImageElement | null>(null);
  let shouldRotate = $state(false);
  let manualRotationOverride = $state<boolean | null>(null); // null = auto, true/false = manual
  let showColumnPicker = $state(false);

  // Persist column preference to localStorage (device-specific)
  const COLUMN_STORAGE_KEY = "tka_spotlight_column_count";
  let manualColumnCount = $state<number | null>(
    browser
      ? JSON.parse(localStorage.getItem(COLUMN_STORAGE_KEY) ?? "null")
      : null
  );

  // Persist column changes
  $effect(() => {
    if (browser) {
      localStorage.setItem(
        COLUMN_STORAGE_KEY,
        JSON.stringify(manualColumnCount)
      );
    }
  });

  // Track fullscreen state
  let _spotlightElement = $state<HTMLElement | null>(null);

  // Show/hide logic
  $effect(() => {
    if (show && sequence) {
      console.log("✨ Spotlight viewer opened", { displayMode });
      isVisible = true;
      isClosing = false;

      // Prevent inadvertent text/image selection while overlay is open (desktop emulation)
      try {
        document.documentElement.classList.add("tka-no-select");
      } catch {}

      // Only load image URL in image mode
      if (displayMode === "image") {
        // Get first variation thumbnail
        const thumbnail = sequence.thumbnails?.[0];
        if (thumbnail) {
          // Check if thumbnail is already a full URL (starts with http, /, or blob:)
          if (
            thumbnail.startsWith("http") ||
            thumbnail.startsWith("/") ||
            thumbnail.startsWith("blob:")
          ) {
            // Use the URL directly
            imageUrl = thumbnail;
          } else if (thumbnailService) {
            // Use thumbnail service to construct the URL
            try {
              imageUrl = thumbnailService.getThumbnailUrl(
                sequence.id,
                thumbnail
              );
            } catch (error) {
              console.warn("Failed to resolve thumbnail via service", error);
              // Fallback: try using it as a relative path
              imageUrl = `/gallery/${thumbnail}`;
            }
          } else {
            // No service available, assume it's a gallery path
            imageUrl = `/gallery/${thumbnail}`;
          }
        }
      }
    }
  });

  // Calculate if image should be rotated based on viewport and image aspect ratios
  function calculateRotation() {
    if (!imageElement) return;

    // If user has manually overridden rotation, respect that
    if (manualRotationOverride !== null) {
      shouldRotate = manualRotationOverride;
      return;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // On desktop (screens wider than 1024px), don't auto-rotate
    // User has plenty of screen space and won't be rotating their monitor
    // They can still manually rotate using the button if desired
    const isDesktop = viewportWidth >= 1024;
    if (isDesktop) {
      shouldRotate = false;
      return;
    }

    // Mobile/tablet: apply smart rotation logic
    const viewportIsLandscape = viewportWidth > viewportHeight;

    const imageWidth = imageElement.naturalWidth;
    const imageHeight = imageElement.naturalHeight;
    const imageAspectRatio = imageWidth / imageHeight;

    // Check if image is approximately square (aspect ratio between 0.85 and 1.15)
    const isSquareImage = imageAspectRatio >= 0.85 && imageAspectRatio <= 1.15;

    const imageIsLandscape = imageWidth > imageHeight;

    let newRotation: boolean;

    if (isSquareImage) {
      // Square images (like 16-count sequences) should rotate by default on mobile
      // This uses more screen real estate on portrait phone screens
      newRotation = true;
    } else {
      // Non-square images: rotate if orientations don't match
      newRotation = viewportIsLandscape !== imageIsLandscape;
    }

    console.log("🔄 Rotation calculation:", {
      viewport: {
        width: viewportWidth,
        height: viewportHeight,
        isLandscape: viewportIsLandscape,
        isDesktop,
      },
      image: {
        width: imageWidth,
        height: imageHeight,
        aspectRatio: imageAspectRatio.toFixed(2),
        isSquare: isSquareImage,
        isLandscape: imageIsLandscape,
      },
      shouldRotate: newRotation,
    });

    shouldRotate = newRotation;
  }

  // Check rotation when image loads
  function handleImageLoad(event: Event) {
    const img = event.target as HTMLImageElement;
    imageElement = img;
    calculateRotation();
  }

  // Debounce timer for resize
  let resizeTimer: number | undefined;

  // Recalculate rotation on window resize (debounced for performance)
  // Only applies to image mode - beatgrid mode locks rotation to user choice
  function handleResize() {
    // In beatgrid mode, don't auto-change rotation - user is in control
    if (displayMode === "beatgrid") return;

    // In image mode with manual override, also don't change
    if (manualRotationOverride !== null) return;

    // Clear existing timer
    if (resizeTimer) {
      clearTimeout(resizeTimer);
    }

    // Debounce to avoid too many calculations during resize
    resizeTimer = setTimeout(() => {
      calculateRotation();
    }, 100) as unknown as number;
  }

  // Toggle rotation manually
  function toggleRotation(event?: MouseEvent) {
    // Stop propagation to prevent closing the spotlight
    event?.stopPropagation();

    // Toggle the rotation state
    shouldRotate = !shouldRotate;
    manualRotationOverride = shouldRotate;

    console.log("🔄 Manual rotation toggled:", shouldRotate);
  }

  // Toggle column picker
  function toggleColumnPicker(event?: MouseEvent) {
    event?.stopPropagation();
    showColumnPicker = !showColumnPicker;
  }

  // Set manual column count
  function setColumnCount(count: number | null, event?: MouseEvent) {
    event?.stopPropagation();
    manualColumnCount = count;
    showColumnPicker = false;
  }

  // Get suggested column options based on viewport width
  // Offers all viable options - user can choose what looks best for their sequence
  function getColumnOptions(
    _beatCount: number,
    viewportWidth: number
  ): number[] {
    const options: number[] = [];

    // Minimum cell size to avoid cramped layouts
    const MIN_CELL_SIZE = 60; // pixels

    // Calculate max viable columns based on screen width
    // Formula: (viewportWidth - padding) / (columns + 1 for start position) >= MIN_CELL_SIZE
    const maxViableColumns =
      Math.floor((viewportWidth - 32) / MIN_CELL_SIZE) - 1;

    // Offer all standard column options that fit the screen
    if (maxViableColumns >= 2) options.push(2);
    if (maxViableColumns >= 4) options.push(4);
    if (maxViableColumns >= 6) options.push(6);
    if (maxViableColumns >= 8) options.push(8);

    return options;
  }

  const columnOptions = $derived(
    sequence?.beats
      ? getColumnOptions(sequence.beats.length, window.innerWidth)
      : [4, 6, 8]
  );

  // Calculate optimal column count that maximizes cell size while fitting in viewport
  // This is used when manualColumnCount is null (Auto mode)
  const optimalColumnCount = $derived.by(() => {
    if (!sequence?.beats || !browser) return null;

    const beatCount = sequence.beats.length;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Grid gap and padding (must match BeatGrid.svelte values)
    const gridGap = 1;
    const padding = 32; // Account for viewport padding

    // Test each viable column count and find which gives the largest cell size
    const candidateColumns = [2, 4, 6, 8].filter(
      (cols) => cols <= beatCount + 1
    );

    let bestColumns = 4;
    let bestCellSize = 0;

    for (const cols of candidateColumns) {
      const totalColumns = cols + 1; // +1 for start position
      const rows = Math.ceil(beatCount / cols);

      // Calculate cell size constrained by both width and height
      const widthGaps = (totalColumns - 1) * gridGap;
      const heightGaps = (rows - 1) * gridGap;

      const maxCellByWidth =
        (viewportWidth - padding - widthGaps) / totalColumns;
      const maxCellByHeight = (viewportHeight - padding - heightGaps) / rows;

      // Cell size is limited by the smaller dimension
      const cellSize = Math.min(maxCellByWidth, maxCellByHeight);

      if (cellSize > bestCellSize) {
        bestCellSize = cellSize;
        bestColumns = cols;
      }
    }

    return bestColumns;
  });

  // Effective column count: user's manual choice, or auto-optimized
  const effectiveColumnCount = $derived(
    manualColumnCount !== null ? manualColumnCount : optimalColumnCount
  );

  // Detect if current layout is suboptimal (too many columns for screen size)
  const isLayoutCramped = $derived.by(() => {
    if (!manualColumnCount || !sequence?.beats) return false;

    const MIN_COMFORTABLE_CELL_SIZE = 80;
    const estimatedCellWidth =
      (window.innerWidth - 32) / (manualColumnCount + 1);

    return estimatedCellWidth < MIN_COMFORTABLE_CELL_SIZE;
  });

  // Close handler
  function handleClose() {
    isClosing = true;

    // Wait for animation
    setTimeout(() => {
      isVisible = false;
      isClosing = false;
      shouldRotate = false;
      manualRotationOverride = null; // Reset manual override on close
      // Note: manualColumnCount is NOT reset - it persists via localStorage
      showColumnPicker = false;
      try {
        document.documentElement.classList.remove("tka-no-select");
      } catch {}
      onClose();
    }, 300);
  }

  // Handle escape key and rotation shortcut
  function handleKeydown(event: KeyboardEvent) {
    if (!isVisible) return;

    if (event.key === "Escape") {
      event.preventDefault();
      handleClose();
    } else if (event.key === "r" || event.key === "R") {
      event.preventDefault();
      toggleRotation();
    }
  }

  // Handle keyboard interaction for the dialog (accessibility)
  function handleDialogKeydown(event: KeyboardEvent) {
    // Close on Enter or Space (when focused on the dialog itself)
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleClose();
    }
  }

  // No Fullscreen API: viewport-only overlay, nothing to handle here
</script>

<svelte:window
  onkeydown={handleKeydown}
  onresize={handleResize}
  onorientationchange={handleResize}
/>

{#if isVisible && (imageUrl || displayMode === "beatgrid")}
  <!-- Fullscreen overlay - clicking anywhere closes -->
  <div
    bind:this={_spotlightElement}
    class="spotlight"
    class:closing={isClosing}
    onclick={handleClose}
    onkeydown={handleDialogKeydown}
    role="dialog"
    aria-modal="true"
    aria-label="Maximized sequence view"
    tabindex="-1"
  >
    {#if displayMode === "beatgrid" && sequence}
      <!-- Beat grid mode: render sequence directly, filling viewport -->
      <!-- Tap anywhere to close - no buttons needed -->
      <div class="spotlight-beatgrid">
        <BeatGrid
          beats={sequence.beats ?? []}
          startPosition={sequence.startPosition ??
            sequence.startingPositionBeat ??
            null}
          isSideBySideLayout={false}
          isSpotlightMode={true}
          manualColumnCount={effectiveColumnCount}
        />
      </div>

      <!-- Column picker button - bottom left corner (beatgrid mode only) -->
      <button
        class="column-picker-button"
        class:pulsing={isLayoutCramped}
        onclick={toggleColumnPicker}
        aria-label="Adjust grid columns"
        title="Adjust grid columns"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
      </button>

      <!-- Layout hint - show when cramped -->
      {#if isLayoutCramped && !showColumnPicker}
        <div class="layout-hint">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          Too many columns - tap grid icon to adjust
        </div>
      {/if}

      <!-- Column options picker -->
      {#if showColumnPicker}
        <div class="column-picker-menu">
          <div class="column-picker-header">Grid Columns</div>
          <button
            class="column-option"
            class:active={manualColumnCount === null}
            onclick={(e) => setColumnCount(null, e)}
          >
            Auto
          </button>
          {#each columnOptions as colCount}
            <button
              class="column-option"
              class:active={manualColumnCount === colCount}
              onclick={(e) => setColumnCount(colCount, e)}
            >
              {colCount} columns
            </button>
          {/each}
        </div>
      {/if}
    {:else}
      <!-- Image mode: show thumbnail, tap anywhere to close -->
      <img
        src={imageUrl}
        alt={sequence?.name || sequence?.word || "Sequence"}
        class="spotlight-image"
        class:rotated={shouldRotate}
        onload={handleImageLoad}
      />

      <!-- Rotate button - bottom right corner (image mode only) -->
      <button
        class="rotate-button"
        onclick={toggleRotation}
        aria-label="Rotate view"
        title="Rotate view (R)"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="23 4 23 10 17 10"></polyline>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
        </svg>
      </button>
    {/if}
  </div>
{/if}

<style>
  .spotlight {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.98);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    animation: fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    -webkit-tap-highlight-color: transparent; /* Remove tap highlight on mobile */
    user-select: none;
  }

  .spotlight.closing {
    animation: fadeOut 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes fadeOut {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }

  .spotlight-image {
    max-width: 100vw;
    max-height: 100vh;
    width: auto;
    height: auto;
    object-fit: contain;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    -webkit-tap-highlight-color: transparent;
    user-select: none;
    pointer-events: none; /* prevent selecting image; clicks handled by overlay */
  }

  /* Rotate image 90 degrees when orientations don't match */
  .spotlight-image.rotated {
    transform: rotate(90deg);
    /* When rotated, swap width/height constraints */
    max-width: 100vh;
    max-height: 100vw;
  }

  /* Beat grid container - fills entire viewport, tap anywhere to close */
  .spotlight-beatgrid {
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    /* Clicks pass through to parent spotlight for closing */
    pointer-events: none;
  }

  /* Beat grid content - constrain to container size */
  .spotlight-beatgrid :global(.beat-grid-container) {
    pointer-events: none;
    max-width: 100%;
    max-height: 100%;
    width: 100%;
    height: 100%;
  }

  /* Rotate button - image mode only */
  .rotate-button {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border-radius: 50%;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke-strong);
    color: var(--theme-text, white);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    z-index: 10000;
    pointer-events: auto; /* Allow clicks on button */
  }

  .rotate-button:hover {
    background: var(--theme-card-hover-bg);
    border-color: color-mix(in srgb, var(--theme-text, white) 40%, transparent);
    transform: scale(1.05);
  }

  .rotate-button:active {
    transform: scale(0.95);
  }

  .rotate-button svg {
    width: 24px;
    height: 24px;
  }

  /* Column picker button - bottom left corner (beatgrid mode only) */
  .column-picker-button {
    position: fixed;
    bottom: 2rem;
    left: 2rem;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border-radius: 50%;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke-strong);
    color: var(--theme-text, white);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    z-index: 10000;
    pointer-events: auto;
  }

  .column-picker-button:hover {
    background: var(--theme-card-hover-bg);
    border-color: color-mix(in srgb, var(--theme-text, white) 40%, transparent);
    transform: scale(1.05);
  }

  .column-picker-button:active {
    transform: scale(0.95);
  }

  /* Pulsing animation for cramped layout hint */
  .column-picker-button.pulsing {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    border-color: rgba(251, 191, 36, 0.6);
  }

  @keyframes pulse {
    0%,
    100% {
      box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.7);
    }
    50% {
      box-shadow: 0 0 0 8px rgba(251, 191, 36, 0);
    }
  }

  /* Column picker menu */
  .column-picker-menu {
    position: fixed;
    bottom: 6rem;
    left: 2rem;
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke-strong);
    border-radius: 12px;
    padding: 8px;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    z-index: 10001;
    pointer-events: auto;
    min-width: 140px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    animation: slideUp 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .column-picker-header {
    font-size: var(--font-size-compact);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--theme-text-dim);
    padding: 8px 12px 6px;
    margin-bottom: 4px;
  }

  .column-option {
    width: 100%;
    padding: 10px 12px;
    border-radius: 8px;
    background: transparent;
    border: 1px solid transparent;
    color: var(--theme-text, white);
    cursor: pointer;
    font-size: var(--font-size-sm);
    font-weight: 500;
    text-align: left;
    transition: all 0.15s ease;
    margin-bottom: 4px;
  }

  .column-option:last-child {
    margin-bottom: 0;
  }

  .column-option:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .column-option.active {
    background: rgba(6, 182, 212, 0.2);
    border-color: rgba(6, 182, 212, 0.5);
    color: #06b6d4;
  }

  /* Layout hint tooltip */
  .layout-hint {
    position: fixed;
    bottom: 6rem;
    left: 2rem;
    background: rgba(251, 191, 36, 0.95);
    color: rgba(0, 0, 0, 0.9);
    padding: 10px 14px;
    border-radius: 8px;
    font-size: var(--font-size-compact);
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    z-index: 10001;
    pointer-events: none;
    box-shadow: 0 4px 16px var(--theme-shadow);
    animation: slideUpBounce 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    max-width: 220px;
  }

  @keyframes slideUpBounce {
    0% {
      opacity: 0;
      transform: translateY(20px) scale(0.9);
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .layout-hint svg {
    flex-shrink: 0;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .spotlight,
    .spotlight-image,
    .spotlight-beatgrid,
    .rotate-button,
    .column-picker-button,
    .column-picker-menu,
    .layout-hint {
      animation: none !important;
      transition: none;
    }

    .spotlight-image.rotated {
      transition: none;
    }

    /* Still show pulsing hint visually but without animation */
    .column-picker-button.pulsing {
      border-color: rgba(251, 191, 36, 0.8);
      box-shadow: 0 0 0 2px rgba(251, 191, 36, 0.3);
    }
  }

  /* Disable selection globally while spotlight is open */
  :global(.tka-no-select),
  :global(.tka-no-select *) {
    -webkit-user-select: none !important;
    -moz-user-select: none !important;
    -ms-user-select: none !important;
    user-select: none !important;
  }
</style>

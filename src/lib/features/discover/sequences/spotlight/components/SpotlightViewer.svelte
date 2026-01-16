<!-- SpotlightViewer.svelte - Fullscreen viewer for images, beat grids, or animations -->
<script lang="ts">
  import { browser } from "$app/environment";
  import { onDestroy } from "svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { IDiscoverThumbnailProvider } from "../../display/services/contracts/IDiscoverThumbnailProvider";
  import type { SpotlightDisplayMode } from "$lib/shared/application/state/ui/ui-state.svelte";
  import StepGrid from "$lib/features/create/shared/workspace-panel/sequence-display/components/StepGrid.svelte";
  import AnimationPlayer from "$lib/shared/sequence-viewer/components/AnimationPlayer.svelte";
  import PropAwareThumbnail from "../../display/components/PropAwareThumbnail.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";

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
  let shouldRotate = $state(false);
  let manualRotationOverride = $state<boolean | null>(null); // null = auto, true/false = manual
  let showColumnPicker = $state(false);

  // Light mode tracking - reacts to "L" key toggle
  const visibilityManager = getAnimationVisibilityManager();
  let lightMode = $state(!visibilityManager.isDarkMode());

  function handleVisibilityChange() {
    lightMode = !visibilityManager.isDarkMode();
  }

  visibilityManager.registerObserver(handleVisibilityChange);

  onDestroy(() => {
    visibilityManager.unregisterObserver(handleVisibilityChange);
  });

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
      isVisible = true;
      isClosing = false;

      // Prevent inadvertent text/image selection while overlay is open (desktop emulation)
      try {
        document.documentElement.classList.add("tka-no-select");
      } catch {}
    }
  });

  // Rotation is manually controlled by user via button
  // No auto-rotation since PropAwareThumbnail handles its own aspect ratio

  // Toggle rotation manually
  function toggleRotation(event?: MouseEvent) {
    // Stop propagation to prevent closing the spotlight
    event?.stopPropagation();

    // Toggle the rotation state
    shouldRotate = !shouldRotate;
    manualRotationOverride = shouldRotate;
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
    sequence?.steps
      ? getColumnOptions(sequence.steps.length, window.innerWidth)
      : [4, 6, 8]
  );

  // Calculate optimal column count that maximizes cell size while fitting in viewport
  // This is used when manualColumnCount is null (Auto mode)
  const optimalColumnCount = $derived.by(() => {
    if (!sequence?.steps || !browser) return null;

    const stepCount = sequence.steps.length;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Grid gap and padding (must match StepGrid.svelte values)
    const gridGap = 1;
    const padding = 32; // Account for viewport padding

    // Test each viable column count and find which gives the largest cell size
    const candidateColumns = [2, 4, 6, 8].filter(
      (cols) => cols <= stepCount + 1
    );

    let bestColumns = 4;
    let bestCellSize = 0;

    for (const cols of candidateColumns) {
      const totalColumns = cols + 1; // +1 for start position
      const rows = Math.ceil(stepCount / cols);

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
    if (!manualColumnCount || !sequence?.steps) return false;

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

<svelte:window onkeydown={handleKeydown} />

{#if isVisible && sequence}
  <!-- Fullscreen overlay - clicking anywhere closes (except animation mode) -->
  <div
    bind:this={_spotlightElement}
    class="spotlight"
    class:closing={isClosing}
    onclick={displayMode !== "animation" ? handleClose : undefined}
    onkeydown={handleDialogKeydown}
    role="dialog"
    aria-modal="true"
    aria-label="Maximized sequence view"
    tabindex="-1"
  >
    {#if displayMode === "animation" && sequence}
      <!-- Animation mode: fullscreen AnimationPlayer with minimal controls -->
      <div class="spotlight-animation">
        <AnimationPlayer
          {sequence}
          autoPlay={true}
          showControls={true}
          controlsLevel="minimal"
          layout="vertical"
        />
      </div>

      <!-- Close button - top right corner (animation mode) -->
      <button
        class="close-button"
        onclick={handleClose}
        aria-label="Close fullscreen view"
        title="Close (Escape)"
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
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    {:else if displayMode === "stepgrid" && sequence}
      <!-- Beat grid mode: render sequence directly, filling viewport -->
      <!-- Tap anywhere to close - no buttons needed -->
      <div class="spotlight-stepgrid">
        <StepGrid
          steps={sequence.steps ?? []}
          startPosition={sequence.startPosition ??
            sequence.startingPosition ??
            null}
          isSideBySideLayout={false}
          isSpotlightMode={true}
          manualColumnCount={effectiveColumnCount}
        />
      </div>

      <!-- Column picker button - bottom left corner (stepgrid mode only) -->
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
      <!-- Image mode: render with PropAwareThumbnail (uses modern cloud thumbnail system) -->
      <div class="spotlight-image-container" class:rotated={shouldRotate}>
        <PropAwareThumbnail {sequence} {lightMode} />
      </div>

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

  /* Image container - PropAwareThumbnail renders inside */
  .spotlight-image-container {
    max-width: 100vw;
    max-height: 100vh;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    box-sizing: border-box;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    -webkit-tap-highlight-color: transparent;
    user-select: none;
    pointer-events: none; /* prevent selecting; clicks handled by overlay */
  }

  /* Rotate container 90 degrees when user toggles rotation */
  .spotlight-image-container.rotated {
    transform: rotate(90deg);
    /* When rotated, swap width/height constraints */
    max-width: 100vh;
    max-height: 100vw;
    width: 100vh;
    height: 100vw;
  }

  /* Animation container - fills viewport with AnimationPlayer */
  .spotlight-animation {
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    padding: 16px;
    /* Animation controls need pointer events */
    pointer-events: auto;
  }

  /* Close button for animation mode */
  .close-button {
    position: fixed;
    top: max(env(safe-area-inset-top, 16px), 16px);
    right: max(env(safe-area-inset-right, 16px), 16px);
    width: var(--min-touch-target, 48px);
    height: var(--min-touch-target, 48px);
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(0, 0, 0, 0.6));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, white);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    z-index: 10001;
    pointer-events: auto;
  }

  .close-button:hover {
    background: var(--theme-card-hover-bg, rgba(0, 0, 0, 0.8));
    border-color: rgba(255, 255, 255, 0.4);
    transform: scale(1.05);
  }

  .close-button:active {
    transform: scale(0.95);
  }

  .close-button svg {
    width: 24px;
    height: 24px;
  }

  /* Beat grid container - fills entire viewport, tap anywhere to close */
  .spotlight-stepgrid {
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
  .spotlight-stepgrid :global(.beat-grid-container) {
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

  /* Column picker button - bottom left corner (stepgrid mode only) */
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
    .spotlight-image-container,
    .spotlight-stepgrid,
    .spotlight-animation,
    .rotate-button,
    .close-button,
    .column-picker-button,
    .column-picker-menu,
    .layout-hint {
      animation: none !important;
      transition: none;
    }

    .spotlight-image-container.rotated {
      transition: none;
    }

    .close-button:hover,
    .close-button:active {
      transform: none;
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
